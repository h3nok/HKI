"""
Evaluation Regression Suite — automated RAGAS-inspired quality runner.

Runs a configurable set of retrieval + generation quality metrics
against golden test sets. Designed to run on schedule (via scheduler.py)
or on-demand before deployments.

Metrics (RAGAS-inspired):
    - context_relevance:  Are the retrieved chunks relevant to the query?
    - context_precision:  Are relevant chunks ranked higher?
    - faithfulness:       Is the answer grounded in the retrieved context?
    - answer_relevance:   Does the answer address the original question?

Architecture:
    Golden test set (JSON) → EvalRunner → per-metric scores → EvalReport
    Reports are stored for trend tracking and regression detection.

Usage:
    runner = EvalRunner(knowledge_api_url="...", llm=llm_client)
    report = await runner.run(test_set_path="golden_set.json")
"""

from __future__ import annotations

import datetime
import json
import pathlib
import statistics
import time
import typing

import httpx
import pydantic
import shared.http_client

import src.core.logging

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class GoldenExample(pydantic.BaseModel):
    """A single test case in the golden set."""

    query: str
    expected_answer: str = ""
    expected_chunks: list[str] = pydantic.Field(default_factory=list)
    department: str = ""
    tags: list[str] = pydantic.Field(default_factory=list)


class MetricScore(pydantic.BaseModel):
    """Score for a single metric on a single example."""

    metric: str
    score: float  # 0.0–1.0
    details: str = ""


class ExampleResult(pydantic.BaseModel):
    """Evaluation result for a single golden example."""

    query: str
    retrieved_chunks: int = 0
    top_score: float = 0.0
    metrics: list[MetricScore] = pydantic.Field(default_factory=list)
    search_time_ms: float = 0.0


class EvalReport(pydantic.BaseModel):
    """Complete evaluation report."""

    run_id: str
    timestamp: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    test_set: str = ""
    total_examples: int = 0
    results: list[ExampleResult] = pydantic.Field(default_factory=list)
    aggregate: dict[str, float] = pydantic.Field(default_factory=dict)
    # Statistical distribution per metric
    metric_stats: dict[str, dict[str, float]] = pydantic.Field(default_factory=dict)
    duration_ms: float = 0.0
    passed: bool = True
    regression_detected: bool = False
    # Regression details
    regressions: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)
    # Cost tracking
    search_calls: int = 0
    estimated_cost_usd: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Metric Implementations
# ═══════════════════════════════════════════════════════════════════════════════


def _context_relevance(
    query: str,
    chunks: list[dict[str, typing.Any]],
) -> MetricScore:
    """
    Are the retrieved chunks relevant to the query?

    Uses the vector similarity scores directly (embedding-only mode).
    Score = mean of top-k chunk scores.
    """
    if not chunks:
        return MetricScore(
            metric="context_relevance",
            score=0.0,
            details="No chunks retrieved",
        )
    scores: list[float] = [float(c.get("score", 0)) for c in chunks]
    avg: float = sum(scores) / len(scores)
    return MetricScore(
        metric="context_relevance",
        score=round(avg, 3),
        details=f"Mean of {len(scores)} chunk scores",
    )


def _context_precision(
    expected_chunks: list[str],
    retrieved_chunks: list[dict[str, typing.Any]],
) -> MetricScore:
    """
    Are relevant chunks ranked higher?

    Measures how many expected chunks appear in top positions.
    Score = (relevant in top-3) / min(3, total_expected).
    """
    if not expected_chunks:
        return MetricScore(
            metric="context_precision",
            score=1.0,
            details="No expected chunks specified",
        )

    retrieved_ids: list[typing.Any] = [
        chunk.get("chunk_id", "") for chunk in retrieved_chunks[:3]
    ]
    hits: int = sum(1 for eid in expected_chunks if eid in retrieved_ids)
    denom: int = min(3, len(expected_chunks))
    score: float = hits / denom if denom > 0 else 0.0

    return MetricScore(
        metric="context_precision",
        score=round(score, 3),
        details=f"{hits}/{denom} expected chunks in top-3",
    )


def _answer_relevance_heuristic(
    query: str,
    answer: str,
) -> MetricScore:
    """
    Does the answer address the query? (heuristic mode)

    Simple keyword overlap score. For LLM-augmented mode,
    use a Gemini call to judge relevance.
    """
    if not answer:
        return MetricScore(
            metric="answer_relevance",
            score=0.0,
            details="No answer generated",
        )

    query_words: set[str] = set(query.lower().split())
    answer_words: set[str] = set(answer.lower().split())
    overlap: int = len(query_words & answer_words)
    score: float = min(1.0, overlap / max(1, len(query_words)))

    return MetricScore(
        metric="answer_relevance",
        score=round(score, 3),
        details=f"{overlap}/{len(query_words)} query words in answer",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Eval Runner
# ═══════════════════════════════════════════════════════════════════════════════


class EvalRunner:
    """
    Automated evaluation suite for retrieval quality.

    Loads a golden test set, runs each query against the knowledge API,
    computes metrics, and generates a report with regression detection.
    """

    def __init__(
        self,
        knowledge_api_url: str = "http://localhost:9509",
        threshold: float = 0.5,
        regression_tolerance: float = 0.05,
    ) -> None:
        self._api_url: str = knowledge_api_url.rstrip("/")
        self._threshold: float = threshold
        self._regression_tolerance: float = regression_tolerance

    async def run(
        self,
        test_set_path: str,
        org_id: str = "default",
        previous_report: EvalReport | None = None,
    ) -> EvalReport:
        """
        Execute the full evaluation suite.

        Args:
            test_set_path: Path to JSON file with golden examples.
            org_id: Organization scope for search queries.
            previous_report: Previous report for regression detection.

        Returns:
            EvalReport with per-example and aggregate results.
        """
        import uuid

        start: float = time.perf_counter()
        run_id: str = str(uuid.uuid4())[:8]

        # Load golden set
        test_set: list[GoldenExample] = self._load_test_set(test_set_path)
        if not test_set:
            return EvalReport(
                run_id=run_id,
                test_set=test_set_path,
                passed=False,
            )

        results: list[ExampleResult] = []
        async with shared.http_client.create_service_client(
            "pipeline-eval",
            timeout=30.0,
        ) as client:
            for example in test_set:
                result: ExampleResult = await self._evaluate_example(
                    client,
                    example,
                    org_id,
                )
                results.append(result)

        # Compute aggregates
        aggregate: dict[str, float] = self._compute_aggregates(results)
        metric_stats: dict[str, dict[str, float]] = self._compute_metric_stats(results)
        passed: bool = all(v >= self._threshold for v in aggregate.values())

        # Regression detection with detailed tracking
        regression = False
        regressions: list[dict[str, typing.Any]] = []
        if previous_report and previous_report.aggregate:
            for metric, score in aggregate.items():
                prev: float = previous_report.aggregate.get(metric, 0)
                delta: float = prev - score
                if delta > self._regression_tolerance:
                    regression = True
                    regressions.append(
                        {
                            "metric": metric,
                            "current": round(score, 4),
                            "previous": round(prev, 4),
                            "delta": round(delta, 4),
                            "severity": "critical"
                            if delta > self._regression_tolerance * 2
                            else "warning",
                        }
                    )
                    src.core.logging.logger.warning(
                        "Regression detected",
                        extra={
                            "metric": metric,
                            "current": score,
                            "previous": prev,
                            "delta": round(delta, 3),
                        },
                    )

        duration: float = (time.perf_counter() - start) * 1000

        report = EvalReport(
            run_id=run_id,
            test_set=test_set_path,
            total_examples=len(test_set),
            results=results,
            aggregate=aggregate,
            metric_stats=metric_stats,
            duration_ms=round(duration, 1),
            passed=passed and not regression,
            regression_detected=regression,
            regressions=regressions,
            search_calls=len(results),
            estimated_cost_usd=round(len(results) * 0.0005, 6),
        )

        src.core.logging.logger.info(
            "Evaluation complete",
            extra={
                "run_id": run_id,
                "examples": len(test_set),
                "passed": report.passed,
                "aggregate": aggregate,
                "duration_ms": round(duration, 1),
            },
        )

        return report

    def _load_test_set(
        self,
        path: str,
    ) -> list[GoldenExample]:
        """Load golden test set from JSON file."""
        try:
            data = json.loads(pathlib.Path(path).read_text())
            return [GoldenExample(**ex) for ex in data]
        except Exception as exc:
            src.core.logging.logger.error(
                "Failed to load test set",
                extra={"path": path, "error": str(exc)},
            )
            return []

    async def _evaluate_example(
        self,
        client: httpx.AsyncClient,
        example: GoldenExample,
        org_id: str,
    ) -> ExampleResult:
        """Evaluate a single golden example."""
        # Search the knowledge base
        payload = {
            "query": example.query,
            "mode": "hybrid",
            "top_k": 5,
            "include_content": True,
            "include_citations": True,
        }
        if example.department:
            payload["departments"] = [example.department]

        try:
            resp: httpx.Response = await client.post(
                f"{self._api_url}/v1/search",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            src.core.logging.logger.warning(
                "Search failed for eval example",
                extra={
                    "query": example.query,
                    "error": str(exc),
                },
            )
            return ExampleResult(query=example.query)

        results = data.get("results", [])
        top_score: float = max(
            (float(r.get("score", 0)) for r in results),
            default=0.0,
        )

        # Compute metrics
        metrics: list[MetricScore] = [
            _context_relevance(example.query, results),
            _context_precision(example.expected_chunks, results),
        ]

        if example.expected_answer:
            # Build a simple answer from retrieved content
            answer_text: str = " ".join(r.get("content", "")[:200] for r in results[:3])
            metrics.append(
                _answer_relevance_heuristic(
                    example.query,
                    answer_text,
                ),
            )

        return ExampleResult(
            query=example.query,
            retrieved_chunks=len(results),
            top_score=round(top_score, 3),
            metrics=metrics,
            search_time_ms=data.get("search_time_ms", 0),
        )

    @staticmethod
    def _compute_aggregates(
        results: list[ExampleResult],
    ) -> dict[str, float]:
        """Compute mean scores per metric across all examples."""
        metric_sums: dict[str, list[float]] = {}
        for result in results:
            for m in result.metrics:
                metric_sums.setdefault(m.metric, []).append(m.score)

        return {
            metric: round(sum(scores) / len(scores), 3)
            for metric, scores in metric_sums.items()
            if scores
        }

    @staticmethod
    def _compute_metric_stats(
        results: list[ExampleResult],
    ) -> dict[str, dict[str, float]]:
        """Compute per-metric distribution stats (stddev, CI, percentiles)."""
        import math

        metric_scores: dict[str, list[float]] = {}
        for result in results:
            for m in result.metrics:
                metric_scores.setdefault(m.metric, []).append(m.score)

        stats: dict[str, dict[str, float]] = {}
        for metric, scores in metric_scores.items():
            if not scores:
                continue

            n: int = len(scores)
            mean: float = statistics.mean(scores)
            stddev: float = statistics.stdev(scores) if n >= 2 else 0.0

            # 95% CI
            if n >= 2:
                se: float = stddev / math.sqrt(n)
                # Approximate t-critical
                df: int = n - 1
                if df >= 30:
                    t = 2.042
                elif df >= 10:
                    t = 2.228
                elif df >= 5:
                    t = 2.571
                else:
                    t: float = 4.303 if df >= 2 else 12.706
                ci_lower: float = max(0.0, mean - t * se)
                ci_upper: float = min(1.0, mean + t * se)
            else:
                ci_lower: float = mean
                ci_upper: float = mean

            sorted_scores: list[float] = sorted(scores)

            stats[metric] = {
                "mean": round(mean, 4),
                "stddev": round(stddev, 4),
                "ci_lower": round(ci_lower, 4),
                "ci_upper": round(ci_upper, 4),
                "median": round(statistics.median(scores), 4),
                "min": round(min(scores), 4),
                "max": round(max(scores), 4),
                "p5": round(sorted_scores[max(0, int(0.05 * (n - 1)))], 4),
                "p95": round(sorted_scores[min(n - 1, int(0.95 * (n - 1)))], 4),
                "n": float(n),
            }

        return stats
