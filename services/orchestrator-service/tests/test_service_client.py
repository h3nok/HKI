"""
Tests for the authenticated service client — contextvar JWT forwarding,
circuit breaker, and resilient request with retry + backoff.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from src.core.service_client import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    _request_auth_token,
    get_request_token,
    resilient_request,
    service_client,
    set_request_token,
)


class TestContextVar:
    def test_default_is_empty(self):
        """Fresh contextvar should return empty string."""
        tok = _request_auth_token.set("")
        try:
            assert get_request_token() == ""
        finally:
            _request_auth_token.reset(tok)

    def test_set_and_get(self):
        set_request_token("abc123")
        assert get_request_token() == "abc123"
        # cleanup
        set_request_token("")

    def test_overwrite(self):
        set_request_token("first")
        set_request_token("second")
        assert get_request_token() == "second"
        set_request_token("")


class TestServiceClient:
    @pytest.mark.asyncio
    async def test_client_adds_auth_header_when_token_set(self):
        set_request_token("my-jwt-token")
        try:
            async with service_client() as client:
                assert client.headers.get("authorization") == "Bearer my-jwt-token"
        finally:
            set_request_token("")

    @pytest.mark.asyncio
    async def test_client_no_auth_header_when_no_token(self):
        set_request_token("")
        async with service_client() as client:
            assert "authorization" not in client.headers

    @pytest.mark.asyncio
    async def test_client_respects_timeout(self):
        set_request_token("")
        async with service_client(timeout=42.0) as client:
            assert client.timeout.connect == 42.0

    @pytest.mark.asyncio
    async def test_client_passes_kwargs(self):
        set_request_token("")
        async with service_client(timeout=5.0, follow_redirects=True) as client:
            assert client.follow_redirects is True


class TestCircuitBreaker:
    """Tests for the per-host circuit breaker."""

    def test_starts_closed(self):
        cb = CircuitBreaker(failure_threshold=3)
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request is True

    def test_stays_closed_under_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request is True

    def test_opens_at_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request is False

    def test_success_resets_count(self):
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        # Should be reset — 2 more failures shouldn't trip
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_after_recovery_timeout(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.0)
        cb.record_failure()
        # With recovery_timeout=0, accessing .state immediately transitions to HALF_OPEN
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.allow_request is True

    def test_half_open_success_closes(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.0)
        cb.record_failure()
        # Transitions to HALF_OPEN
        _ = cb.state
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_failure_reopens(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)
        cb.record_failure()
        # Force into HALF_OPEN by setting last failure far in the past
        cb._last_failure_time = 0.0
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_failure()
        # Should be OPEN again (recovery_timeout=60s, so won't auto-transition)
        assert cb._state == CircuitState.OPEN


class TestResilientRequest:
    """Tests for resilient_request with retry + circuit breaker."""

    @pytest.mark.asyncio
    async def test_success_on_first_try(self):
        mock_response = httpx.Response(200, text="ok")
        client = AsyncMock(spec=httpx.AsyncClient)
        client.request = AsyncMock(return_value=mock_response)

        resp = await resilient_request(
            client,
            "GET",
            "http://test-host:9509/health",
            max_retries=2,
            backoff_base=0.01,
        )
        assert resp.status_code == 200
        assert client.request.call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_503(self):
        fail_resp = httpx.Response(503, text="unavailable")
        ok_resp = httpx.Response(200, text="ok")
        client = AsyncMock(spec=httpx.AsyncClient)
        client.request = AsyncMock(side_effect=[fail_resp, ok_resp])

        resp = await resilient_request(
            client,
            "GET",
            "http://test-host:9509/search",
            max_retries=2,
            backoff_base=0.01,
        )
        assert resp.status_code == 200
        assert client.request.call_count == 2

    @pytest.mark.asyncio
    async def test_retries_on_connect_error(self):
        ok_resp = httpx.Response(200, text="ok")
        client = AsyncMock(spec=httpx.AsyncClient)
        client.request = AsyncMock(side_effect=[httpx.ConnectError("refused"), ok_resp])

        resp = await resilient_request(
            client,
            "GET",
            "http://test-host:9509/search",
            max_retries=2,
            backoff_base=0.01,
        )
        assert resp.status_code == 200
        assert client.request.call_count == 2

    @pytest.mark.asyncio
    async def test_no_retry_on_read_timeout(self):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.request = AsyncMock(side_effect=httpx.ReadTimeout("read timed out"))

        with pytest.raises(httpx.ReadTimeout):
            await resilient_request(
                client,
                "POST",
                "http://test-host:9509/ingest",
                max_retries=3,
                backoff_base=0.01,
            )
        # Should NOT retry — only 1 call
        assert client.request.call_count == 1

    @pytest.mark.asyncio
    async def test_circuit_open_error(self):
        from shared.http_client import _breakers

        # Pre-trip the breaker for this host
        host = "tripped-host:9509"
        _breakers[host] = CircuitBreaker(failure_threshold=1)
        _breakers[host].record_failure()

        client = AsyncMock(spec=httpx.AsyncClient)

        with pytest.raises(CircuitOpenError) as exc_info:
            await resilient_request(
                client,
                "GET",
                f"http://{host}/health",
                max_retries=2,
                backoff_base=0.01,
            )
        assert host in str(exc_info.value)
        # Client should never have been called
        assert client.request.call_count == 0

        # Cleanup
        del _breakers[host]

    @pytest.mark.asyncio
    async def test_no_retry_on_4xx(self):
        """4xx errors (except 429) should not be retried."""
        resp_404 = httpx.Response(404, text="not found")
        client = AsyncMock(spec=httpx.AsyncClient)
        client.request = AsyncMock(return_value=resp_404)

        resp = await resilient_request(
            client,
            "GET",
            "http://test-host:9509/missing",
            max_retries=3,
            backoff_base=0.01,
        )
        assert resp.status_code == 404
        assert client.request.call_count == 1
