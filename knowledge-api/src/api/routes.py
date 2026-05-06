"""
API Routes — Vector Store Service

HTTP endpoints for the Knowledge Platform, consumed by the
orchestrator-service for RAG retrieval. All routes require a user JWT
(via the BFF). Service-to-service writes from the pipeline use the
separate internal router (see internal_routes.py).

Endpoints:
    POST /v1/search              — Hybrid search (vector + keyword + filters)
    GET  /v1/documents           — List all indexed documents
    GET  /v1/documents/{id}      — Get document details
    DELETE /v1/documents/{id}    — Remove a document
    GET  /v1/graph/{chunk_id}    — Graph discovery (related content)
    GET  /v1/stats               — Store statistics

Internal (service-to-service, see internal_routes.py):
    POST /v1/internal/store      — Chunk, embed, and index (pipeline-service only)
"""

# ruff: noqa: B008,E501

from __future__ import annotations

import asyncio
import time
import typing

import fastapi
import pydantic

import src.adapters.analytics_client
import src.adapters.embedding_client
import src.core.auth
import src.core.logging
import src.domain.context_shaping
import src.domain.models
import src.domain.protocols

router = fastapi.APIRouter(prefix="/v1", tags=["knowledge"], dependencies=[fastapi.Depends(src.core.auth.verify_request_jwt)])
UNSCOPED_SEARCH_ANALYTICS_SCOPE = "unscoped-search"


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_store(request: fastapi.Request) -> src.domain.protocols.VectorStoreProtocol:
    return request.app.state.vector_store


def _get_embedder(request: fastapi.Request) -> src.adapters.embedding_client.EmbeddingClient:
    return request.app.state.embedding_client


def _get_analytics(request: fastapi.Request) -> src.adapters.analytics_client.AnalyticsClient:
    return request.app.state.analytics


def _get_graph(request: fastapi.Request) -> typing.Any | None:
    """Neo4j knowledge graph (may be None if not configured)."""
    return getattr(request.app.state, "graph", None)


def _caller_stream_scopes(identity: src.core.auth.RequestIdentity) -> list[str]:
    scopes: list[str] = [
        str(scope).strip()
        for scope in (getattr(identity, "scopes", None) or [])
        if str(scope).strip()
    ]
    if scopes:
        return scopes

    scope: str = str(getattr(identity, "scope", "")).strip()
    if scope:
        return [scope]

    raise fastapi.HTTPException(status_code=403, detail="No runtime stream scope provided")


def _caller_acl_principals(identity: src.core.auth.RequestIdentity) -> list[str]:
    principals: set[str] = {
        str(group).strip().lower()
        for group in (getattr(identity, "groups", None) or [])
        if str(group).strip()
    }
    role: str = str(getattr(identity, "role", "")).strip().lower()
    if role:
        principals.add(f"role:{role}")
    return sorted(principals)


# ═══════════════════════════════════════════════════════════════════════════════
# Search
# ═══════════════════════════════════════════════════════════════════════════════


class SearchRequest(pydantic.BaseModel):
    """Inbound search request from the orchestrator."""

    query: str
    mode: src.domain.models.SearchMode = src.domain.models.SearchMode.HYBRID
    top_k: int = 5
    min_score: float = 0.0
    document_types: list[src.domain.models.DocumentType] = pydantic.Field(default_factory=list)
    departments: list[str] = pydantic.Field(default_factory=list)
    tags: list[str] = pydantic.Field(default_factory=list)
    include_content: bool = True
    include_citations: bool = True
    # Reranking — LLM pointwise rescoring of top-k results
    rerank: bool = False
    # Context shaping — post-retrieval optimization
    shape_context: bool = False
    shaping_max_tokens: int = 4096
    shaping_min_relevance: float = 0.35
    shaping_diversity_weight: float = 0.3
    shaping_format: str = "numbered"
    # Test mode — include pending_review documents in results
    include_pending: bool = False


@router.post("/search", response_model=src.domain.models.SearchResponse)
async def search(
    body: SearchRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.models.SearchResponse:
    """
    Execute a hybrid search query across the knowledge base.

    The orchestrator calls this endpoint during the RAG augmentation
    step to retrieve relevant organizational knowledge before generating
    a response. Results include citations for the Evidence Chips UI.

    Flow:
        1. Embed the query text into a vector
        2. Run hybrid search (vector similarity + BM25 keyword)
        3. Rank results using Reciprocal Rank Fusion
        4. Generate citations from source document metadata
        5. Return ranked results with citations

    Returns 200 with SearchResponse on success.
    Returns 500 if the embedding gateway is unreachable.
    """
    _t_start: float = time.perf_counter()
    store = _get_store(request)
    embedder = _get_embedder(request)

    # Build the domain query (org_id + scopes from JWT, never from client body).
    # identity.scopes carries the caller's runtime stream scopes; we forward
    # them directly into SearchFilters so the storage layer can enforce exact
    # stream isolation without additional DB lookups.
    caller_scopes: list[str] = _caller_stream_scopes(identity)
    caller_principals: list[str] = _caller_acl_principals(identity)
    search_query = src.domain.models.SearchQuery(
        query=body.query,
        org_id=identity.org_id,
        mode=body.mode,
        top_k=body.top_k,
        min_score=body.min_score,
        filters=src.domain.models.SearchFilters(
            document_types=body.document_types,
            departments=body.departments,
            tags=body.tags,
            value_streams=caller_scopes,
            caller_user_id=identity.user_id,
            caller_principals=caller_principals,
            # In test mode, also include pending_review documents
            document_statuses=(
                [src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED, src.domain.models.DocumentStatus.PENDING_REVIEW]
                if body.include_pending
                else [src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED]
            ),
        ),
        include_content=body.include_content,
        include_citations=body.include_citations,
    )

    # When using local dev embedder, force keyword mode (hash vectors have no
    # semantic meaning so vector/hybrid search would return random results).
    using_local: typing.Any | bool = getattr(request.app.state, "using_local_embedder", False)
    if using_local and body.mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        search_query.mode = src.domain.models.SearchMode.KEYWORD

    # Generate query embedding for vector/hybrid search
    query_embedding: list[float] | None = None
    if search_query.mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        try:
            query_embedding = await embedder.embed_single(body.query)
        except src.adapters.embedding_client.EmbeddingError as exc:
            src.core.logging.logger.warning(
                "Embedding failed, falling back to keyword search",
                extra={"error": str(exc)},
            )
            search_query.mode = src.domain.models.SearchMode.KEYWORD

    result = await store.search(search_query, query_embedding)

    # ── LLM Reranking (optional, ~200–400 ms) ────────────────────────────
    # Re-scores the top-k candidates using a single Gemini batch call for
    # true semantic relevance, then re-sorts. Disabled in local dev mode
    # (no meaningful embeddings) and when the reranker isn't configured.
    if body.rerank and result.results and not using_local:
        reranker: typing.Any | None = getattr(request.app.state, "reranker", None)
        if reranker is not None:
            try:
                reranked_results = await reranker.rerank(
                    body.query,
                    result.results,
                    top_k=body.top_k,
                )
                result = result.model_copy(update={"results": reranked_results})
            except Exception as exc:
                src.core.logging.logger.warning("Reranker failed, keeping RRF order: %s", exc)

    # ── Context shaping (optional, for agent consumption) ─────────
    shaped_text = None
    shaping_stats = None
    if body.shape_context and result.results and query_embedding:
        shaper = src.domain.context_shaping.ContextShaper()
        scored = [
            src.domain.context_shaping.ScoredChunk(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                content=r.content,
                relevance_score=r.score,
                token_count=max(1, len(r.content) // 4),
                metadata={
                    "title": r.citation.document_title if r.citation else "",
                },
            )
            for r in result.results
        ]
        # Fetch real chunk embeddings for MMR diversity scoring.
        # Falls back to query_embedding for any chunk not found (e.g. deleted).
        raw_chunks = await asyncio.gather(
            *[
                store.get_chunk(
                    r.chunk_id,
                    org_id=identity.org_id,
                    allowed_streams=caller_scopes,
                    user_id=identity.user_id,
                    principals=caller_principals,
                )
                for r in result.results
            ],
            return_exceptions=True,
        )
        chunk_embs = [
            (
                c.embedding
                if (c and not isinstance(c, Exception) and c.embedding)
                else query_embedding
            )
            for c in raw_chunks
        ]
        cfg = src.domain.context_shaping.ShapingConfig(
            max_tokens=body.shaping_max_tokens,
            min_relevance=body.shaping_min_relevance,
            diversity_weight=body.shaping_diversity_weight,
            format=body.shaping_format,
        )
        shaped = shaper.shape(scored, query_embedding, chunk_embs, cfg)
        shaped_text = shaped.text
        shaping_stats = {
            "chunks_received": shaped.chunks_received,
            "chunks_after_gate": shaped.chunks_after_gate,
            "chunks_final": shaped.chunks_final,
            "total_tokens": shaped.total_tokens,
        }

    _duration_ms: float = (time.perf_counter() - _t_start) * 1000

    src.core.logging.logger.info(
        "Search completed",
        extra={
            "query": body.query,
            "mode": result.mode.value,
            "results": result.total_results,
            "time_ms": result.search_time_ms,
            "shaped": body.shape_context,
        },
    )

    # ── Emit kb.search analytics event ───────────────────────────────────
    # tokens_in_context is the CMOS numerator: average this across searches
    # to get Context Memory Optimization Score for the knowledge base.
    _tokens_in_context = (
        shaping_stats["total_tokens"]
        if shaping_stats
        else sum(max(1, len(r.content) // 4) for r in result.results)
    )
    _top_score = result.results[0].score if result.results else 0.0
    _stream_id = identity.scope if identity.scope and identity.scope != "global" else ""
    _analytics_scope = _stream_id or UNSCOPED_SEARCH_ANALYTICS_SCOPE
    analytics_payload = {
        "query_tokens": len(body.query.split()),
        "chunks_returned": result.total_results,
        "tokens_in_context": _tokens_in_context,
        "top_score": round(_top_score, 4),
        "search_mode": result.mode.value,
        "duration_ms": round(_duration_ms, 1),
        "shaped": body.shape_context,
    }
    if _stream_id:
        analytics_payload["stream_id"] = _stream_id
    _get_analytics(request).fire(
        "kb.search",
        org_id=identity.org_id,
        user_id=identity.user_id,
        scope=_analytics_scope,
        payload=analytics_payload,
    )

    # Attach shaping data to response if requested
    if shaped_text is not None:
        # Extend the response dict with shaped context
        resp_dict = result.model_dump()
        resp_dict["shaped_context"] = shaped_text
        resp_dict["shaping_stats"] = shaping_stats
        return resp_dict

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Document Management
# ═══════════════════════════════════════════════════════════════════════════════


class DocumentListResponse(pydantic.BaseModel):
    """Paginated document list."""

    documents: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)
    total: int = 0
    limit: int = 50
    offset: int = 0


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    request: fastapi.Request,
    limit: int = 50,
    offset: int = 0,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> DocumentListResponse:
    """List all indexed documents with pagination (scoped by org)."""
    store = _get_store(request)
    caller_scopes: list[str] = _caller_stream_scopes(identity)
    docs, total = await store.list_documents(
        limit=limit,
        offset=offset,
        org_id=identity.org_id,
        allowed_streams=caller_scopes,
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )

    return DocumentListResponse(
        documents=[
            {
                "id": doc.id,
                "title": doc.metadata.title,
                "type": doc.metadata.document_type.value,
                "department": doc.metadata.department,
                "classification": doc.metadata.classification.value,
                "stream_id": doc.stream_id or doc.metadata.stream_id,
                "status": doc.status.value,
                "chunk_count": doc.chunk_count,
                "created_at": doc.created_at.isoformat(),
            }
            for doc in docs
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/documents/summary",
    response_model=src.domain.models.DocumentInventorySummary,
)
async def document_inventory_summary(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.models.DocumentInventorySummary:
    """Return aggregated document inventory metrics for overview surfaces."""
    store = _get_store(request)
    return await store.document_inventory_summary(
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """Get detailed information about a specific document (scoped by org)."""
    store = _get_store(request)
    doc = await store.get_document(
        document_id,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not doc:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")

    return {
        "id": doc.id,
        "metadata": doc.metadata.model_dump(mode="json"),
        "status": doc.status.value,
        "chunk_count": doc.chunk_count,
        "content_preview": doc.content[:500] + "..." if len(doc.content) > 500 else doc.content,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, str]:
    """Remove a document and all its chunks (scoped by org)."""
    store = _get_store(request)
    deleted = await store.delete_document(
        document_id,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not deleted:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")

    return {"status": "deleted", "document_id": document_id}


class BatchDeleteRequest(pydantic.BaseModel):
    document_ids: list[str] = pydantic.Field(..., min_length=1, max_length=100)


@router.post("/documents/batch-delete")
async def batch_delete_documents(
    body: BatchDeleteRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """Delete multiple documents in one request (max 100)."""
    store = _get_store(request)
    deleted_ids: list[str] = []
    failed_ids: list[str] = []
    caller_scopes: list[str] = _caller_stream_scopes(identity)

    for doc_id in body.document_ids:
        try:
            ok = await store.delete_document(
                doc_id,
                org_id=identity.org_id,
                allowed_streams=caller_scopes,
                user_id=identity.user_id,
                principals=_caller_acl_principals(identity),
            )
            if ok:
                deleted_ids.append(doc_id)
            else:
                failed_ids.append(doc_id)
        except Exception:
            src.core.logging.logger.warning("Failed to delete document %s", doc_id, exc_info=True)
            failed_ids.append(doc_id)

    return {
        "deleted": deleted_ids,
        "failed": failed_ids,
        "total_deleted": len(deleted_ids),
        "total_failed": len(failed_ids),
    }


class UpdateStatusRequest(pydantic.BaseModel):
    status: str = pydantic.Field(
        ...,
        description="New document status: pending_review, published, indexed, archived, pending",
    )


@router.patch("/documents/{document_id}/status")
async def update_document_status(
    document_id: str,
    body: UpdateStatusRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, str]:
    """Update document lifecycle status (archive, restore, etc.)."""
    allowed: set[str] = {"pending_review", "published", "indexed", "archived", "pending"}
    if body.status not in allowed:
        raise fastapi.HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(allowed))}",
        )
    store = _get_store(request)
    updated = await store.update_document_status(
        document_id,
        body.status,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not updated:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")

    return {"status": body.status, "document_id": document_id}


# ── Full Content Export ───────────────────────────────────────────────────────


@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Return full document content (not truncated) for export or reprocessing.
    """
    store = _get_store(request)
    doc = await store.get_document(
        document_id,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not doc:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")

    return {
        "document_id": doc.id,
        "title": doc.metadata.title,
        "content": doc.content,
        "content_length": len(doc.content),
        "word_count": len(doc.content.split()),
        "metadata": doc.metadata.model_dump(mode="json"),
        "status": doc.status.value,
        "chunk_count": doc.chunk_count,
    }


# ── Metadata Update ──────────────────────────────────────────────────────────


class UpdateMetadataRequest(pydantic.BaseModel):
    title: str | None = None
    department: str | None = None
    document_type: str | None = None
    tags: list[str] | None = None
    source_url: str | None = None
    classification: str | None = None
    access_control: dict[str, list[str]] | None = None
    custom: dict[str, typing.Any] | None = None


@router.get("/tags")
async def list_tags(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, list[str]]:
    """Return all unique tags across documents for autocomplete / filtering."""
    store = _get_store(request)
    tags = await store.list_tags(
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    return {"tags": tags}


@router.patch("/documents/{document_id}/metadata")
async def update_document_metadata(
    document_id: str,
    body: UpdateMetadataRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Partially update document metadata (title, department, tags, etc.).
    Only fields that are provided (non-null) will be updated.
    """
    store = _get_store(request)
    doc = await store.get_document(
        document_id,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not doc:
        raise fastapi.HTTPException(status_code=404, detail=f"Document {document_id} not found")

    # Apply partial updates
    updates: dict[str, typing.Any] = {}
    if body.title is not None:
        doc.metadata.title = body.title
        updates["title"] = body.title
    if body.department is not None:
        doc.metadata.department = body.department
        updates["department"] = body.department
    if body.document_type is not None:

        try:
            doc.metadata.document_type = src.domain.models.DocumentType(body.document_type)
        except ValueError as exc:
            raise fastapi.HTTPException(
                status_code=400,
                detail=f"Invalid document_type '{body.document_type}'",
            ) from exc
        updates["document_type"] = body.document_type
    if body.tags is not None:
        doc.metadata.tags = body.tags
        updates["tags"] = body.tags
    if body.source_url is not None:
        doc.metadata.source_url = body.source_url
        updates["source_url"] = body.source_url
    if body.classification is not None:
        from src.domain.models import DocumentClassification

        try:
            doc.metadata.classification = DocumentClassification(body.classification)
        except ValueError as exc:
            raise fastapi.HTTPException(
                status_code=400,
                detail=f"Invalid classification '{body.classification}'",
            ) from exc
        updates["classification"] = doc.metadata.classification.value
    if body.access_control is not None:
        from src.domain.models import DocumentAccessControl

        doc.metadata.access_control = DocumentAccessControl(**body.access_control)
        updates["access_control"] = doc.metadata.access_control.model_dump(mode="json")
    if body.custom is not None:
        next_custom = dict(doc.metadata.custom or {})
        for key, value in body.custom.items():
            if value is None:
                next_custom.pop(key, None)
            else:
                next_custom[key] = value
        doc.metadata.custom = next_custom
        updates["custom"] = doc.metadata.custom

    if not updates:
        raise fastapi.HTTPException(status_code=400, detail="No fields to update")

    # Persist — pass only the changed fields (AlloyDB updates individual columns)
    updated = await store.update_document_metadata(
        document_id,
        updates,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )
    if not updated:
        raise fastapi.HTTPException(status_code=500, detail="Failed to persist metadata update")

    return {
        "document_id": document_id,
        "updated_fields": list(updates.keys()),
        "metadata": doc.metadata.model_dump(mode="json"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Graph Discovery
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/graph/{chunk_id}", response_model=src.domain.models.GraphNeighbors)
async def graph_neighbors(
    chunk_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.models.GraphNeighbors:
    """
    Discover related content via knowledge graph traversal.

    Starting from a specific chunk, returns neighboring chunks/documents
    connected by co-occurrence, cross-reference, or semantic similarity edges.
    Used for "see also" suggestions in the UI.
    """
    store = _get_store(request)
    return await store.get_neighbors(
        chunk_id,
        org_id=identity.org_id,
        allowed_streams=_caller_stream_scopes(identity),
        user_id=identity.user_id,
        principals=_caller_acl_principals(identity),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge Graph — Entity Search (Neo4j)
# ═══════════════════════════════════════════════════════════════════════════════


class EntitySearchRequest(pydantic.BaseModel):
    """Search entities in the knowledge graph."""

    query: str
    entity_type: str | None = None
    limit: int = 20


@router.post("/graph/entities/search")
async def search_entities(
    body: EntitySearchRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Search entities by name in the knowledge graph.

    Returns entities with their connected chunk IDs for
    subsequent RAG retrieval.
    """
    graph: typing.Any | None = _get_graph(request)
    if not graph:
        return {"entities": [], "message": "Knowledge graph not configured"}

    caller_scopes: list[str] = _caller_stream_scopes(identity)
    results = await graph.search_entities(
        org_id=identity.org_id,
        query=body.query,
        entity_type=body.entity_type,
        limit=body.limit,
        stream_ids=caller_scopes,
    )

    return {
        "entities": [
            {
                "id": r.entity_id,
                "name": r.name,
                "type": r.entity_type,
                "org_id": r.org_id,
                "properties": r.properties,
                "connected_chunks": r.connected_chunks,
                "relevance": r.relevance,
            }
            for r in results
        ],
        "total": len(results),
    }


class EntityContextRequest(pydantic.BaseModel):
    """Get entity neighborhood for multi-hop reasoning."""

    entity_name: str
    max_depth: int = 2
    limit: int = 50


@router.post("/graph/entities/context")
async def entity_context(
    body: EntityContextRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Get the neighborhood of an entity — related entities and
    their connecting relationships for multi-hop reasoning.
    """
    graph: typing.Any | None = _get_graph(request)
    if not graph:
        return {"paths": [], "message": "Knowledge graph not configured"}

    caller_scopes: list[str] = _caller_stream_scopes(identity)
    paths = await graph.get_entity_context(
        org_id=identity.org_id,
        entity_name=body.entity_name,
        max_depth=body.max_depth,
        limit=body.limit,
        stream_ids=caller_scopes,
    )

    return {
        "entity": body.entity_name,
        "org_id": identity.org_id,
        "paths": [
            {
                "nodes": p.nodes,
                "relationships": p.relationships,
                "weight": p.total_weight,
            }
            for p in paths
        ],
        "total_paths": len(paths),
    }


@router.get("/graph/stats")
async def graph_stats(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """Knowledge graph statistics scoped to the caller's streams."""
    graph: typing.Any | None = _get_graph(request)
    if not graph:
        return {"message": "Knowledge graph not configured"}

    caller_scopes: list[str] = _caller_stream_scopes(identity)
    return await graph.org_stats(identity.org_id, stream_ids=caller_scopes)


# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge Gaps — agent-detected retrieval failures
# ═══════════════════════════════════════════════════════════════════════════════

_MAX_RECENT_GAPS = 100


class GapReportRequest(pydantic.BaseModel):
    query: str
    gap_description: str
    org_id: str = "default"
    scope: str = ""
    conversation_id: str | None = None


@router.post("/gaps")
async def report_gap(
    body: GapReportRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Record an agent-detected knowledge gap.

    Called fire-and-forget by the orchestrator's corrective RAG when a query
    returns insufficient results even after query rewriting.  Gaps are stored
    in an in-process ring buffer (last 100) and emitted as analytics events.
    """
    import datetime

    gap = {
        "query": body.query,
        "gap_description": body.gap_description,
        "org_id": identity.org_id,
        "scope": body.scope or identity.scope,
        "conversation_id": body.conversation_id,
        "detected_at": datetime.datetime.now(datetime.UTC).isoformat(),
        "user_id": identity.user_id,
    }

    buf: list = request.app.state.recent_gaps
    buf.append(gap)
    if len(buf) > _MAX_RECENT_GAPS:
        del buf[: len(buf) - _MAX_RECENT_GAPS]

    _get_analytics(request).fire(
        "kb.gap_detected",
        org_id=identity.org_id,
        user_id=identity.user_id,
        payload={
            "query": body.query,
            "gap_description": body.gap_description,
            "scope": body.scope or identity.scope,
            "conversation_id": body.conversation_id or "",
        },
    )

    return {"status": "recorded"}


@router.get("/gaps")
async def list_gaps(
    request: fastapi.Request,
    org_id: str | None = None,
    limit: int = 50,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Return recent agent-detected knowledge gaps scoped to the caller's org.

    Results are from the in-process ring buffer — cleared on restart.
    """
    caller_org = identity.org_id
    gaps: list[dict] = [g for g in request.app.state.recent_gaps if g.get("org_id") == caller_org]
    # Most recent first
    gaps = gaps[::-1][:limit]
    return {"gaps": gaps, "total": len(gaps)}


# ═══════════════════════════════════════════════════════════════════════════════
# Feedback — chunk relevance scoring from user thumbs up/down
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/feedback")
async def submit_feedback(
    body: dict[str, typing.Any],
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """
    Record user feedback on agent responses.

    Updates chunk relevance scores so future retrievals improve.
    Called by the BFF when users click thumbs-up/down.
    """
    from src.domain.feedback import FeedbackProcessor, FeedbackRequest

    store = _get_store(request)
    processor = FeedbackProcessor(store)

    fb = FeedbackRequest(
        message_id=body.get("message_id", ""),
        conversation_id=body.get("conversation_id", ""),
        feedback_type=body.get("feedback_type", ""),
        chunk_ids=body.get("chunk_ids", []),
        query=body.get("query", ""),
        user_id=identity.user_id,
        org_id=identity.org_id,
    )
    result = await processor.process(fb)
    return result.model_dump()


# ═══════════════════════════════════════════════════════════════════════════════
# Stats
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/stats")
async def stats(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> dict[str, typing.Any]:
    """Return knowledge base statistics scoped to the caller's org."""
    store = _get_store(request)
    caller_scopes: list[str] = _caller_stream_scopes(identity)
    if hasattr(store, "stats_async"):
        return await store.stats_async(
            org_id=identity.org_id,
            allowed_streams=caller_scopes,
        )
    return store.stats(org_id=identity.org_id, allowed_streams=caller_scopes)
