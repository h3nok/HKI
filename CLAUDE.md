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
- Agentic UI + BFF: `apps/agentic/` (Next.js + tRPC, MySQL via drizzle/mysql2, NOT PostgreSQL)
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
