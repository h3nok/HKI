"""
Corrective RAG — self-healing retrieval with Gemini as retrieval judge.

When the orchestrator calls search_knowledge and gets results back, this
module evaluates whether those results actually answer the user's query.
If relevance is below threshold, it rewrites the query and signals a retry.
If retry also fails, it flags a knowledge gap for the Gaps tab.

Architecture:
    evaluate_retrieval()  — score chunk relevance via Gemini Flash
    rewrite_query()       — generate a refined search query
    RetrievalQuality      — result model with scores and rewrite suggestion

Design:
    Uses Gemini Flash with structured JSON output for fast (<300ms) evaluation.
    Falls back to heuristic scoring when Gemini is unavailable.
"""

from __future__ import annotations

import json
import typing

import pydantic

import src.adapters.llm_client
import src.core.config
import src.core.logging  # noqa: I001

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class ChunkRelevance(pydantic.BaseModel):
    """Relevance assessment for a single retrieved chunk."""

    chunk_index: int
    score: float = 0.0  # 0.0–1.0
    reason: str = ""


class RetrievalQuality(pydantic.BaseModel):
    """Overall quality assessment of a retrieval result set."""

    max_relevance: float = 0.0
    avg_relevance: float = 0.0
    relevant_count: int = 0
    total_count: int = 0
    is_sufficient: bool = False
    rewritten_query: str | None = None
    gap_description: str | None = None
    chunk_scores: list[ChunkRelevance] = pydantic.Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Evaluation
# ═══════════════════════════════════════════════════════════════════════════════


_EVAL_SYSTEM_PROMPT = """You are a retrieval quality evaluator for an enterprise knowledge base.

Given a user query and retrieved chunks, score each chunk's relevance to the query
on a 0.0-1.0 scale.

SCORING:
- 1.0: Directly answers the query with specific information
- 0.7-0.9: Highly relevant, contains key information for answering
- 0.4-0.6: Partially relevant, tangentially related
- 0.1-0.3: Mostly irrelevant, only keyword overlap
- 0.0: Completely irrelevant

Return ONLY a JSON object with this exact schema:
{
  "scores": [{"index": 0, "score": 0.8, "reason": "brief reason"}],
  "sufficient": true/false,
  "gap": "description of missing information if not sufficient, else null"
}"""


async def evaluate_retrieval(
    llm: src.adapters.llm_client.LLMClient,
    query: str,
    chunks: list[dict[str, typing.Any]],
    min_relevance: float | None = None,
) -> RetrievalQuality:
    """
    Evaluate retrieval quality using Gemini Flash as a judge.

    Falls back to heuristic scoring (based on existing relevance scores
    from the vector search) when the LLM call fails.

    Args:
        llm: The shared LLM client.
        query: The original user query.
        chunks: Retrieved chunks with 'content' and 'score' fields.
        min_relevance: Override the config threshold.

    Returns:
        RetrievalQuality with per-chunk scores and sufficiency flag.
    """
    threshold = min_relevance or src.core.config.settings.CORRECTIVE_RAG_MIN_RELEVANCE

    if not chunks:
        return RetrievalQuality(
            total_count=0,
            is_sufficient=False,
            gap_description=f"No results found for: {query}",
        )

    # Try LLM-based evaluation
    try:
        chunk_text: str = "\n\n".join(
            f"[Chunk {i}] (score={c.get('score', 0):.3f}): {c.get('content', '')[:500]}"
            for i, c in enumerate(chunks[:10])  # Cap at 10 chunks for prompt size
        )

        response = await llm.chat(
            messages=[
                {"role": "system", "content": _EVAL_SYSTEM_PROMPT},
                {"role": "user", "content": f"QUERY: {query}\n\nRETRIEVED CHUNKS:\n{chunk_text}"},
            ],
            model=src.core.config.settings.LLM_MODEL_FAST,
            temperature=0.0,
            max_tokens=500,
        )

        raw = (response.content or "").strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(raw)
        scores = parsed.get("scores", [])
        is_sufficient = parsed.get("sufficient", False)
        gap = parsed.get("gap")

        chunk_scores: list[ChunkRelevance] = [
            ChunkRelevance(
                chunk_index=s.get("index", i),
                score=float(s.get("score", 0)),
                reason=s.get("reason", ""),
            )
            for i, s in enumerate(scores)
        ]

        max_rel: float = max((chunk.score for chunk in chunk_scores), default=0.0)
        avg_rel: float = (
            sum(chunk.score for chunk in chunk_scores) / len(chunk_scores)
            if chunk_scores
            else 0.0
        )
        relevant: int = sum(1 for chunk in chunk_scores if chunk.score >= threshold)

        return RetrievalQuality(
            max_relevance=round(max_rel, 3),
            avg_relevance=round(avg_rel, 3),
            relevant_count=relevant,
            total_count=len(chunks),
            is_sufficient=is_sufficient and max_rel >= threshold,
            gap_description=gap if not is_sufficient else None,
            chunk_scores=chunk_scores,
        )

    except (src.adapters.llm_client.LLMError, json.JSONDecodeError, KeyError, TypeError) as exc:
        src.core.logging.logger.warning(
            "Corrective RAG LLM eval failed, using heuristic",
            extra={"error": str(exc)},
        )
        return _heuristic_eval(chunks, threshold)


def _heuristic_eval(chunks: list[dict[str, typing.Any]], threshold: float) -> RetrievalQuality:
    """Fallback: use the vector search scores directly."""
    scores: list[float] = [float(chunk.get("score", 0)) for chunk in chunks]
    max_rel: float = max(scores) if scores else 0.0
    avg_rel: float = sum(scores) / len(scores) if scores else 0.0
    relevant: int = sum(1 for score in scores if score >= threshold)

    chunk_scores: list[ChunkRelevance] = [
        ChunkRelevance(chunk_index=i, score=s, reason="vector_score") for i, s in enumerate(scores)
    ]

    return RetrievalQuality(
        max_relevance=round(max_rel, 3),
        avg_relevance=round(avg_rel, 3),
        relevant_count=relevant,
        total_count=len(chunks),
        is_sufficient=max_rel >= threshold,
        gap_description=(
            f"Low retrieval quality (max={max_rel:.2f})" if max_rel < threshold else None
        ),
        chunk_scores=chunk_scores,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Query Rewriting
# ═══════════════════════════════════════════════════════════════════════════════


_REWRITE_SYSTEM_PROMPT = """You are a search query optimizer for an enterprise knowledge base
containing retail policies, SOPs, product standards, and operational procedures.

The original query returned irrelevant results. Rewrite the query to improve retrieval.

RULES:
1. Return ONLY the rewritten query string — no explanation, no quotes, no prefix
2. Be more specific — add domain terms the knowledge base likely contains
3. Try synonyms and alternative phrasings
4. Keep it under 100 characters
5. Focus on the user's actual information need"""


async def rewrite_query(
    llm: src.adapters.llm_client.LLMClient,
    original_query: str,
    failed_topics: list[str] | None = None,
) -> str | None:
    """
    Generate a refined search query when initial retrieval fails.

    Args:
        llm: The shared LLM client.
        original_query: The query that produced poor results.
        failed_topics: Topics the irrelevant chunks were about (for negative guidance).

    Returns:
        Rewritten query string, or None if rewriting fails.
    """
    try:
        context: str = f"ORIGINAL QUERY: {original_query}"
        if failed_topics:
            context += f"\nIRRELEVANT TOPICS RETURNED: {', '.join(failed_topics[:5])}"

        response = await llm.chat(
            messages=[
                {"role": "system", "content": _REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": context},
            ],
            model=src.core.config.settings.LLM_MODEL_FAST,
            temperature=0.3,
            max_tokens=100,
        )

        rewritten = (response.content or "").strip().strip('"').strip("'")
        if rewritten and rewritten != original_query and len(rewritten) < 200:
            src.core.logging.logger.info(
                "Query rewritten",
                extra={"original": original_query, "rewritten": rewritten},
            )
            return rewritten
        return None

    except src.adapters.llm_client.LLMError as exc:
        src.core.logging.logger.warning(
            "Query rewrite failed",
            extra={"error": str(exc)},
        )
        return None
