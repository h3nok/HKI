# Scoped Agentic Routing

**Status:** Working standard
**Applies to:** Agentic BFF, orchestrator, Knowledge API, MCP Gateway, MCP Bus, memory, cache, eval, analytics
**Related:** [HKI full paper](HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md), [MCP Gateway and MCP Bus](MCP_GATEWAY_AND_BUS.md), [service boundaries](SERVICE_BOUNDARIES.md)

## Summary

Scoped Agentic Routing (SAR) is the operational form of Hermetic Knowledge
Isolation (HKI). HKI defines the isolation law. SAR defines how every agentic
request is routed, constrained, observed, evaluated, and audited under that
law.

The standard is simple:

> An agentic request is executable only after the platform resolves exactly one
> active domain and signs that domain into a short-lived runtime envelope.

The envelope is not advisory metadata. It is the routing key for knowledge,
memory, tools, models, cache, policy, telemetry, and eval.

## Runtime Contract

Every runtime request must carry these fields after edge resolution:

| Field                      | Required | Notes                                                             |
| -------------------------- | -------- | ----------------------------------------------------------------- |
| `org_id`                   | yes      | Organization or tenant boundary.                                  |
| `subject_id`               | yes      | Human, service, workflow, or agent actor.                         |
| `active_domain`            | yes      | Exactly one non-global domain for this request.                   |
| `authorized_domains`       | yes      | Domains the subject may choose from; never used as a read filter. |
| `purpose`                  | yes      | Chat, retrieval, ingest, review, publish, tool-call, eval, admin. |
| `risk_tier`                | yes      | Read-only, write, regulated, destructive, privileged.             |
| `policy_pack_id`           | yes      | Versioned policy bundle selected for the active domain.           |
| `issued_at` / `expires_at` | yes      | Short lifetime; target 30-300 seconds depending on hop.           |
| `signature`                | yes      | Signed by the routing authority.                                  |

Runtime services must reject missing, null, ambiguous, forged, expired, or
`global` active domains. Cross-domain inspection belongs to a separate admin
plane and must use a different contract.

## Routing Law

Once the active domain is selected, each subsystem derives its own routing
decision from the same envelope.

| Subsystem    | SAR decision                                                            |
| ------------ | ----------------------------------------------------------------------- |
| Knowledge    | Search only the active domain partition or exact-domain filtered index. |
| Memory       | Read and write only `(org_id, subject_id, active_domain)` memory.       |
| Tools        | Expose only tools published into the active domain.                     |
| MCP Gateway  | Enforce tool policy before each `tools/call`.                           |
| Model router | Select models by domain policy, data sensitivity, cost, and latency.    |
| Cache        | Include active domain and policy version in every key.                  |
| Eval         | Select the active domain's golden tasks and leakage tests.              |
| Trace        | Stamp every step with the scope envelope id.                            |
| Analytics    | Record domain-scoped runtime events; admin summaries stay separate.     |

The forbidden implementation pattern is any runtime query equivalent to:

```text
same_org AND (domain = active_domain OR domain IS NULL OR domain = 'global')
```

SAR permits shared enterprise knowledge only through publication or
materialization into domain-local artifacts.

## Reference Flow

1. BFF authenticates the caller.
2. Scope resolver selects one active domain or fails closed.
3. BFF signs the runtime envelope.
4. Orchestrator receives the envelope and treats it as immutable.
5. Model router chooses the model route permitted by the envelope.
6. Knowledge, memory, cache, and tool requests carry the same envelope.
7. MCP Gateway validates the envelope and filters the tool catalog.
8. Tools and adapters inject active-domain filters in backend-native form.
9. Traces, evals, and audit events include the envelope id and domain.
10. Any missing, conflicting, or widened scope stops the request.

## Implementation Rules

1. **Resolve scope deterministically.** LLMs may suggest a domain, but they do
   not authorize one.
2. **Verify locally.** Runtime services validate the signed envelope without a
   database hop on the hot path.
3. **Bind every cache key.** Cache keys include `org_id`, `active_domain`,
   operation, model route, policy version, and normalized input hash.
4. **Precompute catalogs.** Tool catalogs are filtered per domain and policy
   version ahead of hot-path tool calls.
5. **Separate admin traffic.** Admin queries use admin-plane routes, policy,
   telemetry, and audit streams.
6. **Constrain retries.** Query rewriting, corrective RAG, and tool retries
   preserve the original envelope.
7. **Prove it with tests.** Every service must have negative tests for missing,
   forged, global, and cross-domain runtime access.

## Performance Model

SAR should make scoped agentic routing faster, not slower, if the hot path is
kept local and deterministic.

Target overhead before model and backend tool latency:

| Operation                                    | Target                    |
| -------------------------------------------- | ------------------------- |
| Envelope verification                        | p95 under 2 ms in-process |
| Scope normalization and cache key derivation | p95 under 1 ms            |
| Precomputed policy/catalog lookup            | p95 under 5 ms            |
| Gateway policy decision with local bundle    | p95 under 10 ms           |
| Total SAR overhead per request path          | p95 under 25 ms           |

Design choices that keep the path fast:

- Use short-lived signed envelopes instead of per-hop authorization database
  queries.
- Compile domain policy bundles ahead of time.
- Keep tool catalogs in memory and invalidate by policy version.
- Prefer domain-partitioned indexes for high-value streams.
- Include domain in semantic cache keys to improve locality and prevent bleed.
- Benchmark scope overhead separately from LLM and backend latency.

The main performance risk is over-fragmentation: too many tiny indexes, caches,
or policy bundles can reduce hit rate and increase operational cost. Use
partitioned physical indexes for high-value or regulated domains, and shared
physical storage with exact-domain enforcement only where conformance tests
prove the boundary.

## Codebase Definition of Done

The current repo becomes SAR-ready when these conditions are true:

1. BFF request JWTs reject missing and `global` runtime scope in HKI strict
   mode.
2. Shared Python auth middleware rejects `global` runtime claims when strict
   mode is enabled.
3. Knowledge REST, MCP, AlloyDB, vector store, graph, and cache paths reject
   no-scope and global-wildcard access.
4. Ingestion jobs, review records, releases, evals, and background workflows
   carry a non-global active domain.
5. MCP Gateway is the only production route for tool calls.
6. Retail tools are real governed adapters, not inline demo tools.
7. CI includes SAR/HKI conformance tests for cross-stream retrieval, memory,
   cache, MCP tools, retries, and admin-plane separation.
8. Trace and audit events include active domain, policy pack, route, tool, and
   envelope id.

## Conformance Tests

Each service should expose black-box tests for these cases:

- Missing envelope is rejected.
- Expired envelope is rejected.
- Forged envelope is rejected.
- `global` runtime scope is rejected.
- Body-provided scope cannot override the signed envelope.
- Cross-domain retrieval returns no artifacts.
- Cross-domain cache reuse fails.
- Corrective RAG preserves scope.
- MCP tool outside the active domain is hidden or denied.
- Admin cross-domain query cannot be invoked from runtime routes.

This is the path from HKI as an architecture to SAR as an industry-standard
scoped agentic routing discipline.
