"""
FastAPI Application — Orchestrator Service

Single entry point for the consolidated agent orchestration.
Integrates the LLM client, tool registry, memory system, and
tiered cache into a single cohesive orchestration engine.
"""

import collections.abc
import contextlib
import typing
import urllib.parse

import fastapi
import fastapi.middleware.cors

import src.core.config
import src.core.logging
import src.domain.guardrails
import src.domain.memory

settings = src.core.config.settings

# Shared modules (hki-shared package)
try:
    from shared.errors import install_error_handlers
    from shared.http_client import create_service_client
    from shared.tracing import init_tracing
except ImportError:
    init_tracing = None  # type: ignore[assignment]
    install_error_handlers = None  # type: ignore[assignment]
    create_service_client = None  # type: ignore[assignment]


# ── Lifespan — startup / shutdown ─────────────────────────────────────────


@contextlib.asynccontextmanager
async def lifespan(app: fastapi.FastAPI) -> collections.abc.AsyncGenerator[None, None]:
    """Initialize shared resources on startup, clean up on shutdown."""
    # ── 0. Initialize distributed tracing (before anything else) ─────────
    if init_tracing is not None:
        init_tracing(app, service_name=settings.SERVICE_NAME)

    src.core.logging.logger.info(
        "Starting orchestrator service (ADK Agent)",
        extra={
            "port": settings.SERVICE_PORT,
            "environment": settings.ENVIRONMENT,
            "llm_gateway": settings.LLM_GATEWAY_URL,
            "model": settings.LLM_MODEL_DEFAULT,
            "framework": "google_adk",
        },
    )

    # ── 1. Create shared HTTP client (for health checks, MCP, etc.) ────────
    shared_client: httpx.AsyncClient = create_service_client("orchestrator-service")

    # ── 2. Initialize the 4-store Memory System ──────────────────────────
    # Try Redis-backed memory first; fall back to in-process dicts
    from src.adapters.redis_memory import create_redis_memory_stores

    redis_stores = await create_redis_memory_stores(settings.REDIS_URL)
    if redis_stores:
        sem, epi, proc, decl = redis_stores
        memory_manager = src.domain.memory.MemoryManager(
            semantic=sem,
            episodic=epi,
            procedural=proc,
            declarative=decl,
        )
        src.core.logging.logger.info("Memory system initialized (Redis-backed)")
    else:
        memory_manager = src.domain.memory.MemoryManager()
        src.core.logging.logger.info("Memory system initialized (in-process)")
    await memory_manager.initialize()

    # ── 2b. Initialize distributed rate limiter (Redis-backed) ───────────
    src.domain.guardrails.init_rate_limiter(settings.REDIS_URL)

    # ── 3. Initialize Tiered Cache (L1 in-process + L2 Redis) ────────────
    from src.adapters.cache import TieredCache

    cache = TieredCache(redis_url=settings.REDIS_URL)
    await cache.connect()

    # ── 4. Create the agent (ADK native Vertex AI) ────────────────────────
    from src.domain.agent import AdkAgent

    agent = AdkAgent(memory_manager=memory_manager, cache=cache)
    src.core.logging.logger.info(
        "ADK Agent initialized (native Vertex AI)",
        extra={
            "model": settings.AGENT_MODEL,
            "vertex_location": settings.VERTEX_AI_LOCATION,
        },
    )

    # Stash on app state for route access
    app.state.memory_manager = memory_manager
    app.state.shared_client = shared_client
    app.state.agent = agent
    app.state.cache = cache

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    await shared_client.aclose()

    # Close tiered cache (Redis L2 pool)
    await cache.close()

    # Close Redis connections held by the memory stores
    if redis_stores:
        redis_client = redis_stores[0]._redis  # shared client across all 4 stores
        await redis_client.aclose()
        src.core.logging.logger.info("Redis memory connections closed")

    # Close synchronous rate-limiter Redis client
    from src.domain.guardrails import _redis_client as rl_client

    if rl_client is not None:
        rl_client.close()

    src.core.logging.logger.info("Orchestrator ADK service stopped")


# ── App ───────────────────────────────────────────────────────────────────

app = fastapi.FastAPI(
    title="Orchestrator Service",
    summary="Unified agent orchestration engine for the Retail Agentic Platform",
    description="Consolidates LLM routing, tool execution, memory management, "
    "guardrails, and corrective RAG into a single ADK-based agent service.",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "orchestration",
            "description": "Chat endpoints for conversational agent interactions. "
            "Supports both synchronous and SSE streaming responses.",
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

# CORS — allow the HKI Agentic BFF and local dev
app.add_middleware(
    fastapi.middleware.cors.CORSMiddleware,
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


# Shared lightweight client for health probes — avoids creating a new
# TCP connection on every 5-second readiness check across all pods.
import httpx  # noqa: E402 — needed for type annotation

_probe_client: httpx.AsyncClient | None = None


def _get_probe_client() -> httpx.AsyncClient:
    global _probe_client  # noqa: PLW0603
    if _probe_client is None:
        _probe_client = create_service_client("orchestrator-probes", timeout=5.0, max_connections=4)
    return _probe_client


def _is_expected_hostname(url: str, expected_hostname: str) -> bool:
    try:
        hostname = urllib.parse.urlparse(url).hostname
    except ValueError:
        return False
    return (hostname or "").lower() == expected_hostname


def _is_iap_auth_redirect(resp: httpx.Response) -> bool:
    location = resp.headers.get("location", "").lower()
    return resp.status_code in {302, 303, 307, 308} and (
        _is_expected_hostname(location, "accounts.google.com")
        or resp.headers.get("x-goog-iap-generated-response", "").lower() == "true"
    )


def _gateway_probe_status(resp: httpx.Response) -> str:
    if resp.status_code == 200:
        return "ok"
    if _is_iap_auth_redirect(resp):
        return "ok:iap-auth"
    return f"error:{resp.status_code}"


@app.get("/ready")
@app.get("/health/ready")
async def readiness() -> dict[str, typing.Any]:
    """
    Readiness probe — can we serve traffic?
    Checks LLM gateway, Redis (L2 cache), and vector-store connectivity.
    """
    checks: dict[str, str] = {}
    client: httpx.AsyncClient = _get_probe_client()

    # ADK mode: model calls go directly to Vertex AI via google.genai
    # No LLM gateway health check needed
    if settings.LLM_GATEWAY_URL:
        try:
            headers = (
                {"Authorization": f"Bearer {settings.LLM_API_KEY}"} if settings.LLM_API_KEY else {}
            )
            resp: httpx.Response = await client.get(
                f"{settings.LLM_GATEWAY_URL}/models",
                headers=headers,
            )
            checks["llm_gateway"] = _gateway_probe_status(resp)
        except Exception as exc:
            checks["llm_gateway"] = f"error:{type(exc).__name__}"
    else:
        checks["vertex_ai"] = "ok:direct"

    # Knowledge API check
    try:
        resp: httpx.Response = await client.get(f"{settings.KNOWLEDGE_API_URL}/health")
        checks["knowledge_api"] = "ok" if resp.status_code == 200 else f"error:{resp.status_code}"
    except Exception as exc:
        checks["knowledge_api"] = f"error:{type(exc).__name__}"

    # Cache check (L2 Redis)
    cache: typing.Any | None = getattr(app.state, "cache", None)
    if cache:
        stats = cache.stats()
        checks["cache_l2"] = "ok" if stats.get("l2_connected") else "degraded:l1_only"
    else:
        checks["cache_l2"] = "degraded:not_initialized"

    required_checks: list[str] = [k for k in checks if not checks[k].startswith("degraded")]
    all_ok: bool = all(checks.get(name, "").startswith("ok") for name in required_checks)
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }


# ── Import and include API routes ─────────────────────────────────────────

import src.api.routes  # noqa: E402

app.include_router(src.api.routes.router)
