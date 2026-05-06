"""
Analytics Client — fire-and-forget event emission to analytics-service.

Emits kb.ingest events so the analytics service can compute:

    Ingest Success Rate  — completed vs failed jobs over time
    Pipeline Duration    — avg processing_time_ms per ingest
    Chunk Throughput     — total chunks indexed per org
    CMOS contribution    — raw_size_bytes / chunk_count as a proxy for
                           chunking efficiency

Design:
    - Fire-and-forget: never blocks the pipeline execution.
    - No-op when ANALYTICS_SERVICE_URL is empty.
"""

from __future__ import annotations

import asyncio
import contextlib
import datetime
import typing

import httpx

import src.core.config
import src.core.logging

DEFAULT_ANALYTICS_SCOPE = "unscoped-ingest"


class AnalyticsClient:
    """
    Thin async HTTP client for emitting events to the analytics service.

    Usage:
        # In lifespan
        client = AnalyticsClient()
        await client.start()
        app.state.analytics = client

        # In pipeline
        client.fire("kb.ingest", org_id=job.org_id, payload={...})

        # On shutdown
        await client.close()
    """

    SERVICE = "knowledge-pipeline-service"

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
        scope: str = DEFAULT_ANALYTICS_SCOPE,
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
            src.core.logging.logger.debug(
                "Analytics emit skipped",
                extra={
                    "event_type": event_type,
                    "scope": scope,
                    "error": str(exc)[:120],
                },
            )
