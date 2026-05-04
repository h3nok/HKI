"""
Analytics Client — fire-and-forget event emission to analytics-service.

Emits structured events so the analytics service can compute knowledge-layer
metrics including:

    CMOS  — Context Memory Optimization Score
            avg(tokens_in_context) per kb.search — lower is better.
            Tracks how efficiently the KB feeds context to the agent.

    KB Retrieval Precision
            avg(top_score) per kb.search — signals chunk quality.

    Ingest Health
            chunk_count, entity_count, duration_ms per kb.ingest.

Design:
    - All methods are fire-and-forget: they schedule a background task and
      return immediately. Analytics MUST NOT block or fail the main request.
    - When ANALYTICS_SERVICE_URL is empty the client is a no-op.
    - Uses a single shared httpx.AsyncClient (connection pooling).
"""

from __future__ import annotations

import asyncio
import contextlib
import datetime
import typing

import httpx

import src.core.config
import src.core.logging


class AnalyticsClient:
    """
    Thin async HTTP client for emitting events to the analytics service.

    Usage:
        # In lifespan
        client = AnalyticsClient()
        await client.start()
        app.state.analytics = client

        # In route handler
        client.fire("kb.search", org_id=identity.org_id, payload={...})

        # On shutdown
        await client.close()
    """

    SERVICE = "knowledge-api"

    def __init__(self) -> None:
        self._url: str = src.core.config.settings.ANALYTICS_SERVICE_URL.rstrip("/")
        self._client: httpx.AsyncClient | None = None
        self._enabled: bool = bool(self._url)

    async def start(self) -> None:
        """Open the shared HTTP connection pool."""
        if self._enabled:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=2.0, read=3.0, write=3.0, pool=2.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
            src.core.logging.logger.info("Analytics client started", extra={"url": self._url})

    async def close(self) -> None:
        """Close the HTTP connection pool."""
        if self._client:
            await self._client.aclose()
            self._client = None

    # ── Public API ────────────────────────────────────────────────────────

    def fire(
        self,
        event_type: str,
        *,
        org_id: str = "default",
        user_id: str = "",
        scope: str = "global",
        payload: dict[str, typing.Any] | None = None,
    ) -> None:
        """
        Schedule a background task to emit an analytics event.

        Never raises. Safe to call from any async context.
        """
        if not self._enabled or not self._client:
            return
        with contextlib.suppress(RuntimeError):
            asyncio.create_task(
                self._send(
                    event_type,
                    org_id=org_id,
                    user_id=user_id,
                    scope=scope,
                    payload=payload or {},
                )
            )

    # ── Internal ──────────────────────────────────────────────────────────

    async def _send(
        self,
        event_type: str,
        *,
        org_id: str,
        user_id: str,
        scope: str,
        payload: dict[str, typing.Any],
    ) -> None:
        """POST a single event to the analytics service. Never raises."""
        try:
            await self._client.post(  # type: ignore[union-attr]
                f"{self._url}/v1/events",
                json={
                    "event_type": event_type,
                    "user_id": user_id,
                    "org_id": org_id,
                    "service": self.SERVICE,
                    "scope": scope,
                    "timestamp": datetime.datetime.now(datetime.UTC).timestamp(),
                    "payload": payload,
                },
            )
        except Exception as exc:
            # Degraded analytics must never surface to the caller
            src.core.logging.logger.debug(
                "Analytics emit skipped",
                extra={
                    "event_type": event_type,
                    "scope": scope,
                    "error": str(exc)[:120],
                },
            )
