"""
Domain models shared across agents, tools, and guardrails.

These are pure data classes with no framework dependencies.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════════════════════
# Chat / Message types
# ═══════════════════════════════════════════════════════════════════════════════


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ChatMessage(BaseModel):
    """A single message in a conversation."""

    role: MessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None


class ToolCallRequest(BaseModel):
    """An LLM's request to invoke a tool."""

    id: str
    name: str
    arguments: dict[str, Any]


class ToolCallResult(BaseModel):
    """The result of executing a tool."""

    tool_call_id: str
    name: str
    output: Any
    error: str | None = None
    duration_ms: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Thought Trace — real-time observability of agent reasoning
# ═══════════════════════════════════════════════════════════════════════════════


class TraceEventType(StrEnum):
    THINKING = "thinking"
    ROUTING = "routing"
    PLANNING = "planning"
    EXECUTING = "executing"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    REFLECTING = "reflecting"
    GUARDRAIL = "guardrail"
    HANDOFF = "handoff"
    MEMORY_RECALL = "memory_recall"
    MEMORY_STORE = "memory_store"
    PROMPT_STACK = "prompt_stack"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"
    KNOWLEDGE_GAP = "knowledge_gap"
    CORRECTIVE_REWRITE = "corrective_rewrite"
    CACHE_HIT = "cache_hit"
    FINAL_RESPONSE = "final_response"
    SUGGESTED_FOLLOW_UPS = "suggested_follow_ups"
    # ── Execution engine events ──────────────────────────────────────────────
    PLAN_GENERATED = "plan_generated"  # Full plan with steps emitted
    STEP_STARTED = "step_started"  # Step N beginning execution
    STEP_VERIFYING = "step_verifying"  # Verification in progress
    STEP_VERIFIED = "step_verified"  # Verification passed
    STEP_FAILED = "step_failed"  # Step failed after verification
    REPLANNING = "replanning"  # Generating a new plan from current state
    HUMAN_ESCALATION = "human_escalation"  # Paused — needs human decision
    ROLLBACK = "rollback"  # Undoing completed steps
    SCRATCHPAD_UPDATE = "scratchpad_update"  # Ref/fact added to scratchpad


class TraceEvent(BaseModel):
    """A single step in the agent's thought trace (streamed to the UI)."""

    type: TraceEventType
    step: int
    content: str
    agent: str = "supervisor"
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ═══════════════════════════════════════════════════════════════════════════════
# Execution Policy — model routing, budgets, tool permissions, memory controls
# ═══════════════════════════════════════════════════════════════════════════════


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ModelTier(StrEnum):
    AUTO = "auto"
    FAST = "fast"
    SMART = "smart"
    THINKING = "thinking"


class ApprovalMode(StrEnum):
    NEVER = "never"
    SENSITIVE_ONLY = "sensitive_only"
    ALWAYS = "always"


class BudgetPolicy(BaseModel):
    max_turns: int | None = None
    max_tool_calls: int | None = None
    max_tokens: int | None = None


class ToolPermissionPolicy(BaseModel):
    approval_mode: ApprovalMode = ApprovalMode.SENSITIVE_ONLY
    sensitive_tools: list[str] = Field(default_factory=lambda: ["get_member_info"])
    require_approval_tools: list[str] = Field(default_factory=list)
    deny_tools: list[str] = Field(default_factory=list)
    risk_overrides: dict[str, RiskLevel] = Field(default_factory=dict)


class MemoryPolicy(BaseModel):
    enabled: bool = True
    max_semantic_facts: int = 8
    max_episodes: int = 3
    max_procedures: int = 3
    include_rules: bool = True
    store_episodes: bool = True
    consolidate_after_episodes: int = 5


class ExecutionPolicy(BaseModel):
    model: str | None = None
    model_tier: ModelTier = ModelTier.AUTO
    enable_planning: bool = True
    retrieval_strategy: str = "hybrid"
    budgets: BudgetPolicy = Field(default_factory=BudgetPolicy)
    tool_permissions: ToolPermissionPolicy = Field(default_factory=ToolPermissionPolicy)
    memory: MemoryPolicy = Field(default_factory=MemoryPolicy)
    guardrail_config: dict[str, bool] = Field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge / RAG — Citations returned alongside agent responses
# ═══════════════════════════════════════════════════════════════════════════════


class Citation(BaseModel):
    """
    A traceable reference back to source material in the knowledge base.

    Citations power the "Evidence Chips" UI component in the frontend,
    giving users confidence that the agent's response is grounded in
    real organizational knowledge. Each citation links back to a
    specific chunk in a specific document.
    """

    document_id: str
    document_title: str
    chunk_id: str
    content_preview: str  # First ~200 chars of the source chunk
    relevance_score: float  # 0.0–1.0
    source_url: str = ""
    page_or_section: str = ""
    highlight: str = ""  # Specific sentence that matched


# ═══════════════════════════════════════════════════════════════════════════════
# Agent Orchestration Request / Response
# ═══════════════════════════════════════════════════════════════════════════════


class StreamConfig(BaseModel):
    """Value-stream agent configuration forwarded by the BFF.

    When a user chats within a specific value stream (e.g. "pharmacy"),
    the BFF reads the stream's agent definition from the database and
    forwards it here. The orchestrator uses these to override the
    default hardcoded agent persona, tool set, and guardrails.

    All fields are optional — unset fields fall back to platform defaults.
    """

    system_prompt: str | None = None
    enabled_tools: list[str] | None = None
    retrieval_strategy: str | None = None  # semantic | hybrid | graph
    guardrail_config: dict[str, bool] | None = None
    memory_config: dict[str, Any] | None = None
    llm_api_key: str | None = None
    execution_policy: ExecutionPolicy | None = None


class OrchestrateRequest(BaseModel):
    """Inbound request from the BFF to process a user message."""

    conversation_id: str
    message: str
    user_id: str
    history: list[ChatMessage] = Field(default_factory=list)
    config: OrchestrateConfig = Field(default_factory=lambda: OrchestrateConfig())
    scope: str = "global"  # Primary value-stream scope (e.g. "pharmacy", "warehouse")
    scopes: list[str] = Field(default_factory=lambda: ["global"])  # All user scopes
    stream_config: StreamConfig | None = None  # Per-stream agent overrides from DB


class OrchestrateConfig(BaseModel):
    """Per-request overrides for agent behavior."""

    agent_type: str = "supervisor"  # supervisor | retail | tool-use | generation
    temperature: float = 0.3
    max_tokens: int = 4096
    enabled_tools: list[str] | None = None  # None = all tools


class OrchestrateResponse(BaseModel):
    """Final response returned to the BFF after orchestration completes."""

    message_id: str
    content: str
    confidence: float = 0.0
    agent_used: str = "supervisor"
    tool_calls: list[ToolCallResult] = Field(default_factory=list)
    trace: list[TraceEvent] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    guardrails: GuardrailsReport = Field(default_factory=lambda: GuardrailsReport())


# ═══════════════════════════════════════════════════════════════════════════════
# Guardrails
# ═══════════════════════════════════════════════════════════════════════════════


class GuardrailViolation(BaseModel):
    rule: str
    message: str
    severity: str = "warning"  # warning | error


class GuardrailsReport(BaseModel):
    passed: bool = True
    input_violations: list[GuardrailViolation] = Field(default_factory=list)
    output_violations: list[GuardrailViolation] = Field(default_factory=list)
    score: float = 100.0


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Definition (OpenAI function-calling format)
# ═══════════════════════════════════════════════════════════════════════════════


class ToolParameter(BaseModel):
    type: str = "string"
    description: str = ""


class ToolFunctionDef(BaseModel):
    name: str
    description: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)


class ToolDef(BaseModel):
    """A tool definition in OpenAI function-calling format."""

    type: str = "function"
    function: ToolFunctionDef
