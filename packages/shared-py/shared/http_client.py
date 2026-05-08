"""
Shared HTTP Client — pre-configured ``httpx.AsyncClient`` factory with
resilient request helpers (retry + circuit breaker).

Provides:

    * ``create_service_client()`` — ``httpx.AsyncClient`` factory with
      ``X-Request-Id`` propagation, ``User-Agent``, pool limits.
    * ``resilient_request()`` — retry with exponential backoff +
      per-host circuit breaker for transient failures.
    * ``CircuitBreaker`` / ``CircuitOpenError`` — lightweight, per-host
      circuit breaker with zero external dependencies.

Usage::

    from shared.http_client import create_service_client, resilient_request

    http = create_service_client("orchestrator-service", base_url="http://knowledge-api:9509")

    # Simple call (no retry):
    resp = await http.get("/v1/search", params={"q": "tires"})

    # With retry + circuit breaker:
    resp = await resilient_request(http, "POST", "/v1/ingest", json=body)
"""

from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30.0
_DEFAULT_MAX_CONNECTIONS = 100


# ═══════════════════════════════════════════════════════════════════════════════
# Request-ID propagation hooks
# ═══════════════════════════════════════════════════════════════════════════════


def _request_id_hook(request: httpx.Request) -> None:
    """Inject X-Request-Id from the current context onto outgoing requests."""
    try:
        from shared.middleware import request_id_var

        rid = request_id_var.get("")
        if rid:
            request.headers["X-Request-Id"] = rid
    except ImportError:
        pass


async def _async_request_id_hook(request: httpx.Request) -> None:
    """Async version of the request-id hook for AsyncClient."""
    _request_id_hook(request)


# ═══════════════════════════════════════════════════════════════════════════════
# Circuit Breaker — lightweight, per-host, no external dependencies
# ═══════════════════════════════════════════════════════════════════════════════


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation — requests flow through
    OPEN = "open"  # Tripped — requests fail fast
    HALF_OPEN = "half_open"  # Testing — one probe request allowed


class CircuitBreaker:
    """
    Per-host circuit breaker with three states:

        CLOSED   → normal; track consecutive failures
        OPEN     → fail-fast for ``recovery_timeout`` seconds
        HALF_OPEN → allow one probe; success → CLOSED, failure → OPEN

    Thresholds are intentionally conservative for an internal service mesh:
    5 consecutive failures to trip, 30 s recovery window.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
        return self._state

    def record_success(self) -> None:
        """Reset on success."""
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Track failure; trip if threshold exceeded."""
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN

    @property
    def allow_request(self) -> bool:
        """Whether a request should be attempted."""
        return self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN)


class CircuitOpenError(Exception):
    """Raised when the circuit breaker is open (service is down)."""

    def __init__(self, host: str) -> None:
        self.host = host
        super().__init__(
            f"Circuit breaker OPEN for {host} — service appears down, failing fast"
        )


# Global registry of per-host circuit breakers
_breakers: dict[str, CircuitBreaker] = {}


def _get_breaker(host: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a host."""
    if host not in _breakers:
        _breakers[host] = CircuitBreaker()
    return _breakers[host]


def _extract_host(url: str) -> str:
    """Extract host:port from a URL for circuit breaker keying."""
    parsed = urlparse(url)
    return parsed.netloc or parsed.hostname or url


def reset_breakers() -> None:
    """Clear all circuit breakers (useful in tests)."""
    _breakers.clear()


# ═══════════════════════════════════════════════════════════════════════════════
# Resilient HTTP helpers
# ═══════════════════════════════════════════════════════════════════════════════

_RETRYABLE_STATUS_CODES = {502, 503, 504, 429}


async def resilient_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    max_retries: int = 3,
    backoff_base: float = 0.5,
    backoff_max: float = 8.0,
    **kwargs: Any,
) -> httpx.Response:
    """
    Make an HTTP request with retry + circuit breaker.

    Retries on:
        - Connection errors (``httpx.ConnectError``, ``httpx.ConnectTimeout``)
        - Transient HTTP errors (502, 503, 504, 429)

    Does NOT retry on:
        - 4xx client errors (except 429)
        - Read timeouts (the server received the request — retrying risks duplicates)

    Args:
        client:       An ``httpx.AsyncClient`` (e.g. from ``create_service_client``).
        method:       HTTP method (GET, POST, …).
        url:          Target URL.
        max_retries:  Maximum retry attempts (on top of the first attempt).
        backoff_base: Base delay in seconds for exponential backoff.
        backoff_max:  Maximum backoff delay cap.
        **kwargs:     Forwarded to ``client.request()``.

    Raises:
        CircuitOpenError: If the per-host circuit breaker is open.
        httpx.ConnectError: If all retries are exhausted on connection errors.
        httpx.ReadTimeout: Immediately (not retried).
    """
    host = _extract_host(url)
    breaker = _get_breaker(host)

    if not breaker.allow_request:
        raise CircuitOpenError(host)

    last_exc: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            response = await client.request(method, url, **kwargs)

            if response.status_code in _RETRYABLE_STATUS_CODES:
                breaker.record_failure()
                if attempt < max_retries:
                    wait = min(backoff_base * (2**attempt), backoff_max)
                    logger.warning(
                        "Retryable HTTP %d from %s (attempt %d/%d, waiting %.1fs)",
                        response.status_code,
                        host,
                        attempt + 1,
                        max_retries + 1,
                        wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                return response

            breaker.record_success()
            return response

        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            breaker.record_failure()
            last_exc = exc
            if attempt < max_retries:
                wait = min(backoff_base * (2**attempt), backoff_max)
                logger.warning(
                    "Connection error to %s: %s (attempt %d/%d, waiting %.1fs)",
                    host,
                    exc,
                    attempt + 1,
                    max_retries + 1,
                    wait,
                )
                await asyncio.sleep(wait)
                continue
            raise

        except httpx.ReadTimeout:
            breaker.record_failure()
            raise

    if last_exc:
        raise last_exc
    raise RuntimeError("Exhausted retries with no response")  # pragma: no cover


# ═══════════════════════════════════════════════════════════════════════════════
# Client factory
# ═══════════════════════════════════════════════════════════════════════════════


def create_service_client(
    service_name: str = "",
    *,
    base_url: str = "",
    timeout: float = _DEFAULT_TIMEOUT,
    max_connections: int = _DEFAULT_MAX_CONNECTIONS,
    follow_redirects: bool = False,
    headers: dict[str, str] | None = None,
) -> httpx.AsyncClient:
    """
    Create a pre-configured ``httpx.AsyncClient``.

    Args:
        service_name:    Calling service name (used in User-Agent).
        base_url:        Optional base URL for all requests.
        timeout:         Default request timeout in seconds.
        max_connections:  Max concurrent connections in the pool.
        follow_redirects: Whether to follow HTTP redirects.
        headers:         Extra default headers to include.

    Returns:
        An ``httpx.AsyncClient`` ready for use.
    """
    default_headers = {
        "User-Agent": f"{service_name}/1.0" if service_name else "hki-shared/1.0",
    }
    if headers:
        default_headers.update(headers)

    return httpx.AsyncClient(
        base_url=base_url,
        timeout=httpx.Timeout(timeout),
        limits=httpx.Limits(
            max_connections=max_connections,
            max_keepalive_connections=max_connections // 2,
        ),
        follow_redirects=follow_redirects,
        headers=default_headers,
        event_hooks={"request": [_async_request_id_hook]},
    )
