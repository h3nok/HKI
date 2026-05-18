"""
Analytics Use Cases — business logic independent of transport/storage.

These orchestrate the domain entities and delegate to adapters for
persistence and external communication.
"""

from __future__ import annotations

import collections
import datetime
import logging
import math
import typing

import src.core.logging
import src.domain.entities

logger: logging.Logger = src.core.logging.logger.getChild("use_cases")


def _normalize_stream_id(value: typing.Any) -> str | None:
    stream_id: str = str(value or "").strip()
    if not stream_id or stream_id == "global":
        return None
    return stream_id


def _event_matches_summary_scope(
    event: src.domain.entities.AgentEvent,
    *,
    org_id: str | None = None,
    stream_id: str | None = None,
) -> bool:
    if org_id and event.org_id != org_id:
        return False
    if not stream_id:
        return True

    return (
        _normalize_stream_id(event.scope) == stream_id
        or _normalize_stream_id(event.payload.get("stream_id")) == stream_id
    )


def _extract_ragas_metric(
    payload: dict[str, typing.Any],
    key: str,
) -> float | None:
    ragas: typing.Any | None = payload.get("ragas")
    if isinstance(ragas, dict) and key in ragas:
        try:
            return float(ragas[key])
        except (TypeError, ValueError):
            return None

    for candidate: str in (key, f"ragas_{key}"):
        if candidate in payload:
            try:
                return float(payload[candidate])
            except (TypeError, ValueError):
                return None

    return None


def _positive_int(value: typing.Any, default: int = 1) -> int:
    try:
        return max(int(value), 1)
    except (TypeError, ValueError):
        return default


class EventStore:
    """
    In-memory event store (development fallback).

    Production implementations should implement the same interface
    against BigQuery, Cloud SQL, or another durable store.
    """

    def __init__(self, max_buffer: int = 10_000) -> None:
        self._buffer: list[src.domain.entities.AgentEvent] = []
        self._max: int = max_buffer

    def append(self, event: src.domain.entities.AgentEvent) -> None:
        self._buffer.append(event)
        if len(self._buffer) > self._max:
            self._buffer = self._buffer[-self._max :]

    def query(
        self,
        *,
        limit: int = 50,
        event_type: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
        stream_id: str | None = None,
        service: str | None = None,
    ) -> list[src.domain.entities.AgentEvent]:
        events: list[src.domain.entities.AgentEvent] = self._buffer[::-1]  # newest first
        if event_type:
            events = [event for event: src.domain.entities.AgentEvent in events if event.event_type == event_type]
        if user_id:
            events = [event for event: src.domain.entities.AgentEvent in events if event.user_id == user_id]
        if org_id:
            events = [event for event: src.domain.entities.AgentEvent in events if event.org_id == org_id]
        if stream_id:
            events = [
                event
                for event: src.domain.entities.AgentEvent in events
                if _event_matches_summary_scope(event, stream_id=stream_id)
            ]
        if service:
            events = [event for event: src.domain.entities.AgentEvent in events if event.service == service]
        return events[:limit]

    @property
    def size(self) -> int:
        return len(self._buffer)

    def summarize(
        self,
        *,
        period_start: str = "",
        period_end: str = "",
        org_id: str | None = None,
        stream_id: str | None = None,
    ) -> src.domain.entities.UsageSummary:
        """Compute aggregated usage summary over the filtered buffered events."""
        now: str = datetime.datetime.now(datetime.UTC).isoformat()
        type_counter: collections.Counter[str] = collections.Counter()
        svc_counter: collections.Counter[str] = collections.Counter()
        user_set: set[str] = set()

        # KB search accumulators (for CMOS and retrieval quality)
        kb_search_tokens: list[int] = []
        kb_search_chunks: list[int] = []
        kb_search_scores: list[float] = []
        ragas_totals: dict[str, float] = collections.defaultdict(float)
        ragas_counts: dict[str, int] = collections.defaultdict(int)
        ragas_population_count = 0
        ragas_sample_count = 0

        # KB ingest accumulators (for ingest health metrics)
        ingest_total = 0
        ingest_completed = 0
        ingest_durations: list[float] = []
        ingest_chunks: list[int] = []

        events: list[src.domain.entities.AgentEvent] = [
            event
            for event: src.domain.entities.AgentEvent in self._buffer
            if _event_matches_summary_scope(
                event,
                org_id=org_id,
                stream_id=stream_id,
            )
        ]

        for event: src.domain.entities.AgentEvent in events:
            type_counter[event.event_type] += 1
            svc_counter[event.service] += 1
            if event.user_id:
                user_set.add(event.user_id)

            payload: dict[str, typing.Any] = event.payload

            if event.event_type in ("kb.search", "kb.evaluation"):
                population_count: int = (
                    _positive_int(
                        payload.get("case_count"),
                        _positive_int(payload.get("ragas_sample_count"), 1),
                    )
                    if event.event_type == "kb.evaluation"
                    else 1
                )
                sample_count: int = (
                    _positive_int(payload.get("ragas_sample_count"), population_count)
                    if event.event_type == "kb.evaluation"
                    else 1
                )
                ragas_population_count += population_count

                metrics: dict[str, float | None] = {
                    "faithfulness": _extract_ragas_metric(payload, "faithfulness"),
                    "answer_relevancy": _extract_ragas_metric(payload, "answer_relevancy"),
                    "context_precision": _extract_ragas_metric(payload, "context_precision"),
                    "context_recall": _extract_ragas_metric(payload, "context_recall"),
                    "answer_correctness": _extract_ragas_metric(
                        payload,
                        "answer_correctness",
                    ),
                }
                present_metrics: dict[str, float] = {
                    key: value for key, value in metrics.items() if value is not None
                }
                if present_metrics:
                    ragas_sample_count += sample_count
                    for key, value in present_metrics.items():
                        ragas_totals[key] += value * sample_count
                        ragas_counts[key] += sample_count

            if event.event_type == "kb.search":
                if "tokens_in_context" in payload:
                    kb_search_tokens.append(int(payload["tokens_in_context"]))
                if "chunks_returned" in payload:
                    kb_search_chunks.append(int(payload["chunks_returned"]))
                if "top_score" in payload:
                    kb_search_scores.append(float(payload["top_score"]))

            elif event.event_type == "kb.ingest":
                ingest_total += 1
                status: str = str(payload.get("status") or "").strip().lower()
                if status in ("completed", "indexed"):
                    ingest_completed += 1
                duration: typing.Any | None = payload.get(
                    "processing_time_ms",
                    payload.get("duration_ms"),
                )
                if duration is not None:
                    ingest_durations.append(float(duration))
                if status in ("completed", "indexed") and "chunk_count" in payload:
                    ingest_chunks.append(int(payload["chunk_count"]))

        def _avg(lst: list) -> float:
            return round(sum(lst) / len(lst), 2) if lst else 0.0

        def _p95(lst: list[float]) -> float:
            if not lst:
                return 0.0
            ordered: list[float] = sorted(lst)
            index: int = max(0, math.ceil(0.95 * len(ordered)) - 1)
            return round(float(ordered[index]), 2)

        def _ragas_avg(key: str) -> float:
            count: int = ragas_counts.get(key, 0)
            return round(ragas_totals.get(key, 0.0) / count, 2) if count else 0.0

        return src.domain.entities.UsageSummary(
            period_start=period_start or now,
            period_end=period_end or now,
            total_events=len(events),
            unique_users=len(user_set),
            events_by_type=dict(type_counter),
            events_by_service=dict(svc_counter),
            # CMOS: avg input tokens consumed per search call
            cmos=_avg(kb_search_tokens),
            avg_chunks_per_search=_avg(kb_search_chunks),
            avg_top_score=_avg(kb_search_scores),
            total_ingest_jobs=ingest_total,
            ingest_success_rate=(
                round(ingest_completed / ingest_total, 4) if ingest_total else 0.0
            ),
            avg_ingest_duration_ms=_avg(ingest_durations),
            p95_ingest_duration_ms=_p95(ingest_durations),
            total_chunks_indexed=sum(ingest_chunks),
            ragas_sample_count=ragas_sample_count,
            ragas_coverage_rate=(
                round(ragas_sample_count / ragas_population_count, 4)
                if ragas_population_count
                else 0.0
            ),
            avg_faithfulness=_ragas_avg("faithfulness"),
            avg_answer_relevancy=_ragas_avg("answer_relevancy"),
            avg_context_precision=_ragas_avg("context_precision"),
            avg_context_recall=_ragas_avg("context_recall"),
            avg_answer_correctness=_ragas_avg("answer_correctness"),
        )

    def user_activity(self, user_id: str) -> src.domain.entities.UserActivity:
        """Compute per-user activity summary."""
        events: list[src.domain.entities.AgentEvent] = [
            event for event: src.domain.entities.AgentEvent in self._buffer if event.user_id == user_id
        ]
        scopes: collections.Counter[str] = collections.Counter()
        messages = tools = searches = 0
        last_ts: str = ""

        for event: src.domain.entities.AgentEvent in events:
            scopes[event.scope] += 1
            if event.event_type in ("chat.message", "chat.response"):
                messages += 1
            elif event.event_type == "tool.call":
                tools += 1
            elif event.event_type == "kb.search":
                searches += 1
            ts: str = datetime.datetime.fromtimestamp(event.timestamp, tz=datetime.UTC).isoformat()
            if ts > last_ts:
                last_ts: str = ts

        return src.domain.entities.UserActivity(
            user_id=user_id,
            org_id=events[0].org_id if events else "default",
            total_messages=messages,
            total_tool_calls=tools,
            total_kb_searches=searches,
            last_active=last_ts,
            top_scopes=[s for s, _ in scopes.most_common(5)],
        )


def parse_pubsub_event(data: dict[str, typing.Any]) -> src.domain.entities.AgentEvent:
    """Convert a raw Pub/Sub payload into an AgentEvent."""
    return src.domain.entities.AgentEvent(
        event_type=str(data.get("event_type", "custom")),
        user_id=str(data.get("user_id", "")),
        org_id=str(data.get("org_id", "default")),
        service=str(data.get("service", "")),
        scope=str(data.get("scope", "global")),
        payload={
            k: v
            for k, v in data.items()
            if k not in ("event_type", "user_id", "org_id", "service", "scope", "timestamp")
        },
        timestamp=float(data.get("timestamp", 0)),
    )
