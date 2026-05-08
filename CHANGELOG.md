# Changelog

All notable changes to HKI are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) for packages
and a dated scheme (`YYYY-MM-DD`) for the standard.

---

## [Unreleased]

### Changed
- Moved infrastructure manifests under `deploy/` (`k8s/`, `docker-compose/`)
- Rewrote `README.md` as the public-facing standard homepage
- Redesigned Engineering Hub UI at `/engineering`
- Updated `.gitignore` to exclude Terraform provider binaries

---

## [0.1.0] — 2026-05-07

### Added — Standard
- `spec/HKI-1.0.md` — normative standard (envelope schema, six invariants, conformance levels)
- `spec/HKI-Agent-Gateway-Profile.md` — gateway enforcement profile
- `docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md` — full architecture paper
- `docs/HKI_THREATS.md` — 15-entry threat catalog (HKI-T01..HKI-T15) with runnable demos
- `docs/HKI_CONFORMANCE.md` — conformance levels L0–L5 with evidence requirements
- `docs/HKI_SECURITY_MAPPING.md` — OWASP LLM Top 10, NIST AI RMF, MCP, A2A alignment
- `docs/HKI_ROADMAP.md` — living implementation and development roadmap

### Added — TypeScript packages
- `packages/hki-runtime` (`@hki/runtime` v0.1.0) — envelope validation, artifact visibility, cache keys, gateway decisions, telemetry attributes, JSON Schemas
- `packages/hki-conformance` (`@hki/conformance` v0.1.0) — 28-case conformance suite (HKI-C01..C28), CLI runner, evidence report
- `packages/hki-conformance-action` — reusable GitHub Action composite with `min-level` enforcement, probe URL option, evidence artifact upload
- `packages/hki-runtime/schema/hki-envelope.schema.json` — canonical envelope JSON Schema frozen at `hki/1.0`

### Added — Python packages
- `packages/hki-runtime-py` (`hki-runtime` v0.1.0) — FastAPI middleware (`HkiMiddleware`), Starlette decorator, gateway helpers, retrieval adapters, cache key derivation, MCP tool router
- `packages/hki-litellm` (`hki-litellm`) — LiteLLM callback enforcing envelope on every LLM call
- `packages/hki-langchain` (`hki-langchain`) — `HkiCallbackHandler`, `HkiRetriever`, `hki_cache_key`
- `packages/hki-llamaindex` (`hki-llamaindex`) — LlamaIndex retriever and query-engine wrappers
- `packages/hki-adk` (`hki-adk`) — Google Agent Development Kit adapter
- `packages/hki-autogen` (`hki-autogen`) — AutoGen message-bus middleware
- `packages/hki-crewai` (`hki-crewai`) — CrewAI agent middleware

### Added — Tooling
- `packages/hki-integration-tests` — cross-adapter end-to-end suite (8 tests, one envelope through all adapters)
- `scripts/hki_ast_audit.py` — libcst-based Python AST scanner (`pnpm audit:hki-ast`)
- `scripts/hki-ast-audit-ts.mjs` — TypeScript AST scanner via TS compiler API (`pnpm audit:hki-ast-ts`)
- `scripts/build-conformance-registry.mjs` — builds `conformance.json` registry artifact (`pnpm registry:build`)
- `scripts/publish-kit/` — packaging scripts to materialise the public spec repo subset

### Added — Reference platform
- `apps/agentic` (React BFF + tRPC, port 9001) with engineering hub UI
- `knowledge-api` (hybrid vector + BM25 + graph + MCP, port 9509)
- `orchestrator-service` (ReAct supervisor + Google ADK, port 9501)
- `ingestion-pipeline-service` (document upload, chunking, Pub/Sub worker, port 9508)
- `analytics-service` (usage analytics, BigQuery, port 9510)
- `deploy/k8s/` — GKE Terraform modules (cluster, AlloyDB, networking, observability, Redis)
- `deploy/compose/docker-compose.yml` — full local stack (Postgres/pgvector, Redis, Neo4j, Pub/Sub emulator, Langfuse)

### Security
- Threat HKI-T01: Scope Fallback via Global Domain
- Threat HKI-T02: Cross-Domain Cache Contamination
- Threat HKI-T03: Semantic Cache Key Collision
- Threat HKI-T04: Async-Job Domain Laundering
- Threat HKI-T05: Vector-Store Cross-Domain Leak
- Threat HKI-T06: MCP Tool Without Scope Binding
- Threat HKI-T07: A2A Delegation Scope Escalation
- Threat HKI-T08: Embedding Cache Cross-Domain Leak
- Threat HKI-T09: Admin Route Reachable from Runtime
- Threat HKI-T10: Wildcard Publication
- Threat HKI-T11: Envelope Replay Attack
- Threat HKI-T12: Expired Envelope Acceptance
- Threat HKI-T13: Envelope Version Downgrade
- Threat HKI-T14: Graph Traversal Scope Bleed
- Threat HKI-T15: Prompt-Injected Scope Override

---

[Unreleased]: https://github.com/h3nok/HKI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/h3nok/HKI/releases/tag/v0.1.0
