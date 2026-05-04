"""
Per-Tenant Concurrency Control — Redis-backed distributed semaphore.

Ensures no single org_id can monopolize the pipeline by limiting
concurrent jobs per tenant. Uses Redis INCR/DECR with safety TTL.

Architecture:
    Key: kp:concurrency:{org_id}  → integer (current active count)
    TTL: 1 hour safety net for stuck counters

    acquire_slot() → True if under limit, increments counter
    release_slot() → Decrements counter (never below 0)

    When Redis is unavailable, falls back to allowing all jobs
    (fail-open) to avoid blocking the entire pipeline.

Usage:
    if await limiter.acquire_slot("hki"):
        try:
            await run_pipeline(job)
        finally:
            await limiter.release_slot("hki")
    else:
        # Nack message — will be retried after backoff
        raise ConcurrencyLimitExceededError(org_id)
"""

from __future__ import annotations

import typing

import redis.asyncio as aioredis

import src.core.config
import src.core.logging

logger = src.core.logging.logger.getChild("concurrency")


class ConcurrencyLimitExceededError(Exception):
    """Raised when an org has hit its max concurrent job limit."""

    def __init__(self, org_id: str, current: int, limit: int) -> None:
        self.org_id: str = org_id
        self.current: int = current
        self.limit: int = limit
        super().__init__(f"Org '{org_id}' has {current}/{limit} concurrent jobs — retry later")


class ConcurrencyLimiter(typing.Protocol):
    """Interface for per-tenant concurrency control."""

    async def acquire_slot(self, org_id: str) -> bool: ...
    async def release_slot(self, org_id: str) -> None: ...
    async def get_active_count(self, org_id: str) -> int: ...
    async def close(self) -> None: ...


class RedisConcurrencyLimiter:
    """
    Redis-backed distributed semaphore for per-tenant job limits.

    Uses atomic INCR to acquire, DECR to release.
    Safety TTL prevents leaked slots if a worker crashes.
    """

    def __init__(self, redis_client: aioredis.Redis) -> None:
        self._redis: aioredis.Redis = redis_client
        self._prefix = src.core.config.settings.CONCURRENCY_KEY_PREFIX
        self._max_per_org = src.core.config.settings.CONCURRENCY_MAX_PER_ORG
        self._slot_ttl = src.core.config.settings.CONCURRENCY_SLOT_TTL
        logger.info(
            "Redis concurrency limiter initialized",
            extra={"max_per_org": self._max_per_org, "ttl": self._slot_ttl},
        )

    def _key(self, org_id: str) -> str:
        return f"{self._prefix}{org_id}"

    async def acquire_slot(self, org_id: str) -> bool:
        """
        Try to acquire a concurrency slot for the given org.

        Returns True if the slot was acquired (under limit).
        Returns False if the org is at capacity — caller should retry later.

        Uses atomic INCR + conditional DECR to avoid race conditions.
        """
        key: str = self._key(org_id)
        try:
            current = await self._redis.incr(key)

            # Set TTL on first increment (safety net)
            if current == 1:
                await self._redis.expire(key, self._slot_ttl)

            if current > self._max_per_org:
                # Over limit — roll back
                await self._redis.decr(key)
                logger.warning(
                    "Concurrency limit hit",
                    extra={
                        "org_id": org_id,
                        "current": current - 1,
                        "limit": self._max_per_org,
                    },
                )
                return False

            # Refresh TTL on every acquire to keep the counter alive
            await self._redis.expire(key, self._slot_ttl)

            logger.debug(
                "Concurrency slot acquired",
                extra={"org_id": org_id, "active": current, "limit": self._max_per_org},
            )
            return True

        except Exception as exc:
            # If Redis is down, allow the job to proceed.
            logger.warning(
                "Concurrency check failed (fail-open)",
                extra={"org_id": org_id, "error": str(exc)},
            )
            return True

    async def release_slot(self, org_id: str) -> None:
        """Release a concurrency slot. Safe to call multiple times."""
        key: str = self._key(org_id)
        try:
            current = await self._redis.decr(key)
            # Guard against going below 0
            if current < 0:
                await self._redis.set(key, 0, ex=self._slot_ttl)
                current = 0

            logger.debug(
                "Concurrency slot released",
                extra={"org_id": org_id, "active": current},
            )
        except Exception as exc:
            logger.warning(
                "Concurrency release failed (non-fatal)",
                extra={"org_id": org_id, "error": str(exc)},
            )

    async def get_active_count(self, org_id: str) -> int:
        """Get the current active job count for an org."""
        try:
            val = await self._redis.get(self._key(org_id))
            return int(val) if val else 0
        except Exception:
            return 0

    async def close(self) -> None:
        """No-op — Redis client is shared, closed elsewhere."""
        pass


class NoOpConcurrencyLimiter:
    """
    No-op limiter for local dev (no Redis).
    Always allows jobs — no concurrency control.
    """

    def __init__(self) -> None:
        logger.info("No-op concurrency limiter (no Redis)")

    async def acquire_slot(self, org_id: str) -> bool:
        return True

    async def release_slot(self, org_id: str) -> None:
        pass

    async def get_active_count(self, org_id: str) -> int:
        return 0

    async def close(self) -> None:
        pass


async def create_concurrency_limiter(
    redis_url: str = "",
) -> RedisConcurrencyLimiter | NoOpConcurrencyLimiter:
    """Create the appropriate concurrency limiter based on Redis availability."""
    url = redis_url or src.core.config.settings.REDIS_URL
    if not url:
        return NoOpConcurrencyLimiter()

    try:
        pool: aioredis.ConnectionPool = aioredis.ConnectionPool.from_url(
            url,
            max_connections=5,
            socket_timeout=2.0,
            socket_connect_timeout=5.0,
            decode_responses=True,
        )
        client = aioredis.Redis(connection_pool=pool)
        await client.ping()
        logger.info("Redis concurrency limiter connected")
        return RedisConcurrencyLimiter(client)
    except Exception as exc:
        logger.warning(
            "Redis unavailable for concurrency — falling back to no-op",
            extra={"error": str(exc)},
        )
        return NoOpConcurrencyLimiter()
