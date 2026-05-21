# HKI ADK-First Managed Services Plan

> Status: strategic plan. Owner: HKI maintainers. Created: 2026-05-20.
> Purpose: make HKI the audit-grade isolation standard for ADK, Gemini Enterprise
> Agent Platform, MCP, A2A, and managed AI services without rebuilding the
> platform services those ecosystems already provide.

## Positioning

HKI should not be another agent platform. HKI should be the portable runtime
contract and evidence layer that proves every agentic operation stayed inside
exactly one authorized domain.

ADK and Gemini Enterprise Agent Platform should be the first-class Google path:

- ADK owns agent construction, callbacks, tools, workflows, and local developer
  ergonomics.
- Gemini Enterprise Agent Platform owns managed runtime, sessions, memory,
  Agent Identity, Agent Gateway, Agent Registry, RAG, Vector Search, Evaluation,
  traces, metrics, and Cloud Audit Logs.
- HKI owns domain isolation semantics, envelope propagation, scoped cache keys,
  artifact visibility, tool/resource target checks, sub-agent handoff narrowing,
  and conformance evidence.

The product claim is:

> HKI is the isolation and evidence standard for agentic systems. It works with
> ADK, Gemini Enterprise Agent Platform, MCP, A2A, managed RAG/search/eval, and
> self-managed services, and proves that every agent action ran in exactly one
> authorized domain.

## Do Not Reinvent

| Capability             | Use managed/platform capability                                  | HKI role                                                                            |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Agent runtime          | ADK + Agent Platform Runtime                                     | Carry and validate the HKI envelope through agent runs and tool calls.              |
| Sessions and memory    | Agent Platform Sessions and Memory Bank                          | Bind stored state to `envelope_id`, `org_id`, and `active_domain`.                  |
| Agent identity         | Agent Identity, SPIFFE, IAM, PAB, VPC-SC                         | Correlate agent identity with HKI subject/domain proof; do not replace auth.        |
| Tool and agent catalog | Agent Registry and MCP registries                                | Normalize target metadata so HKI gateway checks work for both native and MCP tools. |
| Gateway security       | Agent Gateway, Model Armor, semantic governance                  | Add HKI envelope validation and domain-target decisions at the policy edge.         |
| RAG/search             | RAG Engine, Vector Search, Agent Search, or custom knowledge API | Preserve HKI artifact labels and exact-domain retrieval proof.                      |
| Evaluation             | Vertex AI/Gemini Evaluation Service or custom eval               | Attach HKI evidence refs and domain labels to eval datasets and results.            |
| Observability          | Cloud Audit Logs, usage audit logs, Cloud Trace/OpenTelemetry    | Correlate logs/spans with HKI envelope IDs and conformance probes.                  |

## Target Runtime Flow

```text
Identity / Gemini Enterprise / Agentic BFF
  -> mint signed HKI envelope
  -> ADK agent or Agent Platform Runtime session
  -> Agent Gateway / Agent Registry / MCP tool
  -> RAG Engine / Vector Search / custom knowledge API
  -> Cloud Logging + Cloud Trace + HKI audit event
  -> conformance evidence bundle
```

The envelope binds to platform-native evidence rather than replacing it:

- Agent Identity SPIFFE ID or Google Cloud principal
- end-user delegated identity when acting on behalf of a user
- Agent Platform Runtime resource name
- Agent Registry agent/tool/MCP resource name
- Cloud Trace trace ID and span ID
- Cloud Audit Logs `logName`, `insertId`, method name, and resource name
- RAG corpus, vector index, data store, document, chunk, and citation IDs
- A2A task ID and child envelope ID

## Standard Extensions To Specify

HKI 1.0 remains the minimal contract. Managed service support should be added as
optional evidence and correlation fields, not as a breaking envelope rewrite.

1. `platform_refs`: resource identifiers for managed runtimes, registries,
   gateways, retrieval services, and evaluation jobs.
2. `identity_refs`: Agent Identity SPIFFE ID, Google Cloud principal, delegated
   user identity, and auth model used by the call.
3. `observability_refs`: trace ID, span ID, Cloud Logging log name, audit log
   insert ID, and usage audit token when available.
4. `artifact_refs`: corpus, data store, vector index, document, chunk, citation,
   and provenance identifiers with HKI artifact labels.
5. `handoff_refs`: parent envelope ID, child envelope ID, A2A task ID, and the
   scope-narrowing decision.

These fields are evidence metadata. They must never authorize a runtime action;
authorization still flows from the signed envelope and platform IAM/policy.

## Roadmap

### P0: ADK + Agent Platform Runtime Reference

Create `examples/agent-platform-hki` with:

- ADK agent using `hki-adk` callbacks and guarded tools.
- Managed Agent Platform Runtime deployment path.
- Signed envelope supplied at session/run start.
- Tool call and retrieval call that fail closed on missing, global, wildcard,
  cross-domain, and body-scope-override inputs.
- Cloud Trace and Cloud Audit Logs correlation in emitted HKI audit evidence.
- Focused conformance command that can run against the managed runtime.

Definition of done: an adopter can deploy an ADK agent to the managed runtime and
produce an HKI evidence bundle without running the reference orchestrator pod.

### P0: Managed Evidence Profile

Extend service evidence beyond localhost/self-managed endpoints:

- Agent Platform Runtime: run/session/tool-call probes.
- Agent Gateway: denied target and scope-override probes.
- Agent Registry: tool/agent/MCP metadata domain checks.
- Gemini Enterprise: usage audit log and Cloud Audit Logs correlation.
- RAG Engine / Vector Search: domain-labeled retrieval and citation probes.
- Evaluation Service: domain-labeled eval dataset/result probes.

Definition of done: `conformance.json` can distinguish self-managed evidence from
managed-service evidence and report both without weakening HKI 1.0 rules.

### P1: Agent Identity Binding

Document and implement the mapping between HKI envelopes and Agent Identity:

- HKI `subject_id` maps to the authenticated end user or service subject.
- Agent Identity SPIFFE ID maps to the executing agent principal.
- Cloud IAM/PAB/VPC-SC enforce platform access.
- HKI validates single-domain runtime scope and emits evidence that ties the
  agent principal, user delegation, and active domain together.

Definition of done: a managed agent action is attributable to both the platform
agent identity and the HKI subject/domain in logs and conformance output.

### P1: Agent Registry + MCP Bridge

Normalize native Agent Platform tools, Agent Registry resources, and MCP tools
into one HKI target shape:

```json
{
  "kind": "tool | resource | prompt | agent | endpoint",
  "name": "inventory.lookup",
  "domain": "retail",
  "resource": "//agentregistry.googleapis.com/...",
  "published_into": []
}
```

Definition of done: `evaluateGatewayTarget` can govern native tools, MCP tools,
registered agents, and external endpoints with the same exact-domain rule.

### P1: A2A And Sub-Agent Scope Narrowing

Make nested and cross-agent work a first-class conformance surface:

- Parent agents mint child envelopes for sub-agents.
- Child envelopes must have equal or smaller `authorized_domains`.
- A2A task metadata carries the child envelope ID and parent evidence ref.
- Cross-domain handoff attempts fail closed unless explicit publication exists.

Definition of done: an A2A example proves safe handoff and denial behavior across
two domain-scoped agents.

### P2: Managed RAG Artifact Labels

Define where HKI artifact labels live in managed RAG/search systems:

- corpus/data-store metadata
- document metadata
- chunk metadata
- citation metadata
- retrieval response evidence

Definition of done: ingestion to retrieval to chat preserves `org_id`, `domain`,
artifact ID, provenance, and citation refs in both managed and custom RAG paths.

### P2: Audit Correlation Schema

Add a reusable HKI evidence reference block to audit events and conformance
output:

```json
{
  "hki_envelope_id": "...",
  "trace_id": "...",
  "span_id": "...",
  "cloud_log_name": "...",
  "cloud_audit_insert_id": "...",
  "managed_resource": "...",
  "conformance_probe_id": "..."
}
```

Definition of done: auditors can jump from an HKI denial/allow decision to the
corresponding Cloud Logging entry, Cloud Trace span, managed resource, and probe.

### P3: Public Positioning

Update public docs and examples so the adoption path is obvious:

- ADK + Gemini Enterprise Agent Platform is the recommended Google path.
- Other adapters remain portability paths, not second-class integrations.
- The reference platform demonstrates HKI, but managed services are preferred
  when they provide the runtime, identity, registry, retrieval, eval, or audit
  capability already.

Definition of done: new users understand HKI as a standard that composes with
managed platforms rather than replacing them.

## Open Decisions

| Decision                             | Options                                                | Preferred direction                                             |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------- |
| Envelope in managed sessions         | session state, request metadata, tool context          | Request metadata plus session state copy for resumability.      |
| Managed service signature validation | HKI sidecar, gateway policy hook, app callback         | Gateway policy hook when available; ADK callback fallback.      |
| RAG Engine labels                    | document metadata, chunk metadata, external side table | Store in metadata and mirror in HKI evidence store.             |
| Agent Registry domain metadata       | labels, annotations, HKI extension field               | HKI extension field plus labels for discovery.                  |
| Audit log sensitivity                | prompt/output logging on, metadata-only HKI evidence   | Metadata-only by default; opt-in prompt/output logs per policy. |

## First Implementation Slice

1. Add managed evidence schema to the conformance registry. Initial builder
   support lives in `scripts/build-conformance-registry.mjs` via
   `--managed-evidence=<path>`.
2. Build `examples/agent-platform-hki` using ADK and `hki-adk` callbacks.
3. Add a managed-runtime probe command with skip-friendly local behavior.
4. Add Agent Registry/MCP target normalization tests.
5. Publish a short adoption guide: self-managed reference platform vs. ADK
   managed runtime vs. Gemini Enterprise app.
