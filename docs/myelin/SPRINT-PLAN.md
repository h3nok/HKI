# Myelin — Sprint Plan

**Package:** `myelin` · **Classification:** Standalone, HKI-integrable  
**Goal:** A production-quality graph visualization system for agentic runtime execution traces.
**Principle:** The graph IS the debugger. Every decision, tool call, and domain boundary is visible, navigable, and queryable.

---

## Architecture Overview

```
packages/myelin-core/       @myelin/core    — headless graph model + event projector
packages/myelin-react/      @myelin/react   — React Flow canvas + custom nodes
packages/myelin-mcp/        @myelin/mcp     — MCP server (inspect, query, compare)
services/myelin-api/        myelin-api      — FastAPI REST + SSE backend
apps/myelin-showcase/       —                   — self-contained demo app (no auth)
```

Dependency rule: `core` has zero runtime deps. `react` depends only on `core`. `mcp` calls `api`. `api` depends on `core`. `showcase` depends on `react` + `core`.

---

## Technology Decisions

| Layer       | Choice                                 | Reason                                                        |
| ----------- | -------------------------------------- | ------------------------------------------------------------- |
| Graph model | Plain TypeScript types + Map adjacency | Agent traces are 10–80 nodes — no graphology overhead needed  |
| Canvas      | `@xyflow/react` (React Flow)           | Best DX for DAG execution traces; already in monorepo         |
| Layout      | `@dagrejs/dagre`                       | Standard DAG top-down layout for sequential execution         |
| Animation   | CSS transitions + Framer Motion        | Nodes animate in as events arrive; no JS tween overhead       |
| API         | FastAPI + aiosqlite                    | Consistent with other HKI services; zero-infra SQLite for MVP |
| MCP         | `@modelcontextprotocol/sdk`            | Official TypeScript SDK                                       |
| Showcase    | Vite + React + Tailwind CSS            | Consistent with agentic app; no auth required for demo        |

---

## Sprint 0 — Scaffolding ✅ (Day 1)

**Goal:** All packages exist, compile, and import from each other. Nothing functional yet.

- [x] `packages/myelin-core/` — package.json, tsconfig, `src/index.ts` stub
- [x] `packages/myelin-react/` — package.json, tsconfig, peer deps declared
- [x] `packages/myelin-mcp/` — package.json, tsconfig
- [x] `services/myelin-api/` — requirements.txt, main.py
- [x] `apps/myelin-showcase/` — Vite config, index.html, App.tsx
- [x] pnpm workspace entries for all packages
- [x] Sprint plan document (this file)

**Exit criteria:** `pnpm typecheck` passes across all new packages.

---

## Sprint 1 — Core Package (Days 2–5)

**Goal:** `@myelin/core` is fully implemented, tested, and documented. Zero DOM dependencies.

### Deliverables

**`src/types.ts`** — Complete type system:

- `NodeKind` union (routing, thinking, tool_call, tool_result, knowledge_retrieval, guardrail, plan, reflecting, escalation, response, memory_recall)
- `AgentNode` with all metadata fields
- `AgentEdge` with kind (execution, data, dependency)
- `AgentRun` (nodes + edges + run-level metadata)
- `OrchestratorEvent` — typed union of all 16 event types emitted by HKI orchestrator
- `GraphMutation` — addNode | updateNode | addEdge | updateRun

**`src/projector.ts`** — Event → graph mutations:

- Maps all 16 HKI orchestrator event types to graph mutations
- Maintains `lastNodeId` cursor for sequential execution edges
- Tool call ↔ tool result pairing via pending call map
- Plan step tracking (step_started / step_verified / step_failed update plan node)
- HKI domain annotation from `hki.domain` metadata

**`src/algorithms.ts`** — Graph analytics:

- `computeCriticalPath(run)` → ordered node IDs on longest-latency path
- `computeBlastRadius(run, nodeId)` → reachable set from a failed node
- `summarizeRun(run)` → { totalMs, toolCallCount, llmCalls, kbHits, tokensUsed, confidence }
- `diffRuns(runA, runB)` → { added, removed, changed } node/edge sets

**`src/fixtures.ts`** — Pre-recorded HKI traces (5 scenarios):

1. `kbLookup` — routing → thinking → tool_call (search_knowledge) → knowledge_retrieval → tool_result → reflecting → guardrail → response
2. `multiStepPlan` — routing → planning → plan → [step × 3] → reflecting → guardrail → response
3. `modelFallback` — routing → thinking → model_fallback thinking → reflecting → response
4. `humanEscalation` — routing → thinking → tool_call (high-risk) → escalation → response
5. `fastPath` — routing (direct response, no LLM) → response

**Tests:** `src/__tests__/projector.test.ts`, `algorithms.test.ts`

**Exit criteria:** All 5 fixtures replay correctly through the projector. `computeCriticalPath` identifies the slowest tool call. `diffRuns` detects added nodes between fixture variants.

---

## Sprint 2 — React Canvas (Days 6–12)

**Goal:** `@myelin/react` renders all node types beautifully, animates event-by-event, runs at 60 fps.

### Deliverables

**`src/layout.ts`** — Dagre layout engine:

- `computeLayout(nodes, edges)` → positioned `Node[]` for React Flow
- Node size map per `NodeKind` (routing: 240×56, plan: 260×120, response: 280×80, etc.)
- Top-down DAG (`rankdir: TB`, `ranksep: 60`, `nodesep: 32`)
- Incremental: re-layout only when structure changes, not on status updates

**`src/theme.ts`** — Design tokens:

- Color per NodeKind (routing: blue, tool_call: orange, error: red, guardrail: green/red, etc.)
- Status overlays (running: pulsing ring, error: red border, success: solid)
- HKI domain color palette (one hue per domain, consistent)

**Custom node components** (`src/nodes/`):
| Node | Visual |
|---|---|
| `RoutingNode` | Chip with model badge + tier pill (fast/smart/thinking) |
| `ThinkingNode` | Section header + truncated reasoning preview |
| `ToolCallNode` | Orange card, tool name, arg preview, cache badge |
| `ToolResultNode` | Green/red card, duration ms, output preview |
| `KnowledgeNode` | Cyan card, citation count, source title list |
| `GuardrailNode` | Shield icon, pass/fail, score ring |
| `PlanNode` | Indigo card, step checklist with status icons |
| `ReflectingNode` | Teal card, token usage bar chart (prompt/completion) |
| `EscalationNode` | Amber card, tool name, available actions |
| `ResponseNode` | Emerald card, response text preview (truncated) |
| `MemoryNode` | Purple card, memory count badge |

**`src/edges/ExecutionEdge.tsx`** — Animated execution flow edge:

- Solid for completed, dashed+animated for in-flight
- Red for error paths

**`src/MyelinCanvas.tsx`** — Main component:

```tsx
<MyelinCanvas
  run={AgentRun}
  activeNodeId?: string
  onNodeClick?: (node: AgentNode) => void
  replay?: boolean          // animate nodes in one-by-one
  replaySpeedMs?: number    // ms between node appearances (default 400)
  showMinimap?: boolean
  showControls?: boolean
/>
```

**`src/hooks/useMyelin.ts`**:

- `useMyelinReplay(events, options)` → `{ run, currentStep, play, pause, reset, progress }`
- Drives replay animation frame-by-frame

**Exit criteria:** All 5 fixture traces render correctly. Replay mode animates nodes in sequence. Click a node → inspect panel shows full metadata. HKI domain coloring groups nodes by domain when `hkiDomain` is set.

---

## Sprint 3 — API Service (Days 13–17)

**Goal:** `myelin-api` accepts event streams, stores runs, serves graph data and live SSE.

### Endpoints

```
POST /runs                          — create run, return { run_id }
POST /runs/{id}/events              — push one or more events (batch-friendly)
GET  /runs                          — list runs (paginated, filterable by domain/status)
GET  /runs/{id}                     — full run with nodes + edges
GET  /runs/{id}/graph               — computed graph JSON (React Flow compatible)
GET  /runs/{id}/stream              — SSE live updates as events arrive
GET  /runs/{id}/summary             — summarizeRun() output
POST /runs/{id_a}/diff/{id_b}       — structural diff between two runs
DELETE /runs/{id}                   — delete run + all events
GET  /health                        — liveness check
```

### Storage

SQLite via `aiosqlite`:

```sql
CREATE TABLE runs (id, query, status, hki_domain, started_at, ended_at, metadata JSON);
CREATE TABLE events (id, run_id, seq, event_type, payload JSON, received_at);
```

Graph is projected on-read (projection is cheap; no separate graph table needed for MVP). Swap to Postgres by replacing `aiosqlite` with `asyncpg` and a single migration.

### Key design

- **Event ingestion is idempotent by `seq`.** Duplicate events are silently ignored.
- **SSE stream** replays all stored events on connect, then pushes new ones live.
- **CORS** configured for `localhost:5173` (showcase dev) and wildcard for demo.
- **No auth for MVP** (add HKI envelope validation in the HKI integration sprint).

**Exit criteria:** `curl -N localhost:8090/runs/{id}/stream` streams existing events then stays open. Posting 20 events to a run and fetching `/graph` returns a React Flow–compatible JSON structure.

---

## Sprint 4 — MCP Server (Days 18–20)

**Goal:** `@myelin/mcp` exposes 5 tools that let agents introspect their own execution.

### Tools

| Tool                | Input                          | Output                                     |
| ------------------- | ------------------------------ | ------------------------------------------ |
| `list_runs`         | `{ limit?, domain?, status? }` | `{ runs: RunSummary[] }`                   |
| `get_run_graph`     | `{ run_id }`                   | `{ nodes, edges, summary }`                |
| `inspect_node`      | `{ run_id, node_id }`          | `{ node, incoming_edges, outgoing_edges }` |
| `get_critical_path` | `{ run_id }`                   | `{ path: NodeSummary[], total_ms }`        |
| `compare_runs`      | `{ run_id_a, run_id_b }`       | `{ added, removed, changed }`              |

### Architecture

```
@myelin/mcp
  src/server.ts      — MCP Server instance + tool registration
  src/tools.ts       — tool handlers (call myelin-api REST)
  src/client.ts      — typed HTTP client for myelin-api
```

Configured via env: `AGENTGRAPH_API_URL` (default `http://localhost:8090`).

**Exit criteria:** `npx @myelin/mcp` starts successfully. Claude Code can use `list_runs` to see active traces and `get_critical_path` to identify the slowest step.

---

## Sprint 5 — Showcase App (Days 21–26)

**Goal:** A polished, self-contained demo app that requires no backend, shows all 5 scenarios, and can connect to a live `myelin-api` for real traces.

### Pages

**`/`** — Scenario Gallery:

- 5 scenario cards with description, node count, key metrics
- "Watch Replay" button on each card
- Live mode toggle (connect to running API)

**`/trace/:id`** — Trace Canvas:

- Full-screen React Flow canvas
- Left sidebar: run summary (tokens, duration, confidence, domain)
- Right panel (appears on node click): full node metadata inspector
- Bottom bar: replay controls (play/pause/step/speed slider)
- Top bar: run info + HKI domain legend

### Showcase scenarios (pre-recorded fixtures)

1. **"KB Lookup"** — Simple knowledge retrieval. Shows: routing → tool_call → KB citations → synthesis
2. **"Multi-step Planner"** — Complex query with execution plan. Shows: planning node, step checklist progression
3. **"Model Fallback"** — Primary model unavailable, automatic fallback. Shows: retry thinking node, fallback model badge
4. **"Human Escalation"** — High-risk tool requires approval. Shows: escalation node, available actions
5. **"Domain Isolation"** (HKI showcase) — Two requests in different HKI domains. Shows: domain color clustering

### Live mode

Connect to `myelin-api` at configurable URL. List recent runs, click to view.

**Exit criteria:** All 5 scenarios replay with animation. Node click shows full metadata. HKI domain scenario visually groups nodes. Runs on `pnpm dev` with zero backend.

---

## Sprint 6 — Quality & Polish (Days 27–30)

- Performance: synthetic 500-node run renders at 60 fps (React Flow virtualization is automatic)
- Keyboard nav: Tab to next node, Enter to inspect, Esc to deselect
- `prefers-reduced-motion`: disable animations
- `prefers-color-scheme`: dark mode support
- `@myelin/core` 100% test coverage on projector + algorithms
- Package publishing: `npm publish --access public` ready for `@myelin/*`
- Integration guide: `docs/myelin/HKI-INTEGRATION.md` (wire into `apps/agentic/`)

---

## HKI Integration (Post-Sprint 6, separate sprint)

**Not in scope for the standalone build. Documented here for reference.**

1. In `services/myelin-api/`: add `HkiMiddleware` (same pattern as other HKI services)
2. In `apps/agentic/server/`: forward each SSE event from orchestrator to `myelin-api` as it flows through the BFF
3. In `apps/agentic/client/`: add `/graph` route that embeds `<MyelinCanvas>` in a side panel
4. Tag each node with `hkiDomain` from the `X-HKI-Envelope` header
5. Visual: domain boundary overlays, envelope trail animation on edges

---

## Open Questions (resolve before Sprint 2)

1. **Node click panel** — slide-over drawer or inline popover? (Recommendation: drawer, consistent with agentic app)
2. **Replay speed default** — 400ms/node or 600ms/node for showcase demos?
3. **Plan node expansion** — show all steps inline or collapse to summary + expand on click?
4. **HKI domain coloring** — 6 fixed domain colors (deterministic from domain name hash) or user-configurable?

---

## Success Metrics

| Metric                         | Target                                      |
| ------------------------------ | ------------------------------------------- |
| Canvas render (100 nodes)      | ≤ 16 ms first paint                         |
| Layout computation (100 nodes) | ≤ 50 ms                                     |
| Replay animation smoothness    | 60 fps, no dropped frames                   |
| `@myelin/core` bundle size     | ≤ 12 KB gzipped                             |
| `@myelin/react` bundle size    | ≤ 40 KB gzipped (excl. React Flow peer dep) |
| API cold start                 | ≤ 600 ms                                    |
| SSE first event latency        | ≤ 50 ms after POST /events                  |
