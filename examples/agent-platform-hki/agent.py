"""
HKI + Google Agent Platform (ADK) — managed evidence example.

Shows how to instrument an ADK agent with HKI conformance when running on
Google's managed agent runtime (Vertex AI Agent Builder / Reasoning Engine).
The managed platform provides: agent runtime, session memory, agent identity,
and audit logs. HKI adds: the signed isolation contract that proves those
managed services preserved one active domain per operation.

Integration points demonstrated:
  1. HkiBeforeAgentCallback — fail-closed envelope validation before each agent turn
  2. HkiBeforeToolCallback — fail-closed envelope validation before each tool call
  3. HkiToolGuard — per-tool domain enforcement (gateway target check)
  4. HkiSessionGuard — asserts all session events share the same envelope
  5. Managed evidence — correlating Cloud Audit Log resource IDs with HKI evidence

Run (no ADK install needed — uses duck-typed stubs):
    pip install "hki-runtime>=0.1.0" hki-adk
    python agent.py

With real ADK:
    pip install "hki-runtime>=0.1.0" hki-adk google-adk
    python agent.py
"""

from __future__ import annotations

import time
import types
from typing import Any

import hki_runtime
from hki_runtime.client import mint_envelope
import hki_adk
from hki_adk import (
    HkiBeforeAgentCallback,
    HkiBeforeToolCallback,
    HkiSessionGuard,
    HkiToolGuard,
    hki_cache_key,
    ENVELOPE_KEY,
)

# ---------------------------------------------------------------------------
# Domain-scoped tools (wrapped with HkiToolGuard)
# ---------------------------------------------------------------------------


def _search_knowledge_raw(query: str) -> str:
    """Simulates a managed RAG search scoped to the active domain."""
    return f"[knowledge result for: {query!r}]"


def _run_policy_check_raw(action: str) -> str:
    """Simulates a policy evaluation for a governed action."""
    return f"[policy: {action!r} is permitted in this domain]"


# HkiToolGuard enforces that each tool's domain matches envelope.active_domain
search_knowledge = HkiToolGuard(_search_knowledge_raw, domain="payments")
run_policy_check = HkiToolGuard(_run_policy_check_raw, domain="payments")

# ---------------------------------------------------------------------------
# Stub ADK objects (stand-ins when google-adk is not installed)
# ---------------------------------------------------------------------------


def _make_tool_context(envelope: hki_runtime.HkiEnvelope) -> Any:
    """Create a minimal duck-typed ToolContext / CallbackContext."""
    env_dict = envelope.model_dump() if hasattr(envelope, "model_dump") else vars(envelope)
    return types.SimpleNamespace(
        state={ENVELOPE_KEY: env_dict},
        session=types.SimpleNamespace(state={ENVELOPE_KEY: env_dict}, events=[]),
        metadata={},
    )


def _make_agent(callbacks: dict[str, Any]) -> Any:
    """Minimal duck-typed ADK Agent stub."""
    return types.SimpleNamespace(**callbacks)


# ---------------------------------------------------------------------------
# Agent run — wiring callbacks
# ---------------------------------------------------------------------------


def run_agent(query: str, active_domain: str, org_id: str = "acme") -> dict[str, Any]:
    """
    Run one agent turn with full HKI enforcement.

    In production this would call agent.run(session) via ADK. Here we invoke
    the same callback chain manually to show the enforcement contract.
    """
    now = int(time.time())
    envelope = mint_envelope(
        org_id=org_id,
        subject_id="user:demo",
        active_domain=active_domain,
        authorized_domains=[active_domain],
        purpose="chat",
        risk_tier="read-only",
        policy_pack_id=f"{active_domain}@2026",
        issuer="agent-platform-gateway",
        signature="demo",
        ttl=300,
        issued_at=now,
    )

    before_agent = HkiBeforeAgentCallback()
    before_tool = HkiBeforeToolCallback()
    session_guard = HkiSessionGuard()

    ctx = _make_tool_context(envelope)

    # 1. Before-agent callback — would abort the turn if envelope is invalid/missing
    before_agent(ctx)

    # 2. Tool calls — each enforces the envelope independently
    tool_results: list[str] = []
    for tool_fn, args in [(search_knowledge, {"query": query}), (run_policy_check, {"action": "retrieve"})]:
        before_tool(tool_fn, args, ctx)
        result = tool_fn(query if "query" in args else args.get("action", ""), tool_context=ctx)
        tool_results.append(result)

    # 3. Session guard — asserts all events share the same envelope
    session_guard.assert_consistent(ctx.session)

    # 4. Cache key — org_id + active_domain + operation + prompt
    key = hki_cache_key(envelope, query, model="gemini-2.0-flash")

    # 5. Managed evidence — in production these come from Cloud Audit Logs
    evidence = {
        "hki_envelope_id": envelope.envelope_id,
        "active_domain": envelope.active_domain,
        "org_id": envelope.org_id,
        "cache_key": key,
        "tool_calls": len(tool_results),
        "managed_resources": {
            "agent_runtime": "//aiplatform.googleapis.com/…/reasoningEngines/my-agent",
            "session_memory": "//aiplatform.googleapis.com/…/memoryStores/my-memory",
            "agent_identity": f"spiffe://example.com/ns/agents/sa/{active_domain}-agent",
        },
    }

    return {
        "domain": active_domain,
        "query": query,
        "tool_results": tool_results,
        "evidence": evidence,
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== HKI + Google Agent Platform example ===\n")

    # ✅ On-domain agent run
    result = run_agent("What are the refund limits?", active_domain="payments")
    print(f"[payments] ✅ on-domain run")
    print(f"  envelope_id : {result['evidence']['hki_envelope_id']}")
    print(f"  tool results: {result['tool_results']}")
    print(f"  cache key   : {result['evidence']['cache_key'][:48]}…")
    print()

    # ⛔ Cross-domain tool call — HkiToolGuard rejects it
    print("[hr query with payments envelope] ⛔ cross-domain tool call")
    hr_env = mint_envelope(
        org_id="acme", subject_id="user:demo", active_domain="hr",
        authorized_domains=["hr"], purpose="chat", risk_tier="read-only",
        policy_pack_id="hr@2026", issuer="gateway", signature="demo",
        ttl=300, issued_at=int(time.time()),
    )
    hr_ctx = _make_tool_context(hr_env)
    try:
        # search_knowledge is bound to domain="payments"; hr envelope → denied
        search_knowledge("What is my PTO balance?", tool_context=hr_ctx)
        print("  ERROR: should have been denied")
    except hki_adk.HkiAdkDenied as exc:
        print(f"  denied ✅  code={exc.code!r}  message={exc.message!r}")
    print()

    # Missing envelope — before_agent_callback fail-closes
    print("[missing envelope] ⛔ before-agent callback")
    empty_ctx = types.SimpleNamespace(state={}, session=types.SimpleNamespace(state={}, events=[]))
    try:
        HkiBeforeAgentCallback()(empty_ctx)
        print("  ERROR: should have been denied")
    except hki_adk.HkiAdkDenied as exc:
        print(f"  denied ✅  code={exc.code!r}")
    print()

    print("Managed evidence sample: examples/agent-platform-hki/managed-evidence.sample.json")
