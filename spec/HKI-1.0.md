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
AI risk frameworks. It also does not replace managed agent runtimes, agent
registries, model gateways, retrieval services, evaluation systems, or
observability platforms. HKI defines the runtime isolation invariant those
systems must preserve:

> One request, one active domain, no implicit global visibility.

## Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**,
and **MAY** are to be interpreted as described in RFC 2119.

## Non-Goals

HKI 1.0 intentionally does not define:

- an agent orchestration framework
- an identity provider, user-directory model, or IAM policy language
- a managed retrieval, vector-search, memory, evaluation, or tracing service
- an MCP, A2A, OAuth, OIDC, SPIFFE, OpenTelemetry, or Cloud Audit Logs replacement
- a sector-specific regulatory control set
- a prompt-safety, model-safety, or content-moderation taxonomy

Those systems remain responsible for their native security and governance
controls. HKI specifies the domain-isolation contract and the evidence required
to prove that runtime operations preserved it.

## Terms

| Term                     | Definition                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                   | A named runtime isolation boundary inside an organization, such as `payments`, `hr`, or `legal`. A domain is not a role, group, project, tenant, or database schema, although implementations may map it to those concepts.                                    |
| Active domain            | The single domain selected for one runtime request. Runtime visibility is based on this value only.                                                                                                                                                            |
| Authorized domains       | The set of domains the subject may select at the gateway. This set is an authorization input, not a runtime read filter.                                                                                                                                       |
| Runtime plane            | User, agent, tool, retrieval, model, memory, cache, job, and evaluation paths that operate under one active domain.                                                                                                                                            |
| Admin plane              | Separately authorized inspection and governance paths that may span domains and are not callable from runtime routes.                                                                                                                                          |
| Runtime artifact         | Any persisted or emitted value that may be reused, retrieved, audited, evaluated, cached, or shown after the current operation.                                                                                                                                |
| Publication              | An explicit workflow that creates a new target-domain artifact from source-domain material with provenance and approval evidence.                                                                                                                              |
| Managed service evidence | Correlation metadata from managed platforms, such as runtime resource names, agent identities, traces, audit-log entries, registry resources, retrieval corpus IDs, or evaluation run IDs. This metadata supports proof; it never authorizes a runtime action. |

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
- `authorized_domains` **MUST** contain only explicit, non-empty,
  non-`global`, non-wildcard domain names.
- `authorized_domains` **MUST NOT** be used as a read filter.
- `purpose`, `risk_tier`, and `policy_pack_id` **MUST** be preserved across
  downstream calls.
- The envelope **MUST** be tamper-resistant and short-lived.
- Services that accept the envelope **MUST** validate its signature, expiry,
  active-domain rules, and authorization binding before executing runtime work.
- Body, query-string, prompt, tool, or agent-supplied scope **MUST NOT**
  override the signed envelope.
- Missing or invalid envelopes **MUST** fail closed on runtime routes. A legacy
  compatibility route that does not yet require HKI **MUST NOT** claim HKI
  runtime conformance for that route.

The reference package publishes a machine-readable JSON Schema at
`@hki/runtime/schema/hki-envelope.schema.json`. The schema is a structural
contract; implementations still **MUST** enforce the rule that `active_domain`
appears in `authorized_domains`.

### Envelope Transport

Implementations **MAY** transport the envelope in HTTP headers, RPC metadata,
message metadata, session state, tool context, or job metadata. The transport is
not normative. The following rules are normative:

- every runtime hop **MUST** receive the same envelope or a gateway-verified
  child envelope with equal or narrower authorization
- every runtime hop **MUST** reject a missing, invalid, expired, broadened, or
  contradictory envelope
- asynchronous jobs **MUST** re-attach and re-validate the envelope before
  resuming runtime work
- serialized envelopes **MUST NOT** expose signing secrets or bearer tokens

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

`authorized_domains` **MUST NOT** be substituted for `active_domain` in runtime
visibility decisions. A request authorized for `payments` and `fraud` but active
in `payments` can see only `payments` runtime artifacts unless an explicit
publication workflow has created a target-domain artifact.

## Managed Platforms and Evidence

HKI is designed to compose with managed agent platforms and cloud services. A
managed platform can be HKI-conformant when it preserves the envelope and
enforces the same isolation rules across its runtime, tools, memory, retrieval,
registry, gateway, tracing, and evaluation surfaces.

Managed service identifiers **MAY** appear in evidence records, audit events, or
release manifests. Examples include:

- agent runtime or session resource names
- agent identity principals or SPIFFE IDs
- gateway, registry, MCP server, tool, or A2A task resource names
- retrieval corpus, vector index, data-store, document, chunk, and citation IDs
- evaluation dataset, case, run, and result IDs
- trace IDs, span IDs, Cloud Audit Log insert IDs, and usage audit tokens

These references are evidence metadata. They **MUST NOT** authorize a runtime
action, broaden the active domain, replace artifact labels, or weaken envelope
validation. If managed-platform policy and HKI disagree, the runtime action
**MUST** fail closed unless a separate admin-plane or publication workflow
applies.

## Subsystem Requirements

| Subsystem       | Requirement                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Gateway         | Resolve exactly one active domain, verify subject authorization, sign or bind the envelope, and attach it to runtime calls.        |
| Orchestrator    | Treat the envelope as immutable and forward it to every tool, retrieval, memory, cache, model, job, and evaluation route.          |
| Managed runtime | Preserve the envelope in run/session/tool context and emit evidence that correlates runtime resources with the envelope.           |
| Agent identity  | Bind platform agent identity and delegated user identity to audit evidence without using identity metadata as a domain override.   |
| Retrieval       | Bind search, rerank, citations, and document reads to `(org_id, active_domain)`.                                                   |
| Graph           | Label nodes and edges; traversal **MUST** reject unlabeled or different-domain edges.                                              |
| Memory          | Read and write only within `(org_id, subject_id, active_domain)`.                                                                  |
| Cache           | Include `org_id`, `active_domain`, `purpose`, `operation`, `policy_pack_id`, model/context version, and input fingerprint in keys. |
| MCP tools       | Expose only tools/resources published into the active domain; tool arguments cannot widen scope.                                   |
| Agent registry  | Store or expose target domain metadata for agents, tools, prompts, resources, and endpoints governed by HKI gateway checks.        |
| A2A agents      | Incoming and outgoing tasks **MUST** carry or be bound to an HKI envelope; delegated envelopes **MUST NOT** broaden scope.         |
| Traces          | Stamp each span/event with envelope id, org, active domain, purpose, policy pack, and risk tier.                                   |
| Ingestion       | Persist domain on jobs, source objects, chunks, embeddings, extracted entities, and review records.                                |
| Publication     | Create new target-domain artifacts with provenance; do not expose a shared wildcard object.                                        |
| Admin plane     | Use separate routes, authz, telemetry, and audit semantics for cross-domain inspection.                                            |

## Conformance Levels

| Level | Name       | Bar                                                             |
| ----- | ---------- | --------------------------------------------------------------- |
| 0     | Documented | Domain-sensitive surfaces are inventoried.                      |
| 1     | Labeled    | Runtime artifacts have non-null domain labels.                  |
| 2     | Routed     | Requests carry a signed active-domain envelope.                 |
| 3     | Enforced   | Runtime paths reject missing/global/cross-domain scope.         |
| 4     | Tested     | Automated negative tests and probes prove isolation invariants. |
| 5     | Audited    | Signed release evidence is independently reviewable.            |

### Evidence Profile Qualifiers

Conformance levels describe isolation maturity. Evidence profiles describe where
the proof was gathered:

- `smoke` — local, mock-gateway, or CI smoke evidence.
- `live` — evidence from a deployed endpoint controlled by the implementer.
- `release` — signed release evidence intended for external review.

Registries and public claims **MUST NOT** encode deployment scope into the level
name. Use the canonical level plus an evidence profile, for example
`L4-tested` with `smoke` evidence or `L4-tested` with `live` evidence.

## Required Negative Tests

An HKI-conformant release **MUST** include tests for:

- missing envelope
- expired envelope
- forged envelope
- `global` active domain
- wildcard active domain
- unsupported HKI version
- active domain absent from authorized domains
- `global` or wildcard authorized domain
- body/query/prompt/tool scope override, including aliases such as `domain`,
  `scope`, and `stream_id`
- cross-domain retrieval
- cross-domain cache reuse
- cross-domain graph traversal
- unscoped memory read/write
- MCP tool outside active domain
- MCP or tool output introducing a different-domain artifact
- A2A delegation without preserved envelope
- A2A child envelope broader than the parent envelope
- runtime route invoking admin-plane query

## Release Evidence

A release claiming HKI conformance **SHOULD** publish:

- conformance level
- evidence profile (`smoke`, `live`, or `release`)
- passing negative-test report
- artifact-label inventory
- cache-key schema
- gateway policy profile
- admin-plane route inventory
- publication workflow evidence
- trace samples with HKI attributes
- managed service evidence when the claim depends on managed runtime,
  identity, registry, gateway, retrieval, evaluation, or observability services
- machine-readable release evidence manifest with command results, component
  hashes, release-readiness blockers, and manifest hash

Release evidence **MUST** distinguish the HKI conformance level from the
evidence profile. For example, `L4-tested` describes the isolation maturity;
`smoke`, `live`, or `release` describes where the proof was gathered.
