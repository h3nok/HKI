"""
Observability provider for dashboard traces and summary.

Supports:
- cache mode      : in-memory ring buffer (default local/dev)
- dynatrace mode  : query Dynatrace logs API
- auto mode       : Dynatrace when configured, otherwise cache

All modes return the same TraceEvent / TraceSummary contract so the frontend
and BFF schemas stay stable.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from src.core.config import settings
from src.core.logging import logger
from src.domain.observability import (
    TraceEvent,
    TraceSummary,
    get_recent,
    get_summary,
)


def _normalized_backend() -> str:
    return (settings.OBSERVABILITY_BACKEND or "cache").strip().lower()


def _dynatrace_configured() -> bool:
    return bool(settings.DYNATRACE_BASE_URL and settings.DYNATRACE_API_TOKEN)


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_timestamp(value: Any) -> str:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, (int, float)):
        # Dynatrace often returns epoch milliseconds
        ts = value / 1000.0 if value > 10_000_000_000 else float(value)
        return datetime.fromtimestamp(ts, tz=UTC).isoformat()
    return datetime.now(UTC).isoformat()


def _extract_payload(log_item: dict[str, Any]) -> dict[str, Any]:
    content = log_item.get("content")
    if isinstance(content, dict):
        return content
    return log_item


def _parse_trace_event(raw: dict[str, Any]) -> TraceEvent:
    payload = _extract_payload(raw)

    metadata: dict[str, Any] = {}
    if isinstance(payload.get("metadata"), dict):
        metadata.update(payload.get("metadata", {}))

    for key, value in payload.items():
        if key.startswith("meta."):
            metadata[key[5:]] = value

    trace_id = (
        payload.get("trace_id")
        or payload.get("traceId")
        or payload.get("id")
        or raw.get("id")
        or ""
    )
    operation = str(payload.get("operation") or raw.get("operation") or "unknown")

    return TraceEvent(
        id=str(trace_id)[:12] if trace_id else TraceEvent().id,
        operation=operation,
        status=str(payload.get("status") or raw.get("status") or "ok"),
        duration_ms=_coerce_float(payload.get("duration_ms", payload.get("durationMs", 0.0))),
        timestamp=_parse_timestamp(payload.get("timestamp") or raw.get("timestamp")),
        metadata=metadata,
        error=str(payload.get("error") or raw.get("error") or "")[:200],
        input_tokens=_coerce_int(payload.get("input_tokens", payload.get("inputTokens", 0))),
        output_tokens=_coerce_int(payload.get("output_tokens", payload.get("outputTokens", 0))),
        model=str(payload.get("model") or raw.get("model") or ""),
    )


def _compute_summary(events: list[TraceEvent]) -> TraceSummary:
    if not events:
        return TraceSummary()

    durations = sorted(e.duration_ms for e in events)
    p95_idx = int(len(durations) * 0.95)
    p95_value = durations[min(p95_idx, len(durations) - 1)]

    operations: dict[str, int] = {}
    error_count = 0
    total_input_tokens = 0
    total_output_tokens = 0

    for event in events:
        operations[event.operation] = operations.get(event.operation, 0) + 1
        if event.status == "error":
            error_count += 1
        total_input_tokens += event.input_tokens
        total_output_tokens += event.output_tokens

    return TraceSummary(
        total_traces=len(events),
        error_count=error_count,
        avg_duration_ms=sum(durations) / len(durations),
        p95_duration_ms=p95_value,
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
        operations=operations,
    )


def _dynatrace_get_json(
    *,
    url: str,
    headers: dict[str, str],
    params: dict[str, Any],
) -> dict[str, Any]:
    query = urlencode(params)
    request_url = f"{url}?{query}" if query else url
    req = Request(request_url, headers=headers, method="GET")
    with urlopen(req, timeout=settings.DYNATRACE_TIMEOUT_SEC) as response:
        payload = response.read().decode("utf-8")
    data = json.loads(payload) if payload else {}
    return data if isinstance(data, dict) else {}


def _fetch_dynatrace_logs_sync(limit: int) -> list[TraceEvent]:
    base_url = settings.DYNATRACE_BASE_URL.rstrip("/")
    endpoint = settings.DYNATRACE_LOGS_ENDPOINT.strip() or "/api/v2/logs/export"
    if not endpoint.startswith("/"):
        endpoint = f"/{endpoint}"

    url = f"{base_url}{endpoint}"
    headers = {
        "Authorization": f"Api-Token {settings.DYNATRACE_API_TOKEN}",
        "Accept": "application/json",
    }

    lookback = max(settings.OBSERVABILITY_LOOKBACK_MINUTES, 1)
    from_time = (datetime.now(UTC) - timedelta(minutes=lookback)).isoformat()

    events: list[TraceEvent] = []
    next_page_key: str | None = None
    requested = max(min(limit, 1000), 100)

    while len(events) < limit:
        params: dict[str, Any] = {
            "from": from_time,
            "to": "now",
            "query": settings.DYNATRACE_LOG_QUERY,
            "pageSize": min(500, requested),
            "sort": "timestamp desc",
        }
        if next_page_key:
            params = {"nextPageKey": next_page_key}

        payload = _dynatrace_get_json(url=url, headers=headers, params=params)

        rows = payload.get("results") or payload.get("items") or payload.get("logs") or []
        if not isinstance(rows, list):
            rows = []

        for row in rows:
            if not isinstance(row, dict):
                continue
            events.append(_parse_trace_event(row))
            if len(events) >= limit:
                break

        next_page_key = payload.get("nextPageKey") or payload.get("next_page_key")
        if not next_page_key or not rows:
            break

    events.sort(key=lambda event: event.timestamp, reverse=True)
    return events[:limit]


async def _fetch_dynatrace_logs(limit: int) -> list[TraceEvent]:
    return await asyncio.to_thread(_fetch_dynatrace_logs_sync, limit)


async def get_dashboard_traces(
    *,
    limit: int = 100,
    operation: str | None = None,
) -> list[TraceEvent]:
    backend = _normalized_backend()

    use_dynatrace = backend == "dynatrace" or (backend == "auto" and _dynatrace_configured())

    if use_dynatrace:
        if not _dynatrace_configured():
            logger.warning(
                "Dynatrace observability requested but config is incomplete; falling back to cache",
                extra={"backend": backend},
            )
        else:
            try:
                events = await _fetch_dynatrace_logs(limit=max(limit, 100))
                if operation:
                    events = [e for e in events if e.operation.startswith(operation)]
                return events[:limit]
            except Exception as exc:
                logger.warning(
                    "Dynatrace traces fetch failed; falling back to cache",
                    extra={"error": str(exc)[:200], "backend": backend},
                )

    return get_recent(limit=limit, operation=operation)


async def get_dashboard_summary() -> TraceSummary:
    backend = _normalized_backend()

    use_dynatrace = backend == "dynatrace" or (backend == "auto" and _dynatrace_configured())

    if use_dynatrace:
        if not _dynatrace_configured():
            logger.warning(
                "Dynatrace summary requested but config is incomplete; falling back to cache",
                extra={"backend": backend},
            )
        else:
            try:
                events = await _fetch_dynatrace_logs(limit=1000)
                return _compute_summary(events)
            except Exception as exc:
                logger.warning(
                    "Dynatrace summary fetch failed; falling back to cache",
                    extra={"error": str(exc)[:200], "backend": backend},
                )

    return get_summary()
