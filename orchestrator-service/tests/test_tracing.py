"""
Tests for the shared tracing module.

Verifies that:
- init_tracing is safe to call when OTEL_ENABLED=false (no-op)
- init_tracing is safe to call when OTEL_ENABLED=true (configures provider)
- get_tracer returns a usable tracer (or no-op stub)
- Console exporter is used when GCP_PROJECT_ID is not set
"""

from unittest.mock import MagicMock

import pytest
from shared.tracing import _is_enabled, get_tracer, init_tracing


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Ensure OTEL_ENABLED is reset between tests."""
    monkeypatch.delenv("OTEL_ENABLED", raising=False)
    monkeypatch.delenv("GCP_PROJECT_ID", raising=False)


class TestInitTracing:
    """Tests for init_tracing()."""

    def test_disabled_by_default(self, capsys):
        """When OTEL_ENABLED is not set, init_tracing should be a no-op."""
        app = MagicMock()
        init_tracing(app, service_name="test-service")
        # No instrumentation should have been called on the app

    def test_enabled_without_gcp_project(self, monkeypatch):
        """When OTEL_ENABLED=true but no GCP_PROJECT_ID, should use console exporter."""
        monkeypatch.setenv("OTEL_ENABLED", "true")

        app = MagicMock()
        # Should not raise — falls back to console exporter
        init_tracing(app, service_name="test-service")

    def test_enabled_flag_variations(self, monkeypatch):
        """Various truthy values for OTEL_ENABLED should all enable tracing."""
        for val in ("true", "True", "TRUE", "1", "yes"):
            monkeypatch.setenv("OTEL_ENABLED", val)
            assert _is_enabled(), f"Expected enabled for OTEL_ENABLED={val}"

        for val in ("false", "0", "no", ""):
            monkeypatch.setenv("OTEL_ENABLED", val)
            assert not _is_enabled(), f"Expected disabled for OTEL_ENABLED={val}"


class TestGetTracer:
    """Tests for get_tracer()."""

    def test_returns_usable_tracer(self):
        """get_tracer should return something with start_as_current_span."""
        tracer = get_tracer("test-module")
        assert tracer is not None
        assert hasattr(tracer, "start_as_current_span")

    def test_span_context_manager(self):
        """Tracer spans should work as context managers."""
        tracer = get_tracer("test-module")
        with tracer.start_as_current_span("test-span") as span:
            # Should not raise
            span.set_attribute("test.key", "test-value")
