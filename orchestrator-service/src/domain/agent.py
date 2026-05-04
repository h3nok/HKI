"""
ADK Agent Wrapper — policy-driven orchestration around google-adk's Runner.

The underlying ADK Runner still owns the model/tool loop. This wrapper adds
the platform control plane around it:
  1. Per-request immutable agent construction
  2. Model routing / execution policy selection
  3. Tool risk enforcement with HITL escalation events
  4. Lightweight planner/worker separation via execution-plan traces
  5. Governed memory recall and consolidation
"""

from __future__ import annotations

import asyncio
import inspect
import re
import dataclasses
import typing
import uuid

import google.adk.runners
import google.adk.sessions
import google.genai
from google.genai.types import Part
from google.genai.types import FunctionCall
from google.genai.types import FunctionResponse

import src.adapters.cache
import src.core.config
import src.core.logging
import src.domain.adk_agent
import src.domain.adk_callbacks
import src.domain.memory
import src.domain.models
import src.domain.tools

logger = src.core.logging.logger.getChild("agent")

_GREETING_TURNS: set[str] = {
    "good afternoon",
    "good evening",
    "good morning",
    "hello",
    "hello there",
    "hey",
    "hey there",
    "hi",
    "hi there",
}
_CAPABILITY_TURNS: set[str] = {
    "how can you help",
    "what can you do",
    "what can you help me with",
    "what do you do",
}
_THANKS_TURNS: set[str] = {
    "thank you",
    "thanks",
    "thanks a lot",
    "thx",
    "ty",
}
_FAREWELL_TURNS: set[str] = {
    "bye",
    "goodbye",
    "see you",
    "talk to you later",
}
_ACKNOWLEDGEMENT_TURNS: set[str] = {
    "cool",
    "got it",
    "ok",
    "okay",
    "sounds good",
    "sure",
    "understood",
}
_WELLBEING_TURNS: set[str] = {
    "how are you",
    "how is it going",
    "hows it going",
}
_KB_FALLBACK_STOPWORDS: set[str] = {
    "about",
    "after",
    "all",
    "and",
    "are",
    "can",
    "does",
    "from",
    "into",
    "its",
    "key",
    "main",
    "md",
    "points",
    "say",
    "says",
    "summary",
    "summarize",
    "tell",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
}
_SUMMARY_INTENT_MARKERS = (
    "key points",
    "main points",
    "overview",
    "summarize",
    "summary",
)


def _normalize_message_text(message: str) -> str:
    lowered: str = message.strip().lower().replace("’", "'")
    if not lowered:
        return ""
    collapsed: str = re.sub(r"[^a-z0-9'\s]", " ", lowered)
    return re.sub(r"\s+", " ", collapsed).strip()


def _strip_leading_greeting(normalized_message: str) -> str:
    for greeting in sorted(_GREETING_TURNS, key=len, reverse=True):
        prefix: str = f"{greeting} "
        if normalized_message.startswith(prefix):
            return normalized_message[len(prefix) :].strip()
    return normalized_message


def _build_conversational_fast_path_response(message: str) -> str | None:
    normalized: str = _normalize_message_text(message)
    if not normalized:
        return None

    if len(normalized.split()) > 12:
        return None

    if normalized in _THANKS_TURNS:
        return "You're welcome."

    if normalized in _FAREWELL_TURNS:
        return "Bye."

    if normalized in _ACKNOWLEDGEMENT_TURNS:
        return "Understood."

    if normalized in _WELLBEING_TURNS:
        return (
            "Ready to help. Ask about HKI knowledge, products, inventory, pricing, "
            "or an internal workflow, and I will use the right tools only when needed."
        )

    remainder: str = _strip_leading_greeting(normalized)
    capability_turn: bool = any(
        phrase == normalized or phrase == remainder for phrase in _CAPABILITY_TURNS
    )
    if capability_turn:
        return (
            "I can help with HKI internal knowledge, product lookup, inventory, "
            "pricing context, and guided workflow questions. Ask a specific question "
            "and I will pull in KB or live tools only when they are needed."
        )

    if normalized in _GREETING_TURNS:
        return (
            "Hi. I can help with HKI knowledge, product lookup, inventory, pricing, "
            "and workflow questions. Ask a specific question and I will use the right "
            "tools only when needed."
        )

    return None


@dataclasses.dataclass
class PlanStep:
    step_id: str
    description: str
    tool_name: str
    status: str = "planned"
    duration_ms: float | None = None
    error: str | None = None

    def to_metadata(self) -> dict[str, typing.Any]:
        return {
            "step_id": self.step_id,
            "tool_name": self.tool_name,
            "description": self.description,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "error": self.error,
        }


@dataclasses.dataclass
class ExecutionPlanState:
    plan_id: str
    goal: str
    steps: list[PlanStep]
    completed_steps: int = 0

    def to_metadata(self, *, status: str, replanned: bool = False) -> dict[str, typing.Any]:
        return {
            "plan_id": self.plan_id,
            "goal": self.goal,
            "status": status,
            "total_steps": len(self.steps),
            "completed_steps": self.completed_steps,
            "steps": [step.to_metadata() for step in self.steps],
            "replanned": replanned,
        }


@dataclasses.dataclass
class ToolRunContext:
    user_id: str
    org_id: str
    conversation_id: str
    scope: str
    scopes: list[str]
    policy: src.domain.models.ExecutionPolicy
    enabled_tools: list[str]
    executed_tool_calls: int = 0


def _is_complex_request(message: str) -> bool:
    lowered: str = message.lower()
    if len(message.split()) >= 20:
        return True
    complexity_markers = (
        "plan",
        "strategy",
        "analyze",
        "investigate",
        "compare",
        "root cause",
        "tradeoff",
        "governance",
        "workflow",
    )
    return any(marker in lowered for marker in complexity_markers)


def _normalize_guardrail_report(violations: list[src.domain.models.GuardrailViolation]) -> dict[str, typing.Any]:
    if not violations:
        return {"valid": True, "error": ""}
    first_error = next(
        (v.message for v in violations if v.severity == "error"),
        violations[0].message,
    )
    return {"valid": False, "error": first_error}


def _iter_response_chunks(text: str) -> list[str]:
    if not text:
        return []

    tokens: list[Any] = re.findall(r"\S+\s*", text)
    return tokens or [text]


def _has_summary_intent(message: str) -> bool:
    normalized: str = _normalize_message_text(message)
    return any(marker in normalized for marker in _SUMMARY_INTENT_MARKERS)


def _extract_kb_query_terms(message: str) -> set[str]:
    return {
        token
        for token in _normalize_message_text(message).split()
        if len(token) > 2 and token not in _KB_FALLBACK_STOPWORDS
    }


def _split_kb_fragments(text: str) -> list[str]:
    if not isinstance(text, str) or not text.strip():
        return []

    normalized: str = text.replace("\r", "\n")
    raw_fragments: list[str] = normalized.splitlines()
    if len(raw_fragments) <= 1:
        raw_fragments: list[str | Any] = re.split(r"(?<=[.!?])\s+", normalized)

    fragments: list[str] = []
    for raw_fragment in raw_fragments:
        fragment: str | typing.Any = raw_fragment.strip()
        fragment: str = re.sub(r"^#{1,6}\s*", "", fragment)
        fragment: str = re.sub(r"^\d+\.\s+", "", fragment)
        fragment: str = fragment.lstrip("-*• ").strip()
        fragment: str = re.sub(r"\s+", " ", fragment).strip()
        if len(fragment) < 12:
            continue
        fragments.append(fragment)
    return fragments


def _kb_fragment_dedup_key(fragment: str) -> str:
    return _normalize_message_text(fragment)


def _resolve_kb_title(search_output: dict[str, typing.Any]) -> str:
    for citation in search_output.get("citations", []) or []:
        title: str = str(citation.get("title", "")).strip()
        if title:
            return title
    for result in search_output.get("results", []) or []:
        title: str = str(result.get("title", "")).strip()
        if title:
            return title
    return ""


def _score_kb_fragment(
    fragment: str,
    query_terms: set[str],
    *,
    summary_intent: bool,
) -> int:
    normalized: str = _normalize_message_text(fragment)
    fragment_terms: set[str] = set(normalized.split())
    overlap_terms: set[str] = fragment_terms & query_terms
    fuzzy_overlap_terms: set[str] = {
        term for term in query_terms - overlap_terms if len(term) >= 5 and term in normalized
    }
    overlap: int = len(overlap_terms | fuzzy_overlap_terms)
    score: int = overlap * (2 if summary_intent else 4)

    if summary_intent:
        if 24 <= len(fragment) <= 220:
            score += 1
        if re.search(
            r"\b(applies|required|must|training|inspection|rescue|documentation|enforcement)\b",
            normalized,
        ):
            score += 1
    else:
        if re.search(r"\b(must|required|maximum|minimum|within|before)\b", normalized):
            score += 1
        if {"time", "response", "when"} & query_terms and re.search(
            r"\b\d+\s*(minute|minutes|hour|hours|day|days)\b", normalized
        ):
            score += 4

    return score


def _build_grounded_kb_fallback_response(
    message: str,
    search_output: dict[str, typing.Any] | None,
) -> str | None:
    if not isinstance(search_output, dict):
        return None

    candidate_fragments: list[str] = []
    context: typing.Any | None = search_output.get("context")
    if isinstance(context, str):
        candidate_fragments.extend(_split_kb_fragments(context))

    for result in (search_output.get("results") or [])[:5]:
        content = result.get("content") if isinstance(result, dict) else ""
        if isinstance(content, str):
            candidate_fragments.extend(_split_kb_fragments(content))

    for citation in (search_output.get("citations") or [])[:5]:
        if not isinstance(citation, dict):
            continue
        for field in ("highlight", "preview"):
            value = citation.get(field)
            if isinstance(value, str):
                candidate_fragments.extend(_split_kb_fragments(value))

    unique_fragments: list[str] = []
    seen: set[str] = set()
    for fragment in candidate_fragments:
        key: str = _kb_fragment_dedup_key(fragment)
        if key in seen:
            continue
        seen.add(key)
        unique_fragments.append(fragment)

    if not unique_fragments:
        return None

    summary_intent: bool = _has_summary_intent(message)
    query_terms: set[str] = _extract_kb_query_terms(message)
    ranked_fragments: list[tuple[int, int, str]] = sorted(
        [
            (
                _score_kb_fragment(fragment, query_terms, summary_intent=summary_intent),
                index,
                fragment,
            )
            for index, fragment in enumerate(unique_fragments)
        ],
        key=lambda item: (-item[0], item[1]),
    )

    top_limit: int = 4 if summary_intent else 2
    top_fragments: list[str] = [fragment for _, _, fragment in ranked_fragments[:top_limit]]
    source_title: str = _resolve_kb_title(search_output) or "the knowledge base"

    if summary_intent:
        bullet_lines: str = "\n".join(f"- {fragment}" for fragment in top_fragments)
        return (
            f"Based on the retrieved passages from {source_title}, the key points are:\n"
            f"{bullet_lines}"
        )

    if len(top_fragments) == 1:
        return f"Based on the retrieved passages from {source_title}: {top_fragments[0]}"

    bullet_lines: str = "\n".join(f"- {fragment}" for fragment in top_fragments)
    return (
        f"Based on the retrieved passages from {source_title}, the most relevant details are:\n"
        f"{bullet_lines}"
    )


class AdkAgent:
    """
    ADK-based agent with a policy-driven control plane.

    The wrapper keeps ADK's native reasoning loop, but all mutable request
    state now lives inside a single request context instead of mutating the
    shared ``self._agent`` instance.
    """

    def __init__(
        self,
        memory_manager: src.domain.memory.MemoryManager | None = None,
        cache: src.adapters.cache.TieredCache | None = None,
    ) -> None:
        self.memory = memory_manager
        self.cache = cache
        self._session_service = google.adk.sessions.InMemorySessionService()
        self._tool_catalog = src.domain.tools.get_tool_catalog()

    @property
    def tools(self):
        """Expose base tool callables for the /tools listing endpoint."""
        return [spec.func for spec in self._tool_catalog.values()]

    def _merge_budget_policy(
        self,
        base: src.domain.models.BudgetPolicy,
        override: src.domain.models.BudgetPolicy | dict[str, typing.Any] | None,
    ) -> src.domain.models.BudgetPolicy:
        if override is None:
            return base
        override_dict = (
            override.model_dump(
                exclude_none=True,
                include=set(override.model_fields_set),
            )
            if isinstance(override, src.domain.models.BudgetPolicy)
            else dict(override)
        )
        return src.domain.models.BudgetPolicy(**{**base.model_dump(), **override_dict})

    def _merge_tool_permissions(
        self,
        base: src.domain.models.ToolPermissionPolicy,
        override: src.domain.models.ToolPermissionPolicy | dict[str, typing.Any] | None,
    ) -> src.domain.models.ToolPermissionPolicy:
        if override is None:
            return base
        override_dict = (
            override.model_dump(
                exclude_none=True,
                include=set(override.model_fields_set),
            )
            if isinstance(override, src.domain.models.ToolPermissionPolicy)
            else dict(override)
        )
        return src.domain.models.ToolPermissionPolicy(**{**base.model_dump(), **override_dict})

    def _merge_memory_policy(
        self,
        base: src.domain.models.MemoryPolicy,
        override: src.domain.models.MemoryPolicy | dict[str, typing.Any] | None,
    ) -> src.domain.models.MemoryPolicy:
        if override is None:
            return base
        override_dict = (
            override.model_dump(
                exclude_none=True,
                include=set(override.model_fields_set),
            )
            if isinstance(override, src.domain.models.MemoryPolicy)
            else dict(override)
        )
        return src.domain.models.MemoryPolicy(**{**base.model_dump(), **override_dict})

    def _build_execution_policy(self, stream_config: src.domain.models.StreamConfig | None) -> src.domain.models.ExecutionPolicy:
        default_policy = src.domain.models.ExecutionPolicy(
            retrieval_strategy="hybrid",
            budgets=src.domain.models.BudgetPolicy(
                max_turns=src.core.config.settings.AGENT_MAX_TURNS,
                max_tool_calls=8,
                max_tokens=src.core.config.settings.AGENT_TOKEN_BUDGET,
            ),
            memory=src.domain.models.MemoryPolicy(),
        )
        if stream_config is None:
            return default_policy

        policy = src.domain.models.ExecutionPolicy(**default_policy.model_dump())

        if stream_config.retrieval_strategy:
            policy.retrieval_strategy = stream_config.retrieval_strategy
        if stream_config.guardrail_config:
            policy.guardrail_config.update(stream_config.guardrail_config)
        if stream_config.memory_config:
            policy.memory = self._merge_memory_policy(policy.memory, stream_config.memory_config)

        if stream_config.execution_policy is None:
            return policy

        override = stream_config.execution_policy
        override_fields = set(override.model_fields_set)
        if "model" in override_fields and override.model is not None:
            policy.model = override.model
        if "model_tier" in override_fields:
            policy.model_tier = override.model_tier
        if "enable_planning" in override_fields:
            policy.enable_planning = override.enable_planning
        if "retrieval_strategy" in override_fields and override.retrieval_strategy:
            policy.retrieval_strategy = override.retrieval_strategy
        if "guardrail_config" in override_fields:
            policy.guardrail_config.update(override.guardrail_config)
        if "budgets" in override_fields:
            policy.budgets = self._merge_budget_policy(policy.budgets, override.budgets)
        if "tool_permissions" in override_fields:
            policy.tool_permissions = self._merge_tool_permissions(
                policy.tool_permissions,
                override.tool_permissions,
            )
        if "memory" in override_fields:
            policy.memory = self._merge_memory_policy(policy.memory, override.memory)
        return policy

    def _resolve_enabled_tools(
        self,
        stream_config: src.domain.models.StreamConfig | None,
        policy: src.domain.models.ExecutionPolicy,
    ) -> list[str]:
        enabled = (
            list(stream_config.enabled_tools)
            if stream_config and stream_config.enabled_tools
            else list(self._tool_catalog.keys())
        )
        denied = set(policy.tool_permissions.deny_tools)
        return [
            tool_name
            for tool_name in enabled
            if tool_name in self._tool_catalog and tool_name not in denied
        ]

    def _select_model(
        self,
        message: str,
        policy: src.domain.models.ExecutionPolicy,
    ) -> tuple[str, src.domain.models.ModelTier, str]:
        if policy.model:
            return policy.model, policy.model_tier, "stream policy selected explicit model"

        tier = policy.model_tier
        if tier == src.domain.models.ModelTier.AUTO:
            tier = src.domain.models.ModelTier.SMART if _is_complex_request(message) else src.domain.models.ModelTier.FAST

        model_map = {
            src.domain.models.ModelTier.FAST: src.core.config.settings.AGENT_MODEL_FAST,
            src.domain.models.ModelTier.SMART: src.core.config.settings.AGENT_MODEL_SMART,
            src.domain.models.ModelTier.THINKING: src.core.config.settings.AGENT_MODEL_THINKING,
        }
        model_name = model_map.get(tier, src.core.config.settings.AGENT_MODEL)
        reason: str = (
            "complex request escalated to higher-tier model"
            if tier in {src.domain.models.ModelTier.SMART, src.domain.models.ModelTier.THINKING}
            else "default fast-path routing"
        )
        return model_name, tier, reason

    def _build_model_retry_candidates(
        self,
        primary_model: str,
        model_tier: src.domain.models.ModelTier,
    ) -> list[str]:
        candidate_map = {
            src.domain.models.ModelTier.FAST: [
                primary_model,
                src.core.config.settings.AGENT_MODEL,
                src.core.config.settings.AGENT_MODEL_THINKING,
                src.core.config.settings.AGENT_MODEL_SMART,
            ],
            src.domain.models.ModelTier.SMART: [
                primary_model,
                src.core.config.settings.AGENT_MODEL,
                src.core.config.settings.AGENT_MODEL_THINKING,
                src.core.config.settings.AGENT_MODEL_FAST,
            ],
            src.domain.models.ModelTier.THINKING: [
                primary_model,
                src.core.config.settings.AGENT_MODEL,
                src.core.config.settings.AGENT_MODEL_SMART,
                src.core.config.settings.AGENT_MODEL_FAST,
            ],
        }
        ordered = candidate_map.get(model_tier, [primary_model, src.core.config.settings.AGENT_MODEL])
        unique_candidates: list[str] = []
        for candidate in ordered:
            if candidate and candidate not in unique_candidates:
                unique_candidates.append(candidate)
        return unique_candidates

    def _is_model_access_error(self, error: Exception) -> bool:
        message: str = str(error).lower()
        if not message:
            return False
        return (
            ("publisher model" in message and ("not found" in message or "access" in message))
            or ("model" in message and "does not have access" in message)
            or ("404" in message and "model" in message)
            or ("not_found" in message and "model" in message)
        )

    def _compose_system_prompt(
        self,
        base_prompt: str | None,
        context: src.domain.memory.MemoryContext | None,
        *,
        policy: src.domain.models.ExecutionPolicy,
        enabled_tools: list[str],
        scope: str,
        scopes: list[str],
    ) -> tuple[str, dict[str, typing.Any]]:
        working_memory = None
        working_memory_count = 0
        if context and context.total_memories > 0:
            working_memory = context.to_prompt_section().strip()
            working_memory_count = context.total_memories

        prompt_stack = src.domain.adk_agent.build_prompt_stack(
            domain_prompt=base_prompt,
            enabled_tools=enabled_tools,
            scope=scope,
            scopes=scopes,
            retrieval_strategy=policy.retrieval_strategy,
            planning_enabled=policy.enable_planning,
            tool_permissions=policy.tool_permissions,
            working_memory=working_memory,
            working_memory_count=working_memory_count,
        )
        return prompt_stack["assembled_instruction"], prompt_stack

    def _execution_policy_summary(self, policy: src.domain.models.ExecutionPolicy) -> dict[str, typing.Any]:
        return {
            "model": policy.model,
            "model_tier": policy.model_tier.value,
            "enable_planning": policy.enable_planning,
            "retrieval_strategy": policy.retrieval_strategy,
            "budgets": policy.budgets.model_dump(exclude_none=True),
            "tool_permissions": {
                "approval_mode": policy.tool_permissions.approval_mode.value,
                "sensitive_tools": list(policy.tool_permissions.sensitive_tools),
                "require_approval_tools": list(policy.tool_permissions.require_approval_tools),
                "deny_tools": list(policy.tool_permissions.deny_tools),
                "risk_overrides": {
                    tool_name: risk.value
                    for tool_name, risk in policy.tool_permissions.risk_overrides.items()
                },
            },
            "memory": policy.memory.model_dump(),
            "guardrail_config": dict(policy.guardrail_config),
        }

    def _build_execution_plan(
        self,
        message: str,
        enabled_tools: list[str],
    ) -> ExecutionPlanState:
        lowered: str = message.lower()
        steps: list[PlanStep] = []
        conversational_response: str | None = _build_conversational_fast_path_response(message)

        def maybe_add(tool_name: str, description: str) -> None:
            if tool_name in enabled_tools:
                steps.append(
                    PlanStep(
                        step_id=f"step-{len(steps) + 1}",
                        description=description,
                        tool_name=tool_name,
                    )
                )

        if any(
            token in lowered for token in ("policy", "sop", "procedure", "knowledge", "document")
        ):
            maybe_add("search_knowledge", "Retrieve supporting internal knowledge")
        if any(token in lowered for token in ("inventory", "stock", "availability")):
            maybe_add("check_inventory", "Check current inventory state")
        if any(token in lowered for token in ("price", "pricing", "discount", "cost")):
            maybe_add("get_product_pricing", "Retrieve current pricing context")
        if any(token in lowered for token in ("member", "membership", "renewal", "rewards")):
            maybe_add("get_member_info", "Access member profile data")
        if any(token in lowered for token in ("find", "search", "product", "item", "sku")):
            maybe_add("search_products", "Search catalog for relevant products")

        if not steps and "search_knowledge" in enabled_tools and conversational_response is None:
            steps.append(
                PlanStep(
                    step_id="step-1",
                    description="Ground the answer with available knowledge",
                    tool_name="search_knowledge",
                )
            )

        steps.append(
            PlanStep(
                step_id=f"step-{len(steps) + 1}",
                description="Compose the final grounded response",
                tool_name="compose_response",
            )
        )

        return ExecutionPlanState(
            plan_id=f"plan-{uuid.uuid4().hex[:10]}",
            goal=message[:120],
            steps=steps,
        )

    def _find_plan_step(
        self,
        plan: ExecutionPlanState,
        tool_name: str,
    ) -> PlanStep | None:
        for step in plan.steps:
            if step.tool_name == tool_name and step.status == "planned":
                return step
        for step in plan.steps:
            if step.tool_name == tool_name and step.status in {"executing", "verifying"}:
                return step
        return None

    def _requires_approval(self, spec: src.domain.tools.ToolSpec, policy: src.domain.models.ExecutionPolicy) -> bool:
        permissions = policy.tool_permissions
        if spec.name in permissions.require_approval_tools:
            return True
        if permissions.approval_mode == src.domain.models.ApprovalMode.ALWAYS:
            return True
        if permissions.approval_mode == src.domain.models.ApprovalMode.NEVER:
            return False

        effective_risk = permissions.risk_overrides.get(spec.name, spec.risk_level)
        if effective_risk == src.domain.models.RiskLevel.HIGH:
            return True
        return spec.name in permissions.sensitive_tools

    def _approval_actions(self, spec: src.domain.tools.ToolSpec) -> list[str]:
        if spec.risk_level == src.domain.models.RiskLevel.HIGH:
            return ["retry_modified", "abort"]
        return ["retry", "skip", "abort"]

    def _build_tool_wrappers(self, context: ToolRunContext) -> dict[str, typing.Any]:
        wrappers: dict[str, typing.Any] = {}
        tool_specs = src.domain.tools.get_tool_catalog(context.enabled_tools)

        for tool_name, spec in tool_specs.items():
            tool_func = spec.func
            tool_signature: inspect.Signature = inspect.signature(tool_func)

            async def wrapped(
                _spec: src.domain.tools.ToolSpec = spec,
                _tool_name: str = tool_name,
                _tool_func: typing.Any = tool_func,
                **kwargs: typing.Any,
            ) -> dict[str, typing.Any]:
                context.executed_tool_calls += 1
                max_tool_calls = context.policy.budgets.max_tool_calls
                tool_meta = {
                    "tool": _tool_name,
                    "risk_level": _spec.risk_level.value,
                }

                if max_tool_calls is not None and context.executed_tool_calls > max_tool_calls:
                    return {
                        "error": f"Tool budget exceeded after {max_tool_calls} calls.",
                        "_tool_meta": {
                            **tool_meta,
                            "budget_exceeded": True,
                            "duration_ms": 0.0,
                            "cache_hit": False,
                        },
                    }

                if _tool_name == "search_knowledge":
                    kwargs.setdefault("org_id", context.org_id)
                    kwargs.setdefault("mode", context.policy.retrieval_strategy)
                if _tool_name in ("search_entities", "get_entity_context"):
                    kwargs.setdefault("org_id", context.org_id)

                if self._requires_approval(_spec, context.policy):
                    return {
                        "error": f"Human approval required before using {_tool_name}.",
                        "approval_required": True,
                        "_tool_meta": {
                            **tool_meta,
                            "approval_required": True,
                            "available_actions": self._approval_actions(_spec),
                            "duration_ms": 0.0,
                            "cache_hit": False,
                        },
                    }

                result, duration_ms, cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
                    _tool_name,
                    _tool_func,
                    kwargs,
                    cache=self.cache,
                    retrieval_strategy=context.policy.retrieval_strategy,
                )
                payload = dict(result) if isinstance(result, dict) else {"value": result}
                payload["_tool_meta"] = {
                    **tool_meta,
                    "duration_ms": duration_ms,
                    "cache_hit": cache_hit,
                }
                return payload

            wrapped.__name__ = tool_name
            wrapped.__doc__ = spec.description
            wrapped.__signature__ = tool_signature
            wrappers[tool_name] = wrapped

        return wrappers

    async def _get_or_create_session(
        self,
        *,
        session_id: str,
        user_id: str,
    ) -> google.adk.runners.Session:
        session: google.adk.runners.Session | None = await self._session_service.get_session(
            app_name="orchestrator",
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
            session: google.adk.runners.Session = await self._session_service.create_session(
                app_name="orchestrator",
                user_id=user_id,
                session_id=session_id,
            )
        return session

    def _estimate_confidence(
        self,
        *,
        kb_citations_used: int,
        kb_used: bool,
        had_errors: bool,
        final_text: str,
    ) -> float:
        confidence = 0.52
        if kb_used:
            confidence += 0.16
            confidence += min(0.12, kb_citations_used * 0.03)
        if final_text:
            confidence += 0.08
        if not had_errors:
            confidence += 0.07
        return round(min(confidence, 0.95), 2)

    async def chat_stream(
        self,
        session_id: str,
        message: str,
        scope: str = "global",
        stream_config: src.domain.models.StreamConfig | None = None,
        *,
        user_id: str | None = None,
        org_id: str = "default",
        scopes: list[str] | None = None,
    ):
        """
        Execute a chat turn using ADK Runner, yielding SSE-compatible dicts.
        """
        effective_user_id: str = user_id or session_id
        effective_scopes: list[str] = scopes or [scope]
        policy = self._build_execution_policy(stream_config)
        enabled_tools: list[str] = self._resolve_enabled_tools(stream_config, policy)
        conversational_response: str | None = _build_conversational_fast_path_response(message)

        if conversational_response is not None:
            logger.info(
                "Handled conversational turn via direct fast path",
                extra={
                    "conversation_id": session_id,
                    "user_id": effective_user_id,
                    "scope": scope,
                    "enabled_tools": enabled_tools,
                },
            )
            response_metadata = {
                "agent": "policy_worker",
                "model": "direct_response",
                "model_tier": "fast",
                "routing_reason": (
                    "handled conversational turn without model, memory, or tool execution"
                ),
                "enabled_tools": enabled_tools,
                "scope": scope,
                "scopes": effective_scopes,
                "prompt_stack": {
                    "layer_count": 0,
                    "domain_prompt_source": "skipped_for_conversational_fast_path",
                    "enabled_tool_count": len(enabled_tools),
                    "working_memory_included": False,
                    "working_memory_count": 0,
                    "assembled_instruction_chars": 0,
                },
                "execution_policy": self._execution_policy_summary(policy),
                "confidence": 0.94,
                "direct_response": True,
            }
            yield {
                "type": "routing",
                "step": 1,
                "content": "Resolved execution policy",
                "metadata": {
                    "routed_to": "conversation fast path",
                    "model": "direct_response",
                    "model_tier": "fast",
                    "reason": response_metadata["routing_reason"],
                    "enabled_tools": enabled_tools,
                },
            }
            yield {
                "type": "thinking",
                "step": 2,
                "content": "Handled conversational turn directly",
                "metadata": {
                    "section": "FAST_PATH",
                    "icon": "⚡",
                    "reasoning": (
                        "Greeting or simple conversational turn does not require KB retrieval, "
                        "memory recall, or tool execution."
                    ),
                },
            }
            yield {
                "type": "final_response_chunk",
                "content": conversational_response,
            }
            yield {
                "type": "response_metadata",
                "metadata": response_metadata,
            }
            return

        model_name, model_tier, routing_reason = self._select_model(message, policy)

        logger.info(
            "Received message",
            extra={
                "conversation_id": session_id,
                "user_id": effective_user_id,
                "scope": scope,
                "model": model_name,
                "model_tier": model_tier.value,
                "enabled_tools": enabled_tools,
            },
        )

        context = (
            await self.memory.recall_all(
                user_id=effective_user_id,
                conversation_id=session_id,
                query=message,
                policy=policy.memory,
            )
            if self.memory
            else None
        )
        if context and context.total_memories > 0:
            yield {
                "type": "memory_recall",
                "step": 1,
                "content": "Recovered relevant long-term context",
                "metadata": {
                    "total_memories": context.total_memories,
                    "scope": scope,
                },
            }

        yield {
            "type": "routing",
            "step": 2,
            "content": "Resolved execution policy",
            "metadata": {
                "routed_to": f"{model_tier.value} worker",
                "model": model_name,
                "model_tier": model_tier.value,
                "reason": routing_reason,
                "enabled_tools": enabled_tools,
            },
        }

        system_prompt, prompt_stack = self._compose_system_prompt(
            stream_config.system_prompt if stream_config and stream_config.system_prompt else None,
            context,
            policy=policy,
            enabled_tools=enabled_tools,
            scope=scope,
            scopes=effective_scopes,
        )
        step_counter = 3
        yield {
            "type": "prompt_stack",
            "step": step_counter,
            "content": "Composed layered prompt stack",
            "metadata": prompt_stack,
        }
        step_counter += 1
        response_metadata_base = {
            "agent": "policy_worker",
            "model": model_name,
            "model_tier": model_tier.value,
            "routing_reason": routing_reason,
            "enabled_tools": enabled_tools,
            "scope": scope,
            "scopes": effective_scopes,
            "prompt_stack": prompt_stack["summary"],
            "execution_policy": self._execution_policy_summary(policy),
        }

        plan_state: ExecutionPlanState | None = None
        if policy.enable_planning:
            plan_state = self._build_execution_plan(message, enabled_tools)
            yield {
                "type": "planning",
                "step": step_counter,
                "content": "Generating execution plan",
                "metadata": {
                    "section": "PLANNING",
                    "icon": "🗺️",
                    "model": model_name,
                },
            }
            step_counter += 1
            yield {
                "type": "plan_generated",
                "step": step_counter,
                "content": "Execution plan ready",
                "metadata": plan_state.to_metadata(status="executing"),
            }
            step_counter += 1

        tool_context = ToolRunContext(
            user_id=effective_user_id,
            org_id=org_id,
            conversation_id=session_id,
            scope=scope,
            scopes=effective_scopes,
            policy=policy,
            enabled_tools=enabled_tools,
        )
        tool_wrappers: dict[str, Any] = self._build_tool_wrappers(tool_context)
        model_candidates: list[str] = self._build_model_retry_candidates(model_name, model_tier)
        response_metadata_base["model"] = model_candidates[0]

        yield {
            "type": "thinking",
            "step": step_counter,
            "content": "Analyzing request",
            "metadata": {
                "section": "UNDERSTANDING",
                "icon": "🧠",
                "reasoning": "Determining the best approach utilizing approved connectors.",
            },
        }
        step_counter += 1

        final_text: str = ""
        kb_chunks_retrieved = 0
        kb_citations_used = 0
        kb_search_ms_total = 0.0
        kb_search_calls = 0
        had_tool_errors = False
        latest_kb_output: dict[str, typing.Any] | None = None
        pending_tool_calls: list[dict[str, typing.Any]] = []
        fallback_reason: str | None = None
        response_metadata_sent = False

        try:
            session: google.adk.runners.Session = await self._get_or_create_session(
                session_id=session_id,
                user_id=effective_user_id,
            )
            user_content = google.genai.types.Content(
                role="user",
                parts=[google.genai.types.Part.from_text(text=message)],
            )
            model_attempt = 0
            while True:
                active_model_name: str = model_candidates[model_attempt]
                response_metadata_base["model"] = active_model_name
                agent = src.domain.adk_agent.build_adk_agent(
                    system_prompt=system_prompt,
                    enabled_tools=enabled_tools,
                    model_name=active_model_name,
                    tool_functions=list(tool_wrappers.values()),
                )
                runner = google.adk.runners.Runner(
                    agent=agent,
                    app_name="orchestrator",
                    session_service=self._session_service,
                )

                try:
                    async for event in runner.run_async(
                        user_id=effective_user_id,
                        session_id=session.id,
                        new_message=user_content,
                    ):
                        if not event.content or not event.content.parts:
                            continue

                        for part in event.content.parts:
                            if hasattr(part, "function_call") and part.function_call:
                                fc: FunctionCall = part.function_call
                                tool_name: str | None = fc.name
                                tool_args: dict[str, Any] = dict(fc.args) if fc.args else {}
                                tool_call_id: str = f"adk-{tool_name}-{uuid.uuid4().hex[:8]}"
                                pending_tool_calls.append(
                                    {
                                        "tool_call_id": tool_call_id,
                                        "tool": tool_name,
                                        "arguments": tool_args,
                                    }
                                )

                                plan_step: None | PlanStep = plan_state and self._find_plan_step(
                                    plan_state,
                                    tool_name,
                                )
                                if plan_step:
                                    plan_step.status = "executing"
                                    yield {
                                        "type": "step_started",
                                        "step": step_counter,
                                        "content": plan_step.description,
                                        "metadata": {
                                            "plan_id": plan_state.plan_id,
                                            "step_id": plan_step.step_id,
                                            "step_index": plan_state.steps.index(plan_step),
                                            "status": "executing",
                                            "plan_progress": (
                                                f"{plan_state.completed_steps + 1}/{len(plan_state.steps)}"
                                            ),
                                        },
                                    }
                                    step_counter += 1

                                yield {
                                    "type": "tool_call",
                                    "step": step_counter,
                                    "content": f"Calling {tool_name}",
                                    "metadata": {
                                        "tool": tool_name,
                                        "arguments": tool_args,
                                        "tool_call_id": tool_call_id,
                                        "cache_hit": False,
                                    },
                                }
                                step_counter += 1

                            elif hasattr(part, "function_response") and part.function_response:
                                fr: FunctionResponse = part.function_response
                                tool_name: str | None = fr.name
                                raw_output: dict[str, Any] = dict(fr.response) if fr.response else {}
                                tool_meta = {}
                                if isinstance(raw_output, dict):
                                    tool_meta = raw_output.pop("_tool_meta", {}) or {}

                                pending_index: int | None = next(
                                    (
                                        idx
                                        for idx, item in enumerate(pending_tool_calls)
                                        if item["tool"] == tool_name
                                    ),
                                    None,
                                )
                                matched_call = (
                                    pending_tool_calls.pop(pending_index)
                                    if isinstance(pending_index, int)
                                    else {
                                        "tool_call_id": f"adk-{tool_name}-{uuid.uuid4().hex[:8]}",
                                        "arguments": {},
                                    }
                                )
                                tool_call_id = matched_call["tool_call_id"]
                                duration_ms = float(tool_meta.get("duration_ms", 0.0))
                                cache_hit = bool(tool_meta.get("cache_hit", False))
                                plan_step: None | PlanStep = plan_state and self._find_plan_step(
                                    plan_state, tool_name
                                )

                                if tool_meta.get("approval_required"):
                                    had_tool_errors = True
                                    if plan_step:
                                        plan_step.status = "failed"
                                        plan_step.error = str(
                                            raw_output.get("error", "Approval required")
                                        )
                                        yield {
                                            "type": "step_failed",
                                            "step": step_counter,
                                            "content": plan_step.description,
                                            "metadata": {
                                                "plan_id": plan_state.plan_id,
                                                "step_id": plan_step.step_id,
                                                "step_index": plan_state.steps.index(plan_step),
                                                "status": "failed",
                                                "error": raw_output.get(
                                                    "error",
                                                    "Approval required",
                                                ),
                                            },
                                        }
                                        step_counter += 1

                                    yield {
                                        "type": "tool_result",
                                        "step": step_counter,
                                        "content": f"{tool_name} blocked by approval policy",
                                        "metadata": {
                                            "result": {
                                                "tool_call_id": tool_call_id,
                                                "name": tool_name,
                                                "output": raw_output,
                                                "error": raw_output.get(
                                                    "error",
                                                    "Approval required",
                                                ),
                                                "duration_ms": duration_ms,
                                                "cache_hit": cache_hit,
                                                "validation": {
                                                    "valid": False,
                                                    "error": "approval_required",
                                                },
                                            }
                                        },
                                    }
                                    step_counter += 1

                                    yield {
                                        "type": "human_escalation",
                                        "step": step_counter,
                                        "content": f"{tool_name} requires human approval",
                                        "metadata": {
                                            "intervention": {
                                                "plan_id": (
                                                    plan_state.plan_id
                                                    if plan_state
                                                    else f"plan-{uuid.uuid4().hex[:8]}"
                                                ),
                                                "failed_step_id": (
                                                    plan_step.step_id if plan_step else tool_call_id
                                                ),
                                                "error": raw_output.get(
                                                    "error",
                                                    "Approval required",
                                                ),
                                                "context": (
                                                    f"{tool_name} is gated as a "
                                                    f"{tool_meta.get('risk_level', 'high')} risk tool."
                                                ),
                                                "completed_steps": [
                                                    step.description
                                                    for step in (
                                                        plan_state.steps if plan_state else []
                                                    )
                                                    if step.status == "completed"
                                                ],
                                                "scratchpad_summary": {
                                                    "tool": tool_name,
                                                    "arguments": matched_call.get(
                                                        "arguments",
                                                        {},
                                                    ),
                                                },
                                                "available_actions": tool_meta.get(
                                                    "available_actions",
                                                    ["retry_modified", "abort"],
                                                ),
                                            }
                                        },
                                    }
                                    step_counter += 1
                                    yield {
                                        "type": "final_response_chunk",
                                        "content": (
                                            f"Paused pending approval before running `{tool_name}`."
                                        ),
                                    }
                                    confidence: float = self._estimate_confidence(
                                        kb_citations_used=kb_citations_used,
                                        kb_used=kb_chunks_retrieved > 0,
                                        had_errors=True,
                                        final_text="Paused pending approval.",
                                    )
                                    yield {
                                        "type": "response_metadata",
                                        "metadata": {
                                            **response_metadata_base,
                                            "confidence": confidence,
                                            "plan_id": plan_state.plan_id if plan_state else None,
                                        },
                                    }
                                    return

                                if isinstance(raw_output, dict) and raw_output.get("error"):
                                    had_tool_errors = True
                                    if plan_step:
                                        plan_step.status = "failed"
                                        plan_step.error = str(raw_output["error"])
                                        yield {
                                            "type": "step_failed",
                                            "step": step_counter,
                                            "content": plan_step.description,
                                            "metadata": {
                                                "plan_id": plan_state.plan_id,
                                                "step_id": plan_step.step_id,
                                                "step_index": plan_state.steps.index(plan_step),
                                                "status": "failed",
                                                "error": raw_output["error"],
                                            },
                                        }
                                        step_counter += 1

                                if tool_name == "search_knowledge":
                                    results = raw_output.get("results", [])
                                    citations = raw_output.get("citations", [])
                                    if results or citations or raw_output.get("context"):
                                        latest_kb_output = raw_output
                                    kb_chunks_retrieved += (
                                        len(results) if isinstance(results, list) else 0
                                    )
                                    kb_citations_used += (
                                        len(citations) if isinstance(citations, list) else 0
                                    )
                                    search_ms = raw_output.get("search_time_ms", 0)
                                    if isinstance(search_ms, (int, float)) and search_ms > 0:
                                        kb_search_ms_total += float(search_ms)
                                        kb_search_calls += 1
                                    if results or citations:
                                        yield {
                                            "type": "knowledge_retrieval",
                                            "step": step_counter,
                                            "content": "Evaluating knowledge base results",
                                            "metadata": {
                                                "section": "KNOWLEDGE_RETRIEVAL",
                                                "icon": "📚",
                                                "reasoning": (f"Retrieved {len(results)} chunks."),
                                                "citations": citations,
                                                "result_count": len(results),
                                            },
                                        }
                                        step_counter += 1

                                yield {
                                    "type": "tool_result",
                                    "step": step_counter,
                                    "content": f"Completed {tool_name}",
                                    "metadata": {
                                        "result": {
                                            "tool_call_id": tool_call_id,
                                            "name": tool_name,
                                            "output": raw_output,
                                            "error": (
                                                raw_output.get("error")
                                                if isinstance(raw_output, dict)
                                                else None
                                            ),
                                            "duration_ms": duration_ms,
                                            "cache_hit": cache_hit,
                                            "validation": _normalize_guardrail_report(
                                                [
                                                    src.domain.models.GuardrailViolation(
                                                        rule="tool_error",
                                                        message=str(raw_output.get("error", "")),
                                                        severity="error",
                                                    )
                                                ]
                                                if (
                                                    isinstance(raw_output, dict)
                                                    and raw_output.get("error")
                                                )
                                                else []
                                            ),
                                        }
                                    },
                                }
                                step_counter += 1

                                if plan_step and plan_step.status != "failed":
                                    plan_step.status = "completed"
                                    plan_step.duration_ms = duration_ms
                                    if plan_state:
                                        plan_state.completed_steps += 1
                                        yield {
                                            "type": "step_verified",
                                            "step": step_counter,
                                            "content": plan_step.description,
                                            "metadata": {
                                                "plan_id": plan_state.plan_id,
                                                "step_id": plan_step.step_id,
                                                "step_index": plan_state.steps.index(plan_step),
                                                "status": "completed",
                                                "duration_ms": duration_ms,
                                                "verification": {
                                                    "passed": True,
                                                    "schema_valid": True,
                                                    "reasoning": (
                                                        f"{tool_name} completed successfully."
                                                    ),
                                                },
                                            },
                                        }
                                        step_counter += 1

                            elif hasattr(part, "text") and part.text:
                                if event.is_final_response():
                                    text: str = part.text
                                    final_text += text
                                    for chunk_text in _iter_response_chunks(text):
                                        yield {
                                            "type": "final_response_chunk",
                                            "content": chunk_text,
                                        }
                                        await asyncio.sleep(0.03)
                                else:
                                    yield {
                                        "type": "thinking",
                                        "step": step_counter,
                                        "content": part.text[:200],
                                        "metadata": {
                                            "section": "REASONING",
                                            "icon": "💭",
                                            "reasoning": part.text[:500],
                                        },
                                    }
                                    step_counter += 1

                    model_name: str = active_model_name
                    break
                except Exception as run_error:
                    should_retry_with_fallback: bool = (
                        self._is_model_access_error(run_error)
                        and not final_text
                        and not pending_tool_calls
                        and model_attempt + 1 < len(model_candidates)
                    )
                    if not should_retry_with_fallback:
                        raise

                    failed_model: str = active_model_name
                    fallback_model: str = model_candidates[model_attempt + 1]
                    logger.warning(
                        "Primary Vertex model unavailable, retrying with fallback",
                        extra={
                            "failed_model": failed_model,
                            "fallback_model": fallback_model,
                            "session_id": session_id,
                        },
                    )
                    yield {
                        "type": "thinking",
                        "step": step_counter,
                        "content": "Retrying request with fallback model",
                        "metadata": {
                            "section": "MODEL_FALLBACK",
                            "icon": "↺",
                            "reasoning": (
                                f"Primary model {failed_model} is unavailable; retrying with {fallback_model}."
                            ),
                            "failed_model": failed_model,
                            "fallback_model": fallback_model,
                        },
                    }
                    step_counter += 1
                    model_attempt += 1

            if not final_text:
                fallback_text: str | None = _build_grounded_kb_fallback_response(
                    message,
                    latest_kb_output,
                )
                if fallback_text:
                    had_tool_errors = True
                    fallback_reason = "missing_final_response_after_retrieval"
                    final_text: str = fallback_text
                    logger.warning(
                        "Using grounded KB fallback response after empty final model output",
                        extra={
                            "conversation_id": session_id,
                            "result_count": (
                                latest_kb_output.get("total_results", 0) if latest_kb_output else 0
                            ),
                        },
                    )
                    for chunk_text in _iter_response_chunks(final_text):
                        yield {
                            "type": "final_response_chunk",
                            "content": chunk_text,
                        }
                else:
                    had_tool_errors = True
                    fallback_reason = "missing_final_response"
                    final_text = "I couldn't complete the answer this time. Please try again."
                    logger.warning(
                        "Runner completed without a final response",
                        extra={"conversation_id": session_id},
                    )
                    yield {
                        "type": "final_response_chunk",
                        "content": final_text,
                    }

            if not final_text:
                yield {
                    "type": "thinking",
                    "step": step_counter,
                    "content": "Synthesizing answer",
                    "metadata": {
                        "section": "SYNTHESIS",
                        "icon": "📝",
                        "reasoning": "Formulating final response based on data gathered.",
                    },
                }
                step_counter += 1

            if plan_state:
                compose_step: PlanStep | None = self._find_plan_step(plan_state, "compose_response")
                if compose_step:
                    compose_step.status = "completed"
                    plan_state.completed_steps += 1
                    yield {
                        "type": "step_verified",
                        "step": step_counter,
                        "content": compose_step.description,
                        "metadata": {
                            "plan_id": plan_state.plan_id,
                            "step_id": compose_step.step_id,
                            "step_index": plan_state.steps.index(compose_step),
                            "status": "completed",
                            "verification": {
                                "passed": True,
                                "schema_valid": True,
                                "reasoning": "Final synthesis completed.",
                            },
                        },
                    }
                    step_counter += 1

            prompt_tokens: int = max(1, len(message) // 4)
            completion_tokens: int = max(1, len(final_text) // 4) if final_text else 1
            total_tokens: int = prompt_tokens + completion_tokens
            kb_used: bool = kb_chunks_retrieved > 0 or kb_citations_used > 0
            estimated_ungrounded_total_tokens: int = (
                max(
                    total_tokens,
                    total_tokens
                    + max(120, int(completion_tokens * 0.30))
                    + (kb_chunks_retrieved * 120),
                )
                if kb_used
                else total_tokens
            )
            estimated_tokens_saved: int = (
                max(0, estimated_ungrounded_total_tokens - total_tokens) if kb_used else 0
            )
            kb_search_ms: float | int = kb_search_ms_total / kb_search_calls if kb_search_calls > 0 else 0

            yield {
                "type": "reflecting",
                "step": step_counter,
                "content": "Computed grounding and token efficiency metrics",
                "metadata": {
                    "token_usage": {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens,
                        "llm_calls": 1,
                        "kb_used": kb_used,
                        "kb_chunks_retrieved": kb_chunks_retrieved,
                        "kb_search_ms": kb_search_ms,
                        "estimated_ungrounded_total_tokens": estimated_ungrounded_total_tokens,
                        "estimated_tokens_saved": estimated_tokens_saved,
                        "citations_used": kb_citations_used,
                    }
                },
            }
            step_counter += 1

            confidence: float = self._estimate_confidence(
                kb_citations_used=kb_citations_used,
                kb_used=kb_used,
                had_errors=had_tool_errors,
                final_text=final_text,
            )
            response_metadata = {
                **response_metadata_base,
                "confidence": confidence,
                "plan_id": plan_state.plan_id if plan_state else None,
            }
            if fallback_reason:
                response_metadata["fallback_used"] = True
                response_metadata["fallback_reason"] = fallback_reason
            yield {
                "type": "response_metadata",
                "metadata": response_metadata,
            }
            response_metadata_sent = True

            if self.memory and final_text:
                summary: str = f"User asked: {message[:80]}... Agent replied: {final_text[:80]}..."
                await self.memory.store_episode(
                    effective_user_id,
                    summary,
                    metadata={
                        "scope": scope,
                        "model": model_name,
                        "kb_used": kb_used,
                    },
                    policy=policy.memory,
                )

        except Exception as e:
            logger.exception(f"Agent run failed: {e}")
            if final_text:
                if not response_metadata_sent:
                    confidence: float = self._estimate_confidence(
                        kb_citations_used=kb_citations_used,
                        kb_used=(
                            kb_chunks_retrieved > 0
                            or kb_citations_used > 0
                            or bool(latest_kb_output and latest_kb_output.get("context"))
                        ),
                        had_errors=True,
                        final_text=final_text,
                    )
                    yield {
                        "type": "response_metadata",
                        "metadata": {
                            **response_metadata_base,
                            "confidence": confidence,
                            "plan_id": plan_state.plan_id if plan_state else None,
                            "fallback_used": bool(fallback_reason),
                            "fallback_reason": fallback_reason,
                        },
                    }
                return

            fallback_text: str | None = _build_grounded_kb_fallback_response(message, latest_kb_output)
            if fallback_text:
                fallback_reason = "runtime_error_after_retrieval"
                logger.warning(
                    "Using grounded KB fallback response after runtime error",
                    extra={
                        "conversation_id": session_id,
                        "result_count": (
                            latest_kb_output.get("total_results", 0) if latest_kb_output else 0
                        ),
                    },
                )
                for chunk_text in _iter_response_chunks(fallback_text):
                    yield {
                        "type": "final_response_chunk",
                        "content": chunk_text,
                    }
                confidence: float = self._estimate_confidence(
                    kb_citations_used=kb_citations_used,
                    kb_used=(
                        kb_chunks_retrieved > 0
                        or kb_citations_used > 0
                        or bool(latest_kb_output and latest_kb_output.get("context"))
                    ),
                    had_errors=True,
                    final_text=fallback_text,
                )
                yield {
                    "type": "response_metadata",
                    "metadata": {
                        **response_metadata_base,
                        "confidence": confidence,
                        "plan_id": plan_state.plan_id if plan_state else None,
                        "fallback_used": True,
                        "fallback_reason": fallback_reason,
                    },
                }
                return

            yield {
                "type": "final_response_chunk",
                "content": "I encountered an internal error while processing your request.",
            }
