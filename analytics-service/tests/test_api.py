"""
Endpoint integration tests for analytics-service.

Uses the shared test fixture from conftest.py (auth disabled, in-memory store).
"""

from __future__ import annotations

import base64
import json
import typing

import fastapi.testclient
import httpx

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_envelope(
    event: dict,
    subscription: str = "projects/test/subscriptions/test-sub",
) -> dict:
    """Build a Pub/Sub push envelope from a raw event dict."""
    encoded: str = base64.b64encode(json.dumps(event).encode()).decode()
    return {
        "message": {"data": encoded, "messageId": "msg-test"},
        "subscription": subscription,
    }


def _ingest(client: fastapi.testclient.TestClient, event: dict) -> dict:
    """Ingest a single event, return the response JSON."""
    resp: httpx.Response = client.post("/v1/events/ingest", json=_make_envelope(event))
    assert resp.status_code == 200
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# Health Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


class TestHealthEndpoints:
    def test_liveness(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "service" in data

    def test_readiness(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ready", "degraded")
        assert "checks" in data
        assert "event_store" in data["checks"]

    def test_readiness_alias(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] in ("ready", "degraded")

    def test_root(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data
        assert "docs" in data


# ═══════════════════════════════════════════════════════════════════════════════
# Event Ingestion
# ═══════════════════════════════════════════════════════════════════════════════


class TestIngest:
    def test_valid_event(self, client: fastapi.testclient.TestClient) -> None:
        result = _ingest(
            client,
            {
                "event_type": "chat.request",
                "user_id": "u-1",
                "service": "orchestrator-service",
            },
        )
        assert result["status"] == "ok"

    def test_empty_data_ignored(self, client: fastapi.testclient.TestClient) -> None:
        envelope = {
            "message": {"data": "", "messageId": "m1"},
            "subscription": "sub-1",
        }
        resp: httpx.Response = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored"

    def test_invalid_base64(self, client: fastapi.testclient.TestClient) -> None:
        envelope = {
            "message": {"data": "%%%not-base64%%%", "messageId": "m2"},
            "subscription": "sub-1",
        }
        resp: httpx.Response = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "error"

    def test_invalid_json_payload(self, client: fastapi.testclient.TestClient) -> None:
        encoded: str = base64.b64encode(b"not json at all").decode()
        envelope = {
            "message": {"data": encoded, "messageId": "m3"},
            "subscription": "sub-1",
        }
        resp: httpx.Response = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "error"

    def test_missing_message_field_returns_422(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.post("/v1/events/ingest", json={"subscription": "s"})
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# Recent Events
# ═══════════════════════════════════════════════════════════════════════════════


class TestRecentEvents:
    def test_empty_returns_200(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/v1/events/recent")
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert "total" in data

    def test_ingested_events_appear(self, client: fastapi.testclient.TestClient) -> None:
        _ingest(client, {"event_type": "chat.request", "user_id": "u-1"})
        _ingest(client, {"event_type": "tool.call", "user_id": "u-2"})
        resp: httpx.Response = client.get("/v1/events/recent")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 2
        event_types: set[typing.Any] = {e["event_type"] for e in data["events"]}
        assert "chat.request" in event_types

    def test_limit_parameter(self, client: fastapi.testclient.TestClient) -> None:
        for i in range(5):
            _ingest(client, {"event_type": "auth.request", "user_id": str(i)})
        resp: httpx.Response = client.get("/v1/events/recent?limit=3")
        assert resp.status_code == 200
        assert len(resp.json()["events"]) <= 3

    def test_filter_by_event_type(self, client: fastapi.testclient.TestClient) -> None:
        _ingest(client, {"event_type": "chat.request", "user_id": "u-1"})
        _ingest(client, {"event_type": "tool.call", "user_id": "u-1"})
        _ingest(client, {"event_type": "chat.request", "user_id": "u-2"})
        resp: httpx.Response = client.get("/v1/events/recent?event_type=tool.call")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e["event_type"] == "tool.call" for e in events)

    def test_filter_by_user_id(self, client: fastapi.testclient.TestClient) -> None:
        _ingest(client, {"event_type": "chat.request", "user_id": "alpha"})
        _ingest(client, {"event_type": "chat.request", "user_id": "beta"})
        resp: httpx.Response = client.get("/v1/events/recent?user_id=alpha")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e["user_id"] == "alpha" for e in events)


# ═══════════════════════════════════════════════════════════════════════════════
# Usage Summary
# ═══════════════════════════════════════════════════════════════════════════════


class TestUsageSummary:
    def test_summary_empty_store(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/v1/events/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_events" in data
        assert "unique_users" in data
        assert "events_by_type" in data

    def test_summary_reflects_ingested_events(self, client: fastapi.testclient.TestClient) -> None:
        _ingest(client, {"event_type": "chat.request", "user_id": "u-1"})
        _ingest(client, {"event_type": "tool.call", "user_id": "u-2"})
        _ingest(client, {"event_type": "chat.request", "user_id": "u-1"})
        resp: httpx.Response = client.get("/v1/events/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_events"] >= 3
        assert data["unique_users"] >= 2

    def test_summary_filters_by_stream_and_reports_knowledge_metrics(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        _ingest(
            client,
            {
                "event_type": "kb.search",
                "user_id": "pharmacy-user",
                "org_id": "default",
                "service": "knowledge-api",
                "scope": "pharmacy",
                "stream_id": "pharmacy",
                "tokens_in_context": 120,
                "chunks_returned": 4,
                "top_score": 0.82,
            },
        )
        _ingest(
            client,
            {
                "event_type": "kb.ingest",
                "user_id": "pharmacy-user",
                "org_id": "default",
                "service": "knowledge-pipeline-service",
                "scope": "pharmacy",
                "stream_id": "pharmacy",
                "chunk_count": 12,
                "processing_time_ms": 450,
                "status": "completed",
            },
        )
        _ingest(
            client,
            {
                "event_type": "kb.search",
                "user_id": "optical-user",
                "org_id": "default",
                "service": "knowledge-api",
                "scope": "optical",
                "stream_id": "optical",
                "tokens_in_context": 80,
                "chunks_returned": 2,
                "top_score": 0.41,
            },
        )
        _ingest(
            client,
            {
                "event_type": "kb.evaluation",
                "user_id": "pharmacy-evaluator",
                "org_id": "default",
                "service": "knowledge-api",
                "scope": "pharmacy",
                "stream_id": "pharmacy",
                "case_count": 2,
                "ragas_sample_count": 2,
                "faithfulness": 0.84,
                "answer_relevancy": 0.78,
                "context_precision": 0.81,
                "context_recall": 0.74,
                "answer_correctness": 0.8,
            },
        )

        resp: httpx.Response = client.get("/v1/events/summary?stream_id=pharmacy")
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_events"] == 3
        assert data["events_by_type"]["kb.search"] == 1
        assert data["events_by_type"]["kb.ingest"] == 1
        assert data["events_by_type"]["kb.evaluation"] == 1
        assert data["knowledge"] == {
            "cmos": 120.0,
            "avg_chunks_per_search": 4.0,
            "avg_top_score": 0.82,
            "total_ingest_jobs": 1,
            "ingest_success_rate": 1.0,
            "avg_ingest_duration_ms": 450.0,
            "p95_ingest_duration_ms": 450.0,
            "total_chunks_indexed": 12,
            "ragas_sample_count": 2,
            "ragas_coverage_rate": 0.6667,
            "avg_faithfulness": 0.84,
            "avg_answer_relevancy": 0.78,
            "avg_context_precision": 0.81,
            "avg_context_recall": 0.74,
            "avg_answer_correctness": 0.8,
        }
