"""
Analytics Service — Configuration

All settings are loaded from environment variables with sensible defaults
for local development. In production, values come from Secret Manager or
K8s ConfigMaps.

Inherits common fields (auth, OTel, CORS, GCP, logging) from
``shared.config.ServiceSettings``.
"""

from shared.config import ServiceSettings


class Settings(ServiceSettings):
    """Application settings loaded from environment."""

    # ── Service Identity (overrides) ──────────────────────────────────────
    SERVICE_NAME: str = "analytics-service"
    SERVICE_PORT: int = 9512

    # ── Database (BigQuery / Cloud SQL) ───────────────────────────────────
    DATABASE_URL: str = ""  # Empty = in-memory buffer for local dev
    BQ_DATASET: str = "analytics"  # BigQuery dataset for production writes
    BQ_TABLE_EVENTS: str = "agent_events"

    # ── Event Buffer ──────────────────────────────────────────────────────
    EVENT_BUFFER_MAX: int = 10_000  # Max in-memory events before flush
    ANALYTICS_INGEST_SECRET: str = ""  # Optional shared secret for service event producers

    # ── Downstream Services ───────────────────────────────────────────────
    ORCHESTRATOR_URL: str = "http://localhost:9501"


settings = Settings()
