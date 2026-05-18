"""
API Routes — HTTP endpoints consumed by the HKI Agentic BFF.

Endpoints:
  POST /v1/chat/stream   — Process a message through the ADK Agent (SSE)
"""

from __future__ import annotations

import hashlib
import json
import typing

import fastapi
import fastapi.responses
import pydantic

import src.adapters.analytics_client
import src.adapters.llm_client
import src.core.auth
import src.domain.agent
import src.domain.guardrails
import src.domain.models
import src.domain.tools

router = fastapi.APIRouter(prefix="/v1", tags=["orchestration"])


class ChatRequest(pydantic.BaseModel):
    """Inbound chat request from the BFF."""

    conversation_id: str
    message: str
    user_id: str | None = None
    org_id: str | None = None
    history: list[dict[str, typing.Any]] | None = None
    scope: str | None = None
    scopes: list[str] | None = None
    stream_config: src.domain.models.StreamConfig | None = None


class CompletionMessage(pydantic.BaseModel):
    """Single chat-completion message for direct LLM calls."""

    role: str
    content: str


class CompletionRequest(pydantic.BaseModel):
    """Low-level completion request for BFF admin features."""

    messages: list[CompletionMessage]
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    api_key: str | None = None
    fallback_to_vertex_direct: bool = True


def _get_agent(request: fastapi.Request) -> src.domain.agent.AdkAgent:
    return request.app.state.agent


def _get_analytics(request: fastapi.Request) -> src.adapters.analytics_client.AnalyticsClient | None:
    return getattr(request.app.state, "analytics", None)


def _report_payload(report: src.domain.models.GuardrailsReport) -> dict[str, typing.Any]:
    return report.model_dump()


def _message_hash(message: str) -> str:
    return "sha256:" + hashlib.sha256(message.encode()).hexdigest()


def _emit_chat_audit_event(
    request: fastapi.Request,
    *,
    body: ChatRequest,
    identity: src.core.auth.RequestIdentity,
    effective_user_id: str,
    decision_outcome: str,
    decision_reason: str,
    input_report: src.domain.models.GuardrailsReport,
    output_report: src.domain.models.GuardrailsReport | None = None,
    tool_call_count: int = 0,
    response_metadata: dict[str, typing.Any] | None = None,
) -> None:
    analytics: src.adapters.analytics_client.AnalyticsClient | None = _get_analytics(request)
    if analytics is None:
        return

    active_domain = identity.scope
    authorized_domains = list(identity.scopes or [identity.scope])
    response_metadata = response_metadata or {}
    analytics.fire_audit_event(
        operation_type="agent.chat",
        org_id=body.org_id or identity.org_id,
        subject_id=effective_user_id,
        active_domain=active_domain,
        authorized_domains=authorized_domains,
        operation_name="orchestrator.chat",
        target_domain=active_domain,
        purpose="chat",
        decision_outcome=decision_outcome,
        decision_reason=decision_reason,
        actor_role=identity.role,
        evidence={
            "conversation_id": body.conversation_id,
            "message_hash": _message_hash(body.message),
            "input_guardrail_passed": input_report.passed,
            "output_guardrail_passed": output_report.passed if output_report else None,
            "input_guardrail_score": input_report.score,
            "output_guardrail_score": output_report.score if output_report else None,
            "tool_call_count": tool_call_count,
            "agent": response_metadata.get("agent", "adk_agent"),
            "model": response_metadata.get("model", ""),
            "redaction_profile": "metadata-only",
        },
    )


def _is_retryable_gateway_failure(exc: Exception) -> bool:
    message: str = str(exc).lower()
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
    client: src.adapters.llm_client.LLMClient,
    body: CompletionRequest,
) -> dict[str, typing.Any]:
    response: src.adapters.llm_client.LLMResponse = await client.chat(
        messages=[message.model_dump() for message: CompletionMessage in body.messages],
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
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),  # noqa: B008
) -> fastapi.responses.StreamingResponse | fastapi.responses.JSONResponse:
    """
    Process a user message with SSE streaming back to the BFF.
    Stream structure mimics the expected format of the frontend.
    """
    effective_user_id = body.user_id or identity.user_id

    # ── Input Guardrails (blocking — reject before reaching the LLM) ─────
    input_report: src.domain.models.GuardrailsReport = src.domain.guardrails.check_input(body.message, effective_user_id)
    if not input_report.passed:
        _emit_chat_audit_event(
            request,
            body=body,
            identity=identity,
            effective_user_id=effective_user_id,
            decision_outcome="deny",
            decision_reason="input_guardrail_violation",
            input_report=input_report,
        )
        return fastapi.responses.JSONResponse(
            status_code=422,
            content={
                "error": "input_guardrail_violation",
                "violations": [
                    {"rule": v.rule, "message": v.message, "severity": v.severity}
                    for v: src.domain.models.GuardrailViolation in input_report.input_violations
                ],
                "score": input_report.score,
            },
        )

    agent: src.domain.agent.AdkAgent = _get_agent(request)

    async def event_generator() -> typing.Generator[str, typing.Any, None]:
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

        cumulative_text: str = ""
        response_metadata: dict[str, typing.Any] = {}
        async for chunk in agent.chat_stream(
            session_id=body.conversation_id,
            user_id=effective_user_id,
            org_id=body.org_id or "default",
            message=body.message,
            scope=identity.scope,
            scopes=identity.scopes,
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
            output_report: src.domain.models.GuardrailsReport = src.domain.guardrails.check_output(cumulative_text, body.message)
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
                        for v: src.domain.models.GuardrailViolation in output_report.output_violations
                    ],
                },
            }
            yield f"data: {json.dumps(guardrail_event)}\n\n"
            _emit_chat_audit_event(
                request,
                body=body,
                identity=identity,
                effective_user_id=effective_user_id,
                decision_outcome="allow" if output_report.passed else "escalate",
                decision_reason="completed" if output_report.passed else "output_guardrail_flagged",
                input_report=input_report,
                output_report=output_report,
                tool_call_count=0,
                response_metadata=response_metadata,
            )
            final_event = {
                "type": "final_response",
                "content": cumulative_text,
                "metadata": response_metadata,
                "agent": response_metadata.get("agent"),
            }
            yield f"data: {json.dumps(final_event)}\n\n"

        yield "data: [DONE]\n\n"

    return fastapi.responses.StreamingResponse(
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
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),  # noqa: B008
) -> dict[str, typing.Any] | fastapi.responses.JSONResponse:
    """
    Synchronous fallback endpoint that accumulates the stream before returning.
    """
    effective_user_id = body.user_id or identity.user_id

    # ── Input Guardrails (blocking) ──────────────────────────────────────
    input_report: src.domain.models.GuardrailsReport = src.domain.guardrails.check_input(body.message, effective_user_id)
    if not input_report.passed:
        _emit_chat_audit_event(
            request,
            body=body,
            identity=identity,
            effective_user_id=effective_user_id,
            decision_outcome="deny",
            decision_reason="input_guardrail_violation",
            input_report=input_report,
        )
        return fastapi.responses.JSONResponse(
            status_code=422,
            content={
                "error": "input_guardrail_violation",
                "violations": [
                    {"rule": v.rule, "message": v.message, "severity": v.severity}
                    for v: src.domain.models.GuardrailViolation in input_report.input_violations
                ],
                "score": input_report.score,
            },
        )

    agent: src.domain.agent.AdkAgent = _get_agent(request)

    full_response: str = ""
    tool_calls = []
    trace: list[dict[str, typing.Any]] = []
    citations: list[dict[str, typing.Any]] = []
    response_metadata: dict[str, typing.Any] = {}

    async for chunk in agent.chat_stream(
        session_id=body.conversation_id,
        user_id=effective_user_id,
        org_id=body.org_id or "default",
        message=body.message,
        scope=identity.scope,
        scopes=identity.scopes,
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

    output_report: src.domain.models.GuardrailsReport = (
        src.domain.guardrails.check_output(full_response, body.message) if full_response else src.domain.models.GuardrailsReport()
    )
    combined_guardrails = src.domain.models.GuardrailsReport(
        passed=input_report.passed and output_report.passed,
        input_violations=input_report.input_violations,
        output_violations=output_report.output_violations,
        score=min(input_report.score, output_report.score),
    )
    _emit_chat_audit_event(
        request,
        body=body,
        identity=identity,
        effective_user_id=effective_user_id,
        decision_outcome="allow" if combined_guardrails.passed else "escalate",
        decision_reason="completed" if combined_guardrails.passed else "output_guardrail_flagged",
        input_report=input_report,
        output_report=output_report,
        tool_call_count=len(tool_calls),
        response_metadata=response_metadata,
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
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),  # noqa: B008
) -> dict[str, typing.Any] | fastapi.responses.JSONResponse:
    """
    Guarded low-level completion endpoint used by the BFF's admin/KB Gemini routes.
    Uses the configured gateway first, then falls back to direct Vertex AI only when
    the gateway is unavailable or transiently failing.
    """
    _ = identity
    primary = src.adapters.llm_client.LLMClient(api_key=body.api_key, model=body.model)
    try:
        return await _run_completion(primary, body)
    except Exception as exc: Exception:
        if (
            not body.fallback_to_vertex_direct
            or getattr(primary, "_vertex_direct", False)
            or not _is_retryable_gateway_failure(exc)
        ):
            return fastapi.responses.JSONResponse(
                status_code=502,
                content={
                    "error": "llm_completion_failed",
                    "message": str(exc),
                },
            )
    finally:
        await primary.close()

    fallback = src.adapters.llm_client.LLMClient(base_url="", api_key=body.api_key, model=body.model)
    try:
        result: dict[str, Any] = await _run_completion(fallback, body)
        result["fallback_used"] = True
        return result
    except Exception as exc: Exception:
        return fastapi.responses.JSONResponse(
            status_code=502,
            content={
                "error": "llm_completion_failed",
                "message": f"Gateway failed and Vertex fallback also failed: {exc}",
            },
        )
    finally:
        await fallback.close()


class ToolInfo(pydantic.BaseModel):
    """Public tool info for the UI registry browser."""

    name: str
    description: str
    parameters: dict[str, typing.Any]
    category: str = "other"
    risk_level: str = "low"
    approval_required: bool = False


@router.get("/tools", response_model=list[ToolInfo])
async def list_tools(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = fastapi.Depends(src.core.auth.verify_request_jwt),  # noqa: B008
) -> list[ToolInfo]:
    """List all available tools for the UI tool registry browser."""
    _ = identity
    agent: src.domain.agent.AdkAgent = _get_agent(request)
    tools: list[ToolInfo] = []
    governed_catalog: dict[str, ToolSpec] = src.domain.tools.get_tool_catalog()

    category_map: dict[str, str] = {
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
            name: str = fn.__name__.lstrip("_")
            desc: str = (fn.__doc__ or "").strip()
        else:
            name = str(fn)
            desc: str = ""

        governed: src.domain.tools.ToolSpec | None = governed_catalog.get(name)
        category: str = governed.category if governed else "other"
        if not governed:
            for keyword, mapped_category in category_map.items():
                if keyword in name:
                    category: str = mapped_category
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
