"""Tests for shared.middleware — RequestIdMiddleware."""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from shared.middleware import RequestIdMiddleware, request_id_var


def _make_app() -> FastAPI:
    """Create a minimal app with RequestIdMiddleware."""
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/echo-rid")
    async def echo_rid(request: Request) -> dict[str, str]:
        return {"request_id": request_id_var.get("")}

    return app


class TestRequestIdMiddleware:
    """Test request-id generation and propagation."""

    def test_generates_uuid_when_no_header(self) -> None:
        client = TestClient(_make_app())
        resp = client.get("/echo-rid")
        assert resp.status_code == 200
        rid = resp.headers["X-Request-Id"]
        # Should be a valid UUID4
        uuid.UUID(rid, version=4)
        # Body should also contain the same id
        assert resp.json()["request_id"] == rid

    def test_propagates_caller_header(self) -> None:
        client = TestClient(_make_app())
        caller_rid = "my-custom-request-id-123"
        resp = client.get("/echo-rid", headers={"X-Request-Id": caller_rid})
        assert resp.status_code == 200
        assert resp.headers["X-Request-Id"] == caller_rid
        assert resp.json()["request_id"] == caller_rid

    def test_request_id_reset_after_request(self) -> None:
        """The context var should reset after the request completes."""
        client = TestClient(_make_app())
        client.get("/echo-rid")
        # Outside of a request, the context var default is empty
        assert request_id_var.get("") == ""

    def test_unique_ids_per_request(self) -> None:
        client = TestClient(_make_app())
        r1 = client.get("/echo-rid")
        r2 = client.get("/echo-rid")
        rid1 = r1.headers["X-Request-Id"]
        rid2 = r2.headers["X-Request-Id"]
        assert rid1 != rid2
