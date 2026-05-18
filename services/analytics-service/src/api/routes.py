"""
API Routes for analytics-service

Endpoints:
    POST /v1/events/ingest   — Pub/Sub push endpoint for agent-events
    GET  /v1/events/recent   — List recent audit events (admin dashboard)
    GET  /v1/events/summary  — Aggregated usage metrics
"""

from __future__ import annotations

import base64
import datetime
import json
import logging
import typing

import fastapi
import hki_runtime
import pydantic

import src.adapters.database
import src.core.auth
import src.core.logging
import src.domain.entities
import src.domain.use_cases

logger: logging.Logger = src.core.logging.logger.getChild("routes")

# Main router — auth required for all endpoints
router = fastapi.APIRouter(dependencies=[fastapi.Depends(src.core.auth.verify_request_jwt)])

# Separate router for Pub/Sub push — no JWT auth (Pub/Sub uses OIDC)
events_router = fastapi.APIRouter(prefix="/v1/events", tags=["events"])

RequestIdentityDependency = typing.Annotated[
    src.core.auth.RequestIdentity,
    fastapi.Depends(src.core.auth.verify_request_jwt),
]


def _get_store(request: fastapi.Request) -> src.adapters.database.EventStoreProtocol:
    """Retrieve the event store initialised during app lifespan."""
    store: src.adapters.database.EventStoreProtocol | None = getattr(
        request.app.state,
        "event_store",
        None,
    )
    if store is None:
        raise fastapi.HTTPException(status_code=503, detail="Event store not initialised")
    return store


class PubSubMessage(pydantic.BaseModel):
    """Pub/Sub push delivery wrapper."""

    message: dict[str, typing.Any]
    subscription: str


class DirectEventRequest(pydantic.BaseModel):
    """Direct HTTP event payload — sent by knowledge-api and pipeline-service."""

    event_type: str
    user_id: str = ""
    org_id: str = "default"
    service: str = ""
    scope: str = "global"
    timestamp: float = 0.0
    payload: dict[str, typing.Any] = {}


def _validation_issues(
    issues: tuple[hki_runtime.HkiValidationIssue, ...],
) -> list[dict[str, str]]:
    return [
        {"code": issue.code, "field": issue.field, "message": issue.message}
        for issue: hki_runtime.HkiValidationIssue in issues
    ]


def _audit_timestamp(value: typing.Any) -> float:
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str) and value.strip():
        normalized: str = value.strip().replace("Z", "+00:00")
        try:
            return datetime.datetime.fromisoformat(normalized).timestamp()
        except ValueError:
            return 0.0
    return 0.0


def _agent_event_from_audit_event(
    event: dict[str, typing.Any],
) -> src.domain.entities.AgentEvent:
    source: dict[str, typing.Any] = event.get("source") if isinstance(event.get("source"), dict) else {}
    actor: dict[str, typing.Any] = event.get("actor") if isinstance(event.get("actor"), dict) else {}
    boundary: dict[str, typing.Any] = event.get("boundary") if isinstance(event.get("boundary"), dict) else {}
    operation: dict[str, typing.Any] = event.get("operation") if isinstance(event.get("operation"), dict) else {}

    return src.domain.entities.AgentEvent(
        event_type=str(operation.get("type") or "hki.audit"),
        user_id=str(actor.get("subject_id") or ""),
        org_id=str(boundary.get("org_id") or "default"),
        service=str(source.get("service") or source.get("platform") or ""),
        scope=str(boundary.get("active_domain") or ""),
        payload=event,
        timestamp=_audit_timestamp(event.get("occurred_at")),
        ingested_at=_audit_timestamp(event.get("received_at")),
    )


def _parse_hki_audit_event(body: dict[str, typing.Any]) -> src.domain.entities.AgentEvent:
    validation: hki_runtime.HkiAuditEventValidationResult = hki_runtime.validate_audit_event(body)
    if not validation.ok:
        raise fastapi.HTTPException(
            status_code=422,
            detail={"error": "invalid-hki-audit-event", "issues": _validation_issues(validation.issues)},
        )
    if validation.event is None:
        raise fastapi.HTTPException(status_code=422, detail="invalid-hki-audit-event")
    return _agent_event_from_audit_event(validation.event)


@events_router.post("")
async def ingest_direct_event(
    body: DirectEventRequest,
    request: fastapi.Request,
) -> dict[str, str]:
    """
    Direct HTTP event ingestion — used by services that cannot use Pub/Sub
    (local dev, non-GCP environments) or need low-latency delivery.

    Accepts the same payload structure as the Pub/Sub push endpoint.
    Called by knowledge-api (kb.search, kb.ingest) and
    knowledge-pipeline-service (kb.ingest) to feed CMOS and ingest metrics.
    """
    from src.domain.entities import AgentEvent

    store: src.adapters.database.EventStoreProtocol = _get_store(request)
    event = AgentEvent(
        event_type=body.event_type,
        user_id=body.user_id,
        org_id=body.org_id,
        service=body.service,
        scope=body.scope,
        payload=body.payload,
        timestamp=body.timestamp or 0.0,
    )
    await store.append(event)

    logger.info(
        "Direct event ingested",
        extra={"event_type": event.event_type, "service": event.service},
    )
    return {"status": "ok"}


@events_router.post("/audit")
async def ingest_hki_audit_event(
    body: dict[str, typing.Any],
    request: fastapi.Request,
) -> dict[str, str]:
    """Ingest a native HKI evidence-grade audit event."""
    store: src.adapters.database.EventStoreProtocol = _get_store(request)
    event: src.domain.entities.AgentEvent = _parse_hki_audit_event(body)
    await store.append(event)

    logger.info(
        "HKI audit event ingested",
        extra={"event_type": event.event_type, "scope": event.scope},
    )
    return {"status": "ok", "schema": hki_runtime.HKI_AUDIT_EVENT_SCHEMA}


@events_router.post("/ingest")
async def ingest_event(
    envelope: PubSubMessage,
    request: fastapi.Request,
) -> dict[str, str]:
    """
    Pub/Sub push endpoint — receives agent-events from all services.

    The Pub/Sub subscription pushes JSON envelopes here. Each message
    contains a base64-encoded data payload with the audit event.
    """
    store: src.adapters.database.EventStoreProtocol = _get_store(request)

    raw_data = envelope.message.get("data", "")
    if not raw_data:
        return {"status": "ignored", "reason": "no data"}

    try:
        decoded: str = base64.b64decode(raw_data).decode("utf-8")
        raw_event = json.loads(decoded)
    except Exception as exc: Exception:
        logger.warning("Failed to decode Pub/Sub message", extra={"error": str(exc)})
        return {"status": "error", "reason": "failed to decode Pub/Sub message"}

    if "schema" in raw_event:
        event: src.domain.entities.AgentEvent = _parse_hki_audit_event(raw_event)
    else:
        event: src.domain.entities.AgentEvent = src.domain.use_cases.parse_pubsub_event(raw_event)
    await store.append(event)

    logger.info(
        "Event ingested",
        extra={"event_type": event.event_type, "user_id": event.user_id},
    )

    return {"status": "ok"}


@events_router.get("/recent")
async def recent_events(
    request: fastapi.Request,
    identity: RequestIdentityDependency,
    limit: int = 50,
    event_type: str | None = None,
    user_id: str | None = None,
    org_id: str | None = None,
    stream_id: str | None = None,
    service: str | None = None,
    decision: str | None = None,
) -> dict[str, typing.Any]:
    """
    List recent audit events. Supports scoped filtering for auditor timelines.
    Used by the admin dashboard for real-time audit visibility.
    """
    store: src.adapters.database.EventStoreProtocol = _get_store(request)
    normalized_limit: int = min(max(limit, 1), 500)
    normalized_org_id: str = (org_id or identity.org_id).strip() or identity.org_id
    if normalized_org_id != identity.org_id:
        raise fastapi.HTTPException(status_code=403, detail="Organization access denied")

    normalized_stream_id: str = (stream_id or "").strip()
    if not normalized_stream_id and not hki_runtime.same_domain(identity.scope, "global"):
        normalized_stream_id = identity.scope
    if hki_runtime.same_domain(normalized_stream_id, "global"):
        normalized_stream_id = ""

    if (
        normalized_stream_id
        and not any(hki_runtime.same_domain(scope, "global") for scope in identity.scopes)
        and not any(hki_runtime.same_domain(scope, normalized_stream_id) for scope in identity.scopes)
    ):
        raise fastapi.HTTPException(status_code=403, detail="Stream access denied")

    events: list[src.domain.entities.AgentEvent] = await store.query(
        limit=normalized_limit,
        event_type=event_type,
        user_id=user_id,
        org_id=normalized_org_id,
        stream_id=normalized_stream_id or None,
        service=service,
    )
    if decision:
        normalized_decision: str = decision.strip().lower()
        events = [
            event
            for event: src.adapters.database.AgentEvent in events
            if str(
                (event.payload.get("decision") or {}).get("outcome")
                if isinstance(event.payload.get("decision"), dict)
                else ""
            ).lower()
            == normalized_decision
        ]
    return {
        "events": [
            {
                "event_type": e.event_type,
                "user_id": e.user_id,
                "org_id": e.org_id,
                "service": e.service,
                "scope": e.scope,
                "timestamp": e.timestamp,
                "ingested_at": e.ingested_at,
                "payload": e.payload,
            }
            for e: src.adapters.database.AgentEvent in events
        ],
        "total": len(events),
    }


@events_router.get("/summary")
async def usage_summary(
    request: fastapi.Request,
    identity: RequestIdentityDependency,
    org_id: str | None = None,
    stream_id: str | None = None,
) -> dict[str, typing.Any]:
    """Return aggregated usage metrics scoped to the caller org and stream."""
    store: src.adapters.database.EventStoreProtocol = _get_store(request)
    normalized_org_id: str = (org_id or identity.org_id).strip() or identity.org_id
    if normalized_org_id != identity.org_id:
        raise fastapi.HTTPException(status_code=403, detail="Organization access denied")

    normalized_stream_id: str = (stream_id or "").strip()
    if not normalized_stream_id and identity.scope != "global":
        normalized_stream_id: str = identity.scope
    if normalized_stream_id == "global":
        normalized_stream_id: str = ""

    if (
        normalized_stream_id
        and "global" not in identity.scopes
        and normalized_stream_id not in identity.scopes
    ):
        raise fastapi.HTTPException(status_code=403, detail="Stream access denied")

    summary: src.adapters.database.UsageSummary = await store.summarize(
        org_id=normalized_org_id,
        stream_id=normalized_stream_id or None,
    )
    return {
        "period_start": summary.period_start,
        "period_end": summary.period_end,
        "total_events": summary.total_events,
        "unique_users": summary.unique_users,
        "events_by_type": summary.events_by_type,
        "events_by_service": summary.events_by_service,
        "knowledge": {
            "cmos": summary.cmos,
            "avg_chunks_per_search": summary.avg_chunks_per_search,
            "avg_top_score": summary.avg_top_score,
            "total_ingest_jobs": summary.total_ingest_jobs,
            "ingest_success_rate": summary.ingest_success_rate,
            "avg_ingest_duration_ms": summary.avg_ingest_duration_ms,
            "p95_ingest_duration_ms": summary.p95_ingest_duration_ms,
            "total_chunks_indexed": summary.total_chunks_indexed,
            "ragas_sample_count": summary.ragas_sample_count,
            "ragas_coverage_rate": summary.ragas_coverage_rate,
            "avg_faithfulness": summary.avg_faithfulness,
            "avg_answer_relevancy": summary.avg_answer_relevancy,
            "avg_context_precision": summary.avg_context_precision,
            "avg_context_recall": summary.avg_context_recall,
            "avg_answer_correctness": summary.avg_answer_correctness,
        },
    }


@events_router.get("/usage")
async def token_usage(
    request: fastapi.Request,
    org_id: str | None = None,
    stream_id: str | None = None,
    period: str | None = None,
) -> dict[str, typing.Any]:
    """
    Per-org/stream token usage summary for self-service billing.

    Aggregates llm.usage and embedding.usage events by org_id and stream_id.
    Returns total tokens consumed per model, with estimated cost.
    """
    store: src.adapters.database.EventStoreProtocol = _get_store(request)
    events: list[src.domain.entities.AgentEvent] = await store.query(
        limit=10000,
        event_type=None,
        user_id=None,
    )

    usage_events: list[src.domain.entities.AgentEvent] = [
        e for e: src.adapters.database.AgentEvent in events
        if e.event_type in ("llm.usage", "embedding.usage")
        and (org_id is None or e.org_id == org_id)
    ]

    if stream_id:
        usage_events: list[src.domain.entities.AgentEvent] = [
            e for e: src.adapters.database.AgentEvent in usage_events
            if e.payload.get("stream_id") == stream_id
        ]

    by_model: dict[str, dict[str, int]] = {}
    total_input = 0
    total_output = 0
    total_embedding = 0

    for e: src.adapters.database.AgentEvent in usage_events:
        p: dict[str, typing.Any] = e.payload
        model = p.get("model", "unknown")
        if model not in by_model:
            by_model[model] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "embedding_tokens": 0,
                "calls": 0,
            }

        if e.event_type == "llm.usage":
            by_model[model]["input_tokens"] += p.get("input_tokens", 0)
            by_model[model]["output_tokens"] += p.get("output_tokens", 0)
            total_input += p.get("input_tokens", 0)
            total_output += p.get("output_tokens", 0)
        elif e.event_type == "embedding.usage":
            by_model[model]["embedding_tokens"] += p.get("token_count", 0)
            total_embedding += p.get("token_count", 0)

        by_model[model]["calls"] += 1

    return {
        "org_id": org_id or "all",
        "stream_id": stream_id,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_embedding_tokens": total_embedding,
        "total_tokens": total_input + total_output + total_embedding,
        "by_model": by_model,
        "event_count": len(usage_events),
    }
