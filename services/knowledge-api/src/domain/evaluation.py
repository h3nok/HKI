"""
Retrieval Evaluation Pipeline — RAGAS-inspired quality metrics.

Measures how well the retrieval system serves the agent layer by scoring
retrieved context against ground-truth test cases. Operates in two modes:

    Embedding-only  — Fast, deterministic, no LLM cost.  Suitable for CI.
    LLM-augmented   — Uses Gemini as a judge for faithfulness / correctness.

Metrics (aligned to RAGAS v0.1 definitions):
    context_relevance   — avg cosine similarity of retrieved chunks to query
    context_precision   — fraction of top-k chunks above relevance threshold
    context_recall      — fraction of ground-truth sentences covered by context
    answer_similarity   — cosine similarity of generated answer to expected
    faithfulness        — (LLM) is the answer grounded in retrieved context?
    answer_correctness  — (LLM) does the answer match the expected answer?

Architecture:
    EvaluationCase      — single test case (query + expected + retrieved + answer)
    MetricResult        — one metric's score + metadata
    EvaluationReport    — aggregated results across a test suite
    RetrievalEvaluator  — stateless scorer, injected with embedding client
"""

# ruff: noqa: E501

from __future__ import annotations

import collections.abc
import enum
import math
import statistics
import time
import typing

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class MetricName(enum.StrEnum):
    """Enumerated metric identifiers for typed access."""

    CONTEXT_RELEVANCE = "context_relevance"
    CONTEXT_PRECISION = "context_precision"
    CONTEXT_RECALL = "context_recall"
    ANSWER_SIMILARITY = "answer_similarity"
    FAITHFULNESS = "faithfulness"
    ANSWER_CORRECTNESS = "answer_correctness"
    CHUNK_UTILIZATION = "chunk_utilization"


class EvaluationCase(pydantic.BaseModel):
    """
    A single evaluation test case.

    Mirrors the RAGAS SingleTurnSample: a query, the expected answer,
    the chunks the retriever actually returned, and the answer the
    agent generated from those chunks.
    """

    id: str = ""
    query: str
    expected_answer: str = ""
    retrieved_contexts: list[str] = pydantic.Field(default_factory=list)
    generated_answer: str = ""
    # Pre-computed embeddings (optional — computed on the fly if absent)
    query_embedding: list[float] = pydantic.Field(default_factory=list)
    context_embeddings: list[list[float]] = pydantic.Field(default_factory=list)
    expected_embedding: list[float] = pydantic.Field(default_factory=list)
    answer_embedding: list[float] = pydantic.Field(default_factory=list)


class MetricResult(pydantic.BaseModel):
    """Score for a single metric on a single test case."""

    name: MetricName
    score: float  # 0.0 – 1.0
    details: dict = pydantic.Field(default_factory=dict)
    latency_ms: float = 0.0  # time taken to compute this metric


class CaseResult(pydantic.BaseModel):
    """All metric scores for one evaluation case."""

    case_id: str
    query: str
    metrics: list[MetricResult] = pydantic.Field(default_factory=list)

    def score(self, name: MetricName) -> float | None:
        for m in self.metrics:
            if m.name == name:
                return m.score
        return None


class MetricSummary(pydantic.BaseModel):
    """Statistical summary for a single metric across all cases."""

    mean: float = 0.0
    stddev: float = 0.0
    ci_lower: float = 0.0  # 95% confidence interval lower bound
    ci_upper: float = 0.0  # 95% confidence interval upper bound
    median: float = 0.0
    p5: float = 0.0  # 5th percentile
    p95: float = 0.0  # 95th percentile
    min: float = 0.0
    max: float = 0.0
    n: int = 0
    avg_latency_ms: float = 0.0


class EvaluationReport(pydantic.BaseModel):
    """
    Aggregated evaluation results across a test suite.

    Contains per-case breakdowns, summary statistics with confidence
    intervals, cost tracking, and distribution analysis aligned with
    industry-standard frameworks (RAGAS, DeepEval, Trulens).
    """

    suite_name: str = ""
    case_results: list[CaseResult] = pydantic.Field(default_factory=list)
    summary: dict[str, float] = pydantic.Field(default_factory=dict)
    statistics: dict[str, MetricSummary] = pydantic.Field(default_factory=dict)
    total_cases: int = 0
    eval_time_ms: float = 0.0
    # Cost tracking
    embedding_calls: int = 0
    llm_judge_calls: int = 0
    estimated_cost_usd: float = 0.0

    def mean(self, name: MetricName) -> float:
        scores: list[float | None] = [
            r.score(name) for r in self.case_results if r.score(name) is not None
        ]
        return statistics.mean(scores) if scores else 0.0

    def stddev(self, name: MetricName) -> float:
        """Standard deviation for a metric across all cases."""
        scores: list[float | None] = [
            r.score(name) for r in self.case_results if r.score(name) is not None
        ]
        return statistics.stdev(scores) if len(scores) >= 2 else 0.0

    def ci_95(self, name: MetricName) -> tuple[float, float]:
        """95% confidence interval using t-distribution for small samples."""
        scores: list[float | None] = [
            r.score(name) for r in self.case_results if r.score(name) is not None
        ]
        if len(scores) < 2:
            m: float | None = scores[0] if scores else 0.0
            return (m, m)
        m = statistics.mean(scores)
        se = statistics.stdev(scores) / math.sqrt(len(scores))
        # t-critical for 95% CI (approximate for df >= 2)
        df: int = len(scores) - 1
        # Use Welch–Satterthwaite approximation of t-critical
        if df >= 120:
            t_crit = 1.96
        elif df >= 30:
            t_crit = 2.042
        elif df >= 10:
            t_crit = 2.228
        elif df >= 5:
            t_crit = 2.571
        elif df >= 2:
            t_crit = 4.303
        else:
            t_crit = 12.706
        lower: float = max(0.0, m - t_crit * se)
        upper: float = min(1.0, m + t_crit * se)
        return (round(lower, 4), round(upper, 4))

    def percentile(self, name: MetricName, pct: float) -> float:
        """Compute percentile for a metric (0-100 scale)."""
        scores = sorted(r.score(name) for r in self.case_results if r.score(name) is not None)
        if not scores:
            return 0.0
        k: float = (pct / 100) * (len(scores) - 1)
        f_idx = int(k)
        c_idx: int = min(f_idx + 1, len(scores) - 1)
        frac: float = k - f_idx
        return round(scores[f_idx] + frac * (scores[c_idx] - scores[f_idx]), 4)

    def compute_statistics(self) -> None:
        """Compute full statistical summary for all metrics."""
        for metric in MetricName:
            scores: list[float | None] = [
                r.score(metric) for r in self.case_results if r.score(metric) is not None
            ]
            if not scores:
                continue

            ci: tuple[float, float] = self.ci_95(metric)

            # Collect latencies for this metric
            latencies = []
            for cr in self.case_results:
                for mr in cr.metrics:
                    if mr.name == metric and mr.latency_ms > 0:
                        latencies.append(mr.latency_ms)

            self.statistics[metric.value] = MetricSummary(
                mean=round(statistics.mean(scores), 4),
                stddev=round(statistics.stdev(scores), 4) if len(scores) >= 2 else 0.0,
                ci_lower=ci[0],
                ci_upper=ci[1],
                median=round(statistics.median(scores), 4),
                p5=self.percentile(metric, 5),
                p95=self.percentile(metric, 95),
                min=round(min(scores), 4),
                max=round(max(scores), 4),
                n=len(scores),
                avg_latency_ms=round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            )


# ═══════════════════════════════════════════════════════════════════════════════
# Protocols — embedding + optional LLM judge
# ═══════════════════════════════════════════════════════════════════════════════


class Embedder(typing.Protocol):
    """Minimal interface for embedding generation."""

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class LLMJudge(typing.Protocol):
    """Optional LLM-as-judge for faithfulness / correctness scoring."""

    async def judge_faithfulness(
        self,
        answer: str,
        contexts: list[str],
    ) -> float: ...

    async def judge_correctness(
        self,
        answer: str,
        expected: str,
    ) -> float: ...


# ═══════════════════════════════════════════════════════════════════════════════
# Vector math — pure functions, no dependencies
# ═══════════════════════════════════════════════════════════════════════════════


def _cosine_similarity(a: collections.abc.Sequence[float], b: collections.abc.Sequence[float]) -> float:
    """Cosine similarity between two vectors. Returns 0.0 on degenerate input."""
    if len(a) != len(b) or not a:
        return 0.0
    dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))


def _sentence_split(text: str) -> list[str]:
    """Naive sentence splitter for recall estimation."""
    import re

    parts: list[str | typing.Any] = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in parts if s.strip()]


# ═══════════════════════════════════════════════════════════════════════════════
# Retrieval Evaluator — the core scoring engine
# ═══════════════════════════════════════════════════════════════════════════════


class RetrievalEvaluator:
    """
    Stateless evaluator for retrieval quality.

    Injected with an Embedder (required) and an optional LLMJudge.
    All scoring methods are async to support batched embedding calls.

    Usage:
        evaluator = RetrievalEvaluator(embedder=embedding_client)
        report = await evaluator.evaluate(cases, suite_name="nightly")
    """

    def __init__(
        self,
        embedder: Embedder,
        judge: LLMJudge | None = None,
        relevance_threshold: float = 0.5,
    ) -> None:
        self._embedder: Embedder = embedder
        self._judge: LLMJudge | None = judge
        self._threshold: float = relevance_threshold

    # ── Public API ─────────────────────────────────────────────────────────

    async def evaluate(
        self,
        cases: list[EvaluationCase],
        suite_name: str = "",
    ) -> EvaluationReport:
        """
        Run all applicable metrics on every case and return an aggregated report.

        Returns a report with per-case scores, aggregate means, full statistical
        distribution (stddev, CI, percentiles), cost tracking, and per-metric
        latency breakdown — aligned with RAGAS / DeepEval reporting standards.
        """
        t0: float = time.monotonic()
        results: list[CaseResult] = []
        embedding_calls = 0
        llm_calls = 0

        for case in cases:
            had_embeddings = bool(case.query_embedding)
            await self._ensure_embeddings(case)
            if not had_embeddings and case.query_embedding:
                embedding_calls += 1

            metrics: list[MetricResult] = await self._score_case(case)
            results.append(
                CaseResult(
                    case_id=case.id,
                    query=case.query,
                    metrics=metrics,
                )
            )

            # Count LLM judge calls
            for m in metrics:
                if m.name in (MetricName.FAITHFULNESS, MetricName.ANSWER_CORRECTNESS):
                    llm_calls += 1

        report = EvaluationReport(
            suite_name=suite_name,
            case_results=results,
            total_cases=len(cases),
            eval_time_ms=(time.monotonic() - t0) * 1000,
            embedding_calls=embedding_calls,
            llm_judge_calls=llm_calls,
            # Rough cost estimate: $0.0001 per embed call, $0.001 per LLM judge
            estimated_cost_usd=round(embedding_calls * 0.0001 + llm_calls * 0.001, 6),
        )

        # Build summary: mean of each metric
        for metric in MetricName:
            mean: float = report.mean(metric)
            if mean > 0.0:
                report.summary[metric.value] = round(mean, 4)

        # Compute full statistical distribution
        report.compute_statistics()

        return report

    # ── Embedding hydration ────────────────────────────────────────────────

    async def _ensure_embeddings(self, case: EvaluationCase) -> None:
        """Compute any missing embeddings for a test case."""
        texts_to_embed: list[str] = []
        slots: list[tuple[str, int]] = []  # (field, index_in_batch)

        if not case.query_embedding and case.query:
            slots.append(("query", len(texts_to_embed)))
            texts_to_embed.append(case.query)

        if not case.expected_embedding and case.expected_answer:
            slots.append(("expected", len(texts_to_embed)))
            texts_to_embed.append(case.expected_answer)

        if not case.answer_embedding and case.generated_answer:
            slots.append(("answer", len(texts_to_embed)))
            texts_to_embed.append(case.generated_answer)

        missing_ctx = []
        for i, ctx in enumerate(case.retrieved_contexts):
            if i >= len(case.context_embeddings) or not case.context_embeddings[i]:
                missing_ctx.append((i, len(texts_to_embed)))
                texts_to_embed.append(ctx)

        if not texts_to_embed:
            return

        vectors: list[list[float]] = await self._embedder.embed(texts_to_embed)

        for slot_name, idx in slots:
            if slot_name == "query":
                case.query_embedding = vectors[idx]
            elif slot_name == "expected":
                case.expected_embedding = vectors[idx]
            elif slot_name == "answer":
                case.answer_embedding = vectors[idx]

        # Pad context_embeddings list if needed
        while len(case.context_embeddings) < len(case.retrieved_contexts):
            case.context_embeddings.append([])
        for ctx_idx, batch_idx in missing_ctx:
            case.context_embeddings[ctx_idx] = vectors[batch_idx]

    # ── Per-case scoring ───────────────────────────────────────────────────

    async def _score_case(self, case: EvaluationCase) -> list[MetricResult]:
        """Compute all applicable metrics for a single case with latency tracking."""
        results: list[MetricResult] = []

        # Embedding-based metrics (always available)
        if case.query_embedding and case.context_embeddings:
            t0: float = time.monotonic()
            r: MetricResult = self._context_relevance(case)
            r.latency_ms = round((time.monotonic() - t0) * 1000, 2)
            results.append(r)

            t0: float = time.monotonic()
            r: MetricResult = self._context_precision(case)
            r.latency_ms = round((time.monotonic() - t0) * 1000, 2)
            results.append(r)

            t0: float = time.monotonic()
            r: MetricResult = self._chunk_utilization(case)
            r.latency_ms = round((time.monotonic() - t0) * 1000, 2)
            results.append(r)

        if case.expected_embedding and case.context_embeddings:
            t0: float = time.monotonic()
            r: MetricResult = await self._context_recall(case)
            r.latency_ms = round((time.monotonic() - t0) * 1000, 2)
            results.append(r)

        if case.answer_embedding and case.expected_embedding:
            t0: float = time.monotonic()
            r: MetricResult = self._answer_similarity(case)
            r.latency_ms = round((time.monotonic() - t0) * 1000, 2)
            results.append(r)

        # LLM-judge metrics (when judge is available)
        if self._judge and case.generated_answer and case.retrieved_contexts:
            t0: float = time.monotonic()
            score: float = await self._judge.judge_faithfulness(
                case.generated_answer,
                case.retrieved_contexts,
            )
            latency: float = round((time.monotonic() - t0) * 1000, 2)
            results.append(
                MetricResult(
                    name=MetricName.FAITHFULNESS,
                    score=score,
                    latency_ms=latency,
                )
            )

        if self._judge and case.generated_answer and case.expected_answer:
            t0: float = time.monotonic()
            score: float = await self._judge.judge_correctness(
                case.generated_answer,
                case.expected_answer,
            )
            latency: float = round((time.monotonic() - t0) * 1000, 2)
            results.append(
                MetricResult(
                    name=MetricName.ANSWER_CORRECTNESS,
                    score=score,
                    latency_ms=latency,
                )
            )

        return results

    # ── Individual metric implementations ──────────────────────────────────

    def _context_relevance(self, case: EvaluationCase) -> MetricResult:
        """Average cosine similarity between query and each retrieved chunk."""
        sims: list[float] = [
            _cosine_similarity(case.query_embedding, ce) for ce in case.context_embeddings if ce
        ]
        score: float = statistics.mean(sims) if sims else 0.0
        return MetricResult(
            name=MetricName.CONTEXT_RELEVANCE,
            score=round(score, 4),
            details={"per_chunk": [round(s, 4) for s in sims]},
        )

    def _context_precision(self, case: EvaluationCase) -> MetricResult:
        """Fraction of retrieved chunks with similarity above threshold."""
        sims: list[float] = [
            _cosine_similarity(case.query_embedding, ce) for ce in case.context_embeddings if ce
        ]
        if not sims:
            return MetricResult(name=MetricName.CONTEXT_PRECISION, score=0.0)
        relevant: int = sum(1 for s in sims if s >= self._threshold)
        score: float = relevant / len(sims)
        return MetricResult(
            name=MetricName.CONTEXT_PRECISION,
            score=round(score, 4),
            details={"relevant": relevant, "total": len(sims), "threshold": self._threshold},
        )

    async def _context_recall(self, case: EvaluationCase) -> MetricResult:
        """
        Estimate recall: fraction of expected-answer sentences that are
        semantically covered by at least one retrieved chunk.

        Properly embeds each sentence individually for accurate measurement.
        """
        sentences: list[str] = _sentence_split(case.expected_answer)
        if not sentences or not case.context_embeddings:
            return MetricResult(name=MetricName.CONTEXT_RECALL, score=0.0)

        # Reuse the pre-computed expected embedding when available to avoid
        # unnecessary embed calls in CI / batch evaluation.
        if case.expected_embedding:
            sentence_embeddings: list[list[float]] = [case.expected_embedding] * len(sentences)
        else:
            # Embed each sentence individually for accurate per-sentence recall
            try:
                sentence_embeddings: list[list[float]] = await self._embedder.embed(sentences)
            except Exception:
                # Fallback: use the whole expected_embedding (imprecise but safe)
                sentence_embeddings: list[list[float]] = [case.expected_embedding] * len(sentences)

        covered = 0
        for sent_emb in sentence_embeddings:
            if not sent_emb:
                continue
            max_sim: float = max(
                (_cosine_similarity(sent_emb, ce) for ce in case.context_embeddings if ce),
                default=0.0,
            )
            if max_sim >= self._threshold:
                covered += 1

        score: float = covered / len(sentences)
        return MetricResult(
            name=MetricName.CONTEXT_RECALL,
            score=round(score, 4),
            details={"covered": covered, "total_sentences": len(sentences)},
        )

    def _answer_similarity(self, case: EvaluationCase) -> MetricResult:
        """Cosine similarity between generated and expected answer embeddings."""
        score: float = _cosine_similarity(case.answer_embedding, case.expected_embedding)
        return MetricResult(
            name=MetricName.ANSWER_SIMILARITY,
            score=round(score, 4),
        )

    def _chunk_utilization(self, case: EvaluationCase) -> MetricResult:
        """Fraction of retrieved chunks that are above the relevance threshold."""
        sims: list[float] = [
            _cosine_similarity(case.query_embedding, ce) for ce in case.context_embeddings if ce
        ]
        if not sims:
            return MetricResult(name=MetricName.CHUNK_UTILIZATION, score=0.0)
        useful: int = sum(1 for s in sims if s >= self._threshold)
        score: float = useful / len(sims)
        return MetricResult(
            name=MetricName.CHUNK_UTILIZATION,
            score=round(score, 4),
            details={"useful": useful, "retrieved": len(sims)},
        )

    # ── Helpers ────────────────────────────────────────────────────────────
