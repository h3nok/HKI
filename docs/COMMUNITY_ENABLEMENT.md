# Community Enablement Model

HKI is an open standard, runtime, conformance suite, and reference platform for
scoped agentic systems. Community work should make one of those layers easier to
understand, extend, verify, or operate.

## North Star

The project should let a new adopter do four things without vendor help:

1. Understand the isolation contract.
2. Add HKI enforcement to an existing agentic stack.
3. Prove the integration with conformance evidence.
4. Inspect a production-shaped reference platform that implements the same
   contract end to end.

The standard is the product. The reference app is evidence and an implementation
guide, not a lock-in surface.

## Contribution Lanes

| Lane                 | Good Contributions                                                                    | Extra Bar                                                                              |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Standard and docs    | Clarify invariants, threat models, migration guidance, examples, diagrams             | Keep normative language precise; avoid vendor-specific requirements                    |
| Runtime packages     | Envelope validation, artifact labels, cache keys, gateway decisions, signing helpers  | Add tests in both TypeScript and Python when behavior is shared                        |
| Conformance          | New adversarial cases, service probes, evidence output, CI integrations               | Negative tests must fail closed and produce actionable evidence                        |
| Adapters             | LangChain, LlamaIndex, CrewAI, AutoGen, ADK, MCP, vector stores, graph stores, caches | Preserve exact active-domain semantics; no implicit fallback scope                     |
| Reference services   | Orchestrator, Knowledge API, ingestion, analytics, BFF, deployment, observability     | Update service docs and run the closest service or boundary tests                      |
| Agentic UI           | Chat, traces, approvals, scope visualization, knowledge workflows, admin controls     | Use shared tokens, show scope/tool/approval state explicitly, keep hidden autonomy low |
| Community operations | Issue templates, examples, release evidence, onboarding scripts, sample apps          | Keep commands reproducible from a fresh clone                                          |

## Public Surface Boundaries

Public and stable:

- `spec/` standards and gateway profile.
- `packages/hki-runtime` and `packages/hki-runtime-py`.
- `packages/hki-conformance` and the GitHub Action.
- Adapter package interfaces once they pass their conformance fixtures.
- Docs that explain HKI, threat models, conformance, setup, and migration.

Reference implementation:

- `apps/agentic`.
- `services/*`.
- GKE, local Docker, notebooks, and example workflows.

Experimental until promoted:

- New connectors.
- Agent tools without service-backed tests.
- UI experiments under showcase/demo routes.
- Analytics aggregation and evaluation history contracts.

## Standards Governance Model

HKI should be governable by people who did not create the original reference
implementation. Until a formal technical steering committee exists, the project
uses this lightweight standards process.

### Change Classes

| Change class             | Examples                                                                         | Required process                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Editorial                | Typos, examples, diagrams, non-normative clarification                           | Normal PR review; no RFC required.                                                                     |
| Normative                | New MUST/SHOULD language, envelope fields, conformance-level meaning, invariants | RFC issue, compatibility note, conformance impact analysis, maintainer approval.                       |
| Conformance              | New cases, registry fields, probe behavior, evidence manifest changes            | RFC issue, failing/negative fixture, schema update, release-note entry.                                |
| Runtime API              | Public package exports, schema changes, middleware behavior                      | ADR or RFC, semver assessment, migration note, tests in TypeScript and Python when shared.             |
| Industry profile         | Finance, healthcare, government, legal, retail, manufacturing profiles           | Profile proposal, mapped controls, non-goals, evidence requirements, at least one domain reviewer.     |
| Reference implementation | UI, service, deployment, local-dev, demo platform behavior                       | Normal PR review, closest validation command, no change to core HKI semantics unless separately RFCed. |

### RFC Workflow

Use an RFC when a change could affect external implementers or public claims.

1. Open an issue titled `RFC: <short proposal>`.
2. State the problem, proposed change, alternatives considered, and compatibility
   impact.
3. Identify whether the change affects the spec, runtime packages, conformance,
   evidence registry, profiles, or reference implementation only.
4. Include at least one negative test or evidence requirement for normative and
   conformance changes.
5. Leave the RFC open for public review before merge unless it fixes a security
   defect or obvious ambiguity.
6. Merge only after maintainers record the decision in the PR or a compact ADR.

### Versioning and Compatibility

- HKI standard versions use `major.minor` labels, for example `HKI 1.0`.
- Patch-level changes may clarify text but must not alter runtime behavior.
- Minor versions may add optional fields, profiles, or conformance cases that do
  not invalidate conforming 1.0 implementations.
- Major versions may change required fields, enforcement semantics, or evidence
  requirements.
- Runtime packages follow semver. A package breaking change must identify the
  matching standard version or explain why it is package-local.
- The envelope schema must remain backward-compatible within a major HKI
  standard version.

### Conformance Mark Rules

HKI conformance claims must use the canonical level and evidence profile:

```text
HKI <level> (<evidence profile>)
```

Examples:

- `HKI L3-enforced`
- `HKI L4-tested (smoke evidence)`
- `HKI L4-tested (live evidence)`
- `HKI L5-audited (release evidence)`

Projects must not claim `L5-audited` unless signed release evidence is
independently reviewable. Projects must not imply live evidence when only local
or mock-gateway smoke evidence was used.

### Industry Profile Process

Profiles adapt HKI evidence to an industry context without changing the core
runtime invariant.

A profile proposal should include:

- scope and non-goals
- relevant regulatory or audit frameworks
- additional artifact classes that must carry domain labels
- required evidence beyond the core HKI registry
- examples of allowed publication workflows
- examples of non-conformant shortcuts
- at least one reviewer familiar with the target industry

Profiles must not introduce `global`, wildcard, inheritance, or fallback domain
semantics. Sector language can vary; the active-domain invariant cannot.

### Maintainer and TSC Path

Until HKI has a formal technical steering committee, maintainers act as the
review body. A future TSC should include at least one maintainer for each of:

- standard and conformance
- runtime packages
- reference implementations
- security or audit evidence
- at least two independent implementers or design partners

The TSC should own standard version approval, profile acceptance, conformance
mark disputes, and compatibility exceptions.

## Safety Bar

Every runtime contribution should preserve these defaults:

- One request has exactly one active domain.
- Missing, null, `global`, wildcard, or ambiguous runtime scope fails closed.
- Cross-domain visibility happens only through explicit publication.
- Admin-plane inspection never becomes a runtime shortcut.
- Memory, cache, tools, graph traversal, retrieval, traces, jobs, and evals carry
  scope evidence.

When a change touches scope, auth, retrieval, tools, memory, cache, ingestion,
review, publication, or traces, include at least one negative validation path.

## Agentic Interface Bar

The UI should make autonomy inspectable:

- Show active domain and boundary context close to where work is initiated.
- Show tool calls, memory use, retrieval evidence, HITL approvals, and resumed
  runs as first-class activity.
- Treat approval, cancel, retry, rollback, and export evidence as expected
  controls, not edge cases.
- Keep visual language consistent with shared `@hki/ui` tokens and the Agentic
  theme. Do not introduce retired brand colors or page-local color systems.
- Prefer dense, operational views over marketing-style pages for authenticated
  workflows.

## Maintainer Review Checklist

Before merging community work, maintainers should be able to answer:

- Which contribution lane does this improve?
- Is the changed surface public API, reference implementation, or experimental?
- Does the change preserve fail-closed HKI behavior?
- Is the validation command proportional to the blast radius?
- Did docs, examples, package metadata, or feature flags need an update?
- Can a new adopter understand the behavior without reading private context?

## Design Partner Readiness Checklist

Before naming an external implementation as a design partner or publishing an
anonymized finding, collect enough evidence for another reader to understand the
claim.

Required minimum:

- implementation architecture diagram or written runtime-boundary description
- active-domain resolution point and envelope propagation path
- artifact-label inventory for retrieval, memory, cache, tools, jobs, and traces
- adapter or service-boundary conformance output
- probe evidence profile (`smoke`, `live`, or `release`)
- known gaps and compensating controls
- permission boundary for what may be published

Preferred evidence:

- clean `conformance.json` or equivalent evidence bundle
- at least one failed pre-HKI negative test and the corresponding post-HKI fix
- latency/operational overhead notes
- migration notes for existing RAG, MCP, memory, or cache surfaces
