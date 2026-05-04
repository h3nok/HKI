"""Tests for shared.http_client — service client factory, circuit breaker, resilient_request."""

from __future__ import annotations

import time
from unittest.mock import patch

import httpx
import pytest

from shared.http_client import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    _extract_host,
    create_service_client,
    reset_breakers,
    resilient_request,
)


@pytest.fixture(autouse=True)
def _clean_breakers() -> None:
    """Reset global breaker registry between tests."""
    reset_breakers()


# ═══════════════════════════════════════════════════════════════════════════════
# create_service_client
# ═══════════════════════════════════════════════════════════════════════════════


class TestCreateServiceClient:
    """Test the factory function."""

    def test_returns_async_client(self) -> None:
        client = create_service_client("test-svc")
        assert isinstance(client, httpx.AsyncClient)

    def test_user_agent_set(self) -> None:
        client = create_service_client("my-service")
        assert client.headers["User-Agent"] == "my-service/1.0"

    def test_default_user_agent(self) -> None:
        client = create_service_client()
        assert "hki-shared" in client.headers["User-Agent"]

    def test_base_url(self) -> None:
        client = create_service_client("svc", base_url="http://localhost:9509")
        assert str(client.base_url) == "http://localhost:9509"

    def test_custom_timeout(self) -> None:
        client = create_service_client("svc", timeout=5.0)
        assert client.timeout.connect == 5.0

    def test_extra_headers(self) -> None:
        client = create_service_client("svc", headers={"X-Custom": "val"})
        assert client.headers["X-Custom"] == "val"
        assert "User-Agent" in client.headers  # still present

    def test_request_id_hook_registered(self) -> None:
        client = create_service_client("svc")
        hooks = client.event_hooks.get("request", [])
        assert len(hooks) >= 1

    @pytest.mark.asyncio
    async def test_request_id_propagated(self) -> None:
        """X-Request-Id from context var is injected into outgoing requests."""
        from shared.middleware import request_id_var

        token = request_id_var.set("test-rid-456")
        captured_headers: dict[str, str] = {}

        async def mock_handler(request: httpx.Request) -> httpx.Response:
            captured_headers.update(dict(request.headers))
            return httpx.Response(200, json={"ok": True})

        transport = httpx.MockTransport(mock_handler)
        client = create_service_client("svc", base_url="http://test")
        # Replace transport for testing
        client._transport = transport

        try:
            await client.get("/ping")
            assert captured_headers.get("x-request-id") == "test-rid-456"
        finally:
            request_id_var.reset(token)
            await client.aclose()


# ═══════════════════════════════════════════════════════════════════════════════
# CircuitBreaker
# ═══════════════════════════════════════════════════════════════════════════════


class TestCircuitBreaker:
    """Test the per-host circuit breaker."""

    def test_starts_closed(self) -> None:
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request is True

    def test_stays_closed_under_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(4):
            cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request is True

    def test_opens_at_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request is False

    def test_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        # Counter reset — two more failures shouldn't trip
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

    def test_transitions_to_half_open_after_recovery(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # Wait for recovery window
        time.sleep(0.15)
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.allow_request is True

    def test_half_open_success_closes(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.05)
        cb.record_failure()
        cb.record_failure()
        time.sleep(0.06)
        assert cb.state == CircuitState.HALF_OPEN

        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_failure_reopens(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()
        time.sleep(0.06)
        assert cb.state == CircuitState.HALF_OPEN

        cb.record_failure()
        assert cb.state == CircuitState.OPEN


# ═══════════════════════════════════════════════════════════════════════════════
# _extract_host utility
# ═══════════════════════════════════════════════════════════════════════════════


class TestExtractHost:
    def test_full_url(self) -> None:
        assert (
            _extract_host("http://knowledge-api:9509/v1/search") == "knowledge-api:9509"
        )

    def test_localhost_with_port(self) -> None:
        assert _extract_host("http://localhost:8080/path") == "localhost:8080"

    def test_bare_string_fallback(self) -> None:
        assert _extract_host("unknown") == "unknown"


# ═══════════════════════════════════════════════════════════════════════════════
# resilient_request
# ═══════════════════════════════════════════════════════════════════════════════


def _mock_transport(responses: list[httpx.Response | Exception]) -> httpx.MockTransport:
    """Create a MockTransport that returns responses in order."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        idx = min(call_count, len(responses) - 1)
        call_count += 1
        item = responses[idx]
        if isinstance(item, Exception):
            raise item
        return item

    return httpx.MockTransport(handler)


class TestResilientRequest:
    """Test retry + circuit breaker integration."""

    @pytest.mark.asyncio
    async def test_success_on_first_try(self) -> None:
        transport = _mock_transport([httpx.Response(200, json={"ok": True})])
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client, "GET", "http://svc:8000/health", max_retries=2
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_retries_on_503_then_succeeds(self) -> None:
        transport = _mock_transport(
            [
                httpx.Response(503),
                httpx.Response(503),
                httpx.Response(200, json={"ok": True}),
            ]
        )
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client,
                "GET",
                "http://svc:8000/api",
                max_retries=3,
                backoff_base=0.01,  # fast for tests
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_last_retryable_response_when_exhausted(self) -> None:
        transport = _mock_transport(
            [httpx.Response(502)] * 4  # 1 initial + 3 retries
        )
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client,
                "GET",
                "http://svc:8000/api",
                max_retries=3,
                backoff_base=0.01,
            )
        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_retries_on_connect_error_then_succeeds(self) -> None:
        transport = _mock_transport(
            [
                httpx.ConnectError("refused"),
                httpx.Response(200, json={"ok": True}),
            ]
        )
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client,
                "GET",
                "http://svc:8000/api",
                max_retries=2,
                backoff_base=0.01,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_raises_connect_error_when_exhausted(self) -> None:
        transport = _mock_transport([httpx.ConnectError("refused")] * 4)
        async with httpx.AsyncClient(transport=transport) as client:
                await resilient_request(
                    client,
                    "GET",
                    "http://svc:8000/api",
                    max_retries=3,
                    backoff_base=0.01,
                )

    @pytest.mark.asyncio
    async def test_read_timeout_not_retried(self) -> None:
        """ReadTimeout should fail immediately — no retries."""
        transport = _mock_transport([httpx.ReadTimeout("timed out")])
        async with httpx.AsyncClient(transport=transport) as client:
                await resilient_request(
                    client,
                    "POST",
                    "http://svc:8000/api",
                    max_retries=3,
                    backoff_base=0.01,
                )

    @pytest.mark.asyncio
    async def test_circuit_open_raises_immediately(self) -> None:
        """When circuit is open, no HTTP call is made."""
        transport = _mock_transport([httpx.Response(200)])
        async with httpx.AsyncClient(transport=transport) as client:
            # Force-open the breaker for this host
            from shared.http_client import _get_breaker

            breaker = _get_breaker("svc:8000")
            for _ in range(5):
                breaker.record_failure()
            assert breaker.state == CircuitState.OPEN

            with pytest.raises(CircuitOpenError, match="svc:8000"):
                await resilient_request(client, "GET", "http://svc:8000/api")

    @pytest.mark.asyncio
    async def test_4xx_not_retried(self) -> None:
        """Client errors (except 429) succeed immediately — no retry."""
        transport = _mock_transport([httpx.Response(404)])
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client,
                "GET",
                "http://svc:8000/missing",
                max_retries=3,
                backoff_base=0.01,
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_429_is_retried(self) -> None:
        """429 Too Many Requests is retryable."""
        transport = _mock_transport(
            [
                httpx.Response(429),
                httpx.Response(200, json={"ok": True}),
            ]
        )
        async with httpx.AsyncClient(transport=transport) as client:
            resp = await resilient_request(
                client,
                "GET",
                "http://svc:8000/api",
                max_retries=2,
                backoff_base=0.01,
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    @patch("shared.http_client.asyncio.sleep", return_value=None)
    async def test_backoff_capped_at_max(self, mock_sleep) -> None:  # type: ignore[no-untyped-def]
        """Backoff delay should not exceed backoff_max."""
        transport = _mock_transport([httpx.Response(503)] * 4)
        async with httpx.AsyncClient(transport=transport) as client:
            await resilient_request(
                client,
                "GET",
                "http://svc:8000/api",
                max_retries=3,
                backoff_base=1.0,
                backoff_max=2.0,
            )
        # With base=1.0 and max=2.0: waits should be 1.0, 2.0, 2.0
        delays = [call.args[0] for call in mock_sleep.call_args_list]
        assert all(d <= 2.0 for d in delays)
