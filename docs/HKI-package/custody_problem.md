# The Custody Problem in Enterprise Agentic AI

**Status:** HKI research note
**Version:** 2026-05-17
**Author:** Henok Ghebrechristos, PhD
**Relationship to HKI:** This note motivates and sharpens the custody model behind HKI. The normative standard remains [HKI 1.0](../../spec/HKI-1.0.md).

## Abstract

Enterprise agentic AI turns data sovereignty into a runtime custody problem. Traditional authorization asks whether a subject may access a resource. Agentic custody asks a harder question: once scoped authority or scoped knowledge enters a long-running computation, can the system prove that usage control, provenance, and domain constraints remain attached to every derived operation and artifact?

The core claim is simple: **scope must be conserved across agentic computation.** Every retrieval, tool call, model call, cache read, cache write, memory operation, background job, summary, trace, and audit event must be attributable to exactly one valid active domain unless an explicit publication event changes its visibility. HKI expresses that custody object as the `HkiEnvelope`: a signed runtime scope that propagates from the gateway edge through the execution path.

This note defines the custody problem, separates it from ordinary authorization, names the objects that require custody, describes a small state-machine model, and turns the idea into falsifiable conformance requirements.

## Research Alignment: Data Sovereignty, Usage Control, and Provenance

The phrase "no training on your data" is a partial privacy control, not a complete data-sovereignty claim. In current data-space and AI-governance language, sovereignty is closer to enforceable control over how data is used, transformed, shared, and audited after access has been granted.

HKI should therefore be read as a runtime architecture for **inference-time data sovereignty**:

| State-of-the-art term                  | How HKI uses it                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Data sovereignty**                   | The enterprise retains policy authority over data use, derived artifacts, and cross-domain release.                 |
| **Usage control**                      | Constraints follow data after access, so retrieval, memory, tools, caches, and summaries cannot silently widen use. |
| **Information-flow control**           | Runtime operations execute in one active domain and fail closed when a flow is not explicitly allowed.              |
| **Provenance / lineage**               | Every derived artifact remains attributable to the envelope, inputs, policy, and operation that produced it.        |
| **Policy obligations and constraints** | Publication and release are governed transitions, not implicit visibility or fallback.                              |
| **Data-space interoperability**        | Multi-domain work is modeled as scoped delegation plus auditable release between domains.                           |
| **Agentic workflow provenance**        | Prompts, responses, tool calls, decisions, and downstream artifacts become first-class provenance events.           |

This aligns HKI with several established research and standards streams:

- [International Data Spaces](https://internationaldataspaces.org/data-sovereignty-updated-position-paper-on-data-usage-control-in-the-ids/) frames data sovereignty through **data usage control**: restrictions regulate what must or must not happen to data after access has been granted.
- [W3C PROV-DM](https://www.w3.org/2012/10/prov-dm) models provenance through entities, activities, agents, derivations, and responsibility; HKI's custody chain is an agentic runtime specialization of that idea.
- [W3C ODRL](https://www.w3.org/TR/odrl-model/) provides a policy model for permissions, prohibitions, obligations, constraints, and duties over assets; HKI uses the same conceptual vocabulary for release gates and publication policy.
- The [European data strategy](https://digital-strategy.ec.europa.eu/en/policies/strategy-data) and [Data Governance Act](https://digital-strategy.ec.europa.eu/en/policies/data-governance-act-explained) emphasize trusted data sharing, data intermediaries, interoperability, and sectoral data spaces; HKI applies that data-space logic inside agentic runtime execution.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) treats AI risk management as a system lifecycle governance problem; HKI turns one slice of that governance problem into concrete runtime controls and conformance tests.
- Recent agentic provenance work, such as [PROV-AGENT](https://arxiv.org/abs/2508.02866), identifies prompts, responses, decisions, and tool interactions as provenance-bearing workflow events; HKI adds domain custody and fail-closed enforcement to that lineage.

## 1. The Problem

Enterprise AI systems are no longer simple request-response interfaces over a model. Modern agentic runtimes retrieve documents, rewrite queries, call tools, store memory, create summaries, cache results, start jobs, and invoke other agents. Each step can be individually useful and locally authorized while still weakening the boundary of the task.

The dangerous failure is not only that data is exposed to a model provider or excluded from model training. It is that knowledge from one enterprise domain can enter the reasoning path of another domain without enforceable usage control, explicit publication, provenance, or audit.

A user may be allowed to see legal, finance, HR, operations, and strategy material. That does not mean a single support task should reason across all of those domains. The runtime needs task-level custody, not only user-level permission.

The custody problem is therefore:

> In an agentic system, once authority or domain-scoped knowledge enters a computation, the system must preserve custody of that authority and knowledge across every derived operation, artifact, memory, cache entry, tool call, sub-agent, async job, and audit record.

If a runtime path can answer without a valid active domain, reuse a cache hit from another domain, read an unlabeled memory, launch a job without scope, or give a sub-agent broader authority than the task requires, custody has been lost.

## 2. Why Authorization Is Not Enough

Authorization answers a local question:

> May this subject access this resource?

Custody answers a transitive question:

> After access occurs, where can the resulting authority, context, and derived artifacts go?

That distinction matters because agentic systems transform information. A retrieved document may become a prompt excerpt, an embedding, a summary, a tool argument, a memory, a cached answer, an evaluation example, a trace, or a background job input. Even if the original document is protected correctly, a derived artifact can lose its label unless the runtime treats custody as a first-class invariant.

The common mistake is to treat generated text as "new" and therefore unclassified. In data-governance terms, generated text is a derived data product. A summary of payment-domain records remains payment-domain material. An embedding of HR documents remains HR-domain material. A cache entry produced under legal-domain scope remains legal-domain material.

## 3. Objects in the Custody Model

A useful model starts by naming the objects.

| Object              | Meaning                                                                                                 | Custody requirement                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Domain`            | A named isolation boundary                                                                              | Must be concrete, non-empty, non-global, and non-wildcard              |
| `Envelope`          | Signed runtime scope object                                                                             | Must contain one `active_domain` and authorized-domain evidence        |
| `Operation`         | Retrieval, tool call, model call, cache read/write, memory access, job launch, audit write, publication | Must execute under exactly one valid envelope                          |
| `Artifact`          | Document, chunk, graph node, summary, embedding, trace, cache entry, tool output, memory, response      | Must carry a custody label derived from the operation that produced it |
| `Custody chain`     | Evidence connecting an artifact to the envelope and inputs that produced it                             | Must be reconstructable for audit and conformance                      |
| `Publication event` | Explicit governed transition that makes knowledge visible in another domain                             | Must be materialized, labeled, and auditable                           |

The key design choice is that artifacts are not passive storage records. They are custody-bearing objects.

## 4. The Conservation Rule

HKI can be stated as a conservation rule:

> Every runtime operation executes inside exactly one valid active domain, and every artifact created by that operation inherits custody from that domain unless an explicit publication event changes its visibility.

There are only four safe outcomes for authority and visibility:

1. The same envelope continues unchanged.
2. A strictly narrower child envelope is minted.
3. A labeled artifact is explicitly published across domains by policy.
4. The operation is rejected.

Anything else is custody loss.

This is why `active_domain` cannot be null, empty, `global`, or `*`; why body fields cannot override the envelope; why domain comparison must use HKI exact-match helpers; why cache keys must include envelope-derived domain context; and why admin cross-domain reads must stay unreachable from runtime routes.

## 5. Multi-Domain Requests

The strongest critique of a single-active-domain model is legitimate: some real enterprise tasks need evidence from more than one domain.

For example, an executive may ask for a briefing that combines legal risk and pharmacy operations. If that executive is authorized for both domains, the system should be able to answer. HKI should not turn every cross-domain business question into a denial.

The answer is to distinguish the human task from the runtime execution path:

> A human request may be multi-domain. Each runtime data-plane operation must still execute inside exactly one active domain.

In product terms, the executive sees one request. In HKI enforcement terms, the orchestrator runs a composite workflow: scoped fan-out, domain-local work, explicit release, and scoped synthesis.

![Composite multi-domain workflow under HKI: one executive request fans out into legal and pharmacy child envelopes, releases domain summaries into executive_briefing, then synthesizes the final brief.](images/hki/07-multi-domain-delegation.svg)

### 5.1 The Delegated Pattern

A safe multi-domain request has four stages.

1. **Coordinate.** The orchestrator receives the executive's task under a coordinator envelope, usually tied to an output domain such as `executive_briefing`, `leadership`, or an ephemeral task domain. That coordinator envelope can plan and delegate, but it is not a universal read token.
2. **Delegate.** The orchestrator mints child envelopes for each requested domain, such as `active_domain=legal` and `active_domain=pharmacy`. Each child envelope is bounded by purpose, TTL, subject, and requested operation.
3. **Release.** Each domain-local delegate produces a labeled artifact, such as a legal summary or pharmacy summary. Those artifacts do not automatically become visible to the coordinator. A policy-checked publication or release step materializes domain-approved copies into the coordinator's output domain.
4. **Synthesize.** The final answer is generated under the coordinator's active domain using only artifacts that were explicitly released into that domain. The final report is labeled with the output domain and retains provenance back to the source domains and release policies.

The orchestrator is allowed to delegate. It is not allowed to become a hidden global reader.

### 5.2 What This Preserves

This pattern preserves the useful part of cross-domain access without weakening custody.

- The executive's broad authorization is used to decide whether delegation is allowed.
- `authorized_domains` is not used as a read filter.
- Every retrieval, cache lookup, memory read, tool call, and summary operation still has one `active_domain`.
- Domain-local delegates cannot read each other's artifacts.
- The final synthesis sees only released artifacts, not raw cross-domain stores.
- The final answer has an output label and provenance, so it cannot later be mistaken for unlabeled global memory.

The publication step does not have to be slow or manual in every case. It can be just-in-time, policy-driven, and automatic for approved executive workflows. What matters is that the release is explicit, materialized, labeled, and auditable.

### 5.3 What Must Not Happen

The unsafe implementation is a single prompt context containing raw legal and pharmacy material under a fake `global`, `all`, or `executive` scope. That design is convenient, but it destroys custody because the runtime can no longer explain which domain authorized which input, cache entry, memory, tool call, or derived claim.

The other unsafe implementation is using `authorized_domains=["legal", "pharmacy"]` as if it were a read filter. In HKI, `authorized_domains` says which domains the subject may select or delegate into. It does not mean every operation may read all of them at once.

The practical rule is:

> Multi-domain business tasks are allowed. Multi-domain runtime reads are not. Use scoped delegation plus explicit release.

## 6. Three Forms of Custody

Custody has at least three layers.

### 6.1 Authority Custody

Authority custody asks who may act inside this task.

The envelope is the custody object. Downstream components must not widen it, replace it from request body fields, drop it, or silently fall back to a default. A sub-agent should receive a narrowed child envelope, not a broad parent envelope. A tool call should be checked against the envelope at the gateway, not trusted because the model suggested it.

Unsafe authority transitions include:

- missing envelope accepted
- invalid signature accepted
- unauthorized active domain accepted
- body `scope` or `domain` replacing the envelope
- parent or coordinator envelope passed directly to a sub-agent without narrowing
- tool execution outside an envelope
- fallback to a default or global domain

### 6.2 Information Custody

Information custody asks where knowledge came from and which domain may observe it.

If a runtime reads payment-domain documents, the prompt context, intermediate notes, summaries, and response candidates derived from that context are payment-domain artifacts. The custody label follows the derivation even when the exact source text is no longer visible.

This is especially important for:

- retrieval results
- graph traversals
- embeddings
- summaries
- semantic cache values
- agent memory
- conversation history
- evaluation examples
- traces and logs

### 6.3 Artifact Custody

Artifact custody asks how produced objects may be reused later.

Most real leaks appear here. A cache value, embedding, memory, trace, or job result can outlive the request that created it. If the artifact is unlabeled, later operations cannot decide whether reading it is legal. If it is labeled weakly, later operations may treat it as shared knowledge.

The rule should be strict: an artifact derived under domain `D` is visible to domain `D` only, unless an explicit publication event creates a new domain-labeled artifact for another domain. In a composite workflow, this is the step that lets legal and pharmacy summaries become inputs to an executive briefing without making legal or pharmacy stores globally visible.

## 7. A Minimal State Machine

The custody model can be represented as a small state machine.

```text
NoEnvelope
  -> Rejected

InvalidEnvelope
  -> Rejected

ValidEnvelope(domain=D)
  -> Operation(domain=D)
  -> ArtifactLabeled(domain=D)

ValidEnvelope(domain=D)
  -> NarrowedEnvelope(domain=D2)
     only if D2 is authorized and narrower than D

CoordinatorEnvelope(domain=C)
  -> ChildEnvelope(domain=D)
     only if D is authorized for the subject, purpose, and workflow

ArtifactLabeled(domain=D)
  -> ReadBy(domain=D)

ArtifactLabeled(domain=D)
  -> PublishedArtifact(from=D, to=D2, policy=P)
     only through explicit publication policy

ArtifactLabeled(domain=D)
  -> ReadBy(domain=D2)
     rejected unless a publication artifact exists for D2
```

The disallowed transitions are the most important part:

```text
NoEnvelope -> Operation
InvalidEnvelope -> Operation
ValidEnvelope(D) -> Operation(global)
Operation(D) -> UnlabeledArtifact
ArtifactLabeled(D) -> CacheGlobal
ArtifactLabeled(D) -> ReadBy(other domain)
Operation(D) -> ToolCall(unscoped)
CoordinatorEnvelope -> CrossDomainRead
ParentEnvelope -> SubAgent without narrowing
RuntimeRoute -> AdminCrossDomainRead
```

This model is intentionally small. Its value is that it makes custody failure falsifiable.

## 8. Derived Artifacts Are the Hard Case

The hardest unresolved engineering surface is semantic custody of derived artifacts.

Consider a payment-domain agent that reads ten policy documents and produces a short paragraph. The paragraph may contain no direct quote, no document identifier, and no obvious sensitive token. It is still payment-domain material because it was produced from payment-domain inputs under payment-domain authority.

The same rule applies to embeddings. An embedding is not human-readable, but it is still a representation of source material. A cross-domain vector index without exact-domain filtering is therefore a custody leak even when the raw text is never returned.

The same rule applies to traces. A trace that records retrieved snippets, tool arguments, model messages, or policy decisions is an artifact. Runtime traces should not flow into global analytics unless they are redacted, labeled, or published through an admin-plane process designed for that purpose.

The custody standard should therefore require labels at artifact creation time, not as a best-effort enrichment step later.

## 9. Failure Modes

The custody problem appears in predictable places.

| Failure mode             | Example                                                           | HKI control                                                                |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Missing envelope         | Runtime endpoint answers without scope                            | Reject with 401                                                            |
| Unauthorized domain      | User requests a domain outside authorization                      | Reject with 403                                                            |
| Multi-domain shortcut    | Executive request reads legal and pharmacy under one active scope | Delegate to single-domain child envelopes and release artifacts explicitly |
| Body-scope override      | `body.domain` replaces `active_domain`                            | Reject conflicting scope argument                                          |
| Weak comparison          | String equality misses normalization rules                        | Use `same_domain()` / `sameHkiDomain()`                                    |
| Cache contamination      | Cache key omits active domain                                     | Use `derive_hki_cache_key()` / `deriveHkiCacheKey()`                       |
| Retrieval bleed          | Vector search returns another domain's chunk                      | Require exact artifact visibility                                          |
| Graph bleed              | Derived edge crosses domains without label                        | Preserve and check graph labels                                            |
| Memory drift             | Agent memory reused across domains                                | Label memory and require same-domain reads                                 |
| Tool target confusion    | Model selects unauthorized MCP tool                               | Evaluate gateway target against envelope                                   |
| Async scope loss         | Background job starts without envelope                            | Persist or mint narrowed job envelope                                      |
| Sub-agent overdelegation | Child receives parent authority                                   | Mint narrowed child envelope                                               |
| Trace leakage            | Runtime trace enters global analytics                             | Label, redact, or admin-plane publish                                      |
| Admin-plane bleed        | Runtime route calls cross-domain admin read                       | Separate planes and fail closed                                            |

These are not edge cases. They are the normal surfaces of agentic software.

## 10. Conformance Implications

A custody model becomes useful only when it produces tests.

At minimum, a conformant runtime should prove:

1. Missing envelopes fail closed.
2. Invalid envelopes fail closed.
3. Unauthorized active domains fail closed.
4. `active_domain` is never null, empty, `global`, or `*`.
5. Body scope cannot override envelope scope.
6. Runtime reads require exact-domain artifact visibility.
7. Cache keys differ across active domains for the same operation and input.
8. Tool calls are evaluated against the envelope before execution.
9. Async jobs preserve or narrow envelope custody.
10. Sub-agent handoff mints a narrowed child envelope.
11. Composite multi-domain workflows fan out into single-domain child envelopes.
12. A coordinator envelope cannot directly read delegated domains.
13. Final synthesis can read only artifacts released into its active output domain.
14. Derived artifacts receive labels at creation time.
15. Runtime routes cannot reach admin cross-domain read paths.
16. Publication creates explicit domain-labeled artifacts rather than shared global objects.
17. Audit records contain enough envelope and artifact metadata to reconstruct the custody chain.

The scientific standard is adversarial: changing `active_domain` should change every visibility boundary, cache key, tool allowance, memory read, and audit record exactly as the model predicts.

## 11. Relationship to the HKI Standard

HKI implements custody through six runtime invariants:

1. Single active domain.
2. Fail-closed behavior.
3. Exact-match visibility.
4. No body-scope override.
5. Explicit cross-domain publication.
6. Admin plane separation.

The `HkiEnvelope` is the runtime custody object. It is selected at the gateway edge and propagated through retrieval, tools, cache, async jobs, and audit. The envelope is not a hint. It is the evidence that explains why this operation is allowed to happen inside this domain.

HKI also requires artifact labels because envelopes alone are not enough. The envelope governs operations. Artifact labels govern reuse. A system that validates envelopes but stores unlabeled summaries, embeddings, memories, or cache values still loses custody after the first request.

This is also why HKI distinguishes `active_domain` from `authorized_domains`. The active domain is the execution label for the current operation. Authorized domains are the set of domains the subject may select or delegate into. Treating authorized domains as a combined read scope would recreate the custody problem under a different name.

## 12. Research Agenda

The custody problem is a useful research program because it can be made precise.

Open questions include:

1. **Formal semantics.** Can the envelope and artifact-label model be expressed as an information-flow type system for agentic runtimes?
2. **Derived artifact labeling.** What is the minimum label structure needed for summaries, embeddings, memories, traces, and eval examples?
3. **Publication calculus.** How should explicit cross-domain publication be represented so that sharing is useful but never implicit?
4. **Compositional agents.** How should child envelopes be minted, narrowed, audited, and expired across multi-agent workflows?
5. **Runtime verification.** Which custody invariants can be enforced statically, which require dynamic checks, and which require conformance probes?
6. **Observability without leakage.** How can analytics and incident response inspect behavior without becoming a global runtime read path?

The practical goal is not to prove that no information can ever flow. The goal is to make every allowed flow explicit, labeled, testable, and attributable.

## 13. Publication Checklist

To make a custody claim credible and easy to review, a platform should publish:

- the normative runtime invariants
- the envelope schema
- the artifact-label schema
- a threat catalog with pre-HKI and post-HKI examples
- conformance cases for envelope, artifact, cache, tool, scope override, job, and admin-plane behavior
- generated conformance evidence
- a reference implementation
- a migration guide for null-scoped or weakly scoped systems
- a clear statement of what is not covered

For HKI, those artifacts live in the standard, runtime packages, conformance harness, threat catalog, examples, and evidence bundle in this repository.

## 14. Citation

```bibtex
@techreport{ghebrechristos2026custody,
  title  = {The Custody Problem in Enterprise Agentic AI},
  author = {Ghebrechristos, Henok},
  year   = {2026},
  type   = {HKI Research Note},
  url    = {https://github.com/h3nok/HKI}
}
```

## 15. Bottom Line

Agentic systems make knowledge mobile. They retrieve it, transform it, summarize it, store it, cache it, delegate it, and act on it. That mobility is the reason they are useful. It is also the reason ordinary access control is not enough.

The custody problem asks whether scoped authority and scoped knowledge remain scoped after the runtime starts moving.

HKI's answer is to make scope a conserved runtime object: one active domain per data-plane operation, one envelope, labeled artifacts, scoped delegation for composite tasks, explicit publication, and fail-closed behavior everywhere else.
