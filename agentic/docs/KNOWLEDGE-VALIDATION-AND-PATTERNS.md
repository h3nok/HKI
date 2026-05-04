# Knowledge Pipeline — Validation Workflow & Bleeding-Edge Patterns

> **Status**: Design Proposal v1.0
> **Author**: Platform Team
> **Date**: February 2026
> **Builds on**: KNOWLEDGE-SELF-SERVICE-DESIGN.md

---

## 1. What's Working in the Agentic World (2025–2026)

### 1.1 The Patterns That Won

| Pattern                              | Who's Using It               | Why It Works                                                                                                                  | Our Status                                         |
| ------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Contextual Retrieval** (Anthropic) | Anthropic, enterprise RAG    | Prepend doc-level context to every chunk before embedding — 49% fewer retrieval failures                                      | ✅ Built (Gemini contextualization)                |
| **Corrective RAG (CRAG)**            | Research → Production        | Self-correction loop: retrieve → evaluate relevance → refine query → re-retrieve. Eliminates hallucination from bad retrieval | 🔲 Design below                                    |
| **Adaptive RAG**                     | LangChain, LlamaIndex        | Classifier routes queries: simple → direct answer, medium → single retrieval, complex → multi-hop. Saves cost + latency       | 🔲 Orchestrator enhancement                        |
| **Graph RAG** (Microsoft)            | Microsoft, enterprise KM     | Community detection on knowledge graph → hierarchical summaries. Answers "big picture" questions flat RAG can't               | ✅ Partial (Neo4j graph, need community detection) |
| **RAPTOR** (UC Berkeley)             | Research → Production        | Recursive summarization tree: chunks → cluster → summarize → re-embed. Handles long-range dependencies                        | 🔲 Pipeline enhancement                            |
| **Agentic Document Workflows**       | LlamaIndex, Unstructured     | End-to-end: parse → validate → enrich → approve → index. State machine with human checkpoints                                 | 🔲 Design below                                    |
| **Evaluation-Driven RAG** (RAGAS)    | Every serious RAG deployment | Measure faithfulness, relevance, context recall. Continuous regression testing on retrieval quality                           | 🔲 Test & Verify enhancement                       |

### 1.2 The Anti-Patterns (What's Failing)

| Anti-Pattern                              | Why It Fails                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| **Index everything, ask questions later** | Garbage in, garbage out. Unvalidated docs poison retrieval                     |
| **Fixed chunk sizes**                     | 512 tokens isn't magic. Semantic boundaries matter more than token counts      |
| **Single embedding model for everything** | Policy docs ≠ code ≠ tables. Different content types need different strategies |
| **No freshness management**               | Stale docs ranked equally with current ones. Users lose trust                  |
| **No retrieval evaluation**               | You can't improve what you don't measure                                       |

---

## 2. Validation & Approval Workflow

### 2.1 The Core Insight

> **The #1 differentiator** between toy RAG demos and production knowledge systems is the **validation pipeline between ingestion and indexing**. Every enterprise that succeeded (Glean, Guru, Notion AI, Moveworks) has a human-in-the-loop approval gate.

### 2.2 Document Lifecycle State Machine

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                                                         │
  Upload/Crawl      │    AUTOMATED QUALITY GATES                             │
  ─────────────►  DRAFT  ──────────────────────►  REVIEW  ──────────►  APPROVED
                    │    │  • Duplicate detection      │  Human         │
                    │    │  • Quality scoring           │  review        │
                    │    │  • Contradiction check        │  required      │
                    │    │  • PII/sensitive scan         │                │
                    │    │  • Readability analysis       │                │
                    │    └──────────────────────────────┘                │
                    │                                                     │
                    │         ┌──── REJECTED ◄────┘                      │
                    │         │  (with feedback)                          │
                    │         │                                           │
                    │         ▼                                           ▼
                    │     REVISION  ─────────────────────────►      PUBLISHED
                    │     (author fixes)                          (indexed in
                    │                                              vector store)
                    │                                                    │
                    │                                                    │ TTL expires
                    │                                                    ▼
                    │                                                  STALE
                    │                                              (review needed)
                    │                                                    │
                    └────────────────────────────────────────────────────┘
                                        Re-ingest
```

### 2.3 Automated Quality Gates (Pre-Review)

Each gate runs automatically when a document enters DRAFT. All results shown to the reviewer.

| Gate                        | What It Does                                                                                         | Implementation                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Duplicate Detection**     | Embed title + first 500 chars → cosine similarity against existing docs. Flag if > 0.92              | Vector search with threshold       |
| **Contradiction Detection** | Gemini compares key claims against existing docs in same department. Flags conflicts                 | `POST /v1/validate/contradictions` |
| **Quality Score**           | Gemini rates: completeness (0–25), specificity (0–25), accuracy signals (0–25), actionability (0–25) | `POST /v1/validate/quality`        |
| **PII / Sensitive Scan**    | Regex + DLP API scan for SSN, credit cards, PHI, internal-only markers                               | Cloud DLP or local regex           |
| **Readability Analysis**    | Flesch-Kincaid score, sentence complexity, jargon density                                            | Local computation                  |
| **Coverage Impact**         | "This document would answer X unanswered queries from last 30 days"                                  | Match against gap analysis queries |
| **Freshness Check**         | If updating an existing doc, show diff. If new, check if it supersedes stale content                 | Semantic match against stale docs  |

### 2.4 Human Review Interface

```
┌──────────────────────────────────────────────────────────────────────┐
│  📄 Review: "Pharmacy PDMP Verification Procedures"                  │
│  Submitted by: Maria · Department: Pharmacy · Type: SOP              │
│                                                                      │
│  ┌─── Quality Report ──────────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  Overall: ████████████░░░░ 78/100                               │ │
│  │                                                                  │ │
│  │  ✅ Completeness    22/25  — Covers main scenarios              │ │
│  │  ✅ Specificity     24/25  — Concrete steps and examples        │ │
│  │  ⚠️ Accuracy        18/25  — 2 claims couldn't be verified      │ │
│  │  ✅ Actionability   14/25  — Clear procedures                   │ │
│  │                                                                  │ │
│  │  ⚠️ Possible duplicate of "Controlled Substance Procedures"     │ │
│  │     Similarity: 87%  [Compare Side-by-Side]                     │ │
│  │                                                                  │ │
│  │  ⚠️ Potential contradiction:                                     │ │
│  │     This doc says "24-hour PDMP check window"                   │ │
│  │     Existing doc says "48-hour PDMP check window"               │ │
│  │     [View Existing Doc]                                         │ │
│  │                                                                  │ │
│  │  ✅ No PII detected                                             │ │
│  │  ✅ Readability: Grade 10 (appropriate for target audience)      │ │
│  │                                                                  │ │
│  │  📊 Coverage Impact:                                             │ │
│  │     Would answer 12 previously unanswered user queries          │ │
│  │     Top queries: "PDMP verification steps", "controlled         │ │
│  │     substance ID requirements", "e-prescribing rules"           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─── Document Preview ────────────────────────────────────────────┐ │
│  │  [Full document content with highlighted sections]               │ │
│  │  [Chunks preview — how it will be split]                        │ │
│  │  [Entity extraction preview — what entities were found]          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─── Test Before Publish ─────────────────────────────────────────┐ │
│  │  "What would the agent answer with this doc included?"          │ │
│  │  [Ask a test question...]                                       │ │
│  │                                                                  │ │
│  │  Before (without this doc):                                     │ │
│  │  "I don't have specific information about PDMP verification..." │ │
│  │                                                                  │ │
│  │  After (with this doc):                                         │ │
│  │  "To verify controlled substances, pharmacists must: 1) Check   │ │
│  │   the state PDMP within 24 hours of dispensing, 2) Verify..."   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [✅ Approve & Publish]  [✏️ Request Changes]  [❌ Reject]           │
│                                                                      │
│  Reviewer notes: [                                        ]          │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.5 The "Before vs. After" Pattern

This is the **killer feature** that makes validation intuitive. Before publishing, the reviewer asks a test question and sees:

1. **Before** — What the agent would answer _right now_ (without this doc)
2. **After** — What the agent _would_ answer if this doc were published

This is a **shadow index** — a temporary vector store that includes the candidate document alongside the production index. The reviewer can see the impact before committing.

```
Production Index ──────────────────► Search → Answer A (current)
                                          │
Candidate Doc ─► Shadow Index ────────────┤
(temporary)      (prod + candidate)       │
                                          ► Search → Answer B (proposed)
                                          │
                              Diff ◄──────┘
                         (show side-by-side)
```

---

## 3. Visualization Strategy

### 3.1 Pipeline Visualization (React Flow / @xyflow/react)

The ingestion pipeline is a **directed acyclic graph (DAG)**. React Flow is the gold standard for this.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Upload  │───▶│ Extract  │───▶│  Clean   │───▶│ Enrich   │───▶│ Validate │
│  📄      │    │  🔍      │    │  🧹      │    │  ✨      │    │  ✅      │
│          │    │          │    │          │    │          │    │          │
│ 3 files  │    │ 2.1s     │    │ 0.3s     │    │ 1.2s     │    │ AI check │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └─────┬────┘
                                                                      │
                                                    ┌─────────────────┤
                                                    │                 │
                                              ┌─────▼────┐    ┌──────▼─────┐
                                              │  Review   │    │  Auto-     │
                                              │  Queue    │    │  Approve   │
                                              │  👤       │    │  (score    │
                                              │  2 docs   │    │   > 90)    │
                                              └─────┬────┘    └──────┬─────┘
                                                    │                │
                                                    └────────┬───────┘
                                                             │
                                                    ┌────────▼───────┐
                                                    │   Publish      │
                                                    │   (Index)      │
                                                    │   📊           │
                                                    │   chunk+embed  │
                                                    └────────────────┘
```

**Why @xyflow/react:**

- Production-proven (used by Stripe, Zapier, Cal.com)
- Custom node renderers — embed quality scores, progress bars, status badges in each node
- Built-in minimap, controls, edge animations
- Handles 1000+ nodes smoothly

### 3.2 Knowledge Graph Visualization (react-force-graph)

For the entity/relationship graph in Neo4j:

```
react-force-graph-2d  — Lightweight, fast, 2D canvas rendering
react-force-graph-3d  — Immersive 3D (Three.js), impressive demos
```

**Use cases:**

- Show entity relationships extracted from documents
- Visualize document clusters by topic
- Display "knowledge neighborhoods" — related concepts around a search result

### 3.3 Analytics & Coverage (Recharts + Nivo)

| Visualization        | Library              | Use Case                         |
| -------------------- | -------------------- | -------------------------------- |
| Coverage donut       | `@nivo/pie`          | Overall knowledge coverage score |
| Quality score radar  | `@nivo/radar`        | Per-document quality dimensions  |
| Ingestion timeline   | `recharts` AreaChart | Documents ingested over time     |
| Department heatmap   | `@nivo/heatmap`      | Coverage by department × topic   |
| Search quality trend | `recharts` LineChart | RAGAS scores over time           |
| Chunk distribution   | `@nivo/bar`          | Chunks per document histogram    |

### 3.4 Embedding Space (t-SNE / UMAP Projection)

Visualize where documents live in embedding space. Clusters = topics. Outliers = potential issues.

```
Use: @nivo/scatterplot or deck.gl (for 100K+ points)

Each point = one chunk
Color = department
Size = quality score
Click = inspect chunk content
```

---

## 4. React Component Architecture

### 4.1 New Components Needed

```
pages/knowledge/
├── components/
│   ├── OverviewTab.tsx          ← EXISTS (enhance with pipeline viz)
│   ├── SourcesTab.tsx           ← EXISTS (add file upload, validation status)
│   ├── LibraryTab.tsx           ← EXISTS (add review queue, quality badges)
│   ├── CollectionsTab.tsx       ← EXISTS
│   ├── GapsTab.tsx              ← EXISTS (add RAGAS scores)
│   ├── TestTab.tsx              ← EXISTS (add before/after comparison)
│   ├── TeamTab.tsx              ← EXISTS
│   │
│   ├── validation/              ← NEW
│   │   ├── ReviewQueue.tsx          — List of docs pending approval
│   │   ├── ReviewPanel.tsx          — Full review interface (quality report + preview + test)
│   │   ├── QualityReport.tsx        — AI quality gate results (scores, flags, impact)
│   │   ├── BeforeAfterCompare.tsx   — Side-by-side agent answer comparison
│   │   ├── ContradictionAlert.tsx   — Flag contradicting claims with source links
│   │   ├── DuplicateAlert.tsx       — Similar doc detection with diff view
│   │   ├── DocumentDiff.tsx         — Side-by-side text diff (for updates)
│   │   └── ApprovalActions.tsx      — Approve / Request Changes / Reject buttons
│   │
│   ├── pipeline/                ← NEW
│   │   ├── PipelineGraph.tsx        — React Flow DAG of ingestion stages
│   │   ├── StageNode.tsx            — Custom node: icon + status + timing + count
│   │   ├── JobTimeline.tsx          — Horizontal timeline of job stages
│   │   └── LiveJobTracker.tsx       — Real-time job progress with WebSocket
│   │
│   ├── visualization/           ← NEW
│   │   ├── KnowledgeGraph.tsx       — react-force-graph entity visualization
│   │   ├── EmbeddingMap.tsx         — t-SNE/UMAP scatter plot of chunks
│   │   ├── CoverageHeatmap.tsx      — Department × topic coverage matrix
│   │   ├── QualityRadar.tsx         — Per-doc quality dimension radar chart
│   │   └── SearchQualityTrend.tsx   — RAGAS metrics over time
│   │
│   └── upload/                  ← NEW
│       ├── FileDropZone.tsx         — Drag-and-drop file upload (PDF, DOCX, TXT, CSV)
│       ├── UploadProgress.tsx       — Multi-file upload progress with per-file status
│       ├── MetadataForm.tsx         — Department, doc type, tags, description
│       └── BulkUploadPanel.tsx      — Upload multiple files with shared metadata
```

### 4.2 Library Recommendations

| Library                         | Version | Purpose                                | Why This One                                         |
| ------------------------------- | ------- | -------------------------------------- | ---------------------------------------------------- |
| **@xyflow/react**               | ^12     | Pipeline DAG visualization             | Industry standard for node-based UIs. Used by Stripe |
| **react-force-graph-2d**        | ^1.44   | Knowledge graph visualization          | Lightweight, performant, WebGL canvas                |
| **@nivo/pie**                   | ^0.87   | Coverage donut charts                  | Beautiful defaults, SSR-friendly, composable         |
| **@nivo/radar**                 | ^0.87   | Quality score radar charts             | Perfect for multi-dimensional quality                |
| **@nivo/heatmap**               | ^0.87   | Coverage heatmaps                      | Department × topic matrix                            |
| **recharts**                    | ^2.12   | Time-series charts (trends, timelines) | Already widely used, simple API                      |
| **react-dropzone**              | ^14     | File drag-and-drop upload              | Battle-tested, accessible, customizable              |
| **react-diff-viewer-continued** | ^4      | Document diff (updates, duplicates)    | Side-by-side + inline diff modes                     |
| **@tanstack/react-table**       | ^8      | Document tables with sort/filter       | Headless, performant, type-safe                      |
| **cmdk**                        | ^1      | Command palette for quick actions      | Used by Vercel, Linear, Raycast                      |
| **sonner**                      | ^1      | Toast notifications                    | Already likely in use — beautiful defaults           |
| **framer-motion**               | ^11     | Animations                             | ✅ Already using                                     |
| **shadcn/ui**                   | latest  | Component library                      | ✅ Already using                                     |
| **lucide-react**                | latest  | Icons                                  | ✅ Already using                                     |

### 4.3 What NOT to Add

| Library            | Why Skip                                                          |
| ------------------ | ----------------------------------------------------------------- |
| D3.js directly     | Too low-level. Use Nivo/Recharts which wrap D3                    |
| Cytoscape.js       | react-force-graph is lighter and faster for our graph sizes       |
| ag-Grid            | Overkill. @tanstack/react-table is headless + lighter             |
| Chart.js           | Nivo + Recharts cover everything with better React integration    |
| TipTap/ProseMirror | We don't need rich text editing — docs are ingested, not authored |

---

## 5. Bleeding-Edge Patterns to Implement

### 5.1 Corrective RAG (Self-Healing Retrieval)

Add to the orchestrator's retrieval flow:

```
User query
  → Retrieve top-k chunks
    → Relevance Agent evaluates each chunk (0–1 score)
      → If max(scores) < 0.7:
          → Query Refinement Agent rewrites query
          → Re-retrieve with refined query
          → If still < 0.7:
              → Flag as knowledge gap
              → Generate best-effort answer with low confidence
      → If max(scores) >= 0.7:
          → Filter to relevant chunks only
          → Generate answer with citations
```

**Impact**: Eliminates the #1 RAG failure mode — confidently answering with irrelevant context.

### 5.2 RAPTOR (Recursive Summarization Tree)

Add to the ingestion pipeline as an optional post-indexing step:

```
Level 0: Raw chunks (what we have now)
  ↓ Cluster by embedding similarity (k-means, k=√n)
Level 1: Cluster summaries (Gemini summarizes each cluster)
  ↓ Re-embed summaries, cluster again
Level 2: Section summaries
  ↓ Re-embed, cluster
Level 3: Document summary

All levels indexed — search hits the right abstraction level
```

**Impact**: Queries like "What is our overall pharmacy compliance posture?" can be answered from Level 2–3 summaries, while "What's the PDMP check window?" hits Level 0 chunks.

### 5.3 Evaluation Framework (RAGAS-Inspired)

Continuous measurement of retrieval quality:

| Metric                | What It Measures                                       | How                                        |
| --------------------- | ------------------------------------------------------ | ------------------------------------------ |
| **Faithfulness**      | Does the answer only use facts from retrieved context? | Gemini judges claim-by-claim               |
| **Answer Relevancy**  | Does the answer address the question?                  | Embed question + answer, cosine similarity |
| **Context Precision** | Are retrieved chunks actually relevant?                | Gemini scores each chunk vs query          |
| **Context Recall**    | Did we retrieve all needed information?                | Compare answer claims to ground truth      |

Run nightly on a **golden test set** per value stream. Track trends in the Test & Verify tab.

### 5.4 Semantic Chunking (Replace Fixed-Size)

Instead of splitting at 512 tokens:

```
1. Split document into sentences
2. Embed each sentence
3. Compute cosine similarity between consecutive sentences
4. Find "breakpoints" where similarity drops below threshold
5. Group sentences between breakpoints into chunks
6. Each chunk represents a coherent semantic unit
```

**Impact**: Chunks align with meaning boundaries. No more splitting a procedure in the middle of a step.

---

## 6. Implementation Priority

### Phase 1: Validation Workflow (2 weeks) — HIGH IMPACT

| Task                                                                      | Effort | Impact                    |
| ------------------------------------------------------------------------- | ------ | ------------------------- |
| Document lifecycle states (DRAFT → REVIEW → APPROVED → PUBLISHED → STALE) | M      | Foundation for everything |
| Quality scoring endpoint (Gemini-powered)                                 | M      | Automated quality gate    |
| Duplicate detection (embedding similarity)                                | S      | Prevent redundant content |
| Review queue UI (ReviewQueue + ReviewPanel)                               | L      | Human-in-the-loop         |
| Approval actions (approve/reject/request changes)                         | S      | Complete the loop         |

### Phase 2: Visualization (2 weeks) — HIGH VISIBILITY

| Task                           | Effort | Impact                       |
| ------------------------------ | ------ | ---------------------------- |
| Pipeline graph (React Flow)    | M      | Visual pipeline status       |
| File upload with drag-and-drop | S      | PDF/DOCX ingestion           |
| Knowledge graph visualization  | M      | Entity relationship explorer |
| Coverage heatmap               | S      | Gap visibility               |

### Phase 3: Evaluation & Intelligence (3 weeks) — LONG-TERM VALUE

| Task                                   | Effort | Impact                         |
| -------------------------------------- | ------ | ------------------------------ |
| Before/After comparison (shadow index) | L      | Killer review feature          |
| RAGAS-inspired evaluation framework    | L      | Continuous quality measurement |
| Corrective RAG in orchestrator         | M      | Self-healing retrieval         |
| Semantic chunking                      | M      | Better chunk quality           |
| RAPTOR recursive summaries             | L      | Multi-level retrieval          |

---

## 7. New API Endpoints Needed

### knowledge-pipeline-service (port 9508)

```
POST   /v1/validate/quality          — AI quality scoring
POST   /v1/validate/contradictions   — Check against existing docs
POST   /v1/validate/duplicates       — Embedding similarity check
POST   /v1/upload                    — File upload (PDF, DOCX, TXT, CSV)
PATCH  /v1/jobs/{id}/approve         — Approve a draft document
PATCH  /v1/jobs/{id}/reject          — Reject with feedback
GET    /v1/jobs/{id}/preview         — Preview chunks before publishing
POST   /v1/jobs/{id}/test-query      — Before/after comparison
```

### knowledge-api (port 9509)

```
POST   /v1/search/shadow             — Search production + candidate doc
GET    /v1/evaluate/ragas            — Run RAGAS metrics on golden set
GET    /v1/embeddings/projection     — t-SNE/UMAP coordinates for viz
GET    /v1/graph/communities         — Community detection for Graph RAG
```

### BFF (knowledge.ts tRPC router)

```
knowledge.uploadFile          — Proxy file upload to pipeline
knowledge.getQualityReport    — Fetch AI quality assessment
knowledge.approveDocument     — Approve and publish
knowledge.rejectDocument      — Reject with notes
knowledge.testBeforeAfter     — Shadow index comparison
knowledge.getEvalMetrics      — RAGAS scores for dashboard
knowledge.getEmbeddingMap     — Projection data for scatter plot
knowledge.getGraphCommunities — Graph communities for viz
```

---

## 8. Data Model Changes

### New: DocumentStatus Lifecycle

```python
class DocumentStatus(str, Enum):
    DRAFT = "draft"              # Uploaded, quality gates running
    REVIEW = "review"            # Quality gates complete, awaiting human review
    APPROVED = "approved"        # Human approved, ready to publish
    PUBLISHED = "published"      # Indexed in vector store, live
    REJECTED = "rejected"        # Human rejected, with feedback
    REVISION = "revision"        # Author is revising based on feedback
    STALE = "stale"              # TTL expired, needs review
    ARCHIVED = "archived"        # Removed from active index
```

### New: QualityReport Model

```python
class QualityReport(BaseModel):
    document_id: str
    overall_score: float           # 0–100
    completeness: float            # 0–25
    specificity: float             # 0–25
    accuracy_signals: float        # 0–25
    actionability: float           # 0–25
    readability_grade: float       # Flesch-Kincaid grade level
    duplicate_candidates: list[DuplicateMatch]
    contradictions: list[Contradiction]
    pii_detected: bool
    coverage_impact: CoverageImpact
    auto_approve_eligible: bool    # score > 90 AND no flags
    created_at: datetime
```

---

## 9. Success Metrics (Enhanced)

| Metric                           | Target     | Phase   |
| -------------------------------- | ---------- | ------- |
| Docs reviewed before publish     | 100%       | Phase 1 |
| Auto-approve rate (score > 90)   | 40%        | Phase 1 |
| Average review time              | < 5 min    | Phase 1 |
| Contradiction detection accuracy | > 85%      | Phase 1 |
| Retrieval faithfulness (RAGAS)   | > 0.90     | Phase 3 |
| Context precision (RAGAS)        | > 0.85     | Phase 3 |
| Knowledge gap detection rate     | > 70%      | Phase 3 |
| Time to resolve knowledge gap    | < 48 hours | Phase 3 |
