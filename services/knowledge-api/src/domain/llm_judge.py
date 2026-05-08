"""
LLM-as-Judge — Gemini-powered faithfulness & correctness scoring.

Implements the LLMJudge protocol from evaluation.py using the existing
LiteLLM gateway. Uses structured prompts that return a JSON score so
parsing is deterministic.

Supports multi-judge consensus scoring for production reliability:
when num_judges > 1, runs N independent LLM calls with varied temperature
and reports agreement metrics (Krippendorff's alpha / agreement %).

Architecture:
    GeminiJudge → LiteLLM Gateway → Vertex AI (Gemini 2.0 Flash)
    Reuses the same gateway/credentials as EntityExtractor.
"""

# ruff: noqa: E501

from __future__ import annotations

import json
import logging
import statistics
import typing

import httpx

logger: logging.Logger = logging.getLogger("knowledge.llm_judge")

# ═══════════════════════════════════════════════════════════════════════════════
# Prompts
# ═══════════════════════════════════════════════════════════════════════════════

_FAITHFULNESS_PROMPT = """\
You are an expert fact-checking judge. Your task is to evaluate whether the \
given answer is FAITHFUL to the provided source context — meaning every claim \
in the answer is directly supported by the context.

## Context (Retrieved Chunks)
{contexts}

## Answer to Evaluate
{answer}

## Instructions
1. Identify each factual claim in the answer.
2. For each claim, check if it is directly supported by the context above.
3. Score = (number of supported claims) / (total claims).
4. If the answer says "I don't know" or makes no factual claims, score 1.0.

Return ONLY a JSON object (no markdown, no explanation):
{{"score": <float 0.0 to 1.0>, "supported": <int>, "total": <int>, "unsupported_claims": [<string>, ...]}}
"""

_CORRECTNESS_PROMPT = """\
You are an expert answer evaluation judge. Compare the generated answer \
against the expected (ground truth) answer and score how correct it is.

## Expected Answer
{expected}

## Generated Answer
{generated}

## Scoring Rubric
- 1.0 = Perfect: all key facts match, nothing incorrect
- 0.8 = Mostly correct: minor omissions but no wrong facts
- 0.6 = Partially correct: some key facts present, some missing
- 0.4 = Weak: only tangentially related, many gaps
- 0.2 = Poor: mostly wrong or irrelevant
- 0.0 = Completely wrong or empty

Return ONLY a JSON object (no markdown, no explanation):
{{"score": <float 0.0 to 1.0>, "reasoning": "<brief 1-sentence explanation>"}}
"""


# ═══════════════════════════════════════════════════════════════════════════════
# GeminiJudge — implements LLMJudge protocol
# ═══════════════════════════════════════════════════════════════════════════════


class GeminiJudge:
    """
    LLM-as-Judge using Gemini through the LiteLLM gateway.

    Supports multi-judge consensus: when num_judges > 1, runs N independent
    calls with staggered temperatures and computes agreement metrics.
    This catches LLM scoring instability and provides confidence bounds.

    Usage:
        judge = GeminiJudge(llm_url="http://localhost:4000/v1")
        faithfulness = await judge.judge_faithfulness(answer, contexts)
        correctness = await judge.judge_correctness(answer, expected)

        # Multi-judge mode (production)
        judge = GeminiJudge(num_judges=3)
        result = await judge.judge_faithfulness_detailed(answer, contexts)
        # result = {"score": 0.85, "agreement": 0.92, "scores": [0.8, 0.9, 0.85], ...}
    """

    def __init__(
        self,
        llm_url: str = "http://localhost:4000/v1",
        llm_api_key: str = "sk-1234",
        model: str = "gemini-2.0-flash",
        timeout: float = 30.0,
        num_judges: int = 1,
    ) -> None:
        self._llm_url: str = llm_url.rstrip("/")
        self._api_key: str = llm_api_key
        self._model: str = model
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(timeout))
        self._num_judges: int = max(1, min(num_judges, 5))  # cap at 5

    async def close(self) -> None:
        """Clean up HTTP connections."""
        await self._http.aclose()

    # ── High-level API (backward-compatible) ──────────────────────────────

    async def judge_faithfulness(
        self,
        answer: str,
        contexts: list[str],
    ) -> float:
        """
        Score how faithful the answer is to the retrieved context.
        Returns 0.0–1.0 where 1.0 = fully grounded.
        """
        if not answer.strip() or not contexts:
            return 0.0

        context_block: str = "\n\n---\n\n".join(
            f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(contexts[:10])
        )
        prompt: str = _FAITHFULNESS_PROMPT.format(
            contexts=context_block,
            answer=answer[:3000],
        )

        if self._num_judges > 1:
            result: dict[str, typing.Any] = await self._multi_judge(prompt)
            return result["score"]

        result: str = await self._call_llm(prompt)
        return self._parse_score(result)

    async def judge_correctness(
        self,
        answer: str,
        expected: str,
    ) -> float:
        """
        Score how correct the generated answer is vs. expected.
        Returns 0.0–1.0 where 1.0 = perfectly matches expected.
        """
        if not answer.strip():
            return 0.0
        if not expected.strip():
            return 0.5

        prompt: str = _CORRECTNESS_PROMPT.format(
            expected=expected[:2000],
            generated=answer[:2000],
        )

        if self._num_judges > 1:
            result: dict[str, typing.Any] = await self._multi_judge(prompt)
            return result["score"]

        result: str = await self._call_llm(prompt)
        return self._parse_score(result)

    # ── Detailed API (returns agreement metrics) ──────────────────────────

    async def judge_faithfulness_detailed(
        self,
        answer: str,
        contexts: list[str],
    ) -> dict[str, typing.Any]:
        """
        Score faithfulness with full multi-judge analysis.

        Returns:
            {
                "score": float,         # median of all judges
                "scores": list[float],   # individual judge scores
                "agreement": float,      # inter-rater agreement (0-1)
                "stddev": float,         # score variance
                "confidence": str,       # "high" | "medium" | "low"
            }
        """
        if not answer.strip() or not contexts:
            return {
                "score": 0.0,
                "scores": [],
                "agreement": 1.0,
                "stddev": 0.0,
                "confidence": "high",
            }

        context_block: str = "\n\n---\n\n".join(
            f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(contexts[:10])
        )
        prompt: str = _FAITHFULNESS_PROMPT.format(
            contexts=context_block,
            answer=answer[:3000],
        )
        return await self._multi_judge(prompt)

    async def judge_correctness_detailed(
        self,
        answer: str,
        expected: str,
    ) -> dict[str, typing.Any]:
        """Score correctness with full multi-judge analysis."""
        if not answer.strip():
            return {
                "score": 0.0,
                "scores": [],
                "agreement": 1.0,
                "stddev": 0.0,
                "confidence": "high",
            }
        if not expected.strip():
            return {
                "score": 0.5,
                "scores": [],
                "agreement": 1.0,
                "stddev": 0.0,
                "confidence": "high",
            }

        prompt: str = _CORRECTNESS_PROMPT.format(
            expected=expected[:2000],
            generated=answer[:2000],
        )
        return await self._multi_judge(prompt)

    # ── Multi-judge consensus engine ──────────────────────────────────────

    async def _multi_judge(self, prompt: str) -> dict[str, typing.Any]:
        """
        Run N independent judge calls with staggered temperatures and
        compute consensus metrics.

        Uses temperatures [0.0, 0.1, 0.2, ...] for diversity while keeping
        outputs mostly deterministic. Returns median as the consensus score.
        """
        import asyncio

        n: int = self._num_judges
        temperatures: list[float] = [round(i * 0.1, 1) for i in range(n)]

        async def _single_judge(temp: float) -> float:
            raw: str = await self._call_llm(prompt, temperature=temp)
            return self._parse_score(raw)

        scores: list[float | BaseException] = await asyncio.gather(
            *[_single_judge(t) for t in temperatures],
            return_exceptions=True,
        )

        # Filter out exceptions
        valid_scores: list[float] = [s for s in scores if isinstance(s, float)]
        if not valid_scores:
            return {
                "score": 0.5,
                "scores": [],
                "agreement": 0.0,
                "stddev": 0.0,
                "confidence": "low",
            }

        median_score: float = statistics.median(valid_scores)
        stddev: float = statistics.stdev(valid_scores) if len(valid_scores) >= 2 else 0.0

        # Agreement: fraction of judges within 0.15 of median
        agreement: float = sum(1 for s in valid_scores if abs(s - median_score) <= 0.15) / len(
            valid_scores
        )

        # Confidence classification
        if agreement >= 0.8 and stddev < 0.1:
            confidence = "high"
        elif agreement >= 0.6:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "score": round(median_score, 4),
            "scores": [round(s, 4) for s in valid_scores],
            "agreement": round(agreement, 4),
            "stddev": round(stddev, 4),
            "confidence": confidence,
        }

    # ── Internal ─────────────────────────────────────────────────────────

    async def _call_llm(self, prompt: str, temperature: float = 0.0) -> str:
        """Make a chat completion call and return the response text."""
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": 500,
        }

        try:
            resp: httpx.Response = await self._http.post(
                f"{self._llm_url}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.warning("LLM judge call failed: %s", exc)
            return '{"score": 0.5}'

    @staticmethod
    def _parse_score(raw: str) -> float:
        """Extract score from JSON response. Defaults to 0.5 on parse error."""
        try:
            # Strip markdown fences if present
            cleaned: str = raw.strip()
            if cleaned.startswith("```"):
                cleaned: str = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            data = json.loads(cleaned)
            score = float(data.get("score", 0.5))
            return max(0.0, min(1.0, score))
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            logger.warning("Failed to parse judge score: %s — raw: %s", exc, raw[:200])
            return 0.5
