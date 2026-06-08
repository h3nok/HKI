# NEXUS — Agent Observability Platform

**Observability for agentic systems. APM for the age of agents.**
Status: `BUILD PLAN v2.0` · Classification: `Proprietary` · Supersedes: _Omni-Nexus UI Design Doc v1.0_

> The Omni-Nexus design doc specified the _interface_. This document specifies the **product**: ingestion, storage, APIs, an MCP server, the real-time pipeline, and the React package plan that renders it. The 3D neural graph is the flagship view, not the system.

---

## 0. How to read this

Build order is **bottom-up**: telemetry model (§4) → storage (§5) → ingestion (§6) → API (§7) → real-time (§9) → frontend packages (§10). The MCP server (§8) and performance contract (§11) cut across everything. If you only read three sections: §3 (architecture), §10 (the React package plan you asked for), §11 (performance).

Three non-negotiables:

1. **OpenTelemetry-native.** We ingest OTLP using the GenAI semantic conventions. Existing instrumentation works on day one. This is how you become "the new Datadog" instead of yet another walled garden.
2. **Heavy graph math runs server-side, in the database.** Centrality, community detection, and blast-radius run in **Neo4j GDS**, are cached, and shipped to the client as plain numbers. The browser lays out and renders — it never computes PageRank on 5,000 nodes.
3. **Performance is budgeted per layer, enforced in CI.** Ingest throughput, query p95, live latency, and frame time each have a number and a gate.

---

## 1. Product thesis

Agent systems are **graphs that execute over time**: an orchestrator routes to agents, agents call tools and models, results flow back. Traditional APM (spans on a flame graph) shows you _one run_; it cannot show you the _topology_ — which agent is a bottleneck across all runs, what a failing tool takes down with it, where token spend concentrates.

NEXUS treats the execution graph as the primary object:

| Capability                         | Datadog/APM today    | NEXUS                                                   |
| ---------------------------------- | -------------------- | ------------------------------------------------------- |
| Single trace                       | Flame graph          | Trace tree **+ position in the live topology**          |
| "What's slow"                      | Service map (static) | **Centrality/bottleneck-ranked** live graph             |
| "What breaks if X fails"           | Manual               | **Blast-radius** (graph reachability)                   |
| Cost                               | Bill at month end    | **Per-run / per-edge token & $ attribution**            |
| Self-service for the system itself | None                 | **MCP server: the agent queries its own observability** |

The last row is the moat. An agent (or a developer's copilot) can ask _"why was my last run slow and expensive?"_ and NEXUS answers from real traces over MCP.

---

## 2. Goals, non-goals, SLOs

### Goals

- Ingest OTLP GenAI spans at **100k spans/s per region** with horizontal scale.
- Live execution view: agent hop → pixel in **≤ 250 ms p95**.
- Topology + analytics queries **p95 ≤ 300 ms**.
- Render **5,000-node** topology at **60 fps** on a mid-tier laptop.
- First-class adapters for LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, Vercel AI SDK, and raw OTel.

### Non-goals (v1)

- Log management / full-text log search (we index spans, not arbitrary logs).
- On-call/paging product (we emit alert webhooks; PagerDuty/Opsgenie integrate).
- Self-hosted single-binary (cloud-first; enterprise self-host is a later track).

### SLOs

| SLO                               | Target       |
| --------------------------------- | ------------ |
| Ingest availability               | 99.9%        |
| Data freshness (span → queryable) | ≤ 5 s p95    |
| Live pathway latency              | ≤ 250 ms p95 |
| Query latency (dashboards)        | ≤ 300 ms p95 |
| Frame time @ 1k nodes             | ≤ 16 ms p95  |

---

## 3. System architecture (end-to-end)

```
                 ┌──────────────┐
  agent runtime  │  @nexus/sdk  │  OTLP/GenAI spans
 (LangGraph,…) ─▶│  + OTel adpt │ ───────────────┐
                 └──────────────┘                 ▼
                                          ┌───────────────┐
                                          │   COLLECTOR    │  validate · enrich · sample
                                          │ (apps/collector)│  head + tail sampling
                                          └───────┬────────┘
                                                  │ produce
                                          ┌───────▼────────┐
                                          │  STREAM (NATS/  │  durable subjects:
                                          │  Redpanda)      │  spans.raw · runs.hops
                                          └──┬──────────┬───┘
                                  consume    │          │   consume
                          ┌─────────────────▼┐        ┌▼──────────────────┐
                          │  WRITERS          │        │  LIVE FAN-OUT      │
                          │ (apps/workers)    │        │ (apps/api · WS)    │
                          │  → ClickHouse     │        │  → browser clients │
                          │  → Neo4j projector│        └────────────────────┘
                          │  → Redis (live)   │
                          └───────┬───────────┘
                                  │
              ┌───────────────────┼──────────────────────┐
              ▼                   ▼                        ▼
        ┌───────────┐      ┌────────────┐          ┌─────────────┐
        │ ClickHouse │      │   Neo4j    │          │   Redis     │
        │ spans/     │      │ topology + │          │ live run    │
        │ metrics/   │      │  GDS algos │          │ state (TTL) │
        │ rollups    │      └────────────┘          └─────────────┘
              ▲                   ▲                        ▲
              └───────────────────┴────────────────────────┘
                          ┌────────────────┐
                          │   API GATEWAY   │  tRPC · REST · OTLP-in · WebSocket
                          │  (apps/api)     │
                          └───────┬─────────┘
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
            ┌──────────┐   ┌────────────┐   ┌────────────┐
            │ WEB app  │   │ MCP server │   │ integrations│
            │(apps/web)│   │ (apps/mcp) │   │ (webhooks)  │
            └──────────┘   └────────────┘   └────────────┘
```

**Read path:** SDK → collector → stream → ClickHouse/Neo4j/Redis → API → web.
**Live path:** collector emits `runs.hops` → stream → API WS fan-out → browser → 3D firing.
**Introspection path:** MCP server → API/stores → structured answer for an LLM/agent.

---

## 4. Telemetry data model

Aligned to **OpenTelemetry GenAI semantic conventions**, extended with agent/graph fields. A _run_ is an OTel trace; a _step_ is a span.

```ts
// @nexus/core — the wire model
type SpanKind =
  | "agent" // an agent's reasoning turn
  | "llm" // a model call
  | "tool" // a tool/function invocation
  | "retrieval" // vector / graph / search lookup
  | "router" // routing/decision
  | "guardrail" // policy/safety check
  | "chain"; // composite step

interface NexusSpan {
  traceId: string; // = runId
  spanId: string;
  parentSpanId?: string;
  name: string; // e.g. "researcher.invoke", "tool:web_search"
  kind: SpanKind;
  startUnixNano: number;
  endUnixNano: number;
  status: "ok" | "error";
  // GenAI attributes (subset, OTel-named)
  attrs: {
    "gen_ai.system"?: string; // openai | anthropic | ...
    "gen_ai.request.model"?: string;
    "gen_ai.usage.input_tokens"?: number;
    "gen_ai.usage.output_tokens"?: number;
    "gen_ai.cost.usd"?: number; // computed if not supplied
    "tool.name"?: string;
    "nexus.component_id"?: string; // stable id of the logical component (agent/tool)
    "nexus.component_kind"?: SpanKind;
    "error.type"?: string;
    [k: string]: unknown;
  };
}

// Derived: a live hop event for the 3D view (tiny, high-frequency)
interface HopEvent {
  runId: string;
  fromComponentId: string;
  toComponentId: string;
  edgeKind: "calls" | "invokes" | "persists";
  tStart: number; // ms epoch
  durationMs?: number; // filled on completion
  status?: "ok" | "error";
  color?: string; // by component/agent
}
```

**Component identity** is the crux: `nexus.component_id` collapses thousands of span instances into the _logical nodes_ of the topology (one "Researcher" node, one "web_search" tool node). The collector derives a stable id from `service.name + component name + kind` when the SDK doesn't supply one. The topology graph is built over **components**, not spans.

---

## 5. Storage architecture

Three stores, each chosen for one job. Putting everything in one DB is the classic mistake that kills either query latency or write throughput.

### 5.1 ClickHouse — spans, metrics, rollups (the volume)

Columnar, append-optimized, the backbone of Datadog-class analytics. Holds raw spans (TTL ~15–30d) and pre-aggregated rollups (longer TTL).

```sql
CREATE TABLE spans (
  tenant_id     LowCardinality(String),
  trace_id      String,
  span_id       String,
  parent_id     String,
  component_id  LowCardinality(String),
  kind          LowCardinality(String),
  model         LowCardinality(String),
  start_ts      DateTime64(6),
  duration_ms   Float32,
  status        Enum8('ok'=1,'error'=2),
  in_tokens     UInt32,
  out_tokens    UInt32,
  cost_usd      Float32,
  attrs         JSON
) ENGINE = MergeTree
PARTITION BY toYYYYMMDD(start_ts)
ORDER BY (tenant_id, component_id, start_ts);

-- materialized rollups (1m / 5m / 1h) for dashboards: latency p50/p95/p99,
-- error rate, tokens, cost per component per bucket.
```

Dashboards **never scan raw spans**; they hit rollup tables. This is the single biggest query-perf decision.

### 5.2 Neo4j — topology + graph algorithms (the relationships)

Bounded in size (components + edges, not spans). This is where the _intelligence_ lives, computed by **Neo4j GDS** (Graph Data Science) so the browser doesn't have to.

```cypher
// Schema
(:Component {id, kind, name, service, tenant_id, firstSeen, lastSeen})
(:Component)-[:CALLS {count, p50, p95, errorRate, costUsd, lastSeen}]->(:Component)

// Constraints
CREATE CONSTRAINT comp_id IF NOT EXISTS
  FOR (c:Component) REQUIRE (c.tenant_id, c.id) IS UNIQUE;

// GDS jobs (scheduled / triggered, results cached to component props)
CALL gds.pageRank.write('topo', {writeProperty:'centrality'})           // node size
CALL gds.betweenness.write('topo', {writeProperty:'betweenness'})        // bottleneck
CALL gds.louvain.write('topo', {writeProperty:'community'})              // constellations
// blast radius = parameterized reachability over CALLS, run on demand
```

The Neo4j projector (a stream worker) maintains the graph incrementally: each span batch upserts `CALLS` edges and updates rolling stats. GDS runs on a debounce (topology changes are slow). **Centrality/betweenness/community ship to the client as numbers** — see §11.

### 5.3 Redis — live run state (the now)

Per-active-run state with short TTL: current step, accumulated cost/tokens, the path so far. Powers the live HUD and lets a reconnecting client resync without replaying the stream. Keys: `run:{tenant}:{runId}` (hash), TTL ~10 min after completion.

### Where data goes — summary

| Data                          | Store                        | Why                           |
| ----------------------------- | ---------------------------- | ----------------------------- |
| Raw spans                     | ClickHouse                   | volume, columnar scans, TTL   |
| Metric rollups                | ClickHouse                   | sub-300ms dashboards          |
| Components + edges + stats    | Neo4j                        | graph queries, GDS algorithms |
| Centrality/community (cached) | Neo4j props → API cache      | precomputed, ship as numbers  |
| Live run state                | Redis                        | fast read/write, resync       |
| Live hops                     | Stream → WS (not stored hot) | real-time fan-out             |

---

## 6. Ingestion pipeline

### 6.1 SDKs (`@nexus/sdk-js`, `nexus-sdk` Python)

Thin wrappers over OpenTelemetry that add the `nexus.component_*` attributes and known-cost model pricing. Zero-config auto-instrumentation via framework adapters.

```ts
import { nexus } from "@nexus/sdk-js";

nexus.init({ apiKey: process.env.NEXUS_KEY, service: "support-agent" });

// auto-instruments LangGraph / OpenAI / Anthropic / tool calls.
// or manual:
await nexus.span(
  { kind: "tool", componentId: "web_search", name: "tool:web_search" },
  () => searchTheWeb(q)
);
```

Adapters map each framework's callbacks to spans. Because the base is OTel, anyone already exporting OTLP can point their exporter at our collector with **no SDK at all**.

### 6.2 Collector (`apps/collector`)

Stateless, horizontally scaled. Accepts OTLP/HTTP (`/v1/traces`) and OTLP/gRPC. Responsibilities:

- **Validate & enrich:** derive `component_id`, compute `cost_usd` from a pricing table if absent.
- **Derive hops:** for each parent→child and tool invocation, emit a `HopEvent` to `runs.hops`.
- **Sample** (critical for cost/perf):
  - _Head sampling_ for trivially high-volume, low-value traces (configurable rate).
  - _Tail sampling_ (buffer the trace, decide on completion): **keep 100% of errors and slow/expensive runs**, sample the rest. This is the Datadog playbook — you never drop the interesting traces.
- Produce `spans.raw` (sampled) + `runs.hops` (live) to the stream.

### 6.3 Stream (NATS JetStream or Redpanda)

Durable, replayable, decouples ingest spikes from writers. Subjects: `spans.raw`, `runs.hops`, `topology.delta`. Backpressure isolates a slow ClickHouse from the live path.

### 6.4 Writers (`apps/workers`)

Independent consumers, each scalable on its own:

- **ClickHouse writer:** batched async inserts (≥ 10k rows or 1s).
- **Neo4j projector:** upsert components/edges + rolling stats; enqueue GDS recompute on topology change.
- **Redis writer:** maintain live run state.

---

## 7. API surface (`apps/api`)

One gateway, four protocols. Internal app uses tRPC (type-safe); external integrations get REST; ingestion is OTLP; live is WebSocket.

### 7.1 tRPC routers (consumed by the web app via `@nexus/query`)

```
topology.get({ tenant, filter, window })        → { nodes, edges }  (with cached centrality/community)
topology.subgraph({ rootId, depth })            → focused cluster
topology.blastRadius({ componentId })           → { affected: id[], paths }
runs.list({ filter, cursor })                   → paginated run summaries
runs.get({ traceId })                           → full trace tree + timings + cost
runs.live({ filter })                           → SUBSCRIPTION → HopEvent stream
metrics.timeseries({ componentId, metric, window, step }) → rollup series
metrics.cost({ window, groupBy })               → $ breakdown by model/component/agent
metrics.tokens({ window, groupBy })             → token breakdown
incidents.list({ window })                      → open/resolved incidents
incidents.get({ id })                           → root cause + blast radius
search.spans({ query, window, cursor })         → span search
```

### 7.2 REST (public, versioned `/api/v1`)

```
GET  /api/v1/topology?window=1h
GET  /api/v1/runs/:traceId
GET  /api/v1/metrics?component=&metric=&window=&step=
POST /api/v1/alerts/webhook         (register destination)
POST /v1/traces                     (OTLP ingest — also on collector)
```

### 7.3 WebSocket (live)

Single multiplexed socket. Client subscribes to **only the visible subgraph** (LOD-aware) to bound fan-out:

```
→ { op:'sub', channel:'runs.hops', filter:{ components:[...] } }
← { op:'hop', data: HopEvent }            // drives 3D firing
← { op:'topology.delta', data:{...} }     // node/edge added/removed
← { op:'alert', data:{...} }
```

---

## 8. MCP server (`apps/mcp`) — the differentiator

Exposes NEXUS observability as MCP tools so an LLM/agent (e.g. a developer's copilot, or the agent system observing _itself_) can query traces, costs, and topology conversationally. Auth via per-tenant API key passed at connection.

### Tool catalog

```
get_topology(filter?, window?)
   → { components:[{id,name,kind,centrality,betweenness,errorRate}], edges:[...] , summary }

get_run(trace_id)
   → { tree, total_ms, cost_usd, tokens, bottleneck_span, summary }

find_bottlenecks(window?, by?: 'latency'|'betweenness'|'cost')
   → ranked components + natural-language explanation

explain_incident(incident_id)
   → { root_cause_component, blast_radius:[ids], evidence_spans, summary }

query_metrics(component_id, metric, window, step?)
   → timeseries + trend summary

get_cost_breakdown(window, group_by: 'model'|'component'|'agent')
   → table + "where the money goes" summary

search_runs(query, window?)        → matching run summaries
compare_runs(trace_id_a, trace_id_b) → structural + metric diff
```

Every tool returns **structured JSON _and_ a `summary` string** so the calling model can either reason over data or relay prose. The MCP server is a thin adapter over the same tRPC/store layer the web app uses — no duplicated logic. This is what lets a developer ask their assistant _"what made run abc123 cost $0.40?"_ and get a grounded answer.

---

## 9. Real-time pathway streaming (how the 3D view fires)

The live neural-firing visual is an end-to-end pipeline, not a frontend animation:

1. Collector emits a `HopEvent` the instant a parent→child span relationship is observed (it does **not** wait for the run to finish).
2. `runs.hops` → API WS gateway → fan-out to clients subscribed to that subgraph.
3. `@nexus/core` receives the hop, resolves `from/to` to node positions, and enqueues a **signal** on the renderer.
4. `@nexus/render` animates the signal along the edge, heats the edge (decaying trail), flashes the arrival node — exactly the mechanic prototyped in `NeuralOrchestrator.jsx`, now driven by real telemetry instead of `spawn()`.

**Backpressure & coalescing:** the server caps hop rate per client (e.g. 200/s); above that it aggregates ("12 hops Researcher→VectorStore") into a single weighted signal. The client coalesces all hops received within a frame into one buffer write. A reconnecting client GETs `runs.live` state from Redis to resync without stream replay.

---

## 10. Frontend architecture — the React package plan

Monorepo, pnpm workspaces + Turborepo. **Strict one-way dependency flow.** The render engine knows nothing about the API; it consumes plain data. This is what makes each layer independently testable and swappable.

### 10.1 Packages

| Package              | Responsibility                                                                                                   | Key public exports                                                | Depends on                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `@nexus/core`        | wire types, client store (Zustand), transport (WS/SSE) client, event projection                                  | `createClient()`, `NexusSpan`, `HopEvent`, `useStore`             | —                               |
| `@nexus/graph`       | graphology model, **layout worker**, client-side cheap algos (reachability, neighbor)                            | `LayoutEngine`, `GraphModel`, `coarsen()`                         | `@nexus/core`                   |
| `@nexus/render`      | hybrid renderer — **WebGL 3D (three)** neural ball + **2D graph** + camera, LOD, quadtree culling, signal system | `Renderer3D`, `Renderer2D`, `Camera`, `SignalSystem`              | — (plain data in)               |
| `@nexus/r3f`         | React bindings/hooks over the renderer                                                                           | `<NeuralGraph/>`, `<TopologyMap/>`, `useSignals()`, `useCamera()` | `@nexus/render`, `@nexus/graph` |
| `@nexus/interaction` | pointer FSM, selection, intents, hit-test bridge                                                                 | `usePointer()`, `useSelection()`                                  | `@nexus/graph`                  |
| `@nexus/ui`          | design system, control decks, HUD, trace-tree, charts (virtualized)                                              | `<ControlDeck/>`, `<TraceTree/>`, `<CostPanel/>`, tokens          | —                               |
| `@nexus/query`       | typed tRPC client + react-query hooks                                                                            | `useTopology()`, `useRun()`, `useLiveRuns()`, `useMetrics()`      | `@nexus/core`                   |
| `@nexus/sdk-js`      | OTel-based instrumentation SDK (ships to customers)                                                              | `nexus.init()`, `nexus.span()`, adapters                          | —                               |
| `@nexus/mcp-tools`   | shared MCP tool input/output schemas (zod)                                                                       | tool schemas                                                      | `@nexus/core`                   |

```
              @nexus/ui      @nexus/sdk-js   (leaf, shippable)
                 │
   apps/web ─┬── @nexus/r3f ── @nexus/render
             ├── @nexus/query ── @nexus/core
             └── @nexus/interaction ── @nexus/graph ── @nexus/core
   apps/mcp ──── @nexus/mcp-tools ── @nexus/core
```

### 10.2 Render engine (`@nexus/render`) — dual mode

The same graph data renders two ways; the user toggles altitude/representation:

- **Neural Ball (3D):** the `NeuralOrchestrator` mechanic productized — shells via Fibonacci sphere, additive-sprite glow (no post-processing dependency), signals as a single `Points` buffer, edges as one `LineSegments` buffer, custom drag/zoom. For the immersive live view.
- **Topology Map (2D):** force/ELK layout, WebGL-instanced nodes, for dense analysis and dashboards.

```ts
interface Renderer {
  mount(el: HTMLElement): void;
  setCamera(c: Camera): void;
  upsertNodes(n: RenderNode[]): void; // delta only
  removeNodes(ids: string[]): void;
  upsertEdges(e: RenderEdge[]): void;
  fireSignal(s: Signal): void; // live hop → travelling particle + trail
  setLOD(level: 0 | 1 | 2): void;
  hitTest(x: number, y: number): string | null; // quadtree (2D) / raycast (3D)
  dispose(): void;
}
```

Control decks, trace trees, and charts are **always DOM/React overlays** (`@nexus/ui`) anchored to projected coordinates — WebGL draws geometry only.

### 10.3 App (`apps/web`)

Vite SPA (or Next.js for SSR marketing + app shell). Three primary surfaces: **Live** (neural ball + firing), **Explore** (2D topology + filters + GDS-ranked emphasis), **Trace** (single run flame/tree + cost). Routing is shallow; the graph is the constant.

---

## 11. Performance engineering (cross-cutting)

Each layer has a budget and an enforcement point. The governing principle: **do expensive work where it's cheapest and cache aggressively; never do it in the render loop.**

### 11.1 Ingestion

- Tail sampling keeps interesting traces, drops noise → bounded storage + query cost.
- Batched async writes to ClickHouse; the stream absorbs spikes (backpressure, never block ingest).

### 11.2 Storage / query

- Dashboards read **rollup tables**, never raw spans.
- ClickHouse partitioning + `ORDER BY (tenant, component, ts)` for locality.
- Neo4j kept small (components, not spans); **GDS algorithms run server-side, cached to node props**, refreshed on a debounce.
- Cursor pagination everywhere; no offset scans.

### 11.3 Real-time

- LOD-aware subscriptions: subscribe to the **visible subgraph only**.
- Per-client hop-rate cap with server-side aggregation.
- Client coalesces hops per animation frame (one buffer write/frame).

### 11.4 Frontend render (the 60 fps contract — 16.6 ms budget)

- **Layout in a Web Worker**; positions in transferable `Float32Array`.
- **No React in the hot loop.** Position/signal updates write typed arrays + `requestAnimationFrame`; React re-renders only on structural/selection change.
- **WebGL instancing**: one draw call for all nodes, one `LineSegments` for edges, one `Points` for signals.
- **Viewport culling** via quadtree (2D) before per-node work; frustum cull (3D).
- **Semantic LOD / coarsening**: Macro renders community super-nodes (tens), not thousands.
- Heavy graph algorithms are **already numbers from the server** (GDS) — client does layout + cull + draw only.
- Virtualized trace lists and tables (`@nexus/ui`), `prefers-reduced-motion` freezes flow animations.

### 11.5 CI perf gates

Synthetic 1k/5k topologies and a recorded hop stream run in CI; PRs fail on regression of frame time, layout settle time, or query p95.

| Layer                | Budget                | Gate            |
| -------------------- | --------------------- | --------------- |
| Collector throughput | ≥ 100k spans/s/region | load test       |
| Span → queryable     | ≤ 5 s p95             | synthetic probe |
| Dashboard query      | ≤ 300 ms p95          | query bench     |
| Hop → pixel          | ≤ 250 ms p95          | e2e probe       |
| Frame @ 1k nodes     | ≤ 16 ms p95           | render bench    |

---

## 12. Monorepo layout & tooling

```
nexus/
├─ apps/
│  ├─ web         (Vite/Next React app)
│  ├─ collector   (OTLP ingest + sampler + producer)
│  ├─ api         (tRPC + REST + OTLP + WS gateway)
│  ├─ mcp         (MCP server)
│  └─ workers     (ClickHouse/Neo4j/Redis writers + GDS scheduler)
├─ packages/      (the @nexus/* React + shared packages from §10)
├─ infra/         (Terraform, k8s manifests, ClickHouse/Neo4j/NATS charts)
└─ turbo.json, pnpm-workspace.yaml
```

- **pnpm + Turborepo**: cached builds, task graph, affected-only CI.
- **TypeScript everywhere** (Python SDK separate repo or `sdk-py/`).
- **Contracts:** zod schemas in `@nexus/core`/`@nexus/mcp-tools` are the single source of truth shared by API, MCP, and client.
- Vitest (unit), Playwright (e2e), k6 (load), custom render bench.

---

## 13. Phased roadmap

### Phase 0 — Spine (3–4 wks)

OTLP collector (no sampling) → ClickHouse → tRPC `runs.get` + `topology.get`. `@nexus/render` 2D + the `NeuralOrchestrator` 3D view fed by **replayed** hops. SDK alpha for LangGraph. _Exit:_ a real trace ingested shows up as a run and a node.

### Phase 1 — Live & graph (4–5 wks)

`runs.hops` → WS → live 3D firing. Neo4j projector + GDS centrality/community. Worker layout + culling. Trace tree + cost panel. _Exit:_ watch real agents fire in real time; bottleneck nodes are visibly bigger.

### Phase 2 — Observability product (5–6 wks)

Rollups + dashboards (metrics/cost/tokens), tail sampling, incidents + blast radius, search. Multi-tenancy + API keys + RBAC. _Exit:_ a team can run NEXUS as their agent APM.

### Phase 3 — MCP & intelligence (4 wks)

MCP server (full tool catalog), anomaly detection on rollups, `compare_runs`. Adapters for CrewAI/AutoGen/OpenAI Agents/Vercel AI SDK. _Exit:_ an agent can debug itself over MCP.

### Phase 4 — Scale & enterprise (ongoing)

Sharded ClickHouse, GDS on large graphs (sampled betweenness), SSO/SAML, self-host track, alerting integrations.

---

## 14. Reliability, multi-tenancy, security

- **Multi-tenancy:** `tenant_id` is the leading sort key in ClickHouse and a property + constraint in Neo4j; every query is tenant-scoped at the API boundary. Optionally per-tenant Neo4j databases at scale.
- **AuthN/Z:** ingestion via API keys (scoped, rotatable); app via OAuth/OIDC; RBAC roles (viewer/operator/admin). MCP connections authenticate with a scoped key.
- **Data governance:** prompt/response payloads are **opt-in** and redactable at the SDK; PII scrubbing in the collector; configurable retention.
- **Isolation:** the live path and the write path are separate stream subjects and separate services — a ClickHouse stall never freezes the live view.
- **DR:** ClickHouse replicas, Neo4j cluster, stream durable storage with replay.

---

## 15. Testing & self-observability

- **Headless pipeline tests:** feed a recorded OTLP fixture through collector → writers → stores → API; assert spans, derived edges, centrality ranks, and blast-radius sets.
- **Contract tests:** zod schemas validated on both producer and consumer of every boundary.
- **Render golden + bench:** fixed `RenderNode[]` → pixel snapshot per LOD; frame-time bench in CI.
- **NEXUS observes NEXUS:** the platform emits its own OTel spans into a dogfood tenant — we debug the observability platform with the observability platform.

---

## 16. Risks & mitigations

| Risk                                     | Severity | Mitigation                                                       |
| ---------------------------------------- | -------- | ---------------------------------------------------------------- |
| **Cardinality / storage explosion**      | High     | Tail sampling; rollups; TTL; payloads opt-in                     |
| Neo4j becomes a write bottleneck         | High     | Project _components_ not spans; async GDS; batch upserts         |
| Browser can't render large graphs        | High     | Server-side GDS, WebGL instancing, worker layout, LOD/coarsening |
| Live fan-out doesn't scale               | Med      | Subgraph-scoped subs, per-client rate caps, aggregation          |
| Layout instability breaks spatial memory | Med      | Pin visible nodes, clamp displacement, relax-then-freeze         |
| OTel GenAI conventions still evolving    | Med      | Adapter layer isolates convention churn from storage schema      |
| Prompt payloads = compliance liability   | Med      | Opt-in, redaction, retention controls, PII scrub at collector    |

---

## 17. Open questions (decide before Phase 1)

1. **Stream choice:** NATS JetStream (lighter, simpler ops) vs Redpanda/Kafka (ecosystem, throughput ceiling)?
2. **Trace store:** ClickHouse (likely) vs a managed columnar (cost vs ops)?
3. **Hop derivation point:** collector (lower latency, more collector CPU) vs a dedicated stream processor (cleaner separation)?
4. **Component identity:** SDK-supplied `component_id` as the contract, or always collector-derived (resilient to bad instrumentation)? Probably _both_: SDK preferred, collector fallback.
5. **Live emphasis driver:** which GDS metric is the default node-size signal — PageRank (throughput) or betweenness (bottleneck)?

---

## Appendix A — endpoint cheat-sheet

| Surface | Path/Procedure                                         | Purpose             |
| ------- | ------------------------------------------------------ | ------------------- | -------- | ------------ |
| OTLP    | `POST /v1/traces`                                      | ingest              |
| tRPC    | `topology.get` / `runs.get` / `runs.live` (sub)        | app data + live     |
| tRPC    | `metrics.timeseries` / `metrics.cost`                  | dashboards          |
| tRPC    | `incidents.blastRadius`                                | impact analysis     |
| REST    | `GET /api/v1/topology                                  | runs/:id            | metrics` | integrations |
| WS      | `runs.hops`, `topology.delta`, `alert`                 | real-time           |
| MCP     | `get_run`, `find_bottlenecks`, `get_cost_breakdown`, … | agent introspection |

## Appendix B — store/algorithm placement

| Concern                          | Where                    | Cadence               |
| -------------------------------- | ------------------------ | --------------------- |
| Raw spans / search               | ClickHouse               | on write              |
| Latency/cost/token rollups       | ClickHouse MV            | continuous            |
| Topology + edge stats            | Neo4j                    | incremental projector |
| PageRank / betweenness / Louvain | Neo4j GDS                | debounced, cached     |
| Blast radius (reachability)      | Neo4j                    | on demand             |
| Live run state                   | Redis                    | on hop                |
| Layout / culling / draw          | browser (worker + WebGL) | per frame             |

---

_End of build plan._
