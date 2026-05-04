# Knowledge Base MVP — Release Note

> Status: initial MVP deployed; enterprise hardening in progress
> Last updated: April 2026

## What Was Built

A self-service, multi-tenant Knowledge Base platform for internal value streams.

Each value stream operates as its own tenant - isolated data, isolated agent
behavior, isolated retrieval - all running on shared infrastructure. A platform
admin can provision a team's KB workspace, upload and publish content, and have
Agentic answer questions grounded in that content, without any engineering
involvement.

The MVP proves the full gold path end-to-end across that tenant model. QA,
enterprise-scale validation, and deeper enforcement hardening remain in flight.

---

## For Everyone — What Is Live

Any value stream manager can now:

1. Provision a Knowledge Base workspace for their team
2. Upload documents into their team's KB
3. See quality and PII signals on content before submitting it
4. Submit documents into a review and approval flow
5. Approve and publish documents to make them retrievable
6. Track document and job status in the workspace
7. Invite knowledge curators to manage content without granting them broader platform access
8. Run retrieval tests and inspect citations before going live
9. Ask Agentic a question and get an answer grounded in their team's published content, with citations back to the source

Each team's content is designed around strict stream isolation. The current
release proves the scoped gold path, and the SAR/HKI hardening work is closing
remaining runtime and storage enforcement gaps before broad enterprise rollout.

---

## What Is Not In This Release

Deliberately out of scope for the MVP — next-phase work:

- Google Drive sync and enterprise connectors
- URL crawl and text-paste ingest
- Cross-stream knowledge sharing
- Collections, taxonomy, and graph views as end-user workflows
- Full compliance and access governance surfaces
- Contradiction detection and shadow-index comparison
- Advanced retrieval patterns (CRAG, RAPTOR, adaptive routing, graph summarization)

---

## For Technical Audiences — What Was Built

### Platform Design

This is a multi-tenant internal SaaS system. The key design decisions:

**Tenant model** — each value stream is a tenant. Tenancy is expressed as
`org_id` (the organisation) + `stream_id` (the domain within it). Every
persistent artifact — documents, chunks, vector embeddings, graph edges,
agent config, collections, job state, audit events — carries both identifiers.

**Three-layer isolation** — tenant boundaries are designed to be enforced
independently at three layers so that a bug in one layer does not produce a data
leak:

1. JWT scope enforcement at the request boundary (Agentic BFF issues short-lived HS256 JWTs carrying `org_id` and `scope`; every downstream service validates them before accepting any work)
2. Application-level filtering in every service (queries are always injected with `org_id` and `stream_id` derived from the verified JWT, never from the client payload)
3. PostgreSQL Row-Level Security on AlloyDB (database enforces `org_id = current_setting('app.current_org_id')` as a backstop even if application code has a bug)

**Fail-closed scoping** — ambiguous, missing, or `global` runtime scope is being
hardened to fail closed instead of widening to a larger data set. The current
SAR/HKI enforcement slice rejects invalid downstream request scope when
`KB_HERMETIC_ISOLATION=true`; store adapters, ingestion/review paths, and MCP
enforcement remain part of the next hardening slice.

**Self-service provisioning** — stream setup is fully DB-driven, not
code-driven. A manager creates a stream, configures the agent persona,
retrieval strategy, and guardrails, invites curators, and starts uploading
content. No engineering intervention is required.

**Per-stream agent configuration** — each stream owns its system prompt,
enabled tools, retrieval strategy, chunking policy, knowledge collections,
and optional token budget. The orchestrator loads this config at request time
and preserves the stream scope across every tool call in an agent loop.

---

### Deployed Services (GKE, Shared AI Platform)

| Service                   | Role                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| Agentic BFF               | Experience layer; Google SSO, JWT issuance, stream routing        |
| Orchestrator              | Agent runtime; ReAct loop, tool dispatch, scope-preserving        |
| Knowledge API             | MCP-native retrieval service; scoped vector search                |
| Ingestion Pipeline API    | File upload entrypoint; job creation and status                   |
| Ingestion Pipeline Worker | Document processing, chunking, embedding, and indexing            |
| GCS                       | Durable artifact storage; source capture for replay               |
| Pub/Sub                   | Durable async queue between API and worker; DLQ backed            |
| Redis                     | Job state, session, short-lived cache; keyed by org + stream      |
| AlloyDB + pgvector        | Document metadata, vector index, RLS-enforced tenant partitioning |

---

### Request Flow (How Multi-Tenancy Works At Runtime)

```
User logs in via Google SSO
  → BFF derives org_id from Google domain (hd claim)
  → BFF identifies active stream from user session
  → BFF issues JWT: { org_id, scope: "pharmacy", scopes: [...], role }

User asks a question
  → BFF routes to Orchestrator with JWT attached
  → Orchestrator verifies JWT, loads pharmacy stream config
  → Orchestrator calls Knowledge API with JWT still in context
  → Knowledge API verifies JWT, runs vector search filtered by org_id + stream_id
  → AlloyDB RLS is the target database backstop for org_id enforcement
  → Results are expected to remain pharmacy-scoped throughout the request
  → LLM generates answer with grounded citations
  → Audit event logged with org_id + domain + user_id
```

---

## What Still Needs To Be Proven For Enterprise Scale

The MVP proves the gold path for the platform's multi-tenant model. Moving to
full enterprise-wide operation requires proving the following in production-like
conditions:

### Strict HVSI at scale

- Strict-mode audits can block rollout when scoped data hygiene is broken across multiple streams simultaneously
- No runtime path widens scope to global or wildcard under load or partial failure

### Eval-backed promotion

- Document promotion is backed by maintained evaluation suites per stream
- Retrieval and grounding regressions are measured before broader release
- Advanced retrieval features are gated by measured improvement, not preference

### Lineage, freshness, and publication

- Published content shows source lineage, supersession, and freshness state
- Stale and pending-review content are clearly distinguished from live content
- Rollback and replacement are visible and operator-credible across all streams

### Connector onboarding

- At least one enterprise connector runs in controlled beta with explicit stream ownership
- Deletion, resync, and rollback semantics are defined before expansion
- Connector ingestion does not weaken review, lineage, or isolation guarantees

### Admin-plane governance

- Admins can inspect rollout health and inventory across all tenants
- Admin-plane queries are separated from runtime knowledge queries
- Rollout posture is controlled by release gates, not ad hoc flags

### Production-grade operating controls

- Queue semantics survive worker restart, pod loss, and partial failure
- Failure states are stage-aware, observable, and support honest remediation
- Ingest health, publish throughput, freshness, citation quality, and service health are all operator-visible across tenants

### The enterprise bar

The platform is ready for enterprise-wide operation when it can support multiple
streams concurrently under the same operating rules — without weakening
isolation, without skipping evaluation, and without requiring manual operator
intervention to keep knowledge release safe.

---

## Target Architecture Direction

The MVP is consistent with the target architecture. The control planes are next-phase:

- **HVSI / hermetic stream isolation** — foundational contract, enforced first at runtime auth and expanding through stores/tools
- **AI Gateway** — model control plane (next phase)
- **MCP Gateway + MCP Bus** — tool control plane (next phase)
- **GKE-first runtime** — deployed now; selective alternate substrates where justified

---

## Communication Positioning

When speaking to EA or partner teams, describe the current KB as an initial,
curated, stream-scoped MVP rather than the full enterprise end state.

Practical rule: if someone asks what is deployed today, answer with the manager
gold path. If someone asks about architecture direction, answer with the
end-state architecture and HVSI model. Do not collapse those into one answer.

---

## Related Docs

- [AI Platform README](../README.md)
- [AI Platform Architecture](./ARCHITECTURE.md)
- [Knowledge API README](../knowledge-api/README.md)
- [Ingestion Pipeline Service README](../ingestion-pipeline-service/README.md)
- [Agentic BFF README](../agentic/README.md)
- [KB MVP Cutline](../agentic/docs/KNOWLEDGE-MVP-CUTLINE.md)
- [KB File Upload E2E QA Plan](./KB_FILE_UPLOAD_E2E_QA_PLAN.md)
- [Hermetic Value Stream Isolation](../agentic/docs/HERMETIC-VALUE-STREAM-ISOLATION.md)
- [Scoped Agentic Routing](./SCOPED_AGENTIC_ROUTING.md)
- [MCP Gateway and MCP Bus](./MCP_GATEWAY_AND_BUS.md)
