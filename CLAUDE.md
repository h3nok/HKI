# CLAUDE.md — HKI Platform

Claude Code project instructions. These override all defaults.

---

## What This Repo Is

**HKI (Hermetic Knowledge Isolation)** is a control framework for the agentic era.
It defines a signed runtime contract — the `HkiEnvelope` — that propagates from
gateway to retrieval to tool to cache to async job to audit log. Every runtime
operation executes inside exactly one active domain. No global visibility, no
wildcard fallbacks, no silent cross-domain reads.

The repo contains:

- The normative spec: `spec/HKI-1.0.md`
- TypeScript runtime: `packages/hki-runtime/` → `@hki/runtime`
- Python runtime: `packages/hki-runtime-py/` → `hki-runtime` on PyPI
- Conformance harness: `packages/hki-conformance/` → `@hki/conformance`
- Framework adapters: `packages/hki-{litellm,langchain,llamaindex,adk,autogen,crewai}/`
- MCP guard: `packages/hki-mcp/` → `@hki/mcp`
- SDK: `packages/sdk/` → `@hki/sdk`
- Python conformance checker: `packages/hki-conformance-py/`
- Reference services: `services/{knowledge-api,orchestrator-service,ingestion-pipeline-service,analytics-service,hki-probe-target}/`
- Agentic UI + BFF: `apps/agentic/` (Vite + tRPC + Wouter, MySQL via drizzle/mysql2, NOT PostgreSQL)
- **Myelin visualizer:** `packages/myelin-{core,react}/` + `apps/myelin-showcase/`
- Self-contained examples: `examples/{fastapi-rag,mcp-server,langgraph-agent,bedrock-claude,break-a-rag}/`
- Threat catalog: `examples/threats/HKI-T01..T15/`

Current conformance level: **L4-tested (smoke evidence)** (28/28 adapter cases + 10/10 HTTP probes).

---

## HKI Core Invariants — Never Violate These

1. **One active domain per request.** Never `global`, `*`, `null`, or empty string.
2. **Fail-closed.** Missing envelope = 401. Unauthorized domain = 403. Always.
3. **Exact-match visibility.** Use `same_domain()` / `sameHkiDomain()`, not `==`. The function normalises case and trims whitespace; raw `==` will produce subtle bugs.
4. **No body-scope override.** Body fields (`scope`, `domain`, `stream_id`) cannot override `active_domain`. Use `reject_conflicting_scope_argument()`.
5. **Cross-domain sharing = explicit publication only.** Never a fallback or inheritance chain.
6. **Admin plane is unreachable from runtime routes.** Don't add cross-domain read paths to runtime APIs.
7. **Cache keys must include domain.** Use `derive_hki_cache_key()` / `deriveHkiCacheKey()`, never key on query text alone.
8. **Async jobs must re-attach the envelope.** Never resume a job without validating its scope.
9. **Artifacts carry a domain label.** Use `HkiArtifactLabel` + `assert_artifact_visible()`.
10. **Handoffs narrow scope.** Sub-agents get a child envelope with equal or smaller `authorized_domains`.

---

## Key Commands

```bash
# Conformance (run before any PR)
pnpm verify:hki-conformance          # 28/28 TS adapter cases
pnpm test:hki-runtime-py             # Python runtime unit tests
pnpm probe:smoke                     # 10/10 HTTP probe against mock gateway → /tmp/hki-evidence.json
pnpm registry:build                  # Rebuild conformance.json (L4-tested when /tmp/hki-evidence.json present)

# Audits
pnpm audit:hki                       # AST scan (non-strict, advisory only)
pnpm audit:hki:strict                # Fails on body-scope-trust in non-internal routes
pnpm audit:hki-ast                   # Python AST audit
pnpm audit:hki-ast-ts                # TypeScript AST audit

# Adapter tests
pnpm test:hki-adapters               # LiteLLM + LangChain + LlamaIndex + ADK + AutoGen + CrewAI
pnpm test:hki-threats                # Threat catalog test suite (T01..T15)
pnpm test:hki-integration            # End-to-end integration tests

# Evidence
pnpm evidence:hki-services           # JWT boundary probes against real services
pnpm demo:hki                        # End-to-end demo

# Build
pnpm build:framework                 # Build all packages
pnpm build:hki-runtime               # Build @hki/runtime only
pnpm build:hki-conformance           # Build @hki/conformance only

# Typecheck
pnpm typecheck                       # All TS packages via Turborepo
pnpm typecheck:hki-runtime           # @hki/runtime only
pnpm typecheck:hki-mcp               # @hki/mcp only
```

---

## Code Rules

### TypeScript

```typescript
// WRONG — raw string equality
if (envelope.activeDomain === "payments") { ... }

// RIGHT — normalised comparison
import { sameHkiDomain } from "@hki/runtime";
if (sameHkiDomain(envelope.activeDomain, "payments")) { ... }

// WRONG — cache key missing domain
const key = hash(query);

// RIGHT
import { deriveHkiCacheKey } from "@hki/runtime";
const key = deriveHkiCacheKey({ envelope, operation: "chat.completion", input: { query } });

// Mint envelope at gateway edge (never inside a service)
import { mintEnvelope } from "@hki/sdk/client";
const envelope = mintEnvelope({ orgId, subjectId, activeDomain, authorizedDomains, ... });

// Guard MCP tools
import { evaluateGatewayTarget } from "@hki/runtime";
const result = evaluateGatewayTarget(envelope, tool);
if (result.blocked) return { error: result.reason };
```

### Python

```python
import hki_runtime
from hki_runtime.client import mint_envelope

# WRONG
if envelope.active_domain == "payments": ...

# RIGHT
if hki_runtime.same_domain(envelope.active_domain, "payments"): ...

# FastAPI middleware (handles P01-P05/P07/P10 automatically)
from hki_runtime.fastapi import HkiMiddleware, get_envelope
app.add_middleware(HkiMiddleware, require_signature=False)

# Block body scope override (P06)
scope_error = hki_runtime.reject_conflicting_scope_argument(envelope, body)
if scope_error:
    return JSONResponse({"error": "scope-override"}, status_code=403)

# Domain-scoped cache key
key = hki_runtime.derive_hki_cache_key({"envelope": envelope_dict, "operation": "chat.completion", "input": {"query": query}})

# Artifact visibility (P09)
label = hki_runtime.HkiArtifactLabel(org_id=..., domain=artifact_domain, ...)
issue = hki_runtime.assert_artifact_visible(envelope, label)
if issue:
    return JSONResponse({"error": issue.code}, status_code=403)
```

---

## File Patterns

| Path pattern                                        | What it is                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/hki-runtime/src/`                         | TS runtime core — `envelope.ts`, `middleware.ts`, `cache.ts`, `artifact.ts`          |
| `packages/hki-runtime-py/src/hki_runtime/`          | Python runtime — `__init__.py`, `client.py`, `middleware.py`                         |
| `packages/hki-conformance/src/`                     | Conformance CLI + probe — `cli.ts`, `probe.ts`, `cases/`                             |
| `packages/hki-conformance/scripts/mock-gateway.mjs` | Zero-dep Node gateway for probe:smoke                                                |
| `packages/hki-{adapter}/`                           | Framework adapters — one `adapter.py` + `test_adapter.py` each                       |
| `packages/hki-mcp/`                                 | MCP tool/resource guards — `HkiToolGuard`, `HkiResourceGuard`, `HkiMiddlewareServer` |
| `examples/threats/HKI-T*/`                          | Threat pairs: `pre_hki.py` (buggy) + `post_hki.py` (fixed) + `test_threat.py`        |
| `examples/break-a-rag/`                             | T05+T01+T02 demo: `break.py` (failures) + `fix.py` (HKI fixes)                       |
| `services/hki-probe-target/`                        | Deployable FastAPI for Cloud Run — real L4 evidence                                  |
| `services/knowledge-api/src/api/internal_routes.py` | JWT-protected S2S routes — `body-scope-trust` audit findings are expected here       |
| `scripts/build-conformance-registry.mjs`            | Builds `conformance.json`; reads `/tmp/hki-evidence.json` for L4                     |
| `conformance.json`                                  | Signed evidence artifact — current level L4-tested                                   |
| `spec/HKI-1.0.md`                                   | Normative standard — source of truth for all conformance decisions                   |

---

## Database: MySQL (not PostgreSQL)

The `apps/agentic/` BFF uses **MySQL** (`drizzle-orm` + `mysql2`):

- Config: `apps/agentic/drizzle.config.ts` — `dialect: "mysql"`
- Local URL: `mysql://root:root@127.0.0.1:9306/retail_agentic`
- Do NOT write `postgresql://` or import `pg`/`postgres` for the BFF.

---

## Conformance Levels

| Level | Name           | Evidence required                                         |
| ----- | -------------- | --------------------------------------------------------- |
| L0    | Non-conformant | Cases failing                                             |
| L1    | Passing        | All 28 adapter cases pass                                 |
| L2    | Baseline       | L1 + audit debt ratchet exists                            |
| L3    | Evidenced      | L2 + ≥15 threat examples                                  |
| L4    | Deployed       | L3 + 10/10 HTTP probes (`/tmp/hki-evidence.json` present) |

---

## PR Rules

All PRs must pass before merge:

- `verify:hki-conformance` (28/28)
- `test:hki-runtime-py`
- `probe:smoke` (10/10)
- `hki-service-evidence` (35/35 JWT boundary cases)

`audit:hki:strict` is advisory — 8 known `body-scope-trust` findings in JWT-protected
S2S internal routes (`knowledge-api`, `ingestion-pipeline`). These are expected.

---

## What NOT to Do

- Never add `global`, `*`, or `null` as a valid `active_domain` — these are attack vectors.
- Never skip envelope validation for "internal" routes unless they are genuinely on the admin plane.
- Never use string equality for domain comparison — always `same_domain()` / `sameHkiDomain()`.
- Never derive a cache key from query text alone — always include envelope context.
- Never pass a parent envelope unchanged to a sub-agent — mint a child with narrowed scope.
- Never add `--no-verify` to git commands or skip CI gates.
- Never write `DATABASE_URL=postgresql://...` for the agentic BFF.
- Never mark a conformance case as "not applicable" without spec justification.

---

## Myelin — Visualization Package

> Full design doc: `docs/myelin/DESIGN.md` | Slash command: `/myelin`

### What It Is

**Myelin** is a live 3D neural-network visualizer for agentic orchestration topologies.
Signals travel real graph edges. Neo4j persists the topology. Three.js renders the pathways.

Packages:

- `packages/myelin-core/` → `@myelin/core` — canonical types (`NodeRole`, `OrchestratorTopology`), graph algorithms, zero runtime deps
- `packages/myelin-react/` → `@myelin/react` — `<NeuralOrchestrator>` component, theme system
- `apps/myelin-showcase/` — standalone Vite dev app for visual iteration
- `apps/agentic/client/src/pages/OrchestratorPage.tsx` — production route `/orchestrator`

### Myelin Key Commands

```bash
pnpm --filter @myelin/react build       # tsup dual ESM+CJS
pnpm --filter @myelin/react typecheck
pnpm --filter @myelin/core typecheck
pnpm --filter @myelin/showcase dev      # http://localhost:5174
```

### Myelin Invariants — Never Violate These

1. **Deterministic layout.** `buildGraph()` uses `mulberry32(seed)`. Never `Math.random()` for layout.
2. **No React state in the render loop.** RAF callback uses `useRef` only. `setHud`/`setFeed`/`setSelected` throttled to ≤5/s.
3. **Single draw call for edges.** One `LineSegments` with `vertexColors`. Never per-edge `Line` objects.
4. **Fixed signal buffer.** `MAX_SIG = 64`. Reuse slots via `.active` flag. Never grow at runtime.
5. **Theme colors from theme object only.** Read `theme.nodes[role]`, `theme.edges.hot`, etc. Never hardcode hex in component logic.
6. **Overlay panels use CSS custom properties.** Use `var(--card)`, `var(--border)`, `var(--primary)`. Never hardcode panel colors in JSX styles.
7. **Full Three.js cleanup on unmount.** `cancelAnimationFrame` + `ResizeObserver.disconnect` + `renderer.dispose()` + geometry/material dispose + `removeChild(domElement)`.
8. **Topology is source of truth.** The default HKI fixture is a fallback only. When `topology` prop is provided it overrides entirely.
9. **`OrchestratorTopology` type lives in `@myelin/core`.** Never redefine it in a consuming app or in `@myelin/react`.
10. **Clean package boundaries.** `@myelin/react` never imports from `apps/*`. `@myelin/core` has zero runtime dependencies.

### Myelin Code Rules

```typescript
// WRONG — hardcoded color
const base = new THREE.Color(0x5fe8ff)

// RIGHT — from theme prop
const base = new THREE.Color(theme.nodes[node.role])

// WRONG — hardcoded panel color in JSX
<div style={{ background: '#0a1626' }}>

// RIGHT — CSS custom property with fallback
<div style={{ background: 'var(--card, #18181b)' }}>

// WRONG — Math.random() in layout
const pos = fib(Math.random() * n, n, r)

// RIGHT — deterministic RNG
const rng = mulberry32(73)
const pos = fib(i, n, r)  // position is a function of index, not random

// Component usage
import { NeuralOrchestrator, hkiTheme } from '@myelin/react'
import type { OrchestratorTopology } from '@myelin/core'
<NeuralOrchestrator theme={hkiTheme} topology={myTopology} />
```

### Myelin File Patterns

| Path                                                 | What it is                                           |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `packages/myelin-core/src/types.ts`                  | `NodeRole`, `TopologyNode`, `OrchestratorTopology`   |
| `packages/myelin-react/src/NeuralOrchestrator.tsx`   | Main 3D component                                    |
| `packages/myelin-react/src/themes/index.ts`          | `NeuralOrchestratorTheme`, `hkiTheme`, `neuralTheme` |
| `packages/myelin-react/tsup.config.ts`               | Dual ESM+CJS build                                   |
| `apps/agentic/client/src/pages/OrchestratorPage.tsx` | Route `/orchestrator` in agentic app                 |
| `docs/myelin/DESIGN.md`                              | Full design doc, invariants, sprint plan             |

### Myelin What NOT to Do

- Never hardcode hex colors in `NeuralOrchestrator.tsx` component logic — always `theme.nodes[role]`.
- Never call `setState` directly inside the Three.js RAF loop — use the throttled flush pattern.
- Never create per-edge `THREE.Line` objects — one `LineSegments` always.
- Never define `NodeRole` or `OrchestratorTopology` outside `@myelin/core`.
- Never import `apps/*` from inside `packages/myelin-*`.
