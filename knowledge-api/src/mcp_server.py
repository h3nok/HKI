"""
MCP Knowledge Server

Exposes the Knowledge Platform via the Model Context Protocol (MCP).
Provides tools for hybrid search, document ingestion, graph discovery,
taxonomy management, and retrieval evaluation.

Implements MCP Streamable HTTP transport with SSE support for
integration with LiteLLM, Kong, and other MCP-compatible gateways.

Architecture:
    This replaces the FastAPI REST interface while preserving all
    core functionality: vector search, document management, knowledge
    graphs, and evaluation metrics.
"""

# ruff: noqa: E501

import asyncio
import logging
import os
import typing
import uuid

import mcp.server.fastmcp as fastmcp
import pydantic

import src.adapters.embedding_client
import src.adapters.vector_store
import src.core.config
import src.domain.chunking
import src.domain.context_shaping
import src.domain.models

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger: logging.Logger = logging.getLogger(__name__)

# Initialize MCP server with Streamable HTTP transport
# stateless_http=True for horizontally scaled stateless runtimes
# json_response=True for optimal performance
mcp: fastmcp.FastMCP[typing.Any] = fastmcp.FastMCP(
    "Knowledge Platform MCP Server",
    instructions=(
        "A comprehensive knowledge management server providing hybrid search, "
        "document ingestion, graph discovery, taxonomy management, and retrieval evaluation "
        "via the Model Context Protocol"
    ),
    stateless_http=True,
    json_response=True,
    host="0.0.0.0",
    port=int(os.environ.get("PORT", src.core.config.settings.SERVICE_PORT)),
)

# Global state for dependencies (initialized on startup)
_embedding_client: src.adapters.embedding_client.EmbeddingClient | None = None
_vector_store: src.adapters.vector_store.VectorStore | None = None
_chunker: src.domain.chunking.SentenceChunker | None = None
_graph = None
_entity_extractor = None
_taxonomy_store = None
_llm_judge = None
_using_local_embedder = False
_MCP_UNSCOPED_STREAM_SENTINEL = "__mcp_no_stream_access__"

SentenceChunker = src.domain.chunking.SentenceChunker


def _normalize_principal_list(values: list[str] | None) -> list[str]:
    return sorted({str(value).strip().lower() for value in (values or []) if str(value).strip()})


def _normalize_stream_scopes(values: list[str] | None) -> list[str]:
    scopes: list[str] = [str(value).strip() for value in (values or []) if str(value).strip()]
    return scopes if scopes else [_MCP_UNSCOPED_STREAM_SENTINEL]


# ═══════════════════════════════════════════════════════════════════════════════
# Initialization
# ═══════════════════════════════════════════════════════════════════════════════


async def initialize_services() -> None:
    """Initialize all services on server startup."""
    global _embedding_client, _vector_store, _chunker
    global _graph, _entity_extractor, _taxonomy_store, _llm_judge
    global _using_local_embedder

    logger.info(
        "Initializing Knowledge Platform MCP Server",
        extra={
            "port": src.core.config.settings.SERVICE_PORT,
            "environment": src.core.config.settings.ENVIRONMENT,
            "embedding_model": src.core.config.settings.EMBEDDING_MODEL,
        },
    )

    # Lazy imports for optional dependencies
    alloydb_vector_store_cls = None
    if src.core.config.settings.ALLOYDB_URL:
        try:
            from src.adapters import alloydb_store

            alloydb_vector_store_cls = alloydb_store.AlloyDBVectorStore
        except ImportError:
            logger.warning("asyncpg not installed — falling back to in-memory store")

    neo4j_knowledge_graph_cls = None
    if src.core.config.settings.NEO4J_URI:
        try:
            from src.adapters import neo4j_graph

            neo4j_knowledge_graph_cls = neo4j_graph.Neo4jKnowledgeGraph
        except ImportError:
            logger.warning("neo4j driver not installed — graph disabled")

    entity_extractor_cls = None
    if src.core.config.settings.ENTITY_EXTRACTION_ENABLED:
        try:
            from src.domain import entity_extraction

            entity_extractor_cls = entity_extraction.EntityExtractor
        except ImportError:
            logger.warning("Entity extraction unavailable")

    # Initialize embedding client
    embedding_client: typing.Any = None
    if src.core.config.settings.ENVIRONMENT == "development":
        try:
            test_client = src.adapters.embedding_client.EmbeddingClient()
            await test_client.embed(["connectivity test"])
            embedding_client = test_client
            logger.info("Using LLM gateway embedder")
        except Exception as exc:
            logger.warning(
                "LLM gateway unavailable, using local dev embedder",
                extra={"error": str(exc)[:200]},
            )
            from src.adapters.local_embedder import LocalDevEmbedder

            embedding_client = LocalDevEmbedder(dimensions=src.core.config.settings.EMBEDDING_DIMENSIONS)

    if embedding_client is None:
        embedding_client = src.adapters.embedding_client.EmbeddingClient()

    _embedding_client = embedding_client
    _chunker = src.domain.chunking.SentenceChunker(target_size=512, overlap=64)

    # Initialize vector store
    if src.core.config.settings.ALLOYDB_URL and alloydb_vector_store_cls is not None:
        vector_store = alloydb_vector_store_cls()
        await vector_store.connect(src.core.config.settings.ALLOYDB_URL)
        logger.info(
            "Using AlloyDB vector store",
            extra={"pool": f"{src.core.config.settings.ALLOYDB_POOL_MIN}-{src.core.config.settings.ALLOYDB_POOL_MAX}"},
        )
    else:
        vector_store = src.adapters.vector_store.VectorStore()
        logger.info("Using in-memory vector store")

    _vector_store = vector_store

    # Initialize Neo4j knowledge graph (optional)
    if src.core.config.settings.NEO4J_URI and neo4j_knowledge_graph_cls is not None:
        graph = neo4j_knowledge_graph_cls()
        await graph.connect(
            uri=src.core.config.settings.NEO4J_URI,
            password=src.core.config.settings.NEO4J_PASSWORD,
            username=src.core.config.settings.NEO4J_USERNAME,
            database=src.core.config.settings.NEO4J_DATABASE,
        )
        _graph = graph
        logger.info("Neo4j knowledge graph connected")

    # Initialize entity extractor (optional)
    if src.core.config.settings.ENTITY_EXTRACTION_ENABLED and entity_extractor_cls is not None:
        extractor = entity_extractor_cls(
            llm_url=src.core.config.settings.EMBEDDING_GATEWAY_URL,
            llm_api_key=src.core.config.settings.EMBEDDING_API_KEY,
            model=src.core.config.settings.ENTITY_EXTRACTION_MODEL,
        )
        _entity_extractor = extractor
        logger.info("Entity extractor initialized")

    # Initialize taxonomy store
    from src.domain.taxonomy import InMemoryTaxonomyStore

    _taxonomy_store = InMemoryTaxonomyStore()

    # Initialize LLM Judge for evaluation
    from src.domain.llm_judge import GeminiJudge

    judge = GeminiJudge(
        llm_url=src.core.config.settings.EMBEDDING_GATEWAY_URL,
        llm_api_key=src.core.config.settings.EMBEDDING_API_KEY,
        model=src.core.config.settings.ENTITY_EXTRACTION_MODEL,
    )
    _llm_judge = judge
    logger.info("LLM Judge initialized for evaluation scoring")

    # Track if using local dev embedder
    from src.adapters.local_embedder import LocalDevEmbedder

    _using_local_embedder = isinstance(embedding_client, LocalDevEmbedder)

    logger.info("Knowledge Platform MCP Server initialized successfully")


async def cleanup_services() -> None:
    """Clean up all services on shutdown."""
    if _llm_judge:
        await _llm_judge.close()
    if _entity_extractor:
        await _entity_extractor.close()
    if _graph:
        await _graph.close()
    if _vector_store and hasattr(_vector_store, "close"):
        await _vector_store.close()
    if _embedding_client:
        await _embedding_client.close()
    logger.info("Knowledge Platform MCP Server stopped")


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Core Search & Ingestion
# ═══════════════════════════════════════════════════════════════════════════════


class SearchInput(pydantic.BaseModel):
    """Input for hybrid knowledge search."""

    query: str = pydantic.Field(description="Natural language search query")
    org_id: str = pydantic.Field(description="Organization ID for tenant isolation")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(
        default_factory=list,
        description="Caller groups/principals such as department:manager",
    )
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )
    mode: str = pydantic.Field(default="hybrid", description="Search mode: vector, keyword, or hybrid")
    top_k: int = pydantic.Field(default=5, description="Number of results to return")
    min_score: float = pydantic.Field(default=0.0, description="Minimum relevance score")
    document_types: list[str] = pydantic.Field(default_factory=list, description="Filter by document types")
    departments: list[str] = pydantic.Field(default_factory=list, description="Filter by departments")
    tags: list[str] = pydantic.Field(default_factory=list, description="Filter by tags")
    shape_context: bool = pydantic.Field(default=False, description="Enable post-retrieval context shaping")
    shaping_max_tokens: int = pydantic.Field(default=4096, description="Max tokens for shaped context")


class SearchResult(pydantic.BaseModel):
    """A single search result with relevance score and citation."""

    chunk_id: str
    document_id: str
    content: str
    score: float
    document_title: str
    document_type: str
    department: str


class SearchOutput(pydantic.BaseModel):
    """Output from knowledge search."""

    results: list[SearchResult]
    total_results: int
    search_time_ms: float
    mode: str
    shaped_context: str | None = None


@mcp.tool()
async def search_knowledge(input: SearchInput) -> SearchOutput:
    """
    Execute a hybrid search query across the knowledge base.

    Combines vector similarity search with keyword matching (BM25) to find
    relevant content. Supports filtering by document type, department, and tags.
    Optionally applies context shaping to optimize results for LLM consumption.

    Args:
        input: Search parameters including query, org_id, and filters

    Returns:
        SearchOutput with ranked results, citations, and optional shaped context
    """
    if not _embedding_client or not _vector_store:
        logger.error("Search failed: services not initialized")
        raise RuntimeError("Search service is temporarily unavailable")

    # Parse search mode
    try:
        mode = src.domain.models.SearchMode(input.mode.lower())
    except ValueError:
        mode = src.domain.models.SearchMode.HYBRID

    # Parse document types
    doc_types = []
    for dt in input.document_types:
        try:
            doc_types.append(src.domain.models.DocumentType(dt.lower()))
        except ValueError:
            logger.warning(f"Invalid document type: {dt}")

    # Build search query
    caller_principals: list[str] = _normalize_principal_list(input.caller_principals)
    search_query = src.domain.models.SearchQuery(
        query=input.query,
        org_id=input.org_id,
        mode=mode,
        top_k=input.top_k,
        min_score=input.min_score,
        filters=src.domain.models.SearchFilters(
            document_types=doc_types,
            departments=input.departments,
            tags=input.tags,
            value_streams=_normalize_stream_scopes(input.value_streams),
            caller_user_id=(input.caller_user_id or "").strip().lower() or None,
            caller_principals=caller_principals,
            document_statuses=[src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED],
        ),
        include_content=True,
        include_citations=True,
    )

    # Force keyword mode if using local dev embedder
    if _using_local_embedder and mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        search_query.mode = src.domain.models.SearchMode.KEYWORD

    # Generate query embedding
    query_embedding: list[float] | None = None
    if search_query.mode in (src.domain.models.SearchMode.VECTOR, src.domain.models.SearchMode.HYBRID):
        try:
            query_embedding = await _embedding_client.embed_single(input.query)
        except src.adapters.embedding_client.EmbeddingError as exc:
            logger.warning(
                "Embedding service failed, falling back to keyword search",
                extra={"error": str(exc), "query_len": len(input.query)},
            )
            search_query.mode = src.domain.models.SearchMode.KEYWORD

    # Execute search
    result = await _vector_store.search(search_query, query_embedding)

    # Build output
    search_results: list[SearchResult] = [
        SearchResult(
            chunk_id=r.chunk_id,
            document_id=r.document_id,
            content=r.content,
            score=r.score,
            document_title=r.citation.document_title if r.citation else r.metadata.get("title", ""),
            document_type=r.metadata.get("type", ""),
            department=r.metadata.get("department", ""),
        )
        for r in result.results
    ]

    # Context shaping (optional)
    shaped_text = None
    if input.shape_context and result.results and query_embedding:
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
        chunk_embs = [query_embedding] * len(scored)
        cfg = src.domain.context_shaping.ShapingConfig(
            max_tokens=input.shaping_max_tokens,
            format="numbered",
        )
        shaped = shaper.shape(scored, query_embedding, chunk_embs, cfg)
        shaped_text = shaped.text

    logger.info(
        "Search completed",
        extra={
            "query": input.query,
            "org_id": input.org_id,
            "results": result.total_results,
            "time_ms": result.search_time_ms,
        },
    )

    return SearchOutput(
        results=search_results,
        total_results=result.total_results,
        search_time_ms=result.search_time_ms,
        mode=result.mode.value,
        shaped_context=shaped_text,
    )


class IngestInput(pydantic.BaseModel):
    """Input for document ingestion."""

    content: str = pydantic.Field(description="Full text content of the document")
    org_id: str = pydantic.Field(description="Organization ID for tenant isolation")
    title: str = pydantic.Field(default="", description="Document title")
    author: str = pydantic.Field(default="", description="Document author")
    department: str = pydantic.Field(default="", description="Department or team")
    document_type: str = pydantic.Field(
        default="general", description="Document type (policy, sop, faq, etc.)"
    )
    source_url: str = pydantic.Field(default="", description="Original source URL")
    tags: list[str] = pydantic.Field(default_factory=list, description="Document tags")
    classification: str = pydantic.Field(
        default="internal",
        description="Sensitivity level: internal, confidential, restricted, privileged",
    )
    access_control: src.domain.models.DocumentAccessControl = pydantic.Field(
        default_factory=src.domain.models.DocumentAccessControl,
        description="Per-document ACLs for users and groups",
    )
    stream_id: str = pydantic.Field(
        min_length=1,
        description="Required value stream scope for the document",
    )


class IngestOutput(pydantic.BaseModel):
    """Output from document ingestion."""

    document_id: str
    status: str
    chunk_count: int
    message: str


@mcp.tool()
async def ingest_document(input: IngestInput) -> IngestOutput:
    """
    Ingest a document into the knowledge base.

    Processing pipeline:
    1. Create a Document record with metadata
    2. Chunk the text using sentence-based chunking
    3. Generate embeddings for all chunks
    4. Store document and chunks in vector store
    5. Extract entities and build graph relationships (if enabled)

    Args:
        input: Document content and metadata

    Returns:
        IngestOutput with document ID, status, and chunk count
    """
    if not _embedding_client or not _vector_store or not _chunker:
        logger.error("Ingest failed: services not initialized")
        raise RuntimeError("Ingestion service is temporarily unavailable")

    # Parse document type
    try:
        doc_type = src.domain.models.DocumentType(input.document_type.lower())
    except ValueError:
        doc_type = src.domain.models.DocumentType.GENERAL
    try:
        classification = src.domain.models.DocumentClassification(input.classification.lower())
    except ValueError:
        classification = src.domain.models.DocumentClassification.INTERNAL

    # Create document
    doc_id = str(uuid.uuid4())
    document = src.domain.models.Document(
        id=doc_id,
        org_id=input.org_id,
        stream_id=input.stream_id,
        content=input.content,
        metadata=src.domain.models.DocumentMetadata(
            title=input.title,
            author=input.author,
            department=input.department,
            document_type=doc_type,
            source_url=input.source_url,
            tags=input.tags,
            classification=classification,
            access_control=input.access_control,
            stream_id=input.stream_id,
        ),
        status=src.domain.models.DocumentStatus.PROCESSING,
    )

    # Chunk the document
    chunks = _chunker.chunk(
        document_id=doc_id,
        text=input.content,
        metadata={
            "title": input.title,
            "type": doc_type.value,
            "stream_id": input.stream_id or "",
        },
    )

    if not chunks:
        return IngestOutput(
            document_id=doc_id,
            status=src.domain.models.DocumentStatus.FAILED.value,
            chunk_count=0,
            message="No chunks produced — document may be empty",
        )

    # Generate embeddings
    try:
        chunk_texts = [c.content for c in chunks]
        embeddings = await _embedding_client.embed(chunk_texts)
        for chunk, embedding in zip(chunks, embeddings, strict=False):
            chunk.embedding = embedding
    except src.adapters.embedding_client.EmbeddingError as exc:
        logger.error(
            "Failed to embed document chunks",
            extra={"error": str(exc), "document_id": doc_id, "chunk_count": len(chunks)},
        )
        return IngestOutput(
            document_id=doc_id,
            status=src.domain.models.DocumentStatus.FAILED.value,
            chunk_count=0,
            message="Document processing failed",
        )

    # Store document and chunks
    await _vector_store.store_document(document, chunks)

    # Entity extraction + graph population (best-effort)
    entity_count = 0
    if _graph and _entity_extractor:
        try:
            for chunk in chunks:
                result = await _entity_extractor.extract(chunk.content)
                if result.entities:
                    stats = await _graph.upsert_entities(
                        org_id=input.org_id,
                        entities=result.entities,
                        relationships=result.relationships,
                        chunk_id=chunk.id,
                        document_id=doc_id,
                    )
                    entity_count += stats.get("entities", 0)
            # Link sequential chunks
            chunk_ids = [c.id for c in chunks]
            await _graph.link_sequential_chunks(input.org_id, chunk_ids)
        except Exception as exc:
            logger.warning(
                "Entity extraction failed (non-fatal)",
                extra={"error": str(exc), "document_id": doc_id},
            )

    logger.info(
        "Document ingested",
        extra={
            "document_id": doc_id,
            "org_id": input.org_id,
            "chunks": len(chunks),
            "entities": entity_count,
            "title": input.title,
        },
    )

    return IngestOutput(
        document_id=doc_id,
        status=src.domain.models.DocumentStatus.INDEXED.value,
        chunk_count=len(chunks),
        message=f"Indexed {len(chunks)} chunks, {entity_count} entities",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Document Management
# ═══════════════════════════════════════════════════════════════════════════════


class ListDocumentsInput(pydantic.BaseModel):
    """Input for listing documents."""

    org_id: str = pydantic.Field(description="Organization ID")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(default_factory=list, description="Caller ACL principals")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )
    limit: int = pydantic.Field(default=50, description="Max documents to return")
    offset: int = pydantic.Field(default=0, description="Pagination offset")


class DocumentSummary(pydantic.BaseModel):
    """Summary of a document for listing."""

    id: str
    title: str
    type: str
    department: str
    status: str
    chunk_count: int
    created_at: str


class ListDocumentsOutput(pydantic.BaseModel):
    """Output from listing documents."""

    documents: list[DocumentSummary]
    total: int
    limit: int
    offset: int


@mcp.tool()
async def list_documents(input: ListDocumentsInput) -> ListDocumentsOutput:
    """
    List all indexed documents with pagination.

    Returns a paginated list of documents in the knowledge base for the
    specified organization. Each entry includes basic metadata and status.

    Args:
        input: Organization ID and pagination parameters

    Returns:
        ListDocumentsOutput with document list and pagination info
    """
    if not _vector_store:
        logger.error("List documents failed: vector store not initialized")
        raise RuntimeError("Document service is temporarily unavailable")

    docs, total = await _vector_store.list_documents(
        limit=input.limit,
        offset=input.offset,
        org_id=input.org_id,
        allowed_streams=_normalize_stream_scopes(input.value_streams),
        user_id=(input.caller_user_id or "").strip().lower() or None,
        principals=_normalize_principal_list(input.caller_principals),
    )

    return ListDocumentsOutput(
        documents=[
            DocumentSummary(
                id=doc.id,
                title=doc.metadata.title,
                type=doc.metadata.document_type.value,
                department=doc.metadata.department,
                status=doc.status.value,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at.isoformat(),
            )
            for doc in docs
        ],
        total=total,
        limit=input.limit,
        offset=input.offset,
    )


class GetDocumentInput(pydantic.BaseModel):
    """Input for getting document details."""

    document_id: str = pydantic.Field(description="Document ID")
    org_id: str = pydantic.Field(description="Organization ID")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(default_factory=list, description="Caller ACL principals")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )


class DocumentDetail(pydantic.BaseModel):
    """Detailed document information."""

    id: str
    title: str
    type: str
    department: str
    author: str
    status: str
    chunk_count: int
    tags: list[str]
    source_url: str
    created_at: str
    updated_at: str


@mcp.tool()
async def get_document(input: GetDocumentInput) -> DocumentDetail:
    """
    Get detailed information about a specific document.

    Returns complete metadata for a document including title, author,
    department, tags, and processing status.

    Args:
        input: Document ID and organization ID

    Returns:
        DocumentDetail with full document metadata
    """
    if not _vector_store:
        logger.error("Get document failed: vector store not initialized")
        raise RuntimeError("Document service is temporarily unavailable")

    doc = await _vector_store.get_document(
        input.document_id,
        org_id=input.org_id,
        allowed_streams=_normalize_stream_scopes(input.value_streams),
        user_id=(input.caller_user_id or "").strip().lower() or None,
        principals=_normalize_principal_list(input.caller_principals),
    )
    if not doc:
        logger.warning(
            "Document not found", extra={"document_id": input.document_id, "org_id": input.org_id}
        )
        raise ValueError("Document not found")

    return DocumentDetail(
        id=doc.id,
        title=doc.metadata.title,
        type=doc.metadata.document_type.value,
        department=doc.metadata.department,
        author=doc.metadata.author,
        status=doc.status.value,
        chunk_count=doc.chunk_count,
        tags=doc.metadata.tags,
        source_url=doc.metadata.source_url,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


class DeleteDocumentInput(pydantic.BaseModel):
    """Input for deleting a document."""

    document_id: str = pydantic.Field(description="Document ID to delete")
    org_id: str = pydantic.Field(description="Organization ID")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(default_factory=list, description="Caller ACL principals")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )


class DeleteDocumentOutput(pydantic.BaseModel):
    """Output from document deletion."""

    success: bool
    message: str


@mcp.tool()
async def delete_document(input: DeleteDocumentInput) -> DeleteDocumentOutput:
    """
    Delete a document from the knowledge base.

    Removes the document and all its chunks from the vector store.
    This operation is permanent and cannot be undone.

    Args:
        input: Document ID and organization ID

    Returns:
        DeleteDocumentOutput with success status
    """
    if not _vector_store:
        logger.error("Delete document failed: vector store not initialized")
        raise RuntimeError("Document service is temporarily unavailable")

    deleted = await _vector_store.delete_document(
        input.document_id,
        org_id=input.org_id,
        allowed_streams=_normalize_stream_scopes(input.value_streams),
        user_id=(input.caller_user_id or "").strip().lower() or None,
        principals=_normalize_principal_list(input.caller_principals),
    )
    if not deleted:
        raise ValueError("Document not found")

    # Also remove from graph if enabled
    if _graph:
        try:
            await _graph.delete_document(input.org_id, input.document_id)
        except Exception as exc:
            logger.warning(
                "Failed to delete document from graph (non-fatal)",
                extra={"error": str(exc), "document_id": input.document_id},
            )

    logger.info(
        "Document deleted",
        extra={"document_id": input.document_id, "org_id": input.org_id},
    )

    return DeleteDocumentOutput(
        success=True,
        message=f"Document {input.document_id} deleted successfully",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Graph Discovery
# ═══════════════════════════════════════════════════════════════════════════════


class GraphNeighborsInput(pydantic.BaseModel):
    """Input for graph neighborhood discovery."""

    chunk_id: str = pydantic.Field(description="Chunk ID to explore from")
    org_id: str = pydantic.Field(description="Organization ID")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(default_factory=list, description="Caller ACL principals")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )
    max_depth: int = pydantic.Field(default=2, description="Maximum relationship depth")
    limit: int = pydantic.Field(default=10, description="Max neighbors to return")


class GraphNode(pydantic.BaseModel):
    """A node in the knowledge graph."""

    id: str
    type: str
    label: str
    properties: dict[str, typing.Any]


class GraphRelationship(pydantic.BaseModel):
    """A relationship between nodes."""

    from_id: str
    to_id: str
    type: str
    properties: dict[str, typing.Any]


class GraphNeighborsOutput(pydantic.BaseModel):
    """Output from graph neighborhood query."""

    nodes: list[GraphNode]
    relationships: list[GraphRelationship]
    depth: int


@mcp.tool()
async def discover_graph_neighbors(input: GraphNeighborsInput) -> GraphNeighborsOutput:
    """
    Discover related content through the knowledge graph.

    Explores connections between chunks, entities, and documents to find
    semantically and structurally related content. Useful for finding
    context beyond simple similarity search.

    Args:
        input: Chunk ID, organization ID, and traversal parameters

    Returns:
        GraphNeighborsOutput with connected nodes and relationships
    """
    if not _vector_store:
        logger.error("Graph discovery failed: vector store not initialized")
        raise RuntimeError("Graph discovery service is not available")

    result = await _vector_store.get_neighbors(
        chunk_id=input.chunk_id,
        max_depth=input.max_depth,
        org_id=input.org_id,
        allowed_streams=_normalize_stream_scopes(input.value_streams),
        user_id=(input.caller_user_id or "").strip().lower() or None,
        principals=_normalize_principal_list(input.caller_principals),
    )

    nodes: list[GraphNode] = [
        GraphNode(
            id=n.id,
            type=n.node_type,
            label=n.label,
            properties=n.metadata,
        )
        for n in [result.center_node, *result.neighbors][: input.limit + 1]
    ]

    relationships: list[GraphRelationship] = [
        GraphRelationship(
            from_id=r.source_id,
            to_id=r.target_id,
            type=r.relationship,
            properties={"weight": r.weight},
        )
        for r in result.edges[: input.limit]
    ]

    return GraphNeighborsOutput(
        nodes=nodes,
        relationships=relationships,
        depth=input.max_depth,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Statistics
# ═══════════════════════════════════════════════════════════════════════════════


class StatsInput(pydantic.BaseModel):
    """Input for statistics query."""

    org_id: str = pydantic.Field(description="Organization ID")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )


class StatsOutput(pydantic.BaseModel):
    """Knowledge base statistics."""

    total_documents: int
    total_chunks: int
    indexed_documents: int
    failed_documents: int
    org_id: str


@mcp.tool()
async def get_stats(input: StatsInput) -> StatsOutput:
    """
    Get knowledge base statistics.

    Returns summary metrics about the knowledge base including document
    counts, chunk counts, and indexing status.

    Args:
        input: Organization ID

    Returns:
        StatsOutput with knowledge base metrics
    """
    if not _vector_store:
        logger.error("Get stats failed: vector store not initialized")
        raise RuntimeError("Statistics service is temporarily unavailable")

    if hasattr(_vector_store, "stats_async"):
        stats = await _vector_store.stats_async(
            org_id=input.org_id,
            allowed_streams=_normalize_stream_scopes(input.value_streams),
        )
    else:
        stats = _vector_store.stats(
            org_id=input.org_id,
            allowed_streams=_normalize_stream_scopes(input.value_streams),
        )

    return StatsOutput(
        total_documents=stats.get("total_documents", 0),
        total_chunks=stats.get("total_chunks", 0),
        indexed_documents=stats.get("indexed_documents", 0),
        failed_documents=stats.get("failed_documents", 0),
        org_id=input.org_id,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Taxonomy Management
# ═══════════════════════════════════════════════════════════════════════════════


class CreateTaxonomyNodeInput(pydantic.BaseModel):
    """Input for creating taxonomy node."""

    org_id: str = pydantic.Field(description="Organization ID")
    label: str = pydantic.Field(description="Node label")
    parent_id: str | None = pydantic.Field(default=None, description="Parent node ID (None for root)")
    description: str = pydantic.Field(default="", description="Node description")
    aliases: list[str] = pydantic.Field(default_factory=list, description="Alternative names")
    metadata: dict[str, typing.Any] = pydantic.Field(default_factory=dict, description="Custom metadata")


class TaxonomyNodeOutput(pydantic.BaseModel):
    """Taxonomy node information."""

    id: str
    label: str
    parent_id: str | None
    description: str
    aliases: list[str]
    metadata: dict[str, typing.Any]
    org_id: str


@mcp.tool()
async def create_taxonomy_node(input: CreateTaxonomyNodeInput) -> TaxonomyNodeOutput:
    """
    Create a new taxonomy node.

    Creates a hierarchical taxonomy node for organizing and validating tags.
    Can be a root node (parent_id=None) or a child of an existing node.

    Args:
        input: Node label, optional parent, and metadata

    Returns:
        TaxonomyNodeOutput with created node details
    """
    if not _taxonomy_store:
        logger.error("Create taxonomy node failed: taxonomy store not initialized")
        raise RuntimeError("Taxonomy service is temporarily unavailable")

    from src.domain.taxonomy import TaxonomyTree

    tree = TaxonomyTree(store=_taxonomy_store, org_id=input.org_id)
    node = await tree.create_node(
        label=input.label,
        parent_id=input.parent_id,
        description=input.description,
        aliases=input.aliases,
        metadata=input.metadata,
    )

    logger.info(
        "Taxonomy node created",
        extra={"node_id": node.id, "label": node.label, "org_id": input.org_id},
    )

    return TaxonomyNodeOutput(
        id=node.id,
        label=node.label,
        parent_id=node.parent_id,
        description=node.description,
        aliases=node.aliases,
        metadata=node.metadata,
        org_id=input.org_id,
    )


class ListTaxonomyRootsInput(pydantic.BaseModel):
    """Input for listing root taxonomy nodes."""

    org_id: str = pydantic.Field(description="Organization ID")


@mcp.tool()
async def list_taxonomy_roots(input: ListTaxonomyRootsInput) -> list[TaxonomyNodeOutput]:
    """
    List all root-level taxonomy nodes.

    Returns the top-level nodes in the taxonomy hierarchy. Use this
    to explore the taxonomy tree structure.

    Args:
        input: Organization ID

    Returns:
        List of root taxonomy nodes
    """
    if not _taxonomy_store:
        logger.error("List taxonomy roots failed: taxonomy store not initialized")
        raise RuntimeError("Taxonomy service is temporarily unavailable")

    from src.domain.taxonomy import TaxonomyTree

    tree = TaxonomyTree(store=_taxonomy_store, org_id=input.org_id)
    nodes = await tree.get_roots()

    return [
        TaxonomyNodeOutput(
            id=node.id,
            label=node.label,
            parent_id=node.parent_id,
            description=node.description,
            aliases=node.aliases,
            metadata=node.metadata,
            org_id=input.org_id,
        )
        for node in nodes
    ]


class ValidateTagsInput(pydantic.BaseModel):
    """Input for tag validation."""

    org_id: str = pydantic.Field(description="Organization ID")
    tags: list[str] = pydantic.Field(description="Tags to validate")


class ValidationOutput(pydantic.BaseModel):
    """Tag validation result."""

    valid: list[str]
    invalid: list[str]
    suggestions: dict[str, list[str]]


@mcp.tool()
async def validate_tags(input: ValidateTagsInput) -> ValidationOutput:
    """
    Validate tags against the taxonomy.

    Checks if tags are recognized in the taxonomy hierarchy and provides
    suggestions for unrecognized tags based on similar valid tags.

    Args:
        input: Organization ID and tags to validate

    Returns:
        ValidationOutput with valid/invalid tags and suggestions
    """
    if not _taxonomy_store:
        logger.error("Validate tags failed: taxonomy store not initialized")
        raise RuntimeError("Taxonomy service is temporarily unavailable")

    from src.domain.taxonomy import TaxonomyTree

    tree = TaxonomyTree(store=_taxonomy_store, org_id=input.org_id)
    result = await tree.validate_tags(input.tags)

    return ValidationOutput(
        valid=result.valid,
        invalid=result.invalid,
        suggestions=result.suggestions,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tools — Retrieval Evaluation
# ═══════════════════════════════════════════════════════════════════════════════


class EvaluationCaseInput(pydantic.BaseModel):
    """A single evaluation test case."""

    id: str = pydantic.Field(description="Case identifier")
    query: str = pydantic.Field(description="Search query")
    expected_answer: str = pydantic.Field(default="", description="Expected answer")
    retrieved_contexts: list[str] = pydantic.Field(default_factory=list, description="Retrieved contexts")
    generated_answer: str = pydantic.Field(default="", description="Generated answer")


class EvaluateSuiteInput(pydantic.BaseModel):
    """Input for evaluation suite."""

    org_id: str = pydantic.Field(description="Organization ID")
    suite_name: str = pydantic.Field(default="default", description="Suite name")
    cases: list[EvaluationCaseInput] = pydantic.Field(description="Test cases")
    relevance_threshold: float = pydantic.Field(default=0.5, description="Relevance threshold (0.0-1.0)")


class EvaluationCaseResult(pydantic.BaseModel):
    """Result for a single evaluation case."""

    id: str
    query: str
    relevance_score: float
    faithfulness_score: float
    context_precision: float


class EvaluationOutput(pydantic.BaseModel):
    """Evaluation suite results."""

    suite_name: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    avg_relevance: float
    avg_faithfulness: float
    avg_precision: float
    eval_time_ms: float
    case_results: list[EvaluationCaseResult]


@mcp.tool()
async def evaluate_retrieval(input: EvaluateSuiteInput) -> EvaluationOutput:
    """
    Run RAGAS-style evaluation metrics on a test suite.

    Evaluates retrieval quality using multiple metrics:
    - Relevance: How relevant are retrieved contexts to the query
    - Faithfulness: Does the answer align with the retrieved context
    - Context Precision: Are the most relevant contexts ranked highest

    Args:
        input: Evaluation suite with test cases

    Returns:
        EvaluationOutput with per-case and aggregate metrics
    """
    if not _embedding_client or not _llm_judge:
        logger.error("Evaluation failed: services not initialized")
        raise RuntimeError("Evaluation service is temporarily unavailable")

    from src.domain.evaluation import EvaluationCase, RetrievalEvaluator

    if not input.cases:
        logger.warning("Evaluation request with no cases provided")
        raise ValueError("Evaluation cases are required")

    # Convert input cases to domain models
    cases = [
        EvaluationCase(
            id=c.id,
            query=c.query,
            expected_answer=c.expected_answer,
            retrieved_contexts=c.retrieved_contexts,
            generated_answer=c.generated_answer,
        )
        for c in input.cases
    ]

    evaluator = RetrievalEvaluator(
        embedder=_embedding_client,
        judge=_llm_judge,
        relevance_threshold=input.relevance_threshold,
    )

    logger.info(
        "Running evaluation suite",
        extra={
            "suite": input.suite_name,
            "cases": len(cases),
            "org_id": input.org_id,
        },
    )

    report = await evaluator.evaluate(cases, suite_name=input.suite_name)

    # Convert to output format
    case_results: list[EvaluationCaseResult] = [
        EvaluationCaseResult(
            id=r.id,
            query=r.query,
            relevance_score=r.relevance_score,
            faithfulness_score=r.faithfulness_score,
            context_precision=r.context_precision,
        )
        for r in report.case_results
    ]

    logger.info(
        "Evaluation complete",
        extra={
            "suite": input.suite_name,
            "total": report.total_cases,
            "time_ms": report.eval_time_ms,
        },
    )

    return EvaluationOutput(
        suite_name=report.suite_name,
        total_cases=report.total_cases,
        passed_cases=report.passed_cases,
        failed_cases=report.failed_cases,
        avg_relevance=report.summary.get("avg_relevance", 0.0),
        avg_faithfulness=report.summary.get("avg_faithfulness", 0.0),
        avg_precision=report.summary.get("avg_precision", 0.0),
        eval_time_ms=report.eval_time_ms,
        case_results=case_results,
    )


class AutoEvaluateInput(pydantic.BaseModel):
    """Input for auto-evaluation (search + evaluate)."""

    org_id: str = pydantic.Field(description="Organization ID")
    caller_user_id: str = pydantic.Field(default="", description="Caller user ID for ACL enforcement")
    caller_principals: list[str] = pydantic.Field(default_factory=list, description="Caller ACL principals")
    value_streams: list[str] = pydantic.Field(
        default_factory=list,
        description="Allowed value-stream scopes; omit to deny runtime document access",
    )
    suite_name: str = pydantic.Field(default="auto-eval", description="Suite name")
    queries: list[str] = pydantic.Field(description="Queries to test")
    expected_answers: list[str] = pydantic.Field(
        default_factory=list, description="Expected answers (optional)"
    )
    top_k: int = pydantic.Field(default=5, description="Results per query")
    relevance_threshold: float = pydantic.Field(default=0.5, description="Relevance threshold")


@mcp.tool()
async def auto_evaluate(input: AutoEvaluateInput) -> EvaluationOutput:
    """
    Full-pipeline evaluation: search knowledge base and evaluate results.

    For each query, this tool:
    1. Searches the knowledge base
    2. Retrieves top_k contexts
    3. Evaluates retrieval quality using RAGAS metrics

    This tests the real retrieval pipeline end-to-end.

    Args:
        input: Queries to test and evaluation parameters

    Returns:
        EvaluationOutput with evaluation metrics
    """
    if not _embedding_client or not _vector_store or not _llm_judge:
        logger.error("Auto-evaluation failed: services not initialized")
        raise RuntimeError("Evaluation service is temporarily unavailable")

    from src.domain.evaluation import EvaluationCase, RetrievalEvaluator

    if not input.queries:
        logger.warning("Auto-evaluation request with no queries provided")
        raise ValueError("Queries are required")

    eval_cases = []

    # Pad expected answers if needed
    expected_answers: list[str] = input.expected_answers + [""] * (
        len(input.queries) - len(input.expected_answers)
    )
    caller_principals: list[str] = _normalize_principal_list(input.caller_principals)
    value_streams: list[str] = _normalize_stream_scopes(input.value_streams)

    for idx, query in enumerate(input.queries):
        # Search the knowledge base
        try:
            query_embedding = await _embedding_client.embed_single(query)
            search_query = src.domain.models.SearchQuery(
                query=query,
                org_id=input.org_id,
                mode=src.domain.models.SearchMode.HYBRID,
                top_k=input.top_k,
                filters=src.domain.models.SearchFilters(
                    value_streams=value_streams,
                    caller_user_id=(input.caller_user_id or "").strip().lower() or None,
                    caller_principals=caller_principals,
                    document_statuses=[src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED],
                ),
                include_content=True,
            )

            result = await _vector_store.search(search_query, query_embedding)
            contexts = [r.content for r in result.results][: input.top_k]
        except Exception as exc:
            logger.warning(
                "Auto-eval search failed",
                extra={"error": str(exc), "query_preview": query[:80], "org_id": input.org_id},
            )
            contexts = []

        # Build evaluation case
        eval_cases.append(
            EvaluationCase(
                id=f"auto-{idx}",
                query=query,
                expected_answer=expected_answers[idx],
                retrieved_contexts=contexts,
                generated_answer="",
            )
        )

    # Run evaluation
    evaluator = RetrievalEvaluator(
        embedder=_embedding_client,
        judge=_llm_judge,
        relevance_threshold=input.relevance_threshold,
    )

    logger.info(
        "Running auto-evaluation",
        extra={
            "suite": input.suite_name,
            "cases": len(eval_cases),
            "org_id": input.org_id,
        },
    )

    report = await evaluator.evaluate(eval_cases, suite_name=input.suite_name)

    # Convert to output format
    case_results: list[EvaluationCaseResult] = [
        EvaluationCaseResult(
            id=r.id,
            query=r.query,
            relevance_score=r.relevance_score,
            faithfulness_score=r.faithfulness_score,
            context_precision=r.context_precision,
        )
        for r in report.case_results
    ]

    return EvaluationOutput(
        suite_name=report.suite_name,
        total_cases=report.total_cases,
        passed_cases=report.passed_cases,
        failed_cases=report.failed_cases,
        avg_relevance=report.summary.get("avg_relevance", 0.0),
        avg_faithfulness=report.summary.get("avg_faithfulness", 0.0),
        avg_precision=report.summary.get("avg_precision", 0.0),
        eval_time_ms=report.eval_time_ms,
        case_results=case_results,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Server Entry Point
# ═══════════════════════════════════════════════════════════════════════════════


async def main() -> None:
    """Main entry point with proper async initialization."""
    # Initialize services in the same event loop that FastMCP will use
    await initialize_services()

    logger.info(f"Starting Knowledge Platform MCP Server on port {mcp.src.core.config.settings.port}")
    logger.info("Server implements MCP Streamable HTTP transport with SSE support")
    logger.info(
        "Available tools:\n"
        "  Core:\n"
        "    - search_knowledge: Hybrid search (vector + keyword + filters)\n"
        "    - ingest_document: Add documents to knowledge base\n"
        "  Document Management:\n"
        "    - list_documents: Browse indexed documents\n"
        "    - get_document: View document details\n"
        "    - delete_document: Remove documents\n"
        "  Graph:\n"
        "    - discover_graph_neighbors: Find related content\n"
        "  Taxonomy:\n"
        "    - create_taxonomy_node: Build hierarchical taxonomy\n"
        "    - list_taxonomy_roots: Explore taxonomy structure\n"
        "    - validate_tags: Validate tags against taxonomy\n"
        "  Evaluation:\n"
        "    - evaluate_retrieval: RAGAS-style quality metrics\n"
        "    - auto_evaluate: End-to-end retrieval testing\n"
        "  Statistics:\n"
        "    - get_stats: Knowledge base metrics\n"
        "\n"
        "Health endpoints:\n"
        "  GET /      - Server status and tool list\n"
        "  GET /tools - Detailed tool descriptions"
    )

    try:
        # Run with Streamable HTTP transport
        await mcp.run_streamable_http_async()
    finally:
        # Cleanup on shutdown
        await cleanup_services()


if __name__ == "__main__":
    asyncio.run(main())
