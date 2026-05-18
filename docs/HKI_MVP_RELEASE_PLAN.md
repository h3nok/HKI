# HKI MVP Release Plan

## Release Goal

Ship HKI as a credible MVP across three linked surfaces:

1. **The standard** - vendor-neutral runtime isolation contract, runtimes,
   conformance kit, threat catalog, and evidence registry.
2. **The reference platform** - Agentic BFF, Knowledge Domains, Python services,
   connectors, governance, and admin surfaces that prove HKI works in a real
   agentic stack.
3. **The Audit & Evidence Appliance** - on-prem audit layer that helps
   enterprises prove any agent platform is governable and domain-scoped.

The MVP should let a serious enterprise evaluator answer one question:

> Can we adopt HKI to make our agent platforms auditable without replacing our
> current agent stack?

## MVP Release Name

Recommended label: **HKI v0.1 Enterprise Evidence Preview**.

Use this label until packages are public, release evidence is attached, and at
least one design partner has run an external conformance or audit assessment.

## Release Boundaries

| Track              | Included in MVP                                                                                                                        | Not included in MVP                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Standard           | HKI 1.0 draft spec, TS/Python runtimes, conformance kit, threat demos, MCP guard, SDK, service evidence.                               | Formal certification authority, independent standards body, sector-specific final profiles.        |
| Reference platform | Agentic BFF, Knowledge Domains, admin controls, scoped routing, BFF edge evidence, service evidence, GKE/on-prem guidance.             | Full enterprise SIEM, all SaaS connectors, full release rollback automation, all cloud references. |
| Audit appliance    | Product definition, canonical audit event schema, scope-safe ingestion, auditor workspace v1, evidence bundle export, on-prem profile. | WORM storage certification, legal hold, every vendor collector, regulator-ready attestations.      |
| Public release     | Public repo artifact, package publishing, install smoke tests, release notes, live or smoke evidence bundle.                           | Broad market launch, paid support portal, partner marketplace.                                     |

## MVP Personas

| Persona            | MVP proof they need                                                                    |
| ------------------ | -------------------------------------------------------------------------------------- |
| CISO               | HKI blocks missing, `global`, wildcard, cross-domain, and body-scope override paths.   |
| AI governance lead | Audit events map to HKI invariants, policy packs, domains, and evidence bundles.       |
| Platform engineer  | Packages install cleanly and the reference stack runs locally or in Kubernetes.        |
| Internal auditor   | Evidence export shows who acted, under which domain, with which decision and controls. |
| Developer adopter  | They can wrap an agent/retriever/tool and run conformance without private context.     |
| Design partner     | They can import their platform events or run probes and receive a useful report.       |

## Release Milestones

| Milestone                      | Target       | What ships                                                                                        | Exit gate                                                                                         |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| M0 - Evidence baseline         | May 16-18    | BFF edge evidence, service evidence, current conformance registry, sensitive-source audit.        | `pnpm evidence:hki-agentic-bff`, `make hki-service-evidence-auth`, `pnpm verify:hki-conformance`. |
| M1 - Audit appliance contract  | May 19-22    | Product brief, `hki.audit.event.v1`, ingestion validation plan, collector API draft.              | Schema tests and docs prove trace, analytics, audit, and evidence are distinct.                   |
| M2 - Audit appliance MVP slice | May 23-30    | Scope-safe ingestion, evidence bundle builder, auditor workspace v1, on-prem deployment profile.  | Demo exports evidence for a denied scope attempt and a valid scoped workflow.                     |
| M3 - Public standard preview   | May 31-Jun 7 | Generated public repo, package dry-run, install smoke tests, release notes, site/README update.   | Public artifact audit and generated conformance pass from clean checkout.                         |
| M4 - Design partner pilot      | Jun 8-21     | One partner assessment using conformance plus audit event import.                                 | Written findings, anonymized report, and partner feedback on event schema.                        |
| M5 - MVP release               | Jun 22-30    | `v0.1` tag, public packages or package release candidates, evidence bundle, audit appliance demo. | Release checklist complete and claims stay inside MVP boundaries.                                 |

## MVP Scope By Component

### Standard And Packages

Required for MVP:

- `@hki/runtime` and `hki-runtime` expose stable envelope, artifact, cache,
  gateway, and trace helpers.
- `@hki/conformance` and Python conformance checks run without private context.
- Threat catalog remains runnable.
- `hki-probe` evidence is attached as smoke or live evidence with clear labels.
- Public package metadata, README, examples, and install smoke tests are clean.

Release gates:

```bash
pnpm verify:hki-conformance
pnpm test:hki-runtime-py
pnpm test:hki-adapters
pnpm test:hki-threats
pnpm audit:hki
pnpm audit:hki-ast-ts
pnpm audit:hki-ast
```

### Reference Platform

Required for MVP:

- Agentic BFF edge evidence runs in CI.
- Python service-boundary evidence runs in CI or local strict-auth mode.
- Knowledge workflow supports scoped ingest, review, publish, validation, and
  admin readiness checks.
- Admin control plane shows health, governance, usage, feature flags, users,
  streams, and Knowledge operations.
- GKE and on-prem reference deployment docs explain what is public-safe and what
  stays private.

Release gates:

```bash
pnpm evidence:hki-agentic-bff
make hki-service-evidence-auth
pnpm --filter @hki/agentic run check
pnpm --filter @hki/agentic run test
pnpm --filter @hki/agentic run build
pnpm --dir apps/agentic audit --prod --json
```

### Audit & Evidence Appliance

Required for MVP:

- Product brief and release boundary are explicit.
- `hki.audit.event.v1` exists with strict native-event validation rules.
- Analytics/audit ingestion rejects evidence-grade missing, `global`, wildcard,
  cross-org, and cross-stream attempts.
- Reference producers emit native events for scoped retrieval and orchestrated
  chat allow/deny decisions.
- Auditor workspace v1 shows timeline, filters, denied attempts, approval
  events, policy decision, and export status for implemented native producers.
- Evidence bundle export includes manifest hash, invariant summary, command
  sources, source refs, and redaction profile.
- On-prem deployment profile identifies storage, object store, secrets, network
  ingress, retention, and collector boundaries.

Release gates:

```bash
pnpm evidence:hki-agentic-bff
pnpm evidence:hki-services
pnpm evidence:hki-bundle -- --events <exported-audit-events.json> --require-events
pnpm registry:build
```

Add focused analytics/audit tests as this slice lands.

### Public Artifact

Required for MVP:

- Generated public repo excludes private deployment state, secrets, Terraform
  state, private infra URLs, and internal-only app details.
- Public docs explain package install, conformance, evidence profiles,
  reference Kubernetes starter, and audit appliance preview.
- Release notes attach conformance registry, probe/service evidence, package
  versions, commit SHA, and known limits.

Release gates:

```bash
pnpm audit:sensitive-source
pnpm audit:public-release
pnpm registry:build
```

## Evidence Bundle Requirements

Every MVP release should attach an evidence folder with:

| Artifact                          | Required | Notes                                                                   |
| --------------------------------- | -------- | ----------------------------------------------------------------------- |
| `conformance.json`                | Yes      | Generated from release commit.                                          |
| HTTP probe evidence               | Yes      | Smoke is acceptable for preview; live is required for stronger claim.   |
| Service evidence bundle           | Yes      | Python service strict-auth evidence.                                    |
| BFF edge evidence summary         | Yes      | Output from `pnpm evidence:hki-agentic-bff`.                            |
| Audit appliance bundle            | Preview  | Scoped audit events plus manifest hash from `pnpm evidence:hki-bundle`. |
| Sensitive-source audit result     | Yes      | No tracked secrets or private infra state.                              |
| Package versions                  | Yes      | npm/PyPI versions or release-candidate tarballs.                        |
| Commit SHA and dirty-state result | Yes      | Release evidence should come from clean commit.                         |

## Claim Boundaries

Safe MVP claims:

- HKI is a draft open standard with working runtimes, conformance kits, threat
  demos, and reference-platform evidence.
- The reference implementation is suitable for design-partner evaluation and
  limited enterprise pilots.
- The Audit & Evidence Appliance is an MVP direction for on-prem auditability of
  enterprise agent platforms.
- Current evidence is smoke, service, and CI evidence unless a live probe bundle
  is attached.

Avoid until later:

- Independent certification.
- Universal cross-industry adoption.
- Regulator-approved audit appliance.
- Full SIEM replacement.
- Full support for every vendor agent platform.

## MVP Release Checklist

### Product And Docs

- [ ] Product brief for Audit & Evidence Appliance is complete.
- [ ] MVP release plan is reviewed and linked from docs index.
- [ ] Public README explains standard, conformance, evidence, and reference app
      without overclaiming.
- [ ] Release notes include claim boundaries and known limits.
- [ ] On-prem deployment profile is documented.

### Engineering Gates

- [ ] `pnpm install --frozen-lockfile` passes.
- [ ] `pnpm verify:hki-conformance` passes.
- [ ] `pnpm evidence:hki-agentic-bff` passes.
- [ ] `make hki-service-evidence-auth` passes or CI artifact is attached.
- [ ] `pnpm test:hki-runtime-py` passes.
- [ ] `pnpm test:hki-adapters` passes.
- [ ] `pnpm audit:sensitive-source` passes.
- [ ] `pnpm --filter @hki/agentic run check` passes.
- [ ] `pnpm --filter @hki/agentic run build` passes.

### Release Artifacts

- [ ] `conformance.json` rebuilt from release commit.
- [ ] Probe evidence attached.
- [ ] Service evidence attached.
- [ ] BFF evidence attached.
- [ ] Public repo artifact audit attached.
- [ ] Package tarballs or published package URLs verified from clean install.
- [ ] Release tag created.

### Design Partner Readiness

- [ ] One-page partner brief exists.
- [ ] Conformance assessment template exists.
- [ ] Audit event import template exists.
- [ ] Anonymized report template exists.
- [ ] At least one target partner can run a meaningful review in under two hours.

## Recommended Next Build Order

1. Finish `hki.audit.event.v1` schema and examples.
2. Harden analytics/audit ingestion around evidence-grade scope validation.
3. Add evidence bundle export for scoped audit events.
4. Add `/admin/audit` as a small auditor workspace, not a broad dashboard.
5. Update on-prem K8s docs with appliance deployment and storage options.
6. Run full evidence gates from a clean commit and prepare `v0.1` release notes.

## MVP Demo Narrative

1. Start with the standard: one active domain, no global or wildcard fallback.
2. Run conformance and BFF/service evidence.
3. Show the reference platform performing a valid scoped workflow.
4. Show a denied cross-domain or wildcard attempt.
5. Open the auditor workspace and filter to the denied event.
6. Export the evidence bundle and show manifest hash plus HKI invariant summary.
7. Explain how the same event contract can ingest external agent-platform logs
   inside the customer's on-prem environment.
