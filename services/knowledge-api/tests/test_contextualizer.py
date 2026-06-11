from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.core.config import settings
from src.domain.models import Chunk
from src.domain.contextualizer import ContextualChunkAugmentor


@pytest.mark.asyncio
async def test_contextualizer_gateway_success() -> None:
    """Test contextualizer success in gateway mode (using mock httpx.Response)."""
    # Create fake chunks
    chunks = [
        Chunk(id="c1", document_id="doc1", org_id="default", content="This is chunk 1 text."),
        Chunk(id="c2", document_id="doc1", org_id="default", content="This is chunk 2 text."),
    ]

    doc_text = "This is the complete document text containing multiple pieces of information."

    # Mock create_service_client
    mock_client = AsyncMock()
    
    # Mock httpx response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "This is a contextual snippet to situating chunk."
                }
            }
        ]
    }
    mock_client.post.return_value = mock_response

    with patch("shared.http_client.create_service_client", return_value=mock_client):
        augmentor = ContextualChunkAugmentor(
            llm_url="http://mock-gateway/v1",
            llm_api_key="mock-key",
            model="gemini-2.0-flash",
            max_concurrent=2,
        )

        try:
            augmented = await augmentor.augment_chunks(doc_text, chunks)
            assert len(augmented) == 2
            assert augmented[0].content == "[Context: This is a contextual snippet to situating chunk.]\n\nThis is chunk 1 text."
            assert augmented[1].content == "[Context: This is a contextual snippet to situating chunk.]\n\nThis is chunk 2 text."
        finally:
            await augmentor.close()


@pytest.mark.asyncio
async def test_contextualizer_vertex_success() -> None:
    """Test contextualizer success in Vertex AI direct mode."""
    chunks = [
        Chunk(id="c1", document_id="doc1", org_id="default", content="This is chunk 1 text."),
    ]
    doc_text = "Full document context."

    # Mock genai client and response
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "This is direct Vertex AI context snippet."
    mock_genai_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    # Patch genai.Client
    with patch("google.genai.Client", return_value=mock_genai_client):
        augmentor = ContextualChunkAugmentor(
            llm_url=None,
            model="gemini-2.0-flash",
        )

        try:
            augmented = await augmentor.augment_chunks(doc_text, chunks)
            assert len(augmented) == 1
            assert augmented[0].content == "[Context: This is direct Vertex AI context snippet.]\n\nThis is chunk 1 text."
        finally:
            await augmentor.close()


@pytest.mark.asyncio
async def test_contextualizer_graceful_fallback() -> None:
    """Test that contextualizer handles errors gracefully without modifying chunk content."""
    chunks = [
        Chunk(id="c1", document_id="doc1", org_id="default", content="Chunk content unchanged."),
    ]
    doc_text = "Full document."

    mock_client = AsyncMock()
    mock_client.post.side_effect = Exception("Gateway Timeout")

    with patch("shared.http_client.create_service_client", return_value=mock_client):
        augmentor = ContextualChunkAugmentor(
            llm_url="http://mock-gateway/v1",
            max_concurrent=1,
        )

        try:
            augmented = await augmentor.augment_chunks(doc_text, chunks)
            assert len(augmented) == 1
            assert augmented[0].content == "Chunk content unchanged."
        finally:
            await augmentor.close()


def test_internal_store_integration_with_contextual_retrieval(client: TestClient) -> None:
    """Test store document with CONTEXTUAL_RETRIEVAL_ENABLED enabled."""
    original_enabled = settings.CONTEXTUAL_RETRIEVAL_ENABLED
    settings.CONTEXTUAL_RETRIEVAL_ENABLED = True

    try:
        # Mock augmentor.augment_chunks to prepend mock text
        async def mock_augment_chunks(doc_text, chunks):
            for c in chunks:
                c.content = f"[Context: Mocked Context]\n\n{c.content}"
            return chunks

        with patch("src.domain.contextualizer.ContextualChunkAugmentor.augment_chunks", side_effect=mock_augment_chunks), \
             patch("src.domain.contextualizer.ContextualChunkAugmentor.close", return_value=None):
            
            resp = client.post(
                "/v1/internal/store",
                json={
                    "org_id": "default",
                    "stream_id": "dev",
                    "content": "This is a document about tomatoes.",
                    "metadata": {
                        "title": "Tomatoes Doc",
                        "document_type": "product",
                    },
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["chunk_count"] > 0
            doc_id = data["document_id"]

            # Query the stored content to verify the context has been prepended
            content_resp = client.get(f"/v1/documents/{doc_id}")
            assert content_resp.status_code == 200
            doc_data = content_resp.json()
            # Let's search for "Mocked Context" in search
            search_resp = client.post(
                "/v1/search",
                json={
                    "query": "tomatoes",
                    "mode": "keyword",
                    "include_pending": True,
                }
            )
            assert search_resp.status_code == 200
            results = search_resp.json()["results"]
            assert results
            assert "Mocked Context" in results[0]["content"]

    finally:
        settings.CONTEXTUAL_RETRIEVAL_ENABLED = original_enabled
