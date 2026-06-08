from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import BaseModel, Field


NodeKind = Literal[
    "start", "routing", "memory_recall", "planning", "plan", "thinking",
    "tool_call", "tool_result", "knowledge_retrieval", "guardrail",
    "reflecting", "escalation", "response",
]
NodeStatus = Literal["pending", "running", "success", "error", "warning"]
EdgeKind = Literal["execution", "data", "dependency"]
RunStatus = Literal["running", "success", "error"]


class PlanStep(BaseModel):
    step_id: str
    description: str
    tool_name: str
    status: Literal["planned", "executing", "completed", "failed"] = "planned"
    duration_ms: float | None = None
    error: str | None = None


class AgentNode(BaseModel):
    id: str
    kind: NodeKind
    label: str
    status: NodeStatus = "success"
    start_ms: float = Field(default_factory=lambda: time.time() * 1000)
    end_ms: float | None = None
    duration_ms: float | None = None
    model: str | None = None
    model_tier: str | None = None
    routing_reason: str | None = None
    enabled_tools: list[str] | None = None
    tool: str | None = None
    tool_args: dict[str, Any] | None = None
    tool_output: Any = None
    cache_hit: bool | None = None
    citations: list[dict[str, Any]] | None = None
    result_count: int | None = None
    passed: bool | None = None
    score: float | None = None
    violations: list[dict[str, Any]] | None = None
    guardrail_section: Literal["input", "output"] | None = None
    plan_id: str | None = None
    goal: str | None = None
    steps: list[PlanStep] | None = None
    tokens: dict[str, Any] | None = None
    escalation_context: str | None = None
    available_actions: list[str] | None = None
    response_text: str | None = None
    confidence: float | None = None
    total_memories: int | None = None
    section: str | None = None
    icon: str | None = None
    reasoning: str | None = None
    hki_domain: str | None = None
    failed_model: str | None = None
    fallback_model: str | None = None
    error: str | None = None
    metadata: dict[str, Any] | None = None


class AgentEdge(BaseModel):
    id: str
    source: str
    target: str
    kind: EdgeKind = "execution"
    animated: bool = False
    label: str | None = None


class AgentRun(BaseModel):
    id: str
    query: str
    start_ms: float = Field(default_factory=lambda: time.time() * 1000)
    end_ms: float | None = None
    status: RunStatus = "running"
    nodes: list[AgentNode] = Field(default_factory=list)
    edges: list[AgentEdge] = Field(default_factory=list)
    hki_domain: str | None = None
    model: str | None = None
    confidence: float | None = None
    metadata: dict[str, Any] | None = None


class RunSummary(BaseModel):
    total_ms: float
    tool_call_count: int
    llm_calls: int
    kb_hits: int
    tokens_used: int
    confidence: float | None
    hki_domain: str | None
    model: str | None
    status: RunStatus


class CreateRunRequest(BaseModel):
    id: str | None = None
    query: str
    hki_domain: str | None = None


class IngestEventsRequest(BaseModel):
    events: list[dict[str, Any]]


class RunListItem(BaseModel):
    id: str
    query: str
    status: RunStatus
    hki_domain: str | None
    model: str | None
    confidence: float | None
    started_at: float
    ended_at: float | None
    node_count: int
