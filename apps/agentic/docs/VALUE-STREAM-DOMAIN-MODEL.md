# Value Stream Domain Model

> **Status**: Living Document v1.0
> **Author**: Platform Team
> **Date**: February 2026

---

## 1. What Is a Value Stream?

A **Value Stream** is the platform's unit of domain encapsulation. It represents a distinct business function within the organization (e.g., Pharmacy, Fresh Foods, Logistics) and acts as the central organizing entity that binds together:

- **An Agent** — a persona with specific instructions, behavior, and capabilities
- **A Knowledge Base** — domain-specific documents, SOPs, and policies
- **A Tool Set** — which MCP tools the agent can invoke
- **Guardrails** — safety and compliance rules tailored to the domain
- **Memory** — conversation and fact recall scoped to the domain
- **Users** — people authorized to interact with and manage the stream

Every user interaction on the platform is scoped to a value stream. The special `global` stream ("General HKI context") stays inside Agentic and uses broad HKI context for cross-domain queries.

```
┌─────────────────────────────────────────────────────────────────┐
│                        VALUE STREAM                             │
│                   (e.g. "pharmacy")                              │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Agent    │  │  Knowledge   │  │  Tools   │  │ Guardrails│  │
│  │  Config   │  │  Collections │  │  (MCP)   │  │           │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────┬─────┘  │
│       │               │               │              │         │
│       ▼               ▼               ▼              ▼         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Memory   │  │  Documents   │  │  Tool    │  │  Feedback  │  │
│  │  Store    │  │  & Chunks    │  │  Results │  │  Loop      │  │
│  └──────────┘  └──────────────┘  └──────────┘  └───────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Users (manager+ for curation, all roles for chat)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Relationship Model

### 2.1 Core Entities

```
┌──────────────────┐       ┌──────────────────────┐
│   Organization   │       │       User            │
│──────────────────│       │──────────────────────│
│ id (org_id)      │──┐    │ id                   │
│ name             │  │    │ name, email          │
│ sso_domain       │  │    │ role (RBAC)          │
│                  │  │    │ orgId ───────────────│──┐
└──────────────────┘  │    │ valueStreams (csv)    │  │
                      │    └──────────┬───────────┘  │
                      │               │M:N           │
                      │    ┌──────────┴───────────┐  │
                      │    │  userValueStreams     │  │
                      │    │──────────────────────│  │
                      │    │ userId ──────────────│──┘
                      │    │ valueStreamId ───────│──┐
                      │    │ assignedAt           │  │
                      │    └─────────────────────┘  │
                      │                              │
          ┌───────────┴──────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                    VALUE STREAM                          │
│─────────────────────────────────────────────────────────│
│ id            VARCHAR(64) PK   "pharmacy"               │
│ name          VARCHAR(128)     "Pharmacy Operations"    │
│ description   TEXT                                       │
│ icon          VARCHAR(8)       "💊"                      │
│                                                         │
│ ── Agent Definition ──                                  │
│ systemPrompt        TEXT       persona instructions     │
│ retrievalStrategy   VARCHAR    semantic|hybrid|graph    │
│ enabledTools        JSON[]     ["search_knowledge",..] │
│ guardrailConfig     JSON       {input,output,pii,tox}  │
│ memoryConfig        JSON       {enabled,threshold}     │
│ sampleQuestions     JSON[]     welcome screen prompts   │
│                                                         │
│ isActive      TINYINT                                   │
│ createdAt     TIMESTAMP                                 │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 1:N (proposed — knowledge_collections)
           ▼
┌─────────────────────────────────────────────────────────┐
│              KNOWLEDGE COLLECTION (proposed)             │
│─────────────────────────────────────────────────────────│
│ id            VARCHAR(64) PK                            │
│ valueStreamId VARCHAR(64) FK → valueStreams             │
│ orgId         VARCHAR(128)                              │
│ name          VARCHAR(128)  "Pharmacy SOPs"             │
│ description   TEXT                                       │
│ department    VARCHAR(64)   filter for vector queries   │
│ docType       VARCHAR(32)   default doc type            │
│ tags          JSON[]        auto-applied tags           │
│ isActive      TINYINT                                   │
│ createdAt     TIMESTAMP                                 │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 1:N (documents belong to a collection)
           ▼
┌─────────────────────────────────────────────────────────┐
│                    DOCUMENT                              │
│            (AlloyDB — knowledge-api)              │
│─────────────────────────────────────────────────────────│
│ id            TEXT PK          UUID                      │
│ org_id        TEXT             tenant isolation          │
│ content       TEXT             full source text          │
│ title         TEXT                                       │
│ department    TEXT             "Pharmacy"                │
│ document_type TEXT             "sop"                     │
│ tags          TEXT[]           ["rx","compliance"]       │
│ status        ENUM             pending→indexed→archived │
│ chunk_count   INT                                       │
│ created_at    TIMESTAMPTZ                               │
│ updated_at    TIMESTAMPTZ                               │
└──────────┬──────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────────────────────────────────┐
│                      CHUNK                               │
│─────────────────────────────────────────────────────────│
│ id            TEXT PK                                    │
│ document_id   TEXT FK → documents                       │
│ org_id        TEXT                                       │
│ content       TEXT             ~200-800 tokens           │
│ embedding     vector(768)     Vertex AI embedding       │
│ search_vector tsvector        PostgreSQL FTS            │
│ position      INT             ordinal in document       │
│ token_count   INT                                       │
│ metadata      JSONB                                     │
└──────────┬──────────────────────────────────────────────┘
           │
           │ N:M (knowledge graph)
           ▼
┌─────────────────────────────────────────────────────────┐
│                    ENTITY (Neo4j)                        │
│─────────────────────────────────────────────────────────│
│ id            TEXT                                       │
│ org_id        TEXT             tenant isolation          │
│ name          TEXT             "Amoxicillin"             │
│ entity_type   ENUM             person|org|product|concept│
│ properties    MAP                                       │
│ mention_count INT                                       │
│                                                         │
│ Relationships:                                          │
│   (Entity)-[:MENTIONED_IN]->(Chunk)                     │
│   (Entity)-[:RELATED_TO]->(Entity)                      │
│   (Document)-[:CONTAINS]->(Chunk)                       │
│   (Chunk)-[:NEXT]->(Chunk)                              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Runtime Entities

```
┌───────────────────────────────────────────────────────────┐
│                   CONVERSATION                             │
│───────────────────────────────────────────────────────────│
│ id         VARCHAR(64)                                     │
│ userId     INT FK → users                                 │
│ scope      VARCHAR(64)   "pharmacy"  ← sticky per convo  │
│ projectId  VARCHAR(64)   optional grouping                │
│ title      TEXT                                            │
└────────┬──────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌───────────────────────────────────────────────────────────┐
│                     MESSAGE                                │
│───────────────────────────────────────────────────────────│
│ id              VARCHAR(64)                                │
│ conversationId  VARCHAR(64) FK                             │
│ role            ENUM  user|assistant|system                │
│ content         TEXT                                        │
│ confidence      INT    0-100                               │
│ citations       JSON   [{doc_id, title, score, ...}]      │
│ guardrails      JSON   {passed, violations, score}        │
│ thoughtTrace    JSON                                       │
│ toolCalls       JSON                                       │
└────────┬──────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌───────────────────────────────────────────────────────────┐
│               THOUGHT TRACE STEP                           │
│───────────────────────────────────────────────────────────│
│ type: thinking|planning|tool_call|tool_result|guardrail   │
│       |knowledge_retrieval|memory_recall|final_response   │
│ content, metadata                                          │
└───────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌───────────────────────────────────────────────────────────┐
│                TOOL EXECUTION                              │
│───────────────────────────────────────────────────────────│
│ toolName   "search_knowledge" | "check_inventory" | ...   │
│ input      JSON                                            │
│ output     JSON                                            │
│ status     pending|running|success|error                  │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Relationship Map

### 3.1 Value Stream → Knowledge Base

**Current state**: Knowledge is scoped by `org_id` (organization) but not by value stream. The `department` field on documents is the closest approximation.

**Target state**: A `knowledge_collections` join entity links value streams to subsets of the knowledge base, but collections are not sufficient as the security boundary for complete isolation.

The platform is standardizing on Hermetic Value Stream Isolation (HVSI): every runtime artifact belongs to exactly one stream, every runtime request executes in exactly one stream, and null-stream visibility is eliminated from runtime retrieval.

Use `knowledge_collections` for organization and targeting, but use explicit `stream_id` enforcement across BFF, ingestion, vector storage, graph storage, and orchestrator flows for actual isolation.

See `apps/ai-platform/agentic/docs/HERMETIC-VALUE-STREAM-ISOLATION.md` for the target architecture and migration plan.

```
Value Stream "pharmacy"
  │
  ├── Collection: "Pharmacy SOPs"         → 142 documents, 3,420 chunks
  ├── Collection: "Drug Interaction DB"   → 8,901 documents, 45,200 chunks
  └── Collection: "State Regulations"     → 67 documents, 890 chunks
                                            ────────────────
                                            9,110 documents total

Value Stream "fresh-foods"
  │
  ├── Collection: "USDA Standards"        → 234 documents
  ├── Collection: "Cold Chain SOPs"       → 45 documents
  └── Collection: "Recall Procedures"     → 12 documents
```

**How collections scope retrieval**:

```python
# In orchestrator, before calling search_knowledge tool:
scope = request.scope  # "pharmacy"

# Option A: Filter by department (current — coarse)
search_knowledge(query, departments=["pharmacy"])

# Option B: Filter by collection tags (proposed — precise)
collections = get_collections_for_stream("pharmacy")
search_knowledge(query, tags=["pharmacy-sops", "drug-interactions"])
```

### 3.2 Value Stream → Agent Configuration

Each stream defines a complete agent persona:

| Field               | Purpose                                                        | Example (Pharmacy)                                                                                                                     |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `systemPrompt`      | LLM system message — defines persona, tone, domain constraints | "You are a pharmacy operations expert at HKI. You help pharmacists with drug interactions, fill rates, controlled substance audits..." |
| `retrievalStrategy` | Which search mode to use for knowledge lookup                  | `hybrid` (vector + keyword)                                                                                                            |
| `enabledTools`      | Which MCP tools the agent can invoke                           | `["search_knowledge", "pharmacy_metrics", "check_inventory"]`                                                                          |
| `guardrailConfig`   | Input/output safety checks                                     | `{inputValidation: true, piiDetection: true, ...}`                                                                                     |
| `memoryConfig`      | Whether to cache and recall across conversations               | `{enabled: true, similarityThreshold: 0.85}`                                                                                           |
| `sampleQuestions`   | Welcome screen prompts                                         | `["What are today's fill rates?", "Show controlled substance audit"]`                                                                  |

**Runtime flow**: The BFF reads the stream's agent config and forwards it to the orchestrator as part of the `OrchestrateRequest`. The orchestrator:

1. Selects the system prompt (stream's `systemPrompt` or falls back to built-in persona)
2. Injects scope context ("Restrict answers to the pharmacy domain")
3. Filters tool definitions to only the stream's `enabledTools`
4. Applies guardrail configuration to input/output checks
5. Uses memory config to control recall behavior

### 3.3 Value Stream → Tools (MCP)

Tools are discovered dynamically from MCP servers at orchestrator startup. The value stream's `enabledTools` array acts as an allowlist filter:

```
┌───────────────────────────────────────────────────────────┐
│                   MCP Tool Registry                        │
│───────────────────────────────────────────────────────────│
│  knowledge MCP server:                                     │
│    ├── search_knowledge        (hybrid search)            │
│    ├── list_documents          (browse indexed docs)      │
│    ├── ingest_text / ingest_url (add content)             │
│    ├── graph_neighbors         (related content)          │
│    ├── search_entities         (Neo4j entity search)      │
│    ├── entity_context          (multi-hop reasoning)      │
│    └── knowledge_stats                                     │
│                                                            │
│  retail-tools MCP server:                                  │
│    ├── search_products         (product catalog)          │
│    ├── check_inventory         (real-time stock)          │
│    ├── get_pricing             (pricing & margins)        │
│    ├── get_member_info         (member lookup)            │
│    ├── check_order_status      (order tracking)           │
│    ├── analyze_sales           (analytics)                │
│    ├── pharmacy_metrics        (Rx-specific KPIs)         │
│    └── department_performance  (dept KPIs)                │
└───────────────────────────────────────────────────────────┘

Value Stream "pharmacy" enables:
  ✅ search_knowledge
  ✅ pharmacy_metrics
  ✅ check_inventory
  ✅ get_pricing
  ❌ analyze_sales        (not relevant)
  ❌ get_member_info      (not authorized)
  ❌ search_products      (not relevant)

Value Stream "merchandising" enables:
  ✅ search_knowledge
  ✅ search_products
  ✅ get_pricing
  ✅ analyze_sales
  ✅ check_inventory
  ❌ pharmacy_metrics     (not authorized)
```

### 3.4 Value Stream → Users (RBAC)

```
┌────────────────────────────────────────────────┐
│              User → Stream Assignment           │
│────────────────────────────────────────────────│
│                                                │
│  Admin     → All streams + global              │
│  Manager   → Assigned streams + global         │
│  Operator  → Assigned streams + global         │
│  Viewer    → Assigned streams + global         │
│                                                │
│  Role-based capabilities per stream:           │
│  ┌──────────┬────────┬────────┬────────┐      │
│  │ Action   │ Admin  │Manager │Operator│      │
│  ├──────────┼────────┼────────┼────────┤      │
│  │ Chat     │  ✅    │  ✅    │  ✅    │      │
│  │ Browse KB│  ✅    │  ✅    │  ✅    │      │
│  │ Ingest   │  ✅    │  ✅    │  ❌    │      │
│  │ Delete   │  ✅    │  ✅    │  ❌    │      │
│  │ Test     │  ✅    │  ✅    │  ✅    │      │
│  │ Gaps     │  ✅    │  ✅    │  ❌    │      │
│  │ Config   │  ✅    │  ❌    │  ❌    │      │
│  └──────────┴────────┴────────┴────────┘      │
└────────────────────────────────────────────────┘
```

### 3.5 Value Stream → Memory

Memory is currently user-scoped (`user:{id}`). The target model adds stream-scoping:

```
┌────────────────────────────────────────────────────────────┐
│                   Memory Architecture                       │
│────────────────────────────────────────────────────────────│
│                                                            │
│  Semantic Memory    user preferences, learned facts        │
│    scope: user:{id}                                        │
│    target: user:{id}:stream:{streamId}                     │
│                                                            │
│  Episodic Memory    recent conversation summaries          │
│    scope: user:{id}                                        │
│    target: user:{id}:stream:{streamId}                     │
│                                                            │
│  Procedural Memory  learned multi-step workflows           │
│    scope: user:{id}                                        │
│    target: stream:{streamId}  (shared across users)        │
│                                                            │
│  Declarative Memory global rules, policies                 │
│    scope: global | stream:{streamId}                       │
│    target: stream-specific rules ("Pharmacy must cite..."  │
│            "Never recommend controlled substances...")      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3.6 Value Stream → Guardrails

Guardrails are both global (platform-level) and stream-specific:

```
Platform Guardrails (always on):
  ├── Prompt injection detection
  ├── Token budget enforcement
  └── Rate limiting

Stream Guardrails (configurable per stream):
  ├── inputValidation    — reject malformed / off-topic queries
  ├── outputValidation   — verify response meets quality bar
  ├── piiDetection       — mask/block PII in input or output
  └── toxicityFilter     — block harmful content

Domain-Specific Rules (future — per stream):
  ├── Pharmacy: "Never recommend drug dosages without citing FDA source"
  ├── Fresh Foods: "Always include USDA recall status for food items"
  └── Finance: "Redact any revenue figures above warehouse-level aggregation"
```

### 3.7 Value Stream → Conversations

Conversations are **scope-sticky**: the stream is set at conversation creation and persists for the lifetime of that conversation.

```
Conversation "abc123"
  scope: "pharmacy"           ← set at creation, never changes
  messages:
    [user]  "What are today's fill rates?"
    [agent] "Based on pharmacy metrics..."  (scope: pharmacy)
    [user]  "How about optical?"
    [agent] "I'm focused on pharmacy for this conversation.
             Switch to the Optical stream for optical queries."
```

### 3.8 Value Stream → Feedback Loop

```
User asks question
  → Agent responds (with citations)
    → User gives 👍 or 👎
      │
      ├── 👍 → Memory store (cache for similar queries)
      │       → Reinforces document relevance weights
      │
      └── 👎 → Gap detection signal
              → "Query X had low-quality response in stream Y"
              → Surfaces in Gaps tab for manager review
              → Manager ingests missing content → coverage improves
```

---

## 4. Data Flow: Value Stream Lifecycle

### 4.1 Onboarding a New Value Stream

```
Step 1: Admin creates stream
  ┌─────────────────────────────────────────────────┐
  │  POST /admin.createValueStream                   │
  │  {                                               │
  │    id: "pharmacy",                               │
  │    name: "Pharmacy Operations",                  │
  │    icon: "💊",                                    │
  │    description: "...",                            │
  │    systemPrompt: "You are a pharmacy expert...", │
  │    retrievalStrategy: "hybrid",                  │
  │    enabledTools: ["search_knowledge",            │
  │                   "pharmacy_metrics"],            │
  │    guardrailConfig: {...},                        │
  │    memoryConfig: {...},                           │
  │    sampleQuestions: [...]                         │
  │  }                                               │
  └─────────────────────────────────────────────────┘
          │
          ▼
Step 2: Admin assigns users
  ┌─────────────────────────────────────────────────┐
  │  POST /admin.assignValueStreams                   │
  │  { userId: 42, valueStreamIds: ["pharmacy"] }    │
  └─────────────────────────────────────────────────┘
          │
          ▼
Step 3: Manager ingests knowledge (self-service)
  ┌─────────────────────────────────────────────────┐
  │  /knowledge?stream=pharmacy (Sources tab)        │
  │                                                  │
  │  Upload: pharmacy-sops.pdf                       │
  │  Crawl:  https://fda.gov/drug-interactions       │
  │  Text:   "Controlled substance handling..."      │
  │                                                  │
  │  Pipeline: Extract → Chunk → Embed → Index       │
  │            → Entity extraction → Graph build      │
  └─────────────────────────────────────────────────┘
          │
          ▼
Step 4: Manager tests retrieval
  ┌─────────────────────────────────────────────────┐
  │  /knowledge?stream=pharmacy (Test tab)           │
  │                                                  │
  │  Query: "What is the protocol for handling       │
  │          controlled substance discrepancies?"    │
  │                                                  │
  │  Results: 5 chunks, 92% relevance, 45ms          │
  └─────────────────────────────────────────────────┘
          │
          ▼
Step 5: Users start chatting
  ┌─────────────────────────────────────────────────┐
  │  /chat (scope: pharmacy)                         │
  │                                                  │
  │  User:  "What are today's fill rates?"           │
  │  Agent: calls pharmacy_metrics tool              │
  │         calls search_knowledge for context       │
  │         responds with data + citations           │
  └─────────────────────────────────────────────────┘
```

### 4.2 Runtime Request Flow

```
User message ("What are fill rates?")
  │
  ▼
BFF (chat.ts)
  │  Reads conversation.scope = "pharmacy"
  │  Reads user.scopes = ["global", "pharmacy"]
  │  Builds OrchestrateRequest { scope: "pharmacy", scopes: [...] }
  │
  ▼
Orchestrator
  │
  ├── 1. Input Guardrails (stream's guardrailConfig)
  │      inputValidation: true → validate query
  │      piiDetection: true → scan for PII
  │
  ├── 2. Intent Router
  │      "fill rates" → supervisor agent
  │
  ├── 3. Memory Recall
  │      user:42:stream:pharmacy → previous pharmacy interactions
  │
  ├── 4. Build System Prompt
  │      stream.systemPrompt + scope restriction + memory context
  │
  ├── 5. Filter Tools
  │      stream.enabledTools → ["search_knowledge", "pharmacy_metrics"]
  │      tool_defs = registry.filter(enabledTools)
  │
  ├── 6. ReAct Loop
  │      LLM decides: call pharmacy_metrics(warehouse_id=null)
  │      → tool returns fill rate data
  │      LLM decides: call search_knowledge("fill rate protocols")
  │      → hybrid search → top 5 chunks (scoped by department)
  │      LLM generates final response with citations
  │
  ├── 7. Output Guardrails
  │      outputValidation: true → verify response quality
  │      toxicityFilter: true → scan output
  │
  ├── 8. Store Episode
  │      memory.store_episode(user:42, "Asked about fill rates...")
  │
  └── 9. Final Response → BFF → WebSocket → UI
```

---

## 5. Use Cases by Domain

### 5.1 Pharmacy

| Aspect             | Configuration                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Persona**        | Pharmacy operations expert. Cite FDA sources. Never recommend dosages directly.                 |
| **Knowledge**      | Drug interaction databases, pharmacy SOPs, state regulations, controlled substance procedures   |
| **Tools**          | `search_knowledge`, `pharmacy_metrics`, `check_inventory`                                       |
| **Guardrails**     | PII detection (patient data), high output validation (medical accuracy)                         |
| **Sample Queries** | "Today's fill rates?", "Controlled substance audit", "Drug interaction: metformin + lisinopril" |
| **Unique Needs**   | HIPAA compliance awareness, DEA schedule classification, state-specific regulations             |

### 5.2 Fresh Foods

| Aspect             | Configuration                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Persona**        | Fresh food operations specialist. Prioritize food safety. Always cite USDA/FDA standards.   |
| **Knowledge**      | USDA food safety standards, cold chain SOPs, recall procedures, vendor quality specs        |
| **Tools**          | `search_knowledge`, `check_inventory`, `department_performance`                             |
| **Guardrails**     | Standard + date-sensitivity (flag stale recall data)                                        |
| **Sample Queries** | "Cold chain break protocol", "Recall status for romaine lettuce", "Shrink rate by category" |
| **Unique Needs**   | Real-time recall monitoring, temperature compliance, expiration tracking                    |

### 5.3 Merchandising

| Aspect             | Configuration                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Persona**        | Merchandising and buying analyst. Focus on margins, trends, and vendor negotiations.                 |
| **Knowledge**      | Pricing strategies, vendor contracts, category management playbooks, competitive analysis            |
| **Tools**          | `search_knowledge`, `search_products`, `get_pricing`, `analyze_sales`, `check_inventory`             |
| **Guardrails**     | Standard + financial data aggregation rules                                                          |
| **Sample Queries** | "Top margin categories this month", "Price index vs competitors for electronics", "Vendor scorecard" |
| **Unique Needs**   | Seasonal planning, promotion calendar, private label (Kirkland) analytics                            |

### 5.4 Logistics & Supply Chain

| Aspect             | Configuration                                                                         |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Persona**        | Supply chain operations specialist. Optimize for cost and speed.                      |
| **Knowledge**      | Warehouse procedures, carrier contracts, customs documentation, routing algorithms    |
| **Tools**          | `search_knowledge`, `check_inventory`, `check_order_status`, `department_performance` |
| **Guardrails**     | Standard                                                                              |
| **Sample Queries** | "In-transit orders for WH-SEA", "Carrier on-time performance", "Cross-dock capacity"  |
| **Unique Needs**   | Multi-depot optimization, customs compliance, last-mile delivery tracking             |

### 5.5 Optical

| Aspect             | Configuration                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Persona**        | Optical department specialist. Help with product selection, insurance, and scheduling.     |
| **Knowledge**      | Lens catalog, insurance coverage matrices, exam protocols, frame specifications            |
| **Tools**          | `search_knowledge`, `search_products`, `get_pricing`                                       |
| **Guardrails**     | PII detection (patient insurance), medical accuracy validation                             |
| **Sample Queries** | "Progressive lens options under $200", "VSP coverage for contact exams", "Frame inventory" |
| **Unique Needs**   | Insurance plan integration, prescription tracking, appointment scheduling                  |

### 5.6 General HKI Context (Global)

| Aspect             | Configuration                                                                      |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Persona**        | General-purpose HKI assistant. Cross-domain. Knows a little about everything.      |
| **Knowledge**      | Company-wide policies, HR handbook, IT help desk, general SOPs                     |
| **Tools**          | All tools enabled                                                                  |
| **Guardrails**     | All guardrails enabled                                                             |
| **Sample Queries** | "What's the return policy?", "How do I submit a PTO request?", "IT password reset" |
| **Unique Needs**   | Broad Agentic context; use domain-specific streams when the scope is known         |

---

## 6. Architectural Gap Analysis

### 6.1 What Exists Today

| Component                     | Status         | Location                                                                     |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------- |
| Value Stream CRUD             | ✅ Implemented | `server/admin.ts`, `drizzle/schema.ts`                                       |
| User ↔ Stream assignment      | ✅ Implemented | `userValueStreams` join table                                                |
| Scope-aware routing           | ✅ Implemented | `OrchestrateRequest.scope` → system prompt injection                         |
| Agent persona (system prompt) | ✅ Implemented | `valueStreams.systemPrompt` stored, but not yet forwarded to orchestrator    |
| Tool allowlist                | ✅ Implemented | `valueStreams.enabledTools` stored, but not yet forwarded to orchestrator    |
| Guardrail config              | ✅ Implemented | `valueStreams.guardrailConfig` stored, but not yet forwarded to orchestrator |
| Memory config                 | ✅ Implemented | `valueStreams.memoryConfig` stored, but not yet forwarded to orchestrator    |
| Knowledge ingestion           | ✅ Implemented | `knowledge-pipeline-service`, `knowledge-api`                                |
| Knowledge UI (4 tabs)         | ✅ Implemented | `pages/knowledge/index.tsx`                                                  |
| Multi-tenant isolation        | ✅ Implemented | `org_id` on all data, RLS in AlloyDB, JWT-based                              |
| Stream form (3-tab wizard)    | ✅ Implemented | `StreamsPage.tsx` Identity/Agent/Knowledge tabs                              |

### 6.2 What's Missing (Priority Order)

| Gap                                   | Impact    | Effort | Description                                                                                                                           |
| ------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **BFF → Orchestrator bridge**         | 🔴 High   | Medium | Stream's `systemPrompt`, `enabledTools`, `guardrailConfig`, `memoryConfig` must be read from DB and forwarded in `OrchestrateRequest` |
| **Knowledge Collections**             | 🔴 High   | Medium | New entity linking streams to document subsets. Enables stream-scoped retrieval instead of org-wide search                            |
| **Stream-scoped search filter**       | 🔴 High   | Small  | When searching knowledge within a stream, filter by collection/department/tags                                                        |
| **Gemini-assisted onboarding**        | 🟡 Medium | Medium | Admin describes domain → Gemini generates persona, tool suggestions, knowledge plan                                                   |
| **Stream-scoped memory**              | 🟡 Medium | Small  | Extend memory keys from `user:{id}` to `user:{id}:stream:{streamId}`                                                                  |
| **Stream-specific declarative rules** | 🟡 Medium | Small  | Per-stream rules in declarative memory ("Pharmacy must cite FDA sources")                                                             |
| **Gap detection pipeline**            | 🟡 Medium | Large  | Analyze queries with low-confidence responses → surface as knowledge gaps                                                             |
| **Connector management**              | 🟢 Low    | Large  | Google Drive, Confluence, SharePoint sync per stream                                                                                  |
| **Stream analytics dashboard**        | 🟢 Low    | Medium | Query volume, response quality, coverage score per stream                                                                             |

### 6.3 Proposed Schema Addition: Knowledge Collections

```sql
-- Migration 0007: knowledge_collections
CREATE TABLE IF NOT EXISTS knowledgeCollections (
  id            VARCHAR(64) PRIMARY KEY,
  valueStreamId VARCHAR(64) NOT NULL,
  orgId         VARCHAR(128) NOT NULL DEFAULT 'default',
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  department    VARCHAR(64),        -- maps to document.department filter
  defaultDocType VARCHAR(32) DEFAULT 'general',
  autoTags      TEXT,               -- JSON array of tags auto-applied on ingest
  isActive      TINYINT NOT NULL DEFAULT 1,
  createdAt     TIMESTAMP NOT NULL,
  updatedAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (valueStreamId) REFERENCES valueStreams(id) ON DELETE CASCADE
);

CREATE INDEX idx_kc_stream ON knowledgeCollections (valueStreamId);
CREATE INDEX idx_kc_org ON knowledgeCollections (orgId);
```

### 6.4 Proposed: BFF → Orchestrator Config Forwarding

```typescript
// In server/chat.ts — when calling orchestrator
const stream = await db
  .select()
  .from(valueStreams)
  .where(eq(valueStreams.id, scope))
  .limit(1);

const request: OrchestrateRequest = {
  conversation_id,
  message,
  user_id,
  history,
  scope,
  scopes: userScopes,
  config: {
    agent_type: "supervisor",
    // ── Stream-specific overrides ──
    system_prompt: stream?.systemPrompt || undefined,
    enabled_tools: stream?.enabledTools
      ? JSON.parse(stream.enabledTools)
      : undefined,
    retrieval_strategy: stream?.retrievalStrategy || "hybrid",
    guardrail_config: stream?.guardrailConfig
      ? JSON.parse(stream.guardrailConfig)
      : undefined,
    memory_config: stream?.memoryConfig
      ? JSON.parse(stream.memoryConfig)
      : undefined,
  },
};
```

---

## 7. Summary: The Complete Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION (org_id)                         │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Pharmacy   │  │ Fresh Foods │  │  Logistics  │  ...        │
│  │  Stream     │  │  Stream     │  │  Stream     │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                    │
│    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐               │
│    │ Agent   │     │ Agent   │     │ Agent   │               │
│    │ Persona │     │ Persona │     │ Persona │               │
│    │ + Tools │     │ + Tools │     │ + Tools │               │
│    │ + Rails │     │ + Rails │     │ + Rails │               │
│    └────┬────┘     └────┬────┘     └────┬────┘               │
│         │                │                │                    │
│    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐               │
│    │Knowledge│     │Knowledge│     │Knowledge│               │
│    │  Colls  │     │  Colls  │     │  Colls  │               │
│    └────┬────┘     └────┬────┘     └────┬────┘               │
│         │                │                │                    │
│         └────────────────┴────────────────┘                    │
│                          │                                     │
│                    ┌─────┴─────┐                               │
│                    │ Shared    │                               │
│                    │ Knowledge │  AlloyDB + Neo4j              │
│                    │ Store     │  (org_id scoped)              │
│                    └─────┬─────┘                               │
│                          │                                     │
│                    ┌─────┴─────┐                               │
│                    │ MCP Tool  │                               │
│                    │ Registry  │  knowledge + retail-tools     │
│                    └───────────┘                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Users (assigned to streams, scoped by role)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │ General HKI context │  (global — broad Agentic context)     │
│  │ ✨ All tools     │                                          │
│  │    All knowledge │                                          │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

A Value Stream is not just a label — it is the **complete specification of an AI agent's identity, knowledge, capabilities, and constraints** within a business domain. Every line of code on the platform ultimately resolves back to "which stream is this request for?"
