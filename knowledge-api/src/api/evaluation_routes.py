"""
API Routes — Retrieval Evaluation Pipeline

Endpoints for running RAGAS-style retrieval quality evaluations
against the knowledge base. Consumed by CI pipelines, the Knowledge
UI dashboard, and the Knowledge Manager workflow.

Endpoints:
    POST /v1/evaluate          — Run evaluation on a test suite
    POST /v1/evaluate/single   — Evaluate a single case (quick check)
"""

# ruff: noqa: B008

from __future__ import annotations

import typing

import fastapi
import pydantic

import src.core.auth
import src.core.logging
import src.domain.evaluation
import src.domain.models

router = fastapi.APIRouter(
    prefix="/v1/evaluate",
    tags=["evaluation"],
    dependencies=[fastapi.Depends(src.core.auth.verify_request_jwt)],
)
UNSCOPED_EVAL_ANALYTICS_SCOPE = "unscoped-eval"


# ── Request / Response models ─────────────────────────────────────────────


class EvaluateSuiteRequest(pydantic.BaseModel):
    """Request to evaluate a full test suite."""

    suite_name: str = "default"
    cases: list[src.domain.evaluation.EvaluationCase]
    relevance_threshold: float = pydantic.Field(0.5, ge=0.0, le=1.0)


class EvaluateSingleRequest(pydantic.BaseModel):
    """Quick single-case evaluation."""

    query: str
    retrieved_contexts: list[str] = pydantic.Field(default_factory=list)
    expected_answer: str = ""
    generated_answer: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_embedder(request: fastapi.Request):
    return request.app.state.embedding_client


def _get_judge(request: fastapi.Request) -> typing.Any | None:
    return getattr(request.app.state, "llm_judge", None)


def _caller_stream_scopes(identity: src.core.auth.RequestIdentity) -> list[str]:
    scopes: list[str] = [
        str(scope).strip()
        for scope in (getattr(identity, "scopes", None) or [])
        if str(scope).strip()
    ]
    if scopes:
        return scopes

    scope: str = str(getattr(identity, "scope", "")).strip()
    if scope:
        return [scope]

    raise fastapi.HTTPException(status_code=403, detail="No runtime stream scope provided")


def _caller_acl_principals(identity: src.core.auth.RequestIdentity) -> list[str]:
    principals: set[str] = {
        str(group).strip().lower()
        for group in (getattr(identity, "groups", None) or [])
        if str(group).strip()
    }
    role: str = str(getattr(identity, "role", "")).strip().lower()
    if role:
        principals.add(f"role:{role}")
    return sorted(principals)


def _analytics_scope(identity: src.core.auth.RequestIdentity) -> str:
    scope: str = str(getattr(identity, "scope", "") or "").strip()
    if scope and scope != "global":
        return scope

    non_global_scopes: list[str] = [
        str(scope).strip()
        for scope in (getattr(identity, "scopes", None) or [])
        if str(scope).strip() and str(scope).strip() != "global"
    ]
    return non_global_scopes[0] if len(non_global_scopes) == 1 else UNSCOPED_EVAL_ANALYTICS_SCOPE


def _summary_metric(
    report: src.domain.evaluation.EvaluationReport,
    *keys: str,
) -> float | None:
    for key in keys:
        if key in report.summary:
            try:
                return float(report.summary[key])
            except (TypeError, ValueError):
                return None
    return None


def _emit_evaluation_analytics(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity,
    report: src.domain.evaluation.EvaluationReport,
    *,
    source: str,
    suite_name: str,
) -> None:
    analytics: typing.Any | None = getattr(request.app.state, "analytics", None)
    if analytics is None or not hasattr(analytics, "fire"):
        return

    metrics: dict[str, float] = {
        key: value
        for key, value in {
            "faithfulness": _summary_metric(report, "faithfulness"),
            "answer_relevancy": _summary_metric(
                report,
                "answer_relevancy",
                "answer_relevance",
                "answer_similarity",
            ),
            "context_precision": _summary_metric(report, "context_precision"),
            "context_recall": _summary_metric(report, "context_recall"),
            "answer_correctness": _summary_metric(report, "answer_correctness"),
        }.items()
        if value is not None
    }

    case_count: int = max(int(report.total_cases or 0), 0)
    ragas_sample_count: int = case_count if metrics else 0
    scope: str = _analytics_scope(identity)
    payload: dict[str, typing.Any] = {
        "suite_name": report.suite_name or suite_name,
        "source": source,
        "case_count": case_count,
        "ragas_sample_count": ragas_sample_count,
        "ragas_coverage_rate": round(
            ragas_sample_count / case_count,
            4,
        )
        if case_count
        else 0.0,
        "eval_time_ms": round(float(report.eval_time_ms or 0), 1),
        "embedding_calls": report.embedding_calls,
        "llm_judge_calls": report.llm_judge_calls,
        "estimated_cost_usd": report.estimated_cost_usd,
        "summary": dict(report.summary),
    }
    if metrics:
        payload.update(metrics)
        payload["ragas"] = metrics
    if scope != UNSCOPED_EVAL_ANALYTICS_SCOPE:
        payload["stream_id"] = scope

    analytics.fire(
        "kb.evaluation",
        org_id=identity.org_id,
        user_id=identity.user_id,
        scope=scope,
        payload=payload,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("", response_model=src.domain.evaluation.EvaluationReport)
async def evaluate_suite(
    body: EvaluateSuiteRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.evaluation.EvaluationReport:
    """
    Run RAGAS-style evaluation metrics on a test suite.

    Accepts a list of evaluation cases (query + expected + retrieved + answer)
    and returns per-case metric scores plus aggregate summary.
    """
    if not body.cases:
        raise fastapi.HTTPException(status_code=400, detail="No evaluation cases provided")

    embedder = _get_embedder(request)
    judge: typing.Any | None = _get_judge(request)

    evaluator = src.domain.evaluation.RetrievalEvaluator(
        embedder=embedder,
        judge=judge,
        relevance_threshold=body.relevance_threshold,
    )

    src.core.logging.logger.info(
        "Running evaluation suite",
        extra={
            "suite": body.suite_name,
            "cases": len(body.cases),
            "org_id": identity.org_id,
        },
    )

    report = await evaluator.evaluate(body.cases, suite_name=body.suite_name)

    _emit_evaluation_analytics(
        request,
        identity,
        report,
        source="suite",
        suite_name=body.suite_name,
    )

    src.core.logging.logger.info(
        "Evaluation complete",
        extra={
            "suite": body.suite_name,
            "cases": report.total_cases,
            "time_ms": report.eval_time_ms,
            "summary": report.summary,
        },
    )

    return report


@router.post("/single", response_model=src.domain.evaluation.EvaluationReport)
async def evaluate_single(
    body: EvaluateSingleRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.evaluation.EvaluationReport:
    """
    Quick evaluation of a single retrieval case.

    Convenience endpoint for testing individual queries without
    constructing a full test suite.
    """
    case = src.domain.evaluation.EvaluationCase(
        id="single",
        query=body.query,
        expected_answer=body.expected_answer,
        retrieved_contexts=body.retrieved_contexts,
        generated_answer=body.generated_answer,
    )

    embedder = _get_embedder(request)
    judge: typing.Any | None = _get_judge(request)

    evaluator = src.domain.evaluation.RetrievalEvaluator(
        embedder=embedder,
        judge=judge,
    )

    report = await evaluator.evaluate([case], suite_name="single")
    _emit_evaluation_analytics(
        request,
        identity,
        report,
        source="single",
        suite_name="single",
    )
    return report


# ═══════════════════════════════════════════════════════════════════════════════
# Auto-Eval — full pipeline: search → (contexts) → evaluate
# ═══════════════════════════════════════════════════════════════════════════════


class AutoEvalCase(pydantic.BaseModel):
    """A test case for auto-evaluation. Only query is required."""

    id: str = ""
    query: str
    expected_answer: str = ""


class AutoEvalRequest(pydantic.BaseModel):
    """Request to run full-pipeline auto evaluation."""

    suite_name: str = "auto-eval"
    cases: list[AutoEvalCase]
    top_k: int = pydantic.Field(5, ge=1, le=20)
    relevance_threshold: float = pydantic.Field(0.5, ge=0.0, le=1.0)
    mode: src.domain.models.SearchMode = src.domain.models.SearchMode.HYBRID
    departments: list[str] = pydantic.Field(default_factory=list)
    include_pending: bool = False


@router.post("/auto", response_model=src.domain.evaluation.EvaluationReport)
async def auto_evaluate(
    body: AutoEvalRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
) -> src.domain.evaluation.EvaluationReport:
    """
    Full-pipeline evaluation: for each case, search the knowledge base,
    use retrieved chunks as context, and run RAGAS-style metrics.

    This tests the real retrieval pipeline end-to-end — the agent evaluates
    itself using its own retrieval stack.
    """
    if not body.cases:
        raise fastapi.HTTPException(status_code=400, detail="No evaluation cases provided")

    store = request.app.state.vector_store
    embedder = _get_embedder(request)
    judge: typing.Any | None = _get_judge(request)
    using_local_embedder: bool = bool(
        getattr(request.app.state, "using_local_embedder", False)
    )
    caller_scopes: list[str] = _caller_stream_scopes(identity)
    caller_principals: list[str] = _caller_acl_principals(identity)
    default_mode = body.mode
    if using_local_embedder and default_mode in (
        src.domain.models.SearchMode.HYBRID,
        src.domain.models.SearchMode.VECTOR,
    ):
        default_mode = src.domain.models.SearchMode.KEYWORD

    eval_cases: list[src.domain.evaluation.EvaluationCase] = []

    for tc in body.cases:
        # Step 1: Search the knowledge base
        try:
            case_mode = default_mode
            query_embedding = None
            if case_mode in (
                src.domain.models.SearchMode.HYBRID,
                src.domain.models.SearchMode.VECTOR,
            ):
                try:
                    query_embedding = (await embedder.embed([tc.query]))[0]
                except Exception as exc:
                    src.core.logging.logger.warning(
                        "Auto-eval embedding failed, falling back to keyword: %s",
                        exc,
                    )
                    case_mode = src.domain.models.SearchMode.KEYWORD

            search_query = src.domain.models.SearchQuery(
                query=tc.query,
                org_id=identity.org_id,
                mode=case_mode,
                top_k=body.top_k,
                filters=src.domain.models.SearchFilters(
                    departments=body.departments,
                    value_streams=caller_scopes,
                    caller_user_id=identity.user_id,
                    caller_principals=caller_principals,
                    document_statuses=(
                        [
                            src.domain.models.DocumentStatus.PUBLISHED,
                            src.domain.models.DocumentStatus.INDEXED,
                            src.domain.models.DocumentStatus.PENDING_REVIEW,
                        ]
                        if body.include_pending
                        else [
                            src.domain.models.DocumentStatus.PUBLISHED,
                            src.domain.models.DocumentStatus.INDEXED,
                        ]
                    ),
                ),
                include_content=True,
                include_citations=False,
            )
            results = await store.search(search_query, query_embedding)

            # Extract text content from results
            contexts: list[str] = [
                result.content
                for result in results.results
                if result.content
            ][: body.top_k]
        except Exception as exc:
            src.core.logging.logger.warning(
                "Auto-eval retrieval failed for %s: %s",
                tc.query[:80],
                exc,
            )
            contexts = []

        # Step 2: Build evaluation case
        eval_cases.append(
            src.domain.evaluation.EvaluationCase(
                id=tc.id or f"auto-{len(eval_cases)}",
                query=tc.query,
                expected_answer=tc.expected_answer,
                retrieved_contexts=contexts,
                generated_answer="",  # No generation step — we evaluate retrieval quality
            )
        )

    # Step 3: Run evaluation
    evaluator = src.domain.evaluation.RetrievalEvaluator(
        embedder=embedder,
        judge=judge,
        relevance_threshold=body.relevance_threshold,
    )

    src.core.logging.logger.info(
        "Running auto-evaluation",
        extra={
            "suite": body.suite_name,
            "cases": len(eval_cases),
            "top_k": body.top_k,
            "org_id": identity.org_id,
        },
    )

    report = await evaluator.evaluate(eval_cases, suite_name=body.suite_name)

    _emit_evaluation_analytics(
        request,
        identity,
        report,
        source="auto",
        suite_name=body.suite_name,
    )

    src.core.logging.logger.info(
        "Auto-evaluation complete",
        extra={
            "suite": body.suite_name,
            "time_ms": report.eval_time_ms,
            "summary": report.summary,
        },
    )

    return report


# ═══════════════════════════════════════════════════════════════════════════════
# Embedding Drift Detection
# ═══════════════════════════════════════════════════════════════════════════════


class DriftAnalysisRequest(pydantic.BaseModel):
    """Request to analyze embedding drift."""

    reference_embeddings: list[list[float]] = pydantic.Field(default_factory=list)
    current_embeddings: list[list[float]] = pydantic.Field(default_factory=list)
    centroid_threshold: float = 0.15
    spread_threshold: float = 0.30


@router.post("/drift")
async def analyze_drift(
    body: DriftAnalysisRequest,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),
):
    """
    Analyze embedding distribution drift between a reference baseline
    and current embeddings.

    Returns centroid drift, spread changes, and severity-classified alerts.
    Use this to detect silent embedding model changes or data distribution shifts.
    """
    from src.domain.embedding_drift import EmbeddingDriftDetector

    if not body.reference_embeddings or not body.current_embeddings:
        raise fastapi.HTTPException(
            status_code=400,
            detail="Both reference and current embeddings are required",
        )

    detector = EmbeddingDriftDetector(
        centroid_drift_threshold=body.centroid_threshold,
        spread_change_threshold=body.spread_threshold,
    )

    ref_snapshot = detector.compute_snapshot(body.reference_embeddings)
    cur_snapshot = detector.compute_snapshot(body.current_embeddings)
    report = detector.analyze(ref_snapshot, cur_snapshot)

    src.core.logging.logger.info(
        "Drift analysis complete",
        extra={
            "centroid_drift": report.centroid_drift,
            "is_drifted": report.is_drifted,
            "alerts": len(report.alerts),
            "org_id": identity.org_id,
        },
    )

    return report
