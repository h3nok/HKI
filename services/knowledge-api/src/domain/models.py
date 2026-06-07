"""
Domain Models — Knowledge Platform

Pure data classes with no framework dependencies. These define the
contract between the API layer, domain logic, and storage adapters.

Key Concepts:
    Document    — A source document (policy, SOP, manual) ingested into the platform
    Chunk       — A segment of a document with its embedding vector
    SearchQuery — Inbound search request (natural language + filters)
    SearchResult— A ranked result with relevance score and citation info
    Citation    — A traceable reference back to the source document + location
"""

from __future__ import annotations

import datetime
import enum
import typing

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Document & Chunk — the core storage units
# ═══════════════════════════════════════════════════════════════════════════════


class DocumentStatus(enum.StrEnum):
    """Lifecycle state of an ingested document."""

    PENDING = "pending"  # Queued for processing
    PROCESSING = "processing"  # Currently being chunked/embedded
    PENDING_REVIEW = "pending_review"  # Indexed but hidden until governance publish
    INDEXED = "indexed"  # Legacy searchable status (pre-governance)
    PUBLISHED = "published"  # Governance-approved and searchable
    FAILED = "failed"  # Processing failed
    ARCHIVED = "archived"  # Soft-deleted, not searchable


class DocumentType(enum.StrEnum):
    """Category of source document for filtering and relevance boosting."""

    POLICY = "policy"  # Company policies (return policy, membership terms)
    SOP = "sop"  # Standard operating procedures
    PRODUCT = "product"  # Product specs, datasheets
    FAQ = "faq"  # Frequently asked questions
    TRAINING = "training"  # Training materials
    REPORT = "report"  # Analytics reports, market research
    GENERAL = "general"  # Uncategorized


def _normalize_acl_values(values: list[str]) -> list[str]:
    """Normalize ACL principal/user lists to stable lowercase tokens."""
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
    """Sensitivity level used to decide how strictly a document is gated."""

    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    PRIVILEGED = "privileged"


class DocumentAccessControl(pydantic.BaseModel):
    """Per-document access-control lists for sensitive knowledge."""

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
    def _normalize_acl_list(cls, v: list[str]) -> list[str]:
        return _normalize_acl_values(v)

    def has_explicit_allow_list(self) -> bool:
        return bool(self.allowed_users or self.allowed_groups)


class DocumentMetadata(pydantic.BaseModel):
    """
    Extensible metadata attached to every document.
    Used for filtering, boosting, and citation context.
    """

    title: str = ""
    author: str = ""
    department: str = ""  # e.g., "Merchandising", "Membership", "IT"
    document_type: DocumentType = DocumentType.GENERAL
    source_url: str = ""  # Original location (SharePoint, Confluence, etc.)
    tags: list[str] = pydantic.Field(default_factory=list)
    language: str = "en"
    version: str = "1.0"
    classification: DocumentClassification = DocumentClassification.INTERNAL
    access_control: DocumentAccessControl = pydantic.Field(default_factory=DocumentAccessControl)
    stream_id: str | None = (
        None  # Value stream this document belongs to (tenant-isolation dimension)
    )
    created_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)
    updated_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)
    custom: dict[str, typing.Any] = pydantic.Field(default_factory=dict)

    @pydantic.field_validator("document_type", mode="before")
    @classmethod
    def _normalize_document_type(cls, v: typing.Any) -> typing.Any:
        if isinstance(v, str):
            return v.lower()
        return v


class Document(pydantic.BaseModel):
    """
    A source document in the knowledge base.

    Documents are the top-level container. Each document is split into
    Chunks during ingestion, and chunks carry the embedding vectors
    used for similarity search.
    """

    id: str  # Unique document ID (UUID)
    org_id: str = "default"  # Organization for tenant isolation
    stream_id: str | None = (
        None  # Value stream for cross-org isolation (mirrors metadata.stream_id)
    )
    content: str  # Full text content of the document
    metadata: DocumentMetadata = pydantic.Field(default_factory=DocumentMetadata)
    status: DocumentStatus = DocumentStatus.PENDING
    chunk_count: int = 0  # Number of chunks after processing
    created_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)
    updated_at: datetime.datetime = pydantic.Field(default_factory=_utc_now)


class DepartmentCount(pydantic.BaseModel):
    """Simple label/value pair for department-level document counts."""

    label: str
    value: int


class DocumentFreshnessSummary(pydantic.BaseModel):
    """Freshness buckets used by overview dashboards."""

    current_count: int = 0
    review_count: int = 0
    stale_count: int = 0
    unknown_count: int = 0


class DocumentInventorySummary(pydantic.BaseModel):
    """Aggregated document inventory metrics for dashboard surfaces."""

    total_documents: int = 0
    live_count: int = 0
    pending_review_count: int = 0
    processing_count: int = 0
    archived_count: int = 0
    failed_count: int = 0
    missing_labels_count: int = 0
    top_departments: list[DepartmentCount] = pydantic.Field(default_factory=list)
    freshness: DocumentFreshnessSummary = pydantic.Field(
        default_factory=DocumentFreshnessSummary
    )


class Chunk(pydantic.BaseModel):
    """
    A segment of a document with its embedding vector.

    Chunks are the atomic unit of search. Each chunk contains:
    - The text content (typically 200–800 tokens)
    - An embedding vector for semantic similarity
    - Position info for citation extraction (which part of the document)

    The embedding field is stored as a list of floats. In production,
    this maps to AlloyDB's vector column type for pgvector operations.
    """

    id: str  # Unique chunk ID
    document_id: str  # Parent document reference
    org_id: str = "default"  # Organization for tenant isolation
    content: str  # Text content of this chunk
    embedding: list[float] = pydantic.Field(default_factory=list)  # Dense vector
    position: int = 0  # Ordinal position within the document
    start_char: int = 0  # Character offset in original document
    end_char: int = 0  # End character offset
    token_count: int = 0  # Number of tokens in this chunk
    node_level: int = 0
    source_chunk_ids: list[str] = pydantic.Field(default_factory=list)
    metadata: dict[str, typing.Any] = pydantic.Field(
        default_factory=dict
    )  # Inherited + chunk-level


# ═══════════════════════════════════════════════════════════════════════════════
# Search — query and result types
# ═══════════════════════════════════════════════════════════════════════════════


class SearchMode(enum.StrEnum):
    """Search strategy to use."""

    VECTOR = "vector"  # Pure semantic similarity
    KEYWORD = "keyword"  # Pure BM25 keyword matching
    HYBRID = "hybrid"  # Weighted combination of vector + keyword


class ScoreScale(enum.StrEnum):
    """How a retrieval score should be interpreted by clients."""

    NORMALIZED = "normalized"  # 0.0–1.0 relevance-style score
    RAW_RANK = "raw_rank"  # Raw ranking score (BM25 / ts_rank_cd / similar)


class SearchQuery(pydantic.BaseModel):
    """
    Inbound search request.

    Supports three modes:
    - vector:  Pure embedding-based cosine similarity
    - keyword: BM25 term-frequency ranking
    - hybrid:  Weighted combination (default, recommended)

    Filters narrow results by document metadata before ranking.
    """

    query: str  # Natural language search query
    org_id: str = "default"  # Organization scope for tenant isolation
    mode: SearchMode = SearchMode.HYBRID
    top_k: int = 5  # Number of results to return
    min_score: float = (
        0.0  # Minimum score gate. Vector/hybrid scores are normalized; keyword-mode
        # scores are raw rank values and may exceed 1.0.
    )
    filters: SearchFilters = pydantic.Field(default_factory=lambda: SearchFilters())
    include_content: bool = True  # Whether to return chunk text
    include_citations: bool = True  # Whether to generate citations


class SearchFilters(pydantic.BaseModel):
    """
    Metadata filters applied before ranking.
    All filters are AND-combined.

    value_streams: when non-empty, only documents whose stream_id is in this
    list will be returned.  Enforced at the storage layer — callers should not
    need to think about this; the API route injects it from the caller's JWT.
    """

    document_types: list[DocumentType] = pydantic.Field(default_factory=list)
    departments: list[str] = pydantic.Field(default_factory=list)
    tags: list[str] = pydantic.Field(default_factory=list)
    value_streams: list[str] = pydantic.Field(
        default_factory=list
    )  # JWT-injected scope enforcement
    document_statuses: list[DocumentStatus] = pydantic.Field(
        default_factory=list
    )  # Filter by document status
    caller_user_id: str | None = None
    caller_principals: list[str] = pydantic.Field(default_factory=list)
    date_from: datetime.datetime | None = None
    date_to: datetime.datetime | None = None
    include_summary_nodes: bool = False

    @pydantic.field_validator("caller_principals", mode="before")
    @classmethod
    def _coerce_principals(cls, v: typing.Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [part for part in v.split(",") if part.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(part) for part in v]
        return [str(v)]

    @pydantic.field_validator("caller_principals")
    @classmethod
    def _normalize_principals(cls, v: list[str]) -> list[str]:
        return _normalize_acl_values(v)


class Citation(pydantic.BaseModel):
    """
    A traceable reference back to the source material.

    Citations enable the "Evidence Chips" UI component in the frontend,
    giving users confidence that the agent's response is grounded in
    real organizational knowledge.
    """

    document_id: str  # Source document ID
    document_title: str  # Human-readable title
    chunk_id: str  # Specific chunk referenced
    content_preview: str  # First ~200 chars of the chunk
    relevance_score: float  # Mirrors SearchResult.score; keyword-mode values may exceed 1.0
    relevance_score_scale: ScoreScale = ScoreScale.NORMALIZED
    source_url: str = ""  # Link to original document
    page_or_section: str = ""  # Page number or section heading
    highlight: str = ""  # Specific sentence that matched


class SearchResult(pydantic.BaseModel):
    """
    A single search result combining relevance scoring with citation metadata.
    """

    chunk_id: str
    document_id: str
    content: str  # Chunk text (if include_content=True)
    score: float  # Final rank score. Hybrid/vector are normalized; keyword may exceed 1.0
    score_scale: ScoreScale = ScoreScale.NORMALIZED
    vector_score: float = 0.0  # Component: cosine similarity (0.0–1.0)
    vector_score_scale: ScoreScale = ScoreScale.NORMALIZED
    keyword_score: float = 0.0  # Component: BM25 / ts_rank_cd score (not normalized)
    keyword_score_scale: ScoreScale = ScoreScale.RAW_RANK
    citation: Citation | None = None
    metadata: dict[str, typing.Any] = pydantic.Field(default_factory=dict)


class SearchResponse(pydantic.BaseModel):
    """
    Complete search response returned by the API.
    """

    query: str  # Echo back the original query
    mode: SearchMode  # Which search strategy was used
    results: list[SearchResult] = pydantic.Field(default_factory=list)
    total_results: int = 0  # Total matching (before top_k cutoff)
    citations: list[Citation] = pydantic.Field(default_factory=list)  # Deduplicated citations
    search_time_ms: float = 0.0  # End-to-end search latency


# ═══════════════════════════════════════════════════════════════════════════════
# Ingestion — request/response types for document indexing
# ═══════════════════════════════════════════════════════════════════════════════


class IngestRequest(pydantic.BaseModel):
    """Request to add a document to the knowledge base."""

    content: str  # Raw text content
    metadata: DocumentMetadata = pydantic.Field(default_factory=DocumentMetadata)
    chunk_size: int = 512  # Target tokens per chunk
    chunk_overlap: int = 64  # Token overlap between consecutive chunks


class IngestResponse(pydantic.BaseModel):
    """Result of a document ingestion operation."""

    document_id: str
    status: DocumentStatus
    chunk_count: int
    message: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# Graph Discovery — related concept traversal
# ═══════════════════════════════════════════════════════════════════════════════


class GraphNode(pydantic.BaseModel):
    """A node in the knowledge graph (document or concept)."""

    id: str
    org_id: str = "default"
    label: str
    node_type: str = "document"  # document | concept | entity
    metadata: dict[str, typing.Any] = pydantic.Field(default_factory=dict)


class GraphEdge(pydantic.BaseModel):
    """A relationship between two graph nodes."""

    source_id: str
    target_id: str
    relationship: str  # e.g., "related_to", "references", "supersedes"
    weight: float = 1.0  # Strength of the relationship


class GraphNeighbors(pydantic.BaseModel):
    """Response from a graph traversal query."""

    center_node: GraphNode
    neighbors: list[GraphNode] = pydantic.Field(default_factory=list)
    edges: list[GraphEdge] = pydantic.Field(default_factory=list)
