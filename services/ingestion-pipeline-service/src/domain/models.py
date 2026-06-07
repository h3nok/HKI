"""
Domain Models — Knowledge Pipeline

Defines the data flow through the ingestion pipeline:
    Source → Extract → Clean → Enrich → Chunk → Embed → Store

Each stage produces typed intermediate objects so the pipeline
is observable and debuggable.
"""

from __future__ import annotations

import datetime
import enum
import typing

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Ingestion Job — tracks the lifecycle of a document processing request
# ═══════════════════════════════════════════════════════════════════════════════


class JobStatus(enum.StrEnum):
    """Lifecycle state of an ingestion job."""

    QUEUED = "queued"
    EXTRACTING = "extracting"  # Pulling content from source
    CLEANING = "cleaning"  # Removing HTML, normalizing whitespace
    ENRICHING = "enriching"  # Extracting metadata (entities, dates)
    CHUNKING = "chunking"  # Splitting into segments
    EMBEDDING = "embedding"  # Generating vectors (delegated to vector-store)
    INDEXING = "indexing"  # Storing in vector store
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceType(enum.StrEnum):
    """Type of input source."""

    TEXT = "text"  # Raw text content
    URL = "url"  # Web page URL to scrape
    HTML = "html"  # Raw HTML content
    MARKDOWN = "markdown"  # Markdown content
    FILE = "file"  # Uploaded file (PDF, DOCX, TXT, CSV)


def _normalize_acl_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        token: str = str(value).strip().lower()
        if not token or token in seen:
            continue
        seen.add(token)
        normalized.append(token)
    return normalized


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


class DocumentClassification(enum.StrEnum):
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    PRIVILEGED = "privileged"


class DocumentAccessControl(pydantic.BaseModel):
    allowed_users: list[str] = pydantic.Field(default_factory=list)
    allowed_groups: list[str] = pydantic.Field(default_factory=list)
    denied_users: list[str] = pydantic.Field(default_factory=list)
    denied_groups: list[str] = pydantic.Field(default_factory=list)

    @pydantic.field_validator(
        "allowed_users",
        "allowed_groups",
        "denied_users",
        "denied_groups",
        mode="before",
    )
    @classmethod
    def _coerce_acl_values(cls, v: typing.Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [part for part in v.split(",") if part.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(part) for part in v]
        return [str(v)]

    @pydantic.field_validator("allowed_users", "allowed_groups", "denied_users", "denied_groups")
    @classmethod
    def _normalize_acl_lists(cls, v: list[str]) -> list[str]:
        return _normalize_acl_values(v)


class IngestionJob(pydantic.BaseModel):
    """
    Tracks a single document ingestion through the pipeline.

    Created when a user submits content for ingestion, updated at
    each stage, and finalized with the resulting document_id or error.
    """

    id: str  # Unique job ID (UUID)
    org_id: str = "default"  # Tenant isolation — from JWT
    stream_id: str | None = None  # Legacy rows may be null; new runtime jobs must set a stream
    status: JobStatus = JobStatus.QUEUED
    source_type: SourceType = SourceType.TEXT
    source_ref: str = ""  # URL or filename of the source
    title: str = ""  # Document title (extracted or provided)
    department: str = ""
    document_type: str = "general"
    tags: list[str] = pydantic.Field(default_factory=list)
    classification: DocumentClassification = DocumentClassification.INTERNAL
    access_control: DocumentAccessControl = pydantic.Field(default_factory=DocumentAccessControl)

    # Auth context — forwarded to downstream services
    auth_token: str = pydantic.Field(default="", exclude=True)  # JWT, excluded from serialization

    # Processing results
    document_id: str | None = None  # ID in vector store after indexing
    chunk_count: int = 0
    entity_count: int = 0
    error: str | None = None
    failed_at_stage: str | None = None  # Stage where failure occurred
    evaluation_score: float | None = None

    # Metrics
    raw_size_bytes: int = 0  # Size of raw input
    clean_size_bytes: int = 0  # Size after cleaning
    processing_time_ms: float = 0.0

    # Timestamps
    created_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)
    updated_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)
    completed_at: datetime.datetime | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# Pipeline Stage Outputs
# ═══════════════════════════════════════════════════════════════════════════════


class ExtractedContent(pydantic.BaseModel):
    """Output of the extraction stage — raw text from the source."""

    text: str
    source_type: SourceType
    byte_count: int = 0
    encoding: str = "utf-8"
    metadata: dict[str, typing.Any] = pydantic.Field(default_factory=dict)


class CleanedContent(pydantic.BaseModel):
    """Output of the cleaning stage — normalized, deduplicated text."""

    text: str
    original_length: int = 0
    cleaned_length: int = 0
    changes_applied: list[str] = pydantic.Field(default_factory=list)


class EnrichedMetadata(pydantic.BaseModel):
    """
    Output of the enrichment stage — extracted metadata from content.

    Metadata extraction identifies:
    - Document title (from headings or first line)
    - Dates mentioned in the document
    - Named entities (people, organizations, products)
    - Key topics and categories
    """

    title: str = ""
    detected_language: str = "en"
    dates_mentioned: list[str] = pydantic.Field(default_factory=list)
    entities: list[str] = pydantic.Field(default_factory=list)
    topics: list[str] = pydantic.Field(default_factory=list)
    source_id: str = ""
    system_name: str = ""
    retrieval_terms: list[str] = pydantic.Field(default_factory=list)
    estimated_reading_time_min: float = 0.0
    word_count: int = 0
    sentence_count: int = 0


class ContextualizedChunk(pydantic.BaseModel):
    """
    A chunk of text with Gemini-generated contextual summary.

    The contextualization step is the key value-add of the pipeline:
    each chunk gets a short summary describing how it fits within
    the whole document. This context is prepended to the chunk text
    before embedding, dramatically improving retrieval relevance.

    See: https://arxiv.org/abs/2310.06824 (Contextual Retrieval)
    """

    index: int  # 0-based position in document
    content: str  # Raw chunk text
    context: str = ""  # Gemini-generated context summary
    contextualized_content: str = ""  # context + content (what gets embedded)
    token_count: int = 0


# ═══════════════════════════════════════════════════════════════════════════════
# API Request / Response
# ═══════════════════════════════════════════════════════════════════════════════


class IngestTextRequest(pydantic.BaseModel):
    """Request to ingest raw text content."""

    content: str = pydantic.Field(..., description="The raw text content to ingest")
    title: str = pydantic.Field("", description="Document title (auto-detected if empty)")
    department: str = pydantic.Field("", description="Organizational department for filtering")
    document_type: str = pydantic.Field(
        "general", description="Category: general, policy, faq, procedure, etc."
    )
    tags: list[str] = pydantic.Field(default_factory=list, description="Searchable tags")
    classification: DocumentClassification = pydantic.Field(
        DocumentClassification.INTERNAL,
        description="Sensitivity level: internal, confidential, restricted, privileged",
    )
    access_control: DocumentAccessControl = pydantic.Field(
        default_factory=DocumentAccessControl,
        description="Per-document ACLs: allowed/denied users and groups",
    )
    stream_id: str = pydantic.Field(
        ...,
        description="Value stream identifier for runtime isolation",
    )
    chunk_size: int = pydantic.Field(512, description="Target tokens per chunk", ge=64, le=4096)
    chunk_overlap: int = pydantic.Field(
        64,
        description="Overlap tokens between chunks",
        ge=0,
        le=512,
    )
    chunk_strategy: str = pydantic.Field(
        "sentence",
        description="Strategy: sentence, paragraph, fixed",
    )

    model_config: pydantic.ConfigDict = {
        "json_schema_extra": {
            "examples": [
                {
                    "content": (
                        "HKI's return policy allows members to return most items "
                        "at any time for a full refund. Electronics must be returned "
                        "within 90 days."
                    ),
                    "title": "Return Policy Overview",
                    "department": "Member Services",
                    "document_type": "policy",
                    "tags": ["returns", "refunds", "member-services"],
                    "chunk_size": 512,
                    "chunk_overlap": 64,
                    "chunk_strategy": "sentence",
                }
            ]
        }
    }


class IngestURLRequest(pydantic.BaseModel):
    """Request to ingest content from a web URL."""

    url: str = pydantic.Field(..., description="Web URL to fetch and ingest")
    title: str = pydantic.Field("", description="Document title (auto-detected from page if empty)")
    department: str = pydantic.Field("", description="Organizational department for filtering")
    document_type: str = pydantic.Field(
        "general", description="Category: general, policy, faq, procedure, etc."
    )
    tags: list[str] = pydantic.Field(default_factory=list, description="Searchable tags")
    classification: DocumentClassification = pydantic.Field(
        DocumentClassification.INTERNAL,
        description="Sensitivity level: internal, confidential, restricted, privileged",
    )
    access_control: DocumentAccessControl = pydantic.Field(
        default_factory=DocumentAccessControl,
        description="Per-document ACLs: allowed/denied users and groups",
    )
    stream_id: str = pydantic.Field(
        ...,
        description="Value stream identifier for runtime isolation",
    )
    chunk_size: int = pydantic.Field(512, description="Target tokens per chunk", ge=64, le=4096)
    chunk_overlap: int = pydantic.Field(
        64,
        description="Overlap tokens between chunks",
        ge=0,
        le=512,
    )
    follow_links: bool = pydantic.Field(False, description="Whether to crawl linked pages")

    model_config: pydantic.ConfigDict = {
        "json_schema_extra": {
            "examples": [
                {
                    "url": "https://www.hki.com/membership-conditions.html",
                    "title": "Membership Conditions",
                    "department": "Membership",
                    "document_type": "policy",
                    "tags": ["membership", "terms"],
                }
            ]
        }
    }


class IngestResponse(pydantic.BaseModel):
    """Response after submitting an ingestion request."""

    job_id: str = pydantic.Field(..., description="Unique job ID for tracking")
    status: JobStatus = pydantic.Field(..., description="Current pipeline stage")
    title: str = pydantic.Field("", description="Document title (echoed back for UI display)")
    document_id: str | None = pydantic.Field(
        None, description="Vector store document ID (set on completion)"
    )
    chunk_count: int = pydantic.Field(0, description="Number of chunks indexed")
    message: str = pydantic.Field("", description="Human-readable status message")

    model_config: pydantic.ConfigDict = {
        "json_schema_extra": {
            "examples": [
                {
                    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "status": "queued",
                    "title": "Warehouse Receiving SOP",
                    "document_id": None,
                    "chunk_count": 0,
                    "message": "Job published to queue for processing",
                }
            ]
        }
    }


class JobStatusResponse(pydantic.BaseModel):
    """Detailed status of an ingestion job."""

    job: IngestionJob
    stages_completed: list[str] = pydantic.Field(default_factory=list)
