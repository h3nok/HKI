"""
Shared test fixtures for orchestrator-service.

Provides a pre-configured ``TestClient`` with auth disabled, as well as
mock settings and async helpers reusable across all test modules.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _disable_auth():
    """Disable JWT auth for all tests unless explicitly overridden."""
    with patch.dict(os.environ, {"AUTH_ENABLED": "false"}):
        yield


@pytest.fixture()
def client(_disable_auth):
    """TestClient with auth disabled."""
    from src.api.app import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def mock_settings():
    """Return a dict of commonly overridden settings for test isolation."""
    return {
        "REDIS_URL": "",
        "LLM_GATEWAY_URL": "http://test-llm:4000/v1",
        "LLM_API_KEY": "test-key",
        "ENVIRONMENT": "test",
        "AUTH_ENABLED": "false",
        "OTEL_ENABLED": "false",
    }
