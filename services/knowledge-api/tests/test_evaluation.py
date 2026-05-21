"""Tests for the Retrieval Evaluation Pipeline."""

from __future__ import annotations

import pytest

import src.domain.evaluation

# ── Fixtures ──────────────────────────────────────────────────────────────


class MockEmbedder:
    """Deterministic embedder for testing."""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # Simple hash-based deterministic embeddings (4-dim)
        vectors = []
        for text in texts:
            h: int = hash(text) % 10000
            vectors.append(
                [
                    (h % 100) / 100.0,
                    ((h // 100) % 100) / 100.0,
                    ((h // 10000) % 100) / 100.0,
                    len(text) / 1000.0,
                ]
            )
        return vectors


class MockJudge:
    """Deterministic LLM judge for testing."""

    async def judge_faithfulness(
        self,
        answer: str,
        contexts: list[str],
    ) -> float:
        # Simple heuristic: overlap between answer and context words
        answer_words: set[str] = set(answer.lower().split())
        ctx_words = set()
        for ctx in contexts:
            ctx_words.update(ctx.lower().split())
        if not answer_words:
            return 0.0
        overlap: int = len(answer_words & ctx_words)
        return min(1.0, overlap / len(answer_words))

    async def judge_correctness(
        self,
        answer: str,
        expected: str,
    ) -> float:
        if answer.strip().lower() == expected.strip().lower():
            return 1.0
        return 0.5


@pytest.fixture
def embedder() -> MockEmbedder:
    return MockEmbedder()


@pytest.fixture
def judge() -> MockJudge:
    return MockJudge()


@pytest.fixture
def evaluator(embedder) -> src.domain.evaluation.RetrievalEvaluator:
    return src.domain.evaluation.RetrievalEvaluator(embedder=embedder, relevance_threshold=0.3)


@pytest.fixture
def evaluator_with_judge(embedder, judge) -> src.domain.evaluation.RetrievalEvaluator:
    return src.domain.evaluation.RetrievalEvaluator(
        embedder=embedder,
        judge=judge,
        relevance_threshold=0.3,
    )


# ── Unit tests: vector math ──────────────────────────────────────────────


class TestCosineSimilarity:
    def test_identical_vectors(self) -> None:
        v: list[float] = [1.0, 2.0, 3.0]
        assert src.domain.evaluation._cosine_similarity(v, v) == pytest.approx(1.0, abs=0.001)

    def test_orthogonal_vectors(self) -> None:
        a: list[float] = [1.0, 0.0]
        b: list[float] = [0.0, 1.0]
        assert src.domain.evaluation._cosine_similarity(a, b) == pytest.approx(0.0, abs=0.001)

    def test_opposite_vectors(self) -> None:
        a: list[float] = [1.0, 0.0]
        b: list[float] = [-1.0, 0.0]
        # Clamped to 0.0
        assert src.domain.evaluation._cosine_similarity(a, b) == 0.0

    def test_empty_vectors(self) -> None:
        assert src.domain.evaluation._cosine_similarity([], []) == 0.0

    def test_mismatched_lengths(self) -> None:
        assert src.domain.evaluation._cosine_similarity([1.0], [1.0, 2.0]) == 0.0

    def test_zero_vector(self) -> None:
        assert src.domain.evaluation._cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


class TestSentenceSplit:
    def test_basic_split(self) -> None:
        text = "First sentence. Second sentence. Third."
        parts: list[str] = src.domain.evaluation._sentence_split(text)
        assert len(parts) == 3

    def test_empty_text(self) -> None:
        assert src.domain.evaluation._sentence_split("") == []

    def test_single_sentence(self) -> None:
        parts: list[str] = src.domain.evaluation._sentence_split("Just one sentence.")
        assert len(parts) == 1


# ── Integration tests: evaluator ──────────────────────────────────────────


class TestRetrievalEvaluator:
    @pytest.mark.asyncio
    async def test_evaluate_single_case(self, evaluator) -> None:
        case = src.domain.evaluation.EvaluationCase(
            id="test-1",
            query="What is the return policy?",
            expected_answer="Items can be returned within 90 days.",
            retrieved_contexts=[
                "Our return policy allows returns within 90 days.",
                "Shipping takes 3-5 business days.",
            ],
            generated_answer="You can return items within 90 days.",
        )
        report = await evaluator.evaluate([case], suite_name="test")
        assert report.total_cases == 1
        assert report.suite_name == "test"
        assert report.eval_time_ms > 0
        assert len(report.case_results) == 1

        result = report.case_results[0]
        assert result.case_id == "test-1"
        # Should have at least context_relevance, precision, utilization
        metric_names = {m.name for m in result.metrics}
        assert src.domain.evaluation.MetricName.CONTEXT_RELEVANCE in metric_names
        assert src.domain.evaluation.MetricName.CONTEXT_PRECISION in metric_names

    @pytest.mark.asyncio
    async def test_evaluate_empty_cases(self, evaluator) -> None:
        report = await evaluator.evaluate([])
        assert report.total_cases == 0
        assert report.case_results == []

    @pytest.mark.asyncio
    async def test_metrics_are_bounded(self, evaluator) -> None:
        case = src.domain.evaluation.EvaluationCase(
            id="bounded",
            query="test query",
            expected_answer="test answer",
            retrieved_contexts=["relevant context about the test"],
            generated_answer="test answer",
        )
        report = await evaluator.evaluate([case])
        for result in report.case_results:
            for metric in result.metrics:
                assert 0.0 <= metric.score <= 1.0, (
                    f"{metric.name} score {metric.score} out of bounds"
                )

    @pytest.mark.asyncio
    async def test_summary_aggregation(self, evaluator) -> None:
        cases: list[EvaluationCase] = [
            src.domain.evaluation.EvaluationCase(
                id=f"case-{i}",
                query=f"Query number {i}",
                retrieved_contexts=["Some context here."],
                generated_answer="An answer.",
            )
            for i in range(5)
        ]
        report = await evaluator.evaluate(cases)
        assert report.total_cases == 5
        # Summary should contain averaged metrics
        for key, value in report.summary.items():
            assert 0.0 <= value <= 1.0

    @pytest.mark.asyncio
    async def test_precomputed_embeddings_skips_embed(self) -> None:
        """When embeddings are pre-computed, no embeddings are re-computed."""
        call_count = 0

        class CountingEmbedder:
            async def embed(self, texts) -> list[list[float]]:
                nonlocal call_count
                call_count += 1
                return [[0.1] * 4] * len(texts)

        case = src.domain.evaluation.EvaluationCase(
            id="precomputed",
            query="test",
            query_embedding=[1.0, 0.0, 0.0, 0.0],
            context_embeddings=[[0.9, 0.1, 0.0, 0.0]],
            expected_embedding=[0.8, 0.2, 0.0, 0.0],
            answer_embedding=[0.85, 0.15, 0.0, 0.0],
            retrieved_contexts=["context"],
            expected_answer="expected",
            generated_answer="answer",
        )
        ev = src.domain.evaluation.RetrievalEvaluator(embedder=CountingEmbedder())
        await ev.evaluate([case])
        assert call_count == 0

    @pytest.mark.asyncio
    async def test_with_llm_judge(self, evaluator_with_judge) -> None:
        case = src.domain.evaluation.EvaluationCase(
            id="judge-test",
            query="What is the policy?",
            expected_answer="Return within 90 days.",
            retrieved_contexts=["Return items within 90 days of purchase."],
            generated_answer="Return within 90 days.",
        )
        report = await evaluator_with_judge.evaluate([case])
        result = report.case_results[0]
        metric_names = {m.name for m in result.metrics}
        assert src.domain.evaluation.MetricName.FAITHFULNESS in metric_names
        assert src.domain.evaluation.MetricName.ANSWER_CORRECTNESS in metric_names


class TestEvaluationReport:
    def test_mean_calculation(self) -> None:
        report = src.domain.evaluation.EvaluationReport(
            case_results=[],
            total_cases=0,
        )
        assert report.mean(src.domain.evaluation.MetricName.CONTEXT_RELEVANCE) == 0.0

    def test_case_result_score_lookup(self) -> None:
        from src.domain.evaluation import CaseResult

        cr = CaseResult(
            case_id="x",
            query="q",
            metrics=[
                src.domain.evaluation.MetricResult(name=src.domain.evaluation.MetricName.CONTEXT_RELEVANCE, score=0.85),
            ],
        )
        assert cr.score(src.domain.evaluation.MetricName.CONTEXT_RELEVANCE) == 0.85
        assert cr.score(src.domain.evaluation.MetricName.FAITHFULNESS) is None
