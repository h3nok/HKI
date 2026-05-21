# HKI Public Readiness Plan

This plan tracks the path from working internal platform to useful open-source
framework and reference implementation.

## North Star

HKI should become the practical implementation standard for isolation in
agentic platforms: one request, one active domain, no implicit global
visibility, and explicit publication as the only cross-domain bridge.

## May 15 Industry Adoption Evaluation

**Current maturity:** 3.9 / 5.

**Verdict:** HKI is ready for serious design-partner evaluation and limited
enterprise pilots. It should be positioned as a draft open standard with working
runtimes, conformance evidence, and reference implementation proof. It is not
yet mature enough to claim universal cross-industry standard status.

| Dimension                         | Score | Assessment                                                                                                                                     | Next maturity gate                                                                                |
| --------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Core isolation primitive          |   4.5 | The invariant is small, memorable, enforceable, and industry-neutral.                                                                          | Keep the core contract narrow; resist adding sector-specific semantics to HKI 1.0.                |
| Normative standard                |   4.1 | `spec/HKI-1.0.md` now has a canonical Level 0-5 ladder, evidence profiles, non-goals, glossary terms, and managed-service evidence boundaries. | Review glossary/non-goals with design partners and freeze extension-point language before 1.0.    |
| Conformance and evidence          |   4.0 | `@hki/conformance`, `hki-probe`, registry schema, and `releaseEvidence` manifest make claims testable and reviewable.                          | Generate live probe evidence from a clean commit and attach it to a public release.               |
| Runtime implementation quality    |   3.8 | TypeScript and Python runtimes, adapters, FastAPI middleware, MCP guard, threat catalog, and examples demonstrate real coverage.               | Publish packages, run clean-install smoke tests, and keep adapter APIs stable through 1.0.        |
| Security and ecosystem mapping    |   3.7 | Current mapping covers MCP, A2A, OWASP, NIST, OAuth/OIDC/JWT and now includes sector profile skeletons.                                        | Add deeper mappings to ISO 27001, ISO 42001, SOC 2, HIPAA, PCI DSS, GLBA, SOX, GDPR, and FedRAMP. |
| Governance maturity               |   3.3 | Community docs now define RFC workflow, versioning policy, conformance mark rules, profile process, and TSC path.                              | Exercise the process with the first external RFC and record ADRs for accepted changes.            |
| Cross-industry adoption readiness |   3.2 | Finance, healthcare, government, legal, retail/operations, and manufacturing/IP profile skeletons now exist.                                   | Turn skeletons into full profiles with domain reviewers and sector-specific evidence examples.    |
| Independent implementation proof  |   2.5 | Reference implementation is strong; external unaided implementations are still missing.                                                        | Secure three design partners and publish anonymized conformance reports.                          |

### Quality of Work Assessment

Strong signals:

- The standard is falsifiable: adopters can prove rejection of missing,
  `global`, wildcard, cross-domain, and override paths.
- Evidence is machine-readable: the registry now includes canonical level,
  evidence profile, command manifest, component hashes, release blockers, and a
  manifest hash.
- The implementation is multi-surface: retrieval, cache, artifacts, gateway
  decisions, MCP/tool routing, Python middleware, and adapter fixtures are all
  represented.
- The threat catalog turns HKI from a philosophy into runnable negative cases.
- The current public claim is now precise: `L4-tested (smoke evidence)`.

Quality risks:

- Public release evidence is not strict-release eligible while generated from a
  dirty worktree or smoke-only probe evidence.
- `conformance.json` is ignored locally, so release artifacts must be generated
  and attached through CI or a deliberate release process.
- Advisory audit findings remain and need documented acceptance or burndown.
- Governance is still project-owner centered, but the RFC, conformance mark,
  profile proposal, and TSC path now give external contributors a process to
  evaluate.
- Independent implementation proof is missing; without design partners HKI is a
  strong reference standard, not yet an ecosystem standard.

### Adoption Claim Boundaries

Safe current claims:

- HKI is a draft open standard and reference framework for runtime isolation in
  enterprise agentic AI systems.
- The reference implementation is `L4-tested (smoke evidence)` with 28/28
  adapter conformance cases and 10/10 HTTP smoke probes.
- HKI is ready for architecture review, design-partner evaluation, and limited
  enterprise pilots.

Claims to avoid until the next gates close:

- HKI is an adopted cross-industry standard.
- HKI is independently certified.
- HKI is L5-audited.
- HKI has live release evidence unless a deployed endpoint probe bundle is
  attached to the release.

### Next Gate

The next maturity gate is **independent implementation proof**: use the new RFC,
profile, conformance-mark, and design-partner processes with at least one
external implementer. That gate moves HKI from credible standardization effort to
early ecosystem standard.

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
- `@hki/runtime`, `@hki/conformance`, and `hki-runtime` are published publicly,
  tagged as `v0.1.0`, and smoke-tested from a clean project.
- Public release notes include `conformance.json`, `/tmp/hki-evidence.json` or a
  live Cloud Run probe bundle, package versions, and the commit SHA.
- `pnpm audit:ui-tokens` is a ratchet today, not a zero-debt gate. Public
  readiness requires driving the current UI-token findings to zero or carving
  legacy demo surfaces out of the public package.
- The repo has license, security, contribution, conduct, and roadmap documents.
- Public docs explain what is enforced today and what remains planned.
- Screenshots confirm the first viewport is polished on desktop and mobile.

## Current Package State

| Package            | Status                                                                                                                                         | Next                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@hki/runtime`     | Builds and passes tests. Provides envelope validation, artifact visibility, cache keys, gateway decisions, trace attributes, and JSON Schemas. | Add signing and key-rotation adapters.                                                                       |
| `hki-runtime`      | Python package builds conceptually and passes pytest/ruff. Mirrors the TypeScript runtime contract for FastAPI services and Python gateways.   | Wire shared Python auth and service adapters to consume it directly.                                         |
| `@hki/conformance` | Builds and passes a 28-case conformance suite against `@hki/runtime`; ships `hki-probe` with 10 HTTP probes and registry output.               | Publish v0.1.0 publicly, attach smoke/live evidence bundles, and keep service-boundary evidence in CI.       |
| `@hki/ui`          | Typechecks and exposes HKI tokens/components.                                                                                                  | Burn down hardcoded color and legacy-domain audit debt before treating it as a public design-system package. |

## Immediate Next Work

1. Publish v0.1.0 packages to npm and PyPI, tag the release, and run clean
   install smoke tests.
2. Publish an evidence bundle from CI: conformance JSON, HKI audit output,
   service test commands, package versions, probe evidence, and commit SHA.
3. Ship the public site or GitHub Pages surface with spec, install,
   conformance, threat catalog, and registry links.
4. Replace legacy UI hardcoded tokens in public pages first, then move inward to
   admin and demo surfaces.
5. Add black-box service conformance adapters, starting with Knowledge API
   retrieval and MCP tools because they are the highest-risk runtime boundary.
