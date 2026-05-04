"""Tests for shared.errors — exception hierarchy and error handlers."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from shared.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    ServiceError,
    ServiceUnavailableError,
    UpstreamError,
    install_error_handlers,
)


def _make_app() -> FastAPI:
    """Create a FastAPI app with error handlers installed."""
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/raise-bad-request")
    async def raise_bad_request() -> None:
        raise BadRequestError("Invalid input", detail={"field": "name"})

    @app.get("/raise-not-found")
    async def raise_not_found() -> None:
        raise NotFoundError("Document xyz not found")

    @app.get("/raise-conflict")
    async def raise_conflict() -> None:
        raise ConflictError("Already exists")

    @app.get("/raise-rate-limit")
    async def raise_rate_limit() -> None:
        raise RateLimitError()

    @app.get("/raise-upstream")
    async def raise_upstream() -> None:
        raise UpstreamError("LLM gateway timed out")

    @app.get("/raise-unavailable")
    async def raise_unavailable() -> None:
        raise ServiceUnavailableError()

    @app.get("/raise-generic")
    async def raise_generic() -> None:
        raise ServiceError("custom error", code="CUSTOM_CODE", status_code=418)

    @app.get("/raise-unhandled")
    async def raise_unhandled() -> None:
        raise RuntimeError("unexpected crash")

    return app


class TestServiceErrorHierarchy:
    """Test that ServiceError subclasses carry correct codes and status."""

    def test_bad_request(self) -> None:
        e = BadRequestError("bad")
        assert e.code == "BAD_REQUEST"
        assert e.status_code == 400

    def test_not_found(self) -> None:
        e = NotFoundError("missing")
        assert e.code == "NOT_FOUND"
        assert e.status_code == 404

    def test_conflict(self) -> None:
        e = ConflictError()
        assert e.code == "CONFLICT"
        assert e.status_code == 409

    def test_rate_limit(self) -> None:
        e = RateLimitError()
        assert e.code == "RATE_LIMIT_EXCEEDED"
        assert e.status_code == 429

    def test_upstream(self) -> None:
        e = UpstreamError()
        assert e.code == "UPSTREAM_ERROR"
        assert e.status_code == 502

    def test_unavailable(self) -> None:
        e = ServiceUnavailableError()
        assert e.code == "SERVICE_UNAVAILABLE"
        assert e.status_code == 503


class TestErrorHandlers:
    """Test that install_error_handlers produces consistent JSON envelopes."""

    def _client(self) -> TestClient:
        return TestClient(_make_app(), raise_server_exceptions=False)

    def test_bad_request_handler(self) -> None:
        resp = self._client().get("/raise-bad-request")
        assert resp.status_code == 400
        body = resp.json()
        assert body["error"]["code"] == "BAD_REQUEST"
        assert body["error"]["message"] == "Invalid input"
        assert body["error"]["detail"] == {"field": "name"}

    def test_not_found_handler(self) -> None:
        resp = self._client().get("/raise-not-found")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"

    def test_conflict_handler(self) -> None:
        resp = self._client().get("/raise-conflict")
        assert resp.status_code == 409

    def test_rate_limit_handler(self) -> None:
        resp = self._client().get("/raise-rate-limit")
        assert resp.status_code == 429

    def test_upstream_handler(self) -> None:
        resp = self._client().get("/raise-upstream")
        assert resp.status_code == 502

    def test_unavailable_handler(self) -> None:
        resp = self._client().get("/raise-unavailable")
        assert resp.status_code == 503

    def test_generic_service_error(self) -> None:
        resp = self._client().get("/raise-generic")
        assert resp.status_code == 418
        assert resp.json()["error"]["code"] == "CUSTOM_CODE"

    def test_unhandled_exception(self) -> None:
        resp = self._client().get("/raise-unhandled")
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_ERROR"
