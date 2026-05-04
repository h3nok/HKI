from __future__ import annotations

import datetime
import json
import sys
import types
import typing

import pytest

import src.domain.entities


class _FakeScalarQueryParameter:
    def __init__(self, name: str, type_: str, value) -> None:
        self.name: str = name
        self.type_: str = type_
        self.value = value


class _FakeQueryJobConfig:
    def __init__(self, query_parameters) -> None:
        self.query_parameters: typing.Any = query_parameters


class _FakeQueryJob:
    def __init__(self, rows) -> None:
        self._rows: typing.Any = rows

    def result(self) -> typing.Any:
        return self._rows


class _FakeBigQueryClient:
    def __init__(self) -> None:
        self.calls = []
        self.insert_calls = []

    def query(self, sql, job_config=None) -> _FakeQueryJob:
        self.calls.append((sql, job_config))
        if "COUNT(DISTINCT user_id) AS unique_users" in sql:
            return _FakeQueryJob([{"total_events": 5, "unique_users": 2}])
        if "GROUP BY event_type" in sql:
            return _FakeQueryJob(
                [
                    {
                        "event_type": "kb.search",
                        "type_count": 2,
                    },
                    {
                        "event_type": "kb.ingest",
                        "type_count": 2,
                    },
                    {
                        "event_type": "kb.evaluation",
                        "type_count": 1,
                    },
                ]
            )
        if "GROUP BY service_name" in sql:
            return _FakeQueryJob(
                [
                    {"service_name": "knowledge-api", "service_count": 3},
                    {"service_name": "knowledge-pipeline-service", "service_count": 2},
                ]
            )
        return _FakeQueryJob(
            [
                {
                    "cmos": 180.5,
                    "avg_chunks_per_search": 4.5,
                    "avg_top_score": 0.83,
                    "total_ingest_jobs": 2,
                    "ingest_success_rate": 1.0,
                    "avg_ingest_duration_ms": 320.4,
                    "p95_ingest_duration_ms": 600.0,
                    "total_chunks_indexed": 44,
                    "ragas_sample_count": 2,
                    "ragas_coverage_rate": 1.0,
                    "avg_faithfulness": 0.79,
                    "avg_answer_relevancy": 0.81,
                    "avg_context_precision": 0.77,
                    "avg_context_recall": 0.74,
                    "avg_answer_correctness": 0.8,
                }
            ]
        )

    def insert_rows_json(self, table, rows) -> list[typing.Any]:
        self.insert_calls.append((table, rows))
        return []


@pytest.mark.asyncio
async def test_bigquery_summary_returns_knowledge_metrics(monkeypatch) -> None:
    fake_bigquery = types.SimpleNamespace(
        QueryJobConfig=_FakeQueryJobConfig,
        ScalarQueryParameter=_FakeScalarQueryParameter,
    )
    monkeypatch.setitem(sys.modules, "google", types.SimpleNamespace())
    monkeypatch.setitem(sys.modules, "google.cloud", types.SimpleNamespace(bigquery=fake_bigquery))
    monkeypatch.setitem(sys.modules, "google.cloud.bigquery", fake_bigquery)

    from src.adapters.database.bigquery_store import BigQueryEventStore

    client = _FakeBigQueryClient()
    store = BigQueryEventStore(project_id="test-project", dataset="analytics", table="agent_events")
    monkeypatch.setattr(store, "_get_client", lambda: client)

    summary: src.domain.entities.UsageSummary = await store.summarize(
        org_id="default", stream_id="pharmacy"
    )

    assert summary.total_events == 5
    assert summary.unique_users == 2
    assert summary.events_by_type == {
        "kb.search": 2,
        "kb.ingest": 2,
        "kb.evaluation": 1,
    }
    assert summary.events_by_service == {
        "knowledge-api": 3,
        "knowledge-pipeline-service": 2,
    }
    assert summary.cmos == 180.5
    assert summary.avg_chunks_per_search == 4.5
    assert summary.avg_top_score == 0.83
    assert summary.total_ingest_jobs == 2
    assert summary.ingest_success_rate == 1.0
    assert summary.avg_ingest_duration_ms == 320.4
    assert summary.p95_ingest_duration_ms == 600.0
    assert summary.total_chunks_indexed == 44
    assert summary.ragas_sample_count == 2
    assert summary.ragas_coverage_rate == 1.0
    assert summary.avg_faithfulness == 0.79
    assert summary.avg_answer_relevancy == 0.81
    assert summary.avg_context_precision == 0.77
    assert summary.avg_context_recall == 0.74
    assert summary.avg_answer_correctness == 0.8

    params: list[tuple[typing.Any, typing.Any]] = [
        (param.name, param.value)
        for _, job_config in client.calls
        for param in getattr(job_config, "query_parameters", [])
    ]
    assert ("org_id", "default") in params
    assert ("stream_id", "pharmacy") in params
    metrics_sql = client.calls[-1][0]
    assert "kb.evaluation" in metrics_sql
    assert "ragas_sample_count" in metrics_sql


@pytest.mark.asyncio
async def test_bigquery_append_uses_live_table_shape(monkeypatch) -> None:
    fake_bigquery = types.SimpleNamespace(
        QueryJobConfig=_FakeQueryJobConfig,
        ScalarQueryParameter=_FakeScalarQueryParameter,
    )
    monkeypatch.setitem(sys.modules, "google", types.SimpleNamespace())
    monkeypatch.setitem(sys.modules, "google.cloud", types.SimpleNamespace(bigquery=fake_bigquery))
    monkeypatch.setitem(sys.modules, "google.cloud.bigquery", fake_bigquery)

    from src.adapters.database.bigquery_store import BigQueryEventStore

    client = _FakeBigQueryClient()
    store = BigQueryEventStore(project_id="test-project", dataset="analytics", table="agent_events")
    monkeypatch.setattr(store, "_get_client", lambda: client)

    await store.append(
        src.domain.entities.AgentEvent(
            event_type="kb.search",
            user_id="user-1",
            org_id="default",
            service="knowledge-api",
            scope="pharmacy",
            payload={"stream_id": "pharmacy", "conversation_id": "conv-1"},
            timestamp=datetime.datetime(2026, 4, 16, 20, 0, tzinfo=datetime.UTC).timestamp(),
            ingested_at=datetime.datetime(2026, 4, 16, 20, 1, tzinfo=datetime.UTC).timestamp(),
        )
    )

    assert client.insert_calls
    table_name, rows = client.insert_calls[0]
    assert table_name == "test-project.analytics.agent_events"
    row = rows[0]
    assert set(row) == {"event_id", "event_type", "session_id", "user_id", "payload", "created_at"}
    assert row["event_type"] == "kb.search"
    assert row["session_id"] == "conv-1"
    payload = json.loads(row["payload"])
    assert payload["org_id"] == "default"
    assert payload["service"] == "knowledge-api"
    assert payload["scope"] == "pharmacy"


@pytest.mark.asyncio
async def test_bigquery_query_reads_live_table_shape(monkeypatch) -> None:
    fake_bigquery = types.SimpleNamespace(
        QueryJobConfig=_FakeQueryJobConfig,
        ScalarQueryParameter=_FakeScalarQueryParameter,
    )
    monkeypatch.setitem(sys.modules, "google", types.SimpleNamespace())
    monkeypatch.setitem(sys.modules, "google.cloud", types.SimpleNamespace(bigquery=fake_bigquery))
    monkeypatch.setitem(sys.modules, "google.cloud.bigquery", fake_bigquery)

    from src.adapters.database.bigquery_store import BigQueryEventStore

    created_at = datetime.datetime(2026, 4, 16, 20, 0, tzinfo=datetime.UTC)
    client = _FakeBigQueryClient()
    client.query = lambda sql, job_config=None: _FakeQueryJob(
        [
            {
                "event_type": "kb.search",
                "user_id": "user-1",
                "session_id": "conv-1",
                "payload": {
                    "org_id": "default",
                    "service": "knowledge-api",
                    "scope": "pharmacy",
                    "stream_id": "pharmacy",
                    "timestamp": created_at.isoformat(),
                    "ingested_at": created_at.isoformat(),
                },
                "created_at": created_at,
            }
        ]
    )
    store = BigQueryEventStore(project_id="test-project", dataset="analytics", table="agent_events")
    monkeypatch.setattr(store, "_get_client", lambda: client)

    events: list[AgentEvent] = await store.query(
        limit=5, event_type="kb.search", user_id="user-1", org_id="default"
    )

    assert len(events) == 1
    event: src.domain.entities.AgentEvent = events[0]
    assert event.org_id == "default"
    assert event.service == "knowledge-api"
    assert event.scope == "pharmacy"
    assert event.timestamp == created_at.timestamp()
