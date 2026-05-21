# HKI Conformance Guide

This guide turns the HKI paper into an implementer-facing conformance bar for
the reference platform.

## Conformance Levels

| Level               | Meaning                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Level 0: Documented | Domain-sensitive surfaces are inventoried; no runtime conformance claim is made.                                              |
| Level 1: Labeled    | Runtime artifacts persist a non-null organization and domain label.                                                           |
| Level 2: Routed     | Runtime requests carry one signed active-domain envelope through each hop.                                                    |
| Level 3: Enforced   | Reads, writes, cache hits, graph traversals, memory, tools, jobs, and traces reject missing, `global`, or cross-domain scope. |
| Level 4: Tested     | Automated negative tests and probes prove the isolation invariants for the claimed surface.                                   |
| Level 5: Audited    | Signed release evidence is reproducible and independently reviewable.                                                         |

Evidence profiles qualify the level without changing the level name:

- `smoke` — local, mock-gateway, or CI smoke evidence.
- `live` — evidence from a deployed endpoint controlled by the implementer.
- `release` — signed release evidence intended for external review.

Public claims should use both terms: for example, `L4-tested (smoke evidence)`
or `L4-tested (live evidence)`. HKI should not claim Level 5 until signed
release evidence and an independent review path exist.

## Required Runtime Envelope

Every runtime request must resolve these fields at the edge and preserve them
downstream:

```json
{
  "hki_version": "1.0",
  "envelope_id": "env_01HX...",
  "org_id": "org_acme",
  "subject_id": "user_42",
  "active_domain": "payments",
  "authorized_domains": ["payments", "fraud"],
  "purpose": "retrieve",
  "risk_tier": "read-only",
  "policy_pack_id": "policy_2026_05",
  "issued_at": 1777900000,
  "expires_at": 1777900300,
  "issuer": "agent-gateway",
  "signature": "..."
}
```

Services must reject missing, expired, forged, null, ambiguous, or `global`
runtime domains. They must also reject wildcard domains and unsupported HKI
versions. `authorized_domains` is not a read filter; only `active_domain` is
used for runtime visibility.

## Service Bar

| Surface         | Minimum requirement                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| BFF and gateway | Resolve exactly one active domain and sign the envelope.                                                                         |
| Orchestrator    | Treat scope as immutable and forward it to each tool, model route, cache, memory, and retrieval call.                            |
| Managed runtime | Preserve the envelope in run/session/tool context and correlate managed resource IDs with HKI evidence.                          |
| Agent identity  | Bind platform agent identity and delegated user identity to audit evidence without allowing identity metadata to override scope. |
| Knowledge API   | Bind search, rerank, citations, graph traversal, and document reads to `(org_id, active_domain)`.                                |
| Ingestion       | Persist active domain on jobs, source objects, documents, chunks, extracted entities, review records, eval cases, and releases.  |
| Cache           | Include `org_id`, `active_domain`, operation, policy pack, model route, and context version in keys.                             |
| Memory          | Read and write only within `(org_id, subject_id, active_domain)`.                                                                |
| MCP and tools   | Expose only tools and resources published into the active domain; tool arguments cannot override scope.                          |
| Agent registry  | Expose target-domain metadata for agents, tools, prompts, resources, endpoints, and MCP targets.                                 |
| Admin plane     | Use separate routes and audit semantics for cross-domain visibility. Runtime routes cannot call admin queries.                   |
| Publication     | Create target-domain artifacts with provenance; never expose an unlabeled or wildcard shared object at runtime.                  |

## Negative Tests

Each service that touches runtime data should have black-box tests for:

- missing envelope
- expired envelope
- forged envelope
- `global` active domain
- wildcard active domain
- unsupported HKI version
- `global` or wildcard authorized domain
- body, query, prompt, or tool scope overriding the signed envelope, including
  aliases such as `domain`, `scope`, and `stream_id`
- cross-domain retrieval
- cross-domain cache reuse
- cross-domain graph traversal
- unscoped ingestion job
- MCP tool outside the active domain
- tool output introducing a different-domain artifact
- A2A child envelope broader than the parent envelope
- runtime route invoking an admin-plane query

## Conformance Kit

The repository includes a runnable TypeScript conformance kit in
`packages/hki-conformance`.

```bash
pnpm typecheck:hki-conformance
pnpm test:hki-conformance
pnpm --dir packages/hki-conformance build
pnpm --dir packages/hki-conformance conformance
```

Implementers can export an adapter from a local module and run the same cases
against their gateway or runtime boundary:

```bash
hki-conformance ./dist/hki-adapter.js --json
```

The adapter must implement envelope validation, artifact visibility, cache key
derivation, gateway target decisions, and signed-scope override rejection. A
passing report is Level 4 evidence for the tested adapter surface; a runtime or
service-level claim should pair it with smoke or live probe evidence. Level 5
still requires signed release artifacts, reproducible CI output, independent
review, and publication of the evidence bundle.

The reference application also includes a service-level black-box evidence
runner:

```bash
pnpm evidence:hki-services
```

It probes running services with BFF-compatible request JWTs and writes a hashed
bundle to `artifacts/hki/service-evidence.json`. See
[HKI Service Evidence](HKI_SERVICE_EVIDENCE.md) for local strict-auth commands
and bundle format.

The current conformance kit runs 28 cases across envelope validation, artifact
visibility, cache binding, gateway routing, explicit publication, and scope
override rejection. It covers missing, expired, unsigned, unsupported-version,
unauthorized, `global`, and wildcard envelope failures, plus global and
wildcard artifacts, global and wildcard gateway targets, wildcard publication,
cross-domain reads, cross-org reads, cache contamination, and `scope` /
`stream_id` / array-shaped override attempts.

## Release Evidence

A public HKI release should include:

- `pnpm audit:hki` output with no increased known debt
- `pnpm evidence:hki-services` output from a strict-auth service profile
- service-specific conformance test output
- a list of artifact classes and their domain label source
- cache key schema for each cache surface
- publication workflow evidence for shared content
- admin-plane route inventory
- UI token audit output for public pages
- managed-service evidence when a claim depends on ADK, Gemini Enterprise Agent
  Platform, Agent Identity, Agent Gateway, Agent Registry, managed RAG/search,
  managed evaluation, Cloud Trace, or Cloud Audit Logs

## Evidence Manifest

`scripts/build-conformance-registry.mjs` emits a machine-readable evidence
manifest inside `conformance.json` under `releaseEvidence`. The manifest is the
external verification surface for HKI maturity claims.

Key fields:

| Field                                    | Purpose                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `level`                                  | Canonical HKI level, for example `L4-tested`.                        |
| `evidenceProfile`                        | Proof location: `smoke`, `live`, or `release`.                       |
| `managedEvidence`                        | Optional ADK/Gemini managed-service evidence summary and coverage.   |
| `commandManifest`                        | Commands or evidence sources that support the claim.                 |
| `componentHashes`                        | Stable hashes for conformance results, audits, packages, and probes. |
| `releaseReadiness.strictReleaseEligible` | Whether the artifact satisfies the stricter public-release gate.     |
| `releaseReadiness.blockers`              | Conditions that prevent a public release claim.                      |
| `manifestHash`                           | SHA-256 hash of the manifest body before the hash field is attached. |

The reference registry distinguishes development evidence from release evidence:

- `L4-tested (smoke evidence)` — acceptable for development, README, and design
  partner previews when the mock gateway or local probe proves the invariant.
- `L4-tested (live evidence)` — acceptable for a public release candidate when a
  deployed endpoint has matching probe evidence from a clean commit.
- `L5-audited (release evidence)` — reserved for signed release artifacts with
  independent review and an external implementation or design-partner reference.

## How to Verify Evidence

For local smoke evidence:

```bash
pnpm verify:hki-conformance
pnpm audit:hki
pnpm audit:hki-ast
pnpm audit:hki-ast-ts
pnpm probe:smoke
pnpm registry:build
```

To attach ADK/Gemini managed-service evidence, pass an evidence file to the
registry builder. The sample below is structural only; release claims require
live or release evidence from managed services.

```bash
node scripts/build-conformance-registry.mjs \
  --managed-evidence=examples/agent-platform-hki/managed-evidence.sample.json
```

For a release candidate, run the registry builder from a clean commit with live
probe evidence and strict release checks:

```bash
hki-probe https://your-gateway.example.com --route /v1/chat --out /tmp/hki-evidence.json
node scripts/build-conformance-registry.mjs --strict-release
```

`--strict-release` fails when the worktree is dirty, probe evidence is missing,
adapter conformance fails, blocking audit findings exist, or required evidence
inputs are incomplete. Smoke evidence can still produce `L4-tested`, but it is
not strict-release eligible.
