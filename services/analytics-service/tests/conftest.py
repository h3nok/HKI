"""
Shared test fixtures for analytics-service.
"""

from __future__ import annotations

import collections.abc
import os
import typing
import unittest.mock

import fastapi.testclient
import pytest

os.environ["AUTH_ENABLED"] = "false"
os.environ["DATABASE_URL"] = ""
os.environ["ENVIRONMENT"] = "test"
os.environ["OTEL_ENABLED"] = "false"
os.environ["CORS_ORIGINS"] = '["http://localhost:9001","http://localhost:9002","http://localhost:3000"]'


@pytest.fixture(autouse=True)
def _disable_auth() -> collections.abc.Generator[None, typing.Any, None]:
    """Disable JWT auth for all tests."""
    with unittest.mock.patch.dict(
        os.environ,
        {
            "AUTH_ENABLED": "false",
            "DATABASE_URL": "",
            "ENVIRONMENT": "test",
            "OTEL_ENABLED": "false",
            "CORS_ORIGINS": '["http://localhost:9001","http://localhost:9002","http://localhost:3000"]',
        },
    ):
        yield


@pytest.fixture()
def client(_disable_auth) -> collections.abc.Generator[fastapi.testclient.TestClient, typing.Any, None]:
    """TestClient with auth disabled."""
    from src.api.app import app

    with fastapi.testclient.TestClient(app) as c:
        yield c


@pytest.fixture()
def mock_settings() -> dict[str, str]:
    """Commonly overridden settings for test isolation."""
    return {
        "DATABASE_URL": "",
        "ENVIRONMENT": "test",
        "AUTH_ENABLED": "false",
        "OTEL_ENABLED": "false",
    }
