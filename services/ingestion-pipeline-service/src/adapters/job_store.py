"""
Job Store — Memorystore Redis adapter for persistent job tracking.

Stores ingestion jobs as Redis hashes with automatic TTL expiry.
Falls back to in-memory storage when Redis is unavailable (local dev).

Architecture:
    Each job is stored as a Redis hash at key `kp:job:{job_id}`.
    A sorted set `kp:jobs` maintains job ordering by creation time
    for efficient paginated listing. Both structures share the same
    TTL so they stay in sync.

    All operations are O(1) except list_jobs which is O(log N + M)
    via ZREVRANGEBYSCORE on the sorted set.

    Connection uses redis.asyncio with:
    - Connection pooling (max_connections=20)
    - Socket timeouts (2s read, 5s connect)
    - Auto-reconnect on failure
    - Health check every 30s

GCP:
    Memorystore for Redis (STANDARD_HA, Redis 7.0)
    Already provisioned in Terraform: google_redis_instance.cache
"""

from __future__ import annotations

import datetime
import json
import typing

import redis.asyncio as aioredis
import redis.asyncio.client

import src.core.config
import src.core.logging
import src.domain.models

logger = src.core.logging.logger.getChild("job_store")


# ═══════════════════════════════════════════════════════════════════════════════
# Abstract interface
# ═══════════════════════════════════════════════════════════════════════════════


class JobStore(typing.Protocol):
    """Interface for job persistence backends."""

    async def save(self, job: src.domain.models.IngestionJob) -> None: ...
    async def get(self, job_id: str) -> src.domain.models.IngestionJob | None: ...
    async def list(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[src.domain.models.IngestionJob], int]: ...
    async def close(self) -> None: ...


# ═══════════════════════════════════════════════════════════════════════════════
# Redis implementation (Memorystore)
# ═══════════════════════════════════════════════════════════════════════════════


class RedisJobStore:
    """
    Persistent job store backed by Memorystore Redis.

    Storage layout:
        kp:job:{id}  → Hash   (job fields as JSON-encoded values)
        kp:jobs      → ZSet   (member=job_id, score=created_at timestamp)

    TTL: REDIS_JOB_TTL_HOURS (default 72h) on each job hash.
    The sorted set entries for expired jobs are lazily pruned on list().
    """

    def __init__(self, redis_url: str) -> None:
        self._pool: aioredis.ConnectionPool = aioredis.ConnectionPool.from_url(
            redis_url,
            max_connections=20,
            socket_timeout=2.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True,
            health_check_interval=30,
            decode_responses=True,
        )
        self._redis = aioredis.Redis(connection_pool=self._pool)
        self._prefix: str = src.core.config.settings.REDIS_JOB_PREFIX
        self._index_key: str = f"{self._prefix}index"
        self._ttl: int = src.core.config.settings.REDIS_JOB_TTL_HOURS * 3600
        logger.info("Redis job store initialized", extra={"url": redis_url[:30] + "..."})

    def _key(self, job_id: str) -> str:
        return f"{self._prefix}{job_id}"

    async def save(self, job: src.domain.models.IngestionJob) -> None:
        """Persist job state to Redis. Upserts — safe to call on every status change."""
        key: str = self._key(job.id)
        data: dict[str, typing.Any] = job.model_dump(mode="json")
        # Flatten for Redis hash — serialize complex fields as JSON strings
        flat: dict[str, str] = {}
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                flat[k] = json.dumps(v, default=str)
            elif v is None:
                flat[k] = ""
            else:
                flat[k] = str(v)

        pipe: redis.asyncio.client.Pipeline = self._redis.pipeline(transaction=True)
        pipe.hset(key, mapping=flat)
        pipe.expire(key, self._ttl)
        # Sorted set for ordering: score = created_at timestamp
        score: float = job.created_at.timestamp()
        pipe.zadd(self._index_key, {job.id: score})
        await pipe.execute()

    async def get(self, job_id: str) -> src.domain.models.IngestionJob | None:
        """Fetch a single job by ID. Returns None if expired or missing."""
        data = await self._redis.hgetall(self._key(job_id))
        if not data:
            return None
        return self._deserialize(data)

    async def list(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[src.domain.models.IngestionJob], int]:
        """
        List jobs ordered by creation time (newest first).

        Uses ZREVRANGE on the sorted set index for O(log N + M) pagination.
        Lazily prunes stale entries whose hashes have expired.
        """
        total = await self._redis.zcard(self._index_key)

        # Get job IDs in reverse chronological order
        job_ids: list[str] = await self._redis.zrevrange(
            self._index_key,
            offset,
            offset + limit - 1,
        )

        if not job_ids:
            return [], total

        # Batch fetch all job hashes via pipeline
        pipe: redis.asyncio.client.Pipeline = self._redis.pipeline(transaction=False)
        for jid in job_ids:
            pipe.hgetall(self._key(jid))
        results: list[typing.Any] = await pipe.execute()

        jobs: list[src.domain.models.IngestionJob] = []
        stale_ids: list[str] = []
        for jid, data in zip(job_ids, results, strict=False):
            if data:
                jobs.append(self._deserialize(data))
            else:
                stale_ids.append(jid)

        # Lazy prune: remove sorted set entries for expired hashes
        if stale_ids:
            await self._redis.zrem(self._index_key, *stale_ids)
            total -= len(stale_ids)

        return jobs, max(total, 0)

    async def close(self) -> None:
        """Shut down connection pool."""
        await self._redis.aclose()
        await self._pool.disconnect()

    async def recover_stale_jobs(self) -> int:
        """
        Mark any in-progress jobs as failed on startup.

        When the service crashes or restarts, jobs stuck in intermediate
        states (extracting, cleaning, enriching, indexing, etc.) will never
        complete. This scans all jobs in the sorted-set index and marks
        non-terminal ones as failed so the UI doesn't show zombie pipelines.
        """
        terminal: set[str] = {
            src.domain.models.JobStatus.COMPLETED.value,
            src.domain.models.JobStatus.FAILED.value,
        }
        job_ids: list[str] = await self._redis.zrange(self._index_key, 0, -1)
        recovered = 0
        for jid in job_ids:
            status = await self._redis.hget(self._key(jid), "status")
            if status and status not in terminal:
                now: str = datetime.datetime.now(datetime.UTC).isoformat()
                error: str = (
                    "Service restarted before processing began"
                    if status == src.domain.models.JobStatus.QUEUED.value
                    else f"Recovered on startup — was stuck in '{status}'"
                )
                await self._redis.hset(
                    self._key(jid),
                    mapping={
                        "status": src.domain.models.JobStatus.FAILED.value,
                        "error": error,
                        "failed_at_stage": status,
                        "updated_at": now,
                        "completed_at": now,
                    },
                )
                recovered += 1
        if recovered:
            logger.info(
                "Recovered stale jobs on startup",
                extra={"recovered": recovered},
            )
        return recovered

    async def hvsi_audit(self) -> dict[str, int]:
        job_ids: list[str] = await self._redis.zrange(self._index_key, 0, -1)
        if not job_ids:
            return {"jobs_missing_stream": 0}

        pipe: redis.asyncio.client.Pipeline = self._redis.pipeline(transaction=False)
        for job_id in job_ids:
            pipe.hgetall(self._key(job_id))
        results: list[typing.Any] = await pipe.execute()

        stale_ids: list[str] = []
        missing_stream = 0
        for job_id, data in zip(job_ids, results, strict=False):
            if not data:
                stale_ids.append(job_id)
                continue
            if not str(data.get("stream_id") or "").strip():
                missing_stream += 1

        if stale_ids:
            await self._redis.zrem(self._index_key, *stale_ids)
            logger.info(
                "Pruned stale job index entries during HVSI audit",
                extra={"count": len(stale_ids)},
            )

        return {
            "jobs_missing_stream": missing_stream
        }

    @staticmethod
    def _deserialize(data: dict[str, str]) -> src.domain.models.IngestionJob:
        """Reconstruct an IngestionJob from a Redis hash."""
        # Parse JSON-encoded fields back to native types
        parsed: dict[str, typing.Any] = {}
        for k, v in data.items():
            if k == "tags":
                parsed[k] = json.loads(v) if v else []
            elif k == "access_control":
                parsed[k] = src.domain.models.DocumentAccessControl(**(json.loads(v) if v else {}))
            elif k in ("chunk_count", "entity_count", "raw_size_bytes", "clean_size_bytes"):
                parsed[k] = int(v) if v else 0
            elif k == "processing_time_ms":
                parsed[k] = float(v) if v else 0.0
            elif k in ("created_at", "updated_at", "completed_at"):
                if v and v != "None" and v != "":
                    parsed[k] = datetime.datetime.fromisoformat(v)
                else:
                    parsed[k] = None
            elif k in ("document_id", "error", "stream_id", "failed_at_stage"):
                parsed[k] = v if v else None
            elif k == "status":
                parsed[k] = src.domain.models.JobStatus(v)
            elif k == "source_type":
                parsed[k] = src.domain.models.SourceType(v)
            elif k == "classification":
                parsed[k] = src.domain.models.DocumentClassification(v)
            else:
                parsed[k] = v
        return src.domain.models.IngestionJob(**parsed)


# ═══════════════════════════════════════════════════════════════════════════════
# In-memory fallback (local dev, no Redis)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryJobStore:
    """
    Simple dict-backed job store for local development.
    No persistence across restarts. No TTL.
    """

    def __init__(self) -> None:
        self._jobs: dict[str, src.domain.models.IngestionJob] = {}
        logger.info("In-memory job store initialized (no Redis)")

    async def save(self, job: src.domain.models.IngestionJob) -> None:
        self._jobs[job.id] = job

    async def get(self, job_id: str) -> src.domain.models.IngestionJob | None:
        return self._jobs.get(job_id)

    async def list(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[src.domain.models.IngestionJob], int]:
        jobs: list[src.domain.models.IngestionJob] = sorted(
            self._jobs.values(),
            key=lambda j: j.created_at,
            reverse=True,
        )
        return jobs[offset : offset + limit], len(jobs)

    async def close(self) -> None:
        self._jobs.clear()

    async def hvsi_audit(self) -> dict[str, int]:
        return {
            "jobs_missing_stream": sum(
                1
                for job in self._jobs.values()
                if not str(job.stream_id or "").strip()
            )
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Factory
# ═══════════════════════════════════════════════════════════════════════════════


async def create_job_store() -> RedisJobStore | InMemoryJobStore:
    """
    Create the appropriate job store based on configuration.
    Tries Redis first, falls back to in-memory on connection failure.
    """
    if not src.core.config.settings.REDIS_URL:
        return InMemoryJobStore()

    try:
        store = RedisJobStore(src.core.config.settings.REDIS_URL)
        # Verify connectivity
        await store._redis.ping()
        logger.info("Connected to Memorystore Redis for job persistence")
        return store
    except Exception as exc:
        logger.warning(
            "Redis unavailable — falling back to in-memory job store",
            extra={"error": str(exc)},
        )
        return InMemoryJobStore()
