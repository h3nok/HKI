"""
FastAPI Application — Knowledge Pipeline Service

Document ingestion entry point. Processes raw content (text, URLs, HTML)
through a multi-stage pipeline and delegates to the knowledge-api
for chunking, embedding, and indexing.

Architecture:
    This service owns the "Knowledge Ingestion" box from the architecture
    diagram. It handles: Extract → Clean → Enrich → delegate to vector-store.
"""

import collections.abc
import contextlib
import inspect
import typing

import fastapi
import fastapi.middleware.cors
import fastapi.responses
import httpx

import src.adapters.analytics_client
import src.core.config
import src.core.logging
import src.domain.pipeline

# Shared modules (hki-shared package)
try:
    from shared.errors import install_error_handlers
    from shared.http_client import create_service_client
    from shared.tracing import init_tracing
except ImportError:
    init_tracing = None  # type: ignore[assignment]
    install_error_handlers = None  # type: ignore[assignment]
    create_service_client = None  # type: ignore[assignment]


async def _await_maybe(value: typing.Any) -> typing.Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def _build_hvsi_status(app: fastapi.FastAPI) -> dict[str, typing.Any]:
    issues: dict[str, int] = {}

    job_store: typing.Any | None = getattr(app.state, "job_store", None)
    if job_store is not None and hasattr(job_store, "hvsi_audit"):
        issues.update(await _await_maybe(job_store.hvsi_audit()))

    review_store: typing.Any | None = getattr(app.state, "review_store", None)
    if review_store is not None and hasattr(review_store, "hvsi_audit"):
        issues.update(await _await_maybe(review_store.hvsi_audit()))

    ready: bool = all(int(value) == 0 for value in issues.values())
    return {
        "enabled": src.core.config.settings.KB_HERMETIC_ISOLATION,
        "ready": ready,
        "issues": issues,
    }


@contextlib.asynccontextmanager
async def lifespan(app: fastapi.FastAPI) -> collections.abc.AsyncGenerator[None, None]:
    """Initialize adapters and pipeline resources on startup."""
    if init_tracing is not None:
        init_tracing(app, service_name=src.core.config.settings.SERVICE_NAME)

    src.core.logging.logger.info(
        "Starting knowledge-pipeline-service",
        extra={
            "port": src.core.config.settings.SERVICE_PORT,
            "environment": src.core.config.settings.ENVIRONMENT,
            "vector_store": src.core.config.settings.KNOWLEDGE_API_URL,
            "redis": bool(src.core.config.settings.REDIS_URL),
            "gcs": src.core.config.settings.GCS_ENABLED,
            "gemini": src.core.config.settings.GEMINI_ENABLED,
        },
    )

    # Initialize adapters — each factory handles its own fallback
    from src.adapters.gcs_store import create_document_store
    from src.adapters.job_store import create_job_store

    job_store = await create_job_store()
    doc_store = await create_document_store()
    app.state.job_store = job_store

    analytics = src.adapters.analytics_client.AnalyticsClient()
    await analytics.start()
    app.state.analytics = analytics

    pipeline = src.domain.pipeline.IngestionPipeline(
        job_store=job_store,
        document_store=doc_store,
        analytics=analytics,
    )
    app.state.pipeline = pipeline

    # Shared HTTP client for service-to-service calls
    http_client: httpx.AsyncClient = create_service_client("knowledge-pipeline")
    app.state.http = http_client

    # Review workflow (Redis-backed in production, in-memory fallback)
    from src.adapters.review_store import create_review_store
    from src.domain.review import AutoApproveRule, ReviewPolicy, ReviewWorkflow

    review_store = await create_review_store()
    review_policy = ReviewPolicy(
        rules=[
            # Re-ingestion of an existing source always auto-approves
            AutoApproveRule(name="reingestion", is_reingestion=True),
            # New documents always require manual review — no score-based bypass
        ]
    )
    review_workflow = ReviewWorkflow(store=review_store, policy=review_policy)
    pipeline.set_review_workflow(review_workflow)
    app.state.review_store = review_store
    app.state.review_workflow = review_workflow

    # Version store for incremental ingestion
    from src.domain.versioning import ChangeDetector, InMemoryVersionStore

    version_store = InMemoryVersionStore()
    change_detector = ChangeDetector(store=version_store)
    pipeline.set_change_detector(change_detector)
    app.state.version_store = version_store
    app.state.change_detector = change_detector

    # Chunk feedback loop
    from src.domain.chunk_feedback import FeedbackProcessor, InMemoryFeedbackStore

    feedback_store = InMemoryFeedbackStore()
    feedback_processor = FeedbackProcessor(store=feedback_store)
    app.state.feedback_store = feedback_store
    app.state.feedback_processor = feedback_processor

    # Initialize queue publisher (Pub/Sub or in-memory)
    publisher = None
    subscriber = None
    uses_in_memory_queue: bool = not src.core.config.settings.PUBSUB_ENABLED
    if src.core.config.settings.PUBSUB_ENABLED:
        from src.adapters.pubsub import create_publisher, create_subscriber

        publisher = create_publisher()
        app.state.publisher = publisher
        src.core.logging.logger.info("Queue publisher initialized", extra={"pubsub": True})

        # In local dev with in-memory queue, also start the subscriber
        # so the worker runs in-process (no separate pod needed)
        from src.adapters.pubsub import InMemoryPublisher

        uses_in_memory_queue: bool = isinstance(publisher, InMemoryPublisher)
        if isinstance(publisher, InMemoryPublisher):
            import src.worker as worker_mod
            from src.adapters.concurrency import create_concurrency_limiter
            from src.worker import process_message

            worker_mod._pipeline = pipeline
            worker_mod._limiter = await create_concurrency_limiter()
            subscriber = create_subscriber()
            await subscriber.start(process_message)
            src.core.logging.logger.info("In-memory worker started (local dev mode)")

    # Only recover stale jobs when the queue is not durable.
    # With real Pub/Sub, queued or in-flight work should be retried via redelivery/DLQ.
    if hasattr(job_store, "recover_stale_jobs") and uses_in_memory_queue:
        await job_store.recover_stale_jobs()
    elif hasattr(job_store, "recover_stale_jobs"):
        src.core.logging.logger.info("Skipping startup stale-job recovery for durable queue mode")

    # Reconcile review ↔ knowledge-api document status drift on startup
    try:
        from src.api.review_routes import reconcile_review_statuses

        result = await reconcile_review_statuses(app.state)
        if result.get("drifted", 0) > 0:
            src.core.logging.logger.info(
                "Startup reconciliation repaired drifted documents",
                extra=result,
            )
    except Exception as exc:
        src.core.logging.logger.warning(
            "Startup reconciliation failed (non-blocking)",
            extra={"error": str(exc)},
        )

    yield

    if subscriber:
        await subscriber.stop()
    if publisher:
        await publisher.close()
    await pipeline.close()
    await analytics.close()
    await http_client.aclose()
    src.core.logging.logger.info("Knowledge pipeline service stopped")


app = fastapi.FastAPI(
    title="Knowledge Pipeline Service",
    summary="Document ingestion pipeline for organizational knowledge",
    description="""
## Overview

The Knowledge Pipeline Service powers the ingestion layer of the Agentic Platform's
knowledge management system. It processes raw content — text, URLs, and HTML —
through a multi-stage pipeline and indexes it into the vector store for
semantic retrieval.

## Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Extract** | Pull raw text from source (text, URL, HTML) |
| **Clean** | Normalize whitespace, strip boilerplate, deduplicate |
| **Enrich** | Extract entities, dates, topics, reading time |
| **Contextualize** | Gemini-generated chunk summaries for better retrieval |
| **Chunk** | Split into overlapping segments |
| **Embed** | Generate vector embeddings (delegated to vector-store) |
| **Index** | Store chunks + metadata in the vector store |

## Architecture

- **Queue**: Google Cloud Pub/Sub (in-memory fallback for local dev)
- **Job Store**: Redis (in-memory fallback)
- **Document Store**: Google Cloud Storage (no-op fallback)
- **Auth**: JWT-based multi-tenant isolation (`org_id` from token)

## Authentication

All endpoints require a Bearer JWT token. The `org_id` claim scopes all
storage operations for tenant isolation.

```
Authorization: Bearer <jwt>
```
""",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "ingestion",
            "description": "Submit content for processing through the knowledge pipeline. "
            "Supports raw text and URL sources with configurable chunking strategies.",
        },
        {
            "name": "jobs",
            "description": "Monitor and manage ingestion jobs. Track pipeline progress, "
            "view processing metrics, and inspect completed job details.",
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
    fastapi.middleware.cors.CORSMiddleware,
    allow_origins=src.core.config.settings.CORS_ORIGINS,
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


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe — returns healthy if the process is running."""
    return {"status": "healthy", "service": src.core.config.settings.SERVICE_NAME}


@app.get("/ready", tags=["health"])
@app.get("/health/ready", tags=["health"])
async def readiness(request: fastapi.Request) -> dict[str, typing.Any]:
    """Readiness probe — checks downstream dependencies (vector-store)."""
    checks: dict[str, str] = {}
    http: typing.Any | None = request.app.state.http if hasattr(request.app.state, "http") else None
    try:
        if http is not None:
            resp = await http.get(f"{src.core.config.settings.KNOWLEDGE_API_URL}/health")
        else:
            import httpx

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp: httpx.Response = await client.get(
                    f"{src.core.config.settings.KNOWLEDGE_API_URL}/health"
                )
        checks["vector_store"] = "ok" if resp.status_code == 200 else f"error:{resp.status_code}"
    except Exception as exc:
        checks["vector_store"] = f"error:{type(exc).__name__}"

    all_ok: bool = all(v == "ok" for v in checks.values())
    payload: dict[str, typing.Any] = {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }

    if src.core.config.settings.KB_HERMETIC_ISOLATION:
        payload["hvsi"] = await _build_hvsi_status(request.app)
        if not payload["hvsi"]["ready"]:
            payload["status"] = "blocked"
            return fastapi.responses.JSONResponse(status_code=503, content=payload)

    return payload


import src.api.review_routes  # noqa: E402
import src.api.routes  # noqa: E402

app.include_router(src.api.routes.router)
app.include_router(src.api.review_routes.router)
