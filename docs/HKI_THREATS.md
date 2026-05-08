# HKI Threat Catalog (HKI-T01..)

> **Status:** Living document. Each threat has a runnable proof-of-concept
> under `examples/threats/<id>/` showing the **pre-HKI failure** and the
> **post-HKI block**. New threats append; do not renumber.
> Companion to [docs/HKI_CONFORMANCE.md](HKI_CONFORMANCE.md) (the positive
> tests) — this document is the **negative** test surface.

This catalog enumerates concrete, reproducible failure modes in agentic
systems that the HKI contract is designed to prevent. Each entry follows
the same format:

- **ID** — stable identifier, e.g. `HKI-T01`.
- **Surface** — which architectural layer the failure occurs on.
- **Description** — the actual failure, in one paragraph.
- **Pre-HKI demo** — runnable script showing the failure.
- **Post-HKI block** — runnable script showing HKI rejecting it.
- **Conformance link** — which `@hki/conformance` case proves the block.
- **Severity** — Low / Medium / High / Critical.

Threats are not vulnerabilities in any specific library. They are **patterns**
that occur across LangChain, LlamaIndex, ADK, AutoGen, CrewAI, raw OpenAI
SDK code, and most "domain-aware" RAG demos. The point of this catalog is
to make "easy to break" measurable.

---

## Threat index

| ID      | Title                                             | Surface           | Severity | Demo                                                    |
| ------- | ------------------------------------------------- | ----------------- | -------- | ------------------------------------------------------- |
| HKI-T01 | Semantic cache cross-domain leak                  | Cache             | Critical | [examples/threats/HKI-T01](../examples/threats/HKI-T01) |
| HKI-T02 | Body-parameter scope override                     | Runtime / API     | High     | [examples/threats/HKI-T02](../examples/threats/HKI-T02) |
| HKI-T03 | Implicit `or "global"` fallback                   | Runtime           | High     | [examples/threats/HKI-T03](../examples/threats/HKI-T03) |
| HKI-T04 | Async job loses domain on resume                  | Runtime / Jobs    | High     | [examples/threats/HKI-T04](../examples/threats/HKI-T04) |
| HKI-T05 | Vector index shared across tenants without filter | Knowledge         | Critical | [examples/threats/HKI-T05](../examples/threats/HKI-T05) |
| HKI-T06 | MCP tool registered without domain binding        | MCP Gateway       | High     | [examples/threats/HKI-T06](../examples/threats/HKI-T06) |
| HKI-T07 | A2A delegation drops envelope                     | Multi-agent       | Critical | [examples/threats/HKI-T07](../examples/threats/HKI-T07) |
| HKI-T08 | Embedding model cache key omits domain            | Cache             | Critical | [examples/threats/HKI-T08](../examples/threats/HKI-T08) |
| HKI-T09 | Admin route reachable from runtime path           | Admin / Runtime   | Critical | [examples/threats/HKI-T09](../examples/threats/HKI-T09) |
| HKI-T10 | Wildcard publication into runtime domain          | Publication       | High     | [examples/threats/HKI-T10](../examples/threats/HKI-T10) |
| HKI-T11 | Envelope replay (no `envelope_id` check)          | Edge / Auth       | High     | [examples/threats/HKI-T11](../examples/threats/HKI-T11) |
| HKI-T12 | Expired envelope accepted (clock skew abuse)      | Edge / Auth       | Medium   | [examples/threats/HKI-T12](../examples/threats/HKI-T12) |
| HKI-T13 | Envelope downgrade to older `hki_version`         | Edge / Auth       | Medium   | [examples/threats/HKI-T13](../examples/threats/HKI-T13) |
| HKI-T14 | Graph traversal crosses domain edges              | Knowledge / Graph | High     | [examples/threats/HKI-T14](../examples/threats/HKI-T14) |
| HKI-T15 | Prompt-injected scope override echoed by tool     | LLM / Tool        | High     | [examples/threats/HKI-T15](../examples/threats/HKI-T15) |

Severity rubric:

- **Critical** — direct cross-tenant or cross-domain data leak with no audit
  trail.
- **High** — leak possible under predictable conditions; produces audit log
  but defenders cannot tell from the log that a leak occurred.
- **Medium** — leak requires timing, ordering, or partial collusion.
- **Low** — leak requires multiple compounding misconfigurations.

---

## HKI-T01 — Semantic cache cross-domain leak

**Surface:** semantic / response cache.

**Description.** Most agent stacks cache LLM responses (and frequently retrieval
results) keyed only by the **prompt or query text**, optionally with the
model name. Two requests with the same query text but **different signed
domains** therefore hit the same cache entry. The second request returns
content that was assembled under the first request's domain. The LLM was
never asked. No audit log records the cross-domain read.

This is the highest-frequency failure we observe in the wild. It is silent,
cheap to exploit (just send the same prompt under a different tenant), and
invisible to most observability stacks because the cache hit short-circuits
tracing.

**Pre-HKI demo (sketch).**

```python
# examples/threats/HKI-T01/pre_hki.py
cache = {}
def respond(query: str, domain: str) -> str:
    if query in cache:                 # <-- domain not in key
        return cache[query]
    answer = llm(query)                # would call retrieval scoped by domain
    cache[query] = answer
    return answer

# Tenant A under domain=iris asks; cache stores its (domain-specific) answer.
respond("what is our return policy", domain="iris")
# Tenant B under domain=pulse asks the same thing — gets iris's answer.
respond("what is our return policy", domain="pulse")
```

**Post-HKI block.**

```python
from hki_runtime import derive_hki_cache_key

def respond(query: str, envelope) -> str:
    key = derive_hki_cache_key({
        "envelope": envelope,
        "operation": "chat.completion",
        "input": {"query": query},
    })
    if key in cache:
        return cache[key]
    answer = llm(query)
    cache[key] = answer
    return answer
```

The key now embeds `org_id`, `active_domain`, `purpose`, and
`policy_pack_id`. Replaying the same query under a different envelope
produces a distinct key and a cache miss.

**Conformance link:** HKI-C09 (cache key bound to envelope), HKI-C10
(cross-domain cache key distinctness).

---

## HKI-T02 — Body-parameter scope override

**Surface:** API / runtime entry.

**Description.** A handler accepts a `scope` (or `domain`, `stream_id`,
`active_domain`) field in the request body and uses it to filter retrieval.
The handler does this even when an HKI envelope is also present, with the
body field "winning". A caller can therefore obtain a valid envelope for
domain `iris`, then post `{ "query": "...", "scope": "pulse" }` and read
data from `pulse`.

This pattern shows up in nearly every "first version" of a multi-tenant
RAG endpoint because developers want a single endpoint that admins and
runtime users can both call.

**Pre-HKI demo.** A FastAPI endpoint that accepts both an envelope header
and a `scope` body field and prefers the body. See
`examples/threats/HKI-T02/pre_hki.py`.

**Post-HKI block.** `reject_conflicting_scope_argument(envelope, body)`
returns a non-None error string whenever any of `scope`, `domain`,
`active_domain`, `activeDomain`, `stream`, `stream_id` disagrees with
the signed envelope. The handler returns 403.

**Conformance link:** HKI-C20..C24 (scope-override cases).

---

## HKI-T03 — Implicit `or "global"` fallback

**Surface:** runtime (typically Python services or TS Drizzle queries).

**Description.** Code reads a domain from a request, session, or context
and falls back to a string literal — almost always `"global"` or `"*"` —
when it is missing or null:

```python
domain = ctx.get("active_domain") or "global"
results = repo.query(domain=domain)
```

A request that omits the envelope (or whose envelope was stripped by an
upstream proxy) silently runs **as global**, reading every domain. This is
the worst kind of failure because it looks fine in unit tests (where
`active_domain` is always set) but fails in production under a single
misrouting incident.

**Pre-HKI demo.** A repository method with `or "global"` that reads
cross-domain data when called without a signed envelope.

**Post-HKI block.**

1. `validate_envelope` rejects missing/global/wildcard at the edge — the
   request never reaches the repository.
2. `audit:hki` (the static scanner) flags the literal `or "global"` and the
   regex catches `: domain || 'global'` in TS.
3. `is_forbidden_runtime_domain()` is called inside the repository as
   defence-in-depth; raises if the domain is `global` or `*`.

**Conformance link:** HKI-C03 (fail-closed on missing domain), HKI-C04
(reject global as runtime domain).

---

## How to add a new threat

1. Pick the next ID (`HKI-T16`, etc.). Do not reuse retired IDs.
2. Add a row to the index above.
3. Add a section using the same format as `HKI-T01`.
4. Create `examples/threats/<ID>/` with at minimum:
   - `README.md` describing the threat and how to run.
   - `pre_hki.py` (or `.ts`) showing the failure.
   - `post_hki.py` (or `.ts`) showing the HKI block.
   - A test that asserts the pre-script _succeeds at the leak_ and the
     post-script _fails closed_.
5. Link the threat to the conformance case(s) that prove the block.
6. Update [docs/HKI_ROADMAP.md](HKI_ROADMAP.md) execution log.
