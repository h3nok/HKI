"""
Embedding Client — generates dense vectors for text chunks.

Two backends:
  1. **Gateway** (``EmbeddingClient``): OpenAI-compatible ``/embeddings``
     endpoint via LiteLLM or APIGEE X.  Used when ``EMBEDDING_GATEWAY_URL``
     is set and non-empty.
  2. **Vertex AI direct** (``VertexAIEmbeddingClient``): Calls
     ``text-embedding-004`` through ``google.genai`` using Application
     Default Credentials. Zero gateway dependency — lowest latency.

Usage:
    # Vertex AI direct (production on GCP):
    client = VertexAIEmbeddingClient()
    vectors = await client.embed(["Hello world", "Another sentence"])

    # Gateway mode (legacy):
    client = EmbeddingClient()
    vectors = await client.embed(["Hello world", "Another sentence"])
"""

# ruff: noqa: E501

from __future__ import annotations

import os
import typing

import google.genai.types
import httpx

import src.core.config
import src.core.logging

# ═══════════════════════════════════════════════════════════════════════════════
# Gateway-based client (OpenAI-compatible)
# ═══════════════════════════════════════════════════════════════════════════════


class EmbeddingClient:
    """Async embedding client that calls an OpenAI-compatible gateway."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        self._base_url = (base_url or src.core.config.settings.EMBEDDING_GATEWAY_URL).rstrip("/")
        self._api_key = api_key or src.core.config.settings.EMBEDDING_API_KEY
        self._model = model or src.core.config.settings.EMBEDDING_MODEL
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._api_key}",
            },
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        payload: dict[str, typing.Any] = {
            "model": self._model,
            "input": texts,
        }

        url: str = f"{self._base_url}/embeddings"
        src.core.logging.logger.info("Embedding request", extra={"model": self._model, "count": len(texts)})

        try:
            resp: httpx.Response = await self._client.post(url, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body: str = exc.response.text[:500]
            src.core.logging.logger.error(
                "Embedding error",
                extra={"status": exc.response.status_code, "body": body},
            )
            raise EmbeddingError(
                f"Embedding API returned {exc.response.status_code}: {body}"
            ) from exc
        except httpx.TimeoutException as exc:
            src.core.logging.logger.error("Embedding timeout")
            raise EmbeddingError("Embedding request timed out") from exc

        data = resp.json()
        embeddings: list[typing.Any] = sorted(data["data"], key=lambda x: x["index"])
        vectors: list[typing.Any] = [item["embedding"] for item in embeddings]

        src.core.logging.logger.info(
            "Embedding response",
            extra={"count": len(vectors), "dimensions": len(vectors[0]) if vectors else 0},
        )
        return vectors

    async def embed_single(self, text: str) -> list[float]:
        vectors: list[list[float]] = await self.embed([text])
        return vectors[0]


# ═══════════════════════════════════════════════════════════════════════════════
# Vertex AI direct client (google.genai + ADC)
# ═══════════════════════════════════════════════════════════════════════════════

_MAX_BATCH = 250  # Vertex AI embeddings API limit per request


class VertexAIEmbeddingClient:
    """
    Async embedding client using google.genai with Vertex AI backend.

    Authenticates via Application Default Credentials — no API key needed.
    Batches requests to stay within Vertex AI per-request limits.
    """

    def __init__(
        self,
        model: str | None = None,
        project: str | None = None,
        location: str | None = None,
    ) -> None:
        self._model = model or src.core.config.settings.EMBEDDING_MODEL
        self._project = project or src.core.config.settings.GCP_PROJECT_ID
        self._location: str | typing.Any = location or getattr(src.core.config.settings, "VERTEX_AI_LOCATION", "us-central1")

        os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
        if self._project:
            os.environ.setdefault("GOOGLE_CLOUD_PROJECT", self._project)
        if self._location:
            os.environ.setdefault("GOOGLE_CLOUD_LOCATION", self._location)

        from google import genai  # noqa: E402

        self._genai_client = genai.Client()
        src.core.logging.logger.info(
            "VertexAI embedding client initialized",
            extra={
                "model": self._model,
                "project": self._project,
                "location": self._location,
            },
        )

    async def close(self) -> None:
        pass  # google.genai client has no explicit close

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        src.core.logging.logger.info("Vertex AI embedding request", extra={"model": self._model, "count": len(texts)})

        all_vectors: list[list[float]] = []
        for i in range(0, len(texts), _MAX_BATCH):
            batch: list[str] = texts[i : i + _MAX_BATCH]
            try:
                response: google.genai.types.EmbedContentResponse = await self._genai_client.aio.models.embed_content(
                    model=self._model,
                    contents=batch,
                )
                batch_vectors: list[list[float] | None] = [
                    embedding.values for embedding in response.embeddings
                ]
                all_vectors.extend(batch_vectors)
            except Exception as exc:
                src.core.logging.logger.error(
                    "Vertex AI embedding error",
                    extra={"batch_start": i, "batch_size": len(batch), "error": str(exc)[:300]},
                )
                raise EmbeddingError(f"Vertex AI embedding failed: {exc}") from exc

        src.core.logging.logger.info(
            "Vertex AI embedding response",
            extra={
                "count": len(all_vectors),
                "dimensions": len(all_vectors[0]) if all_vectors else 0,
            },
        )
        return all_vectors

    async def embed_single(self, text: str) -> list[float]:
        vectors: list[list[float]] = await self.embed([text])
        return vectors[0]


# ═══════════════════════════════════════════════════════════════════════════════
# Shared exception
# ═══════════════════════════════════════════════════════════════════════════════


class EmbeddingError(Exception):
    """Raised when embedding generation fails (gateway or Vertex AI)."""
