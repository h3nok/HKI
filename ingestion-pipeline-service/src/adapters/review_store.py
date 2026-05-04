"""
Review Store — Memorystore Redis adapter for persistent review records.

Stores review records as Redis hashes with automatic TTL expiry.
Falls back to InMemoryReviewStore when Redis is unavailable (local dev).

Architecture mirrors job_store.py:
    Each record lives at `kp:review:{record_id}`.
    A sorted set `kp:reviews` keeps records ordered by updated_at
    for efficient paginated listing.
    Secondary index `kp:review:doc:{document_id}` maps doc → record ID
    for fast lookup by document.

GCP:
    Memorystore for Redis (STANDARD_HA, Redis 7.0)
    Shares the same Redis instance as the job store.
"""

from __future__ import annotations

import json
import datetime
import typing

import redis.asyncio as aioredis
from redis.asyncio.client import Pipeline

import src.core.config
import src.core.logging
import src.domain.review

logger = src.core.logging.logger.getChild("review_store")

_PREFIX = "kp:review:"
_INDEX_KEY: str = f"{_PREFIX}index"
_DOC_PREFIX: str = f"{_PREFIX}doc:"
_TTL = 30 * 24 * 3600  # 30 days — longer than jobs since reviews are governance artifacts


class RedisReviewStore:
    """
    Persistent review store backed by Memorystore Redis.

    Storage layout:
        kp:review:{id}          → Hash  (record fields)
        kp:review:index         → ZSet  (member=record_id, score=updated_at)
        kp:review:doc:{doc_id}  → String (record_id — secondary index)
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
        logger.info("Redis review store initialized")

    def _key(self, record_id: str) -> str:
        return f"{_PREFIX}{record_id}"

    def _doc_key(self, document_id: str) -> str:
        return f"{_DOC_PREFIX}{document_id}"

    async def save(self, record: src.domain.review.ReviewRecord) -> None:
        """Persist review record. Upserts — safe to call on every state change."""
        record.updated_at = datetime.datetime.now(datetime.UTC)
        key: str = self._key(record.id)
        data = record.model_dump(mode="json")

        flat: dict[str, str] = {}
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                flat[k] = json.dumps(v, default=str)
            elif v is None:
                flat[k] = ""
            else:
                flat[k] = str(v)

        pipe: Pipeline = self._redis.pipeline(transaction=True)
        pipe.hset(key, mapping=flat)
        pipe.expire(key, _TTL)
        # Sorted set for ordering: score = updated_at timestamp
        score: float = record.updated_at.timestamp()
        pipe.zadd(_INDEX_KEY, {record.id: score})
        # Secondary index: document_id → record_id
        doc_key: str = self._doc_key(record.document_id)
        pipe.set(doc_key, record.id, ex=_TTL)
        await pipe.execute()

    async def get(self, record_id: str) -> src.domain.review.ReviewRecord | None:
        """Fetch a single review record by ID."""
        data = await self._redis.hgetall(self._key(record_id))
        if not data:
            return None
        return self._deserialize(data)

    async def get_by_document(self, document_id: str) -> src.domain.review.ReviewRecord | None:
        """Fetch review record by document ID via secondary index."""
        record_id = await self._redis.get(self._doc_key(document_id))
        if not record_id:
            return None
        return await self.get(record_id)

    async def list_pending(
        self,
        org_id: str,
        limit: int = 50,
    ) -> list[src.domain.review.ReviewRecord]:
        return await self._list_filtered(org_id, src.domain.review.ReviewStatus.PENDING_REVIEW, limit)

    async def list_by_status(
        self,
        org_id: str,
        status: src.domain.review.ReviewStatus,
        limit: int = 50,
    ) -> list[src.domain.review.ReviewRecord]:
        return await self._list_filtered(org_id, status, limit)

    async def _list_filtered(
        self,
        org_id: str,
        status: src.domain.review.ReviewStatus,
        limit: int,
    ) -> list[src.domain.review.ReviewRecord]:
        """
        Scan records from the sorted set index, filter by org + status.

        For the expected volume (<1000 active reviews per org), a full scan
        with in-app filtering is acceptable. Migrate to per-org sorted sets
        if this becomes a bottleneck.
        """
        # Fetch up to 500 most recent record IDs
        record_ids: list[str] = await self._redis.zrevrange(_INDEX_KEY, 0, 499)
        if not record_ids:
            return []

        pipe: Pipeline = self._redis.pipeline(transaction=False)
        for rid in record_ids:
            pipe.hgetall(self._key(rid))
        results: typing.List[typing.Any] = await pipe.execute()

        records: list[src.domain.review.ReviewRecord] = []
        seen_docs: set[str] = set()
        stale_ids: list[str] = []
        for rid, data in zip(record_ids, results, strict=False):
            if not data:
                stale_ids.append(rid)
                continue
            record = self._deserialize(data)
            if (
                record.org_id == org_id
                and record.status == status
                and record.document_id not in seen_docs
            ):
                seen_docs.add(record.document_id)
                records.append(record)
                if len(records) >= limit:
                    break

        # Lazy prune expired entries
        if stale_ids:
            await self._redis.zrem(_INDEX_KEY, *stale_ids)

        return records

    async def close(self) -> None:
        """Shut down connection pool."""
        await self._redis.aclose()
        await self._pool.disconnect()

    async def hvsi_audit(self) -> dict[str, int]:
        record_ids: list[str] = await self._redis.zrange(_INDEX_KEY, 0, -1)
        if not record_ids:
            return {"reviews_missing_stream": 0}

        pipe: Pipeline = self._redis.pipeline(transaction=False)
        for record_id in record_ids:
            pipe.hgetall(self._key(record_id))
        results: typing.List[typing.Any] = await pipe.execute()

        stale_ids: list[str] = []
        missing_stream = 0
        for record_id, data in zip(record_ids, results, strict=False):
            if not data:
                stale_ids.append(record_id)
                continue
            if not str(data.get("stream_id") or "").strip():
                missing_stream += 1

        if stale_ids:
            await self._redis.zrem(_INDEX_KEY, *stale_ids)
            logger.info(
                "Pruned stale review index entries during HVSI audit",
                extra={"count": len(stale_ids)},
            )

        return {
            "reviews_missing_stream": missing_stream
        }

    @staticmethod
    def _deserialize(data: dict[str, str]) -> src.domain.review.ReviewRecord:
        """Reconstruct a ReviewRecord from a Redis hash."""
        parsed: dict[str, typing.Any] = {}
        for k, v in data.items():
            if k == "status":
                parsed[k] = src.domain.review.ReviewStatus(v)
            elif k in ("tags",):
                parsed[k] = json.loads(v) if v else []
            elif k == "comments":
                raw = json.loads(v) if v else []
                parsed[k] = [src.domain.review.ReviewComment(**c) for c in raw]
            elif k == "quality_report" or k == "review_intelligence":
                parsed[k] = json.loads(v) if v else None
            elif k == "trust_score":
                parsed[k] = float(v) if v else None
            elif k in (
                "created_at",
                "updated_at",
                "submitted_at",
                "reviewed_at",
                "assigned_at",
                "last_reminded_at",
                "published_at",
                "archived_at",
            ):
                if v and v != "None" and v != "":
                    parsed[k] = datetime.datetime.fromisoformat(v)
                else:
                    parsed[k] = None
            elif k == "auto_approved":
                parsed[k] = v.lower() in ("true", "1")
            elif k in (
                "submitted_by",
                "reviewed_by",
                "source_ref",
                "title",
                "department",
                "document_type",
                "auto_approve_rule",
            ):
                parsed[k] = v if v else ""
            elif k == "stream_id":
                parsed[k] = v or None
            else:
                parsed[k] = v
        return src.domain.review.ReviewRecord(**parsed)


# ═══════════════════════════════════════════════════════════════════════════════
# Factory
# ═══════════════════════════════════════════════════════════════════════════════


async def create_review_store() -> RedisReviewStore | src.domain.review.InMemoryReviewStore:
    """
    Create the appropriate review store based on configuration.
    Tries Redis first, falls back to in-memory on connection failure.
    """
    if not src.core.config.settings.REDIS_URL:
        return src.domain.review.InMemoryReviewStore()

    try:
        store = RedisReviewStore(src.core.config.settings.REDIS_URL)
        await store._redis.ping()
        logger.info("Connected to Memorystore Redis for review persistence")
        return store
    except Exception as exc:
        logger.warning(
            "Redis unavailable — falling back to in-memory review store",
            extra={"error": str(exc)},
        )
        return src.domain.review.InMemoryReviewStore()
