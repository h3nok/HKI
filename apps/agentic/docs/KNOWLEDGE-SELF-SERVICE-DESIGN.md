# Knowledge Self-Service — Design Document

> **Status**: Draft v1.0
> **Author**: Platform Team
> **Date**: February 2026

---

## 1. Overview

The Knowledge Self-Service system enables **domain experts (manager+ role)** to curate, manage, and test the knowledge that powers each value stream's agent — without requiring platform engineering support.

This design is grounded in the platform's two core knowledge patterns:

| Pattern                     | Description                                                                                                                   | When to Use                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **D2K (Data to Knowledge)** | Source data is extracted, chunked, contextualized, and embedded into a vector store. Requires incremental ingestion pipeline. | Documents, SOPs, policies, manuals — content that changes infrequently and benefits from deep indexing |
| **K2D (Knowledge to Data)** | Data stays in source systems. Only metadata/knowledge graph is persisted. Data fetched at runtime.                            | Live operational data (inventory, pricing, order status) that changes constantly                       |

The self-service UI primarily serves the **D2K pattern** — helping managers get their domain knowledge into the pipeline. K2D patterns are configured at the platform level (connectors, federation).

---

## 2. Architecture Context

### 2.1 D2K Ingestion Pipeline

```
Raw Document (PDF, URL, Text)
  │
  ▼
Cloud Storage (landing zone)
  │
  ▼ Pub/Sub trigger
Layout Parsing & Chunking (Document AI)
  │
  ▼
Chunks → Cloud Storage
  │
  ▼ Pub/Sub trigger
Chunk Contextualization (Gemini creates context summary per chunk)
  │
  ▼
Contextualized Chunks → Cloud Storage
  │
  ▼ Pub/Sub trigger
Embedding Process
  ├── AlloyDB pgvector (vector indexing)
  ├── Neo4j (knowledge graph — document graph from layout config)
  └── Vertex AI Vector Search (optional managed store)
```

### 2.2 Knowledge Serving Layer

```
Knowledge Retrieval Services
  ├── Semantic Search (AlloyDB pgvector)
  ├── Hybrid Search   (vector + keyword)
  └── Graph Search    (Neo4j traversal)
```

### 2.3 Agent Orchestration Flow

```
User Query → Router Agent
  │
  ├── Input Guardrails (domain-specific)
  │
  ├── Memory Agent → Memory Store
  │     └── If similarity score > threshold → return cached response
  │
  ├── Retrieval Agent → Knowledge Service
  │     └── Semantic / Hybrid / Graph Search → relevant context
  │
  ├── Generation Agent → Gemini LLM
  │     └── Prompt (from registry) + retrieved context → response
  │
  ├── Output Guardrails → validate response
  │
  └── Router Agent → User
        │
        └── User Feedback → Feedback Agent
              ├── Feedback Store
              └── Memory Store (thumbs up → cached for similar queries)
```

### 2.4 D2K Sub-Patterns

| Sub-Pattern                | Description                                                                                         | Self-Service Role                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Custom RAG**             | Custom chunking/retrieval strategies for finer control over context engineering                     | Admin configures chunking strategy; manager uploads content       |
| **Gemini Enterprise RAG**  | Fully managed, no-code, configuration-driven. Built-in connectors for 3rd party/Google data sources | Platform team configures connectors; manager monitors sync status |
| **Custom + AlloyDB**       | Custom extract/chunk/contextualize → AlloyDB vector indexing                                        | Manager uploads; pipeline handles processing                      |
| **Custom + Vector Search** | Managed vector DB (Vertex AI Vector Search) for indexing                                            | Platform team configures; manager uploads content                 |

> **Decision criteria**: Start with Custom + AlloyDB (current implementation). Experiment across patterns to find the goldilocks zone of **cost, accuracy, and latency** per value stream.

---

## 3. User Roles & Permissions

| Role         | Knowledge Capabilities                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| **Admin**    | Full access: configure pipelines, manage all streams' knowledge, set guardrails, view all analytics    |
| **Manager**  | Self-service: ingest documents, browse library, test search, view gaps — scoped to their value streams |
| **Operator** | Read-only: browse library, test search (no ingest or delete)                                           |
| **Viewer**   | No direct knowledge access (consumes via chat agent)                                                   |

Already implemented:

- `managerProcedure` in tRPC (manager+ auth)
- `knowledge:read`, `knowledge:write`, `knowledge:manage` permissions in RBAC
- `org_id` tenant isolation through JWT

---

## 4. Value Stream → Agent Definition

When creating or editing a value stream, the admin defines the agent's knowledge needs.

### 4.1 Stream Form Enhancement (new "Agent" tab)

```
┌─────────────────────────────────────────────────────────┐
│  Value Stream: Pharmacy                                  │
│  ┌──────────┐ ┌───────┐ ┌────────────┐                  │
│  │ Identity │ │ Agent │ │ Knowledge  │                   │
│  └──────────┘ └───────┘ └────────────┘                   │
│                                                          │
│  AGENT tab:                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ System Persona                                      │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ You are a pharmacy operations expert at       │   │  │
│  │ │ HKI. You help pharmacists with drug        │   │  │
│  │ │ interactions, inventory management, and...    │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  │ [✨ Generate with Gemini]                           │  │
│  │                                                     │  │
│  │ Retrieval Strategy                                  │  │
│  │ ○ Semantic Search  ● Hybrid Search  ○ Graph Search  │  │
│  │                                                     │  │
│  │ Enabled Tools                                       │  │
│  │ ☑ search_knowledge  ☑ search_products               │  │
│  │ ☐ check_inventory   ☐ get_pricing                   │  │
│  │                                                     │  │
│  │ Guardrails                                          │  │
│  │ ☑ Input validation  ☑ PII detection                 │  │
│  │ ☑ Output validation ☑ Toxicity filter               │  │
│  │                                                     │  │
│  │ Memory                                              │  │
│  │ Similarity threshold: [0.85] ────────●──            │  │
│  │ ☑ Cache positive feedback responses                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  KNOWLEDGE tab:                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Knowledge Collections assigned to this stream:      │  │
│  │                                                     │  │
│  │ ☑ Pharmacy SOPs         (142 docs, 3,420 chunks)   │  │
│  │ ☑ Drug Interaction DB   (8,901 docs, 45,200 chunks)│  │
│  │ ☐ General HKI Policy (234 docs, 5,100 chunks)   │  │
│  │                                                     │  │
│  │ [+ Add Collection] [📖 Open Knowledge Base]         │  │
│  │                                                     │  │
│  │ Coverage Score: ██████████░░ 78%                    │  │
│  │ 3 gaps detected — "No docs covering controlled      │  │
│  │ substance handling procedures"                      │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Gemini-Assisted Agent Definition

When the admin clicks "Generate with Gemini":

1. Admin describes the business domain in plain English
2. Gemini generates:
   - System persona/prompt
   - Suggested retrieval strategy
   - Recommended tools to enable
   - Guardrail configuration
   - List of knowledge topics the agent needs
3. Admin reviews, edits, and saves

---

## 5. Knowledge Self-Service UI

### 5.1 Page Structure

Accessible at `/knowledge` (manager+ auth). Scoped to the user's assigned value streams.

```
┌─────────────────────────────────────────────────────────┐
│  📖 Knowledge Base                                       │
│  Self-Service · Data → Knowledge Pipeline                │
│                                                          │
│  Stream: [Pharmacy ▾]  (scope selector)                  │
│                                                          │
│  ┌──────────┐ ┌─────────┐ ┌──────┐ ┌──────────────┐     │
│  │ Sources  │ │ Library │ │ Gaps │ │ Test & Verify│     │
│  └──────────┘ └─────────┘ └──────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Sources Tab

**Purpose**: Manage where knowledge comes from. Maps to the D2K ingestion pipeline entry points.

```
MANUAL INGESTION
┌────────────────────────────┐ ┌────────────────────────────┐
│  📄 Upload Documents       │ │  🔗 Crawl URL              │
│  PDF, DOCX, TXT, CSV      │ │  Enter URL to crawl        │
│  Drag & drop or browse     │ │  Depth: [1] pages          │
│                            │ │  Schedule: [One-time ▾]    │
│  Metadata:                 │ │                            │
│  Department: [Pharmacy ▾]  │ │  Metadata:                 │
│  Doc Type: [SOP ▾]        │ │  Department: [Pharmacy ▾]  │
│  Tags: [rx, compliance]   │ │  Tags: [regulations]       │
│                            │ │                            │
│  [Upload & Ingest]         │ │  [Crawl & Ingest]          │
└────────────────────────────┘ └────────────────────────────┘

✨ GEMINI-ASSISTED
┌────────────────────────────────────────────────────────────┐
│  "Describe what this stream needs to know and I'll help    │
│   you plan what to ingest"                                 │
│                                                            │
│  [Tell Gemini about your domain...]                        │
│                                                            │
│  Gemini suggests:                                          │
│  • "Upload your pharmacy SOP manual (PDF)"                 │
│  • "Crawl FDA drug interaction database"                   │
│  • "Add controlled substance handling procedures"          │
│  • "Ingest state-specific pharmacy regulations"            │
│                                                            │
│  [Accept Plan] [Edit] [Dismiss]                            │
└────────────────────────────────────────────────────────────┘

CONNECTORS (Platform-configured, read-only for managers)
┌──────────────────────────────────────────────────────────┐
│  Google Drive    ● Connected   Last sync: 2 min ago      │
│  Confluence      ● Connected   Last sync: 1 hour ago     │
│  SharePoint      ○ Not configured                        │
│                                                          │
│  [Request new connector →]                               │
└──────────────────────────────────────────────────────────┘

INGESTION JOBS (pipeline status)
┌──────────────────────────────────────────────────────────┐
│  Job ID    Status      Documents  Chunks  Duration       │
│  j-4821    ✅ Complete  12         348     2m 14s         │
│  j-4820    ✅ Complete  1          24      0m 45s         │
│  j-4819    🔄 Running   3/5        ...     1m 30s...     │
│  j-4818    ❌ Failed    0          0       —  [Retry]    │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Library Tab

**Purpose**: Browse, inspect, and manage indexed content. Shows what's in the vector store + knowledge graph.

```
FILTERS
┌──────────────────────────────────────────────────────────┐
│ 🔍 Search documents...  │ Type: [All ▾] │ Freshness: [All ▾] │
└──────────────────────────────────────────────────────────┘

DOCUMENT LIST
┌──────────────────────────────────────────────────────────┐
│  📄 Pharmacy SOP Manual v4.2                              │
│     Department: Pharmacy · Type: SOP · 48 chunks          │
│     Entities: 23 · Last updated: 2 days ago               │
│     Freshness: 🟢 Current                                 │
│     [View Chunks] [View Entities] [Re-index] [Delete]     │
│                                                           │
│  📄 FDA Drug Interaction Guide 2026                       │
│     Department: Pharmacy · Type: Reference · 312 chunks   │
│     Entities: 1,204 · Last updated: 1 week ago            │
│     Freshness: 🟡 Review suggested                        │
│     [View Chunks] [View Entities] [Re-index] [Delete]     │
│                                                           │
│  📄 Controlled Substance Procedures                       │
│     Department: Pharmacy · Type: Policy · 15 chunks       │
│     Entities: 8 · Last updated: 6 months ago              │
│     Freshness: 🔴 Stale — consider updating               │
│     [View Chunks] [View Entities] [Re-index] [Delete]     │
└──────────────────────────────────────────────────────────┘

DOCUMENT DETAIL (expanded)
┌──────────────────────────────────────────────────────────┐
│  Chunk #12 of 48                                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │ "When dispensing Schedule II controlled           │    │
│  │  substances, the pharmacist must verify the       │    │
│  │  patient's identity using a government-issued..." │    │
│  └──────────────────────────────────────────────────┘    │
│  Context summary (Gemini-generated):                     │
│  "Verification procedures for Schedule II dispensing"    │
│                                                          │
│  Entities: [Schedule II] [pharmacist] [identity check]   │
│  Embedding: ████████████ (768-dim, AlloyDB)              │
│  Graph neighbors: 4 connected nodes                      │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Gaps Tab (Gemini-Assisted)

**Purpose**: AI-powered analysis of knowledge coverage gaps. Driven by search analytics + content analysis.

```
COVERAGE ANALYSIS
┌──────────────────────────────────────────────────────────┐
│  Stream: Pharmacy                                        │
│  Coverage Score: ██████████░░ 78%                        │
│                                                          │
│  Indexed:    142 documents · 3,420 chunks · 23 entities  │
│  Missing:    ~12 topic areas detected                    │
│  Stale:      3 documents older than 90 days              │
└──────────────────────────────────────────────────────────┘

DETECTED GAPS
┌──────────────────────────────────────────────────────────┐
│  🔴 HIGH — No coverage                                   │
│                                                          │
│  "Controlled substance handling procedures"              │
│  Users asked about this 47 times · 0 relevant docs       │
│  [📝 Draft with Gemini] [Upload Document] [Dismiss]      │
│                                                          │
│  "Vaccine storage temperature requirements"              │
│  Users asked 23 times · 1 partial match (low relevance)  │
│  [📝 Draft with Gemini] [Upload Document] [Dismiss]      │
│                                                          │
│  🟡 MEDIUM — Partial coverage                            │
│                                                          │
│  "Insurance claim rejection codes"                       │
│  Users asked 18 times · 2 docs but outdated (2024)       │
│  [📝 Draft with Gemini] [Re-index Sources] [Dismiss]     │
│                                                          │
│  🔵 SUGGESTION — Gemini recommends                       │
│                                                          │
│  "Add state-specific pharmacy regulations"               │
│  Based on domain analysis, this is typically needed       │
│  [📝 Draft with Gemini] [Upload Document] [Dismiss]      │
└──────────────────────────────────────────────────────────┘

STALE CONTENT
┌──────────────────────────────────────────────────────────┐
│  📄 Controlled Substance Procedures — 6 months old       │
│  📄 Insurance Billing Codes 2024 — 14 months old         │
│  📄 State Licensing Requirements — 8 months old          │
│                                                          │
│  [Update All] [Review Individually]                      │
└──────────────────────────────────────────────────────────┘
```

### 5.5 Test & Verify Tab

**Purpose**: Test the retrieval pipeline end-to-end. Uses existing Evidence/Citation components from AGENTIC-COMPONENTS.md.

```
QUERY TEST
┌──────────────────────────────────────────────────────────┐
│  Stream: [Pharmacy ▾]                                    │
│  Search mode: ○ Semantic  ● Hybrid  ○ Graph              │
│                                                          │
│  Ask a question:                                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │ What are the requirements for dispensing          │    │
│  │ Schedule II controlled substances?                │    │
│  └──────────────────────────────────────────────────┘    │
│  [🔍 Search]                                             │
└──────────────────────────────────────────────────────────┘

RETRIEVAL RESULTS
┌──────────────────────────────────────────────────────────┐
│  5 chunks retrieved in 124ms                             │
│                                                          │
│  #1 — Score: 0.94 · Pharmacy SOP Manual (chunk #12)      │
│  "When dispensing Schedule II controlled substances..."   │
│  [EvidenceChip: document · confidence: 94]               │
│                                                          │
│  #2 — Score: 0.89 · FDA Drug Guide (chunk #201)          │
│  "Schedule II substances include oxycodone..."           │
│  [EvidenceChip: knowledge_base · confidence: 89]         │
│                                                          │
│  #3 — Score: 0.82 · State Regulations (chunk #4)         │
│  "California BOP requires electronic prescription..."    │
│  [EvidenceChip: document · confidence: 82]               │
└──────────────────────────────────────────────────────────┘

GENERATED ANSWER (preview how the agent would respond)
┌──────────────────────────────────────────────────────────┐
│  Based on the knowledge base, dispensing Schedule II      │
│  controlled substances requires:                         │
│                                                          │
│  1. Verify patient identity with government-issued ID [1]│
│  2. Electronic prescription required in CA [3]           │
│  3. Maximum 90-day supply per prescription [1]           │
│                                                          │
│  Sources: [1] Pharmacy SOP Manual [2] FDA Guide [3] CA   │
│                                                          │
│  [ConfidenceIndicator: 91% — High]                       │
│                                                          │
│  Was this answer correct?  [👍] [👎]                      │
│  → Thumbs up saves to Memory Store for future queries    │
└──────────────────────────────────────────────────────────┘

GRAPH VISUALIZATION (when Graph Search is selected)
┌──────────────────────────────────────────────────────────┐
│  [Schedule II] ──relates_to──▶ [pharmacist]              │
│       │                            │                     │
│       ▼                            ▼                     │
│  [oxycodone]              [identity check]               │
│       │                            │                     │
│       ▼                            ▼                     │
│  [DEA registration]       [government ID]                │
│                                                          │
│  4 entities · 6 relationships · 3 documents              │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Gemini Enterprise Integration

For value streams that opt into the **Gemini Enterprise RAG** pattern (fully managed):

| Aspect           | Self-Service (Custom RAG)      | Gemini Enterprise (Managed)               |
| ---------------- | ------------------------------ | ----------------------------------------- |
| **Ingestion**    | Manager uploads/crawls via UI  | Platform configures connectors; auto-sync |
| **Chunking**     | Custom pipeline (Document AI)  | Managed by Gemini Enterprise              |
| **Embedding**    | AlloyDB pgvector               | Managed data store                        |
| **Retrieval**    | Custom semantic/hybrid/graph   | Managed semantic retrieval                |
| **Guardrails**   | Custom input/output validation | Model Armor (platform-configured)         |
| **Self-Service** | Full control                   | Monitor sync status, test queries         |

The UI adapts based on which pattern the stream uses:

- **Custom RAG streams**: Full Sources tab with upload/crawl/ingest
- **Gemini Enterprise streams**: Read-only connector status + test tab

---

## 7. Feedback Loop & Memory

The architecture defines a feedback-driven learning cycle:

```
User asks question
  → Agent retrieves from knowledge
    → Agent generates response
      → User gives feedback (👍/👎)
        → 👍: Response cached in Memory Store
        →     Similar future queries skip retrieval
        → 👎: Logged for gap analysis
        →     Surfaces in Gaps tab for manager review
```

### Self-Service Implications

- **Managers see feedback analytics**: "23 thumbs up, 5 thumbs down this week"
- **Thumbs down → gap detection**: Failed responses surface as knowledge gaps
- **Memory hit rate**: "42% of queries served from memory (fast path)"
- **Similarity threshold tuning**: Per-stream configurable (default 0.85)

---

## 8. Implementation Phases

### Phase 1: Agent Definition in Value Streams (2 weeks)

- Add Agent tab to StreamForm: persona, tools, guardrails, retrieval strategy
- Add Knowledge tab: collection assignment, coverage score, "Open Knowledge Base" link
- Gemini-assisted persona generation (stretch)

### Phase 2: Knowledge UI Redesign (3 weeks)

- Stream scope selector at top of Knowledge page
- Sources tab: manual ingest + job status (already partially built)
- Library tab: document browser with chunks, entities, freshness
- Test tab: query testing with Evidence/Citation components

### Phase 3: Gemini-Assisted Features (2 weeks)

- Gap detection from search analytics
- Content drafting from gaps
- Knowledge planning ("describe your domain")
- Quality/freshness scoring

### Phase 4: Connectors & Gemini Enterprise (4 weeks)

- Google Drive, Confluence, SharePoint connectors
- Gemini Enterprise RAG pattern integration
- Auto-sync status monitoring
- Model Armor guardrail configuration

### Phase 5: Feedback & Memory (2 weeks)

- Feedback analytics dashboard
- Memory store visualization
- Similarity threshold tuning UI
- Feedback → gap pipeline

---

## 9. Technical Dependencies

| Component                       | Status  | Location                                                   |
| ------------------------------- | ------- | ---------------------------------------------------------- |
| ingestion-pipeline-service      | Built   | `apps/ai-platform/ingestion-pipeline-service/` (port 9508) |
| knowledge-api                   | Built   | `apps/ai-platform/knowledge-api/` (port 9509)              |
| AlloyDB pgvector                | Built   | Via knowledge-api                                          |
| Neo4j knowledge graph           | Built   | Via knowledge-api                                          |
| knowledgeRouter (tRPC)          | Built   | `apps/ai-platform/agentic/server/knowledge.ts`             |
| managerProcedure                | Built   | `apps/ai-platform/agentic/server/_core/trpc.ts`            |
| Knowledge permissions (RBAC)    | Built   | `apps/ai-platform/agentic/server/auth/rbac.ts`             |
| EvidenceChip / EvidenceList     | Built   | `apps/ai-platform/agentic/client/src/components/chat-ui/`  |
| ConfidenceIndicator             | Built   | `apps/ai-platform/agentic/client/src/components/chat-ui/`  |
| AgentConfigPanel                | Built   | `apps/ai-platform/agentic/client/src/components/chat-ui/`  |
| ToolRegistryBrowser             | Built   | `apps/ai-platform/agentic/client/src/components/chat-ui/`  |
| Document AI integration         | Needed  | For layout parsing & chunking                              |
| Gemini API (content gen)        | Needed  | For assisted features                                      |
| Pub/Sub pipeline triggers       | Needed  | For async ingestion flow                                   |
| Analytics service (search logs) | Partial | `apps/ai-platform/analytics-service/`                      |

---

## 10. Success Metrics

| Metric                          | Target        | How Measured                                   |
| ------------------------------- | ------------- | ---------------------------------------------- |
| Knowledge coverage per stream   | >85%          | Gap analysis score                             |
| Retrieval relevance (avg score) | >0.80         | Test & Verify tab                              |
| Time to onboard new stream      | <1 day        | From stream creation to first successful query |
| Self-service adoption           | >80% managers | Managers who ingest without platform team help |
| Memory hit rate                 | >30%          | Queries served from memory vs. full retrieval  |
| User satisfaction (feedback)    | >90% 👍       | Thumbs up rate on agent responses              |
| Content freshness               | <90 days avg  | Library freshness scores                       |
