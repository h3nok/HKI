# AGENTS.md — HKI Platform

Project instructions for OpenAI Codex, o3, and any OpenAI Agents SDK runner.

---

## What This Repo Is

**HKI (Hermetic Knowledge Isolation)** is a control framework for agentic AI systems.
It enforces that every runtime operation executes inside exactly one named domain — no
global visibility, no wildcard fallbacks, no silent cross-domain reads.

The core primitive is the **`HkiEnvelope`**: a signed scope object that propagates
unchanged from the gateway edge through retrieval, tools, cache, async jobs, and audit.

### Repo layout

```
spec/HKI-1.0.md                  ← normative standard (source of truth)
packages/
  hki-runtime/                   ← TypeScript runtime (@hki/runtime)
  hki-runtime-py/                ← Python runtime (hki-runtime on PyPI)
  hki-conformance/               ← conformance harness + HTTP probe (@hki/conformance)
  hki-mcp/                       ← MCP tool/resource guards (@hki/mcp)
  sdk/                           ← unified SDK (@hki/sdk)
  hki-{litellm,langchain,llamaindex,adk,autogen,crewai}/  ← framework adapters
  hki-conformance-py/            ← Python conformance checker
services/
  knowledge-api/                 ← vector retrieval + graph + MCP server
  orchestrator-service/          ← ReAct agent loop
  ingestion-pipeline-service/    ← document ingestion
  analytics-service/             ← usage analytics
  hki-probe-target/              ← FastAPI service for Cloud Run L4 evidence
apps/
  agentic/                       ← Next.js UI + tRPC BFF (MySQL, not PostgreSQL)
examples/
  fastapi-rag/                   ← FastAPI + HkiMiddleware RAG (~140 LOC)
  mcp-server/                    ← TypeScript MCP gateway with evaluateGatewayTarget
  langgraph-agent/               ← LangGraph StateGraph with envelope in state + handoff
  bedrock-claude/                ← boto3 + Claude on Bedrock (BEDROCK_STUB=1 for offline)
  break-a-rag/                   ← 3 HKI failures (break.py) then fixed (fix.py)
  threats/HKI-T01..T15/          ← threat catalog: pre_hki.py + post_hki.py + test
```

---

## The Six Invariants (Never Violate)

1. **Single active domain** — `active_domain` is never `null`, `"global"`, `"*"`, or empty.
2. **Fail-closed** — missing/invalid envelope = 401; unauthorized domain = 403.
3. **Exact-match visibility** — use `same_domain()` / `sameHkiDomain()`, not `==`.
4. **No body-scope override** — `body.scope` / `body.domain` cannot replace `active_domain`.
5. **Explicit cross-domain publication** — no inheritance, no fallback chains.
6. **Admin plane separation** — admin cross-domain reads are unreachable from runtime routes.

---

## Correct Code Patterns

### Python (hki-runtime)

```python
import hki_runtime
from hki_runtime.client import mint_envelope
from hki_runtime.fastapi import HkiMiddleware, get_envelope

# ✅ Domain comparison
if hki_runtime.same_domain(envelope.active_domain, "payments"): ...

# ✅ FastAPI middleware (covers P01–P05/P07/P10)
app.add_middleware(HkiMiddleware, require_signature=False)

# ✅ Block body-scope override (P06)
err = hki_runtime.reject_conflicting_scope_argument(envelope, body)
if err:
    return JSONResponse({"error": "scope-override"}, 403)

# ✅ Domain-scoped cache key (prevents T01)
key = hki_runtime.derive_hki_cache_key({"envelope": env_dict, "operation": "...", "input": {...}})

# ✅ Artifact visibility (P09)
label = hki_runtime.HkiArtifactLabel(org_id=..., domain=artifact_domain, artifact_type="document", artifact_id=...)
issue = hki_runtime.assert_artifact_visible(envelope, label)
if issue:
    return JSONResponse({"error": issue.code}, 403)

# ✅ Mint envelope (at edge only)
envelope = mint_envelope(org_id=..., subject_id=..., active_domain=..., authorized_domains=[...],
                         purpose=..., risk_tier=..., policy_pack_id=..., issuer=...,
                         signature=..., ttl=300, issued_at=int(time.time()))
```

### TypeScript (@hki/runtime)

```typescript
import { sameHkiDomain, deriveHkiCacheKey, evaluateGatewayTarget } from "@hki/runtime";
import { mintEnvelope } from "@hki/sdk/client";

// ✅ Domain comparison
if (sameHkiDomain(envelope.activeDomain, "payments")) { ... }

// ✅ Domain-scoped cache key
const key = deriveHkiCacheKey({ envelope, operation: "chat.completion", input: { query } });

// ✅ MCP tool guard
const result = evaluateGatewayTarget(envelope, tool);
if (result.blocked) return { error: result.reason };

// ✅ Mint envelope (at gateway edge)
const envelope = mintEnvelope({ orgId, subjectId, activeDomain, authorizedDomains, ... });
```

---

## Key Commands

```bash
# Validate before any commit
pnpm verify:hki-conformance     # 28/28 TS adapter conformance cases
pnpm test:hki-runtime-py        # Python unit tests
pnpm probe:smoke                # 10/10 HTTP probe against mock gateway

# Full evidence bundle
pnpm registry:build             # Writes conformance.json (L4-deployed when probe evidence present)

# Adapters
pnpm test:hki-adapters          # All 6 framework adapters
pnpm test:hki-threats           # T01..T15 threat catalog

# Audit
pnpm audit:hki                  # Advisory AST scan
pnpm audit:hki-ast              # Python AST audit
pnpm audit:hki-ast-ts           # TypeScript AST audit
```

---

## What NOT to Generate

- `active_domain = "global"` or `active_domain = "*"` — these are attack vectors
- `if envelope.activeDomain === "payments"` — use `sameHkiDomain()` instead
- Cache keys without domain context — always use `deriveHkiCacheKey()` / `derive_hki_cache_key()`
- `DATABASE_URL=postgresql://...` for the agentic BFF — it uses MySQL
- Passing a parent envelope directly to a sub-agent — always mint a narrowed child envelope
- Adding runtime cross-domain read paths — admin plane only

---

## Database

`apps/agentic/` BFF uses **MySQL** (drizzle-orm + mysql2).
Local: `mysql://root:root@127.0.0.1:9306/retail_agentic`
Do not use PostgreSQL drivers or connection strings for this app.

---

## Conformance Evidence

Current level: **L4-deployed** (all 28 adapter cases + 10/10 HTTP probes).
Evidence file: `conformance.json` (generated by `pnpm registry:build`).
HTTP probe evidence: `/tmp/hki-evidence.json` (written by `pnpm probe:smoke`).
