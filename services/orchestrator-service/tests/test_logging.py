"""
Tests for GCP Cloud Logging formatter.
"""

from __future__ import annotations

import json
import logging

from src.core.logging import GCPJsonFormatter


class TestGCPJsonFormatter:
    def _make_record(self, msg: str = "test message", level: int = logging.INFO) -> logging.LogRecord:
        return logging.LogRecord(
            name="test-logger",
            level=level,
            pathname="/app/src/core/auth.py",
            lineno=42,
            msg=msg,
            args=(),
            exc_info=None,
            func="verify_request_jwt",
        )

    def test_severity_mapped_from_levelname(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record(level=logging.WARNING)
        output = json.loads(fmt.format(record))
        assert output["severity"] == "WARNING"
        assert "levelname" not in output

    def test_timestamp_present(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record()
        output = json.loads(fmt.format(record))
        assert "timestamp" in output
        assert "asctime" not in output

    def test_source_location(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record()
        output = json.loads(fmt.format(record))
        loc = output["logging.googleapis.com/sourceLocation"]
        assert loc["file"] == "/app/src/core/auth.py"
        assert loc["line"] == 42
        assert loc["function"] == "verify_request_jwt"

    def test_service_context(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record()
        output = json.loads(fmt.format(record))
        ctx = output["serviceContext"]
        assert "service" in ctx
        assert "version" in ctx

    def test_message_preserved(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record(msg="hello world")
        output = json.loads(fmt.format(record))
        assert output["message"] == "hello world"

    def test_extra_fields_passed_through(self):
        fmt = GCPJsonFormatter(fmt="%(message)s")
        record = self._make_record()
        record.user_id = "99"
        output = json.loads(fmt.format(record))
        assert output["user_id"] == "99"
