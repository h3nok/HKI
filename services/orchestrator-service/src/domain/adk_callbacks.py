"""
ADK Callbacks — hooks into the ADK agent execution flow.

Provides before/after callbacks for tool execution that integrate:
  - Tiered caching (L1 in-process + L2 Redis)
  - Tool output schema validation
  - Corrective RAG with automatic query rewriting
  - Structured logging for observability

These callbacks are invoked by the ADK Runner during agent execution.
They operate on the tool function results, not the model calls
(ADK handles model calls natively via google.genai).
"""

from __future__ import annotations

import asyncio
import inspect
import time
import typing

import httpx

import src.adapters.cache
import src.core.config
import src.core.logging
import src.domain.tool_schemas

logger = src.core.logging.logger.getChild("adk_callbacks")

# Exceptions that indicate a transient failure worth retrying.
_TRANSIENT_EXCEPTIONS: tuple[type[BaseException], ...] = (
    ConnectionError,
    TimeoutError,
    OSError,
    httpx.ConnectError,
    httpx.ReadTimeout,
)

_TOOL_RETRY_ATTEMPTS = 2  # 1 original + 1 retry
_TOOL_RETRY_DELAY = 0.5  # seconds


def _is_tool_cacheable(tool_name: str) -> bool:
    """Return whether a tool result is safe to reuse from the shared cache."""
    return tool_name != "search_knowledge"


async def execute_tool_with_hooks(
    tool_name: str,
    tool_func: typing.Any,
    arguments: dict[str, typing.Any],
    *,
    cache: src.adapters.cache.TieredCache | None = None,
    retrieval_strategy: str = "hybrid",
) -> tuple[typing.Any, float, bool]:
    """
    Execute a tool function with cache lookup, validation, and corrective RAG.

    Returns:
        (result, duration_ms, cache_hit)
    """
    cache_key = src.adapters.cache.make_cache_key(tool=tool_name, **arguments)
    use_cache: bool = cache is not None and _is_tool_cacheable(tool_name)

    if use_cache:
        cached = await cache.get("tool", cache_key)
        if cached is not None:
            logger.info("Tool cache hit", extra={"tool": tool_name, "cache_key": cache_key[:8]})
            return cached, 0.0, True

    t0: float = time.perf_counter()
    result: typing.Any = None

    for attempt in range(_TOOL_RETRY_ATTEMPTS):
        try:
            if tool_func is None:
                result = {"error": f"Tool {tool_name} not found"}
                break
            elif inspect.iscoroutinefunction(tool_func):
                result = await tool_func(**arguments)
            else:
                result = tool_func(**arguments)
            break
        except _TRANSIENT_EXCEPTIONS as exc:
            if attempt < _TOOL_RETRY_ATTEMPTS - 1:
                logger.warning(
                    "Tool transient error, retrying",
                    extra={
                        "tool": tool_name,
                        "attempt": attempt + 1,
                        "error": str(exc),
                    },
                )
                await asyncio.sleep(_TOOL_RETRY_DELAY * (attempt + 1))
                continue
            logger.error(
                "Tool transient error (exhausted retries)",
                extra={"tool": tool_name, "error": str(exc)},
            )
            result = {"error": f"Tool {tool_name} failed after retry: {exc}"}
        except Exception as exc:
            logger.error(f"Error executing tool {tool_name}: {exc}")
            result = {"error": "Tool execution failed due to an internal error."}
            break

    duration_ms: float = round((time.perf_counter() - t0) * 1000, 1)

    is_valid, validation_error = src.domain.tool_schemas.validate_tool_output(tool_name, result)
    if not is_valid:
        logger.warning(
            "Tool output validation failed",
            extra={"tool": tool_name, "error": validation_error},
        )

    if tool_name == "search_knowledge" and src.core.config.settings.CORRECTIVE_RAG_ENABLED:
        try:
            result = await _apply_corrective_rag(arguments.get("query", ""), result)
        except Exception as rag_err:
            logger.warning(f"Corrective RAG failed, using raw results: {rag_err}")

    if use_cache and not (isinstance(result, dict) and result.get("error")):
        await cache.set("tool", cache_key, result)

    return result, duration_ms, False


async def _apply_corrective_rag(
    query: str,
    search_result: dict[str, typing.Any],
) -> dict[str, typing.Any]:
    """
    Evaluate retrieval quality and retry with a rewritten query if results are weak.

    Fast-path: when the top retrieval score is already well above the sufficiency
    threshold, skip the Gemini Flash evaluation call entirely.  This saves 200–400 ms
    on the majority of searches where results are clearly relevant.

    When shaped_context is present, results are lightweight stubs (no `content`).
    We use the shaped context string as the evaluation payload in that case.
    """
    from src.adapters.llm_client import LLMClient
    from src.domain.corrective_rag import evaluate_retrieval, rewrite_query
    from src.domain.tools import search_knowledge

    raw_results = search_result.get("results", [])
    shaped_context: typing.Any | None = search_result.get(
        "context"
    )  # present when shape_context=True

    # ── Fast-path: skip LLM eval when top score is clearly sufficient ────────
    # Threshold = min_relevance + 0.3 (0.7 at default settings).
    # Below this we don't trust heuristic scoring alone, so we pay for Gemini eval.
    scores: list[float] = [float(result.get("score", 0.0)) for result in raw_results]
    max_score: float = max(scores, default=0.0)
    fast_path_threshold = src.core.config.settings.CORRECTIVE_RAG_MIN_RELEVANCE + 0.3

    if max_score >= fast_path_threshold:
        search_result["rag_quality"] = {
            "max_relevance": round(max_score, 3),
            "avg_relevance": round(sum(scores) / len(scores), 3) if scores else 0.0,
            "relevant_count": sum(
                1
                for score in scores
                if score >= src.core.config.settings.CORRECTIVE_RAG_MIN_RELEVANCE
            ),
            "total_count": len(scores),
            "is_sufficient": True,
            "evaluation": "fast_path",
        }
        return search_result

    # ── Full LLM evaluation ───────────────────────────────────────────────────
    # Build chunks for the evaluator.  When shaped_context is present, results
    # are stubs without `content`; use the shaped string as a single synthetic
    # chunk so the evaluator sees actual text.
    if shaped_context:
        chunks = [{"content": shaped_context, "score": max_score}]
    else:
        chunks: list[dict[str, typing.Any]] = [
            {"content": r.get("content", ""), "score": r.get("score", 0.0)} for r in raw_results
        ]

    llm = LLMClient(model=src.core.config.settings.LLM_MODEL_FAST)
    try:
        quality = await evaluate_retrieval(llm, query, chunks)
        search_result["rag_quality"] = quality.model_dump()

        if not quality.is_sufficient and src.core.config.settings.CORRECTIVE_RAG_MAX_RETRIES > 0:
            rewritten = await rewrite_query(llm, query)
            if rewritten:
                logger.info(f"Corrective RAG: retrying with rewritten query: {rewritten!r}")
                retry_result = await search_knowledge(rewritten)
                retry_shaped = retry_result.get("context")
                retry_raw = retry_result.get("results", [])
                if retry_shaped:
                    retry_chunks = [
                        {
                            "content": retry_shaped,
                            "score": max((r.get("score", 0.0) for r in retry_raw), default=0.0),
                        }
                    ]
                else:
                    retry_chunks = [
                        {"content": r.get("content", ""), "score": r.get("score", 0.0)}
                        for r in retry_raw
                    ]
                retry_quality = await evaluate_retrieval(llm, rewritten, retry_chunks)
                if retry_quality.max_relevance > quality.max_relevance:
                    retry_result["rag_quality"] = retry_quality.model_dump()
                    retry_result["rewritten_query"] = rewritten
                    return retry_result

        # ── Gap reporting ─────────────────────────────────────────────────────
        # Both original and retry searches failed — persist the gap so curators
        # can see which queries the knowledge base cannot answer.
        gap_desc = quality.gap_description
        if not quality.is_sufficient and gap_desc:
            asyncio.create_task(_report_gap(query=query, gap_description=gap_desc))

    finally:
        await llm.close()

    return search_result


async def _report_gap(*, query: str, gap_description: str) -> None:
    """Fire-and-forget: POST the detected gap to knowledge-api for curator visibility."""
    from src.core.service_client import service_client

    url: str = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/gaps"
    try:
        async with service_client(timeout=5.0) as client:
            await client.post(
                url,
                json={
                    "query": query,
                    "gap_description": gap_description,
                },
            )
    except Exception as exc:
        logger.debug("Gap report skipped", extra={"error": str(exc)[:120]})
