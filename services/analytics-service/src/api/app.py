"""
analytics-service - FastAPI Application

Usage analytics and insights
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.adapters.database import EventStoreProtocol, create_event_store
from src.api.routes import events_router, router
from src.core.config import settings
from src.core.logging import logger  # pre-configured by shared.logging

# Shared modules (hki-shared package)
try:
    from shared.errors import install_error_handlers
    from shared.tracing import init_tracing
except ImportError:
    init_tracing = None  # type: ignore[assignment]
    install_error_handlers = None  # type: ignore[assignment]


def _build_store() -> EventStoreProtocol:
    """Select the event-store backend based on configuration."""
    if settings.DATABASE_URL or settings.GCP_PROJECT_ID:
        return create_event_store(
            "bigquery",
            project_id=settings.GCP_PROJECT_ID,
            dataset=settings.BQ_DATASET,
            table=settings.BQ_TABLE_EVENTS,
        )
    return create_event_store("memory", max_buffer=settings.EVENT_BUFFER_MAX)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    if init_tracing is not None:
        init_tracing(app, service_name=settings.SERVICE_NAME)

    # Initialise the event store and stash it on app.state for route access
    store = _build_store()
    app.state.event_store = store
    logger.info(f"Starting {settings.SERVICE_NAME} (store={type(store).__name__})...")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    await store.close()
    logger.info(f"{settings.SERVICE_NAME} stopped")


app = FastAPI(
    title="Analytics Service",
    summary="Usage analytics and insights for the Retail Agentic Platform",
    description="Ingests agent interaction events via Pub/Sub, stores them in BigQuery, "
    "and exposes query endpoints for recent events and usage summaries.",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "events",
            "description": "Ingest and query agent interaction events. "
            "Supports Pub/Sub push ingestion and filtered retrieval.",
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

# CORS middleware
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

# Include routes
app.include_router(router, prefix="/v1")
app.include_router(events_router)  # Pub/Sub push endpoint (no prefix — router has /v1/events)


@app.get("/health")
async def health_check():
    """Liveness probe — is the process running?"""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": "1.0.0",
    }


@app.get("/ready")
@app.get("/health/ready")
async def readiness():
    """Readiness probe — can we serve traffic?"""
    store: EventStoreProtocol = app.state.event_store
    try:
        store_status = await store.health_check()
    except Exception:
        store_status = "degraded"
    return {
        "status": "ready" if store_status == "ok" else "degraded",
        "service": settings.SERVICE_NAME,
        "version": "1.0.0",
        "checks": {
            "event_store": store_status,
        },
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.SERVICE_NAME,
        "description": "Usage analytics and insights",
        "docs": "/docs",
        "health": "/health",
    }
