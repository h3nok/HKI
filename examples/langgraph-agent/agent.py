"""
HKI + LangGraph agent example — envelope propagation through tool calls.

The envelope is carried in LangGraph's TypedDict state. Every tool node
checks active_domain before executing. The handoff node demonstrates how
to re-mint a narrower envelope when delegating to a sub-agent.

Run:
    pip install "hki-runtime>=0.1.0" langgraph langchain-core
    python agent.py

Requirements:
    - No LLM API key needed — this uses mock tools to show HKI isolation.
    - Replace MockLLM with your provider (Anthropic, OpenAI, Vertex, etc.)
"""

from __future__ import annotations

import time
from typing import Annotated, Any, TypedDict

# LangGraph imports — install with: pip install langgraph langchain-core
try:
    from langgraph.graph import END, StateGraph
    from langgraph.graph.message import add_messages
    from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
except ImportError as exc:
    raise SystemExit("Install langgraph + langchain-core: pip install langgraph langchain-core") from exc

import hki_runtime
from hki_runtime.client import mint_envelope

# ---------------------------------------------------------------------------
# State — the envelope travels with the graph
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    envelope: hki_runtime.HkiEnvelope
    result: str | None


# ---------------------------------------------------------------------------
# Domain-scoped tools
# ---------------------------------------------------------------------------

def payments_lookup(envelope: hki_runtime.HkiEnvelope, transaction_id: str) -> dict[str, Any]:
    """Retrieve transaction details — only works when active_domain == 'payments'."""
    if not hki_runtime.same_domain(envelope.active_domain, "payments"):
        raise PermissionError(
            f"payments_lookup requires active_domain='payments', got {envelope.active_domain!r}"
        )
    return {
        "transaction_id": transaction_id,
        "amount": 149.99,
        "status": "completed",
        "domain": envelope.active_domain,
    }


def hr_pto_balance(envelope: hki_runtime.HkiEnvelope, employee_id: str) -> dict[str, Any]:
    """Fetch PTO balance — only works when active_domain == 'hr'."""
    if not hki_runtime.same_domain(envelope.active_domain, "hr"):
        raise PermissionError(
            f"hr_pto_balance requires active_domain='hr', got {envelope.active_domain!r}"
        )
    return {
        "employee_id": employee_id,
        "days_remaining": 8.5,
        "domain": envelope.active_domain,
    }


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def payments_node(state: AgentState) -> AgentState:
    """Execute a payments domain tool call."""
    envelope = state["envelope"]
    try:
        result = payments_lookup(envelope, transaction_id="txn_abc123")
        msg = AIMessage(content=f"[payments] {result}")
        return {"messages": [msg], "result": str(result), "envelope": envelope}
    except PermissionError as exc:
        msg = AIMessage(content=f"[payments] BLOCKED: {exc}")
        return {"messages": [msg], "result": None, "envelope": envelope}


def hr_node(state: AgentState) -> AgentState:
    """Execute an HR domain tool call."""
    envelope = state["envelope"]
    try:
        result = hr_pto_balance(envelope, employee_id="emp_007")
        msg = AIMessage(content=f"[hr] {result}")
        return {"messages": [msg], "result": str(result), "envelope": envelope}
    except PermissionError as exc:
        msg = AIMessage(content=f"[hr] BLOCKED: {exc}")
        return {"messages": [msg], "result": None, "envelope": envelope}


def handoff_node(state: AgentState) -> AgentState:
    """
    Demonstrate domain handoff: the orchestrator re-mints a narrower envelope
    for the sub-agent. The original envelope is NOT passed through unchanged.
    """
    parent = state["envelope"]

    # Sub-agent gets a narrower scope: only 'payments', not 'hr'
    child_envelope = mint_envelope(
        org_id=parent.org_id,
        subject_id=parent.subject_id,
        active_domain="payments",
        authorized_domains=["payments"],          # narrowed from parent's scopes
        purpose="retrieve",
        risk_tier="read-only",
        policy_pack_id=parent.policy_pack_id,
        issuer="example-orchestrator",
        signature="demo-child",
        ttl=60,
        issued_at=int(time.time()),
    )

    msg = AIMessage(
        content=f"[handoff] minted child envelope: active_domain={child_envelope.active_domain!r}"
    )
    return {"messages": [msg], "envelope": child_envelope, "result": None}


def router(state: AgentState) -> str:
    """Route based on the last human message."""
    last = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None
    )
    if last is None:
        return END
    text = last.content.lower()
    if "hr" in text or "pto" in text:
        return "hr"
    if "handoff" in text or "child" in text:
        return "handoff"
    return "payments"


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def build_graph() -> Any:
    g = StateGraph(AgentState)
    g.add_node("payments", payments_node)
    g.add_node("hr", hr_node)
    g.add_node("handoff", handoff_node)

    g.set_conditional_entry_point(router)
    g.add_edge("payments", END)
    g.add_edge("hr", END)
    g.add_edge("handoff", END)

    return g.compile()


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def run(query: str, active_domain: str, authorized_domains: list[str]) -> None:
    now = int(time.time())
    envelope = mint_envelope(
        org_id="acme",
        subject_id="user:42",
        active_domain=active_domain,
        authorized_domains=authorized_domains,
        purpose="tool-call",
        risk_tier="read-only",
        policy_pack_id="example@2026",
        issuer="example-gateway",
        signature="demo",
        ttl=300,
        issued_at=now,
    )

    graph = build_graph()
    final = graph.invoke({
        "messages": [HumanMessage(content=query)],
        "envelope": envelope,
        "result": None,
    })

    print(f"\nQuery: {query!r}  (active_domain={active_domain!r})")
    for msg in final["messages"]:
        print(f"  {msg.content}")


if __name__ == "__main__":
    # ✅ payments query with payments envelope
    run("Look up transaction txn_abc123", "payments", ["payments", "hr"])

    # ⛔ HR query with payments-only envelope — tool blocked
    run("What is my PTO balance?", "payments", ["payments"])

    # ✅ HR query with hr envelope
    run("What is my PTO balance?", "hr", ["hr"])

    # Domain handoff: orchestrator re-mints narrower child envelope
    run("Do a handoff to the payments sub-agent", "payments", ["payments", "hr"])
