"""
LLM Client — document contextualization via LiteLLM gateway.

Generates a concise context summary for a document, which is prepended
to the text before chunking. This gives every chunk awareness of the
full document's purpose, dramatically improving retrieval relevance.

Architecture:
    Called during the optional "Contextualize" pipeline stage.
    Routes all LLM calls through the LiteLLM gateway (OpenAI-compatible
    ``/v1/chat/completions``), ensuring consistent rate limiting,
    guardrails (DLP / prompt injection), model routing, and observability.

    When the gateway is unavailable, the pipeline gracefully degrades —
    documents are still ingested, just without contextual enrichment.

Configuration:
    LLM_GATEWAY_URL    — LiteLLM proxy base URL (default: http://localhost:4000/v1)
    LLM_API_KEY        — LiteLLM master key
    LLM_MODEL          — model name (default: gemini-2.0-flash)
"""

from __future__ import annotations

import asyncio
from typing import Any

from shared.http_client import create_service_client

from src.core.config import settings
from src.core.logging import logger
from src.domain.observability import emit, span

# Semaphore for concurrent LLM requests
_llm_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _llm_semaphore
    if _llm_semaphore is None:
        _llm_semaphore = asyncio.Semaphore(settings.LLM_MAX_CONCURRENT)
    return _llm_semaphore


_CONTEXT_PROMPT = """\
You are a document analysis assistant. Given the following document, write a \
concise context summary (2-3 sentences) that describes:
1. What this document is about
2. Its purpose or scope
3. The domain or department it belongs to

This summary will be prepended to every chunk of this document to improve \
search retrieval. Be factual and specific. Do not include opinions.

Document title: {title}
Department: {department}

--- DOCUMENT START ---
{text_preview}
--- DOCUMENT END ---

Context summary:"""


async def generate_document_context(
    text: str,
    title: str = "",
    department: str = "",
) -> str:
    """
    Generate a document-level context summary using Gemini.

    Args:
        text: Full document text.
        title: Document title (may be empty).
        department: Department classification.

    Returns:
        Context summary string, or empty string on failure.
    """
    if not settings.LLM_ENABLED:
        return ""

    # Use first ~4000 chars for context generation (enough for understanding)
    text_preview = text[:4000]

    prompt = _CONTEXT_PROMPT.format(
        title=title or "Untitled",
        department=department or "General",
        text_preview=text_preview,
    )

    async with _get_semaphore():
        try:
            with span(
                "llm.context",
                model=settings.LLM_MODEL,
                metadata={"title": title or "", "department": department or ""},
            ) as s:
                s["input_tokens"] = len(prompt.split())
                result = await _call_llm(prompt)
                s["output_tokens"] = len(result.split())
                return result
        except Exception as exc:
            logger.warning(
                "LLM context generation failed",
                extra={"error": str(exc), "title": title},
            )
            return ""


_ANSWER_PROMPT = """\
You are a knowledgeable assistant answering a user's question using ONLY the \
provided context chunks. Each chunk has a [Source N] label.

Rules:
1. Answer using ONLY information from the provided chunks.
2. Cite sources inline using [1], [2], etc.
3. If the chunks don't contain enough information, say so honestly.
4. Be concise, accurate, and helpful.
5. At the end, rate your confidence from 0.0 to 1.0 based on how well \
the chunks answer the question.

Format your response EXACTLY as:
ANSWER: <your answer with inline citations>
CONFIDENCE: <0.0 to 1.0>

Question: {query}

Context chunks:
{chunks_text}

Response:"""


async def generate_answer(
    query: str,
    chunks: list[dict],
) -> dict:
    """
    Generate a grounded answer from retrieved chunks using Gemini.

    Args:
        query: The user's question.
        chunks: List of dicts with 'content', 'score', 'metadata'.

    Returns:
        Dict with 'answer', 'confidence', 'citations'.
    """
    if not settings.LLM_ENABLED:
        return {
            "answer": "",
            "confidence": 0.0,
            "citations": [],
            "error": "LLM is not enabled",
        }

    # Build numbered chunk text
    chunk_lines = []
    citations = []
    for i, chunk in enumerate(chunks[:10], 1):  # limit to top 10
        title = chunk.get("metadata", {}).get("title", "Untitled")
        content = chunk.get("content", "")[:800]
        score = chunk.get("score", 0)
        score_scale = chunk.get(
            "score_scale",
            "normalized" if isinstance(score, (int, float)) and 0 <= score <= 1 else "raw_rank",
        )
        chunk_lines.append(f"[Source {i}] (title: {title}, score: {score:.2f})\n{content}\n")
        citations.append(
            {
                "index": i,
                "title": title,
                "score": score,
                "score_scale": score_scale,
                "document_id": chunk.get("metadata", {}).get("document_id", ""),
            }
        )

    chunks_text = "\n".join(chunk_lines)
    prompt = _ANSWER_PROMPT.format(query=query, chunks_text=chunks_text)

    async with _get_semaphore():
        try:
            with span(
                "llm.generate_answer",
                model=settings.LLM_MODEL,
                metadata={"query": query[:100], "chunk_count": len(chunks)},
            ) as s:
                s["input_tokens"] = len(prompt.split())
                raw = await _call_llm(prompt)
                s["output_tokens"] = len(raw.split())
        except Exception as exc:
            emit(
                "llm.generate_answer",
                status="error",
                model=settings.LLM_MODEL,
                error=str(exc),
                metadata={"query": query[:100]},
            )
            return {
                "answer": "",
                "confidence": 0.0,
                "citations": citations,
                "error": str(exc),
            }

    # Parse ANSWER: and CONFIDENCE: from response
    answer = raw
    confidence = 0.5
    if "ANSWER:" in raw:
        parts = raw.split("CONFIDENCE:")
        answer = parts[0].replace("ANSWER:", "").strip()
        if len(parts) > 1:
            try:
                confidence = float(parts[1].strip().split()[0])
                confidence = max(0.0, min(1.0, confidence))
            except (ValueError, IndexError):
                confidence = 0.5

    return {
        "answer": answer,
        "confidence": confidence,
        "citations": citations,
    }


async def _call_llm(prompt: str) -> str:
    """
    Call LLM via either the LiteLLM gateway or Vertex AI directly.

    When ``LLM_GATEWAY_URL`` is set and non-empty, uses the OpenAI-compatible
    ``/chat/completions`` endpoint.  Otherwise, uses ``google.genai`` with
    Application Default Credentials for zero-gateway Vertex AI calls.
    """
    if settings.LLM_GATEWAY_URL:
        return await _call_llm_gateway(prompt)
    return await _call_llm_vertex(prompt)


async def _call_gemini(prompt: str) -> str:
    """
    Backward-compatible wrapper used by pre-ingest heuristics.

    Several local analysis helpers still import ``_call_gemini`` directly.
    Keep this alias so the analysis path does not silently fall back when
    the shared LLM client implementation is renamed.
    """
    return await _call_llm(prompt)


async def _call_llm_gateway(prompt: str) -> str:
    url = f"{settings.LLM_GATEWAY_URL.rstrip('/')}/chat/completions"

    payload: dict[str, Any] = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": settings.LLM_CONTEXT_MAX_TOKENS,
        "temperature": 0.1,
    }

    async with create_service_client(
        "pipeline-llm",
        timeout=30.0,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LLM_API_KEY}",
        },
    ) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices", [])
    if choices:
        content = choices[0].get("message", {}).get("content", "")
        return content.strip()

    return ""


async def _call_llm_vertex(prompt: str) -> str:
    import os

    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
    if settings.GCP_PROJECT_ID:
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.GCP_PROJECT_ID)
    location = getattr(settings, "VERTEX_AI_LOCATION", None) or settings.GCP_LOCATION
    if location:
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", location)

    from google import genai
    from google.genai import types as genai_types

    client = genai.Client()
    response = await client.aio.models.generate_content(
        model=settings.LLM_MODEL,
        contents=genai_types.Content(
            role="user",
            parts=[genai_types.Part.from_text(text=prompt)],
        ),
        config=genai_types.GenerateContentConfig(
            max_output_tokens=settings.LLM_CONTEXT_MAX_TOKENS,
            temperature=0.1,
        ),
    )

    if response.text:
        return response.text.strip()
    return ""
