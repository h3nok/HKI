# HKI Audit & Evidence Appliance

## Product Definition

The HKI Audit & Evidence Appliance is an on-prem or private-cloud audit plane for
enterprise agentic systems. It captures, normalizes, validates, and preserves
evidence that agent workflows operated inside approved domains, policies, tools,
and data boundaries.

The appliance does not replace an agent platform. It lets an enterprise keep
using ChatGPT Enterprise, Gemini, Copilot, Bedrock, Vertex, LangChain, ADK,
AutoGen, CrewAI, MCP, or internal agents while producing vendor-neutral audit
evidence.

## Positioning

Tracing answers: what happened during this run?

HKI audit evidence answers: was what happened allowed, scoped, preserved, and
provable?

| Surface      | Primary user                      | Primary purpose                                              | Evidence strength |
| ------------ | --------------------------------- | ------------------------------------------------------------ | ----------------- |
| Trace        | Engineer, SRE                     | Debug execution flow and latency                             | Operational       |
| Analytics    | Product, operations               | Understand usage and trends                                  | Business insight  |
| Audit        | Security, legal, compliance       | Prove who did what and whether it was allowed                | Evidence-grade    |
| HKI Evidence | AI governance, auditor, regulator | Prove no scope drift, global fallback, or cross-domain bleed | Conformance-grade |

The appliance sits above traces and analytics. It can ingest pointers to traces,
but it owns the evidence contract, retention posture, scope validation, and
exportable audit record.

## Buyers And Users

| Persona                        | Job to be done                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------ |
| CISO                           | Approve enterprise agent adoption without losing control over data boundaries. |
| AI governance lead             | Prove agent workflows follow domain, policy, and risk-tier rules.              |
| Platform owner                 | Give teams one audit contract across many agent stacks.                        |
| Internal auditor               | Review who did what, which data was used, and which controls passed or failed. |
| Regulated-domain product owner | Show release evidence for high-risk or customer-facing agent workflows.        |
| Developer                      | Emit standard audit events without building a custom compliance system.        |

## MVP Product Promise

For one enterprise deployment, the appliance can:

1. Ingest audit events from the reference Agentic BFF and Python services.
2. Reject evidence-grade runtime events with missing, `global`, wildcard, or
   conflicting domain scope.
3. Store append-only audit events with stable event IDs and source references.
4. Show an auditor a domain-scoped timeline of allowed, denied, escalated, and
   approved actions.
5. Export a JSON evidence bundle for an org, domain, time window, or release.
6. Link the bundle to HKI invariants and the CI evidence commands that produced
   the release claim.
7. Run inside the customer's private network or Kubernetes cluster.

## MVP Use Cases

| Use case               | Flow                                                                                     | MVP result                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Scope violation review | Auditor filters denied events for `global`, `*`, missing scope, or cross-domain attempt. | Reviewer sees actor, org, requested domain, active domain, decision, policy, and source refs. |
| Agent release review   | Release owner exports evidence for a domain before enabling an agent workflow.           | Bundle includes HKI invariant summary, commands, hashes, and event refs.                      |
| Human approval review  | Auditor inspects tool calls that required approval.                                      | Timeline links request, paused action, approval, resume decision, and tool result.            |
| Multi-platform import  | External collector emits normalized events from a non-HKI agent stack.                   | Appliance marks evidence as imported and scores which HKI fields are present or missing.      |
| Incident triage        | Security reviewer searches by user, model, tool, data source, or domain.                 | Reviewer can reconstruct the decision chain without granting runtime cross-domain access.     |

## MVP Features

| Feature                     | Description                                                                                                    | Status target                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `hki.audit.event.v1` schema | Canonical event shape for prompt, retrieval, tool, approval, denial, output, publication, and evidence export. | MVP                                                   |
| Scope-safe ingestion        | Evidence-grade events fail closed when active domain is missing, `global`, `*`, or mismatched.                 | MVP                                                   |
| Event normalization         | Collectors map platform-specific logs into the canonical event schema.                                         | MVP for reference app, preview for external platforms |
| Append-only event store     | Events are stored with IDs, timestamps, source refs, and payload hashes.                                       | MVP                                                   |
| Tamper-evidence manifest    | Evidence bundles include content hashes and command/source metadata.                                           | MVP                                                   |
| Auditor workspace           | Admin UI for timeline, filters, denied attempts, approval events, and export readiness.                        | MVP                                                   |
| Evidence bundle export      | JSON bundle for org/domain/time window/release.                                                                | MVP                                                   |
| On-prem deployment profile  | Kubernetes deployment docs for storage, secrets, retention, collectors, and network boundaries.                | MVP                                                   |
| External collectors         | OpenAI/Gemini/Bedrock/custom-agent collector interface.                                                        | Preview                                               |
| Compliance mapping          | HKI invariants mapped to SOC 2, ISO 27001, ISO 42001, NIST AI RMF, and sector profiles.                        | Preview                                               |

## Canonical Event Shape

The TypeScript runtime exports `HKI_AUDIT_EVENT_SCHEMA`, `validateAuditEvent`,
and `auditBoundaryFromEnvelope` from `@hki/runtime`. The Python runtime exports
`HKI_AUDIT_EVENT_SCHEMA`, `validate_audit_event`, and
`audit_boundary_from_envelope` from `hki_runtime`. The TypeScript package also
exports the JSON Schema at
`@hki/runtime/schema/hki-audit-event.schema.json`.

The analytics service accepts native HKI audit events at `POST /v1/events/audit`
and validates Pub/Sub events sent to `POST /v1/events/ingest` whenever the event
payload carries the `schema` field. Valid events are normalized into the scoped
event store only after validation succeeds. Recent audit reads are available
through an authenticated scoped query path used by the BFF admin plane.

The reference `knowledge-api` emits a native `retrieval.search` audit event for
scoped search requests while preserving its legacy `kb.search` analytics metric.
The `orchestrator-service` emits native `agent.chat` audit events for completed
chat turns and denied input guardrail decisions using metadata-only evidence.
These give the MVP reference producer-to-ingestion paths for evidence-grade
retrieval and agent runtime activity.

Evidence bundles can be generated with `pnpm evidence:hki-bundle -- --events
<exported-events.json> --org <org-id> --domain <domain-id>`. The bundle includes
event source hashes, source references, invariant counts, service evidence,
conformance registry metadata, and a manifest hash.

The Agentic BFF exposes an auditor workspace at `/admin/audit`. It requires a
named domain, proxies the scoped analytics timeline through
`governance.auditTimeline`, shows allowed/denied/runtime decisions, and exports
the native audit events as JSON for the bundle builder.

The MVP event contract should be strict for evidence-grade runtime events and
lenient only for imported external traces that are marked as partial evidence.

```json
{
  "schema": "hki.audit.event.v1",
  "event_id": "uuid",
  "occurred_at": "2026-05-16T00:00:00.000Z",
  "received_at": "2026-05-16T00:00:01.000Z",
  "source": {
    "platform": "agentic-bff",
    "service": "agentic",
    "environment": "production",
    "collector": "native"
  },
  "actor": {
    "subject_id": "user:42",
    "email_hash": "sha256:...",
    "role": "manager"
  },
  "boundary": {
    "org_id": "acme",
    "active_domain": "payments",
    "authorized_domains": ["payments"],
    "policy_pack_id": "payments@2026-05",
    "risk_tier": "regulated"
  },
  "operation": {
    "type": "tool.call",
    "name": "refund_lookup",
    "target_domain": "payments",
    "purpose": "support"
  },
  "decision": {
    "outcome": "allow",
    "reason": "active-domain-match",
    "requires_human_approval": false
  },
  "evidence": {
    "trace_id": "trace-123",
    "request_id": "req-123",
    "payload_hash": "sha256:...",
    "payload_ref": "encrypted://...",
    "redaction_profile": "metadata-only"
  }
}
```

Required fail-closed rules for native HKI events:

- `boundary.active_domain` must be present.
- `boundary.active_domain` must not be `global`, `*`, empty, or null.
- `boundary.active_domain` must appear in `boundary.authorized_domains`.
- `operation.target_domain`, when present, must match the active domain unless
  the event is an explicit admin-plane or publication event.
- Body, query, or payload scope cannot override the signed boundary.
- Runtime events and admin-plane events must be marked separately.

## Architecture

```text
Agent platforms and services
  -> collectors and native SDK hooks
  -> audit ingestion API
  -> schema validation and HKI invariant checks
  -> append-only event store
  -> auditor workspace and evidence export
  -> release/conformance bundle
```

Reference implementation mapping:

- Native BFF and admin audit actions live in [apps/agentic/server/admin.ts](../apps/agentic/server/admin.ts).
- The auditor workspace lives in [apps/agentic/client/src/pages/admin/AuditPage.tsx](../apps/agentic/client/src/pages/admin/AuditPage.tsx).
- The BFF scoped audit proxy is `governance.auditTimeline` in [apps/agentic/server/governance.ts](../apps/agentic/server/governance.ts).
- BFF audit records are stored in the `auditLog` table defined in [apps/agentic/drizzle/schema.ts](../apps/agentic/drizzle/schema.ts).
- Runtime analytics and usage events flow through [services/analytics-service](../services/analytics-service).
- Service evidence bundles are produced by [scripts/hki-service-evidence.mjs](../scripts/hki-service-evidence.mjs).
- Conformance release evidence is produced by [scripts/build-conformance-registry.mjs](../scripts/build-conformance-registry.mjs).
- Admin governance UI is under [apps/agentic/client/src/pages/admin](../apps/agentic/client/src/pages/admin).

## Deployment Modes

| Mode                              | Description                                                          | MVP support |
| --------------------------------- | -------------------------------------------------------------------- | ----------- |
| Private Kubernetes                | Appliance runs in the customer's cluster beside agent workloads.     | Yes         |
| Private cloud managed by customer | Uses customer-owned database, object storage, and keys.              | Yes         |
| Air-gapped                        | Offline bundle import/export with no external calls.                 | Planned     |
| SaaS control plane                | Optional hosted view that stores only metadata or encrypted bundles. | Later       |

Storage should support customer-owned backends such as BigQuery, Snowflake, S3,
MinIO, Postgres, or object storage with signed manifests. The default reference
path can use the existing analytics service plus object-store bundle export.

## Trust Guarantees

The MVP should guarantee:

- Evidence-grade events are scoped before persistence.
- Raw prompts and documents are not stored by default.
- Payload hashes and encrypted refs allow later reconstruction by authorized
  teams without centralizing sensitive content.
- Bundle manifests include hashes, source commands, component versions, and
  generation time.
- Audit queries are admin-plane only and do not weaken runtime isolation.

Later hardening should add hash chains, key rotation, WORM storage integration,
legal hold, and external attestation.

## Non-Goals

- Do not become a SIEM replacement.
- Do not replace Langfuse, OpenTelemetry, Datadog, or cloud-native traces.
- Do not require enterprises to replace their agent platforms.
- Do not make audit easier by adding cross-domain runtime reads.
- Do not store full prompt/output payloads by default.

## MVP Success Metrics

| Metric                          | Target                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Evidence-grade event validation | 100 percent rejection of missing, `global`, wildcard, and mismatched domain events |
| Bundle generation               | One command exports a bundle for org/domain/time window/release                    |
| Auditor workflow                | Reviewer can find a denied scope attempt and export evidence in under 5 minutes    |
| Deployment                      | Appliance can run in local/private Kubernetes with customer-owned storage          |
| Partner readiness               | One design partner can map their agent platform logs into `hki.audit.event.v1`     |

## First Build Slice

1. Add the product brief and release plan.
2. Define the `hki.audit.event.v1` schema and examples.
3. Harden analytics/audit ingestion to reject evidence-grade events with missing,
   `global`, wildcard, or mismatched runtime scope.
4. Add an evidence bundle builder for scoped event exports.
5. Add an `/admin/audit` workspace backed by the canonical event model.
6. Document the private Kubernetes deployment profile and external collector API.
