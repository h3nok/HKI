# AI Platform — Tech Decisions & Architecture Audit

> Generated: 2026-04-28. Compares the implemented codebase against ARCHITECTURE.md.

---

## 1. Service Inventory

| Service | Port | Language / Runtime | Framework | Status |
|---|---|---|---|---|
| **Agentic BFF** | 9001 | Node.js 24 (Alpine) | Express + tRPC | Implemented |
| **Orchestrator Service** | 9501 | Python 3.13 (Alpine) | FastAPI + Google ADK | Implemented |
| **Knowledge API** | 9509 | Python 3.13 (Alpine) | FastAPI + pgvector/AlloyDB | Implemented |
| **Ingestion Pipeline** | 9508 | Python 3.13 (Alpine) | FastAPI + Cloud Pub/Sub | Implemented |
| **Analytics Service** | 9510 (local) / 9512 (cluster) | Python 3.12 (Alpine) | FastAPI + BigQuery | Implemented |
| **Shared Library** | — | Python | Pure Python package | Implemented |

Architecture doc describes 4 core services. **Analytics Service is a 5th service not in the diagram** — it receives events from every other service and persists them to BigQuery.

---

## 2. Tech Stack Decisions

### 2.1 BFF — Agentic (TypeScript)

| Decision | Choice | Notes |
|---|---|---|
| HTTP framework | Express.js | Minimal, well-understood |
| API layer | **tRPC** (type-safe RPC) | Architecture doc says "tRPC API" — correctly implemented. End-to-end type safety between React client and Node server |
| Database | **MySQL 8.0** via Drizzle ORM | Architecture diagram shows "PostgreSQL" — **actual implementation uses MySQL**. This is the primary deviation |
| ORM | Drizzle Kit | Lightweight, schema-first, migration-aware |
| Frontend | React 19 + Vite + TypeScript | Latest React; Vite for fast dev builds |
| UI library | Radix UI + Tailwind CSS | Headless components + utility styling |
| Auth | Google OAuth 2.0 + `jose` JWT | Session stored in MySQL; short-lived request JWTs for service calls |
| Real-time | WebSocket + Redis adapter | Redis pub/sub for multi-pod WebSocket fan-out in GKE |
| Package manager | pnpm 10 | Workspace-aware, fast |

### 2.2 Orchestrator Service (Python)

| Decision | Choice | Notes |
|---|---|---|
| HTTP framework | FastAPI 0.115 | Async-native, OpenAPI built-in |
| **Agent framework** | **Google ADK (Agent Development Kit) ≥1.28.1** | Architecture doc says "ReAct loop" — the actual implementation uses ADK, which is Google's opinionated agent framework native to Vertex AI. ADK wraps the ReAct pattern with memory, tool use, and evaluation built in |
| LLM client | **LiteLLM ≥1.83** | Unified interface to Vertex AI, Anthropic, OpenAI. Architecture correctly describes this |
| Default models | `gemini-2.0-flash` (default), `gemini-2.5-flash` (agent) | Gemini primary; Claude available via LiteLLM routing |
| Memory system | 4-store: semantic / episodic / procedural / declarative | Redis-backed; L1 in-process + L2 Redis tiered cache |
| MCP client | `mcp ≥1.0.0` | Orchestrator consumes Knowledge API as MCP tool provider |
| Observability | OpenTelemetry + Langfuse ≥2.40 | All LLM calls traced; self-hosted Langfuse on port 3100 |
| Guardrails | Custom `guardrails.py` | Input/output safety checks before/after LLM calls |
| Corrective RAG | `corrective_rag.py` | Detects poor retrieval, re-queries with reformulated question |

### 2.3 Knowledge API (Python)

| Decision | Choice | Notes |
|---|---|---|
| Vector store | **AlloyDB (pgvector) in prod; PostgreSQL 16 + pgvector locally** | AlloyDB is PostgreSQL-compatible — same driver (`asyncpg`), same schema |
| Vector dimensions | 768 | Matches `text-embedding-004` output |
| Embedding source | Vertex AI `text-embedding-004` → LiteLLM gateway → local hash fallback | Graceful degradation chain for local dev |
| Graph DB | **Neo4j 5 Community** | Optional; used for entity relationship discovery and `graph_discover` MCP tool |
| Chunking | Sentence-based, 512 chars, 64 overlap | Conservative overlap; sentence boundary aware |
| Hybrid search | Vector (cosine) + BM25 keyword fusion | Standard RAG hybrid retrieval |
| MCP server | `mcp[cli] 1.26.0` | Exposes `search_knowledge`, `get_document`, `graph_discover`, `list_collections`, `get_stats` |
| Reranking | LLM-based pointwise reranker | Post-retrieval quality pass before returning results |
| Evaluation | RAGAS-style scoring via LLM Judge | Faithfulness + relevance metrics per query |
| Entity extraction | Gemini via `entity_extraction.py` | Links entities to Neo4j nodes |

### 2.4 Ingestion Pipeline (Python)

| Decision | Choice | Notes |
|---|---|---|
| Document parsing | Google Document AI (OCR/layout) + PyPDF fallback + python-docx | Cloud-first; local fallback via PyPDF |
| Object storage | Google Cloud Storage | Documents stored at `gs://hki-knowledge-docs/` |
| Job queue | **Cloud Pub/Sub** (emulated locally via `PUBSUB_EMULATOR_HOST`) | Architecture correctly describes Pub/Sub events |
| Job persistence | Redis (`job_store.py`) | Job state survives restarts |
| Clustering | **RAPTOR** (`raptor.py`) | Recursive Abstractive Processing for Tree-Organized Retrieval — hierarchical document summarization |
| Quality gates | `quality_gates.py` | Pre-ingestion validation and filtering |
| Contextualization | Gemini via `gemini_client.py` | LLM-assisted chunk context enrichment |
| Concurrency | Per-org rate limiting (`concurrency.py`) | Max 5 concurrent jobs per org |
| Versioning | `versioning.py` | Document version tracking |

### 2.5 Analytics Service (Python)

| Decision | Choice | Notes |
|---|---|---|
| Storage | BigQuery (or in-memory for dev) | Event append-only analytics warehouse |
| Events captured | User, chat, knowledge search | Published by all other services |
| Port | 9510 local / 9512 cluster | Minor port discrepancy between envs |

### 2.6 Infrastructure

| Component | Choice | Notes |
|---|---|---|
| Container runtime | Docker (multi-stage, Alpine) | All services: Python 3.13-alpine or Node 24-alpine |
| Orchestration (prod) | **GKE** — Kubernetes with HPA, PDB, ServiceAccounts | Architecture doc correctly states GKE as canonical runtime |
| CI/CD | Google Cloud Build (`cloudbuild.yaml` per service) | One pipeline per service |
| Local dev | Docker Compose (7 containers) | MySQL, Redis, PostgreSQL+pgvector, Neo4j, LiteLLM, Pub/Sub emulator, Langfuse |
| Secrets (prod) | Google Secret Manager + K8s Secrets | Shared library `gcp_secrets.py` handles fetch |
| Service discovery | Kubernetes DNS (`service.platform.svc.cluster.local`) | Environment variables per service |
| Python packaging | **uv** | Fast Rust-based pip alternative; used in Dockerfiles and local setup |

---

## 3. Architecture Document vs Implementation — Gap Analysis

### Matches ✅

| Architecture spec | Implemented as |
|---|---|
| Agentic BFF on port 9001 with React + Vite frontend | ✅ Exact match |
| tRPC API layer in BFF | ✅ Exact match |
| JWT service-to-service auth (30s TTL request tokens) | ✅ `SERVICE_AUTH_SECRET` shared across services |
| Orchestrator on 9501 with ReAct loop | ✅ Implemented via Google ADK (ADK wraps ReAct) |
| Knowledge API on 9509 with MCP server | ✅ Exact match; `mcp[cli]` package used |
| Ingestion Pipeline on 9508 with GCS + Pub/Sub | ✅ Exact match |
| LiteLLM Gateway as unified LLM proxy | ✅ Runs on port 4000; Vertex AI primary |
| Redis for memory/cache | ✅ Also used for rate limiting, WebSocket fan-out, job persistence |
| AlloyDB (pgvector) for vector storage | ✅ PostgreSQL+pgvector locally; AlloyDB in prod |
| Neo4j for knowledge graph | ✅ Optional; `neo4j 6.1.0` |
| Pub/Sub for async events (`document.uploaded`, `document.indexed`) | ✅ Emulated locally |
| OpenTelemetry distributed tracing | ✅ All Python services instrument via shared `tracing.py` |
| Langfuse LLM observability | ✅ Self-hosted; Langfuse 2.x |
| GKE canonical deployment with K8s manifests | ✅ HPA, PDB, ServiceAccount, ConfigMap per service |

### Deviations / Additions ⚠️

| Architecture spec | Actual implementation | Impact |
|---|---|---|
| BFF database: "PostgreSQL" (diagram shows PostgreSQL icon) | **MySQL 8.0** | Low — same relational semantics; Drizzle ORM abstracts it. Schema migrations work the same way |
| 4 microservices | **5 services** (Analytics added) | Low — Analytics is additive and decoupled; receives events via HTTP POST from others |
| ReAct loop described as custom | **Google ADK** wraps the loop | Low — ADK is the implementation of the pattern; behavior matches spec |
| Architecture shows Cloud Run mention | Cloud Run marked **legacy** in doc header; GKE is canonical | Resolved — architecture doc itself notes this |
| LLM model unspecified | **Gemini 2.0-flash** default, **2.5-flash** for agent | Design choice — LiteLLM allows swapping without code change |
| Analytics port not mentioned | **9510 local, 9512 cluster** | Minor inconsistency between environments |

---

## 4. Service Communication Summary (as built)

```
[User Browser]
      │ HTTPS
      ▼
[Agentic BFF :9001]  ─── MySQL (sessions, messages, traces)
      │                 ─── Redis (WebSocket fan-out)
      │ HTTP + JWT
   ┌──┴──────────────────┐
   ▼                     ▼
[Orchestrator :9501]  [Ingestion Pipeline :9508]
   │  ─ Redis (memory,      │  ─ GCS (documents)
   │    rate limit)         │  ─ Pub/Sub (jobs)
   │  ─ LiteLLM :4000       │  ─ Redis (job state)
   │  ─ Langfuse :3100      │
   │                        │
   │ MCP tools              │ HTTP bulk_create
   ▼                        ▼
[Knowledge API :9509] ◄─────┘
   │  ─ AlloyDB / PostgreSQL+pgvector
   │  ─ Neo4j :9687
   │  ─ Redis (optional cache)

[All services] ──→ [Analytics Service :9510]  ─── BigQuery
```

---

## 5. Local Development Stack (Docker Compose)

| Container | Image | Port | Purpose |
|---|---|---|---|
| `agentic-mysql` | mysql:8.0 | 9306 | BFF session/message store |
| `agentic-redis` | redis:7-alpine | 9379 | Cache, memory, WebSocket, jobs |
| `agentic-postgres` | pgvector/pgvector:pg16 | 9432 | Knowledge vector store |
| `agentic-neo4j` | neo4j:5-community | 9687 / 9474 | Knowledge graph |
| `agentic-litellm` | litellm proxy | 4000 | LLM gateway (Vertex AI) |
| `agentic-pubsub` | gcr.io/pubsub-emulator | 8085 | Pub/Sub dev emulator |
| `agentic-langfuse` | langfuse/langfuse:2 | 3100 | LLM traces (admin@hki.com / admin1234) |

---

## 6. Key Engineering Decisions (Rationale)

**Google ADK over custom ReAct** — ADK provides native Vertex AI integration, built-in tool calling, memory hooks, and evaluation. Avoids reimplementing scaffolding that ADK already provides.

**uv for Python deps** — Dramatically faster than pip; consistent with modern Python tooling. All Dockerfiles use `uv pip install`.

**tRPC over REST for BFF** — End-to-end TypeScript type safety between the React client and the Node server. No schema drift between frontend and backend.

**MySQL for BFF instead of PostgreSQL** — Both are relational; MySQL was chosen for the BFF persistence layer (conversations, messages, traces). This is the only place PostgreSQL is shown in the architecture diagram but MySQL is used. The Knowledge API correctly uses PostgreSQL/AlloyDB for pgvector.

**Langfuse self-hosted** — Keeps LLM traces inside the org boundary. Seeded with a HKI admin account. Runs alongside dev services in Docker Compose.

**RAPTOR clustering in ingestion** — Hierarchical document summarization allows the agent to answer questions that span multiple chunks ("summary-level" queries) without retrieving every chunk.

**Corrective RAG in orchestrator** — If retrieval confidence is low, the orchestrator reformulates the query and retries before presenting to the LLM. This reduces hallucination on borderline queries.

**Hermetic isolation flag (`KB_HERMETIC_ISOLATION`)** — When true, Knowledge API operates in a sandboxed mode (no external calls). Enables deterministic testing.

---

## 7. What's Not Yet in the Codebase

Based on the architecture document, these items are specified but were not confirmed as fully implemented:

- **SAML auth** — Architecture mentions "OAuth/SAML"; only Google OAuth is implemented
- **DLP / PII detection** in LiteLLM guardrails — Architecture lists this as a LiteLLM benefit; not confirmed in `services/litellm-gateway/config.yaml`
- **Langfuse spend tracking** — LiteLLM integration exists but cost cap configuration unverified
- **Ingestion webhook** from Pipeline to BFF — Architecture shows BFF polling or webhook for `document.indexed`; only polling confirmed

---

*This document reflects the state of the codebase as of 2026-04-28. Update after significant architectural changes.*
