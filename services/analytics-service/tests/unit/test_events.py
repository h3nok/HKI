"""
Tests for the analytics events ingest + recent endpoints.
"""

from __future__ import annotations

import base64
import json
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """TestClient with auth disabled for unit testing the event endpoints."""
    with patch.dict(os.environ, {"AUTH_ENABLED": "false"}):
        from src.api.app import app

        with TestClient(app) as c:
            yield c


class TestIngestEndpoint:
    def test_ingest_valid_event(self, client):
        event_data = {"event_type": "auth.request", "user_id": "42", "scope": "global"}
        encoded = base64.b64encode(json.dumps(event_data).encode()).decode()
        envelope = {
            "message": {"data": encoded, "messageId": "msg-1"},
            "subscription": "projects/test/subscriptions/test-sub",
        }
        resp = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_ingest_empty_data_ignored(self, client):
        envelope = {
            "message": {"data": "", "messageId": "msg-2"},
            "subscription": "projects/test/subscriptions/test-sub",
        }
        resp = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored"

    def test_ingest_malformed_base64(self, client):
        envelope = {
            "message": {"data": "not-valid-b64!!!", "messageId": "msg-3"},
            "subscription": "projects/test/subscriptions/test-sub",
        }
        resp = client.post("/v1/events/ingest", json=envelope)
        assert resp.status_code == 200
        assert resp.json()["status"] == "error"


class TestRecentEndpoint:
    def test_recent_returns_events(self, client):
        # Ingest a couple of events first
        for i in range(3):
            event = {"event_type": "auth.request", "user_id": str(i)}
            encoded = base64.b64encode(json.dumps(event).encode()).decode()
            client.post(
                "/v1/events/ingest",
                json={
                    "message": {"data": encoded},
                    "subscription": "test-sub",
                },
            )

        resp = client.get("/v1/events/recent?limit=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["events"]) <= 2
        # Route returns total == len(returned events), not total matching
        assert data["total"] == len(data["events"])

    def test_recent_filter_by_event_type(self, client):
        for etype in ["auth.request", "tool.call", "auth.request"]:
            event = {"event_type": etype, "user_id": "1"}
            encoded = base64.b64encode(json.dumps(event).encode()).decode()
            client.post(
                "/v1/events/ingest",
                json={
                    "message": {"data": encoded},
                    "subscription": "test-sub",
                },
            )

        resp = client.get("/v1/events/recent?event_type=tool.call")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e["event_type"] == "tool.call" for e in events)

    def test_recent_filter_by_user_id(self, client):
        for uid in ["100", "200", "100"]:
            event = {"event_type": "auth.request", "user_id": uid}
            encoded = base64.b64encode(json.dumps(event).encode()).decode()
            client.post(
                "/v1/events/ingest",
                json={
                    "message": {"data": encoded},
                    "subscription": "test-sub",
                },
            )

        resp = client.get("/v1/events/recent?user_id=200")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert all(e["user_id"] == "200" for e in events)
