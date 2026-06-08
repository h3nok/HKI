# Myelin — Design Document v0.2

> Live 3D projection of agentic orchestration topology. Signals travel real graph edges. Neo4j persists the topology. Three.js renders the pathways.

---

## 1. Vision

Myelin is a **runtime observability visualizer** for agentic systems. Its primary artifact is a neural-network-style 3D graph that projects the live state of an orchestration topology — nodes are agents, tools, and persistence layers; edges are the relationships between them; travelling particles are signals (LLM calls, tool invocations, memory reads) in motion.

It is **not** a flow editor, not a diagram tool, and not a replay timeline. It is a live window into what the orchestrator is doing right now.

---

## 2. Architecture

### 2.1 Package Map

```
@myelin/core           — Types, topology schema, graph algorithms  (no deps)
@myelin/react          — Three.js visualizer component              (peer: react, three)
@myelin/neo4j          — Neo4j topology provider hook               (dep: neo4j-driver, @myelin/core)

apps/myelin-showcase   — Standalone dev/demo app
apps/agentic               — Production: /orchestrator route
```

### 2.2 Data Flow

```
Neo4j graph DB
  └─ MATCH (n)-[r]->(m) RETURN n,r,m
        │
        ▼
  OrchestratorTopology  ←── @myelin/core types
        │
        ▼
  buildGraph(topology, theme)     ← pure function, deterministic layout
        │
        ├─ GNode[]    positions via fibonacci sphere distribution
        └─ GEdge[]    adjacency map for signal routing
              │
              ▼
        Three.js scene (useEffect, single RAF loop)
              │
              ├─ IcosahedronGeometry shell
              ├─ LineSegments (vertex-colored edges, one draw call)
              ├─ Sprite halos (additive blending)
              ├─ Points buffer (MAX_SIG=64 travelling signals)
              └─ React overlay panels (CSS custom properties)
```

### 2.3 Render Budget

The render loop must stay within 16ms (60fps) on a mid-range laptop GPU.

| Object           | Draw calls | Notes                                     |
| ---------------- | ---------- | ----------------------------------------- |
| Shell wireframe  | 1          | IcosahedronGeometry, static               |
| All edges        | 1          | Single `LineSegments` with `vertexColors` |
| All node meshes  | N (22 max) | Small spheres, batched                    |
| All halos        | N (22 max) | `Sprite`, additive                        |
| Signal particles | 1          | Single `Points` buffer, MAX_SIG=64        |
| Starfield        | 1          | Static                                    |
| **Total**        | **≤ 50**   | Acceptable for WebGL                      |

---

## 3. Core Types (`@myelin/core`)

### 3.1 Node Roles

```typescript
type NodeRole = "orchestrator" | "agent" | "tool" | "persist";
```

| Role           | Description                           | Radius     | Count |
| -------------- | ------------------------------------- | ---------- | ----- |
| `orchestrator` | Central coordinator (1 per topology)  | 0 (center) | 1     |
| `agent`        | Reasoning / planning / routing agents | 42         | 2–12  |
| `tool`         | Stateless tool invocations            | 74         | 2–20  |
| `persist`      | Storage, memory, cache, graph         | 74         | 2–10  |

### 3.2 Topology Schema

```typescript
interface TopologyNode {
  id: string;
  role: NodeRole;
  label: string;
  rel: string; // Neo4j relationship type (e.g. ROUTES_TO)
  metadata?: Record<string, unknown>;
}

interface TopologyEdge {
  source: string;
  target: string;
  weight?: number; // signal frequency hint
}

interface OrchestratorTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}
```

### 3.3 Graph Algorithms

```typescript
// Deterministic layout — stable across reloads for a given topology
buildGraph(topology: OrchestratorTopology, theme: NeuralOrchestratorTheme): Graph

// Signal routing — multi-hop path from orchestrator outward
makeRoute(graph: Graph): number[]       // returns node id sequence
```

---

## 4. Theme System (`@myelin/react`)

### 4.1 Interface

```typescript
interface NeuralOrchestratorTheme {
  bg: number; // Three.js hex integer
  nodes: Record<NodeRole, number>; // per-role colors
  edges: { base: number; hot: number }; // cold → active
  signals: readonly [number, number, number, number, number]; // cycling palette
}
```

### 4.2 Built-in Themes

| Theme                | Use case                           | bg        | agent    | tool      |
| -------------------- | ---------------------------------- | --------- | -------- | --------- |
| `hkiTheme` (default) | HKI platform — dark, brand-colored | `#000000` | Iris 400 | Coral 400 |
| `neuralTheme`        | Sci-fi / dark showcase             | `#03060d` | cyan     | amber     |

### 4.3 Theme Derivation Rule

**Never hardcode hex colors in component logic.** All Three.js material colors must derive from `theme.*`. All overlay panel colors must derive from CSS custom properties (`var(--primary)`, `var(--card)`, `var(--border)`, etc.).

The theme object is captured in the `useEffect` closure at mount. If `theme` changes, the effect reruns and the scene rebuilds.

---

## 5. Component API (`@myelin/react`)

### 5.1 `<NeuralOrchestrator>`

```typescript
interface NeuralOrchestratorProps {
  // Live Neo4j-derived topology. Falls back to default HKI fixture if omitted.
  topology?: OrchestratorTopology;

  // Visual theme. Defaults to hkiTheme.
  theme?: NeuralOrchestratorTheme;

  // Dark mode flag — changes overlay panel CSS class. Defaults to true.
  dark?: boolean;

  // Called when user clicks a node.
  onNodeSelect?: (node: TopologyNode | null) => void;
}
```

### 5.2 Hooks

```typescript
// Topology data layer — returns live topology from any source
useOrchestratorTopology(opts: {
  url?: string               // REST endpoint → OrchestratorTopology JSON
  refreshMs?: number         // polling interval, default 10_000
  fallback?: OrchestratorTopology  // used while loading or on error
}): { topology: OrchestratorTopology; loading: boolean; error: Error | null }
```

---

## 6. Engineering Invariants

These must not be violated. They mirror the spirit of HKI's core invariants — the theme is "determinism and explicit contracts."

1. **Deterministic layout.** `buildGraph()` called with the same `topology` + same RNG seed must produce identical node positions. Never use `Math.random()` directly — always `mulberry32(seed)`.

2. **No React state in the render loop.** The Three.js `requestAnimationFrame` callback must not call `setState` or access React state. Use `useRef` for all loop-accessible mutable state. Only `setHud`, `setFeed`, `setSelected` are allowed in the RAF loop — throttled to ≤5 calls/s via an accumulator.

3. **Single draw call for edges.** All edges in one `LineSegments` object with `vertexColors`. Never create per-edge `Line` objects.

4. **Signal buffer is fixed-size.** `MAX_SIG = 64` is a compile-time constant. Never grow the buffer at runtime. Signal slots are reused (`active` flag).

5. **Theme colors from theme object only.** Never hardcode `0x5fe8ff` or any hex color in component logic. Read from `theme.nodes[role]`, `theme.edges.hot`, etc.

6. **Overlay panels use CSS custom properties.** Never hardcode `#0a1626` or similar in JSX styles. Use `var(--card)`, `var(--border)`, `var(--primary)`, `var(--muted-foreground)`.

7. **Full cleanup on unmount.** `cancelAnimationFrame`, `ResizeObserver.disconnect`, `renderer.dispose()`, geometry/material `dispose()`, `removeChild(domElement)`. No WebGL context leak.

8. **Topology is source of truth.** The default HKI fixture is a fallback, not canon. When a topology prop is provided, the hardcoded fixture must not influence the render.

9. **`OrchestratorTopology` crosses package boundaries.** Types flow: `@myelin/core` → `@myelin/react` → `@myelin/neo4j`. Never define topology types inline in a consuming app.

10. **Package boundaries are clean.** `@myelin/react` must not import from `apps/*`. `@myelin/core` must have zero runtime dependencies.

---

## 7. Neo4j Topology (Cypher Reference)

### 7.1 Fetch full topology

```cypher
MATCH (n)
WHERE n:Orchestrator OR n:Agent OR n:Tool OR n:Persist
OPTIONAL MATCH (n)-[r]->(m)
WHERE m:Orchestrator OR m:Agent OR m:Tool OR m:Persist
RETURN n, type(r) AS rel, m
```

### 7.2 Node label → NodeRole mapping

| Neo4j Label    | NodeRole       |
| -------------- | -------------- |
| `Orchestrator` | `orchestrator` |
| `Agent`        | `agent`        |
| `Tool`         | `tool`         |
| `Persist`      | `persist`      |

### 7.3 Default HKI Topology (fixture)

The default topology baked into `@myelin/react` mirrors the HKI platform architecture:

| Layer   | Nodes                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Core    | HKI ORCHESTRATOR                                                                                           |
| Agents  | Planner, Router, Researcher, Coder, Critic, Synthesizer, Guardrail                                         |
| Tools   | Web Search, Code Runner, SQL Tool, Browser, Embedder, Reranker, File IO, Scheduler, LLM·GPT-4o, LLM·Claude |
| Persist | Vector Store, Neo4j Graph, Memory, Cache                                                                   |

---

## 8. Sprint Plan

| Sprint | Milestone           | Description                                                                                |
| ------ | ------------------- | ------------------------------------------------------------------------------------------ |
| AG-1   | Theme Bridge        | `NeuralOrchestratorTheme` type, `hkiTheme` + `neuralTheme` presets, CSS var overlay panels |
| AG-2   | Agentic Integration | `/orchestrator` route in `apps/agentic`, dark-mode wiring, sidebar nav                     |
| AG-3   | Topology Data Layer | `OrchestratorTopology` schema in core, `useOrchestratorTopology` hook, tRPC procedure      |
| AG-4   | Package Quality     | `tsup` dual output, exports map, `@myelin/neo4j` scaffold, showcase demo routes            |

**Current status: AG-1 in progress.**

---

## 9. File Pattern Reference

| Path                                                 | What it is                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/myelin-core/src/types.ts`                  | Canonical types: `NodeRole`, `TopologyNode`, `OrchestratorTopology`, graph event types |
| `packages/myelin-react/src/NeuralOrchestrator.tsx`   | Main component: Three.js scene + overlay panels                                        |
| `packages/myelin-react/src/themes/index.ts`          | `NeuralOrchestratorTheme` interface, `hkiTheme`, `neuralTheme`                         |
| `packages/myelin-react/src/index.ts`                 | Public exports                                                                         |
| `packages/myelin-react/tsup.config.ts`               | Dual ESM+CJS build                                                                     |
| `apps/myelin-showcase/`                              | Standalone Vite dev app for visual iteration                                           |
| `apps/agentic/client/src/pages/OrchestratorPage.tsx` | Agentic platform route `/orchestrator`                                                 |
| `docs/myelin/DESIGN.md`                              | This document                                                                          |

---

## 10. What NOT to Do

- Never use `Math.random()` in `buildGraph` — use `mulberry32(seed)`.
- Never call `setState` inside the RAF loop — use refs + a throttled flush.
- Never create per-edge Three.js `Line` objects — one `LineSegments` always.
- Never grow `sigs[]` beyond `MAX_SIG` — reuse slots.
- Never import `apps/*` from `packages/*`.
- Never hardcode topology node names in `NeuralOrchestrator.tsx` — read from `topology` prop or the fixture in `@myelin/core`.
- Never add Three.js to peer dependencies — it's a direct dep of `@myelin/react` (it's the rendering engine, not a framework the user supplies).
