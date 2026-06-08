# /myelin — Myelin Development Assistant

You are working on **Myelin**, a live 3D neural-network visualizer for agentic orchestration topologies built into the HKI Platform monorepo.

## Package map

```
packages/myelin-core/     → @myelin/core   (types, schema, algorithms — zero deps)
packages/myelin-react/    → @myelin/react  (Three.js component, themes)
apps/myelin-showcase/     → standalone Vite dev app
apps/agentic/                 → production app — route /orchestrator
docs/myelin/DESIGN.md     → design document, invariants, sprint plan
```

## Key commands

```bash
# Build & typecheck
pnpm --filter @myelin/react build       # tsup dual ESM+CJS
pnpm --filter @myelin/react typecheck
pnpm --filter @myelin/core typecheck

# Dev
pnpm --filter @myelin/showcase dev      # http://localhost:5174

# Tests
pnpm --filter @myelin/core test

# Full build
pnpm build:myelin
```

## Engineering invariants (from docs/myelin/DESIGN.md §6)

You MUST enforce these in all code you write or review:

1. **Deterministic layout.** `buildGraph()` must use `mulberry32(seed)` — never `Math.random()` directly.
2. **No React state in the render loop.** RAF callback uses refs only. `setHud`/`setFeed`/`setSelected` are throttled to ≤5 calls/s via an accumulator.
3. **Single draw call for edges.** One `LineSegments` with `vertexColors`. Never per-edge `Line` objects.
4. **Signal buffer fixed-size.** `MAX_SIG = 64` is a constant. Reuse slots via `active` flag.
5. **Theme colors from theme object only.** Read `theme.nodes[role]`, `theme.edges.hot`, etc. Never hardcode hex.
6. **Overlay panels use CSS custom properties.** Use `var(--card)`, `var(--border)`, `var(--primary)`. Never hardcode colors in JSX styles.
7. **Full cleanup on unmount.** `cancelAnimationFrame` + `ResizeObserver.disconnect` + `renderer.dispose()` + geometry/material dispose + `removeChild(domElement)`.
8. **Topology is source of truth.** Fixture is fallback only. `topology` prop overrides completely.
9. **Types cross boundaries via `@myelin/core`.** Never define `TopologyNode`/`OrchestratorTopology` inline in consuming apps.
10. **Package boundaries.** `@myelin/react` never imports from `apps/*`. `@myelin/core` has zero runtime deps.

## Theme system

```typescript
// packages/myelin-react/src/themes/index.ts
interface NeuralOrchestratorTheme {
  bg: number; // Three.js hex integer
  nodes: Record<NodeRole, number>; // per-role Three.js hex colors
  edges: { base: number; hot: number }; // cold edge → signal-active edge
  signals: readonly [number, number, number, number, number];
}

// Built-in presets
import { hkiTheme, neuralTheme } from "@myelin/react";
```

## HKI color palette (use in hkiTheme)

```
Iris 400  #1fa9a5  → agent nodes, edge hot
Iris 300  #3dcbc6  → edge hot glow
Violet    #8b36d6  → orchestrator
Coral 400 #ea5c38  → tool nodes, signal[2]
Success   #22c55e  → persist nodes
Amber     #f59e0b  → signal[4]
```

## CSS custom properties for overlay panels

Always use these — never hardcode panel colors:

```
--card              panel background
--card-foreground   panel text
--border            panel edge
--muted-foreground  secondary text
--primary           accent / active color
--foreground        primary text
```

## Component usage

```tsx
import { NeuralOrchestrator, hkiTheme } from '@myelin/react'
import type { OrchestratorTopology } from '@myelin/core'

// Default — uses built-in HKI fixture topology
<NeuralOrchestrator theme={hkiTheme} />

// With live topology
<NeuralOrchestrator theme={hkiTheme} topology={myTopology} />
```

## Sprint status

| Sprint | Status         | Description                                       |
| ------ | -------------- | ------------------------------------------------- |
| AG-1   | ✅ In progress | Theme bridge, CSS var panels, hkiTheme            |
| AG-2   | 🔜 Next        | Agentic /orchestrator route                       |
| AG-3   | 📋 Planned     | Neo4j topology feed, useOrchestratorTopology hook |
| AG-4   | 📋 Planned     | tsup build, package quality, @myelin/neo4j        |

## When working on this codebase

- Read `docs/myelin/DESIGN.md` for architecture decisions before making structural changes.
- Run `pnpm --filter @myelin/react typecheck` before declaring any TypeScript work done.
- When adding new exports, update both `src/index.ts` AND `tsup.config.ts` entry/externals.
- The Three.js render loop in `NeuralOrchestrator.tsx` is performance-critical — profile before optimizing, measure after.
- When touching the signal routing or layout algorithms, verify determinism: same seed → same output.
