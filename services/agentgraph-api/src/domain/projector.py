"""
Python port of @agentgraph/core projector — maps orchestrator events to AgentRun graph.
Mirrors the TypeScript implementation in packages/agentgraph-core/src/projector.ts.
"""
from __future__ import annotations

import time
from typing import Any

from .models import AgentEdge, AgentNode, AgentRun, PlanStep


class ProjectorState:
    def __init__(self) -> None:
        self.last_node_id: str | None = None
        self.pending_tool_call_id: str | None = None
        self.plan_node_id: str | None = None
        self.response_text: str = ""
        self.node_counter: int = 0

    def next_id(self, kind: str) -> str:
        self.node_counter += 1
        return f"{kind}-{self.node_counter}"


def _edge_id(source: str, target: str) -> str:
    return f"edge-{source}-{target}"


def _exec_edge(source: str, target: str, kind: str = "execution", animated: bool = False) -> AgentEdge:
    return AgentEdge(id=_edge_id(source, target), source=source, target=target, kind=kind, animated=animated)  # type: ignore[arg-type]


def project_events(events: list[dict[str, Any]], run_id: str, query: str) -> AgentRun:
    run = AgentRun(id=run_id, query=query, start_ms=time.time() * 1000)
    state = ProjectorState()
    now = time.time() * 1000

    def add_node(node: AgentNode, *, skip_edge: bool = False) -> None:
        run.nodes.append(node)
        if not skip_edge and state.last_node_id and node.kind != "tool_result":
            run.edges.append(_exec_edge(state.last_node_id, node.id))
        state.last_node_id = node.id

    def add_tool_result(node: AgentNode) -> None:
        run.nodes.append(node)
        if state.pending_tool_call_id:
            run.edges.append(_exec_edge(state.pending_tool_call_id, node.id, kind="data"))
            state.pending_tool_call_id = None
        elif state.last_node_id:
            run.edges.append(_exec_edge(state.last_node_id, node.id))
        state.last_node_id = node.id

    for event in events:
        evt_type = event.get("type", "")
        meta = event.get("metadata", {}) or {}

        if evt_type == "guardrail":
            section_raw = meta.get("section", "")
            section: str = "input" if "INPUT" in section_raw else "output"
            nid = state.next_id("guardrail")
            add_node(AgentNode(
                id=nid, kind="guardrail",
                label=f"{'Input' if section == 'input' else 'Output'} Guardrail",
                status="success" if meta.get("passed", True) else "error",
                start_ms=now,
                passed=meta.get("passed", True),
                score=meta.get("score"),
                guardrail_section=section,  # type: ignore[arg-type]
                violations=meta.get("violations", []),
            ))

        elif evt_type == "routing":
            nid = state.next_id("routing")
            add_node(AgentNode(
                id=nid, kind="routing",
                label=f"Route → {meta.get('routed_to', '')}",
                status="success", start_ms=now,
                model=meta.get("model"),
                model_tier=meta.get("model_tier"),
                routing_reason=meta.get("reason"),
                enabled_tools=meta.get("enabled_tools"),
            ))

        elif evt_type == "memory_recall":
            nid = state.next_id("memory_recall")
            add_node(AgentNode(
                id=nid, kind="memory_recall", label="Memory Recall",
                status="success", start_ms=now,
                total_memories=meta.get("total_memories"),
            ))

        elif evt_type == "planning":
            nid = state.next_id("planning")
            add_node(AgentNode(
                id=nid, kind="planning", label="Building Execution Plan",
                status="running", start_ms=now,
                model=meta.get("model"),
            ))

        elif evt_type == "plan_generated":
            nid = state.next_id("plan")
            state.plan_node_id = nid
            planning_node = next((n for n in reversed(run.nodes) if n.kind == "planning"), None)
            if planning_node:
                planning_node.status = "success"
                planning_node.end_ms = now
            steps = [
                PlanStep(
                    step_id=s["step_id"],
                    description=s["description"],
                    tool_name=s["tool_name"],
                    status="planned",
                )
                for s in meta.get("steps", [])
            ]
            add_node(AgentNode(
                id=nid, kind="plan",
                label=f"Plan: {meta.get('total_steps', 0)} steps",
                status="running", start_ms=now,
                plan_id=meta.get("plan_id"),
                goal=meta.get("goal"),
                steps=steps,
            ))

        elif evt_type in ("step_started", "step_verified", "step_failed") and state.plan_node_id:
            plan_node = next((n for n in run.nodes if n.id == state.plan_node_id), None)
            if plan_node and plan_node.steps:
                step_id = meta.get("step_id")
                for step in plan_node.steps:
                    if step.step_id == step_id:
                        if evt_type == "step_started":
                            step.status = "executing"
                        elif evt_type == "step_verified":
                            step.status = "completed"
                            step.duration_ms = meta.get("duration_ms")
                        elif evt_type == "step_failed":
                            step.status = "failed"
                            step.error = meta.get("error")
                            plan_node.status = "warning"
                        break

        elif evt_type == "thinking":
            section = meta.get("section", "")
            if section in ("UNDERSTANDING", "SYNTHESIS"):
                continue
            nid = state.next_id("thinking")
            add_node(AgentNode(
                id=nid, kind="thinking",
                label=event.get("content", section)[:60],
                status="warning" if section == "MODEL_FALLBACK" else "success",
                start_ms=now,
                section=section,
                icon=meta.get("icon"),
                reasoning=meta.get("reasoning"),
                failed_model=meta.get("failed_model"),
                fallback_model=meta.get("fallback_model"),
            ))

        elif evt_type == "tool_call":
            nid = state.next_id("tool_call")
            state.pending_tool_call_id = nid
            add_node(AgentNode(
                id=nid, kind="tool_call",
                label=meta.get("tool", "tool"),
                status="running", start_ms=now,
                tool=meta.get("tool"),
                tool_args=meta.get("arguments"),
                cache_hit=meta.get("cache_hit", False),
            ))

        elif evt_type == "knowledge_retrieval":
            tool_call = next((n for n in reversed(run.nodes) if n.kind == "tool_call"), None)
            if tool_call:
                tool_call.citations = meta.get("citations", [])
                tool_call.result_count = meta.get("result_count")

        elif evt_type == "tool_result":
            result = meta.get("result", {})
            has_error = bool(result.get("error"))
            tool_call = next((n for n in reversed(run.nodes) if n.kind == "tool_call" and n.status == "running"), None)
            if tool_call:
                tool_call.status = "error" if has_error else "success"
                tool_call.end_ms = now
                tool_call.duration_ms = result.get("duration_ms")
                tool_call.cache_hit = result.get("cache_hit")
                tool_call.error = result.get("error")
                state.pending_tool_call_id = tool_call.id
            nid = state.next_id("tool_result")
            add_tool_result(AgentNode(
                id=nid, kind="tool_result",
                label=f"{result.get('name', 'tool')} result",
                status="error" if has_error else "success",
                start_ms=now, end_ms=now,
                tool=result.get("name"),
                tool_output=result.get("output"),
                duration_ms=result.get("duration_ms"),
                cache_hit=result.get("cache_hit"),
                error=result.get("error"),
            ))

        elif evt_type == "reflecting":
            usage = meta.get("token_usage", {})
            nid = state.next_id("reflecting")
            add_node(AgentNode(
                id=nid, kind="reflecting", label="Token Reflection",
                status="success", start_ms=now,
                tokens={
                    "prompt": usage.get("prompt_tokens", 0),
                    "completion": usage.get("completion_tokens", 0),
                    "total": usage.get("total_tokens", 0),
                    "llm_calls": usage.get("llm_calls"),
                    "kb_chunks_retrieved": usage.get("kb_chunks_retrieved"),
                    "estimated_tokens_saved": usage.get("estimated_tokens_saved"),
                },
            ))

        elif evt_type == "human_escalation":
            iv = meta.get("intervention", {})
            nid = state.next_id("escalation")
            add_node(AgentNode(
                id=nid, kind="escalation", label="Human Approval Required",
                status="warning", start_ms=now,
                escalation_context=iv.get("context"),
                available_actions=iv.get("available_actions"),
                error=iv.get("error"),
            ))

        elif evt_type == "final_response_chunk":
            state.response_text += event.get("content", "")

        elif evt_type == "final_response":
            text = event.get("content") or state.response_text
            nid = state.next_id("response")
            add_node(AgentNode(
                id=nid, kind="response", label="Response",
                status="success", start_ms=now, end_ms=now,
                response_text=text[:500],
            ))
            run.status = "success"
            run.end_ms = now

        elif evt_type == "response_metadata":
            run.model = meta.get("model")
            run.confidence = meta.get("confidence")
            if meta.get("scope"):
                run.hki_domain = meta.get("scope")
            # Back-fill response node
            resp_node = next((n for n in reversed(run.nodes) if n.kind == "response"), None)
            if resp_node and meta.get("confidence") is not None:
                resp_node.confidence = meta["confidence"]

    return run
