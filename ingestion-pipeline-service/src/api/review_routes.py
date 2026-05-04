"""
API Routes — Knowledge Manager Review Workflow

Endpoints for the document review lifecycle: submit, review, publish.
Consumed by the Knowledge UI for governance and by the ingestion
pipeline for auto-approve checks.

Endpoints:
    POST /v1/review/submit        — Submit a document for review
    POST /v1/review/decide        — Review a pending document
    POST /v1/review/{id}/publish  — Publish an approved document
    POST /v1/review/{id}/resubmit — Resubmit a rejected document
    POST /v1/review/{id}/assign   — Assign review ownership
    POST /v1/review/{id}/claim    — Claim review ownership
    POST /v1/review/{id}/remind   — Record a reminder for the assignee
    GET  /v1/review/pending       — List pending reviews
    GET  /v1/review/{id}          — Get review record details
"""

from __future__ import annotations

import asyncio
import typing

import fastapi
import httpx

import src.core.auth
import src.core.config
import src.core.logging
import src.domain.review

router = fastapi.APIRouter(
    prefix="/v1/review",
    tags=["review"],
    dependencies=[fastapi.Depends(src.core.auth.verify_request_jwt)],
)

_identity_dependency = fastapi.Depends(src.core.auth.verify_request_jwt)


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_workflow(request: fastapi.Request) -> src.domain.review.ReviewWorkflow:
    return request.app.state.review_workflow


def _caller_scopes(identity: src.core.auth.RequestIdentity) -> list[str]:
    scopes: list[typing.Any] = list(getattr(identity, "scopes", []) or [])
    if scopes:
        return scopes
    scope: str = str(getattr(identity, "scope", "")).strip()
    return [scope] if scope else []


def _identity_org_id(identity: src.core.auth.RequestIdentity) -> str:
    return getattr(identity, "org_id", "") or getattr(identity, "scope", "default")


def _record_visible(
    record: src.domain.review.ReviewRecord,
    identity: src.core.auth.RequestIdentity,
) -> bool:
    scopes: list[str] = _caller_scopes(identity)
    stream_id: typing.Any | None = getattr(record, "stream_id", None) or None
    # "global" scope is a wildcard — grants visibility to all streams
    return bool(stream_id) and ("global" in scopes or stream_id in scopes)


async def _sync_document_status(
    request: fastapi.Request,
    document_id: str,
    status: str,
    identity: src.core.auth.RequestIdentity,
    *,
    max_retries: int = 3,
) -> None:
    """Sync review status into knowledge-api document lifecycle with retry."""
    http: typing.Any | None = getattr(request.app.state, "http", None)
    if http is None:
        return
    headers: dict[str, str] = {}
    service_auth: str | None = request.headers.get("X-Service-Auth")
    auth: str | None = request.headers.get("Authorization")
    if service_auth:
        headers["X-Service-Auth"] = service_auth
    if auth:
        headers["Authorization"] = auth

    for attempt in range(max_retries):
        try:
            resp = await http.patch(
                f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/documents/{document_id}/status",
                json={"status": status},
                headers=headers,
            )
            if resp.status_code < 400:
                return
            src.core.logging.logger.warning(
                "Failed to sync knowledge-api document status",
                extra={
                    "document_id": document_id,
                    "status": status,
                    "http_status": resp.status_code,
                    "attempt": attempt + 1,
                    "org_id": _identity_org_id(identity),
                },
            )
        except Exception as exc:
            src.core.logging.logger.warning(
                "Error syncing knowledge-api document status",
                extra={
                    "document_id": document_id,
                    "status": status,
                    "error": str(exc),
                    "attempt": attempt + 1,
                },
            )
        if attempt < max_retries - 1:
            await asyncio.sleep(0.5 * (2**attempt))


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/submit", response_model=src.domain.review.ReviewRecord, status_code=201)
async def submit_for_review(
    body: src.domain.review.SubmitRequest,
    request: fastapi.Request,
    is_reingestion: bool = False,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Submit a document for review. May auto-approve based on policy."""
    workflow = _get_workflow(request)

    if not body.submitted_by:
        body.submitted_by = identity.name

    record = await workflow.submit(
        request=body,
        org_id=_identity_org_id(identity),
        is_reingestion=is_reingestion,
    )
    await _sync_document_status(
        request=request,
        document_id=record.document_id,
        status="pending_review",
        identity=identity,
    )

    src.core.logging.logger.info(
        "Document submitted for review",
        extra={
            "record_id": record.id,
            "doc_id": record.document_id,
            "status": record.status.value,
            "auto_approved": record.auto_approved,
        },
    )
    return record


@router.post("/decide", response_model=src.domain.review.ReviewRecord)
async def decide_review(
    body: src.domain.review.ReviewRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Apply a review decision (approve / reject / request revision)."""
    workflow = _get_workflow(request)

    if not body.reviewer:
        body.reviewer = identity.name

    current = await request.app.state.review_store.get(body.record_id)
    if current is None:
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")

    try:
        record = await workflow.review(body)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc

    src.core.logging.logger.info(
        "Review decision applied",
        extra={
            "record_id": record.id,
            "decision": body.decision.value,
            "reviewer": body.reviewer,
        },
    )
    return record


@router.post("/{record_id}/publish", response_model=src.domain.review.ReviewRecord)
async def publish_document(
    record_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Publish an approved document (make it searchable)."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None:
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    try:
        record = await workflow.publish(record_id)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc
    await _sync_document_status(
        request=request,
        document_id=record.document_id,
        status="published",
        identity=identity,
    )

    src.core.logging.logger.info("Document published", extra={"record_id": record_id})
    return record


@router.post("/{record_id}/archive", response_model=src.domain.review.ReviewRecord)
async def archive_document(
    record_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Archive a published document (retire it from agent responses)."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None or current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    try:
        record = await workflow.archive(record_id)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc
    await _sync_document_status(
        request=request,
        document_id=record.document_id,
        status="archived",
        identity=identity,
    )
    src.core.logging.logger.info("Document archived", extra={"record_id": record_id})
    return record


@router.post("/{record_id}/resubmit", response_model=src.domain.review.ReviewRecord)
async def resubmit_document(
    record_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Resubmit a rejected or revision-requested document."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None:
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    try:
        record = await workflow.resubmit(record_id)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc
    await _sync_document_status(
        request=request,
        document_id=record.document_id,
        status="pending_review",
        identity=identity,
    )
    return record


@router.post("/{record_id}/assign", response_model=src.domain.review.ReviewRecord)
async def assign_review(
    record_id: str,
    body: src.domain.review.AssignReviewRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Assign ownership of the next review step to a specific person."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None or current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")

    body.record_id = record_id
    if not body.assigned_by:
        body.assigned_by = identity.name

    try:
        record = await workflow.assign(body)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc

    src.core.logging.logger.info(
        "Review assigned",
        extra={
            "record_id": record_id,
            "assignee": body.assignee,
            "assigned_by": body.assigned_by,
        },
    )
    return record


@router.post("/{record_id}/claim", response_model=src.domain.review.ReviewRecord)
async def claim_review(
    record_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Claim ownership of the next review step (self-assign)."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None or current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")

    try:
        record = await workflow.claim(record_id, claimer=identity.name or "unknown")
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc

    src.core.logging.logger.info(
        "Review claimed",
        extra={"record_id": record_id, "claimer": identity.name},
    )
    return record


@router.post("/{record_id}/remind", response_model=src.domain.review.ReviewRecord)
async def remind_review(
    record_id: str,
    body: src.domain.review.ReminderRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Record a follow-up reminder for the current assignee."""
    workflow = _get_workflow(request)
    current = await request.app.state.review_store.get(record_id)
    if current is None or current.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(current, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")

    body.record_id = record_id
    if not body.reminded_by:
        body.reminded_by = identity.name

    try:
        record = await workflow.remind(body)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc

    src.core.logging.logger.info(
        "Review reminder recorded",
        extra={
            "record_id": record_id,
            "assignee": record.assigned_to,
            "reminded_by": body.reminded_by,
        },
    )
    return record


@router.get("/pending", response_model=list[src.domain.review.ReviewRecord])
async def list_pending(
    request: fastapi.Request,
    limit: int = 50,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[src.domain.review.ReviewRecord]:
    """List documents pending review for this organization."""
    workflow = _get_workflow(request)
    rows = await workflow.get_pending(_identity_org_id(identity), limit=limit)
    return [row for row in rows if _record_visible(row, identity)][:limit]


@router.get("/history", response_model=list[src.domain.review.ReviewRecord])
async def list_history(
    request: fastapi.Request,
    limit: int = 100,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[src.domain.review.ReviewRecord]:
    """List review records across all statuses for this organization."""
    workflow = _get_workflow(request)
    statuses = [
        src.domain.review.ReviewStatus.PENDING_REVIEW,
        src.domain.review.ReviewStatus.APPROVED,
        src.domain.review.ReviewStatus.PUBLISHED,
        src.domain.review.ReviewStatus.REJECTED,
        src.domain.review.ReviewStatus.REVISION_REQUESTED,
    ]
    merged: dict[str, src.domain.review.ReviewRecord] = {}
    for status in statuses:
        rows = await workflow.get_by_status(
            _identity_org_id(identity),
            status=status,
            limit=limit,
        )
        for row in rows:
            if not _record_visible(row, identity):
                continue
            current = merged.get(row.document_id)
            if current is None or row.updated_at > current.updated_at:
                merged[row.document_id] = row
    records = list(merged.values())
    records.sort(key=lambda r: r.updated_at, reverse=True)
    return records[:limit]


@router.get("/{record_id}", response_model=src.domain.review.ReviewRecord)
async def get_review_record(
    record_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.review.ReviewRecord:
    """Get a review record by ID."""
    store = request.app.state.review_store
    record = await store.get(record_id)
    if record is None or record.org_id != _identity_org_id(identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    if not _record_visible(record, identity):
        raise fastapi.HTTPException(status_code=404, detail="Review record not found")
    return record


# ── Reconciliation ────────────────────────────────────────────────────────────

# Maps review record statuses to the knowledge-api document status they should produce
_REVIEW_TO_DOC_STATUS: dict[src.domain.review.ReviewStatus, str] = {
    src.domain.review.ReviewStatus.PENDING_REVIEW: "pending_review",
    src.domain.review.ReviewStatus.APPROVED: "pending_review",  # approved but not yet published
    src.domain.review.ReviewStatus.PUBLISHED: "published",
    src.domain.review.ReviewStatus.ARCHIVED: "archived",
}


async def reconcile_review_statuses(
    app_state: typing.Any,
    *,
    org_id: str = "default",
    dry_run: bool = False,
) -> dict[str, typing.Any]:
    """
    Compare review records with knowledge-api document statuses and fix drift.

    This catches the case where a review transition (e.g. publish) succeeded
    in the review store but the sync PATCH to knowledge-api failed.

    Returns a summary of what was found and (optionally) repaired.
    """
    review_store: typing.Any | None = getattr(app_state, "review_store", None)
    if review_store is None:
        return {"error": "review_store not initialized"}

    # Collect all review records across terminal statuses
    statuses_to_check = [
        src.domain.review.ReviewStatus.PUBLISHED,
        src.domain.review.ReviewStatus.ARCHIVED,
        src.domain.review.ReviewStatus.PENDING_REVIEW,
    ]
    all_records: list[src.domain.review.ReviewRecord] = []
    for status in statuses_to_check:
        rows = await review_store.list_by_status(org_id, status=status, limit=200)
        all_records.extend(rows)

    if not all_records:
        return {"checked": 0, "drifted": 0, "repaired": 0}

    # Batch-check document statuses from knowledge-api
    drifted: list[dict[str, str]] = []
    repaired = 0

    try:
        from shared.http_client import create_service_client
    except ImportError:
        src.core.logging.logger.warning("shared.http_client unavailable — skipping reconciliation")
        return {"checked": len(all_records), "drifted": 0, "repaired": 0, "skipped": True}

    async with create_service_client("reconciliation", timeout=5.0) as http:
        for record in all_records:
            expected_status: str | None = _REVIEW_TO_DOC_STATUS.get(record.status)
            if not expected_status:
                continue

            try:
                resp: httpx.Response = await http.get(
                    f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/documents/{record.document_id}",
                )
                if resp.status_code == 404:
                    continue  # Document doesn't exist in knowledge-api (may have been purged)
                if resp.status_code != 200:
                    continue

                doc = resp.json()
                actual_status = doc.get("status", "")

                if actual_status == expected_status:
                    continue

                drift_entry = {
                    "document_id": record.document_id,
                    "title": record.title,
                    "review_status": record.status.value,
                    "expected_doc_status": expected_status,
                    "actual_doc_status": actual_status,
                }
                drifted.append(drift_entry)

                if not dry_run:
                    patch_resp: httpx.Response = await http.patch(
                        f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/documents/{record.document_id}/status",
                        json={"status": expected_status},
                    )
                    if patch_resp.status_code < 400:
                        repaired += 1
                        src.core.logging.logger.info(
                            "Reconciled document status",
                            extra=drift_entry,
                        )
                    else:
                        src.core.logging.logger.warning(
                            "Reconciliation patch failed",
                            extra={**drift_entry, "http_status": patch_resp.status_code},
                        )
            except Exception as exc:
                src.core.logging.logger.warning(
                    "Reconciliation check failed for document",
                    extra={"document_id": record.document_id, "error": str(exc)},
                )

    result = {
        "org_id": org_id,
        "checked": len(all_records),
        "drifted": len(drifted),
        "repaired": repaired,
        "details": drifted[:20],  # cap details to avoid huge payloads
    }
    if drifted:
        src.core.logging.logger.info("Reconciliation complete", extra=result)
    return result


@router.post("/reconcile")
async def reconcile_endpoint(
    request: fastapi.Request,
    dry_run: bool = False,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Reconcile review record statuses with knowledge-api document statuses.

    Finds documents where the review says "published" but knowledge-api
    still shows "pending_review" (or similar drift), and repairs them.

    Pass ?dry_run=true to see what would be repaired without changing anything.
    """
    return await reconcile_review_statuses(
        request.app.state,
        org_id=_identity_org_id(identity),
        dry_run=dry_run,
    )
