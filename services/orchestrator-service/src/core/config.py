"""
Orchestrator Service — Configuration

All settings are loaded from environment variables with sensible defaults
for local development. In production, these come from Secret Manager or
K8s ConfigMaps.

Inherits common fields (auth, OTel, CORS, GCP, logging) from
``shared.config.ServiceSettings``.
"""

import logging

import pydantic
import shared.config

_logger: logging.Logger = logging.getLogger(__name__)

# Values that are clearly development-only and must not reach production.
_DEV_PLACEHOLDER_PROJECTS: frozenset[str] = frozenset({"demo-retail-genai-324", ""})


class Settings(shared.config.ServiceSettings):
    """Application settings loaded from environment."""

    # ── Service Identity (overrides) ──────────────────────────────────────
    SERVICE_NAME: str = "orchestrator-service"
    SERVICE_PORT: int = 9501
    LLM_API_KEY: str = "sk-1234"  # DEV ONLY — overridden by env in prod
    GCP_PROJECT_ID: str = "demo-retail-genai-324"  # DEV ONLY — overridden by env in prod

    # ── LLM Gateway ───────────────────────────────────────────────────────
    # OpenAI-compatible endpoint. Override with any gateway (Apigee X, LiteLLM,
    # Vertex AI proxy, etc.) by setting LLM_GATEWAY_URL in the environment.
    LLM_GATEWAY_URL: str = "http://localhost:4000/v1"
    LLM_MODEL_DEFAULT: str = "gemini-2.0-flash"
    LLM_MODEL_FAST: str = "gemini-2.0-flash"
    LLM_MODEL_SMART: str = "gemini-2.5-pro"
    LLM_MODEL_THINKING: str = "gemini-2.5-flash"  # Native thinking model
    LLM_MAX_TOKENS: int = 4096
    LLM_TEMPERATURE: float = 0.3
    LLM_REQUEST_TIMEOUT: float = 60.0  # seconds

    # ── ADK Agent ─────────────────────────────────────────────────────────
    AGENT_MODEL: str = "gemini-2.5-flash"
    AGENT_MODEL_FAST: str = "gemini-2.5-flash"
    AGENT_MODEL_SMART: str = "gemini-2.5-pro"
    AGENT_MODEL_THINKING: str = "gemini-2.5-flash"
    MAX_CONCURRENT_CHATS: int = 100
    GCP_LOCATION: str = "us-central1"
    VERTEX_AI_LOCATION: str = "us-central1"
    GOOGLE_GENAI_USE_VERTEXAI: bool = True
    AGENT_ENGINE_ENABLED: bool = False
    AGENT_ENGINE_RESOURCE_NAME: str = ""

    # ── Redis (memory + rate limiting) ────────────────────────────────────
    REDIS_URL: str = "redis://localhost:9379/0"
    REDIS_KEY_PREFIX: str = "orch:"

    # ── Guardrails ────────────────────────────────────────────────────────
    GUARDRAILS_MAX_INPUT_LENGTH: int = 5000
    GUARDRAILS_RATE_LIMIT_RPM: int = 100  # requests per minute per user
    GUARDRAILS_BLOCK_ON_OUTPUT_FAIL: bool = False  # flip to True for strict mode

    # ── External Services (for real tool connectors) ──────────────────────
    KNOWLEDGE_API_URL: str = "http://localhost:9509"
    VECTOR_STORE_URL: str = "http://localhost:9509"
    KNOWLEDGE_PIPELINE_URL: str = "http://localhost:9508"
    ANALYTICS_SERVICE_URL: str = "http://localhost:9510"
    ANALYTICS_INGEST_SECRET: str = ""

    # ── Tool stub mode ────────────────────────────────────────────────────
    # When True, search_products / check_inventory / get_product_pricing
    # return in-memory catalog data instead of calling real APIs.
    # Must be False in production and staging.
    STUB_TOOLS: bool = True

    # ── Agent Loop ─────────────────────────────────────────────────────
    AGENT_MAX_TURNS: int = 8
    AGENT_TOKEN_BUDGET: int = 50000  # Max tokens per conversation turn
    AGENT_HISTORY_WINDOW: int = 20  # Max messages kept in context window

    # ── Corrective RAG ─────────────────────────────────────────────────
    CORRECTIVE_RAG_ENABLED: bool = True
    CORRECTIVE_RAG_MIN_RELEVANCE: float = 0.4
    CORRECTIVE_RAG_MAX_RETRIES: int = 1

    # ── Observability ─────────────────────────────────────────────────────
    OTEL_EXPORTER_ENDPOINT: str = ""

    @pydantic.model_validator(mode="after")
    def _validate_orchestrator_production(self) -> "Settings":
        """Block deployment with dev-only placeholders in prod/staging."""
        if self.ENVIRONMENT not in ("production", "staging"):
            return self

        errors: list[str] = []

        if self.GCP_PROJECT_ID in _DEV_PLACEHOLDER_PROJECTS:
            errors.append("GCP_PROJECT_ID is a dev placeholder — set the real project ID")

        if self.STUB_TOOLS:
            errors.append(
                "STUB_TOOLS=true — product search, inventory, and pricing tools return "
                "mock data. Set STUB_TOOLS=false and connect real API endpoints."
            )

        if self.AGENT_ENGINE_ENABLED and not self.AGENT_ENGINE_RESOURCE_NAME.strip():
            errors.append(
                "AGENT_ENGINE_ENABLED=true but AGENT_ENGINE_RESOURCE_NAME is empty"
            )

        if errors:
            msg: str = f"{self.SERVICE_NAME} config validation failed:\n  • " + "\n  • ".join(
                errors
            )
            _logger.critical(msg)
            raise ValueError(msg)

        return self


settings = Settings()
