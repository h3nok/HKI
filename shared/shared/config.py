"""
Shared Config Base — common fields for all Python services.

Provides ``ServiceSettings`` with fields shared across every service:
service identity, logging, environment, auth, OTel, CORS, and GCP project.

Each service sub-classes this and adds its own domain-specific settings:

    from shared.config import ServiceSettings

    class Settings(ServiceSettings):
        REDIS_URL: str = "redis://localhost:6379/0"
        ...

    settings = Settings()
"""

from __future__ import annotations

import json
import logging
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

logger = logging.getLogger("shared.config")

_PLACEHOLDER_KEYS = frozenset({"sk-1234", "changeme", "CHANGE_ME", "placeholder"})


class ServiceSettings(BaseSettings):
    """Base settings shared by all Python platform services."""

    # ── Service Identity ──────────────────────────────────────────────────
    SERVICE_NAME: str = "unknown-service"
    SERVICE_PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Auth ──────────────────────────────────────────────────────────────
    AUTH_ENABLED: bool = True
    SERVICE_AUTH_SECRET: str = ""

    # ── OpenTelemetry ─────────────────────────────────────────────────────
    OTEL_ENABLED: bool = False

    # ── GCP ───────────────────────────────────────────────────────────────
    GCP_PROJECT_ID: str = ""
    GCP_REGION: str = "us-central1"

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:9001",
        "http://localhost:9002",
        "http://localhost:3000",
    ]

    # ── LLM ───────────────────────────────────────────────────────────────
    LLM_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_prefix="",
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> list[str] | object:
        if not isinstance(value, str):
            return value

        raw_value = value.strip()
        if not raw_value:
            return []
        if raw_value.startswith("["):
            parsed = json.loads(raw_value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _validate_production(self) -> ServiceSettings:
        """Fail fast if production is missing critical secrets."""
        if self.ENVIRONMENT not in ("production", "staging"):
            return self

        errors: list[str] = []

        if not self.SERVICE_AUTH_SECRET:
            errors.append("SERVICE_AUTH_SECRET must be set in production/staging")

        if self.LLM_API_KEY in _PLACEHOLDER_KEYS:
            errors.append(
                "LLM_API_KEY is using a placeholder value — "
                "set a real key for production"
            )

        if not self.AUTH_ENABLED:
            errors.append("AUTH_ENABLED=false is not allowed in production/staging")

        if errors:
            msg = (
                f"{self.SERVICE_NAME} config validation failed:\n  • "
                + "\n  • ".join(errors)
            )
            logger.critical(msg)
            raise ValueError(msg)

        return self
