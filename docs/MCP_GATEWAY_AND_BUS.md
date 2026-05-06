# MCP Gateway and MCP Bus

**Status:** Design note (draft)
**Author:** Henok Ghebrechristos
**Related:** [HKI Executive Brief](HKI-package/HKI-EXECUTIVE-BRIEF.md), [ARCHITECTURE.md](ARCHITECTURE.md), [AI_GATEWAY_INTEGRATION.md](AI_GATEWAY_INTEGRATION.md)

## Purpose

Define a standard way for agentic systems to communicate with enterprise
tools and data sources. Separate the _protocol + policy_ plane from the
_integration + adaptation_ plane, and bind both to Hermetic Knowledge
Isolation (HKI) so that every tool call runs inside exactly one active
domain.

## One-sentence summary

The **MCP Gateway** is the single enforcement and routing plane for all
agent→tool traffic; the **MCP Bus** is the adapter fabric that makes
non-MCP enterprise systems look like MCP servers to the Gateway. Native
MCP servers register directly with the Gateway. Legacy systems register
via a Bus adapter. Governance, catalog, and HKI enforcement are
identical in both paths.

## Architecture

```
                     ┌─────────────────────────────────────────┐
   Agents ──MCP───►  │            MCP Gateway                   │
                     │  identity · scope · policy · catalog     │
                     │  audit   · quotas · routing              │
                     └───────────┬──────────────────┬───────────┘
                                 │                  │
                 native MCP      │                  │  native MCP
                                 ▼                  ▼
                       ┌──────────────────┐   ┌──────────────────┐
                       │  MCP-native      │   │   MCP Bus        │
                       │  servers         │   │  (adapter fabric)│
                       │  e.g. KB, Git    │   └────────┬─────────┘
                       └──────────────────┘            │ REST/SOAP/gRPC/JDBC/…
                                                       ▼
                                              ┌──────────────────┐
                                              │ Enterprise APIs  │
                                              │ SNOW, SAP, SFDC, │
                                              │ mainframe, etc.  │
                                              └──────────────────┘
```

## Plane responsibilities

| Concern          | Gateway                     | Bus                                      |
| ---------------- | --------------------------- | ---------------------------------------- |
| Protocol (north) | MCP in                      | MCP in                                   |
| Protocol (south) | MCP out                     | Anything (REST, SOAP, gRPC, JDBC, files) |
| Primary job      | Enforcement + routing       | Translation + adaptation                 |
| Changes when…    | Identity/policy/scope rules | A backend API or data model changes      |
| Scales on…       | Sessions, concurrency       | Connector count, schema complexity       |
| Typical owner    | Platform team               | Integration team (may be federated)      |

The Gateway never speaks anything but MCP. The Bus never enforces
identity or policy on its own — it inherits enforcement from the
Gateway and focuses on faithful translation.

## When to use which

Decision has two axes, not one.

|                       | Platform-owned contract                            | Vendor-owned contract                                                                                                                                 |
| --------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Native MCP server** | Register directly with Gateway. Thin pass-through. | Register with Gateway, but front with a Bus adapter when the vendor schema/descriptions/auth need normalization, sanitization, or argument narrowing. |
| **API-only system**   | Bus adapter — our team owns the tool contract.     | Bus adapter that closely mirrors the vendor API; contract tracks vendor.                                                                              |

Default rule:

> If it already speaks MCP and we trust its schema, register it in the
> Gateway. Otherwise, wrap it in a Bus adapter.

## Gateway responsibilities

1. **Ingress termination** — MCP over stdio (local) and SSE/WS (remote),
   mTLS, workload identity for the agent runtime, OBO token for the end
   user.
2. **Scope resolution** — derive the single active domain from the
   session, mint a signed _scope envelope_, reject ambiguous sessions
   (HKI rule #4, fail-closed).
3. **Catalog** — aggregate `tools/list`, `resources/list`,
   `prompts/list` from upstream servers; namespace them
   (`<server_id>.<tool>`); filter by active domain + user entitlements;
   sanitize descriptions (prompt-injection hygiene).
4. **Policy** — OPA/Cedar decision per `(user, domain, tool, args)`;
   argument schema narrowing; PII redaction; two-phase flow for
   destructive actions (`propose` → approval → `commit`).
5. **Routing** — map namespaced tool → upstream MCP server; timeouts,
   concurrency, circuit breaking, retries, idempotency keys.
6. **Audit + telemetry** — one structured event per `tools/call`:
   session, user, active domain, tool, argument hash, latency, outcome,
   cost, policy decisions.
7. **Quotas and cost** — per user, per domain, per tool.

## Bus responsibilities

1. **Adapter hosting** — each backend has an adapter that declares its
   MCP surface (tools, resources, prompts) as code/config.
2. **Protocol translation** — HTTP/SOAP/gRPC/JDBC ↔ MCP.
3. **Domain scoping in the backend's language** — translate active
   domain into the backend's native filters (e.g. SAP company code,
   Salesforce org id, ServiceNow company sys_id). This is the work the
   Gateway cannot do because only the adapter knows the backend's data
   model.
4. **Resource URI minting** — return results with canonical
   `mcp://bus/<domain>/<backend>/<type>/<id>` URIs.
5. **Backend credential custody** — short-lived service credentials;
   never exposed to agents.
6. **Schema declaration** — narrowed, typed MCP schemas that the
   Gateway can further constrain by policy.

The Bus presents itself to the Gateway as **N virtual MCP servers**,
one per backend, not one monolithic server. This keeps blast radius
small, allows independent deployment of adapters, and makes adapters
look architecturally identical to native MCP servers from the
Gateway's point of view.

## Registration and onboarding

Both paths share one pipeline: **auto-register, manual-publish.**

```
  discovery ──► pending catalog ──► review ──► published catalog
                                     │
                                     ├─ domain assignment   (HKI #1)
                                     ├─ policy binding
                                     ├─ description sanitization
                                     └─ schema narrowing
```

- **Native MCP server** self-describes via `tools/list` on
  registration; lands in `pending`.
- **Bus adapter** declares its surface in code; CI validates schema and
  submits to `pending`.

Nothing reaches an agent session until review is complete.

## HKI binding

The Gateway is the single enforcement point for HKI. The Bus inherits
enforcement and adds backend-specific translation.

1. **One artifact, one domain (HKI #1).** Every tool and resource is
   registered against exactly one domain at publish time.
2. **One active domain per request (HKI #2).** The Gateway refuses any
   session without an unambiguous `act_domain`. The signed scope
   envelope propagates to the Bus and to native MCP servers on every
   call.
3. **Publication, not global fallback (HKI #3).** Cross-domain sharing
   of a tool or resource requires explicit publication into each target
   domain; there is no "global" tool or "global" resource.
4. **Fail-closed (HKI #4).** Missing, contradictory, or unauthorized
   scope → rejection, never fallback.

Scope envelope flow:

```
Agent ──► Gateway ──(signed env)──► Bus adapter ──(env + backend creds)──► SAP / SNOW / …
```

Adapter obligations under HKI:

- Refuse to call if `act_domain` is missing or not authorized for that
  backend.
- Inject domain-scoping into the downstream query (tenant, org filter,
  `WHERE` clause, company code, etc.).
- Map backend ids into `mcp://bus/<domain>/<backend>/<type>/<id>` on
  the way back.

Cache keys at every layer include `act_domain` to close the
cache-contamination leak path described in the HKI brief.

## Admin plane separation

Two ingress classes for the Gateway, mirroring the HKI runtime/admin
split:

- `runtime.mcp.<env>` — hermetic, single-domain, used by agents.
- `admin.mcp.<env>` — cross-domain inspection for ops/compliance,
  separate audit stream, never reachable from an agent session.

The Bus has no admin ingress of its own; cross-domain views are only
available through the Gateway's admin plane.

## Minimum contracts to freeze early

| Contract       | Format                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Tool id        | `<server_id>.<tool_name>`, lowercase, dot-separated, stable                                                    |
| Resource URI   | `mcp://bus/<domain>/<server_id>/<type>/<id>`                                                                   |
| Scope envelope | Signed JWT; required claim `act_domain`; 5-minute TTL; re-minted per session                                   |
| Audit event    | One row per `tools/call`: session, user, domain, tool, arg_hash, outcome, latency, cost, policy decisions      |
| Error codes    | `E_SCOPE_AMBIGUOUS`, `E_SCOPE_UNAUTHORIZED`, `E_TOOL_UNKNOWN_IN_DOMAIN`, `E_POLICY_DENY`, `E_UPSTREAM_TIMEOUT` |

## Build path

Aligned with the current monorepo (Kong, LiteLLM, orchestrator, KB,
analytics-service):

1. **Phase 0 — Inventory.** Catalog every enterprise system agents
   want to touch. Classify read/write, domain-owner, PII level.
2. **Phase 1 — Gateway MVP.** Single service exposing MCP (SSE) to
   agents; routes to 2–3 upstream MCP servers (start with KB + one
   SaaS). Add mTLS, namespaced catalog, scope envelope, audit to
   `analytics-service`.
3. **Phase 2 — Bus MVP.** First Bus adapter for one API-only system
   (candidate: ServiceNow or the existing MCP calculator pattern).
   Adapter declares MCP surface, registers as a virtual MCP server
   with the Gateway.
4. **Phase 3 — Policy.** Wire OPA into the Gateway; move tool ACLs and
   schema-narrowing rules there. Integrate with existing LiteLLM
   guardrails.
5. **Phase 4 — HKI enforcement.** Make `act_domain` mandatory; refuse
   ambiguous sessions; add publication workflow; domain-keyed caches
   at Gateway and Bus.
6. **Phase 5 — Dangerous-action flow.** Propose/approve/commit wrapper
   at the Gateway, tied to the Agentic admin approval flow.
7. **Phase 6 — Federation.** Self-service onboarding for MCP servers
   and Bus adapters (same pattern as `lab/app_onboarding.tf`) with
   review gates.

## Open questions

- Do we host the Gateway as a Kong plugin, or as a standalone service
  behind Kong? (Leaning standalone; Kong handles TLS/quotas.)
- A2A (agent-to-agent) traffic: same Gateway, or separate east-west
  plane? (Revisit once MCP+A2A convergence stabilizes.)
- Adapter SDK language: Python for parity with orchestrator, or Go for
  throughput-sensitive backends? (Likely both; share schema as
  codegen.)
