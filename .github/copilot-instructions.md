# GitHub Copilot — HKI Platform

## What This Repo Is

HKI (Hermetic Knowledge Isolation) is a control framework for agentic AI systems.
Every runtime operation executes inside exactly one named domain. The `HkiEnvelope`
is a signed scope object that propagates from the gateway through retrieval, tools,
cache, async jobs, and audit. Violation = data leaks between tenants or domains.

---

## Enforced Patterns — Always Use These

### Domain comparison

```python
# ✅ Python
import hki_runtime
if hki_runtime.same_domain(envelope.active_domain, "payments"): ...

# ❌ Never
if envelope.active_domain == "payments": ...
```

```typescript
// ✅ TypeScript
import { sameHkiDomain } from "@hki/runtime";
if (sameHkiDomain(envelope.activeDomain, "payments")) { ... }

// ❌ Never
if (envelope.activeDomain === "payments") { ... }
```

### Cache keys — must include domain

```python
# ✅ Python
key = hki_runtime.derive_hki_cache_key({"envelope": env_dict, "operation": op, "input": inp})

# ❌ Never
key = hash(query)
```

```typescript
// ✅ TypeScript
const key = deriveHkiCacheKey({ envelope, operation, input });

// ❌ Never
const key = hashQuery(query);
```

### FastAPI middleware (Python services)

```python
from hki_runtime.fastapi import HkiMiddleware, get_envelope
app.add_middleware(HkiMiddleware, require_signature=False)

@app.post("/v1/chat")
async def chat(request: Request):
    envelope = get_envelope(request)   # always present after middleware
```

### Block body-scope override

```python
# P06 guard — always add when accepting body with scope/domain field
err = hki_runtime.reject_conflicting_scope_argument(envelope, body)
if err:
    return JSONResponse({"error": "scope-override"}, status_code=403)
```

### MCP tool guard (TypeScript)

```typescript
import { evaluateGatewayTarget } from "@hki/runtime";
const result = evaluateGatewayTarget(envelope, tool);
if (result.blocked) return { error: result.reason };
```

### Mint envelope (gateway edge only — never inside a service)

```python
from hki_runtime.client import mint_envelope
envelope = mint_envelope(org_id=..., subject_id=..., active_domain=...,
                         authorized_domains=[...], purpose=..., risk_tier=...,
                         policy_pack_id=..., issuer=..., signature=...,
                         ttl=300, issued_at=int(time.time()))
```

### Sub-agent handoff — always narrow scope

```python
# ✅ Mint a child envelope with equal or smaller authorized_domains
child = mint_envelope(..., active_domain="payments", authorized_domains=["payments"], ...)

# ❌ Never pass parent envelope unchanged to a sub-agent
child_agent.run(envelope=parent_envelope)
```

---

## Never Generate

| Pattern                                      | Why                                                |
| -------------------------------------------- | -------------------------------------------------- |
| `active_domain = "global"`                   | Global is an attack vector — fail-closed rule      |
| `active_domain = "*"`                        | Wildcard is blocked by P04/P05 probes              |
| `envelope.activeDomain === "payments"`       | Use `sameHkiDomain()` — normalises case/whitespace |
| Cache key without domain                     | Cross-domain cache collision = T01 threat          |
| `DATABASE_URL=postgresql://` for agentic BFF | BFF uses MySQL (drizzle + mysql2)                  |
| `or "global"` fallback in domain reads       | T03 threat — implicit global fallback              |
| Cross-domain reads in runtime routes         | Admin plane only                                   |

---

## Package Imports

| Need                 | Import                                                        |
| -------------------- | ------------------------------------------------------------- |
| TS domain comparison | `import { sameHkiDomain } from "@hki/runtime"`                |
| TS cache key         | `import { deriveHkiCacheKey } from "@hki/runtime"`            |
| TS MCP guard         | `import { evaluateGatewayTarget } from "@hki/runtime"`        |
| TS envelope mint     | `import { mintEnvelope } from "@hki/sdk/client"`              |
| PY runtime           | `import hki_runtime`                                          |
| PY mint              | `from hki_runtime.client import mint_envelope`                |
| PY middleware        | `from hki_runtime.fastapi import HkiMiddleware, get_envelope` |
| PY MCP               | `from hki_runtime.mcp import HkiToolGuard`                    |

---

## Repo Structure (quick reference)

```
spec/HKI-1.0.md                 normative standard
packages/hki-runtime/           TypeScript runtime
packages/hki-runtime-py/        Python runtime
packages/hki-conformance/       conformance harness + HTTP probe
packages/hki-mcp/               MCP tool/resource guards
packages/sdk/                   @hki/sdk (unified TS SDK)
packages/hki-{adapter}/         LiteLLM, LangChain, LlamaIndex, ADK, AutoGen, CrewAI
services/knowledge-api/         vector retrieval + graph + MCP server
services/orchestrator-service/  ReAct agent loop
services/hki-probe-target/      FastAPI for Cloud Run L4 evidence
apps/agentic/                   Next.js UI + tRPC BFF (MySQL)
examples/break-a-rag/           3 HKI RAG failures then fixed
examples/threats/HKI-T*/        Threat catalog pairs (pre/post HKI)
conformance.json                Evidence registry (L4-tested)
```

---

## Validation Commands

```bash
pnpm verify:hki-conformance     # 28/28 adapter conformance cases
pnpm test:hki-runtime-py        # Python runtime tests
pnpm probe:smoke                # 10/10 HTTP probe (writes /tmp/hki-evidence.json)
pnpm test:hki-adapters          # All 6 framework adapters
pnpm audit:hki                  # Advisory AST scan
pnpm registry:build             # Rebuild conformance.json
```
