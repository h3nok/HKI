"""Tests for shared.health — health check router."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from shared.health import create_health_router, health_response


class TestHealthResponse:
    """Test the simple health response helper."""

    def test_basic_response(self) -> None:
        resp = health_response("my-svc", "1.2.3")
        assert resp["status"] == "healthy"
        assert resp["service"] == "my-svc"
        assert resp["version"] == "1.2.3"


class TestHealthRouter:
    """Test the health router endpoints."""

    def _make_client(self, **kwargs) -> TestClient:
        app = FastAPI()
        app.include_router(create_health_router(**kwargs))
        return TestClient(app)

    def test_liveness(self) -> None:
        client = self._make_client(service_name="svc", version="0.1.0")
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_readiness_no_checks(self) -> None:
        client = self._make_client(service_name="svc")
        resp = client.get("/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ready"
        assert body["checks"] == {}

    def test_readiness_all_passing(self) -> None:
        async def ok_check() -> str:
            return "ok"

        client = self._make_client(
            service_name="svc",
            readiness_checks={"db": ok_check, "cache": ok_check},
        )
        resp = client.get("/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ready"
        assert body["checks"]["db"] == "ok"
        assert body["checks"]["cache"] == "ok"

    def test_readiness_degraded(self) -> None:
        async def ok_check() -> str:
            return "ok"

        async def fail_check() -> str:
            raise ConnectionError("cannot connect")

        client = self._make_client(
            service_name="svc",
            readiness_checks={"db": ok_check, "cache": fail_check},
        )
        resp = client.get("/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["checks"]["db"] == "ok"
        assert "error:" in body["checks"]["cache"]

    def test_health_ready_alias(self) -> None:
        """The /health/ready endpoint should work identically to /ready."""
        client = self._make_client(service_name="svc")
        resp = client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"
