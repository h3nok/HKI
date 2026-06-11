"""
Contextualizer — LLM-based chunk contextualization (Anthropic Contextual Retrieval).

Generates a 1-2 sentence context summary for each text chunk using the full
document context and prepends it to the chunk's content to improve retrieval
relevance.
"""

from __future__ import annotations

import asyncio
import os
import typing

from src.core.logging import logger as _root_logger

if typing.TYPE_CHECKING:
    from src.domain.models import Chunk

logger = _root_logger.getChild("contextualizer")

# Standard prompt for chunk contextualization, following Anthropic's guidelines.
_CONTEXT_PROMPT = """\
<document>
{document_text}
</document>

Here is the chunk we want to situate:
<chunk>
{chunk_text}
</chunk>

Please provide a short, 1-2 sentence context snippet to situate this chunk within the overall document to improve search retrieval.
Do not summarize the entire document; directly write the context for the chunk.
Do not use introductory phrases like "This chunk describes..." or "In this document...". Just write the 1-2 sentences directly.
"""


class ContextualChunkAugmentor:
    """
    Augments chunks with document-level context using Gemini via the gateway or direct Vertex AI.
    """

    def __init__(
        self,
        llm_url: str | None = None,
        llm_api_key: str | None = None,
        model: str = "gemini-2.0-flash",
        max_concurrent: int = 5,
        timeout: float = 30.0,
    ) -> None:
        self._llm_url = llm_url.rstrip("/") if llm_url else None
        self._api_key = llm_api_key or "unused"
        self._model = model
        self._semaphore = asyncio.Semaphore(max_concurrent)

        if self._llm_url:
            from shared.http_client import create_service_client
            self._http = create_service_client("knowledge-api-contextualizer", timeout=timeout)
            self._genai_client = None
            logger.info("Contextualizer initialized in Gateway mode", extra={"url": self._llm_url, "model": self._model})
        else:
            # Vertex AI direct mode
            os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
            import src.core.config
            project = src.core.config.settings.GCP_PROJECT_ID
            location = getattr(src.core.config.settings, "VERTEX_AI_LOCATION", "us-central1")
            if project:
                os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project)
            if location:
                os.environ.setdefault("GOOGLE_CLOUD_LOCATION", location)

            from google import genai
            self._genai_client = genai.Client()
            self._http = None
            logger.info("Contextualizer initialized in Vertex AI direct mode", extra={"model": self._model, "project": project})

    async def close(self) -> None:
        """Clean up HTTP connections."""
        if self._http:
            await self._http.aclose()

    async def augment_chunks(self, document_text: str, chunks: list[Chunk]) -> list[Chunk]:
        """
        Augment a list of chunks in-place by prepending document-level context.
        """
        if not chunks or not document_text.strip():
            return chunks

        # Truncate document context if it is excessively long to prevent token overhead
        doc_truncated = document_text[:120000] if len(document_text) > 120000 else document_text

        async def _augment_single(chunk: Chunk) -> None:
            async with self._semaphore:
                try:
                    snippet = await self._generate_snippet(doc_truncated, chunk.content)
                    if snippet:
                        chunk.content = f"[Context: {snippet}]\n\n{chunk.content}"
                except Exception as exc:
                    logger.warning(
                        "Failed to generate context snippet for chunk",
                        extra={"chunk_id": chunk.id, "error": str(exc)},
                    )

        # Run all chunk augmentations concurrently
        await asyncio.gather(*[_augment_single(c) for c in chunks])
        return chunks

    async def _generate_snippet(self, document_text: str, chunk_text: str) -> str:
        """Generate a single context snippet using the appropriate LLM client."""
        prompt = _CONTEXT_PROMPT.format(document_text=document_text, chunk_text=chunk_text)

        if self._llm_url:
            # Gateway mode
            payload = {
                "model": self._model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.0,
                "max_tokens": 150,
            }
            resp = await self._http.post(
                f"{self._llm_url}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            # Vertex AI direct mode
            response = await self._genai_client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config={
                    "temperature": 0.0,
                    "max_output_tokens": 150,
                }
            )
            return response.text.strip()
