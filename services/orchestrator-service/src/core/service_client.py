"""
Authenticated Service Client — thin wrapper over ``shared.http_client``.

Adds JWT forwarding (via contextvar) on top of the shared platform's
pre-configured HTTP client factory, retry logic, and circuit breaker.

Usage in any tool implementation::

    from src.core.service_client import service_client

    async with service_client(timeout=15.0) as client:
        resp = await client.post(url, json=payload)

    # With retry + circuit breaker:
    from shared.http_client import resilient_request
    async with service_client() as client:
        resp = await resilient_request(client, "POST", url, json=data)
"""

from __future__ import annotations

import contextvars
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx

# Re-export shared resilience primitives so downstream imports don't change
from shared.http_client import (  # noqa: F401
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    create_service_client,
    resilient_request,
)

# ── Context variable: holds the Authorization header value for the current request ──
_request_auth_token: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_auth_token", default=""
)


def set_request_token(token: str) -> None:
    """Store the incoming request JWT for forwarding to downstream services."""
    _request_auth_token.set(token)


def get_request_token() -> str:
    """Retrieve the current request's JWT (empty string if not set)."""
    return _request_auth_token.get()


@asynccontextmanager
async def service_client(
    timeout: float = 15.0,
    **kwargs: object,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    Context manager that yields an ``httpx.AsyncClient`` with the current
    request's Authorization header pre-attached.

    Delegates to ``create_service_client()`` from the shared package so
    the client gets ``X-Request-Id`` propagation, ``User-Agent``,
    pool limits, and consistent timeouts for free.

    If no token is available (e.g., local dev with AUTH_ENABLED=false),
    the client still works — just without the Authorization header.
    """
    token = get_request_token()
    extra_headers: dict[str, str] = {}
    if token:
        extra_headers["Authorization"] = f"Bearer {token}"

    client = create_service_client(
        "orchestrator-service",
        timeout=timeout,
        headers=extra_headers,
        **kwargs,  # type: ignore[arg-type]
    )
    try:
        yield client
    finally:
        await client.aclose()
