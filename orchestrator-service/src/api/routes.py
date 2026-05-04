"""
API Routes — HTTP endpoints consumed by the HKI Agentic BFF.

Endpoints:
  POST /v1/chat/stream   — Process a message through the ADK Agent (SSE)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from src.adapters.llm_client import LLMClient
from src.core.auth import RequestIdentity, verify_request_jwt
from src.domain.agent import AdkAgent
from src.domain.guardrails import check_input, check_output
from src.domain.models import GuardrailsReport, StreamConfig
from src.domain.tools import get_tool_catalog

router = APIRouter(prefix="/v1", tags=["orchestration"])


class ChatRequest(BaseModel):
    """Inbound chat request from the BFF."""

    conversation_id: str
    message: str
    user_id: str | None = None
    org_id: str | None = None
    history: list[dict[str, Any]] | None = None
    scope: str = "global"
    scopes: list[str] | None = None
    stream_config: StreamConfig | None = None


class CompletionMessage(BaseModel):
    """Single chat-completion message for direct LLM calls."""

    role: str
    content: str


class CompletionRequest(BaseModel):
    """Low-level completion request for BFF admin features."""

    messages: list[CompletionMessage]
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    api_key: str | None = None
    fallback_to_vertex_direct: bool = True


def _get_agent(request: Request) -> AdkAgent:
    return request.app.state.agent


def _report_payload(report: GuardrailsReport) -> dict[str, Any]:
    return report.model_dump()


def _is_retryable_gateway_failure(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "llm returned 429" in message
        or "llm returned 302" in message
        or "llm returned 303" in message
        or "llm returned 307" in message
        or "llm returned 308" in message
        or "llm returned 500" in message
        or "llm returned 502" in message
        or "llm returned 503" in message
        or "llm returned 504" in message
        or "llm request timed out" in message
        or "llm gateway request failed" in message
        or "llm gateway authentication failed (iap/identity token)" in message
        or "unable to parse jwt" in message
        or "identity token" in message
    )


async def _run_completion(
    client: LLMClient,
    body: CompletionRequest,
) -> dict[str, Any]:
    response = await client.chat(
        messages=[message.model_dump() for message in body.messages],
        model=body.model,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )
    return {
        "content": response.content,
        "model": response.model,
        "finish_reason": response.finish_reason,
        "usage": response.usage,
        "mode": "vertex_direct" if getattr(client, "_vertex_direct", False) else "gateway",
        "fallback_used": False,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/chat/stream", response_model=None)
async def chat_stream(
    body: ChatRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_request_jwt),  # noqa: B008
) -> StreamingResponse | JSONResponse:
    """
    Process a user message with SSE streaming back to the BFF.
    Stream structure mimics the expected format of the frontend.
    """
    effective_user_id = body.user_id or identity.user_id

    # ── Input Guardrails (blocking — reject before reaching the LLM) ─────
    input_report = check_input(body.message, effective_user_id)
    if not input_report.passed:
        return JSONResponse(
            status_code=422,
            content={
                "error": "input_guardrail_violation",
                "violations": [
                    {"rule": v.rule, "message": v.message, "severity": v.severity}
                    for v in input_report.input_violations
                ],
                "score": input_report.score,
            },
        )

    agent = _get_agent(request)

    async def event_generator():
        # Emit guardrail pass event so the UI can show the shield icon
        input_guardrail_event = {
            "type": "guardrail",
            "step": 0,
            "content": "Input validated",
            "metadata": {
                "section": "INPUT_GUARDRAILS",
                "icon": "🛡️",
                "passed": True,
                "score": input_report.score,
                "report": _report_payload(input_report),
            },
        }
        yield f"data: {json.dumps(input_guardrail_event)}\n\n"

        cumulative_text = ""
        response_metadata: dict[str, Any] = {}
        async for chunk in agent.chat_stream(
            session_id=body.conversation_id,
            user_id=effective_user_id,
            org_id=body.org_id or "default",
            message=body.message,
            scope=identity.scope,
            scopes=body.scopes,
            stream_config=body.stream_config,
        ):
            if isinstance(chunk, dict):
                if chunk.get("type") == "response_metadata":
                    response_metadata = chunk.get("metadata", {}) or {}
                    continue
                if chunk.get("type") == "final_response_chunk":
                    cumulative_text += chunk.get("content", "")
                    yield f"data: {json.dumps(chunk)}\n\n"
                else:
                    yield f"data: {json.dumps(chunk)}\n\n"
            else:
                cumulative_text += chunk
                event = {
                    "type": "final_response_chunk",
                    "content": chunk,
                }
                yield f"data: {json.dumps(event)}\n\n"

        # ── Output Guardrails (after full response is assembled) ─────────
        if cumulative_text:
            output_report = check_output(cumulative_text, body.message)
            guardrail_event = {
                "type": "guardrail",
                "step": 999,
                "content": "Output validated" if output_report.passed else "Output flagged",
                "metadata": {
                    "section": "OUTPUT_GUARDRAILS",
                    "icon": "🛡️",
                    "passed": output_report.passed,
                    "score": output_report.score,
                    "report": _report_payload(output_report),
                    "violations": [
                        {"rule": v.rule, "message": v.message, "severity": v.severity}
                        for v in output_report.output_violations
                    ],
                },
            }
            yield f"data: {json.dumps(guardrail_event)}\n\n"
            final_event = {
                "type": "final_response",
                "content": cumulative_text,
                "metadata": response_metadata,
                "agent": response_metadata.get("agent"),
            }
            yield f"data: {json.dumps(final_event)}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat", response_model=None)
async def chat(
    body: ChatRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_request_jwt),  # noqa: B008
) -> dict[str, Any] | JSONResponse:
    """
    Synchronous fallback endpoint that accumulates the stream before returning.
    """
    effective_user_id = body.user_id or identity.user_id

    # ── Input Guardrails (blocking) ──────────────────────────────────────
    input_report = check_input(body.message, effective_user_id)
    if not input_report.passed:
        return JSONResponse(
            status_code=422,
            content={
                "error": "input_guardrail_violation",
                "violations": [
                    {"rule": v.rule, "message": v.message, "severity": v.severity}
                    for v in input_report.input_violations
                ],
                "score": input_report.score,
            },
        )

    agent = _get_agent(request)

    full_response = ""
    tool_calls = []
    trace: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    response_metadata: dict[str, Any] = {}

    async for chunk in agent.chat_stream(
        session_id=body.conversation_id,
        user_id=effective_user_id,
        org_id=body.org_id or "default",
        message=body.message,
        scope=identity.scope,
        scopes=body.scopes,
        stream_config=body.stream_config,
    ):
        if isinstance(chunk, dict):
            if chunk.get("type") == "final_response_chunk":
                full_response += chunk.get("content", "")
            elif chunk.get("type") == "response_metadata":
                response_metadata = chunk.get("metadata", {}) or {}
            elif chunk.get("type") == "tool_call":
                meta = chunk.get("metadata", {})
                tool_calls.append(
                    {
                        "tool_call_id": meta.get("tool_call_id", ""),
                        "name": meta.get("tool", ""),
                        "output": None,
                        "duration_ms": 0,
                    }
                )
            elif chunk.get("type") == "tool_result":
                meta = chunk.get("metadata", {}).get("result", {})
                t_id = meta.get("tool_call_id")
                for tc in tool_calls:
                    if tc["tool_call_id"] == t_id:
                        tc["output"] = meta.get("output")
                        tc["duration_ms"] = meta.get("duration_ms", 0)
            else:
                trace.append(chunk)
                if chunk.get("type") == "knowledge_retrieval":
                    citations.extend(chunk.get("metadata", {}).get("citations", []))
        else:
            full_response += chunk

    output_report = (
        check_output(full_response, body.message) if full_response else GuardrailsReport()
    )
    combined_guardrails = GuardrailsReport(
        passed=input_report.passed and output_report.passed,
        input_violations=input_report.input_violations,
        output_violations=output_report.output_violations,
        score=min(input_report.score, output_report.score),
    )

    return {
        "message_id": "msg-adk",
        "content": full_response,
        "confidence": response_metadata.get("confidence", 1.0),
        "agent_used": response_metadata.get("agent", "adk_agent"),
        "tool_calls": tool_calls,
        "trace": trace,
        "citations": citations,
        "guardrails": combined_guardrails.model_dump(),
        "response_metadata": response_metadata,
    }


@router.post("/llm/complete", response_model=None)
async def llm_complete(
    body: CompletionRequest,
    identity: RequestIdentity = Depends(verify_request_jwt),  # noqa: B008
) -> dict[str, Any] | JSONResponse:
    """
    Guarded low-level completion endpoint used by the BFF's admin/KB Gemini routes.
    Uses the configured gateway first, then falls back to direct Vertex AI only when
    the gateway is unavailable or transiently failing.
    """
    _ = identity
    primary = LLMClient(api_key=body.api_key, model=body.model)
    try:
        return await _run_completion(primary, body)
    except Exception as exc:
        if (
            not body.fallback_to_vertex_direct
            or getattr(primary, "_vertex_direct", False)
            or not _is_retryable_gateway_failure(exc)
        ):
            return JSONResponse(
                status_code=502,
                content={
                    "error": "llm_completion_failed",
                    "message": str(exc),
                },
            )
    finally:
        await primary.close()

    fallback = LLMClient(base_url="", api_key=body.api_key, model=body.model)
    try:
        result = await _run_completion(fallback, body)
        result["fallback_used"] = True
        return result
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": "llm_completion_failed",
                "message": f"Gateway failed and Vertex fallback also failed: {exc}",
            },
        )
    finally:
        await fallback.close()


class ToolInfo(BaseModel):
    """Public tool info for the UI registry browser."""

    name: str
    description: str
    parameters: dict[str, Any]
    category: str = "other"
    risk_level: str = "low"
    approval_required: bool = False


@router.get("/tools", response_model=list[ToolInfo])
async def list_tools(
    request: Request,
    identity: RequestIdentity = Depends(verify_request_jwt),  # noqa: B008
) -> list[ToolInfo]:
    """List all available tools for the UI tool registry browser."""
    _ = identity
    agent = _get_agent(request)
    tools: list[ToolInfo] = []
    governed_catalog = get_tool_catalog()

    category_map = {
        "knowledge": "knowledge",
        "search": "search",
        "inventory": "data",
        "product": "data",
        "pricing": "data",
        "member": "data",
        "order": "data",
        "sales": "compute",
        "analyze": "compute",
    }

    for fn in agent.tools:
        if callable(fn):
            name = fn.__name__.lstrip("_")
            desc = (fn.__doc__ or "").strip()
        else:
            name = str(fn)
            desc = ""

        governed = governed_catalog.get(name)
        category = governed.category if governed else "other"
        if not governed:
            for keyword, mapped_category in category_map.items():
                if keyword in name:
                    category = mapped_category
                    break

        tools.append(
            ToolInfo(
                name=name,
                description=governed.description.strip() if governed else desc,
                parameters={},  # Simplify parameters for the UI mock
                category=category,
                risk_level=governed.risk_level.value if governed else "low",
                approval_required=governed.risk_level.value == "high" if governed else False,
            )
        )

    return tools
