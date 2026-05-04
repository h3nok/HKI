"""Tests for shared.logging — GCPJsonFormatter and setup_logging."""

from __future__ import annotations

import json
import logging


class TestGCPJsonFormatter:
    """Test the structured JSON formatter."""

    def test_severity_field(self) -> None:
        from shared.logging import GCPJsonFormatter

        fmt = GCPJsonFormatter(service_name="test-svc")
        record = logging.LogRecord(
            name="test",
            level=logging.WARNING,
            pathname="test.py",
            lineno=10,
            msg="hello",
            args=(),
            exc_info=None,
        )
        output = fmt.format(record)
        data = json.loads(output)
        assert data["severity"] == "WARNING"
        assert "levelname" not in data

    def test_service_context(self) -> None:
        from shared.logging import GCPJsonFormatter

        fmt = GCPJsonFormatter(service_name="my-service")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="msg",
            args=(),
            exc_info=None,
        )
        output = fmt.format(record)
        data = json.loads(output)
        assert data["serviceContext"]["service"] == "my-service"

    def test_source_location(self) -> None:
        from shared.logging import GCPJsonFormatter

        fmt = GCPJsonFormatter(service_name="svc")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="/app/main.py",
            lineno=42,
            msg="test",
            args=(),
            exc_info=None,
        )
        record.funcName = "my_function"
        output = fmt.format(record)
        data = json.loads(output)
        loc = data["logging.googleapis.com/sourceLocation"]
        assert loc["file"] == "/app/main.py"
        assert loc["line"] == 42
        assert loc["function"] == "my_function"

    def test_timestamp_present(self) -> None:
        from shared.logging import GCPJsonFormatter

        fmt = GCPJsonFormatter(service_name="svc")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="t.py",
            lineno=1,
            msg="msg",
            args=(),
            exc_info=None,
        )
        output = fmt.format(record)
        data = json.loads(output)
        assert "timestamp" in data
        assert "asctime" not in data

    def test_request_id_injected(self, monkeypatch: None) -> None:
        """request_id_var value is injected as requestId field."""
        from shared.logging import GCPJsonFormatter
        from shared.middleware import request_id_var

        token = request_id_var.set("req-abc-123")
        try:
            fmt = GCPJsonFormatter(service_name="svc")
            record = logging.LogRecord(
                name="test",
                level=logging.INFO,
                pathname="t.py",
                lineno=1,
                msg="msg",
                args=(),
                exc_info=None,
            )
            output = fmt.format(record)
            data = json.loads(output)
            assert data["requestId"] == "req-abc-123"
        finally:
            request_id_var.reset(token)

    def test_no_request_id_when_empty(self) -> None:
        """When request_id_var is empty, requestId field is omitted."""
        from shared.logging import GCPJsonFormatter

        fmt = GCPJsonFormatter(service_name="svc")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="t.py",
            lineno=1,
            msg="msg",
            args=(),
            exc_info=None,
        )
        output = fmt.format(record)
        data = json.loads(output)
        assert "requestId" not in data

    def test_gcp_trace_correlation(self, monkeypatch: None) -> None:
        """Trace ID from env var is injected when project is set."""
        import os

        from shared.logging import GCPJsonFormatter

        os.environ["GCP_PROJECT_ID"] = "my-project"
        os.environ["X_CLOUD_TRACE_CONTEXT"] = "abc123def456/789;o=1"
        try:
            fmt = GCPJsonFormatter(service_name="svc")
            record = logging.LogRecord(
                name="test",
                level=logging.INFO,
                pathname="t.py",
                lineno=1,
                msg="msg",
                args=(),
                exc_info=None,
            )
            output = fmt.format(record)
            data = json.loads(output)
            assert (
                data["logging.googleapis.com/trace"]
                == "projects/my-project/traces/abc123def456"
            )
        finally:
            os.environ.pop("GCP_PROJECT_ID", None)
            os.environ.pop("X_CLOUD_TRACE_CONTEXT", None)


class TestSetupLogging:
    """Test the setup_logging function."""

    def test_returns_named_logger(self) -> None:
        from shared.logging import setup_logging

        # Clear any previously configured handlers to avoid skip
        root = logging.getLogger()
        root.handlers.clear()

        logger = setup_logging(service_name="test-svc", log_level="DEBUG")
        assert logger.name == "test-svc"
        assert root.level == logging.DEBUG

    def test_idempotent_on_reload(self) -> None:
        """Calling setup_logging twice doesn't add duplicate handlers."""
        from shared.logging import setup_logging

        root = logging.getLogger()
        root.handlers.clear()

        setup_logging(service_name="svc1")
        handler_count = len(root.handlers)
        setup_logging(service_name="svc1")
        assert len(root.handlers) == handler_count

    def test_empty_service_name_returns_root(self) -> None:
        from shared.logging import setup_logging

        root = logging.getLogger()
        root.handlers.clear()

        logger = setup_logging()
        assert logger is root
