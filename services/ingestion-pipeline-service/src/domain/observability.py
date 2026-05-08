"""
Observability — structured logging for Dynatrace + GCP Cloud Logging.

Emits structured JSON log events for every tracked operation so they are
automatically ingested by:
    - **GCP Cloud Logging** via the existing GCPJsonFormatter (severity,
      trace correlation, service context)
    - **Dynatrace** via GCP log ingest or the OneAgent log module

What this module does NOT do (by design):
    - No custom in-memory metrics aggregation (use Dynatrace dashboards)
    - No custom distributed tracing (use Cloud Trace / Dynatrace PurePath)
    - No persistent storage (structured logs ARE the storage)

A small ring buffer (200 events) is kept for the in-app Observability tab
so knowledge managers can glance at recent activity without needing
Dynatrace console access. This is a convenience cache, not a source of
truth.

Log schema (extra fields on every emitted log line):
    log_type          : "llm_trace"   (constant — for log-based metric filters)
    operation         : "gemini.generate_answer" | "gemini.context" | ...
    status            : "ok" | "error"
    duration_ms       : float
    input_tokens      : int
    output_tokens     : int
    model             : str
    + any caller-supplied metadata keys

Usage:
    from src.domain.observability import emit, span

    # Manual emit
    emit("search.hybrid", duration_ms=42.5, metadata={"results": 12})

    # Context manager
    with span("gemini.generate_answer", model="gemini-2.0-flash") as s:
        result = await _call_gemini(prompt)
        s["output_tokens"] = estimate_tokens(result)
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from src.core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
# Data classes (used by the in-app cache AND log serialization)
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class TraceEvent:
    """A single observed operation."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    operation: str = ""
    status: str = "ok"
    duration_ms: float = 0.0
    timestamp: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
    )
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "operation": self.operation,
            "status": self.status,
            "durationMs": self.duration_ms,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
            "error": self.error,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "model": self.model,
        }

    def to_log_extra(self) -> dict[str, Any]:
        """Flat dict for structured logging (GCP / Dynatrace ingestion)."""
        extra: dict[str, Any] = {
            "log_type": "llm_trace",
            "trace_id": self.id,
            "operation": self.operation,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "model": self.model,
        }
        if self.error:
            extra["error"] = self.error
        # Flatten metadata into top-level keys with "meta." prefix
        for k, v in self.metadata.items():
            extra[f"meta.{k}"] = v
        return extra


@dataclass
class TraceSummary:
    """Aggregated stats (computed from the in-app cache for dashboard)."""
    total_traces: int = 0
    error_count: int = 0
    avg_duration_ms: float = 0.0
    p95_duration_ms: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    operations: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "totalTraces": self.total_traces,
            "errorCount": self.error_count,
            "avgDurationMs": round(self.avg_duration_ms, 2),
            "p95DurationMs": round(self.p95_duration_ms, 2),
            "totalInputTokens": self.total_input_tokens,
            "totalOutputTokens": self.total_output_tokens,
            "operations": self.operations,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# In-app cache (convenience for the dashboard — NOT source of truth)
# ═══════════════════════════════════════════════════════════════════════════════

_CACHE_SIZE = 200
_cache: deque[TraceEvent] = deque(maxlen=_CACHE_SIZE)
_cache_lock = Lock()


def _cache_event(event: TraceEvent) -> None:
    with _cache_lock:
        _cache.append(event)


def get_recent(
    limit: int = 100,
    operation: str | None = None,
) -> list[TraceEvent]:
    """Return recent events from the in-app cache (newest first)."""
    with _cache_lock:
        events = list(reversed(_cache))
    if operation:
        events = [e for e in events if e.operation.startswith(operation)]
    return events[:limit]


def get_summary() -> TraceSummary:
    """Compute summary stats from the in-app cache."""
    with _cache_lock:
        events = list(_cache)

    if not events:
        return TraceSummary()

    durations = [e.duration_ms for e in events]
    durations_sorted = sorted(durations)
    p95_idx = int(len(durations_sorted) * 0.95)

    ops: dict[str, int] = {}
    total_in = total_out = errors = 0
    for e in events:
        ops[e.operation] = ops.get(e.operation, 0) + 1
        total_in += e.input_tokens
        total_out += e.output_tokens
        if e.status == "error":
            errors += 1

    return TraceSummary(
        total_traces=len(events),
        error_count=errors,
        avg_duration_ms=sum(durations) / len(durations),
        p95_duration_ms=durations_sorted[
            min(p95_idx, len(durations_sorted) - 1)
        ],
        total_input_tokens=total_in,
        total_output_tokens=total_out,
        operations=ops,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Public API — emit() and span()
# ═══════════════════════════════════════════════════════════════════════════════


def emit(
    operation: str,
    *,
    status: str = "ok",
    duration_ms: float = 0.0,
    input_tokens: int = 0,
    output_tokens: int = 0,
    model: str = "",
    error: str = "",
    metadata: dict[str, Any] | None = None,
) -> TraceEvent:
    """
    Emit a structured trace event.

    This does two things:
        1. Logs a structured JSON line (picked up by GCP / Dynatrace)
        2. Caches the event for the in-app dashboard
    """
    event = TraceEvent(
        operation=operation,
        status=status,
        duration_ms=round(duration_ms, 2),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model=model,
        error=error[:200] if error else "",
        metadata=metadata or {},
    )

    # Structured log — this is the primary observability output
    log_fn = logger.error if status == "error" else logger.info
    log_fn(
        f"trace:{operation} {status} {duration_ms:.0f}ms",
        extra=event.to_log_extra(),
    )

    # In-app cache (secondary)
    _cache_event(event)

    return event


@contextmanager
def span(
    operation: str,
    *,
    model: str = "",
    metadata: dict[str, Any] | None = None,
) -> Generator[dict[str, Any], None, None]:
    """
    Context manager that measures duration and emits on exit.

    Yields a mutable dict where callers can set output_tokens,
    input_tokens, or any additional metadata during the span.

    Usage:
        with span("gemini.generate_answer", model="gemini-2.0-flash") as s:
            result = await _call_gemini(prompt)
            s["output_tokens"] = estimate_tokens(result)
            s["meta.query_len"] = len(query)
    """
    ctx: dict[str, Any] = {
        "input_tokens": 0,
        "output_tokens": 0,
        "error": "",
        "status": "ok",
    }
    start = time.perf_counter()
    try:
        yield ctx
    except Exception as exc:
        ctx["status"] = "error"
        ctx["error"] = str(exc)[:200]
        raise
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        # Extract known keys, rest goes to metadata
        extra_meta = dict(metadata or {})
        for k, v in ctx.items():
            if k.startswith("meta."):
                extra_meta[k[5:]] = v

        emit(
            operation,
            status=ctx.get("status", "ok"),
            duration_ms=elapsed,
            input_tokens=ctx.get("input_tokens", 0),
            output_tokens=ctx.get("output_tokens", 0),
            model=model,
            error=ctx.get("error", ""),
            metadata=extra_meta,
        )
