"""
Vertex AI Evaluation — managed LLM-as-Judge.

Drop-in replacement for GeminiJudge that implements the same LLMJudge
protocol using the Vertex AI Evaluation SDK instead of raw LiteLLM calls.

What this replaces vs what stays the same:
  - Replaces: _FAITHFULNESS_PROMPT, _CORRECTNESS_PROMPT, _parse_score,
              _multi_judge consensus loop, _call_llm, JSON fallback logic
  - Unchanged: RetrievalEvaluator, all 5 embedding-based metrics,
               evaluation_routes.py, EvaluationCase / EvaluationReport models

Uses custom PointwiseMetric definitions (1–5 scale) rather than the built-in
MetricPromptTemplateExamples — this avoids column-name fragility between SDK
versions and keeps scoring semantics identical to GeminiJudge.

Score scale: custom metrics use 1–5; normalized here to 0.0–1.0 via (raw-1)/4.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("knowledge.vertexai_judge")

# ── Custom metric definitions ────────────────────────────────────────────────
# Defined at module level so they're built once and reused across calls.
# Using lazy init inside the class to avoid importing vertexai at module import time.

_FAITHFULNESS_CRITERIA = {
    "Faithfulness": (
        "Every factual claim in the response is directly supported by the provided "
        "context. The response does not introduce facts, numbers, or assertions that "
        "are absent from or contradicted by the context."
    )
}

_FAITHFULNESS_RUBRIC = {
    "5": "All claims are fully and directly supported by the context",
    "4": "Almost all claims are supported; only minor unsupported inferences",
    "3": "Most claims are supported; some gaps or unsupported assertions",
    "2": "Some claims are supported; significant unsupported or wrong content",
    "1": "Response contradicts or largely ignores the context; mostly hallucinated",
}

_CORRECTNESS_CRITERIA = {
    "Correctness": (
        "The response conveys the same key facts and conclusions as the reference "
        "answer. Phrasing differences are acceptable; factual omissions or errors are not."
    )
}

_CORRECTNESS_RUBRIC = {
    "5": "Perfect: all key facts match, nothing incorrect",
    "4": "Mostly correct: minor omissions but no wrong facts",
    "3": "Partially correct: some key facts present, some missing",
    "2": "Weak: only tangentially related to the reference, many gaps",
    "1": "Wrong or empty: contradicts or entirely misses the reference answer",
}


class VertexAIJudge:
    """
    LLM-as-Judge backed by Vertex AI Evaluation SDK.

    Drop-in replacement for GeminiJudge — implements the same LLMJudge protocol.
    Uses custom PointwiseMetric definitions so scoring semantics match GeminiJudge
    exactly, without depending on built-in metric column conventions.

    Results are saved to Vertex AI Experiments when an experiment name is set,
    enabling cross-deploy score comparison in the GCP Console.

    Usage:
        judge = VertexAIJudge(project_id="my-project", experiment="rag-eval")
        score = await judge.judge_faithfulness(answer, contexts)   # 0.0–1.0
        score = await judge.judge_correctness(answer, expected)    # 0.0–1.0
    """

    def __init__(
        self,
        project_id: str,
        location: str = "us-central1",
        experiment: str | None = None,
    ) -> None:
        import vertexai
        from vertexai.evaluation import PointwiseMetric, PointwiseMetricPromptTemplate

        vertexai.init(project=project_id, location=location)
        self._experiment = experiment or None

        self._faithfulness_metric = PointwiseMetric(
            metric="faithfulness",
            metric_prompt_template=PointwiseMetricPromptTemplate(
                criteria=_FAITHFULNESS_CRITERIA,
                rating_rubric=_FAITHFULNESS_RUBRIC,
                input_variables=["response", "context"],
            ),
        )

        self._correctness_metric = PointwiseMetric(
            metric="correctness",
            metric_prompt_template=PointwiseMetricPromptTemplate(
                criteria=_CORRECTNESS_CRITERIA,
                rating_rubric=_CORRECTNESS_RUBRIC,
                input_variables=["response", "reference"],
            ),
        )

    async def close(self) -> None:
        pass  # No persistent connections

    # ── LLMJudge protocol ─────────────────────────────────────────────────

    async def judge_faithfulness(
        self,
        answer: str,
        contexts: list[str],
    ) -> float:
        """
        Score how grounded the answer is in the retrieved context.
        Returns 0.0 (hallucinated) → 1.0 (fully supported).
        """
        if not answer.strip() or not contexts:
            return 0.0

        import pandas as pd
        from vertexai.evaluation import EvalTask

        context_str = "\n\n---\n\n".join(
            f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(contexts[:10])
        )
        dataset = pd.DataFrame({"response": [answer], "context": [context_str]})
        task = EvalTask(
            dataset=dataset,
            metrics=[self._faithfulness_metric],
            experiment=self._experiment,
        )

        try:
            result = await asyncio.to_thread(task.evaluate)
            raw = float(result.summary_metrics.get("faithfulness/mean", 3.0))
            return round(_normalize(raw), 4)
        except Exception as exc:
            logger.warning("Vertex AI faithfulness eval failed: %s", exc)
            return 0.5

    async def judge_correctness(
        self,
        answer: str,
        expected: str,
    ) -> float:
        """
        Score how correct the generated answer is vs. the expected answer.
        Returns 0.0 (wrong) → 1.0 (matches expected).
        """
        if not answer.strip():
            return 0.0
        if not expected.strip():
            return 0.5

        import pandas as pd
        from vertexai.evaluation import EvalTask

        dataset = pd.DataFrame({"response": [answer], "reference": [expected]})
        task = EvalTask(
            dataset=dataset,
            metrics=[self._correctness_metric],
            experiment=self._experiment,
        )

        try:
            result = await asyncio.to_thread(task.evaluate)
            raw = float(result.summary_metrics.get("correctness/mean", 3.0))
            return round(_normalize(raw), 4)
        except Exception as exc:
            logger.warning("Vertex AI correctness eval failed: %s", exc)
            return 0.5

    # ── Batch API — preferred for test suite runs ─────────────────────────

    async def evaluate_batch(
        self,
        queries: list[str],
        responses: list[str],
        contexts: list[list[str]],
        references: list[str] | None = None,
        suite_name: str = "eval",
    ) -> dict[str, Any]:
        """
        Batch evaluation over N cases in one managed call.

        More efficient than N single-case calls: Vertex AI parallelizes
        judge calls internally and saves the full run to Vertex AI Experiments
        (if an experiment name is configured).

        Returns normalized summary metrics and per-case scores.
        """
        import pandas as pd
        from vertexai.evaluation import EvalTask

        context_strs = [
            "\n\n---\n\n".join(f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(ctx[:10]))
            for ctx in contexts
        ]

        data: dict[str, list] = {
            "response": responses,
            "context": context_strs,
        }
        metrics = [self._faithfulness_metric]

        if references:
            data["reference"] = references
            metrics.append(self._correctness_metric)

        task = EvalTask(
            dataset=pd.DataFrame(data),
            metrics=metrics,
            experiment=self._experiment or suite_name,
        )

        try:
            result = await asyncio.to_thread(task.evaluate)
            summary = {
                k: round(_normalize(float(v)), 4)
                for k, v in result.summary_metrics.items()
                if k.endswith("/mean")
            }
            return {
                "summary": summary,
                "per_case": result.metrics_table.to_dict(orient="records"),
                "experiment": self._experiment,
            }
        except Exception as exc:
            logger.error("Vertex AI batch eval failed: %s", exc)
            return {"summary": {}, "per_case": [], "experiment": None}


def _normalize(raw: float) -> float:
    """Convert 1–5 custom metric score to 0.0–1.0."""
    return max(0.0, min(1.0, (raw - 1.0) / 4.0))
