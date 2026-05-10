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

| Lane | Good Contributions | Extra Bar |
| --- | --- | --- |
| Standard and docs | Clarify invariants, threat models, migration guidance, examples, diagrams | Keep normative language precise; avoid vendor-specific requirements |
| Runtime packages | Envelope validation, artifact labels, cache keys, gateway decisions, signing helpers | Add tests in both TypeScript and Python when behavior is shared |
| Conformance | New adversarial cases, service probes, evidence output, CI integrations | Negative tests must fail closed and produce actionable evidence |
| Adapters | LangChain, LlamaIndex, CrewAI, AutoGen, ADK, MCP, vector stores, graph stores, caches | Preserve exact active-domain semantics; no implicit fallback scope |
| Reference services | Orchestrator, Knowledge API, ingestion, analytics, BFF, deployment, observability | Update service docs and run the closest service or boundary tests |
| Agentic UI | Chat, traces, approvals, scope visualization, knowledge workflows, admin controls | Use shared tokens, show scope/tool/approval state explicitly, keep hidden autonomy low |
| Community operations | Issue templates, examples, release evidence, onboarding scripts, sample apps | Keep commands reproducible from a fresh clone |

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

