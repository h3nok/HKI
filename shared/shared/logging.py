"""
Structured JSON Logging — GCP Cloud Logging compatible.

Shared logging module for all Python services. Configures the root logger
with structured JSON output so Cloud Logging auto-parses:
    - severity (mapped from Python levelname)
    - sourceLocation (file, line, function)
    - serviceContext (service name + Cloud Run revision)
    - trace/span correlation with OpenTelemetry
    - requestId from ``shared.middleware.request_id_var``

Usage:
    from shared.logging import setup_logging

    logger = setup_logging("my-service", log_level="INFO")

All loggers in the process (including uvicorn, httpx, third-party libs)
inherit the structured format.
"""

from __future__ import annotations

import logging
import os
import sys

from pythonjsonlogger import jsonlogger


class GCPJsonFormatter(jsonlogger.JsonFormatter):
    """Extends JsonFormatter with GCP Cloud Logging conventions."""

    def __init__(self, *args, service_name: str = "", **kwargs):
        super().__init__(*args, **kwargs)
        self._service_name = service_name

    def add_fields(
        self,
        log_record: dict,
        record: logging.LogRecord,
        message_dict: dict,
    ) -> None:
        super().add_fields(log_record, record, message_dict)

        # GCP severity (must be uppercase string)
        log_record["severity"] = record.levelname
        log_record.pop("levelname", None)

        # Timestamp in ISO format
        log_record["timestamp"] = self.formatTime(record)
        log_record.pop("asctime", None)

        # Source location — enables Cloud Error Reporting drill-down
        log_record["logging.googleapis.com/sourceLocation"] = {
            "file": record.pathname,
            "line": record.lineno,
            "function": record.funcName,
        }

        # Service context — groups errors in Error Reporting
        log_record.setdefault(
            "serviceContext",
            {
                "service": self._service_name,
                "version": os.environ.get("K_REVISION", "local"),
            },
        )

        # ── Request-ID correlation ────────────────────────────────────
        # Reads from the contextvars set by RequestIdMiddleware so every
        # log line emitted during a request carries the same request id.
        try:
            from shared.middleware import request_id_var

            rid = request_id_var.get("")
            if rid:
                log_record["requestId"] = rid
        except ImportError:
            pass

        # ── OTel trace / span correlation ─────────────────────────────
        trace_id = ""
        span_id = ""
        try:
            from opentelemetry import trace as _otrace

            span = _otrace.get_current_span()
            ctx = span.get_span_context()
            if ctx and ctx.trace_id:
                trace_id = format(ctx.trace_id, "032x")
                span_id = format(ctx.span_id, "016x")
        except ImportError:
            pass

        if not trace_id:
            trace_header = os.environ.get("X_CLOUD_TRACE_CONTEXT", "")
            if trace_header:
                trace_id = trace_header.split("/")[0]

        project = os.environ.get("GCP_PROJECT_ID", "")
        if project and trace_id:
            log_record["logging.googleapis.com/trace"] = (
                f"projects/{project}/traces/{trace_id}"
            )
        if span_id:
            log_record["logging.googleapis.com/spanId"] = span_id


def setup_logging(
    service_name: str = "",
    log_level: str = "INFO",
) -> logging.Logger:
    """
    Configure root + service logger with GCP-compatible JSON output.

    Args:
        service_name: Name for the returned logger and serviceContext.
        log_level:    Root log level (e.g., "INFO", "DEBUG").

    Returns:
        A named logger for the service.
    """
    root = logging.getLogger()
    root.setLevel(log_level.upper())

    # Avoid duplicate handlers on hot-reload
    if any(isinstance(h.formatter, GCPJsonFormatter) for h in root.handlers):
        return logging.getLogger(service_name) if service_name else root

    # Remove default handlers (e.g., uvicorn's)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        GCPJsonFormatter(
            fmt="%(message)s %(name)s",
            service_name=service_name,
        )
    )
    root.addHandler(handler)

    # Quieten noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    return logging.getLogger(service_name) if service_name else root
