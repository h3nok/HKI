"""
OpenTelemetry Tracing — Shared setup for all Python services.

Configures a TracerProvider with the GCP Cloud Trace exporter (in production)
or a console exporter (in local dev). Instruments FastAPI and httpx so that:

  1. Every inbound request gets a trace span (via FastAPI middleware)
  2. Every outbound httpx call propagates the trace context header
  3. Trace IDs correlate with GCP Cloud Logging (via the trace field)

Usage in each service's app.py:

    from shared.tracing import init_tracing

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_tracing(app, service_name="orchestrator-service")
        yield

Configuration env vars:
    OTEL_ENABLED          — "true" to enable tracing (default: false)
    GCP_PROJECT_ID        — required for Cloud Trace exporter
    OTEL_EXPORTER_ENDPOINT — reserved for future collector-based routing
    ENVIRONMENT           — tags traces with deployment environment
    K_REVISION            — Cloud Run revision (auto-set in GKE/Cloud Run)
"""

from __future__ import annotations

import logging
import os
import typing

logger: logging.Logger = logging.getLogger(__name__)


def _is_enabled() -> bool:
    return os.environ.get("OTEL_ENABLED", "false").lower() in ("true", "1", "yes")


def init_tracing(app: object, service_name: str) -> None:
    """
    Initialize OpenTelemetry tracing for a FastAPI application.

    Safe to call even when OTEL_ENABLED=false — does nothing in that case.
    Gracefully handles missing optional dependencies.
    """
    if not _is_enabled():
        logger.info("Tracing disabled (OTEL_ENABLED != true)")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.propagate import set_global_textmap
        from opentelemetry.propagators.composite import CompositePropagator
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import (
            BatchSpanProcessor,
            ConsoleSpanExporter,
        )
        from opentelemetry.trace.propagation import TraceContextTextMapPropagator
    except ImportError:
        logger.warning(
            "opentelemetry SDK not installed — tracing disabled. "
            "Install: pip install opentelemetry-api opentelemetry-sdk"
        )
        return

    environment: str = os.environ.get("ENVIRONMENT", "development")
    revision: str = os.environ.get("K_REVISION", "local")

    # ── Resource: identifies this service in traces ─────────────────────
    resource: Resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            "service.version": revision,
            "deployment.environment": environment,
        }
    )

    # ── TracerProvider ──────────────────────────────────────────────────
    provider = TracerProvider(resource=resource)

    # ── Exporter: Cloud Trace in prod, console in dev ───────────────────
    gcp_project: str = os.environ.get("GCP_PROJECT_ID", "")
    if gcp_project:
        try:
            from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

            exporter = CloudTraceSpanExporter(project_id=gcp_project)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info(
                "Cloud Trace exporter configured",
                extra={"project": gcp_project, "service": service_name},
            )
        except ImportError:
            logger.warning(
                "opentelemetry-exporter-gcp-trace not installed — "
                "falling back to console exporter"
            )
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    else:
        # Local dev: log spans to console
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        logger.info("Console trace exporter configured (no GCP_PROJECT_ID)")

    trace.set_tracer_provider(provider)

    # ── Propagator: W3C TraceContext (standard for GCP) ─────────────────
    # Also supports Cloud Trace propagation header if X-Cloud-Trace-Context
    # is present (GCP load balancers inject this).
    try:
        from opentelemetry.propagators.cloud_trace_propagator import (
            CloudTraceFormatPropagator,
        )

        propagator = CompositePropagator(
            [
                TraceContextTextMapPropagator(),
                CloudTraceFormatPropagator(),
            ]
        )
    except ImportError:
        propagator = TraceContextTextMapPropagator()

    set_global_textmap(propagator)

    # ── Instrument FastAPI ──────────────────────────────────────────────
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="health,healthz,ready,readyz",
        )
        logger.info("FastAPI instrumented for tracing")
    except ImportError:
        logger.warning("opentelemetry-instrumentation-fastapi not installed")

    # ── Instrument httpx (outbound calls) ───────────────────────────────
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
        logger.info("httpx instrumented for tracing (outbound propagation)")
    except ImportError:
        logger.warning("opentelemetry-instrumentation-httpx not installed")

    logger.info(
        "Tracing initialized",
        extra={
            "service": service_name,
            "environment": environment,
            "exporter": "cloud_trace" if gcp_project else "console",
        },
    )


def get_tracer(name: str) -> object:
    """
    Get an OpenTelemetry tracer for manual span creation.

    Returns a no-op tracer if OTEL is not enabled or not installed.

    Usage:
        from shared.tracing import get_tracer
        tracer = get_tracer(__name__)

        with tracer.start_as_current_span("my-operation") as span:
            span.set_attribute("key", "value")
            # ... do work
    """
    try:
        from opentelemetry import trace

        return trace.get_tracer(name)
    except ImportError:
        # Return a no-op tracer stub
        class _NoOpSpan:
            def set_attribute(self, *a, **kw) -> None:
                pass

            def set_status(self, *a, **kw) -> None:
                pass

            def record_exception(self, *a, **kw) -> None:
                pass

            def __enter__(self) -> typing.Self:
                return self

            def __exit__(self, *a) -> None:
                pass

        class _NoOpTracer:
            def start_as_current_span(self, name, **kw) -> _NoOpSpan:
                return _NoOpSpan()

        return _NoOpTracer()
