# HKI Conformance Guide

This guide turns the HKI paper into an implementer-facing conformance bar for
the reference platform.

## Conformance Levels

| Level               | Meaning                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Level 0: Documented | The service states which artifacts and operations are domain-sensitive.                                                       |
| Level 1: Labeled    | Runtime artifacts persist a non-null organization and domain label.                                                           |
| Level 2: Routed     | Runtime requests carry one signed active domain through each hop.                                                             |
| Level 3: Enforced   | Reads, writes, cache hits, graph traversals, memory, tools, jobs, and traces reject missing, `global`, or cross-domain scope. |
| Level 4: Auditable  | Negative tests and audit scripts prove that no runtime path widens scope.                                                     |
| Level 5: Certified  | A release artifact ships with repeatable conformance evidence.                                                                |

The public framework should not claim Level 5 until the certification harness is
published and automated in CI.

## Required Runtime Envelope

Every runtime request must resolve these fields at the edge and preserve them
downstream:

```json
{
  "org_id": "org_acme",
  "subject_id": "user_42",
  "active_domain": "payments",
  "authorized_domains": ["payments", "fraud"],
  "purpose": "retrieve",
  "risk_tier": "read-only",
  "policy_pack_id": "policy_2026_05",
  "issued_at": 1777900000,
  "expires_at": 1777900300,
  "signature": "..."
}
```

Services must reject missing, expired, forged, null, ambiguous, or `global`
runtime domains. `authorized_domains` is not a read filter; only
`active_domain` is used for runtime visibility.

## Service Bar

| Surface         | Minimum requirement                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| BFF and gateway | Resolve exactly one active domain and sign the envelope.                                                                        |
| Orchestrator    | Treat scope as immutable and forward it to each tool, model route, cache, memory, and retrieval call.                           |
| Knowledge API   | Bind search, rerank, citations, graph traversal, and document reads to `(org_id, active_domain)`.                               |
| Ingestion       | Persist active domain on jobs, source objects, documents, chunks, extracted entities, review records, eval cases, and releases. |
| Cache           | Include `org_id`, `active_domain`, operation, policy pack, model route, and context version in keys.                            |
| Memory          | Read and write only within `(org_id, subject_id, active_domain)`.                                                               |
| MCP and tools   | Expose only tools and resources published into the active domain; tool arguments cannot override scope.                         |
| Admin plane     | Use separate routes and audit semantics for cross-domain visibility. Runtime routes cannot call admin queries.                  |
| Publication     | Create target-domain artifacts with provenance; never expose an unlabeled or wildcard shared object at runtime.                 |

## Negative Tests

Each service that touches runtime data should have black-box tests for:

- missing envelope
- expired envelope
- forged envelope
- `global` active domain
- body or query scope overriding the signed envelope
- cross-domain retrieval
- cross-domain cache reuse
- cross-domain graph traversal
- unscoped ingestion job
- MCP tool outside the active domain
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
passing report is Level 4 evidence; Level 5 still requires signed release
artifacts, reproducible CI output, and publication of the evidence bundle.

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
