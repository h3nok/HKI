"""
Shared test fixtures for ingestion-pipeline-service.
"""

from __future__ import annotations

import collections.abc
import os
import typing
import unittest.mock

import fastapi.testclient
import httpx
import pytest

os.environ["AUTH_ENABLED"] = "false"
os.environ["ENVIRONMENT"] = "test"
os.environ["OTEL_ENABLED"] = "false"
os.environ["REDIS_URL"] = ""
os.environ["KNOWLEDGE_API_URL"] = "http://test-knowledge:9509"


class _StubKnowledgeApiClient:
    def __init__(self) -> None:
        self._document_counter = 0

    async def get(self, url: str, *args: typing.Any, **kwargs: typing.Any) -> httpx.Response:
        if url.endswith("/health"):
            return httpx.Response(
                200,
                json={"status": "ok"},
                request=httpx.Request("GET", url),
            )
        return httpx.Response(
            200,
            text="stubbed test content",
            request=httpx.Request("GET", url),
        )

    async def post(
        self,
        url: str,
        *args: typing.Any,
        **kwargs: typing.Any,
    ) -> httpx.Response:
        self._document_counter += 1
        if url.endswith("/v1/internal/store"):
            return httpx.Response(
                200,
                json={
                    "document_id": f"doc-{self._document_counter}",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                },
                request=httpx.Request("POST", url),
            )
        return httpx.Response(
            200,
            json={"status": "ok"},
            request=httpx.Request("POST", url),
        )

    async def patch(self, url: str, *args: typing.Any, **kwargs: typing.Any) -> httpx.Response:
        return httpx.Response(
            200,
            json={"status": "ok"},
            request=httpx.Request("PATCH", url),
        )

    async def aclose(self) -> None:
        return None


@pytest.fixture(autouse=True)
def _disable_auth() -> collections.abc.Generator[None, typing.Any, None]:
    """Disable JWT auth for all tests."""
    with unittest.mock.patch.dict(
        os.environ,
        {
            "AUTH_ENABLED": "false",
            "ENVIRONMENT": "test",
            "OTEL_ENABLED": "false",
            "REDIS_URL": "",
            "KNOWLEDGE_API_URL": "http://test-knowledge:9509",
        },
    ):
        yield


@pytest.fixture()
def client(_disable_auth) -> collections.abc.Generator[fastapi.testclient.TestClient, typing.Any, None]:
    """TestClient with auth disabled."""
    from src.api.app import app

    with fastapi.testclient.TestClient(app) as c:
        stub_http = _StubKnowledgeApiClient()
        c.app.state.http = stub_http
        c.app.state.pipeline._http = stub_http  # type: ignore[union-attr]
        yield c


@pytest.fixture()
def mock_settings() -> dict[str, str]:
    """Commonly overridden settings for test isolation."""
    return {
        "KNOWLEDGE_API_URL": "http://test-knowledge:9509",
        "REDIS_URL": "",
        "ENVIRONMENT": "test",
        "AUTH_ENABLED": "false",
        "OTEL_ENABLED": "false",
    }
