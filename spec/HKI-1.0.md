# HKI 1.0

**Status:** Draft standard
**Name:** Hermetic Knowledge Isolation
**Scope:** Enterprise agent runtimes, RAG systems, MCP tools, A2A agents,
memory, cache, traces, background jobs, and publication workflows

## Purpose

HKI defines the isolation contract that enterprise agents must preserve while
they retrieve knowledge, call tools, write memory, reuse caches, traverse
graphs, emit traces, and publish shared content.

HKI does not replace MCP, A2A, OAuth, OIDC, service meshes, policy engines, or
AI risk frameworks. It defines the runtime isolation invariant those systems
must preserve:

> One request, one active domain, no implicit global visibility.

## Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**,
and **MAY** are to be interpreted as described in RFC 2119.

## Core Invariants

1. Every runtime artifact **MUST** carry exactly one non-null domain label.
2. Every runtime request **MUST** execute inside exactly one active domain.
3. Runtime visibility **MUST** require exact-domain equality.
4. Missing, null, `global`, wildcard, contradictory, or unauthorized runtime
   scope **MUST** fail closed.
5. Cross-domain sharing **MUST** happen through explicit publication or
   materialization into target-domain artifacts.
6. Admin-plane cross-domain inspection **MUST NOT** be callable from runtime
   routes.

## Runtime Envelope

An HKI runtime request is executable only after the gateway resolves and signs a
scope envelope. The envelope is the routing key for retrieval, memory, tools,
models, cache, telemetry, jobs, eval, and publication.

Minimum envelope fields:

```json
{
  "hki_version": "1.0",
  "envelope_id": "env_01HX...",
  "org_id": "org_acme",
  "subject_id": "user_42",
  "active_domain": "payments",
  "authorized_domains": ["payments", "fraud"],
  "purpose": "retrieve",
  "risk_tier": "read-only",
  "policy_pack_id": "policy_2026_05",
  "issued_at": 1777900000,
  "expires_at": 1777900300,
  "issuer": "agent-gateway",
  "signature": "..."
}
```

### Envelope Rules

- `active_domain` **MUST** be present, non-empty, non-`global`,
  non-wildcard, and one value.
- `active_domain` **MUST** appear in `authorized_domains`.
- `authorized_domains` **MUST NOT** be used as a read filter.
- `purpose`, `risk_tier`, and `policy_pack_id` **MUST** be preserved across
  downstream calls.
- The envelope **MUST** be tamper-resistant and short-lived.
- Body, query-string, prompt, tool, or agent-supplied scope **MUST NOT**
  override the signed envelope.

The reference package publishes a machine-readable JSON Schema at
`@hki/runtime/schema/hki-envelope.schema.json`. The schema is a structural
contract; implementations still **MUST** enforce the rule that `active_domain`
appears in `authorized_domains`.

## Artifact Label Contract

Runtime artifacts include documents, chunks, graph nodes and edges, embeddings,
cache entries, memories, traces, tool calls, tool results, ingestion jobs,
review records, eval cases, release records, and derived outputs.

Each artifact **MUST** carry:

- `org_id`
- `domain`
- `artifact_type`
- `artifact_id`
- provenance or parent reference when derived
- lifecycle state when applicable

Artifacts with missing, null, wildcard, or `global` domain labels **MUST NOT**
be visible in the runtime plane.

The reference artifact-label schema is published at
`@hki/runtime/schema/hki-artifact-label.schema.json`.

## Runtime Visibility Rule

For request `r` and artifact `a`, runtime visibility is permitted only when:

```text
r.org_id = a.org_id
AND r.active_domain = a.domain
AND policy_allows(r.subject_id, r.purpose, a)
```

The following pattern is non-conformant in the runtime plane:

```text
same_org AND (domain = active_domain OR domain IS NULL OR domain = 'global')
```

## Subsystem Requirements

| Subsystem    | Requirement                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Gateway      | Resolve exactly one active domain and sign the envelope.                                                                           |
| Orchestrator | Treat the envelope as immutable and forward it to every tool, retrieval, memory, cache, and model route.                           |
| Retrieval    | Bind search, rerank, citations, and document reads to `(org_id, active_domain)`.                                                   |
| Graph        | Label nodes and edges; traversal **MUST** reject unlabeled or different-domain edges.                                              |
| Memory       | Read and write only within `(org_id, subject_id, active_domain)`.                                                                  |
| Cache        | Include `org_id`, `active_domain`, `purpose`, `operation`, `policy_pack_id`, model/context version, and input fingerprint in keys. |
| MCP tools    | Expose only tools/resources published into the active domain; tool arguments cannot widen scope.                                   |
| A2A agents   | Incoming and outgoing tasks **MUST** carry or be bound to an HKI envelope.                                                         |
| Traces       | Stamp each span/event with envelope id, org, active domain, purpose, policy pack, and risk tier.                                   |
| Ingestion    | Persist domain on jobs, source objects, chunks, embeddings, extracted entities, and review records.                                |
| Publication  | Create new target-domain artifacts with provenance; do not expose a shared wildcard object.                                        |
| Admin plane  | Use separate routes, authz, telemetry, and audit semantics for cross-domain inspection.                                            |

## Conformance Levels

| Level | Name       | Bar                                                            |
| ----- | ---------- | -------------------------------------------------------------- |
| 0     | Documented | Domain-sensitive surfaces are inventoried.                     |
| 1     | Labeled    | Runtime artifacts have non-null domain labels.                 |
| 2     | Routed     | Requests carry a signed active-domain envelope.                |
| 3     | Enforced   | Runtime paths reject missing/global/cross-domain scope.        |
| 4     | Tested     | Automated negative tests prove isolation invariants.           |
| 5     | Audited    | Release evidence is reproducible and independently reviewable. |

## Required Negative Tests

An HKI-conformant release **MUST** include tests for:

- missing envelope
- expired envelope
- forged envelope
- `global` active domain
- active domain absent from authorized domains
- body/query scope override
- cross-domain retrieval
- cross-domain cache reuse
- cross-domain graph traversal
- unscoped memory read/write
- MCP tool outside active domain
- A2A delegation without preserved envelope
- runtime route invoking admin-plane query

## Release Evidence

A release claiming HKI conformance **SHOULD** publish:

- conformance level
- passing negative-test report
- artifact-label inventory
- cache-key schema
- gateway policy profile
- admin-plane route inventory
- publication workflow evidence
- trace samples with HKI attributes
