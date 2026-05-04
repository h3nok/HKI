from __future__ import annotations

import pytest

import src.adapters.job_store
import src.domain.models


class _FakePipeline:
    def __init__(self, hashes: dict[str, dict[str, str]]) -> None:
        self._hashes: dict[str, dict[str, str]] = hashes
        self._keys: list[str] = []

    def hgetall(self, key: str) -> "_FakePipeline":
        self._keys.append(key)
        return self

    async def execute(self) -> list[dict[str, str]]:
        return [self._hashes.get(key, {}) for key in self._keys]


class _FakeRedis:
    def __init__(self, ids: list[str], hashes: dict[str, dict[str, str]]) -> None:
        self._ids: list[str] = ids
        self._hashes: dict[str, dict[str, str]] = hashes
        self.zrem_calls: list[tuple[str, tuple[str, ...]]] = []

    async def zrange(self, _key: str, _start: int, _end: int) -> list[str]:
        return list(self._ids)

    def pipeline(self, transaction: bool = False) -> _FakePipeline:
        assert transaction is False
        return _FakePipeline(self._hashes)

    async def zrem(self, key: str, *members: str) -> int:
        self.zrem_calls.append((key, members))
        return len(members)


def test_redis_job_store_deserialize_acl_fields() -> None:
    job = src.adapters.job_store.RedisJobStore._deserialize(
        {
            "id": "job-123",
            "org_id": "hki",
            "stream_id": "legal",
            "status": "completed",
            "source_type": "text",
            "source_ref": "",
            "title": "Privileged Legal Memo",
            "department": "Legal",
            "document_type": "policy",
            "tags": '["acl-smoke","legal"]',
            "classification": "privileged",
            "access_control": (
                '{"allowed_users":[],"allowed_groups":["group:legal"],'
                '"denied_users":[],"denied_groups":["group:retail"]}'
            ),
            "document_id": "doc-123",
            "chunk_count": "1",
            "entity_count": "0",
            "error": "",
            "failed_at_stage": "",
            "raw_size_bytes": "193",
            "clean_size_bytes": "193",
            "processing_time_ms": "12.5",
            "created_at": "2026-04-04T01:23:44.909324+00:00",
            "updated_at": "2026-04-04T01:23:44.909327+00:00",
            "completed_at": "2026-04-04T01:23:44.928965+00:00",
        }
    )

    assert job.id == "job-123"
    assert job.org_id == "hki"
    assert job.stream_id == "legal"
    assert job.status == src.domain.models.JobStatus.COMPLETED
    assert job.source_type == src.domain.models.SourceType.TEXT
    assert job.classification == src.domain.models.DocumentClassification.PRIVILEGED
    assert job.access_control.allowed_groups == ["group:legal"]
    assert job.access_control.denied_groups == ["group:retail"]
    assert job.failed_at_stage is None


@pytest.mark.asyncio
async def test_redis_job_store_hvsi_audit_prunes_stale_index_entries() -> None:
    redis = _FakeRedis(
        ids=["stale-job", "legacy-job", "good-job"],
        hashes={
            "kp:job:legacy-job": {"stream_id": ""},
            "kp:job:good-job": {"stream_id": "pharmacy"},
        },
    )
    store: src.adapters.job_store.RedisJobStore = object.__new__(src.adapters.job_store.RedisJobStore)
    store._redis = redis
    store._prefix = "kp:job:"
    store._index_key = "kp:job:index"

    issues: dict[str, int] = await src.adapters.job_store.RedisJobStore.hvsi_audit(store)

    assert issues == {"jobs_missing_stream": 1}
    assert redis.zrem_calls == [("kp:job:index", ("stale-job",))]
