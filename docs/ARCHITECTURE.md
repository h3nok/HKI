# AI Platform End-State Architecture

> Status: target-state reference architecture for the retail/agentic platform.
> This document describes the intended end state. It replaces the older
> implementation-only framing of this file. Current service topology is
> summarized in "Current Implementation Snapshot" below.

## Purpose

This document defines the end-state architecture for HKI's agentic platform
as it applies to the retail agent and adjacent domain agents.

It aligns the repo with the platform's stated target model:

- value-stream scoped runtime isolation
- GKE-first production runtime
- a distinct model-control plane and tool-control plane
- MCP as the standard tool contract
- explicit migration from today's service layout to the governed target state

Related design sources:

- [Hermetic Value Stream Isolation](../agentic/docs/HERMETIC-VALUE-STREAM-ISOLATION.md)
- [Value Stream Domain Model](../agentic/docs/VALUE-STREAM-DOMAIN-MODEL.md)
- [MCP Gateway and MCP Bus](./MCP_GATEWAY_AND_BUS.md)
- `agentic/docs/Copy of Arch Overview_V0.2.pdf`
- `agentic/docs/Copy of Deliverable 2_ Target State Enterprise Agentic AI Platform Architecture Blueprint.pdf`

## End-State Summary

The end state is a GKE-first agentic platform with five major layers:

1. **Experience Plane** - Agentic BFF and other client channels.
2. **Agent Runtime Plane** - orchestrator or equivalent runtime that executes
   the agent loop for exactly one active value stream per request.
3. **AI Gateway** - the model-facing control plane for auth, routing,
   guardrails, quotas, spend, and observability.
4. **MCP Gateway + Bus** - the tool-facing control plane and adapter fabric for
   all agent-to-tool traffic.
5. **Knowledge and Data Plane** - knowledge API, ingestion, graph/vector
   stores, cache, events, and analytics.

The central architectural rule is not "all traffic goes to one service." The
central rule is that every runtime call executes inside one explicit value
stream and is governed by the correct control plane for that kind of traffic.

## Non-Negotiable Runtime Invariants

These rules define the target architecture.

1. Every runtime request resolves to exactly one active value stream.
2. Every runtime artifact that influences retrieval or action carries an
   explicit stream identity.
3. Tool calls, knowledge retrieval, memory access, cache keys, and audit events
   all inherit the active stream.
4. Runtime traffic fails closed on missing, ambiguous, or unauthorized scope.
5. `global` is never a wildcard bypass in runtime paths.
6. Admin and runtime planes are separated. Cross-stream inspection is an admin
   capability, not a weakened runtime filter.
7. Tool contracts are stable and namespaced. Agents bind to platform-owned tool
   identities, not vendor-specific names.

These invariants come directly from the HVSI and value-stream docs and must be
preserved regardless of the specific gateway or compute technology selected.

## End-State Logical Architecture

```text
                               Users / Channels
                                      |
                                      v
                     +----------------------------------+
                     | Experience Plane                 |
                     | Agentic BFF / chat UIs / apps    |
                     | stream selection + session state |
                     +----------------+-----------------+
                                      |
                        signed runtime scope + user context
                                      |
                                      v
                     +----------------------------------+
                     | Agent Runtime Plane              |
                     | Orchestrator / ADK agent runtime |
                     | memory + planning + tool choice  |
                     +-----------+-------------+--------+
                                 |             |
                     model calls |             | tool calls
                                 |             |
                                 v             v
               +----------------------+   +------------------------+
               | AI Gateway           |   | MCP Gateway            |
               | auth + routing +     |   | scope + catalog +      |
               | guardrails + budgets |   | policy + routing +     |
               | + model registry     |   | audit + quotas         |
               +----------+-----------+   +-----------+------------+
                          |                           |
                          v                           v
              +-----------------------+    +------------------------+
              | Model Providers       |    | MCP-native servers     |
              | Vertex / Gemini /     |    | KB, graph, internal    |
              | approved external LLMs|    | tools, future domain   |
              +-----------------------+    | adapters               |
                                           +-----------+------------+
                                                       |
                                                       v
                                           +------------------------+
                                           | MCP Bus / Adapters     |
                                           | REST / gRPC / SOAP /   |
                                           | JDBC / SaaS wrappers   |
                                           +-----------+------------+
                                                       |
                                                       v
                                           Enterprise systems / APIs


          +---------------------------------------------------------------+
          | Knowledge and Data Plane                                      |
          | Knowledge API | Ingestion | AlloyDB/pgvector | Neo4j | Redis  |
          | Pub/Sub | GCS | analytics-service | audit and eval storage    |
          +---------------------------------------------------------------+


          +---------------------------------------------------------------+
          | Admin / Governance Plane                                      |
          | catalogs | policy admin | evaluation | spend | audit export   |
          | cross-stream inspection only through dedicated admin paths     |
          +---------------------------------------------------------------+
```

Simplified diagram note: `analytics-service` is omitted from the diagram above to keep the request path readable; it runs on port `9510` and receives usage and operational telemetry from the deployed platform.

## 🔗 Service Communication Patterns

### 1. **Agentic BFF → Orchestrator Service**

**Protocol**: HTTP REST
**Auth**: JWT (signed by BFF, validated by orchestrator)
**Port**: 9501
**Purpose**: Chat requests, agent invocation

```typescript
// agentic/server/chat.ts
const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL || "http://localhost:9501";

async function callOrchestrator(payload: {
  conversation_id: string;
  message: string;
  user_id: string;
  history: Array<{ role: string; content: string }>;
}) {
  const token = await signRequestJwt(ctx.user);
  const response = await fetch(`${ORCHESTRATOR_URL}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}
```

**What gets passed**:

- User message + conversation history
- User ID + conversation ID
- Scope/department filters
- JWT with user claims

**What comes back**:

- Agent response content
- Tool execution trace (thought steps)
- Citations from knowledge base
- Guardrail validation results
- Confidence scores

---

### 2. **Orchestrator → Knowledge API (via MCP)**

**Protocol**: MCP (Model Context Protocol)
**Transport**: Stdio or HTTP
**Port**: 9509 (if HTTP mode)
**Purpose**: Vector search, document retrieval, graph queries

The orchestrator connects to knowledge-api as an **MCP server**, treating it like a tool provider:

```python
# services/orchestrator-service/src/adapters/mcp_client.py
from mcp import ClientSession, StdioServerParameters

async def connect_to_knowledge_mcp():
    server = StdioServerParameters(
        command="python",
        args=["-m", "knowledge_api.mcp_server"],
        env={"KNOWLEDGE_API_URL": "http://knowledge-api:9509"}
    )

    async with ClientSession(server) as session:
        # List available tools
        tools = await session.list_tools()
        # tools: ["search_knowledge", "get_document", "graph_query", ...]

        # Execute tool
        result = await session.call_tool("search_knowledge", {
            "query": "What is our return policy?",
            "max_results": 5,
            "departments": ["retail"]
        })
```

**Available MCP Tools** (from knowledge-api):

- `search_knowledge` - Hybrid vector + keyword search
- `get_document` - Retrieve full document by ID
- `graph_discover` - Neo4j graph traversal for related entities
- `list_collections` - Get available knowledge collections
- `get_stats` - Vector store statistics

---

### 3. **Agentic BFF → Ingestion Pipeline**

**Protocol**: HTTP REST
**Auth**: JWT (signed by BFF)
**Port**: 9508
**Purpose**: Document upload, ingestion jobs, pipeline management

```typescript
// agentic/server/knowledge.ts
const KNOWLEDGE_PIPELINE_URL =
  process.env.KNOWLEDGE_PIPELINE_URL || "http://localhost:9508";

async function uploadDocument(
  file: File,
  metadata: {
    collection_id: string;
    department: string;
    tags: string[];
  }
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));

  const token = await signRequestJwt(ctx.user);
  const response = await fetch(`${KNOWLEDGE_PIPELINE_URL}/v1/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.json(); // { job_id, status }
}
```

---

### 4. **Ingestion Pipeline → Knowledge API**

**Protocol**: HTTP REST
**Auth**: Service-to-service JWT
**Port**: 9509
**Purpose**: Store processed chunks, embeddings, metadata

```python
# services/ingestion-pipeline-service/src/domain/pipeline.py
async def store_chunks(chunks: list[Chunk]):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{KNOWLEDGE_API_URL}/v1/documents/bulk_create",
            json={
                "chunks": [chunk.dict() for chunk in chunks],
                "collection_id": collection_id,
                "metadata": metadata
            },
            headers={"Authorization": f"Bearer {service_jwt}"}
        )
```

**Ingestion Flow**:

1. BFF uploads document → Ingestion Pipeline
2. Pipeline stores file in GCS
3. Pipeline publishes `document.uploaded` → Pub/Sub
4. Pipeline processes: parse → chunk → embed
5. Pipeline stores chunks → Knowledge API
6. Knowledge API inserts into AlloyDB (vectors) + Neo4j (graph)
7. Pipeline publishes `document.indexed` → Pub/Sub
8. BFF receives status via polling/webhooks

---

### 5. **Orchestrator → LiteLLM Gateway**

**Protocol**: OpenAI-compatible HTTP
**Port**: 4000 (LiteLLM proxy)
**Purpose**: All LLM calls (routing, rate limiting, guardrails)

```python
# services/orchestrator-service/src/adapters/llm_client.py
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://litellm-gateway:4000/v1",
    api_key=os.getenv("LITELLM_API_KEY")
)

async def generate_response(messages: list, tools: list):
    response = await client.chat.completions.create(
        model="claude-3-5-sonnet",  # Routed by LiteLLM
        messages=messages,
        tools=tools,
        stream=True
    )
    return response
```

**LiteLLM Benefits**:

- Single gateway for all LLM providers (Claude, Gemini, GPT-4)
- Request/response guardrails (DLP, PII detection)
- Rate limiting and spend caps
- Fallback routing (if Claude fails → Gemini)
- Observable via Cloud Logging, Cloud Trace, and BigQuery analytics

---

## 🔐 Authentication & Authorization

### Request Flow with JWT

```
[User] → [Agentic BFF]
         ↓
    1. User authenticates (OAuth/SAML)
    2. BFF issues session JWT (user_id, org_id, roles)
    3. BFF stores session in MySQL
         ↓
    [User makes chat request]
         ↓
    4. BFF validates user JWT
    5. BFF checks RBAC (hasPermission)
    6. BFF signs **request JWT** (30s TTL) ← short-lived service token
         ↓
    [BFF → Orchestrator]
         ↓
    7. Orchestrator validates request JWT
    8. Orchestrator extracts user context (user_id, scopes)
    9. Orchestrator executes agent logic
         ↓
    [Orchestrator → Knowledge API via MCP]
         ↓
    10. MCP includes user context in tool calls
    11. Knowledge API filters results by department/scope
```

**JWT Claims**:

```json
{
  "sub": "user-12345",
  "org_id": "hki",
  "roles": ["user", "manager"],
  "scopes": ["retail", "wholesale"],
  "exp": 1710000000,
  "iat": 1709999970
}
```

---

## 📊 Data Flow Examples

### Example 1: User asks "What's our return policy?"

1. **User** → types message in Agentic UI
2. **Agentic BFF** → receives tRPC request
   - Validates JWT
   - Checks RBAC (user role)
   - Persists message to MySQL
3. **BFF** → HTTP POST to Orchestrator `/v1/chat`
   - Includes conversation history
   - Includes user scopes (departments)
4. **Orchestrator** → executes ReAct loop
   - Calls LLM: "What tool should I use?"
   - LLM responds: "Use `search_knowledge` tool"
5. **Orchestrator** → MCP call to Knowledge API
   - Tool: `search_knowledge`
   - Args: `{"query": "return policy", "departments": ["retail"]}`
6. **Knowledge API** → vector search in AlloyDB
   - Filters by department
   - Returns top 5 chunks with citations
7. **Orchestrator** → receives MCP response
   - Formats citations
   - Calls LLM again: "Generate answer based on these docs"
8. **LLM** → generates natural language response
9. **Orchestrator** → runs guardrails
   - Checks for PII
   - Validates output safety
10. **Orchestrator** → returns to BFF
    - Response content
    - Thought trace (5 steps)
    - Citations (3 documents)
    - Guardrails: passed
11. **BFF** → persists response to MySQL
    - Stores thought trace steps
    - Stores tool executions
    - Broadcasts via WebSocket to UI
12. **User** → sees response with citations in real-time

---

### Example 2: Admin uploads product catalog PDF

1. **Admin** → uploads PDF in Agentic UI
2. **BFF** → validates user has `manager` role
3. **BFF** → HTTP POST to Ingestion Pipeline `/v1/ingest`
   - Multipart form data (file + metadata)
   - Metadata: `{collection: "products", department: "retail"}`
4. **Ingestion Pipeline** → receives file
   - Stores original in object storage: `gs://<object-store-bucket>/products/catalog-2026.pdf`
   - Publishes Pub/Sub: `{"event": "document.uploaded", "doc_id": "123"}`
   - Returns: `{job_id: "job-456", status: "processing"}`
5. **Pipeline** → async processing
   - Parses PDF (PyPDF2)
   - Chunks text (512 tokens, 128 overlap)
   - Generates embeddings (calls LiteLLM → text-embedding-004)
   - Extracts entities (products, prices, SKUs)
6. **Pipeline** → HTTP POST to Knowledge API `/v1/documents/bulk_create`
   - 150 chunks with embeddings
   - Metadata: source, page numbers, department
7. **Knowledge API** → stores in databases
   - AlloyDB: inserts vectors into `documents` table
   - Neo4j: creates nodes for products + relationships
   - Updates collection stats
8. **Pipeline** → publishes Pub/Sub
   - `{"event": "document.indexed", "doc_id": "123", "chunks": 150}`
9. **BFF** → polls job status (or webhook)
   - Updates UI: "Indexing complete ✓"
10. **User** → can now search for product information

---

## 🌐 Network & Infrastructure

### GKE Deployment

The canonical runtime is the shared **GKE cluster** in namespace `platform` with:

- **Kubernetes Deployments + Services**: Stable in-cluster service discovery
- **Service-to-Service Auth**: Shared internal JWT secrets for east-west calls
- **Secret Manager + Kubernetes Secrets**: Runtime configuration synced during deploy
- **Cloud Load Balancer + IAP**: HTTPS ingress to the public Agentic endpoint

```
Internet → Cloud Load Balancer + IAP → Agentic ingress
                            ↓
                   GKE Cluster (namespace: platform)
                            ↓
      ┌──────────────────┬────────────────┴──────────────┐
      ▼                  ▼                                ▼
   Orchestrator    Ingestion Pipeline             Knowledge API
   (Deployment)    (Deployment + Worker)          (Deployment)
      │                  │                                │
      └──────────────────┼────────────────────────────────┘
                 ▼
            Shared Resources:
            - AlloyDB (private IP)
            - Redis (Memorystore)
            - Neo4j / graph store
            - GCS Buckets
            - Pub/Sub Topics
```

### Service Discovery

Services discover each other via **environment variables** and Kubernetes DNS:

```bash
# agentic BFF environment
ORCHESTRATOR_URL=http://orchestrator.platform.svc.cluster.local:9501
KNOWLEDGE_PIPELINE_URL=http://ingestion-pipeline.platform.svc.cluster.local:9508

# orchestrator environment
KNOWLEDGE_API_URL=http://knowledge-api.platform.svc.cluster.local:9509
LITELLM_URL=https://model-gateway.example.com/v1
REDIS_URL=rediss://redis.example.internal:6379

# ingestion pipeline environment
KNOWLEDGE_API_URL=http://knowledge-api.platform.svc.cluster.local:9509
GCS_BUCKET=gs://<object-store-bucket>
PUBSUB_TOPIC=projects/<project-id>/topics/knowledge-events
```

Internal calls use **ClusterIP service DNS** within the namespace; managed backends still use private IPs or Google-managed APIs.

---

## 🔄 Asynchronous Communication

### Pub/Sub Event System

Services communicate async via **Cloud Pub/Sub**:

**Topics**:

- `knowledge-events` - Document lifecycle events
- `agent-events` - Agent execution traces
- `analytics-events` - Usage metrics

**Event Examples**:

```json
// Document uploaded
{
  "event_type": "document.uploaded",
  "doc_id": "doc-123",
  "collection_id": "products",
  "uploaded_by": "user-456",
  "timestamp": "2026-03-16T10:00:00Z",
  "metadata": {
    "filename": "catalog.pdf",
    "size_bytes": 2048000
  }
}

// Document indexed
{
  "event_type": "document.indexed",
  "doc_id": "doc-123",
  "chunks_created": 150,
  "embeddings_generated": 150,
  "entities_extracted": 42,
  "processing_duration_ms": 12500
}

// Agent execution
{
  "event_type": "agent.execution",
  "conversation_id": "conv-789",
  "user_id": "user-456",
  "turns": 3,
  "tools_used": ["search_knowledge", "graph_discover"],
  "total_duration_ms": 2400,
  "llm_calls": 4,
  "guardrails_passed": true
}
```

---

## 📈 Observability

### Tracing (OpenTelemetry to Cloud Trace)

All services emit **OpenTelemetry traces**:

```python
# shared/tracing.py (used by all Python services)
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span("process_document")
async def process_document(doc_id: str):
    span = trace.get_current_span()
    span.set_attribute("doc_id", doc_id)
    # ... processing logic
```

**Trace Hierarchy Example**:

```
Trace: chat_request (conversation-123)
├─ Span: orchestrator.chat (2.4s)
│  ├─ Span: llm.generate (1.2s)
│  ├─ Span: mcp.search_knowledge (0.8s)
│  │  └─ Span: alloydb.vector_search (0.6s)
│  ├─ Span: llm.generate (0.3s)
│  └─ Span: guardrails.validate (0.1s)
└─ Span: bff.persist_message (0.05s)
```

### Monitoring Stack

- **Google Cloud Monitoring**: Dashboards, SLOs, and alert policies
- **Google Cloud Trace**: Distributed tracing
- **Google Cloud Logging**: Structured JSON logs and log-based metrics
- **BigQuery analytics**: Durable AI usage, tool, guardrail, and KB events

---

## 🚀 Deployment Order

Services MUST be deployed in dependency order:

1. **Knowledge API** (foundation)
   - Requires: AlloyDB, Neo4j, Secret Manager
   - Exposes: MCP server on port 9509

2. **Orchestrator Service** (agent brain)
   - Requires: Knowledge API, LiteLLM, Redis
   - Depends on: Knowledge API (MCP client)

3. **Ingestion Pipeline** (document processing)
   - Requires: Knowledge API, GCS, Pub/Sub
   - Depends on: Knowledge API (stores chunks)

4. **Agentic BFF** (user-facing)
   - Requires: MySQL, all other services
   - Depends on: Orchestrator, Ingestion Pipeline, Knowledge API

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for detailed steps.

---

## 🔧 Local Development

### Running All Services

```bash
# Terminal 1: Knowledge API
cd apps/ai-platform/knowledge-api
uv venv && source .venv/bin/activate
uv pip install -e .
python -m src.main  # Port 9509

# Terminal 2: Orchestrator
cd apps/ai-platform/orchestrator-service
uv venv && source .venv/bin/activate
uv pip install -e . -e ../shared
python -m src.main  # Port 9501

# Terminal 3: Ingestion Pipeline
cd apps/ai-platform/ingestion-pipeline-service
uv venv && source .venv/bin/activate
uv pip install -e . -e ../shared
python -m src.main  # Port 9508

# Terminal 4: Agentic BFF
cd apps/ai-platform/agentic
pnpm install
pnpm run dev  # Port 9001
```

### Environment Variables

Create `.env` files in each service directory:

```bash
# orchestrator-service/.env
KNOWLEDGE_API_URL=http://localhost:9509
LITELLM_URL=http://localhost:4000
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key

# agentic/.env
ORCHESTRATOR_URL=http://localhost:9501
KNOWLEDGE_PIPELINE_URL=http://localhost:9508
DATABASE_URL=mysql://root:root@127.0.0.1:9306/retail_agentic
JWT_SECRET=your-secret-key
```

---

## 🎯 Current Implementation Summary

The AI Platform uses a **microservices architecture** with:

✅ **HTTP/REST** for synchronous service communication
✅ **MCP (Model Context Protocol)** for knowledge tool integration
✅ **JWT** for service-to-service authentication
✅ **Pub/Sub** for asynchronous event-driven workflows
✅ **OpenTelemetry** for distributed tracing
✅ **GKE** for the canonical production runtime

All services are **independently deployable** but communicate seamlessly via well-defined APIs and protocols.

---

## Platform Planes and Responsibilities

### Experience Plane

The experience plane owns user session state and stream selection.

Primary responsibilities:

- authenticate the user
- resolve which value stream the request is acting in
- sign downstream runtime context
- persist conversations and user-facing traces
- expose admin workflows separately from runtime workflows

The BFF is not just a UI backend. In the target model it is the entry gate that
turns a user request into a scoped runtime request.

### Agent Runtime Plane

The agent runtime executes planning, memory recall, retrieval strategy, tool
selection, and response assembly for one active stream.

Primary responsibilities:

- accept only explicitly scoped runtime requests
- preserve scope across the full turn
- call the AI Gateway for model traffic
- call the MCP Gateway for tool traffic
- never widen scope during corrective RAG, retries, or rewrites

The runtime may continue to be the current orchestrator or evolve into a more
general runtime, but the contract remains the same.

### AI Gateway

The AI Gateway is the model-facing control plane.

Primary responsibilities:

- provider abstraction and model routing
- auth and entitlements for model access
- prompt and response guardrails
- rate limits, budgets, spend accounting, and observability
- model registry and approved model lifecycle

In the current repo, LiteLLM is the seed of this layer. In the end state, this
layer may be delivered by LiteLLM, Apigee plus LiteLLM, or another approved
composition, but the architectural role is stable even if the implementation
changes.

### MCP Gateway and Bus

The MCP Gateway is the tool-facing control plane. The MCP Bus is the adapter
fabric that makes non-MCP systems available through governed MCP contracts.

Primary responsibilities of the MCP Gateway:

- catalog, namespace, and publish tools
- enforce stream-aware policy before tool execution
- route namespaced tools to the correct MCP server or adapter
- record structured audit for every tool call
- separate runtime ingress from admin ingress

Primary responsibilities of the MCP Bus:

- translate backend-native protocols into MCP
- apply active-stream context in the backend's native language
- normalize backend-specific schemas into platform-owned contracts
- keep credentials and backend-specific auth out of agent sessions

The end state is that agents do not call ad hoc tool endpoints directly. They
call the MCP Gateway, which routes to MCP-native servers or Bus adapters.

### Knowledge and Data Plane

The knowledge and data plane provides the stores and services that the platform
needs to retrieve, ingest, remember, and audit.

Core components:

- Knowledge API as an MCP-native knowledge server
- ingestion pipeline for document and connector flows
- AlloyDB/pgvector and keyword indexes
- Neo4j graph storage
- Redis for memory, locks, and caching
- Pub/Sub and GCS for async workflows and artifacts
- analytics-service and evaluation storage

This plane is part of the security boundary. Stream identity must survive
through storage, retrieval, cache, graph traversal, and audit.

### Admin and Governance Plane

Admin capabilities exist, but they are not runtime shortcuts.

Primary responsibilities:

- catalog review and tool publication
- policy configuration
- evaluation and readiness review
- spend and usage inspection
- cross-stream reporting through admin-only paths

Runtime APIs must not reuse relaxed admin queries.

## Compute and Deployment Posture

The target deployment posture is:

- **GKE first** for core agentic runtime services.
- **Cloud Run selective** for stateless adapters or isolated services where it
  is operationally advantageous.
- **Private service connectivity** for data stores and internal APIs.
- **Hub-and-spoke networking** as the enterprise hosting model.

### Agent Engine Posture

Vertex AI Agent Engine is an optional runtime substrate, not the architectural
baseline.

If adopted, it should be treated as a hosting choice for the agent runtime, not
as a replacement for:

- the AI Gateway
- the MCP Gateway
- HVSI and value-stream enforcement
- private connectivity to Redis, Knowledge API, or internal MCP services

The repo currently documents Agent Engine as optional. The end-state document
therefore treats it as a compute option behind the runtime plane rather than as
the default architectural assumption.

## Current-to-Target Mapping

| Current component    | End-state role                             | Transition note                                                                       |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Agentic BFF          | Experience plane and stream-selection gate | Continue signing scoped downstream requests; remove legacy fallback semantics         |
| Orchestrator Service | Agent runtime plane                        | Keep current role, but treat it as the runtime behind AI/MCP control planes           |
| LiteLLM Gateway      | Seed of AI Gateway                         | Mature into full model control plane with policy, routing, budgets, and observability |
| Knowledge API        | MCP-native server in the MCP catalog       | First-class governed tool server, not just a point integration                        |
| Ingestion Pipeline   | Stream-bound ingestion plane               | Must enforce explicit stream identity on all runtime ingest and connector flows       |
| Analytics Service    | Observability and governance data plane    | Aggregate audit, usage, eval, and readiness telemetry                                 |

## Transition Guidance

The transition from today's implementation to the target architecture should be
framed as a series of explicit moves:

1. Keep the current BFF -> orchestrator -> knowledge path while the control
   planes mature.
2. Move all model traffic behind the AI Gateway contract.
3. Move all governed tool traffic behind the MCP Gateway contract.
4. Replace department/global-style runtime semantics with value-stream/HVSI
   semantics.
5. Freeze stable, namespaced tool identities early.
6. Add conformance tests that prove stream isolation, tool governance, and
   fail-closed behavior.

The end state is not "replace everything at once." The end state is "preserve
one set of runtime invariants while changing where governance lives."

## Current Implementation Snapshot

The current repo still runs a concrete service topology that should be read as
the transition state, not the target itself.

Active platform services today:

- Agentic BFF
- Orchestrator Service
- Ingestion Pipeline Service
- Knowledge API
- Analytics Service

Important current-state notes:

- GKE is already the canonical production runtime for core services.
- Knowledge API is the current MCP-native server.
- LiteLLM is the current model gateway implementation.
- Some legacy `global` and null-stream behaviors still exist and are being
  removed under the HVSI plan.
- Agent Engine support exists in the repo but is optional and not the baseline
  architectural assumption.

## What This Means for Design Reviews

When reviewing a proposal against this architecture, ask these questions first:

1. What is the active value stream for the runtime call?
2. Which control plane governs this traffic: AI Gateway or MCP Gateway?
3. Is the component part of the runtime plane or the admin plane?
4. Does the design preserve fail-closed isolation?
5. Does the proposal keep stable platform-owned tool contracts?
6. Is the compute choice changing the architecture, or only the hosting
   substrate?

If a proposal answers these well, the rest is implementation detail.

## Related Documents

- [Hermetic Value Stream Isolation](../agentic/docs/HERMETIC-VALUE-STREAM-ISOLATION.md)
- [Value Stream Domain Model](../agentic/docs/VALUE-STREAM-DOMAIN-MODEL.md)
- [MCP Gateway and MCP Bus](./MCP_GATEWAY_AND_BUS.md)
- [AI Gateway Integration](./AI_GATEWAY_INTEGRATION.md)
- [Service Boundaries](./SERVICE_BOUNDARIES.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
