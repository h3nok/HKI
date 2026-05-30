# HKI Implementation & Development Roadmap

> **Status:** Living document. Owner: Henok Ghebrechristos. Last revised: 2026-05-06.
> Update this file whenever a milestone moves, a track is added, or an architectural
> decision is recorded. Do not delete entries — strike them and link to the
> superseding decision instead.

This document is the single source of truth for **what HKI is, what we are
building, in what order, and what "done" looks like at each step**. It exists
alongside (and reconciles) the following companion documents:

- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — current system architecture of the
  reference platform.
- [docs/HKI_CONFORMANCE.md](HKI_CONFORMANCE.md) — definition of conformance
  Levels 0–5 and the evidence required at each level.
- [docs/HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md](HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md) —
  ADK-first managed-services plan for Gemini Enterprise Agent Platform, Agent
  Identity, Agent Registry, Agent Gateway, managed RAG/search/eval, and audit evidence.
- [docs/HKI_PUBLIC_READINESS_PLAN.md](HKI_PUBLIC_READINESS_PLAN.md) — earlier
  5-phase public-rollout plan; this roadmap supersedes its sequencing.
- [docs/HKI_SECURITY_MAPPING.md](HKI_SECURITY_MAPPING.md) — mapping to MCP, A2A,
  OWASP LLM Top 10, NIST AI RMF.
- [docs/PLATFORM_AUDIT.md](PLATFORM_AUDIT.md) — audit of the reference platform.
- [docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md](HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md) —
  the published specification paper.

---

## 0. Strategic framing

We ship **two things** out of this repository, and we keep them mentally separate:

1. **The HKI standard** — a small, vendor-neutral runtime contract for
   agentic systems. Falsifiable. Testable. Portable.
2. **The reference platform** — an opinionated, GCP-first agentic stack
   (BFF + 4 Python services) that demonstrates the standard in production.

The standard is the product. The reference platform exists to make the standard
credible. They have different audiences, different release cadences, and
eventually different repositories. Confusing the two is the single largest
failure mode of this project.

### ADK-first managed-services posture

For Google Cloud adopters, HKI should be **ADK-first, not ADK-only**. ADK and
Gemini Enterprise Agent Platform should provide the agent runtime, managed
sessions, memory, Agent Identity, Agent Gateway, Agent Registry, managed
RAG/search/eval, traces, metrics, and Cloud Audit Logs. HKI should provide the
portable isolation contract and conformance evidence that proves those managed
services preserved one active domain per runtime operation. The detailed plan is
tracked in [docs/HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md](HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md).

### The contract, in one paragraph

> Every runtime request carries exactly one signed HKI envelope describing one
> active domain. Every artifact, cache key, tool call, retrieval, memory write,
> and gateway target is bound to that domain by exact equality. Cross-domain
> visibility exists only through explicit, audited publication. The runtime
> fails closed on missing, expired, global, wildcard, or mismatched domains.
> Admin and governance flows do not flow through the runtime path.

If a system cannot be tested against that paragraph, it is not HKI.

---

## 1. Current state (as of 2026-05-06)

### 1.1 What works today

| Surface                              | Status                                                                            | Evidence                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| TypeScript runtime (`@hki/runtime`)  | ✅ shipping, v0.1.0, MIT                                                          | [packages/hki-runtime](../packages/hki-runtime)                           |
| Python runtime (`hki-runtime`)       | ✅ shipping, v0.1.0, MIT, 608 LOC, 208 LOC tests                                  | [packages/hki-runtime-py](../packages/hki-runtime-py)                     |
| Conformance kit (`@hki/conformance`) | ✅ 28 cases (HKI-C01..C28)                                                        | [packages/hki-conformance](../packages/hki-conformance)                   |
| Static audit (`pnpm audit:hki`)      | ✅ 0 findings                                                                     | [scripts/audit-hki-conformance.mjs](../scripts/audit-hki-conformance.mjs) |
| Envelope JSON schema                 | ✅ frozen at `hki/1.0`                                                            | [packages/hki-runtime/schema](../packages/hki-runtime/schema)             |
| Reference BFF (`@hki/agentic`)       | ✅ Node 24 + tRPC + React 19 + MySQL 8                                            | [apps/agentic](../apps/agentic)                                           |
| Reference orchestrator               | ✅ FastAPI + Google ADK + LiteLLM                                                 | [orchestrator-service](../orchestrator-service)                           |
| Reference knowledge API              | ✅ FastAPI + pgvector + Neo4j + MCP                                               | [knowledge-api](../knowledge-api)                                         |
| Reference ingestion                  | ✅ FastAPI + Pub/Sub + RAPTOR + Document AI                                       | [ingestion-pipeline-service](../ingestion-pipeline-service)               |
| Reference analytics                  | ✅ FastAPI + BigQuery                                                             | [analytics-service](../analytics-service)                                 |
| Local dev stack                      | ✅ Docker Compose (MySQL, Redis, pgvector, Neo4j, LiteLLM, Pub/Sub emu, Langfuse) | [docker-compose](../docker-compose)                                       |
| Security mapping                     | ✅ MCP, A2A, OWASP LLM Top 10, NIST AI RMF                                        | [docs/HKI_SECURITY_MAPPING.md](HKI_SECURITY_MAPPING.md)                   |
| Published spec                       | ✅ paper + executive brief                                                        | [docs/HKI-package](HKI-package)                                           |

### 1.2 What is missing or weak

| Gap                                                           | Severity           | Tracked in                                                                            |
| ------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| ~~FastAPI middleware for `hki-runtime` (Python)~~             | ~~High~~           | ~~Track 1 / M2~~ — ✅ Done                                                            |
| ~~Python conformance kit (only TS today)~~                    | ~~High~~           | ~~Track 1 / M2~~ — ✅ Done                                                            |
| ~~Threat catalog with runnable attacks~~                      | ~~High~~           | ~~Track 2 / M5~~ — ✅ Done                                                            |
| ~~Black-box HTTP-level conformance probe (`hki probe`)~~      | ~~High~~           | ~~Track 2 / M7~~ — ✅ Done                                                            |
| Adapter ecosystem (LiteLLM, LangChain, vector stores)         | High               | Track 3 / M5                                                                          |
| ADK + Gemini Enterprise Agent Platform managed evidence path  | High               | [docs/HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md](HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md) |
| Non-GCP cloud reference (AWS, Azure)                          | Medium             | Track 3 / M6                                                                          |
| ~~`@hki/sdk` is too thin (3 files) to be a real front door~~  | ~~Medium~~         | ~~Track 1~~ — ✅ Done (M3/M4)                                                         |
| `@hki/ui` carries 612 token-audit findings                    | Medium             | Track 4                                                                               |
| BFF doc says PostgreSQL, code uses MySQL                      | Low                | Track 4                                                                               |
| `services/` directory exists but is empty                     | Low                | Track 4                                                                               |
| Spec packages live in same repo as enterprise reference app   | High (positioning) | Track 4 / M1                                                                          |
| No external design partners; no third-party conformance claim | High (credibility) | Track 5                                                                               |

---

## 2. End-state architecture (target, not current)

This section describes the system we are building toward across all tracks.
The current system is a subset of this; deviations are tracked in
[docs/PLATFORM_AUDIT.md](PLATFORM_AUDIT.md).

### 2.1 Layered architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Experience Plane                                                        │
│   - Chat UI, admin UI, KB self-service UI                               │
│   - Identity (Google, Okta, Auth0, Entra ID, Keycloak)                  │
│   - Issues runtime requests; never sees admin data on a runtime path    │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼  signed HKI envelope (hki/1.0)
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent Runtime Plane                                                     │
│   - BFF (Node + tRPC) and/or FastAPI gateways                           │
│   - Envelope minted here from session+policy, signed, attached          │
│   - One active_domain per request, exact-equality enforcement           │
│   - HKI middleware (TS or Python) intercepts every outbound call        │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ AI Gateway Plane (LLM + tool routing)                                   │
│   - LiteLLM (current) with `hki-litellm` callback                       │
│   - Or: direct provider SDKs wrapped by HKI client adapters             │
│   - Targets: OpenAI, Anthropic, Vertex/Gemini, Bedrock, Azure OpenAI,   │
│     Cohere, Mistral, Groq, Together, Fireworks, OpenRouter, vLLM,       │
│     Ollama, LM Studio                                                   │
│   - Decision: target.domain ⊆ envelope.active_domain ∪ published_into   │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MCP Gateway + Bus                                                       │
│   - MCP servers wrapped by `hki-mcp` middleware                         │
│   - Tool, resource, prompt registries are domain-bound                  │
│   - A2A delegations carry envelope; receiver re-validates               │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Knowledge / Data Plane                                                  │
│   - Vector: pgvector (current), Pinecone, Weaviate, Qdrant, Milvus,     │
│     Chroma, OpenSearch, Elasticsearch, MongoDB Atlas, Azure AI Search   │
│   - Graph: Neo4j (current), TigerGraph, Neptune                         │
│   - Cache: Redis (current), Upstash, Memcached                          │
│   - Object: GCS (current), S3, Azure Blob, MinIO                        │
│   - Stream: Pub/Sub (current), SQS/SNS, EventBridge, Service Bus, Kafka │
│   - All reads filter by exact domain; all writes label with domain      │
└─────────────────────────────────────────────────────────────────────────┘

                  ┌──────────────────────────────────────┐
                  │ Admin / Governance Plane (separate)  │
                  │ - Catalog, policy, eval, spend, audit│
                  │ - Cross-domain inspection allowed    │
                  │ - Never reachable from runtime code  │
                  └──────────────────────────────────────┘

                  ┌──────────────────────────────────────┐
                  │ Observability Plane                  │
                  │ - OpenTelemetry (canonical)          │
                  │ - Langfuse, Arize Phoenix, Helicone, │
                  │   LangSmith, W&B Weave, Datadog, etc.│
                  │ - All spans carry hki.* attributes    │
                  └──────────────────────────────────────┘
```

### 2.2 Seven runtime invariants (non-negotiable)

These are the rules every conforming implementation must enforce. They are
echoed in [docs/HKI_CONFORMANCE.md](HKI_CONFORMANCE.md) and tested by
`@hki/conformance`.

1. **One active domain per request.** No global, no wildcard, no nullable.
2. **Signed envelope at the edge.** Validated on every cross-process hop.
3. **Exact-equality reads.** No prefix, no glob, no implicit fallback.
4. **Domain-bound cache keys.** `org_id` and `active_domain` are part of every
   cache, memo, and embedding key.
5. **Gateway domain check.** Every tool, model, retriever, and memory target
   is allowed only if its domain matches the active domain or is explicitly
   published into it.
6. **Scope arguments cannot override the envelope.** Body/query parameters
   that disagree with the signed envelope cause a hard reject.
7. **Admin paths are physically separate.** Runtime code cannot import from
   admin/governance modules.

### 2.3 Envelope schema (`hki/1.0`)

Canonical: [packages/hki-runtime/schema/hki-envelope.schema.json](../packages/hki-runtime/schema/hki-envelope.schema.json).

```json
{
  "hki_version": "1.0",
  "envelope_id": "uuid-v4",
  "org_id": "acme",
  "subject_id": "user:42",
  "active_domain": "iris",
  "authorized_domains": ["iris", "pulse"],
  "purpose": "retrieve | chat | ingest | review | publish | tool-call | memory | cache | eval | admin",
  "risk_tier": "read-only | write | regulated | destructive | privileged",
  "policy_pack_id": "iris@2026-04",
  "issued_at": 1714867200,
  "expires_at": 1714870800,
  "issuer": "agentic-bff@hki.example",
  "signature": "ed25519:<base64>"
}
```

`active_domain` MUST be present, MUST appear in `authorized_domains`, MUST NOT
be `global` or `*`. The schema is frozen at `hki/1.0` and will not change
incompatibly without a major-version bump.

### 2.4 OpenTelemetry semantic conventions for HKI

Every span on a runtime path SHOULD carry:

| Attribute            | Type   | Required    | Notes                                       |
| -------------------- | ------ | ----------- | ------------------------------------------- |
| `hki.version`        | string | yes         | always `1.0` for this spec                  |
| `hki.envelope_id`    | string | yes         | uuid; lets traces correlate to audit log    |
| `hki.org_id`         | string | yes         | tenant boundary                             |
| `hki.active_domain`  | string | yes         | exact domain enforced for this request      |
| `hki.subject_id`     | string | yes         | end-user identity                           |
| `hki.purpose`        | string | yes         | one of the purpose enum                     |
| `hki.risk_tier`      | string | yes         | one of the risk-tier enum                   |
| `hki.policy_pack_id` | string | yes         | governance policy version                   |
| `hki.issuer`         | string | yes         | who signed the envelope                     |
| `hki.decision`       | string | conditional | `allow` / `deny:<reason>` for gateway spans |

The TS runtime exports `applyHkiTraceAttributes(span, envelope)`; the Python
runtime exports `apply_hki_trace_attributes(span, envelope)`.

---

## 3. Tracks

The plan is organised as **5 parallel tracks**. Tracks are not phases; they
run concurrently with their own milestones. Each milestone has explicit
**Definition of Done (DoD)** so progress is testable, not narrative.

### Track 1 — Sharpen the standard

Goal: HKI is independently installable, testable, and citable, in TS and Python.

| ID   | Title                  | DoD                                                                                                                                                                                                                       |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1   | Decouple repos         | Spec packages (`@hki/runtime`, `hki-runtime` py, `@hki/conformance`, `@hki/sdk`, schema, paper) live in a public `hki-spec/hki` repo; reference platform stays here; cross-links updated.                                 |
| M2   | Python parity          | `hki-runtime` (py) ships FastAPI middleware + Starlette decorator; Python conformance package mirrors all 28 cases; `pytest` is green; `uv` lockfile committed.                                                           |
| M2.1 | FastAPI middleware     | ✅ Done — `hki_runtime.fastapi.HkiMiddleware` enforces envelope on every request; rejects missing/expired/global/wildcard with 401/403; binds envelope into `request.state.hki`.                                          |
| M2.2 | Python conformance kit | ✅ Done — `hki-conformance` (py) in `packages/hki-conformance-py`; 28 parametrized pytest cases + `hki-conformance` CLI with `--min-level` and JSON output; L4 reported; wired to CI.                                     |
| M3   | SDK as front door      | ✅ Done — `@hki/sdk/client` exports `mintEnvelope`, `verifyEnvelope`, `wrap`, `envelopeHeaders`, `withDomain`; Python: `hki_runtime.client` mirrors all five; 17 TS + 16 Py tests pass.                                   |
| M4   | Schema freeze          | ✅ Done — Zod schemas (`HkiEnvelopeSchema`, `HkiArtifactLabelSchema`, `HkiGatewayTargetSchema`) in `@hki/sdk/schema`; Pydantic v2 models in `hki_runtime.pydantic`; 17 Zod + 19 Pydantic backward-compat tests committed. |

### Track 2 — Detector product

Goal: an external team can prove their system is or is not HKI-conformant
without reading our code.

| ID  | Title               | DoD                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5  | Threat catalog v1   | ✅ Done — 15/15 threat cases (HKI-T01..HKI-T15) in `docs/HKI_THREATS.md`; all fully runnable under `examples/threats/`; 35 pytest cases pass; wired to `pnpm test:hki-threats` in CI.                                                                                                                                                                                                          |
| M6  | AST scanner upgrade | ✅ Done — TS AST audit (`scripts/hki-ast-audit-ts.mjs`) + Python libcst audit (`scripts/hki_ast_audit.py`); surface-aware (public/internal/MCP); 0 blocking findings; both wired to CI and included in `conformance.json`.                                                                                                                                                                     |
| M7  | `hki probe` CLI     | ✅ Done — `hki-probe` (10 HTTP probes P01–P10) ships in `@hki/conformance`. `mock-gateway.mjs` enables `pnpm probe:smoke` (10/10 PASS locally and in CI). `services/hki-probe-target/` is a deployable FastAPI + HkiMiddleware service for Cloud Run. `probe-smoke` is a required CI gate (`hki-gate`). `probe-deploy.yml` builds + deploys to Cloud Run and uploads a signed evidence bundle. |
| M8  | GitHub Action       | ✅ Done — `packages/hki-conformance-action` composite action with `min-level` enforcement, optional probe-url, evidence-artifact upload; `hki-action-selftest` workflow validates it against this repo.                                                                                                                                                                                        |
| M9  | Evidence registry   | ✅ Done — `scripts/build-conformance-registry.mjs` + `pnpm registry:build` emit `conformance.json` (schema v1: implementation, packages, conformance results, audit baseline, threat catalog, computed level L0..L4); CI uploads as artifact.                                                                                                                                                  |

### Track 3 — Provider, framework, store, and cloud integrations

Goal: HKI works alongside the choices teams already made.

#### 3.A LLM providers (via `hki-litellm` first)

| Provider                                                            | Adapter                | Status          |
| ------------------------------------------------------------------- | ---------------------- | --------------- |
| LiteLLM (covers most)                                               | `hki-litellm` callback | Planned (M10)   |
| OpenAI / Azure OpenAI                                               | direct + via LiteLLM   | Planned         |
| Anthropic                                                           | direct + via LiteLLM   | Planned         |
| Google Vertex / Gemini                                              | via LiteLLM (current)  | Done (informal) |
| AWS Bedrock                                                         | direct + via LiteLLM   | Planned         |
| Cohere                                                              | via LiteLLM            | Planned         |
| Mistral / Together / Groq / Fireworks / OpenRouter / DeepSeek / xAI | via LiteLLM            | Planned         |
| Ollama / vLLM / LM Studio                                           | self-hosted adapter    | Planned         |

#### 3.B Agent frameworks

| Framework                      | Adapter                                       | Status                                                                             |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Google ADK                     | `packages/hki-adk`                            | ✅ Done — `HkiAdkCallback` + `hki_adk` package; tested, wired to CI                |
| LangChain / LangGraph          | `packages/hki-langchain`                      | ✅ Done — `HkiCallbackHandler`, `HkiRetriever`, `hki_cache_key`; 9 tests           |
| LlamaIndex                     | `packages/hki-llamaindex`                     | ✅ Done — `BaseRetriever` mixin + `QueryEngine` callback; tested                   |
| OpenAI Agents SDK / Assistants | `packages/sdk` `wrap` + `withDomain`          | ✅ Done — Proxy-based wrap + domain scoping in `@hki/sdk/client`                   |
| AutoGen / CrewAI               | `packages/hki-autogen`, `packages/hki-crewai` | ✅ Done — message-bus middleware packages; tested                                  |
| Haystack                       | pipeline component                            | Planned                                                                            |
| Semantic Kernel                | kernel filter                                 | Planned                                                                            |
| MCP servers (any)              | `packages/hki-mcp`                            | ✅ Done — `HkiToolGuard`, `HkiResourceGuard`, `HkiMiddlewareServer`; tested, in CI |

#### 3.C Vector / graph / cache stores

| Store                      | Adapter                                 | Status                  |
| -------------------------- | --------------------------------------- | ----------------------- |
| pgvector / AlloyDB         | filter assertion + label enforcement    | Done (in knowledge-api) |
| Pinecone                   | namespace-per-domain + metadata filter  | Planned                 |
| Weaviate                   | tenant-per-domain                       | Planned                 |
| Qdrant                     | collection-per-domain or payload filter | Planned                 |
| Milvus / Zilliz            | partition-per-domain                    | Planned                 |
| Chroma                     | collection-per-domain                   | Planned                 |
| Elasticsearch / OpenSearch | index-per-domain                        | Planned                 |
| MongoDB Atlas Vector       | collection-per-domain                   | Planned                 |
| Azure AI Search            | index-per-domain                        | Planned                 |
| Neo4j                      | edge-label enforcement                  | Done (informal)         |
| Redis / Upstash            | cache-key derivation                    | Done                    |

#### 3.D Cloud providers

| Cloud                   | Reference deliverables                                                                                                     | Status         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| GCP                     | GKE, Vertex AI, AlloyDB, Pub/Sub, GCS, Document AI, Secret Manager                                                         | Done (current) |
| AWS                     | EKS, Bedrock, Aurora pgvector, SQS/EventBridge, S3, Textract, Secrets Manager, OpenSearch                                  | Planned (M13)  |
| Azure                   | AKS, Azure OpenAI, Azure Postgres + pgvector, Service Bus, Blob Storage, Document Intelligence, Key Vault, Azure AI Search | Planned (M14)  |
| Self-hosted / sovereign | Helm chart, k3s manifests, Postgres + pgvector, MinIO, Kafka, Keycloak                                                     | Planned        |

#### 3.E Observability & governance

| Tool                                             | Integration                           | Status                  |
| ------------------------------------------------ | ------------------------------------- | ----------------------- |
| OpenTelemetry                                    | semantic conventions for `hki.*`      | Done (TS), partial (Py) |
| Langfuse                                         | trace exporter with HKI attrs         | Done                    |
| Arize Phoenix / LangSmith / Helicone / W&B Weave | trace exporter                        | Planned                 |
| Datadog / Honeycomb / Grafana Tempo              | OTLP receiver config                  | Planned                 |
| OPA / Cedar                                      | policy pack importing envelope        | Planned (M15)           |
| SIEM (Splunk, Datadog, Sumo)                     | CEF/JSON event schema for fail-closed | Planned                 |

### Track 4 — Reference platform hygiene

Goal: the platform is a credible _reference_, not a confusing _product_.

| ID  | Title                   | DoD                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M16 | Boundary decision       | ✅ Done — Decision: **strip**. `apps/agentic/` stays as the reference platform. Removed all enterprise identifiers: `retail_agentic` → `hki_agentic`; `retail` agent type → `knowledge`; hardcoded GCP project IDs (`p-642-cilab-*`) → `YOUR_GCP_PROJECT` / `${_GCP_PROJECT}`; retail system prompt → generic; retail tool registry → HKI tools (`search_knowledge`, `get_document`, `run_policy_check`, `get_audit_trail`); "retail-grade" comments → "domain-scoped". |
| M17 | Examples directory      | ✅ Done — `examples/fastapi-rag` (FastAPI + HkiMiddleware RAG, 140 LOC), `examples/mcp-server` (TS gateway guard, 165 LOC), `examples/langgraph-agent` (StateGraph + envelope propagation + handoff, 175 LOC), `examples/bedrock-claude` (boto3 + BEDROCK_STUB mode, 160 LOC). All verified locally.                                                                                                                                                                    |
| M18 | Doc/code reconciliation | ✅ Done — `docs/ARCHITECTURE.md` updated to MySQL throughout (5 occurrences); DATABASE_URL example corrected to `mysql://root:root@127.0.0.1:9306/hki_agentic`.                                                                                                                                                                                                                                                                                                         |
| M19 | UI debt burn-down       | `@hki/ui` token-audit findings → 0, or rename to `@hki/agentic-ui` and remove from “standard” surface.                                                                                                                                                                                                                                                                                                                                                                  |
| M20 | Required CI gates       | ✅ Partial — `verify:hki-conformance`, `test:hki-runtime-py`, `probe:smoke`, and `hki-service-evidence` are required PR gates. `audit:hki:strict` is report-only (8 `body-scope-trust` findings in JWT-protected S2S internal routes; non-strict gate blocks regressions).                                                                                                                                                                                              |

### Track 5 — Adoption

Goal: external systems claim HKI conformance unprompted.

| ID  | Title                            | DoD                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M21 | Public site                      | ✅ Done — `apps/hki-site/` static site (zero-dep HTML/CSS): landing, 6 invariants, envelope schema, install cards for 7 adapter packages, conformance levels table, threat catalog (T01..T15), live registry card (fetches `conformance.json`). Build: `pnpm build:hki-site`. Deploy: `vercel.json` config for Vercel / any static host.                                                                                                                               |
| M22 | "Break a RAG in 60 seconds" demo | ✅ Done — `examples/break-a-rag/break.py` (T05 + T01 + T02 failures, no imports) + `fix.py` (same RAG with HKI, 3/3 closed). Zero external services. Both verified locally.                                                                                                                                                                                                                                                                                            |
| M23 | Three blog posts                 | ✅ Done — `docs/blog/`: (1) "Domain-aware RAG isn’t isolation" — 8 isolation paths beyond the retrieval filter, with code fixes for cache, async jobs, A2A handoff, and gateway targets; (2) "The semantic cache leak nobody notices" — T01+T08 runnable demos, domain-bound key derivation, audit grep; (3) "HKI as an MCP profile" — envelope transport, `HkiToolGuard`, resource labels, A2A envelope propagation, OWASP LLM02/LLM06 mapping, 3-step adoption path. |
| M24 | Ecosystem submissions            | OWASP LLM Top 10 (control), CNCF TAG-Security (profile), Linux Foundation A2A (binding), NIST AI RMF (mapping).                                                                                                                                                                                                                                                                                                                                                        |
| M25 | Three design partners            | One regulated enterprise, one AI-native vendor, one OSS project. Anonymized findings published.                                                                                                                                                                                                                                                                                                                                                                        |
| M26 | Pre-1.0 freeze gate              | Spec, kit, schema, threat catalog frozen until at least one external system passes Level 4 unaided. Then cut HKI 1.0.                                                                                                                                                                                                                                                                                                                                                  |

---

## 4. Sequenced milestone order (next 6, in priority)

**Updated 2026-05-25** — Tracks 1–3 complete. M13 (partial AWS example), M16 (boundary strip), M17 (examples), M18 (doc reconciliation), M21 (public site), M22 (break-a-rag demo) all done. Open front: full AWS cloud reference (EKS/Aurora IaC), adoption.

1. **M13 — AWS reference (EKS + Bedrock + Aurora pgvector + OpenSearch).** 🟡 In progress.
   `examples/aws-bedrock-rag/` added (FastAPI + HkiMiddleware + Titan Embeddings + Claude on
   Bedrock + OpenSearch Serverless with mandatory `hki_domain` filter; stub mode for CI).
   Full EKS/Aurora/OpenSearch reference architecture (Terraform/Helm IaC) still needed.
2. ~~**M17 — Examples directory.**~~ ✅ Done — four self-contained examples committed.
3. ~~**M18 — Doc/code reconciliation.**~~ ✅ Done — ARCHITECTURE.md corrected to MySQL.
4. ~~**M16 — Boundary decision.**~~ ✅ Done — stripped. Zero enterprise identifiers remain in `apps/agentic/`.
5. ~~**M22 — "Break a RAG in 60 seconds" demo.**~~ ✅ Done — `examples/break-a-rag/` committed, 3/3 failures + fixes verified.
6. ~~**M21 — Public site.**~~ ✅ Done — `apps/hki-site/` static site live-ready: spec, conformance kit, threat catalog, registry. `pnpm build:hki-site` + Vercel deploy config.
7. ~~**M23 — Three blog posts.**~~ ✅ Done — `docs/blog/` (3 posts). Required for adoption.
8. **M25 — Three design partners.** One regulated enterprise, one AI-native
   vendor, one OSS project. Required for L5.
9. **M26 — Pre-1.0 freeze gate.** Spec, kit, schema, threat catalog frozen
   until at least one external system passes L4 unaided. Then cut HKI 1.0.

At this point HKI has: a published standard, GCP+AWS cloud references,
Python+TS runtimes, six framework adapters, CI-grade detector with HTTP
probes, L4-tested conformance evidence, and three real adoption stories. That is
the package for HKI 1.0.

---

## 5. Conformance levels (recap; canonical in HKI_CONFORMANCE.md)

| Level | Name       | Required evidence                                                                                                                  |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| L0    | Documented | Domain-sensitive surfaces are inventoried; no runtime conformance claim is made.                                                   |
| L1    | Labeled    | Runtime artifacts persist non-null organization and domain labels.                                                                 |
| L2    | Routed     | Runtime requests carry one signed active-domain envelope through each hop.                                                         |
| L3    | Enforced   | Runtime paths reject missing, `global`, wildcard, unauthorized, or cross-domain scope.                                             |
| L4    | Tested     | Automated negative tests and probes prove isolation invariants for the claimed surface.                                            |
| L5    | Audited    | Signed release evidence is reproducible and independently reviewable, with an external implementation or design-partner reference. |

The reference platform is currently at **L4-tested (smoke evidence)**: 28/28
adapter cases pass; `hki-probe` 10/10 HTTP probes PASS against the mock gateway
in CI; `services/hki-probe-target` is deployable for live Cloud Run evidence.
L5 requires signed release evidence, independent review, an external design
partner or implementation reference, and registry listing.

---

## 6. Open architectural decisions (ADR backlog)

These are decisions we will need to record and live with. New ADRs go in
`docs/adr/NNNN-title.md`. Each ADR is one page max.

- ADR-0001 — Repo split: monorepo vs spec-and-platform separation.
- ADR-0002 — BFF database: stay on MySQL or migrate to PostgreSQL.
- ADR-0003 — Signature algorithm for envelopes: Ed25519 vs JWS RS256.
- ADR-0004 — Cache-key encoding: URL-encoded colon-separated vs canonical JSON
  - hash.
- ADR-0005 — Threat catalog format: Markdown + runnable demos vs OSCAL/STIX.
- ADR-0006 — Conformance evidence signing: cosign vs custom Ed25519.
- ADR-0007 — `hki probe` transport: HTTP-only or include WebSocket/MCP.
- ADR-0008 — License of HKI standard: MIT vs Apache 2.0 vs CC-BY for the spec
  and MIT for the runtimes.
- ADR-0009 — Trademark policy for "HKI Conformant" mark.
- ADR-0010 — Versioning policy: SemVer for runtimes, dated for the spec.

---

## 7. Risk register

| Risk                                                        | Likelihood | Impact | Mitigation                                                                                   |
| ----------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| Project read as "GCP RAG demo"                              | High       | High   | M1 (repo split), M13 (AWS reference).                                                        |
| Conformance kit looks like "Henok grading Henok"            | High       | High   | M7 (HTTP probes), M9 (registry), M25 (external design partners).                             |
| Spec drift between TS and Py runtimes                       | Medium     | High   | Single conformance kit per language, both run in CI; envelope schema is the source of truth. |
| Standard becomes vendor-captured if one partner moves first | Medium     | Medium | M24 (CNCF/OWASP submission) before any one partner formally claims L5.                       |
| Threat catalog overstates impact                            | Medium     | High   | Each threat ships with a runnable demo; numbers come from demos, not narrative.              |
| Burn-out from over-scope                                    | High       | High   | This roadmap. Six milestones at a time. No parallel new tracks until current six close.      |

---

## 8. How to update this document

- Move a milestone status by editing its row. Use ✅ / 🟡 / ⛔ in the Status
  column when one is added.
- When a milestone closes, link to the PR(s) that closed it.
- New milestones get IDs `M27+` in their track; do not renumber.
- Architectural decisions go in `docs/adr/NNNN-title.md` and are linked from
  Section 6.
- Do not delete entries. Strikethrough and link to the superseding entry.

---

## 9. Execution log

A running log of what shipped against this roadmap, newest first.

| Date       | Milestone     | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | PR / Commit   |
| ---------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 2026-05-25 | M23           | `docs/blog/` — three publication-ready posts: (1) "Domain-aware RAG isn't isolation": 8 enforcement paths beyond the retrieval filter (cache, async jobs, A2A, gateway, graph, admin plane) with code fixes; (2) "The semantic cache leak nobody notices": T01+T08 scenario reproduction, domain-bound key derivation fix, audit grep; (3) "HKI as an MCP profile": envelope transport convention, `HkiToolGuard` + `HkiResourceGuard` pattern, A2A propagation, OWASP LLM02/LLM06 mapping, 3-step adoption path. Blog index at `docs/blog/README.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | (this commit) |
| 2026-05-25 | M21           | `apps/hki-site/` static public site (zero-dep HTML/CSS): hero with the HKI contract, 6 invariants, `hki/1.0` envelope schema, install cards for TS/Python runtimes + conformance kit + SDK, adapter table (7 packages), conformance levels grid (L0–L5), threat catalog table (T01..T15 with severity), live registry card (fetches `conformance.json` via JS, graceful static fallback). Build script (`build.mjs`) copies `index.html` + embeds `conformance.json` into `dist/`. `vercel.json` config for Vercel deploy. `pnpm build:hki-site` + `pnpm dev:hki-site` scripts added to root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | (this commit) |
| 2026-05-21 | M13 (partial) | `examples/aws-bedrock-rag/`: FastAPI + `HkiMiddleware` + Amazon Titan Embeddings + Claude on Bedrock + OpenSearch Serverless with mandatory `hki_domain` kNN filter. Stub mode (`AWS_STUB=1`) runs without credentials. Scope-override (P06) rejection, domain-bound cache key, and all three demo cases pass. `examples/agent-platform-hki/agent.py`: duck-typed ADK example showing `HkiBeforeAgentCallback` + `HkiBeforeToolCallback` + `HkiToolGuard` (gateway-target check) + `HkiSessionGuard` + managed evidence output; on-domain ✅, cross-domain gateway-denied ✅, missing envelope ✅.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | (this commit) |
| 2026-05-07 | M1 (split)    | Public-repo packaging shipped under [`scripts/publish-kit/`](../scripts/publish-kit/). `INCLUDED_PATHS` whitelists 27 entries (6 adapter packages, hki-runtime{,-py}, hki-conformance{,-action}, hki-integration-tests, examples, docs/HKI\_\*, audit scripts, ts/eslint configs). `templates/` provides public-only README, LICENSE (MIT, "2026 HKI Contributors"), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, root package.json/turbo/pnpm-workspace, and a CI workflow with 4 jobs (ts-runtime, conformance, python, demo). [`scripts/publish-kit/publish-hki-public.sh`](../scripts/publish-kit/publish-hki-public.sh) materialises the public tree into `scripts/publish-kit/out/` (dry-run by default; `--push <url>` to publish), refuses to overwrite a populated remote branch, prepends a "private reference implementation" banner to docs/HKI_ROADMAP.md and docs/ARCHITECTURE.md so external readers know which service names live outside the public repo, and runs a leak-scan over apps/services names. Validated by running all 16 gates inside the staged `scripts/publish-kit/out/` tree — **all green** (test:hki-runtime, runtime-py, 6 adapters, integration, threats, audit:hki, audit:hki-ast, audit:hki-ast-ts, verify:hki-conformance, registry:build, demo:hki). | (this commit) |
| 2026-05-07 | M-Integration | Cross-adapter end-to-end suite [`hki-integration-tests`](../packages/hki-integration-tests/) imports all six adapter packages in one process and asserts envelope round-trip, scope-override rejection, gateway-target enforcement, cache-key isolation, cross-domain artifact rejection, and session/stream consistency are enforced identically across every adapter (8 tests). [`examples/end_to_end_demo.py`](../examples/end_to_end_demo.py) walks one envelope through every adapter as a runnable showcase. [`docs/HKI_ADAPTERS.md`](HKI_ADAPTERS.md) is the canonical adapter index. Wired as `pnpm test:hki-integration` and `pnpm demo:hki`; both included in CI. **16/16 gates green.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | (this commit) |
| 2026-05-07 | M14–M17       | Four new framework adapters shipped, each duck-typed (no hard dep) and with matching pytest suites: [`hki-llamaindex`](../packages/hki-llamaindex/) (M14, 11 tests), [`hki-adk`](../packages/hki-adk/) (M15, 11 tests), [`hki-autogen`](../packages/hki-autogen/) (M16, 12 tests), [`hki-crewai`](../packages/hki-crewai/) (M17, 12 tests). Each provides envelope discovery, scope-override rejection, gateway-target enforcement, artifact-visibility checks where applicable, and a domain-bound `hki_cache_key`. All four wired into CI `hki-python` job and the registry `packages` block. **46 new passing tests** — 14/14 gates green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | (this commit) |
| 2026-05-10 | M7 (done)     | L4 HTTP probe fully proven. `packages/hki-conformance/scripts/mock-gateway.mjs`: zero-dep Node.js server implementing all 10 P01–P10 scenarios; `pnpm probe:smoke` (root + package) runs 10/10 PASS and writes `evidence.json` with `bundle_hash`. `services/hki-probe-target/`: FastAPI + `HkiMiddleware(require_signature=False)` service for Cloud Run; P06 via `reject_conflicting_scope_argument`, P08 via `active_domain` echo, P09 via `assert_artifact_visible`. `.github/workflows/probe-deploy.yml`: builds image via `cloudbuild.yaml`, deploys to Cloud Run, runs probe against live URL, uploads evidence. `probe-smoke` job added to CI as required gate in `hki-gate`. `hki-service-evidence.mjs` + `make hki-service-evidence-auth` added as `service-evidence` CI gate (JWT boundary probes against local auth services).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-07 | M6 (TS)       | TypeScript AST audit [`scripts/hki-ast-audit-ts.mjs`](../scripts/hki-ast-audit-ts.mjs) wired as `pnpm audit:hki-ast-ts`. Uses bundled TS compiler API (no ts-morph dep). Same surface/guard model as Python audit. Reports **0 blocking / 98 advisory** across `apps/agentic/server` (all reads guarded by `resolveKnowledgeRuntimeStreamId` family). Wired into CI `conformance` job and `conformance.json` (`audit.astTs`). M6 complete (Py + TS).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (this commit) |
| 2026-05-07 | M6 (Py)       | libcst-based AST audit [`scripts/hki_ast_audit.py`](../scripts/hki_ast_audit.py) wired as `pnpm audit:hki-ast`. Surface-aware classification (public/internal/mcp) + LHS-write filtering + custom resolver guards. Reduces 19 regex findings to **0 blocking / 17 advisory** without false positives. Included in CI `hki-python` job and `conformance.json` (`audit.ast`). [`scripts/fix-formatter-mangling.py`](../scripts/fix-formatter-mangling.py) added for repeatable recovery from on-save formatter damage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (this commit) |
| 2026-05-07 | M9.1          | JSON Schema [`packages/hki-conformance/schemas/conformance-registry-v1.json`](../packages/hki-conformance/schemas/conformance-registry-v1.json). Registry builder validates output before writing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | (this commit) |
| 2026-05-07 | M8.1          | Reusable composite action [`packages/hki-conformance-action`](../packages/hki-conformance-action) with `min-level` enforcement, optional probe-url, evidence-artifact upload, and a `hki-action-selftest` workflow exercising it against this repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | (this commit) |
| 2026-05-07 | M9            | `scripts/build-conformance-registry.mjs` + `pnpm registry:build`. Emits `conformance.json` (schema v1) with implementation, packages, conformance results, audit baseline, threat catalog, and computed level (L0..L3). CI uploads it as artifact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | (this commit) |
| 2026-05-07 | M8 (gate)     | CI workflow `hki-python` job (runs hki-runtime-py / litellm / langchain / threats) + `hki-gate` aggregate required check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | (this commit) |
| 2026-05-07 | M5 (15/15)    | Threats HKI-T09..HKI-T15 added (admin-route, wildcard-publication, envelope-replay, expired-envelope, version-downgrade, graph-traversal, prompt-injected-scope); 35 threat tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | (this commit) |
| 2026-05-06 | M5 (8/15)     | Threats HKI-T04..HKI-T08 added (async-job, vector-leak, MCP-tool-unbound, A2A-delegation, embedding-cache); 17 threat tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | (this commit) |
| 2026-05-06 | M11           | `hki-langchain` package: `HkiCallbackHandler`, `HkiRetriever`, `hki_cache_key`; 9 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | (this commit) |
| 2026-05-06 | M6.1          | Static scanner extended with `wildcard-domain-literal`, `body-scope-trust`, `cache-key-no-envelope`, `envelope-less-job-payload`; baseline ratcheted at 19 (S2S internal routes flagged for triage).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (this commit) |
| 2026-05-06 | M2.1          | FastAPI middleware (`hki_runtime.fastapi.HkiMiddleware`) + 5 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | (this commit) |
| 2026-05-06 | M5 (3/15)     | Threat catalog `docs/HKI_THREATS.md`; runnable demos + tests for HKI-T01/T02/T03 under `examples/threats/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | (this commit) |
| 2026-05-06 | M7            | `hki-probe` CLI shipped in `@hki/conformance` with 10 HTTP probes, JSON evidence bundle, claim-level scoring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | (this commit) |
| 2026-05-06 | M10           | `hki-litellm` package (`HkiLiteLLMCallback` + sync hooks) + 7 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (this commit) |
| 2026-05-06 | CI            | Root scripts: `pnpm test:hki-litellm`, `pnpm test:hki-threats`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | (this commit) |
| 2026-05-06 | —             | Roadmap document created.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | (this commit) |
