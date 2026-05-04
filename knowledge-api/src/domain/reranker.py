"""
Chunk Reranker — LLM-based pointwise relevance rescoring.

After hybrid retrieval (RRF), re-scores the top-k candidate chunks by asking
Gemini to rate the relevance of each chunk to the query. All chunks are scored
in ONE batch LLM call (O(1) latency), adding ~200–400 ms vs. N calls.

Why: RRF is a rank-fusion heuristic over BM25 and cosine similarity ranks.
It doesn't understand nuanced query intent. The LLM judges each (query, chunk)
pair for true semantic relevance, catching cases where the retrieval signals
disagreed or where lexical overlap is misleading.

Usage:
    reranker = ChunkReranker(llm_url=settings.EMBEDDING_GATEWAY_URL, ...)
    reranked = await reranker.rerank(query, results, top_k=5)
    # Falls back to original RRF order if LLM call fails.
"""

from __future__ import annotations

import json
import logging

import httpx

import src.domain.models

logger: logging.Logger = logging.getLogger("knowledge.reranker")


_RERANK_PROMPT = """\
You are a precision relevance-scoring engine for enterprise knowledge retrieval.
Given a search query and a numbered list of text chunks, score each chunk's
relevance to the query.

## Query
{query}

## Chunks
{chunks}

## Scoring Rubric
- 10: Chunk directly and completely answers the query
-  8: Chunk is highly relevant, addresses most aspects of the query
-  6: Chunk is relevant, addresses some aspects or provides useful context
-  4: Chunk is tangentially related — useful background but not a direct answer
-  2: Chunk is mostly irrelevant, only incidental keyword overlap
-  0: Chunk is completely irrelevant

Score on semantic relevance, not keyword overlap. A chunk is highly relevant if
it helps answer the query even if it uses different wording. Be strict: most
queries have at most 2–3 truly relevant chunks.

Return ONLY a JSON object with no markdown, no explanation:
{{"scores": [<score for chunk 1>, <score for chunk 2>, ...]}}

The "scores" array must have exactly {count} numbers.
"""


class ChunkReranker:
    """
    LLM-based pointwise chunk reranker.

    Sends all top-k candidates in a single batch prompt to Gemini and
    re-sorts by the returned relevance scores. Falls back to the original
    RRF ordering silently on any LLM failure.

    The reranker intentionally does NOT raise exceptions — retrieval
    quality degrading to RRF order is always preferable to a 500.
    """

    def __init__(
        self,
        llm_url: str,
        api_key: str,
        model: str = "gemini-2.0-flash",
        timeout: float = 15.0,
        max_chunk_chars: int = 1200,
    ) -> None:
        self._llm_url: str = llm_url.rstrip("/")
        self._api_key: str = api_key
        self._model: str = model
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(timeout))
        self._max_chunk_chars: int = max_chunk_chars

    async def close(self) -> None:
        await self._http.aclose()

    async def rerank(
        self,
        query: str,
        results: list[src.domain.models.SearchResult],
        top_k: int | None = None,
    ) -> list[src.domain.models.SearchResult]:
        """
        Re-score and re-rank results by LLM relevance.

        Args:
            query:   Original search query.
            results: Candidates from hybrid retrieval, in RRF order.
            top_k:   Final number to return after reranking (None = keep all).

        Returns:
            Reranked list, highest LLM relevance first. Falls back to the
            original order if the LLM call fails or returns bad output.
        """
        if not results:
            return results

        scores: list[float] = await self._score_batch(query, results)
        if not scores:
            # LLM unavailable or returned unparseable output — preserve RRF order.
            logger.debug("Reranker: falling back to RRF order (LLM returned no scores)")
            return results[:top_k] if top_k else results

        # Re-sort by rerank score descending, then normalise to 0–1.
        paired = sorted(
            zip(results, scores, strict=False),
            key=lambda x: x[1],
            reverse=True,
        )
        max_score: float = max(s for _, s in paired) if paired else 10.0

        reranked: list[src.domain.models.SearchResult] = []
        for result, score in paired:
            reranked.append(
                result.model_copy(
                    update={"score": round(score / max(max_score, 0.001), 4)}
                )
            )

        return reranked[:top_k] if top_k else reranked

    # ── Internal ──────────────────────────────────────────────────────────

    async def _score_batch(
        self,
        query: str,
        results: list[src.domain.models.SearchResult],
    ) -> list[float]:
        """
        Score all chunks in one LLM call.

        Returns an empty list on any failure so the caller can fall back
        to the original ordering without crashing.
        """
        chunk_lines: list[str] = []
        for i, r in enumerate(results, 1):
            preview = r.content[: self._max_chunk_chars]
            if len(r.content) > self._max_chunk_chars:
                preview += " [...]"
            chunk_lines.append(f"[{i}] {preview}")

        prompt: str = _RERANK_PROMPT.format(
            query=query.strip(),
            chunks="\n\n".join(chunk_lines),
            count=len(results),
        )

        try:
            resp: httpx.Response = await self._http.post(
                f"{self._llm_url}/chat/completions",
                json={
                    "model": self._model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 256,
                },
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            raw: str = resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.warning("Reranker LLM call failed: %s", exc)
            return []

        return self._parse_scores(raw, expected=len(results))

    @staticmethod
    def _parse_scores(raw: str, expected: int) -> list[float]:
        """
        Extract the scores array from the LLM JSON response.

        Handles common failure modes (markdown fences, wrong count) and
        returns [] on unrecoverable parse errors.
        """
        try:
            cleaned: str = raw.strip()
            if cleaned.startswith("```"):
                cleaned: str = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            data = json.loads(cleaned)
            scores: list[float] = [float(s) for s in data.get("scores", [])]
        except (json.JSONDecodeError, ValueError, TypeError, KeyError) as exc:
            logger.warning(
                "Reranker: failed to parse scores: %s — raw: %.200s",
                exc,
                raw,
            )
            return []

        # Pad or truncate gracefully if the model returned wrong count.
        if len(scores) < expected:
            logger.debug(
                "Reranker: got %d scores, expected %d — padding with 5.0",
                len(scores),
                expected,
            )
            scores.extend([5.0] * (expected - len(scores)))
        elif len(scores) > expected:
            scores: list[float] = scores[:expected]

        return [max(0.0, min(10.0, s)) for s in scores]
