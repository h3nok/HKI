"""
FastAPI Application — Knowledge API

Knowledge Platform entry point. Provides hybrid search (vector + keyword),
document ingestion, and graph discovery over organizational knowledge.

Startup Flow:
    1. Initialize embedding client (connection to LiteLLM/Vertex AI)
    2. Initialize vector store (AlloyDB persistent or in-memory dev)
    3. Start serving HTTP requests on port 9509

Architecture:
    This service owns the "Knowledge Platform" box from the architecture
    diagram. It receives search queries from the orchestrator and returns
    ranked results with citations. The Knowledge Pipeline Service (9508)
    feeds documents into this service via the /v1/internal/store endpoint.
"""

import inspect
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.adapters.analytics_client import AnalyticsClient
from src.adapters.embedding_client import EmbeddingClient, VertexAIEmbeddingClient
from src.adapters.vector_store import VectorStore
from src.core.config import settings
from src.core.logging import logger
from src.domain.chunking import SentenceChunker
from src.domain.protocols import VectorStoreProtocol

# AlloyDB — lazy import to keep in-memory mode dependency-free
AlloyDBVectorStore = None
if settings.ALLOYDB_URL:
    try:
        from src.adapters.alloydb_store import AlloyDBVectorStore  # type: ignore[assignment]
    except ImportError:
        logger.warning("asyncpg not installed — falling back to in-memory store")

# Neo4j — lazy import for knowledge graph
Neo4jKnowledgeGraph = None
if settings.NEO4J_URI:
    try:
        from src.adapters.neo4j_graph import Neo4jKnowledgeGraph  # type: ignore[assignment]
    except ImportError:
        logger.warning("neo4j driver not installed — graph disabled")

# Entity extraction — lazy import
EntityExtractor = None
if settings.ENTITY_EXTRACTION_ENABLED:
    try:
        from src.domain.entity_extraction import EntityExtractor  # type: ignore[assignment]
    except ImportError:
        logger.warning("Entity extraction unavailable")

# Shared modules (hki-shared package)
try:
    from shared.errors import install_error_handlers
    from shared.tracing import init_tracing
except ImportError:
    init_tracing = None  # type: ignore[assignment]
    install_error_handlers = None  # type: ignore[assignment]


async def _await_maybe(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def _build_hvsi_status(app: FastAPI) -> dict[str, Any]:
    issues: dict[str, int] = {}
    vector_store = app.state.vector_store
    if hasattr(vector_store, "hvsi_audit"):
        issues.update(await _await_maybe(vector_store.hvsi_audit()))

    graph = getattr(app.state, "graph", None)
    if graph is not None and hasattr(graph, "hvsi_audit"):
        graph_issues = await _await_maybe(graph.hvsi_audit())
        for key, value in graph_issues.items():
            issues[f"graph_{key}"] = int(value)

    ready = all(int(value) == 0 for value in issues.values())
    return {
        "enabled": settings.KB_HERMETIC_ISOLATION,
        "ready": ready,
        "issues": issues,
    }


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize shared resources on startup, clean up on shutdown."""
    if init_tracing is not None:
        init_tracing(app, service_name=settings.SERVICE_NAME)

    logger.info(
        "Starting knowledge-api",
        extra={
            "port": settings.SERVICE_PORT,
            "environment": settings.ENVIRONMENT,
            "embedding_model": settings.EMBEDDING_MODEL,
        },
    )

    # Create embedding client: Vertex AI direct > gateway > local dev fallback
    embedding_client: Any = None
    if settings.EMBEDDING_GATEWAY_URL:
        if settings.ENVIRONMENT == "development":
            try:
                test_client = EmbeddingClient()
                await test_client.embed(["connectivity test"])
                embedding_client = test_client
                logger.info("Using LLM gateway embedder")
            except Exception as exc:
                logger.warning(
                    "LLM gateway unavailable, trying Vertex AI direct",
                    extra={"error": str(exc)[:200]},
                )
        else:
            embedding_client = EmbeddingClient()
            logger.info("Using LLM gateway embedder")

    if embedding_client is None:
        try:
            vertex_client = VertexAIEmbeddingClient()
            await vertex_client.embed(["connectivity test"])
            embedding_client = vertex_client
            logger.info(
                "Using Vertex AI direct embedder",
                extra={"model": settings.EMBEDDING_MODEL, "location": settings.VERTEX_AI_LOCATION},
            )
        except Exception as exc:
            logger.warning(
                "Vertex AI embedder unavailable, falling back to local dev",
                extra={"error": str(exc)[:200]},
            )
            from src.adapters.local_embedder import LocalDevEmbedder

            embedding_client = LocalDevEmbedder(dimensions=settings.EMBEDDING_DIMENSIONS)
    chunker = SentenceChunker(target_size=512, overlap=64)

    # Choose storage backend: AlloyDB (persistent) or in-memory (dev)
    vector_store: VectorStoreProtocol
    if settings.ALLOYDB_URL and AlloyDBVectorStore is not None:
        vector_store = AlloyDBVectorStore()
        await vector_store.connect(settings.ALLOYDB_URL)
        logger.info(
            "Using AlloyDB vector store",
            extra={"pool": f"{settings.ALLOYDB_POOL_MIN}-{settings.ALLOYDB_POOL_MAX}"},
        )
    else:
        vector_store = VectorStore()
        logger.info("Using in-memory vector store")

    # Neo4j knowledge graph (optional)
    graph = None
    if settings.NEO4J_URI and Neo4jKnowledgeGraph is not None:
        graph = Neo4jKnowledgeGraph()
        await graph.connect(
            uri=settings.NEO4J_URI,
            password=settings.NEO4J_PASSWORD,
            username=settings.NEO4J_USERNAME,
            database=settings.NEO4J_DATABASE,
        )
        logger.info("Neo4j knowledge graph connected")

    # Entity extractor (optional — requires gateway or Vertex AI)
    extractor = None
    if settings.ENTITY_EXTRACTION_ENABLED and EntityExtractor is not None:
        llm_url = settings.EMBEDDING_GATEWAY_URL or None
        if llm_url:
            extractor = EntityExtractor(
                llm_url=llm_url,
                llm_api_key=settings.EMBEDDING_API_KEY,
                model=settings.ENTITY_EXTRACTION_MODEL,
            )
            logger.info("Entity extractor initialized (gateway)")
        else:
            logger.info("Entity extractor skipped — no gateway URL (Vertex AI direct mode)")

    # Taxonomy store (in-memory for dev, AlloyDB in production)
    from src.domain.taxonomy import InMemoryTaxonomyStore

    taxonomy_store = InMemoryTaxonomyStore()

    # LLM Judge — faithfulness/correctness scoring for evaluation pipeline.
    # Uses Vertex AI Evaluation SDK when GCP_PROJECT_ID is set (production/staging);
    # falls back to GeminiJudge via LiteLLM gateway for local dev.
    if settings.GCP_PROJECT_ID:
        from src.domain.vertexai_judge import VertexAIJudge

        llm_judge = VertexAIJudge(
            project_id=settings.GCP_PROJECT_ID,
            location=settings.VERTEX_AI_LOCATION,
            experiment=settings.VERTEX_AI_EXPERIMENT or None,
        )
        logger.info(
            "LLM Judge: Vertex AI Evaluation SDK",
            extra={
                "project": settings.GCP_PROJECT_ID,
                "location": settings.VERTEX_AI_LOCATION,
                "experiment": settings.VERTEX_AI_EXPERIMENT or "none",
            },
        )
    else:
        from src.domain.llm_judge import GeminiJudge

        llm_url = settings.EMBEDDING_GATEWAY_URL or None
        llm_judge = GeminiJudge(
            llm_url=llm_url or "unused",
            llm_api_key=settings.EMBEDDING_API_KEY,
            model=settings.ENTITY_EXTRACTION_MODEL,
        )
        logger.info("LLM Judge: GeminiJudge via gateway (local dev — no GCP_PROJECT_ID)")

    # Reranker — LLM pointwise chunk rescoring (post-retrieval)
    from src.domain.reranker import ChunkReranker

    reranker = ChunkReranker(
        llm_url=settings.EMBEDDING_GATEWAY_URL or "unused",
        api_key=settings.EMBEDDING_API_KEY or "unused",
        model=settings.ENTITY_EXTRACTION_MODEL,
    )
    logger.info(
        "Chunk reranker initialized (%s)",
        "gateway" if settings.EMBEDDING_GATEWAY_URL else "no gateway — will fall back to RRF",
    )

    # Flag: true when using hash-based local dev embedder (no semantic search)
    from src.adapters.local_embedder import LocalDevEmbedder

    using_local_embedder = isinstance(embedding_client, LocalDevEmbedder)

    # Analytics client (fire-and-forget; no-op when URL not configured)
    analytics = AnalyticsClient()
    await analytics.start()

    # Stash on app state for route access
    app.state.embedding_client = embedding_client
    app.state.vector_store = vector_store
    app.state.chunker = chunker
    app.state.graph = graph
    app.state.entity_extractor = extractor
    app.state.taxonomy_store = taxonomy_store
    app.state.llm_judge = llm_judge
    app.state.reranker = reranker
    app.state.using_local_embedder = using_local_embedder
    app.state.analytics = analytics
    # Ring buffer for agent-detected knowledge gaps (last 100, cleared on restart)
    app.state.recent_gaps: list[dict] = []

    yield

    # Shutdown
    await analytics.close()
    await llm_judge.close()
    await reranker.close()
    if extractor is not None:
        await extractor.close()
    if graph is not None:
        await graph.close()
    if hasattr(vector_store, "close"):
        await vector_store.close()
    await embedding_client.close()
    logger.info("Knowledge API stopped")


app = FastAPI(
    title="Knowledge API",
    summary="Hybrid search and retrieval for organizational knowledge",
    description="Provides vector similarity search, BM25 keyword search, "
    "graph-based entity discovery, and search-quality evaluation endpoints.",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "knowledge",
            "description": "Search and retrieve documents using hybrid vector + BM25 ranking "
            "with optional graph-enriched results.",
        },
        {
            "name": "evaluation",
            "description": "LLM-judge evaluation endpoints for measuring search quality "
            "and relevance scoring.",
        },
        {
            "name": "taxonomy",
            "description": "Taxonomy and entity graph management for knowledge organisation.",
        },
        {
            "name": "health",
            "description": "Service health and readiness probes for Kubernetes orchestration.",
        },
    ],
    contact={
        "name": "Platform Engineering",
        "email": "platform-eng@hki.com",
    },
    license_info={
        "name": "Internal",
        "identifier": "proprietary",
    },
)

# Global error handlers — consistent JSON error responses
if install_error_handlers is not None:
    install_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request-ID correlation — propagate or generate X-Request-Id
try:
    from shared.middleware import RequestIdMiddleware

    app.add_middleware(RequestIdMiddleware)
except ImportError:
    pass  # shared package not installed — local dev


# ── Health Endpoints ──────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe — is the process running?"""
    return {"status": "healthy", "service": settings.SERVICE_NAME}


@app.get("/ready")
@app.get("/health/ready")
async def readiness() -> dict[str, Any]:
    """Readiness probe — can we serve traffic? Checks store stats."""
    store = app.state.vector_store
    if hasattr(store, "stats_async"):
        stats = await store.stats_async()
    else:
        stats = store.stats()
    payload: dict[str, Any] = {
        "status": "ready",
        "store": stats,
    }

    if settings.KB_HERMETIC_ISOLATION:
        payload["hvsi"] = await _build_hvsi_status(app)
        if not payload["hvsi"]["ready"]:
            payload["status"] = "blocked"
            return JSONResponse(status_code=503, content=payload)

    return payload


# ── Import and include API routes ─────────────────────────────────────────

from src.api.evaluation_routes import router as eval_router  # noqa: E402
from src.api.internal_routes import internal_router  # noqa: E402
from src.api.routes import router  # noqa: E402
from src.api.taxonomy_routes import router as taxonomy_router  # noqa: E402

app.include_router(router)
app.include_router(eval_router)
app.include_router(taxonomy_router)
app.include_router(internal_router)
