"""
API Routes — Knowledge Pipeline Service

HTTP endpoints for document ingestion, consumed by:
    - Admin UI for manual document uploads
    - Scheduled batch jobs for periodic re-ingestion
    - The orchestrator for ad-hoc knowledge updates

Endpoints:
    POST /v1/ingest/text   — Ingest raw text content
    POST /v1/ingest/url    — Ingest content from a web URL
    GET  /v1/jobs          — List all ingestion jobs
    GET  /v1/jobs/{id}     — Get job status and details
"""

from __future__ import annotations

import re
import typing

from ..domain.quality_gates import QualityReport
from ..domain.quality_gates import PIIScanResult
from ..domain.quality_gates import RedactResult
from ..domain.rag_evaluation import RAGEvaluationResult
from ..domain.observability import TraceEvent
from ..domain.observability import TraceEvent
from ..domain.observability import TraceSummary
from ..domain.pre_ingest import PreIngestAnalysis
from ..domain.pre_ingest import PreIngestAnalysis
from ..domain.scheduler import JobType
import fastapi
import httpx
import pydantic

import src.core.auth
import src.core.config
import src.core.logging
import src.domain.models
import src.domain.pipeline
import src.domain.queue_messages

_identity_dependency = fastapi.Depends(src.core.auth.verify_request_jwt)
_ingest_file_field = fastapi.File(..., description="File to upload")
_pre_ingest_file_field = fastapi.File(..., description="File to analyze")

router = fastapi.APIRouter(prefix="/v1")


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_pipeline(request: fastapi.Request) -> src.domain.pipeline.IngestionPipeline:
    return request.app.state.pipeline


def _get_publisher(request: fastapi.Request) -> typing.Any | None:
    """Get the queue publisher (Pub/Sub or in-memory)."""
    return getattr(request.app.state, "publisher", None)


def _extract_bearer_token(request: fastapi.Request) -> str:
    """Extract the raw Bearer token from the Authorization header."""
    auth: str = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else ""


def _caller_scopes(identity: src.core.auth.RequestIdentity) -> list[str]:
    scopes: list[typing.Any] = list(getattr(identity, "scopes", []) or [])
    if scopes:
        return scopes
    scope: str = str(getattr(identity, "scope", "")).strip()
    return [scope] if scope else []


def _job_visible(job: typing.Any, identity: src.core.auth.RequestIdentity) -> bool:
    if getattr(job, "org_id", "default") != identity.org_id:
        return False
    scopes: list[str] = _caller_scopes(identity)
    stream_id: typing.Any | None = getattr(job, "stream_id", None) or None
    # "global" scope is a wildcard — grants visibility to all streams
    return bool(stream_id) and ("global" in scopes or stream_id in scopes)


def _resolve_stream_id(
    identity: src.core.auth.RequestIdentity,
    requested_stream_id: str | None,
) -> str:
    scopes: list[str] = _caller_scopes(identity)
    if not scopes:
        raise fastapi.HTTPException(
            status_code=403,
            detail="No runtime stream scope is configured for this caller",
        )

    normalized: str = (requested_stream_id or "").strip()
    if not normalized:
        raise fastapi.HTTPException(status_code=400, detail="Value stream ID is required")

    # "global" scope acts as a wildcard — grants access to every stream
    if "global" in scopes or normalized in scopes:
        return normalized

    raise fastapi.HTTPException(
        status_code=403,
        detail="Requested stream is not assigned to this caller",
    )


def _parse_csv_tokens(raw: str) -> list[str]:
    return [token.strip() for token in raw.split(",") if token.strip()]


def _build_job_status_response(
    job: src.domain.models.IngestionJob,
) -> src.domain.models.JobStatusResponse:
    stage_order: list[str] = [
        "extracting",
        "cleaning",
        "enriching",
        "chunking",
        "indexing",
        "completed",
    ]
    current_idx = -1

    if job.status in (
        src.domain.models.JobStatus.CANCELLED,
        src.domain.models.JobStatus.COMPLETED,
    ):
        current_idx: int = len(stage_order) - 1
    elif job.status == src.domain.models.JobStatus.FAILED and job.failed_at_stage:
        if job.failed_at_stage in stage_order:
            current_idx: int = stage_order.index(job.failed_at_stage)
    else:
        for i, stage in enumerate(stage_order):
            if job.status.value == stage:
                current_idx: int = i
                break

    stages_completed: list[str] = stage_order[: max(0, current_idx)]
    return src.domain.models.JobStatusResponse(job=job, stages_completed=stages_completed)


# ═══════════════════════════════════════════════════════════════════════════════
# Ingestion Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/ingest/text",
    response_model=src.domain.models.IngestResponse,
    tags=["ingestion"],
    summary="Ingest raw text",
)
async def ingest_text(
    body: src.domain.models.IngestTextRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.models.IngestResponse:
    """
    Ingest raw text content into the knowledge base.

    When PUBSUB_ENABLED: creates a job record, publishes a message to
    Pub/Sub, and returns immediately. A worker pod picks it up.

    When PUBSUB_ENABLED=False: falls back to inline asyncio background
    task (original behavior for local dev).

    Auth: org_id and JWT are forwarded to the vector-store for
    tenant-scoped storage.
    """
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    publisher: typing.Any | None = _get_publisher(request)
    org_id: typing.Any | str = getattr(identity, "org_id", "default")
    auth_token: str = _extract_bearer_token(request)
    stream_id: str = _resolve_stream_id(identity, body.stream_id)

    if not body.content.strip():
        raise fastapi.HTTPException(status_code=400, detail="Content cannot be empty")

    if publisher and src.core.config.settings.PUBSUB_ENABLED:
        # Queue mode: create job + publish message
        from src.domain.models import SourceType

        job: src.domain.models.IngestionJob = await pipeline._create_job(
            source_type=SourceType.TEXT,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags or [],
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            auth_token=auth_token,
            org_id=org_id,
        )
        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
            job_id=job.id,
            org_id=org_id,
            content=body.content,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags or [],
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            chunk_size=body.chunk_size,
            chunk_overlap=body.chunk_overlap,
            chunk_strategy=body.chunk_strategy,
            auth_token=auth_token,
        )
        await publisher.publish(msg)
        result = src.domain.models.IngestResponse(
            job_id=job.id,
            status=job.status,
            title=body.title or "",
            message="Job published to queue for processing",
        )
    else:
        # Inline mode: original behavior
        result: src.domain.models.IngestResponse = await pipeline.ingest_text(
            content=body.content,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags,
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            chunk_size=body.chunk_size,
            chunk_overlap=body.chunk_overlap,
            chunk_strategy=body.chunk_strategy,
            auth_token=auth_token,
            org_id=org_id,
        )

    src.core.logging.logger.info(
        "Text ingestion request",
        extra={
            "job_id": result.job_id,
            "status": result.status.value,
            "org_id": org_id,
            "title": body.title,
            "queued": bool(publisher and src.core.config.settings.PUBSUB_ENABLED),
        },
    )

    return result


@router.post(
    "/ingest/url",
    response_model=src.domain.models.IngestResponse,
    tags=["ingestion"],
    summary="Ingest from URL",
)
async def ingest_url(
    body: src.domain.models.IngestURLRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.models.IngestResponse:
    """
    Fetch content from a URL and ingest into the knowledge base.

    When PUBSUB_ENABLED: publishes to queue. Otherwise inline.
    """
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    publisher: typing.Any | None = _get_publisher(request)
    org_id: typing.Any | str = getattr(identity, "org_id", "default")
    auth_token: str = _extract_bearer_token(request)
    stream_id: str = _resolve_stream_id(identity, body.stream_id)

    if not body.url.strip():
        raise fastapi.HTTPException(status_code=400, detail="URL cannot be empty")

    if publisher and src.core.config.settings.PUBSUB_ENABLED:
        from src.domain.models import SourceType

        job: src.domain.models.IngestionJob = await pipeline._create_job(
            source_type=SourceType.URL,
            source_ref=body.url,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags or [],
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            auth_token=auth_token,
            org_id=org_id,
        )
        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_URL,
            job_id=job.id,
            org_id=org_id,
            url=body.url,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags or [],
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            chunk_size=body.chunk_size,
            chunk_overlap=body.chunk_overlap,
            auth_token=auth_token,
        )
        await publisher.publish(msg)
        result = src.domain.models.IngestResponse(
            job_id=job.id,
            status=job.status,
            title=body.title or body.url,
            message="URL job published to queue",
        )
    else:
        result: src.domain.models.IngestResponse = await pipeline.ingest_url(
            url=body.url,
            title=body.title,
            department=body.department,
            document_type=body.document_type,
            tags=body.tags,
            classification=body.classification,
            access_control=body.access_control,
            stream_id=stream_id,
            chunk_size=body.chunk_size,
            chunk_overlap=body.chunk_overlap,
            auth_token=auth_token,
            org_id=org_id,
        )

    src.core.logging.logger.info(
        "URL ingestion request",
        extra={
            "job_id": result.job_id,
            "status": result.status.value,
            "org_id": org_id,
            "url": body.url,
            "queued": bool(publisher and src.core.config.settings.PUBSUB_ENABLED),
        },
    )

    return result


ALLOWED_EXTENSIONS: set[str] = {"pdf", "docx", "txt", "csv", "md", "markdown"}
MAX_UPLOAD_SIZE: int = src.core.config.settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024


def _effective_upload_limit_mb(requested_mb: int | None) -> int:
    """Return effective upload limit bounded by platform max."""
    if not requested_mb or requested_mb <= 0:
        return src.core.config.settings.MAX_DOCUMENT_SIZE_MB
    return min(requested_mb, src.core.config.settings.MAX_DOCUMENT_SIZE_MB)


@router.post(
    "/ingest/file",
    response_model=src.domain.models.IngestResponse,
    tags=["ingestion"],
    summary="Upload and ingest a file",
)
async def ingest_file(
    request: fastapi.Request,
    file: fastapi.UploadFile = _ingest_file_field,
    title: str = fastapi.Form("", description="Document title"),
    department: str = fastapi.Form("", description="Department"),
    source_ref: str = fastapi.Form("", description="Stable external source identifier"),
    document_type: str = fastapi.Form("general", description="Document type"),
    tags: str = fastapi.Form("", description="Comma-separated tags"),
    classification: str = fastapi.Form("internal", description="Document classification"),
    allowed_users: str = fastapi.Form("", description="Comma-separated allowed user IDs"),
    allowed_groups: str = fastapi.Form("", description="Comma-separated allowed groups"),
    denied_users: str = fastapi.Form("", description="Comma-separated denied user IDs"),
    denied_groups: str = fastapi.Form("", description="Comma-separated denied groups"),
    stream_id: str = fastapi.Form(..., description="Value stream ID for runtime isolation"),
    max_doc_size_mb: int = fastapi.Form(
        0,
        description="Optional stream-aware max document size (MB); bounded by platform max",
    ),
    chunk_size: int = fastapi.Form(512, description="Chunk size in tokens"),
    chunk_overlap: int = fastapi.Form(64, description="Chunk overlap"),
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.models.IngestResponse:
    """
    Upload a file (PDF, DOCX, TXT, CSV, Markdown) and ingest into
    the knowledge base.

    The file is read into memory, text is extracted based on the file
    type, and then processed through the standard ingestion pipeline.
    """
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    org_id: typing.Any | str = getattr(identity, "org_id", "default")
    auth_token: str = _extract_bearer_token(request)
    resolved_stream_id: str = _resolve_stream_id(identity, stream_id)
    try:
        resolved_classification = src.domain.models.DocumentClassification(
            classification.strip().lower()
        )
    except ValueError as exc:
        raise fastapi.HTTPException(
            status_code=400,
            detail=(
                "Invalid classification. Must be one of: internal, "
                "confidential, restricted, privileged"
            ),
        ) from exc
    access_control = src.domain.models.DocumentAccessControl(
        allowed_users=_parse_csv_tokens(allowed_users),
        allowed_groups=_parse_csv_tokens(allowed_groups),
        denied_users=_parse_csv_tokens(denied_users),
        denied_groups=_parse_csv_tokens(denied_groups),
    )

    filename: str = file.filename or "upload"
    ext: str = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise fastapi.HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: .{ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    file_bytes: bytes = await file.read()
    effective_limit_mb: int = _effective_upload_limit_mb(max_doc_size_mb)
    effective_limit_bytes: int = effective_limit_mb * 1024 * 1024
    if len(file_bytes) > effective_limit_bytes:
        raise fastapi.HTTPException(
            status_code=413,
            detail=(
                f"File too large: {len(file_bytes) / (1024 * 1024):.1f}MB "
                f"(limit: {effective_limit_mb}MB)"
            ),
        )

    tag_list: list[str] = [token.strip() for token in tags.split(",") if token.strip()]

    result: src.domain.models.IngestResponse = await pipeline.ingest_file(
        file_bytes=file_bytes,
        filename=filename,
        content_type=file.content_type or "",
        title=title,
        department=department,
        source_ref=source_ref,
        document_type=document_type,
        tags=tag_list,
        classification=resolved_classification,
        access_control=access_control,
        stream_id=resolved_stream_id,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        auth_token=auth_token,
        org_id=org_id,
    )

    src.core.logging.logger.info(
        "File ingestion request",
        extra={
            "job_id": result.job_id,
            "status": result.status.value,
            "org_id": org_id,
            "file_name": filename,
            "size_bytes": len(file_bytes),
        },
    )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Job Management
# ═══════════════════════════════════════════════════════════════════════════════


class JobListResponse(pydantic.BaseModel):
    """Paginated job list."""

    jobs: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)
    total: int = 0


@router.get(
    "/jobs",
    response_model=JobListResponse,
    tags=["jobs"],
    summary="List ingestion jobs",
)
async def list_jobs(
    request: fastapi.Request,
    limit: int = 50,
    offset: int = 0,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> JobListResponse:
    """List ingestion jobs for the caller's org, with pagination."""
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    jobs, total = await pipeline.list_jobs(limit=limit, offset=offset)

    visible_jobs: list[IngestionJob] = [job for job in jobs if _job_visible(job, identity)]

    return JobListResponse(
        jobs=[
            {
                "id": job.id,
                "status": job.status.value,
                "title": job.title,
                "source_type": job.source_type.value,
                "source_ref": job.source_ref,
                "document_id": job.document_id,
                "stream_id": job.stream_id,
                "chunk_count": job.chunk_count,
                "error": job.error,
                "failed_at_stage": job.failed_at_stage,
                "created_at": job.created_at.isoformat(),
                "processing_time_ms": round(job.processing_time_ms, 1),
            }
            for job in visible_jobs
        ],
        total=len(visible_jobs),
    )


@router.get(
    "/jobs/{job_id}",
    response_model=src.domain.models.JobStatusResponse,
    tags=["jobs"],
    summary="Get job details",
)
async def get_job(
    job_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.models.JobStatusResponse:
    """Get detailed status of a specific ingestion job."""
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    job: src.domain.models.IngestionJob | None = await pipeline.get_job(job_id)

    if not job or not _job_visible(job, identity):
        raise fastapi.HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return _build_job_status_response(job)


@router.post(
    "/jobs/{job_id}/cancel",
    response_model=src.domain.models.JobStatusResponse,
    tags=["jobs"],
    summary="Cancel an ingestion job",
)
async def cancel_job(
    job_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.models.JobStatusResponse:
    """Cancel a queued or in-flight ingestion job."""
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    job: src.domain.models.IngestionJob | None = await pipeline.cancel_job(job_id)

    if not job or not _job_visible(job, identity):
        raise fastapi.HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return _build_job_status_response(job)


# ═══════════════════════════════════════════════════════════════════════════════
# Quality Gates
# ═══════════════════════════════════════════════════════════════════════════════


class QualityScoreRequest(pydantic.BaseModel):
    """Request body for quality scoring."""

    text: str = pydantic.Field(..., description="Document text to score")
    title: str = pydantic.Field("", description="Document title")


class QualityScoreResponse(pydantic.BaseModel):
    """Quality gate results."""

    overall_score: float
    completeness: dict[str, typing.Any]
    specificity: dict[str, typing.Any]
    accuracy_signals: dict[str, typing.Any]
    actionability: dict[str, typing.Any]
    readability: dict[str, typing.Any]
    pii_scan: dict[str, typing.Any]
    auto_approve_eligible: bool


@router.post(
    "/quality/score",
    response_model=QualityScoreResponse,
    tags=["quality"],
    summary="Run quality gates on document text",
)
async def quality_score(
    body: QualityScoreRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> QualityScoreResponse:
    """
    Run all quality gates on the given text:
    completeness, specificity, accuracy signals, actionability,
    readability (Flesch-Kincaid), and PII scan.
    """
    from src.domain.quality_gates import score_quality

    report: QualityReport = score_quality(body.text, body.title)
    return QualityScoreResponse(**report.to_dict())


class PIIScanRequest(pydantic.BaseModel):
    """Request body for PII scanning."""

    text: str = pydantic.Field(..., description="Text to scan for PII")


class PIIScanResponse(pydantic.BaseModel):
    """PII scan results."""

    pii_detected: bool
    categories_found: list[str]
    match_count: int
    summary: str


@router.post(
    "/quality/pii-scan",
    response_model=PIIScanResponse,
    tags=["quality"],
    summary="Scan text for PII",
)
async def pii_scan(
    body: PIIScanRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> PIIScanResponse:
    """Scan document text for personally identifiable information."""
    from src.domain.quality_gates import scan_pii

    result: PIIScanResult = scan_pii(body.text)
    return PIIScanResponse(
        pii_detected=result.pii_detected,
        categories_found=result.categories_found,
        match_count=len(result.matches),
        summary=result.summary,
    )


# ── PII Redaction ─────────────────────────────────────────────────────────────


class PIIRedactRequest(pydantic.BaseModel):
    """Request body for PII redaction."""

    text: str = pydantic.Field(..., description="Text to redact PII from")
    categories: list[str] | None = pydantic.Field(
        None,
        description="Only redact these PII categories. If null, redact all.",
    )


class PIIRedactResponse(pydantic.BaseModel):
    """PII redaction result."""

    redacted_text: str
    original_length: int
    redacted_length: int
    redactions_applied: int
    categories_redacted: list[str]


@router.post(
    "/quality/pii-redact",
    response_model=PIIRedactResponse,
    tags=["quality"],
    summary="Redact PII from text",
)
async def pii_redact(
    body: PIIRedactRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> PIIRedactResponse:
    """Replace detected PII with safe placeholder tokens."""
    from src.domain.quality_gates import redact_pii

    result: RedactResult = redact_pii(body.text, categories=body.categories)
    return PIIRedactResponse(
        redacted_text=result.redacted_text,
        original_length=result.original_length,
        redacted_length=result.redacted_length,
        redactions_applied=result.redactions_applied,
        categories_redacted=result.categories_redacted,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Generated Answer Preview
# ═══════════════════════════════════════════════════════════════════════════════


class ChunkInput(pydantic.BaseModel):
    """A single retrieved chunk for answer generation."""

    content: str
    score: float = 0.0
    score_scale: str = "normalized"
    metadata: dict[str, typing.Any] = pydantic.Field(default_factory=dict)


class GenerateAnswerRequest(pydantic.BaseModel):
    """Request to generate a grounded answer from chunks."""

    query: str = pydantic.Field(..., description="User question")
    chunks: list[ChunkInput] = pydantic.Field(
        ...,
        description="Retrieved chunks with content and metadata",
    )


class CitationInfo(pydantic.BaseModel):
    """A citation reference in the generated answer."""

    index: int
    title: str = ""
    score: float = 0.0
    score_scale: str = "normalized"
    document_id: str = ""


class GenerateAnswerResponse(pydantic.BaseModel):
    """Generated answer with citations and confidence."""

    answer: str
    confidence: float
    citations: list[CitationInfo] = pydantic.Field(default_factory=list)
    error: str = ""


@router.post(
    "/generate/answer",
    response_model=GenerateAnswerResponse,
    tags=["generation"],
    summary="Generate a grounded answer from retrieved chunks",
)
async def generate_answer_endpoint(
    body: GenerateAnswerRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> GenerateAnswerResponse:
    """
    Use Gemini to generate a grounded answer from the provided
    retrieved chunks. Returns the answer with inline citations
    and a confidence score.
    """
    from src.adapters.gemini_client import generate_answer

    chunks_dicts = [
        {
            "content": c.content,
            "score": c.score,
            "score_scale": c.score_scale,
            "metadata": c.metadata,
        }
        for c in body.chunks
    ]

    import time as _time

    from src.domain.observability import emit as _obs_emit

    _t0: float = _time.perf_counter()
    result = await generate_answer(body.query, chunks_dicts)
    _elapsed: float = (_time.perf_counter() - _t0) * 1000

    _obs_emit(
        "api.generate_answer",
        duration_ms=_elapsed,
        status="error" if result.get("error") else "ok",
        error=result.get("error", ""),
        metadata={
            "query": body.query[:100],
            "chunk_count": len(chunks_dicts),
            "confidence": result.get("confidence", 0),
        },
    )

    citations: list[CitationInfo] = [CitationInfo(**c) for c in result.get("citations", [])]

    return GenerateAnswerResponse(
        answer=result.get("answer", ""),
        confidence=result.get("confidence", 0.0),
        citations=citations,
        error=result.get("error", ""),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Document Versioning — history, diff, compare
# ═══════════════════════════════════════════════════════════════════════════════


class VersionEntry(pydantic.BaseModel):
    """A single version in the history timeline."""

    id: str
    version: int
    change_type: str
    document_id: str
    diff_summary: str
    content_length: int
    word_count: int
    sha256: str
    created_at: str


class VersionHistoryResponse(pydantic.BaseModel):
    """Version history for a source reference."""

    source_ref: str
    versions: list[VersionEntry]
    total: int


@router.get(
    "/versions/{source_ref:path}",
    response_model=VersionHistoryResponse,
    tags=["versioning"],
    summary="Get version history for a source reference",
)
async def get_version_history(
    source_ref: str,
    request: fastapi.Request,
    limit: int = 50,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> VersionHistoryResponse:
    """Return the version history for a source_ref (URL, filename, etc.)."""
    detector = request.app.state.change_detector
    history = await detector.get_history(
        org_id=identity.org_id,
        source_ref=source_ref,
        limit=limit,
    )
    entries: list[VersionEntry] = [
        VersionEntry(
            id=v.id,
            version=v.version,
            change_type=v.change_type.value,
            document_id=v.document_id,
            diff_summary=v.diff_summary,
            content_length=v.fingerprint.content_length,
            word_count=v.fingerprint.word_count,
            sha256=v.fingerprint.sha256,
            created_at=v.created_at.isoformat(),
        )
        for v in history
    ]
    return VersionHistoryResponse(
        source_ref=source_ref,
        versions=entries,
        total=len(entries),
    )


class DiffRequest(pydantic.BaseModel):
    """Request to compare two text versions."""

    old_text: str = pydantic.Field(..., description="Previous version text")
    new_text: str = pydantic.Field(..., description="Current version text")


class DiffLine(pydantic.BaseModel):
    """A single line in the diff output."""

    type: str  # "added", "removed", "unchanged"
    content: str
    line_number: int | None = None


class DiffResponse(pydantic.BaseModel):
    """Line-by-line diff between two versions."""

    lines: list[DiffLine]
    stats: dict[str, int]  # added_count, removed_count, unchanged_count


@router.post(
    "/versions/diff",
    response_model=DiffResponse,
    tags=["versioning"],
    summary="Compute a line-by-line diff between two text versions",
)
async def compute_diff(
    body: DiffRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> DiffResponse:
    """Compute a unified diff between old and new text."""
    import difflib

    old_lines: list[str] = body.old_text.splitlines(keepends=True)
    new_lines: list[str] = body.new_text.splitlines(keepends=True)

    diff: typing.Iterator[str] = difflib.unified_diff(old_lines, new_lines, n=3)

    result_lines: list[DiffLine] = []
    added = removed = unchanged = 0
    line_num = 0

    for line in diff:
        # Skip diff headers
        if line.startswith("---") or line.startswith("+++"):
            continue
        if line.startswith("@@"):
            # Extract line number from hunk header
            import re as _re

            match: re.Match[str] | None = _re.search(r"\+(\d+)", line)
            if match:
                line_num: int = int(match.group(1)) - 1
            continue

        line_num += 1
        content: str = line.rstrip("\n")

        if line.startswith("+"):
            result_lines.append(DiffLine(type="added", content=content[1:], line_number=line_num))
            added += 1
        elif line.startswith("-"):
            result_lines.append(DiffLine(type="removed", content=content[1:], line_number=line_num))
            removed += 1
        else:
            text: str = content[1:] if content.startswith(" ") else content
            result_lines.append(
                DiffLine(type="unchanged", content=text, line_number=line_num),
            )
            unchanged += 1

    return DiffResponse(
        lines=result_lines,
        stats={"added_count": added, "removed_count": removed, "unchanged_count": unchanged},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Evaluation Suite — RAGAS-style scoring
# ═══════════════════════════════════════════════════════════════════════════════


class EvalDimensionOut(pydantic.BaseModel):
    """Single evaluation dimension output."""

    name: str
    score: float
    rationale: str = ""


class RAGEvalRequest(pydantic.BaseModel):
    """Request to evaluate a RAG response."""

    query: str = pydantic.Field(..., description="Original user question")
    answer: str = pydantic.Field(..., description="Generated answer text")
    chunks: list[ChunkInput] = pydantic.Field(
        ...,
        description="Retrieved context chunks",
    )
    confidence: float = pydantic.Field(
        0.0,
        description="Self-reported confidence from generation",
    )


class RAGEvalResponse(pydantic.BaseModel):
    """RAGAS-style evaluation result."""

    faithfulness: EvalDimensionOut
    relevance: EvalDimensionOut
    context_recall: EvalDimensionOut
    completeness: EvalDimensionOut
    overall_score: float
    grade: str


@router.post(
    "/evaluate/rag",
    response_model=RAGEvalResponse,
    tags=["evaluation"],
    summary="Evaluate a RAG response (RAGAS-style)",
)
async def evaluate_rag_endpoint(
    body: RAGEvalRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> RAGEvalResponse:
    """
    Evaluate a generated answer against four RAGAS dimensions:
    faithfulness, relevance, context recall, and completeness.
    Uses LLM-as-judge when Gemini is available, heuristic fallback otherwise.
    """
    from src.domain.rag_evaluation import evaluate_rag

    chunks_dicts = [
        {"content": c.content, "score": c.score, "metadata": c.metadata}
        for c in body.chunks
    ]

    import time as _time

    from src.domain.observability import emit as _obs_emit

    _t0: float = _time.perf_counter()
    result: RAGEvaluationResult = await evaluate_rag(
        query=body.query,
        answer=body.answer,
        chunks=chunks_dicts,
        confidence=body.confidence,
    )
    _elapsed: float = (_time.perf_counter() - _t0) * 1000

    _obs_emit(
        "api.evaluate_rag",
        duration_ms=_elapsed,
        metadata={
            "grade": result.grade,
            "overall_score": result.overall_score,
            "chunk_count": len(chunks_dicts),
        },
    )

    def _dim(d) -> EvalDimensionOut:
        return EvalDimensionOut(name=d.name, score=d.score, rationale=d.rationale)

    return RAGEvalResponse(
        faithfulness=_dim(result.faithfulness),
        relevance=_dim(result.relevance),
        context_recall=_dim(result.context_recall),
        completeness=_dim(result.completeness),
        overall_score=result.overall_score,
        grade=result.grade,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Chunk Feedback Loop
# ═══════════════════════════════════════════════════════════════════════════════


class ChunkFeedbackRequest(pydantic.BaseModel):
    """Record feedback for chunks that contributed to an answer."""

    signal: str = pydantic.Field(..., pattern="^(up|down)$")
    query: str
    answer: str
    chunk_ids: list[str]
    document_ids: list[str] = pydantic.Field(default_factory=list)
    confidence: float = 0.0
    eval_score: float = 0.0


class ChunkFeedbackResponse(pydantic.BaseModel):
    """Feedback recording result."""

    recorded: int
    message: str


@router.post(
    "/feedback/chunk",
    response_model=ChunkFeedbackResponse,
    tags=["feedback"],
    summary="Record chunk-level feedback",
)
async def record_chunk_feedback(
    body: ChunkFeedbackRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> ChunkFeedbackResponse:
    """Record up/down feedback for chunks that contributed to an answer."""
    processor = request.app.state.feedback_processor
    count = await processor.record_feedback(
        org_id=identity.org_id,
        signal=body.signal,
        query=body.query,
        answer=body.answer,
        chunk_ids=body.chunk_ids,
        document_ids=body.document_ids,
        confidence=body.confidence,
        eval_score=body.eval_score,
    )
    return ChunkFeedbackResponse(
        recorded=count,
        message=f"Recorded {body.signal} for {count} chunks",
    )


class FlaggedChunkOut(pydantic.BaseModel):
    """A chunk with low reputation."""

    chunk_id: str
    document_id: str
    upvotes: int
    downvotes: int
    reputation_score: float


@router.get(
    "/feedback/flagged",
    response_model=list[FlaggedChunkOut],
    tags=["feedback"],
    summary="List chunks flagged by negative feedback",
)
async def get_flagged_chunks(
    request: fastapi.Request,
    threshold: float = 0.4,
    limit: int = 50,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[FlaggedChunkOut]:
    """Return chunks with reputation below the threshold."""
    processor = request.app.state.feedback_processor
    flagged = await processor.get_flagged_chunks(
        org_id=identity.org_id,
        threshold=threshold,
        limit=limit,
    )
    return [
        FlaggedChunkOut(
            chunk_id=r.chunk_id,
            document_id=r.document_id,
            upvotes=r.upvotes,
            downvotes=r.downvotes,
            reputation_score=r.reputation_score,
        )
        for r in flagged
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Observability — trace viewer + summary
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/observability/traces",
    tags=["observability"],
    summary="Get recent operation traces",
)
async def get_traces(
    limit: int = 100,
    operation: str | None = None,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Return recent trace events for the in-app Observability tab.

    Data source is selected by OBSERVABILITY_BACKEND:
    - cache      → local in-memory ring buffer
    - dynatrace  → Dynatrace logs API
    - auto       → Dynatrace when configured, else cache

    On provider failure this endpoint falls back to cache mode.
    """
    from src.domain.observability_provider import get_dashboard_traces

    events: list[TraceEvent] = await get_dashboard_traces(limit=limit, operation=operation)
    return {
        "traces": [e.to_dict() for e in events],
        "total": len(events),
    }


@router.get(
    "/observability/summary",
    tags=["observability"],
    summary="Get aggregated trace statistics",
)
async def get_trace_summary(
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Return aggregated trace statistics for dashboard cards.

    Summary uses the same provider selection/fallback behavior as
    /observability/traces.
    """
    from src.domain.observability_provider import get_dashboard_summary

    summary: TraceSummary = await get_dashboard_summary()
    return summary.to_dict()


# ═══════════════════════════════════════════════════════════════════════════════
# Pre-Ingestion Analysis
# ═══════════════════════════════════════════════════════════════════════════════


class PreIngestRequest(pydantic.BaseModel):
    """Request body for pre-ingestion content analysis."""

    content: str = pydantic.Field(..., min_length=1)
    title: str = pydantic.Field(default="", max_length=256)
    value_stream_description: str = pydantic.Field(default="")


@router.post(
    "/pre-ingest/analyze",
    tags=["ingestion"],
    summary="Analyze content before ingestion",
)
async def pre_ingest_analyze(
    body: PreIngestRequest,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Run the 4-stage AI pipeline as analysis only (no ingestion).

    Stages:
        1. Validate — quality, completeness, PII, readability
        2. Interpret — type, department, tags, entities
        3. Decide — relevance to value stream, recommendation

    Returns structured results per stage with an overall
    pass/fail and confidence score.
    """
    from src.domain.pre_ingest import analyze_content

    if not body.content.strip():
        raise fastapi.HTTPException(
            status_code=400,
            detail="Content cannot be empty",
        )

    analysis: PreIngestAnalysis = await analyze_content(
        text=body.content,
        title=body.title,
        value_stream_description=body.value_stream_description,
        auth_token=identity.raw_token if hasattr(identity, "raw_token") else "",
    )

    src.core.logging.logger.info(
        "Pre-ingest analysis completed",
        extra={
            "overall_pass": analysis.overall_pass,
            "confidence": analysis.overall_confidence,
            "recommendation": analysis.decide.recommendation,
            "doc_type": analysis.interpret.detected_type,
        },
    )

    return analysis.to_dict()


@router.post(
    "/pre-ingest/analyze-file",
    tags=["ingestion"],
    summary="Analyze an uploaded file before ingestion",
)
async def pre_ingest_analyze_file(
    request: fastapi.Request,
    file: fastapi.UploadFile = _pre_ingest_file_field,
    title: str = fastapi.Form("", description="Document title"),
    value_stream_description: str = fastapi.Form(
        "",
        description="Value stream description",
    ),
    max_doc_size_mb: int = fastapi.Form(
        0,
        description="Optional stream-aware max document size (MB); bounded by platform max",
    ),
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Upload a file, extract text, and run the 3-stage AI
    pre-ingest analysis (Validate → Interpret → Decide)
    without actually ingesting.

    Supports: PDF, DOCX, TXT, CSV, Markdown.
    """
    from src.domain.pre_ingest import analyze_content

    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    filename: str = file.filename or "upload"
    ext: str = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise fastapi.HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: .{ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    file_bytes: bytes = await file.read()
    effective_limit_mb: int = _effective_upload_limit_mb(max_doc_size_mb)
    effective_limit_bytes: int = effective_limit_mb * 1024 * 1024
    if len(file_bytes) > effective_limit_bytes:
        raise fastapi.HTTPException(
            status_code=413,
            detail=(
                f"File too large: "
                f"{len(file_bytes) / (1024 * 1024):.1f}MB "
                f"(limit: {effective_limit_mb}MB)"
            ),
        )

    try:
        extracted: src.domain.models.ExtractedContent = pipeline._extract_file(
            file_bytes,
            filename,
            file.content_type or "",
        )
    except ValueError as exc:
        raise fastapi.HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    doc_title: str = title or filename.rsplit(".", 1)[0]
    auth_token = identity.raw_token if hasattr(identity, "raw_token") else ""

    analysis: PreIngestAnalysis = await analyze_content(
        text=extracted.text,
        title=doc_title,
        value_stream_description=value_stream_description,
        auth_token=auth_token,
        filename=filename,
    )

    src.core.logging.logger.info(
        "Pre-ingest file analysis completed",
        extra={
            "file_name": filename,
            "size_bytes": len(file_bytes),
            "overall_pass": analysis.overall_pass,
            "confidence": analysis.overall_confidence,
            "recommendation": analysis.decide.recommendation,
            "doc_type": analysis.interpret.detected_type,
        },
    )

    return analysis.to_dict()


# ═══════════════════════════════════════════════════════════════════════════════
# Scheduled Job Trigger (local dev + manual invocation)
# ═══════════════════════════════════════════════════════════════════════════════


class TriggerJobRequest(pydantic.BaseModel):
    """Manual trigger for a scheduled job."""

    job_type: str  # knowledge_refresh, eval_run, raptor_build, etc.
    payload: dict[str, typing.Any] = pydantic.Field(default_factory=dict)
    org_id: str = "default"


# ═══════════════════════════════════════════════════════════════════════════════
# Document Lifecycle Actions — Reprocess & Refresh
# ═══════════════════════════════════════════════════════════════════════════════


class ReprocessRequest(pydantic.BaseModel):
    """Reprocess an existing document (re-chunk, re-embed, re-index)."""

    document_id: str = pydantic.Field(..., description="Document ID to reprocess")
    chunk_size: int = pydantic.Field(512, ge=64, le=4096)
    chunk_overlap: int = pydantic.Field(64, ge=0, le=512)


class ReprocessResponse(pydantic.BaseModel):
    """Result of a reprocess operation."""

    job_id: str
    document_id: str
    status: str
    message: str


@router.post(
    "/documents/reprocess",
    response_model=ReprocessResponse,
    tags=["lifecycle"],
    summary="Reprocess an existing document",
)
async def reprocess_document(
    body: ReprocessRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> ReprocessResponse:
    """
    Re-run the ingestion pipeline on an existing document.

    Flow:
      1. Fetch full document content from knowledge-api
      2. Delete the old document + chunks from knowledge-api
      3. Re-ingest the content through the standard pipeline
         (Extract → Clean → Enrich → Contextualize → Index)

    Use case: model upgrade, chunk size tuning, metadata re-extraction.
    """
    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    auth_token: str = _extract_bearer_token(request)
    org_id: typing.Any | str = getattr(identity, "org_id", "default")
    api_url: str = src.core.config.settings.KNOWLEDGE_API_URL

    # 1. Fetch full content from knowledge-api
    headers: dict[str, str] = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}
    http = request.app.state.http
    resp = await http.get(
        f"{api_url}/v1/documents/{body.document_id}/content",
        headers=headers,
    )
    if resp.status_code == 404:
        raise fastapi.HTTPException(
            status_code=404,
            detail=f"Document {body.document_id} not found",
        )
    resp.raise_for_status()
    doc_data = resp.json()

    content = doc_data["content"]
    metadata = doc_data.get("metadata", {})
    title = metadata.get("title", "")
    department = metadata.get("department", "")
    document_type = metadata.get("document_type", "general")
    tags = metadata.get("tags", [])

    # 2. Delete old document + chunks
    del_resp = await http.delete(
        f"{api_url}/v1/documents/{body.document_id}",
        headers=headers,
    )
    if del_resp.status_code not in (200, 404):
        src.core.logging.logger.warning(
            "Failed to delete old document before reprocess",
            extra={"document_id": body.document_id, "status": del_resp.status_code},
        )

    # 3. Re-ingest through the standard pipeline
    result: src.domain.models.IngestResponse = await pipeline.ingest_text(
        content=content,
        title=title,
        department=department,
        document_type=document_type,
        tags=tags,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
        auth_token=auth_token,
        org_id=org_id,
    )

    src.core.logging.logger.info(
        "Document reprocess initiated",
        extra={
            "original_document_id": body.document_id,
            "new_job_id": result.job_id,
            "content_length": len(content),
        },
    )

    return ReprocessResponse(
        job_id=result.job_id,
        document_id=body.document_id,
        status="reprocessing",
        message=f"Document queued for reprocessing. New job: {result.job_id}",
    )


class RefreshRequest(pydantic.BaseModel):
    """Refresh a document from its original source URL."""

    document_id: str = pydantic.Field(..., description="Document ID to refresh")
    chunk_size: int = pydantic.Field(512, ge=64, le=4096)
    chunk_overlap: int = pydantic.Field(64, ge=0, le=512)


class RefreshResponse(pydantic.BaseModel):
    """Result of a refresh operation."""

    job_id: str | None = None
    document_id: str
    status: str
    message: str
    content_changed: bool


@router.post(
    "/documents/refresh",
    response_model=RefreshResponse,
    tags=["lifecycle"],
    summary="Refresh a document from its source URL",
)
async def refresh_document(
    body: RefreshRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> RefreshResponse:
    """
    Re-fetch content from the document's original source URL, detect changes,
    and re-ingest if the content has changed.

    Flow:
      1. Fetch document metadata to get source_url
      2. Fetch fresh content from the source URL
      3. Compare with stored content (length + hash)
      4. If changed: delete old → re-ingest new version
      5. If unchanged: return early (no re-ingestion)

    Use case: keep documents in sync with external sources.
    """
    import hashlib

    pipeline: src.domain.pipeline.IngestionPipeline = _get_pipeline(request)
    auth_token: str = _extract_bearer_token(request)
    org_id: typing.Any | str = getattr(identity, "org_id", "default")
    api_url: str = src.core.config.settings.KNOWLEDGE_API_URL

    headers: dict[str, str] = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}
    http = request.app.state.http

    # 1. Fetch existing document content + metadata
    resp = await http.get(
        f"{api_url}/v1/documents/{body.document_id}/content",
        headers=headers,
    )
    if resp.status_code == 404:
        raise fastapi.HTTPException(
            status_code=404,
            detail=f"Document {body.document_id} not found",
        )
    resp.raise_for_status()
    doc_data = resp.json()

    metadata = doc_data.get("metadata", {})
    source_url = metadata.get("source_url", "")
    if not source_url:
        raise fastapi.HTTPException(
            status_code=400,
            detail="Document has no source_url set. Cannot refresh from source.",
        )

    old_content = doc_data["content"]
    old_hash: str = hashlib.sha256(old_content.encode("utf-8")).hexdigest()

    # 2. Fetch fresh content from the source URL
    try:
        import httpx as _httpx

        async with _httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True,
        ) as client:
            url_resp: httpx.Response = await client.get(source_url)
            url_resp.raise_for_status()
            new_content: str = url_resp.text
    except Exception as exc:
        raise fastapi.HTTPException(
            status_code=502,
            detail=f"Failed to fetch content from source URL: {exc}",
        ) from exc

    new_hash: str = hashlib.sha256(new_content.encode("utf-8")).hexdigest()

    # 3. Compare
    if old_hash == new_hash:
        return RefreshResponse(
            document_id=body.document_id,
            status="unchanged",
            message="Source content has not changed. No re-ingestion needed.",
            content_changed=False,
        )

    # 4. Delete old document + chunks
    await http.delete(
        f"{api_url}/v1/documents/{body.document_id}",
        headers=headers,
    )

    # 5. Re-ingest fresh content
    title = metadata.get("title", "")
    department = metadata.get("department", "")
    document_type = metadata.get("document_type", "general")
    tags = metadata.get("tags", [])

    result: src.domain.models.IngestResponse = await pipeline.ingest_text(
        content=new_content,
        title=title,
        department=department,
        document_type=document_type,
        tags=tags,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
        auth_token=auth_token,
        org_id=org_id,
    )

    src.core.logging.logger.info(
        "Document refresh initiated",
        extra={
            "original_document_id": body.document_id,
            "new_job_id": result.job_id,
            "source_url": source_url,
            "old_length": len(old_content),
            "new_length": len(new_content),
        },
    )

    return RefreshResponse(
        job_id=result.job_id,
        document_id=body.document_id,
        status="refreshing",
        message=f"Content changed. New version queued for ingestion. Job: {result.job_id}",
        content_changed=True,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Scheduled Jobs
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/jobs/trigger")
async def trigger_job(
    body: TriggerJobRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict[str, typing.Any]:
    """
    Manually trigger a scheduled job.

    Used for local development and on-demand execution.
    In production, Cloud Scheduler → Pub/Sub handles this automatically.
    """
    from src.domain.scheduler import (
        JobType,
        ScheduledJob,
        create_default_dispatcher,
    )

    try:
        job_type = JobType(body.job_type)
    except ValueError as exc:
        valid: list[str] = [j.value for j in JobType]
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"Unknown job type: {body.job_type}. Valid: {valid}",
        ) from exc

    dispatcher: typing.Any | None = getattr(request.app.state, "dispatcher", None)
    if dispatcher is None:
        dispatcher = create_default_dispatcher()

    job = ScheduledJob(
        job_type=job_type,
        payload=body.payload,
        org_id=identity.org_id,
    )
    result = await dispatcher.dispatch(job)

    src.core.logging.logger.info(
        "Manual job trigger completed",
        extra={
            "job_type": body.job_type,
            "success": result.success,
            "duration_ms": round(result.duration_ms, 1),
        },
    )

    return result.model_dump()
