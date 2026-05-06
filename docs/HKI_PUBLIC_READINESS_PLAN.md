# HKI Public Readiness Plan

This plan tracks the path from working internal platform to useful open-source
framework and reference implementation.

## North Star

HKI should become the practical implementation standard for isolation in
agentic platforms: one request, one active domain, no implicit global
visibility, and explicit publication as the only cross-domain bridge.

## Phase 1: Public Surface

- Position the landing page around Hermetic Knowledge Isolation rather than a
  generic enterprise AI platform.
- Replace legacy brand terms and hardcoded public UI tokens with `@hki/ui`
  tokens.
- Add license, security policy, code of conduct, contribution guide, and public
  roadmap.
- Publish the HKI paper, SAR standard, MCP binding, and conformance guide from
  the docs index.
- Add audit ratchets for UI token debt and HKI conformance debt.

## Phase 2: Runtime Enforcement

- Make `KB_HERMETIC_ISOLATION=true` the default for local reference flows.
- Remove production fallback paths that default runtime scope to `global`.
- Normalize BFF, shared Python middleware, Knowledge API, ingestion, and
  orchestrator envelope handling around the same field names.
- Require active-domain evidence in retrieval, memory, cache, graph, tool,
  trace, review, release, and evaluation paths.
- Add black-box leakage tests for each service boundary.

## Phase 3: Developer Framework

- Extract the signed scope envelope schema into a versioned package.
- Publish TypeScript and Python helpers for envelope validation, cache key
  derivation, artifact labeling, and policy-pack lookup.
- Provide adapters for common stores: relational tables, vector stores, graph
  stores, Redis-like caches, object stores, and MCP tools.
- Add a CLI command that scans a project and reports HKI conformance evidence.
- Ship example apps for agentic RAG, MCP gateway routing, ingestion, and
  explicit publication.

## Phase 4: Certification Harness

- Define HKI conformance levels and release evidence format.
- Add fixture-driven adversarial tests for null-scope, global fallback,
  cross-domain retrieval, cache contamination, graph traversal, memory bleed,
  tool overreach, and admin-plane reuse.
- Generate machine-readable conformance reports from CI.
- Publish reference traces and expected failure modes.

## Phase 5: Public Adoption

- Version the standard and runtime helpers independently from the demo platform.
- Add migration guides for existing domain-aware RAG systems.
- Publish a threat model and security review checklist.
- Create issue templates for conformance gaps, adapter requests, and
  documentation changes.
- Keep examples vendor-neutral across model providers and storage backends.

## Current Definition of Public Ready

- The landing page explains HKI, SAR, conformance, and the reference runtime.
- `pnpm audit:hki`, `pnpm verify:hki-conformance`,
  `pnpm --dir packages/ui typecheck`, and `pnpm --dir apps/agentic check` pass
  locally and in CI.
- `pnpm audit:ui-tokens` is a ratchet today, not a zero-debt gate. Public
  readiness requires driving the current UI-token findings to zero or carving
  legacy demo surfaces out of the public package.
- The repo has license, security, contribution, conduct, and roadmap documents.
- Public docs explain what is enforced today and what remains planned.
- Screenshots confirm the first viewport is polished on desktop and mobile.

## Current Package State

| Package | Status | Next |
| --- | --- | --- |
| `@hki/runtime` | Builds and passes tests. Provides envelope validation, artifact visibility, cache keys, gateway decisions, trace attributes, and JSON Schemas. | Add signing and key-rotation adapters. |
| `hki-runtime` | Python package builds conceptually and passes pytest/ruff. Mirrors the TypeScript runtime contract for FastAPI services and Python gateways. | Wire shared Python auth and service adapters to consume it directly. |
| `@hki/conformance` | Builds and passes a 22-case Level 4 evidence suite against `@hki/runtime`. | Add service-boundary adapters for BFF, Knowledge API, orchestrator, MCP, cache, memory, graph, and ingestion. |
| `@hki/ui` | Typechecks and exposes HKI tokens/components. | Burn down hardcoded color and legacy-domain audit debt before treating it as a public design-system package. |

## Immediate Next Work

1. Publish an evidence bundle from CI: conformance JSON, HKI audit output,
   service test commands, package versions, and commit SHA.
2. Wire the new Python runtime helpers into shared auth, Knowledge API,
   orchestrator, ingestion, and MCP service boundaries.
3. Replace legacy UI hardcoded tokens in public pages first, then move inward to
   admin and demo surfaces.
4. Add black-box service conformance adapters, starting with Knowledge API
   retrieval and MCP tools because they are the highest-risk runtime boundary.
