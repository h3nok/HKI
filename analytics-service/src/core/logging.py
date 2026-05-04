"""
Structured JSON logging — thin re-export from ``shared.logging``.

All structured logging logic (GCPJsonFormatter, request-id injection,
OTel trace correlation) lives in the shared package.  This module
exists so existing ``from src.core.logging import ...`` imports
continue to work across the service.
"""

from shared.logging import GCPJsonFormatter, setup_logging  # noqa: F401 — re-export

from src.core.config import settings

logger = setup_logging(
    service_name=settings.SERVICE_NAME,
    log_level=settings.LOG_LEVEL,
)
