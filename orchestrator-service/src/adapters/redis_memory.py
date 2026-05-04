"""
Redis Memory Backend — production-grade persistent memory for the orchestrator.

Replaces the in-process dictionaries in MemoryManager with Redis-backed stores.
Each memory store maps to a specific Redis data structure:

    SemanticMemory   → Redis Hash  (scope → {key → JSON value})
    EpisodicMemory   → Redis Sorted Set  (scope → entries scored by timestamp)
    ProceduralMemory → Redis Hash  (scope → {procedure_name → JSON})
    DeclarativeMemory → Redis List (scope → [rule JSON, ...])

Key layout:
    mem:semantic:{scope}     — Hash
    mem:episodic:{scope}     — Sorted Set (score = unix timestamp)
    mem:procedural:{scope}   — Hash
    mem:declarative:{scope}  — List

TTL: Semantic and episodic keys expire after 30 days of inactivity.
Declarative rules (business constraints) have no TTL.

Falls back to in-process memory if Redis is unavailable.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any

from src.core.logging import logger

# TTL for user-scoped memory keys (30 days)
_USER_MEMORY_TTL = 60 * 60 * 24 * 30
_PREFIX = "mem"


class RedisSemanticMemory:
    """Redis Hash-backed semantic memory."""

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _key(self, scope: str) -> str:
        return f"{_PREFIX}:semantic:{scope}"

    async def store(
        self,
        scope: str,
        key: str,
        value: Any,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        record = json.dumps(
            {
                "key": key,
                "value": value,
                "metadata": metadata or {},
                "created_at": datetime.now(UTC).isoformat(),
            }
        )
        rkey = self._key(scope)
        await self._redis.hset(rkey, key, record)
        await self._redis.expire(rkey, _USER_MEMORY_TTL)

    async def recall(
        self,
        scope: str,
        key: str | None = None,
    ) -> list[dict[str, Any]]:
        rkey = self._key(scope)
        if key:
            raw = await self._redis.hget(rkey, key)
            if raw:
                data = json.loads(raw)
                return [
                    {
                        "key": data["key"],
                        "value": data["value"],
                        "metadata": data.get("metadata", {}),
                    }
                ]
            return []

        all_raw = await self._redis.hgetall(rkey)
        results: list[dict[str, Any]] = []
        for raw in all_raw.values():
            data = json.loads(raw)
            results.append(
                {
                    "key": data["key"],
                    "value": data["value"],
                    "metadata": data.get("metadata", {}),
                }
            )
        return results

    async def forget(
        self,
        scope: str,
        key: str | None = None,
    ) -> bool:
        rkey = self._key(scope)
        if key:
            removed = await self._redis.hdel(rkey, key)
            return removed > 0
        removed = await self._redis.delete(rkey)
        return removed > 0


class RedisEpisodicMemory:
    """Redis Sorted Set-backed episodic memory."""

    def __init__(
        self,
        redis_client: Any,
        max_episodes: int = 50,
    ) -> None:
        self._redis = redis_client
        self._max = max_episodes

    def _key(self, scope: str) -> str:
        return f"{_PREFIX}:episodic:{scope}"

    async def store(
        self,
        scope: str,
        summary: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        ts = time.time()
        record = json.dumps(
            {
                "summary": summary,
                "metadata": metadata or {},
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
        rkey = self._key(scope)
        await self._redis.zadd(rkey, {record: ts})
        # Trim to max window (keep most recent)
        count = await self._redis.zcard(rkey)
        if count > self._max:
            await self._redis.zremrangebyrank(rkey, 0, count - self._max - 1)
        await self._redis.expire(rkey, _USER_MEMORY_TTL)

    async def recall(
        self,
        scope: str,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        rkey = self._key(scope)
        # Get most recent entries (highest scores)
        raw_entries = await self._redis.zrevrange(rkey, 0, limit - 1)
        results: list[dict[str, Any]] = []
        for raw in raw_entries:
            data = json.loads(raw)
            results.append(
                {
                    "summary": data["summary"],
                    "timestamp": data.get("timestamp", ""),
                    "metadata": data.get("metadata", {}),
                }
            )
        return results

    async def clear(self, scope: str) -> bool:
        removed = await self._redis.delete(self._key(scope))
        return removed > 0


class RedisProceduralMemory:
    """Redis Hash-backed procedural memory."""

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _key(self, scope: str) -> str:
        return f"{_PREFIX}:procedural:{scope}"

    async def store(
        self,
        scope: str,
        name: str,
        steps: list[str],
        trigger: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        record = json.dumps(
            {
                "name": name,
                "steps": steps,
                "trigger": trigger,
                "metadata": metadata or {},
            }
        )
        rkey = self._key(scope)
        await self._redis.hset(rkey, name, record)
        await self._redis.expire(rkey, _USER_MEMORY_TTL)

    async def recall(
        self,
        scope: str,
        trigger: str = "",
    ) -> list[dict[str, Any]]:
        rkey = self._key(scope)
        all_raw = await self._redis.hgetall(rkey)
        results: list[dict[str, Any]] = []
        trigger_lower = trigger.lower()
        for raw in all_raw.values():
            data = json.loads(raw)
            if (
                trigger_lower
                and trigger_lower
                not in data.get(
                    "trigger",
                    "",
                ).lower()
            ):
                continue
            results.append(data)
        return results


class RedisDeclarativeMemory:
    """Redis List-backed declarative memory (business rules)."""

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _key(self, scope: str) -> str:
        return f"{_PREFIX}:declarative:{scope}"

    async def store(
        self,
        scope: str,
        rule: str,
        category: str = "general",
        priority: int = 5,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        record = json.dumps(
            {
                "rule": rule,
                "category": category,
                "priority": priority,
                "metadata": metadata or {},
            }
        )
        await self._redis.rpush(self._key(scope), record)
        # No TTL for business rules — they persist indefinitely

    async def recall(
        self,
        scope: str,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        rkey = self._key(scope)
        raw_entries = await self._redis.lrange(rkey, 0, -1)
        results: list[dict[str, Any]] = []
        for raw in raw_entries:
            data = json.loads(raw)
            if category and data.get("category") != category:
                continue
            results.append(data)
        results.sort(key=lambda r: r.get("priority", 5))
        return results

    async def load_defaults(self) -> None:
        """Load default HKI business rules if not already present."""
        rkey = self._key("global")
        existing = await self._redis.llen(rkey)
        if existing > 0:
            logger.info(
                "Declarative rules already loaded",
                extra={"count": existing},
            )
            return

        default_rules = [
            (
                "Never disclose member personal or financial information without verification.",
                "privacy",
                1,
            ),
            ("HKI's markup on any product never exceeds 15%.", "pricing", 2),
            (
                "Always recommend the Kirkland Signature alternative when available.",
                "merchandising",
                3,
            ),
            (
                "Executive membership requires annual spend of approximately $6,500 to break even.",
                "membership",
                3,
            ),
            (
                "HKI's return policy allows returns at any time for most merchandise.",
                "customer_service",
                3,
            ),
            ("All pharmacy interactions must comply with HIPAA regulations.", "compliance", 1),
            ("Controlled substance inquiries require member ID verification.", "compliance", 1),
            (
                "Electronics have a 90-day return window from date of receipt.",
                "customer_service",
                2,
            ),
        ]
        for rule, category, priority in default_rules:
            await self.store("global", rule, category=category, priority=priority)
        logger.info(
            "Loaded default business rules into Redis",
            extra={"count": len(default_rules)},
        )


async def create_redis_memory_stores(
    redis_url: str,
) -> (
    tuple[
        RedisSemanticMemory,
        RedisEpisodicMemory,
        RedisProceduralMemory,
        RedisDeclarativeMemory,
    ]
    | None
):
    """
    Create Redis-backed memory stores.

    Returns None if Redis is unavailable (falls back to in-process).
    """
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(
            redis_url,
            decode_responses=True,
            max_connections=20,
            socket_timeout=2.0,
            socket_connect_timeout=5.0,
            health_check_interval=30,
        )
        # Test connectivity
        await client.ping()
        logger.info("Redis memory backend connected", extra={"url": redis_url[:30]})

        return (
            RedisSemanticMemory(client),
            RedisEpisodicMemory(client),
            RedisProceduralMemory(client),
            RedisDeclarativeMemory(client),
        )

    except Exception as exc:
        logger.warning(
            "Redis memory unavailable, using in-process fallback",
            extra={"error": str(exc)},
        )
        return None
