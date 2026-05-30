# HKI as an MCP profile

> Published: 2026-05-25 · Tag: mcp, security, protocol

MCP is a great protocol. It defines a clean, typed interface between agents and
tools. It has strong versioning semantics, good support for streaming, and it's
gaining real adoption in production agentic systems.

It also has no concept of domain isolation.

Tools are registered globally. A client that can reach an MCP server can call
any tool on that server. The server receives a tool call with arguments; what it
does with the knowledge that the caller is from `payments` versus `hr` is
entirely up to the application developer.

This is not a design flaw in MCP. MCP is a transport and interface protocol.
It is deliberately not an authorization system. But it means that every MCP
deployment needs an answer to the question: "how do I know which domain this
call is authorized for, and how do I enforce it?"

HKI is that answer.

---

## What MCP provides

MCP defines:

- **Tools** — functions the server exposes, called by clients with typed
  arguments, returning typed results.
- **Resources** — data artifacts the server exposes, identified by URI.
- **Prompts** — parameterized templates the server provides to clients.
- **Sampling** — the server's ability to request completions from the client's
  LLM.

These are powerful primitives. None of them carry authorization context. The
protocol says nothing about whether the caller is permitted to invoke a given
tool, access a given resource, or use a given prompt for a given domain.

---

## The HKI profile for MCP

An HKI MCP profile adds three things on top of bare MCP:

### 1. Envelope transport

Every MCP client request carries an HKI envelope in the request headers or
the top-level call context. The envelope is minted by the gateway, not the MCP
client, and it is validated by the MCP server before any tool is dispatched.

```python
# In the MCP server initialization
from hki_mcp import HkiMiddlewareServer

server = HkiMiddlewareServer(
    name="payments-tools",
    envelope_header="x-hki-envelope",
    require_signature=False  # True in production with Ed25519
)
```

Every incoming call is rejected with `403` if the envelope is missing, expired,
globally-scoped, or wildcard-scoped. This happens before the tool handler runs.

### 2. Tool domain binding

Each tool is registered with a declared domain. The server evaluates the
gateway-target check before dispatching:

```python
from hki_mcp import HkiToolGuard

@server.tool("payments-report")
@HkiToolGuard(domain="payments")
async def payments_report(invoice_id: str) -> dict:
    # Only reached if envelope.active_domain == "payments"
    return await fetch_report(invoice_id)
```

`HkiToolGuard` calls `evaluate_gateway_target` internally. The tool is
only reachable by agents operating in the `payments` domain. An `hr` agent
with a valid HKI envelope cannot invoke it — the gateway check blocks it with a
specific denial reason that appears in the audit trace.

The domain binding is not a role check or an ACL lookup. It's an exact-equality
match against the active domain in the signed envelope. The result is deterministic
and testable.

### 3. Resource artifact labeling

Resources returned by MCP tools carry `HkiArtifactLabel` metadata:

```python
from hki_mcp import HkiResourceGuard
from hki_runtime import HkiArtifactLabel, assert_artifact_visible

@server.resource("invoices://{invoice_id}")
@HkiResourceGuard()
async def get_invoice(invoice_id: str, envelope: HkiEnvelope) -> Resource:
    doc = await fetch_invoice(invoice_id)
    label = HkiArtifactLabel(
        org_id=doc.org_id,
        domain=doc.domain,
        classification=doc.classification
    )
    # Raises 403 if envelope.active_domain != label.domain
    assert_artifact_visible(envelope, label)
    return Resource(uri=f"invoices://{invoice_id}", content=doc.content)
```

This ensures that even if a tool is somehow invoked with a cross-domain envelope,
the resource it returns carries its own domain label that is checked at read time.
Defense in depth.

---

## The conformance test

The `@hki/mcp` package ships with a conformance test suite that exercises
all three primitives against a test MCP server:

```bash
npm install @hki/mcp
pnpm test:hki-mcp
```

The tests cover:

- Tool call rejected with missing envelope
- Tool call rejected with expired envelope
- Tool call rejected with `global` active domain
- Tool call rejected with domain not matching tool binding
- Tool call allowed with matching domain
- Resource access rejected with cross-domain label
- Resource access allowed with matching label
- Scope-override rejection (body domain != envelope domain)

These tests can be run against any MCP server that uses `@hki/mcp` or
implements the HKI envelope transport. They produce a pass/fail result, not
a narrative.

---

## Why this is a profile, not a wrapper

A wrapper replaces the MCP protocol. A profile extends it.

HKI adds:

- A header convention for envelope transport (`x-hki-envelope`)
- A validation step before tool dispatch
- A label requirement on returned resources
- An audit convention for denial reasons

HKI does not replace:

- MCP tool definitions (unchanged)
- MCP streaming semantics (unchanged)
- MCP version negotiation (unchanged)
- Any existing MCP server implementation

An MCP server that adopts `HkiToolGuard` and `HkiResourceGuard` remains a
valid MCP server. A client that doesn't know about HKI can still connect — it
will simply fail at the envelope validation step, which is the correct behavior
for an unauthenticated client.

---

## Alignment with the A2A spec

The Agent-to-Agent (A2A) protocol from Google's open spec handles agent
delegation across process boundaries. When an orchestrator delegates a subtask
to a sub-agent via A2A, the delegation message must carry the HKI envelope.

```python
# A2A task message with HKI envelope
{
    "task_id": "t_01HX...",
    "instructions": "Summarize Q4 invoices",
    "context": {
        "hki_envelope": child_envelope.dict()
    }
}
```

The child envelope is minted with narrowed `authorized_domains` — it can be
equal to the parent's active domain, but never broader. The receiving agent
validates the envelope before accepting the task.

This is HKI-T07 in reverse: instead of showing the failure when the envelope
is dropped (which we do in the threat catalog), it shows the correct pattern
where the envelope propagates through the delegation boundary.

---

## The OWASP LLM Top 10 connection

OWASP LLM02 (Insecure Output Handling) and LLM06 (Sensitive Information
Disclosure) both describe data leakage through agent pipelines. The HKI
MCP profile directly addresses the mechanisms behind both:

- LLM02: tool outputs containing cross-domain data — blocked by resource label assertion
- LLM06: RAG results from unauthorized domains — blocked by gateway-target domain check

The profile doesn't add new security concepts. It makes existing security
requirements (isolation, authorization, traceability) mechanically enforceable
at the tool-call boundary, which is exactly where LLM-specific leakage occurs.

---

## Adoption path

Add to an existing MCP server in three steps:

1. **Install**: `npm install @hki/mcp` (TypeScript) or `pip install hki-runtime[mcp]` (Python)
2. **Middleware**: wrap server initialization with `HkiMiddlewareServer`
3. **Guards**: add `@HkiToolGuard(domain=...)` to each tool handler

The envelope has to come from somewhere — typically your gateway or BFF, which
mints it from the authenticated session. The server validates it; it never
mints it. The minting is always at the trust boundary, not inside the tool.

If you're running MCP in production today with no domain isolation, this path
gets you to L3 conformance (runtime rejection of unauthorized scope) in a single
deploy. L4 (tested, with HTTP probes) requires running `pnpm probe:smoke` and
committing the evidence — another hour at most.

The work is small. The surface it closes is not.
