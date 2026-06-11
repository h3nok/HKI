"""
Internal Routes — Vector Store Write API

Service-to-service endpoints called exclusively by knowledge-pipeline-service.
NOT exposed to end-users or the BFF.

Endpoints:
    POST /v1/internal/store  — Chunk, embed, and index a processed document

Auth: X-Internal-Token header (shared secret, see config.INTERNAL_SERVICE_TOKEN).
      Token check is skipped when INTERNAL_SERVICE_TOKEN is empty (local dev).

The org_id for multi-tenant isolation comes from the request body (field
``org_id``), since there is no user JWT on service-to-service calls.
"""

from __future__ import annotations

import time
import typing
import uuid

import fastapi
import pydantic

import src.adapters.analytics_client
import src.adapters.embedding_client
import src.core.logging
import src.core.service_auth
import src.domain.chunking
import src.domain.models
import src.domain.protocols

# No global JWT dependency — service token is the only gate.
internal_router = fastapi.APIRouter(prefix="/v1/internal", tags=["internal"])

ServiceIdentityDependency = typing.Annotated[
    src.core.service_auth.ServiceIdentity,
    fastapi.Depends(src.core.service_auth.verify_service_token),
]


# ── Helpers ────────────────────────────────────────────────────────────────


def _get_store(request: fastapi.Request) -> src.domain.protocols.VectorStoreProtocol:
    return request.app.state.vector_store


def _get_embedder(request: fastapi.Request) -> src.adapters.embedding_client.EmbeddingClient:
    return request.app.state.embedding_client


def _get_chunker(request: fastapi.Request) -> src.domain.chunking.BaseChunker:
    return request.app.state.chunker


def _get_analytics(request: fastapi.Request) -> src.adapters.analytics_client.AnalyticsClient:
    return request.app.state.analytics


def _get_graph(request: fastapi.Request) -> typing.Any:
    return getattr(request.app.state, "graph", None)


def _get_extractor(request: fastapi.Request) -> typing.Any:
    return getattr(request.app.state, "entity_extractor", None)


# ── Request Model ─────────────────────────────────────────────────────────


class StoreRequest(pydantic.BaseModel):
    """
    Internal store request from knowledge-pipeline-service.

    Mirrors IngestRequest but adds ``org_id`` and ``stream_id`` for full
    tenant + value-stream isolation.  The pipeline service is responsible
    for supplying the correct org_id / stream_id from the originating JWT.
    """

    org_id: str = pydantic.Field(
        "default", description="Tenant identifier extracted from the originating JWT"
    )
    stream_id: str = pydantic.Field(
        ...,
        min_length=1,
        description="Value stream this document belongs to for runtime isolation.",
    )
    content: str
    metadata: src.domain.models.DocumentMetadata = pydantic.Field(
        default_factory=src.domain.models.DocumentMetadata
    )
    chunk_size: int = 512
    chunk_overlap: int = 64


class InternalSearchRequest(pydantic.BaseModel):
    """Internal search request for service-to-service evaluation runs."""

    query: str
    org_id: str
    mode: src.domain.models.SearchMode = src.domain.models.SearchMode.HYBRID
    top_k: int = 5
    min_score: float = 0.0
    document_types: list[src.domain.models.DocumentType] = pydantic.Field(default_factory=list)
    departments: list[str] = pydantic.Field(default_factory=list)
    tags: list[str] = pydantic.Field(default_factory=list)
    include_content: bool = True
    include_citations: bool = True
    include_pending: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# Store & Search Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@internal_router.post("/search", response_model=src.domain.models.SearchResponse)
async def internal_search(
    body: InternalSearchRequest,
    request: fastapi.Request,
    identity: ServiceIdentityDependency,
) -> src.domain.models.SearchResponse:
    """
    Service-to-service search endpoint used by evaluation gating pipeline.

    Enforces exact org-based tenant isolation.
    """
    store = _get_store(request)
    embedder = _get_embedder(request)

    search_query = src.domain.models.SearchQuery(
        query=body.query,
        org_id=body.org_id,
        mode=body.mode,
        top_k=body.top_k,
        min_score=body.min_score,
        filters=src.domain.models.SearchFilters(
            document_types=body.document_types,
            departments=body.departments,
            tags=body.tags,
            document_statuses=(
                [src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED, src.domain.models.DocumentStatus.PENDING_REVIEW]
                if body.include_pending
                else [src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED]
            ),
        ),
        include_content=body.include_content,
        include_citations=body.include_citations,
    )

    using_local = getattr(request.app.state, "using_local_embedder", False)
    if using_local and body.mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        search_query.mode = src.domain.models.SearchMode.KEYWORD

    query_embedding = None
    if search_query.mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        try:
            query_embedding = await embedder.embed_single(body.query)
        except Exception as exc:
            src.core.logging.logger.warning(
                "Internal search embedding failed, falling back to keyword search",
                extra={"error": str(exc)},
            )
            search_query.mode = src.domain.models.SearchMode.KEYWORD

    result = await store.search(search_query, query_embedding)
    return result

# Store Endpoint
# ═══════════════════════════════════════════════════════════════════════════════


@internal_router.post("/store", response_model=src.domain.models.IngestResponse)
async def store_document(
    body: StoreRequest,
    request: fastapi.Request,
    identity: ServiceIdentityDependency,
) -> src.domain.models.IngestResponse:
    """
    Chunk, embed, and index a document into the vector store.

    Called by knowledge-pipeline-service as the terminal stage (Stage 5)
    after EXTRACT → CLEAN → ENRICH → (optional) CONTEXTUALIZE.

    Processing:
        1. Create a Document record with org-scoped ID
        2. Chunk the text using the configured strategy
        3. Generate embeddings for all chunks via the embedding gateway
        4. Store document + chunks in the vector store
        5. Update the BM25 inverted index for keyword search
        6. Optionally extract entities and populate the knowledge graph
        7. Emit kb.ingest analytics event (fire-and-forget)

    Returns 200 IngestResponse on success.
    Returns 200 with status=failed on embedding or chunking failure (pipeline
    service inspects status field and raises RuntimeError to trigger retry).
    """
    _t_start: float = time.perf_counter()
    store: src.domain.protocols.VectorStoreProtocol = _get_store(request)
    embedder: src.adapters.embedding_client.EmbeddingClient = _get_embedder(request)
    chunker: src.domain.chunking.BaseChunker = _get_chunker(request)

    # org_id and stream_id come from the body — pipeline service owns tenant/stream scoping
    org_id: str = body.org_id or "default"
    doc_id = str(uuid.uuid4())

    # Mirror stream_id on both the document (for fast filter access) and metadata
    # (for serialization / AlloyDB column queries).
    metadata: src.domain.models.DocumentMetadata = body.metadata
    if metadata.stream_id != body.stream_id:
        metadata: src.domain.models.DocumentMetadata = metadata.model_copy(update={"stream_id": body.stream_id})
    custom_metadata: dict[str, Any] = metadata.custom or {}
    retrieval_terms: typing.Any | None = custom_metadata.get("retrieval_terms")
    if not isinstance(retrieval_terms, list):
        retrieval_terms = []

    document = src.domain.models.Document(
        id=doc_id,
        org_id=org_id,
        stream_id=body.stream_id,
        content=body.content,
        metadata=metadata,
        status=src.domain.models.DocumentStatus.PENDING_REVIEW,
    )

    # Chunk the document — honor per-request params if they differ from defaults
    if body.chunk_size != 512 or body.chunk_overlap != 64:
        from src.domain.chunking import SentenceChunker

        chunker = SentenceChunker(target_size=body.chunk_size, overlap=body.chunk_overlap)

    chunks: list[Chunk] = chunker.chunk(
        document_id=doc_id,
        text=body.content,
        metadata={
            "title": metadata.title,
            "type": metadata.document_type.value,
            "stream_id": body.stream_id,
            "source_id": custom_metadata.get("source_id", ""),
            "system_name": custom_metadata.get("system_name", ""),
            "search_text": custom_metadata.get("retrieval_text", ""),
            "search_terms": retrieval_terms,
        },
    )

    if not chunks:
        _get_analytics(request).fire(
            "kb.ingest",
            org_id=org_id,
            scope=body.stream_id,
            payload={
                "document_id": doc_id,
                "chunk_count": 0,
                "status": "failed",
                "error": "no_chunks_produced",
                "stream_id": body.stream_id,
            },
        )
        return src.domain.models.IngestResponse(
            document_id=doc_id,
            status=src.domain.models.DocumentStatus.FAILED,
            chunk_count=0,
            message="No chunks produced — document may be empty",
        )

    # Stage 4 (optional): Contextual Chunk Augmentation
    if getattr(src.core.config.settings, "CONTEXTUAL_RETRIEVAL_ENABLED", False):
        try:
            from src.domain.contextualizer import ContextualChunkAugmentor

            llm_url = src.core.config.settings.EMBEDDING_GATEWAY_URL or None
            augmentor = ContextualChunkAugmentor(
                llm_url=llm_url,
                llm_api_key=src.core.config.settings.EMBEDDING_API_KEY,
                model=getattr(src.core.config.settings, "CONTEXTUAL_RETRIEVAL_MODEL", "gemini-2.0-flash"),
            )
            await augmentor.augment_chunks(body.content, chunks)
            await augmentor.close()
            src.core.logging.logger.info(
                "Contextual Chunk Augmentation completed successfully",
                extra={"document_id": doc_id, "chunk_count": len(chunks)},
            )
        except Exception as exc:
            src.core.logging.logger.warning(
                "Contextual Chunk Augmentation failed (falling back to original chunks)",
                extra={"document_id": doc_id, "error": str(exc)},
            )

    # Generate embeddings
    try:
        chunk_texts: list[str] = [c.content for c in chunks]
        embeddings: list[list[float]] = await embedder.embed(chunk_texts)
        for chunk, embedding in zip(chunks, embeddings, strict=False):
            chunk.embedding = embedding
    except src.adapters.embedding_client.EmbeddingError as exc:
        src.core.logging.logger.error(
            "Failed to embed chunks",
            extra={"document_id": doc_id, "error": str(exc)},
        )
        _get_analytics(request).fire(
            "kb.ingest",
            org_id=org_id,
            scope=body.stream_id,
            payload={
                "document_id": doc_id,
                "chunk_count": len(chunks),
                "status": "failed",
                "error": "embedding_failed",
                "stream_id": body.stream_id,
            },
        )
        return src.domain.models.IngestResponse(
            document_id=doc_id,
            status=src.domain.models.DocumentStatus.FAILED,
            chunk_count=0,
            message=f"Embedding failed: {exc}",
        )

    # Store document and chunks
    await store.store_document(document, chunks)

    # Entity extraction + graph population (non-blocking best-effort)
    graph = _get_graph(request)
    extractor = _get_extractor(request)
    entity_count = 0
    if graph and extractor:
        try:
            for chunk in chunks:
                result = await extractor.extract(chunk.content)
                if result.entities:
                    stats = await graph.upsert_entities(
                        org_id=org_id,
                        entities=result.entities,
                        relationships=result.relationships,
                        chunk_id=chunk.id,
                        document_id=doc_id,
                        stream_id=body.stream_id,
                    )
                    entity_count += stats.get("entities", 0)
            chunk_ids: list[str] = [c.id for c in chunks]
            await graph.link_sequential_chunks(org_id, chunk_ids)
        except Exception as exc:
            src.core.logging.logger.warning(
                "Entity extraction failed (non-fatal)", extra={"doc_id": doc_id, "error": str(exc)}
            )

    _duration_ms: float = (time.perf_counter() - _t_start) * 1000

    src.core.logging.logger.info(
        "Document stored",
        extra={
            "document_id": doc_id,
            "org_id": org_id,
            "stream_id": body.stream_id,
            "chunks": len(chunks),
            "entities": entity_count,
            "title": metadata.title,
            "caller_service": identity.service,
        },
    )

    _get_analytics(request).fire(
        "kb.ingest",
        org_id=org_id,
        scope=body.stream_id,
        payload={
            "document_id": doc_id,
            "chunk_count": len(chunks),
            "entity_count": entity_count,
            "content_length": len(body.content),
            "document_type": metadata.document_type.value,
            "stream_id": body.stream_id,
            "processing_time_ms": round(_duration_ms, 1),
            "status": "indexed",
        },
    )

    return src.domain.models.IngestResponse(
        document_id=doc_id,
        status=src.domain.models.DocumentStatus.PENDING_REVIEW,
        chunk_count=len(chunks),
        message=f"Indexed {len(chunks)} chunks, awaiting review publish",
    )


class InternalUpdateStatusRequest(pydantic.BaseModel):
    status: str
    org_id: str
    stream_id: str


@internal_router.patch("/documents/{document_id}/status")
async def internal_update_document_status(
    document_id: str,
    body: InternalUpdateStatusRequest,
    request: fastapi.Request,
    identity: ServiceIdentityDependency,
) -> dict[str, str]:
    """Internal status update endpoint for service-to-service calls."""
    store = _get_store(request)
    allowed: set[str] = {"pending_review", "published", "indexed", "archived", "pending"}
    if body.status not in allowed:
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(allowed))}",
        )
    updated = await store.update_document_status(
        document_id=document_id,
        status=body.status,
        org_id=body.org_id,
        allowed_streams=[body.stream_id],
    )
    if not updated:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")
    return {"status": body.status, "document_id": document_id}


# ═══════════════════════════════════════════════════════════════════════════════
# RAPTOR Routes (KB-1)
# ═══════════════════════════════════════════════════════════════════════════════

raptor_router = fastapi.APIRouter(prefix="/v1", tags=["raptor"])


class RaptorMetadata(pydantic.BaseModel):
    """Metadata payload for a RAPTOR summary chunk."""

    raptor_level: int
    source_chunks: list[str] = pydantic.Field(default_factory=list)
    strategy: typing.Optional[str] = None


class RaptorStoreRequest(pydantic.BaseModel):
    """Payload to store a newly generated RAPTOR summary chunk."""

    chunk_id: str
    content: str
    embedding: list[float]
    org_id: str
    metadata: RaptorMetadata


@raptor_router.get("/chunks")
async def list_chunks(
    org_id: str,
    request: fastapi.Request,
    identity: ServiceIdentityDependency,
    include_embeddings: bool = False,
) -> dict[str, list[dict[str, typing.Any]]]:
    """
    List all leaf chunks (node_level = 0) for a specific organization.

    Called by the RAPTOR builder during hierarchical summary tree construction.
    """
    store = _get_store(request)
    chunks = await store.list_chunks(org_id=org_id, include_embeddings=include_embeddings)
    return {
        "chunks": [
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "content": chunk.content,
                "embedding": chunk.embedding,
            }
            for chunk in chunks
        ]
    }


@raptor_router.post("/chunks/raptor", status_code=fastapi.status.HTTP_201_CREATED)
async def store_raptor_chunk(
    body: RaptorStoreRequest,
    request: fastapi.Request,
    identity: ServiceIdentityDependency,
) -> dict[str, typing.Any]:
    """
    Store a newly generated high-level summary chunk.

    Called recursively by the RAPTOR builder.
    """
    store = _get_store(request)
    await store.store_raptor_chunk(
        chunk_id=body.chunk_id,
        content=body.content,
        embedding=body.embedding,
        org_id=body.org_id,
        level=body.metadata.raptor_level,
        source_chunk_ids=body.metadata.source_chunks,
    )
    return {
        "status": "success",
        "chunk_id": body.chunk_id,
    }

