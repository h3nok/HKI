# Domain-aware RAG isn't isolation

> Published: 2026-05-25 · Tag: security, rag, agentic

You filtered your vector query by tenant. You labeled your documents. You have separate
namespaces in Pinecone. You're done, right?

No. You've solved retrieval scoping. You haven't solved isolation.

This distinction matters more every week as RAG moves from "search" to "agent."
The difference is that an agent has many more paths to leak data than a search
query does.

---

## What "domain-aware" actually means

A domain-aware RAG system filters retrieval to a named boundary — tenant, department,
regulatory scope, whatever you call it. The query for `payments` only returns
`payments` documents. Straightforward.

Here's what it doesn't cover:

- A cached completion from a `payments` query returned to an `hr` caller with a
  semantically similar question.
- An async ingestion job that loses its domain context on retry and indexes
  a document under the wrong domain.
- A sub-agent invoked via A2A that inherits the parent's session but not its
  domain envelope, so it answers with a global context.
- An LLM tool registered without a domain binding that any agent in the system
  can call.
- A graph traversal that follows a relationship edge from `payments` into `legal`
  because the edge itself wasn't domain-labeled.
- An admin route that returns cross-domain statistics, reachable from runtime
  code via an internal import.

Each of these is a real pattern. Each produces real data leakage with no error
log, no exception, no observable failure mode. The only signal is a response that
contained data it shouldn't have.

---

## The retrieval filter is the easy part

```python
# This is the part everyone does
results = vector_store.search(
    query=query,
    filter={"tenant_id": {"$eq": current_tenant}}
)
```

Fine. Now the hard parts.

### 1. The semantic cache

Most production RAG systems cache completions. The cache key is almost always
derived from the query — sometimes the raw text, sometimes a hash of the embedding.
Almost never the tenant + domain.

```python
# Broken — "What is our refund policy?" from hr and payments
# get the same cache key
cache_key = hash(query)
cached = redis.get(cache_key)
if cached:
    return cached  # may be payments data served to hr
```

The fix isn't complicated. The cache key must include the isolation context:

```python
from hki_runtime import derive_hki_cache_key

cache_key = derive_hki_cache_key({
    "envelope": envelope.dict(),
    "operation": "chat.completion",
    "input": {"query": query}
})
```

That key includes `org_id`, `active_domain`, and `policy_pack_id`. A cache hit
from `payments` cannot match a request from `hr`.

### 2. The async job

Ingestion jobs run outside the request cycle. They receive a payload and process it.
The natural implementation reads the domain from the job payload:

```python
def process_job(job):
    domain = job.get("domain") or "global"  # silent fallback
    ingest(job["document"], domain=domain)
```

`"global"` is an attack vector. A missing domain means the document gets indexed
without isolation, or under a catch-all that every domain can read.

The correct pattern is envelope re-attachment at job start:

```python
from hki_runtime import validate_envelope, same_domain
from hki_runtime.fastapi import get_envelope

def process_job(job):
    envelope = validate_envelope(job["hki_envelope"])
    if not same_domain(envelope.active_domain, job["expected_domain"]):
        raise IsolationError("domain mismatch on job resume")
    ingest(job["document"], domain=envelope.active_domain)
```

The envelope was minted when the job was created. If it has expired, the job
fails closed. If it was minted for a different domain, the job fails closed.
There is no fallback.

### 3. The A2A handoff

When your orchestrator delegates to a sub-agent, the sub-agent needs to operate
in the same domain as the parent — or a narrower one. It must never operate in
a broader domain.

The common failure mode:

```python
# Parent has active_domain="payments"
sub_result = await sub_agent.run(
    prompt=subtask,
    context=parent_session  # session, not envelope
)
```

The sub-agent receives session state but no envelope. It either uses a global
default or derives its own domain from the prompt. Both are wrong.

The correct pattern mints a child envelope that cannot exceed the parent's scope:

```python
from hki_runtime.client import mint_envelope

child_envelope = mint_envelope(
    org_id=parent_envelope.org_id,
    subject_id=parent_envelope.subject_id,
    active_domain=parent_envelope.active_domain,
    authorized_domains=[parent_envelope.active_domain],  # narrowed, never broader
    purpose="tool-call",
    risk_tier=parent_envelope.risk_tier,
    issuer="orchestrator"
)
```

### 4. The gateway target check

Not all tools should be callable from all domains. A `payments-report` tool
should only be invokable by agents operating in the `payments` domain.

Without a gateway check, any agent can call any tool:

```python
# Broken — no domain check on tool dispatch
result = tool_registry.dispatch(tool_name, args)
```

With a gateway check:

```python
from hki_runtime import evaluate_gateway_target, HkiGatewayTarget

target = HkiGatewayTarget(name=tool_name, domain="payments", type="tool")
decision = evaluate_gateway_target(envelope, target)
if decision.blocked:
    raise PermissionError(decision.reason)

result = tool_registry.dispatch(tool_name, args)
```

---

## Isolation is a contract, not a filter

The retrieval filter is one enforcement point. A real isolation contract covers:

| Path | Enforcement point |
|------|------------------|
| Vector retrieval | Domain filter on every kNN query |
| Completion cache | Domain-bound cache key derivation |
| Async job | Envelope re-attachment on resume |
| Tool dispatch | Gateway-target domain check |
| Sub-agent handoff | Child envelope with narrowed scope |
| Memory write | Artifact label on every persisted value |
| Graph traversal | Edge-label enforcement (no cross-domain edges) |
| Admin inspection | Physically separate plane, unreachable from runtime |

A system that implements only the first row and calls itself "domain-isolated"
is marketing, not engineering. The other seven rows are where the leakage
actually happens.

---

## How to know if you're isolated

Run the [HKI conformance kit](https://github.com/h3nok/HKI) against your stack:

```bash
npm install @hki/conformance
pnpm verify:hki-conformance  # 28 adapter cases
pnpm probe:smoke              # 10 HTTP-level probes
```

Each probe exercises a specific invariant: missing envelope, expired envelope,
global domain, wildcard domain, body-scope override, cross-domain tool, cross-org
artifact, and so on. If they all pass, you have evidence. If any fail, you have
a concrete failure mode to fix rather than a vague "we should audit this."

Domain-aware isn't isolation. Tested is isolation.
