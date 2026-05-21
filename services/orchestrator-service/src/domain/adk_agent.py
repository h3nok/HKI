"""
ADK Agent Definition — google-adk LlmAgent configured for Vertex AI.

Uses the google-adk SDK's LlmAgent class which natively handles:
  - Vertex AI model calls via google.genai (ADC auth, no HTTP gateway)
  - Function-calling loop (tool dispatch, multi-turn reasoning)
  - Session management via InMemorySessionService

The agent is configured with the existing tool functions from tools.py
and ADK callbacks from adk_callbacks.py for caching, validation, and
corrective RAG.
"""

from __future__ import annotations

import os
import typing

import google.adk.agents

import src.core.config
import src.core.logging
import src.domain.models
import src.domain.tools

logger = src.core.logging.logger.getChild("adk_agent")
Agent = google.adk.agents.Agent
settings = src.core.config.settings
DEFAULT_RUNTIME_SCOPE = "default"

_PLATFORM_CONSTITUTION = (
    "You are HKI's Agent.\n"
    "\n"
    "Identity and trust:\n"
    "- Do not describe yourself as a generic large language model.\n"
    "- Do not mention model providers unless the user explicitly asks.\n"
    "- Speak as HKI's internal agentic solution, not as a vendor product.\n"
    "\n"
    "Answer quality:\n"
    "- Provide concise, practical, and trustworthy answers.\n"
    "- Prefer retrieved evidence and live tool results over prior knowledge.\n"
    "- Do not invent policy, compliance guidance, pricing, inventory,\n"
    "  product details, or document content.\n"
    "- If evidence is missing, ambiguous, conflicting, or potentially stale, say so clearly.\n"
    "\n"
    "Safety and scope:\n"
    "- Ask clarifying questions before answering ambiguous operational requests.\n"
    "- Do not imply access to tools, data, or domains that are not available\n"
    "  in the current session.\n"
    "- Escalate or recommend verification when the request involves legal\n"
    "  interpretation, HR sensitivity, safety, or sensitive member data.\n"
    "\n"
    "Grounding and citations:\n"
    "- Cite only the documents, records, or tool outputs actually retrieved\n"
    "  in the current interaction.\n"
    "- When a retrieved knowledge-base title includes an article number such as\n"
    "  KB1234567, name the single best matching KB article explicitly in the\n"
    "  answer instead of relying on citation markers alone.\n"
    "- When knowledge base passages are retrieved, use inline citation\n"
    "  markers [1], [2], etc. to reference them. Place the marker right\n"
    "  after the sentence or claim it supports.\n"
    "- Preserve exact rejection codes, error codes, field names, BIN/PCN values,\n"
    "  and operational identifiers from retrieved evidence. Do not paraphrase or\n"
    "  normalize them into looser wording.\n"
    "- If multiple KBs are retrieved, prioritize the article whose title most\n"
    "  directly matches the user's exact code, title, or troubleshooting scenario.\n"
    "- Lead with the answer, then provide short supporting details,\n"
    "  citations, caveats, or next steps.\n"
    "\n"
    "Response format:\n"
    "- Use clean markdown that scans well in chat: short paragraphs,\n"
    "  short bullet lists, and brief headings only when they improve clarity.\n"
    "- For document, file, or policy questions, prefer this order when useful:\n"
    "  direct answer, key details, implications or follow-up.\n"
    "- Keep filenames, document titles, field names, and actions explicit.\n"
    "- Do not dump raw JSON or raw citation objects into the prose."
)

_HKI_STANDARD_EXPERTISE = (
    "When the user asks about HKI, Hermetic Knowledge Isolation, the HKI standard, "
    "agentic platform auditability, conformance, evidence, deployment, or how to "
    "evaluate ChatGPT, Gemini Enterprise, or another agentic platform against HKI, "
    "answer as an HKI standard expert.\n"
    "\n"
    "Baseline HKI model:\n"
    "- HKI is a control framework for agentic AI systems. Every runtime operation "
    "executes inside exactly one named domain.\n"
    "- The HkiEnvelope is the signed scope object that carries org, subject, "
    "active domain, authorized domains, purpose, risk tier, policy pack, issuer, "
    "timestamps, and signature through gateway, retrieval, tools, cache, jobs, "
    "and audit.\n"
    "- The core invariants are fail-closed envelope validation, exact-match domain "
    "visibility, no body-scope override, domain-scoped cache keys, explicit "
    "cross-domain publication, admin-plane separation, async envelope reattach, "
    "artifact visibility labels, MCP/tool guards, and narrowed sub-agent handoff.\n"
    "\n"
    "HKI answer behavior:\n"
    "- For HKI standard, maturity, implementation, audit, conformance, or adoption "
    "questions, use the standard/spec/docs vocabulary precisely: HkiEnvelope, "
    "active_domain, authorized_domains, same_domain/sameHkiDomain, "
    "derive_hki_cache_key/deriveHkiCacheKey, reject_conflicting_scope_argument, "
    "HkiMiddleware, evaluateGatewayTarget, HkiArtifactLabel, and conformance evidence.\n"
    "- Explain what to inspect, which invariant or threat it maps to, what evidence "
    "would prove compliance, and what failure should be blocked.\n"
    "- Never recommend global or wildcard active domains, raw domain string equality, "
    "query-only cache keys, runtime cross-domain reads, or passing parent envelopes "
    "unchanged to sub-agents.\n"
    "- If retrieved HKI docs are available, ground the answer in them and cite them. "
    "If they are unavailable, say that the answer is based on the built-in HKI "
    "baseline and identify what should be verified in the spec or conformance docs."
)


def _format_section(title: str, body: str) -> str:
    return f"## {title}\n{body.strip()}"


def _preview_text(body: str, *, limit: int = 220) -> str:
    normalized: str = " ".join(body.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1]}…"


def _default_domain_overlay(scope: str, scopes: list[str] | None = None) -> str:
    authorized_scopes: str = ", ".join(scopes or [scope])
    if scope == "global":
        return (
            "You are operating as an enterprise-wide assistant across HKI business domains.\n"
            f"Authorized scopes for this session: {authorized_scopes}.\n"
            "Handle enterprise questions directly. For domain-specific requests,\n"
            "ground the answer in the relevant business context and make any\n"
            "scope limitations explicit."
        )
    return (
        f"You are operating within HKI's '{scope}' business domain.\n"
        f"Authorized scopes for this session: {authorized_scopes}.\n"
        "Prioritize terminology, procedures, systems, and knowledge relevant\n"
        "to this domain. If the request crosses into another domain or needs\n"
        "broader enterprise context, say that clearly and ask a clarifying\n"
        "question."
    )


def _tooling_overlay(enabled_tools: list[str] | None = None) -> str:
    catalog = src.domain.tools.get_tool_catalog(enabled_tools)
    if not catalog:
        return (
            "No external tools are enabled for this session. Answer only from "
            "retrieved knowledge and conversation context."
        )

    lines: list[str] = ["Use only the tools that are enabled in this session:"]
    for spec in catalog.values():
        lines.append(f"- {spec.name}: {spec.description}")
    lines.append(
        "For company knowledge questions that require factual grounding, use "
        "search_knowledge before answering."
    )
    lines.append(
        "For HKI standard, conformance, maturity, audit, adoption, deployment, "
        "or agentic-platform evaluation questions, use search_knowledge first "
        "when it is available, then answer with HKI terminology and evidence."
    )
    lines.append(
        "Do not use search_knowledge for greetings, pleasantries, thanks, "
        "farewells, or questions only about the conversation itself."
    )
    lines.append(
        "When the user references a document title, filename, or artifact name, "
        "search that exact name first, then broaden only if needed."
    )
    lines.append(
        "For troubleshooting questions that include exact rejection codes, KB article "
        "numbers, BIN/PCN values, or field names, search those exact identifiers first "
        "and keep them unchanged in the final answer."
    )
    lines.append(
        "If search_knowledge returns KB article titles, explicitly name the best match "
        "in the answer, especially for operational runbooks and rejection-resolution guidance."
    )
    if "search_products" in catalog:
        lines.append("- Use search_products for catalog discovery and product lookup.")
    if "check_inventory" in catalog:
        lines.append("- Use check_inventory for live availability or stock questions.")
    if "get_product_pricing" in catalog:
        lines.append(
            "- Use get_product_pricing for pricing questions and note that "
            "prices may vary by context or time."
        )
    if "search_entities" in catalog:
        lines.append(
            "- Use search_entities when the user asks about a specific named thing "
            "(a person, product, policy, concept, or location) to discover which "
            "documents reference it. Follow up with search_knowledge using the entity "
            "name or connected chunk IDs as the query."
        )
    if "get_entity_context" in catalog:
        lines.append(
            "- Use get_entity_context after search_entities to explore how an entity "
            "connects to related concepts — useful for multi-hop questions like "
            "'what policies govern X?' or 'what is related to Y?'."
        )
    return "\n".join(lines)


def _runtime_policy_overlay(
    *,
    scope: str,
    retrieval_strategy: str,
    planning_enabled: bool,
    tool_permissions: src.domain.models.ToolPermissionPolicy | None = None,
) -> str:
    permissions = tool_permissions or src.domain.models.ToolPermissionPolicy()
    lines: list[str] = [f"Active scope: {scope}"]

    if scope == "global":
        lines.append(
            "Treat the active scope as known session context. Do not ask the user "
            "to restate that this session is enterprise-wide."
        )
    else:
        lines.append(
            "Treat the active scope as known session context. Do not ask the user "
            "to restate the current value stream or business domain."
        )
        lines.append(
            "If you need narrower context, ask only for the team, role, "
            "workflow, or decision area within this scope."
        )

    lines.extend(
        [
            f"Retrieval strategy: {retrieval_strategy}",
            "Plan before tool use when the request is multi-step, ambiguous, or "
            "requires evidence gathering."
            if planning_enabled
            else "Use direct execution for straightforward requests; do not add "
            "unnecessary planning chatter.",
        ]
    )

    if permissions.approval_mode == src.domain.models.ApprovalMode.ALWAYS:
        lines.append(
            "All tool actions are approval-gated. Do not imply that an action "
            "has been completed until approval is granted."
        )
    elif permissions.approval_mode == src.domain.models.ApprovalMode.SENSITIVE_ONLY:
        lines.append(
            "Sensitive tool actions may require approval. If a tool reports "
            "that approval is required, explain the block clearly and wait for "
            "a decision."
        )

    if permissions.sensitive_tools:
        lines.append(f"Sensitive tools: {', '.join(permissions.sensitive_tools)}")
    if permissions.deny_tools:
        lines.append(f"Disabled tools for this session: {', '.join(permissions.deny_tools)}")

    return "\n".join(lines)


def build_prompt_stack(
    *,
    domain_prompt: str | None = None,
    enabled_tools: list[str] | None = None,
    scope: str = DEFAULT_RUNTIME_SCOPE,
    scopes: list[str] | None = None,
    retrieval_strategy: str = "hybrid",
    planning_enabled: bool = True,
    tool_permissions: src.domain.models.ToolPermissionPolicy | None = None,
    working_memory: str | None = None,
    working_memory_count: int = 0,
) -> dict[str, typing.Any]:
    domain_body: str = domain_prompt or _default_domain_overlay(scope, scopes)
    domain_source: str = "stream_override" if domain_prompt else "scope_default"
    tools_body: str = _tooling_overlay(enabled_tools)
    runtime_body: str = _runtime_policy_overlay(
        scope=scope,
        retrieval_strategy=retrieval_strategy,
        planning_enabled=planning_enabled,
        tool_permissions=tool_permissions,
    )
    permissions = tool_permissions or src.domain.models.ToolPermissionPolicy()
    resolved_tools = list(src.domain.tools.get_tool_catalog(enabled_tools).keys())

    section_specs: list[tuple[str, str, str]] = [
        ("platform_constitution", "Platform Constitution", _PLATFORM_CONSTITUTION),
        ("hki_standard_expertise", "HKI Standard Expertise", _HKI_STANDARD_EXPERTISE),
        ("domain_persona", "Domain Persona", domain_body),
        ("tools", "Tools", tools_body),
        ("runtime_policy", "Runtime Policy", runtime_body),
    ]
    if working_memory:
        section_specs.append(("working_memory", "Working Memory", working_memory))

    assembled_instruction: str = "\n\n".join(
        _format_section(title, body) for _, title, body in section_specs
    )

    sections: list[dict[str, typing.Any]] = [
        {
            "key": "platform_constitution",
            "title": "Platform Constitution",
            "source": "platform_default",
            "preview": _preview_text(_PLATFORM_CONSTITUTION),
            "char_count": len(_PLATFORM_CONSTITUTION),
        },
        {
            "key": "hki_standard_expertise",
            "title": "HKI Standard Expertise",
            "source": "platform_default",
            "preview": _preview_text(_HKI_STANDARD_EXPERTISE),
            "char_count": len(_HKI_STANDARD_EXPERTISE),
        },
        {
            "key": "domain_persona",
            "title": "Domain Persona",
            "source": domain_source,
            "preview": _preview_text(domain_body),
            "char_count": len(domain_body),
            "custom": domain_prompt is not None,
        },
        {
            "key": "tools",
            "title": "Tools",
            "source": "tool_registry",
            "preview": _preview_text(tools_body),
            "char_count": len(tools_body),
            "enabled_tools": resolved_tools,
            "tool_count": len(resolved_tools),
        },
        {
            "key": "runtime_policy",
            "title": "Runtime Policy",
            "source": "execution_policy",
            "preview": _preview_text(runtime_body),
            "char_count": len(runtime_body),
            "scope": scope,
            "scopes": scopes or [scope],
            "retrieval_strategy": retrieval_strategy,
            "planning_enabled": planning_enabled,
            "approval_mode": permissions.approval_mode.value,
            "sensitive_tools": permissions.sensitive_tools,
            "denied_tools": permissions.deny_tools,
        },
    ]
    if working_memory:
        sections.append(
            {
                "key": "working_memory",
                "title": "Working Memory",
                "source": "memory_manager",
                "preview": _preview_text(working_memory),
                "char_count": len(working_memory),
                "memory_count": working_memory_count,
            }
        )

    return {
        "sections": sections,
        "summary": {
            "layer_count": len(sections),
            "domain_prompt_source": domain_source,
            "enabled_tool_count": len(resolved_tools),
            "working_memory_included": bool(working_memory),
            "working_memory_count": working_memory_count,
            "assembled_instruction_chars": len(assembled_instruction),
        },
        "assembled_instruction": assembled_instruction,
    }


def build_system_instruction(
    *,
    domain_prompt: str | None = None,
    enabled_tools: list[str] | None = None,
    scope: str = DEFAULT_RUNTIME_SCOPE,
    scopes: list[str] | None = None,
    retrieval_strategy: str = "hybrid",
    planning_enabled: bool = True,
    tool_permissions: src.domain.models.ToolPermissionPolicy | None = None,
) -> str:
    return build_prompt_stack(
        domain_prompt=domain_prompt,
        enabled_tools=enabled_tools,
        scope=scope,
        scopes=scopes,
        retrieval_strategy=retrieval_strategy,
        planning_enabled=planning_enabled,
        tool_permissions=tool_permissions,
    )["assembled_instruction"]


def _configure_genai_env() -> None:
    """Set env vars that google.genai reads to route through Vertex AI."""
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
    if settings.GCP_PROJECT_ID:
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.GCP_PROJECT_ID)
    location = settings.VERTEX_AI_LOCATION or settings.GCP_LOCATION
    if location:
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", location)


def build_adk_agent(
    *,
    system_prompt: str | None = None,
    enabled_tools: list[str] | None = None,
    model_name: str | None = None,
    tool_functions: list | None = None,
) -> google.adk.agents.Agent:
    """
    Build and return an ADK LlmAgent wired to Vertex AI Gemini.

    Args:
        system_prompt: Override the default system instruction.
        enabled_tools: Whitelist of tool names; None = all tools.
    """
    _configure_genai_env()

    if tool_functions is not None:
        tool_list = tool_functions
    else:
        catalog = src.domain.tools.get_tool_catalog(enabled_tools)
        tool_list = [spec.func for spec in catalog.values()]

    selected_model = model_name or settings.AGENT_MODEL

    agent: google.adk.agents.LlmAgent = Agent(
        name="orchestrator_agent",
        model=selected_model,
        instruction=system_prompt or build_system_instruction(enabled_tools=enabled_tools),
        tools=tool_list,
    )

    logger.info(
        "ADK Agent built",
        extra={
            "model": selected_model,
            "tools": [fn.__name__ for fn in tool_list],
            "vertex_project": os.environ.get("GOOGLE_CLOUD_PROJECT"),
            "vertex_location": os.environ.get("GOOGLE_CLOUD_LOCATION"),
        },
    )

    return agent
