# The Custody Problem in Enterprise Agentic AI

**Provider privacy promises are necessary. They are not enough.**
The next security boundary is _runtime custody_ — who controls the context, memory, tools, retrieval, and domain boundaries that your agents reason through.

> **Cover image:** `docs/images/hki/newsletter-cover.png` (1600×900) — upload as the LinkedIn newsletter cover.

---

_An enterprise is only as secure as the data and context boundaries around its operational reasoning. In an agentic future, the danger is not data leakage or model training. It is silent context bleed: knowledge, memory, or tool access from one domain entering another without explicit publication, provenance, or audit._

---

## 1 · The problem to solve

Agentic AI can assemble enterprise context across domains before governance can see the boundary.

The concrete problem is not simply that private data might be exposed to a model provider. It is that an agentic runtime can silently combine **legal, finance, HR, engineering, customer, and strategy** knowledge during one task — because the connected user, connector, or service account can technically reach those sources.

Enterprises need a way to make every request answer the same operational questions _before_ any retrieval, memory read, tool call, cache lookup, or model call occurs:

- What domain is active?
- What is allowed to enter the reasoning context?
- What must stay out?
- What evidence proves the boundary held?

> **The engineering problem:** build a runtime where context is never broadened by convenience, fallback, connector reach, or accumulated memory. Every request must carry one enforceable scope, every artifact must preserve domain provenance, and cross-domain knowledge must move only through explicit publication.

The four failure modes:

1. **Scope ambiguity** — user permissions and service accounts are broader than the task. The runtime needs _task-level_ domain custody, not only tenant-level authorization.
2. **Context bleed** — retrieval, caches, graph edges, files, and conversations can inject adjacent-domain knowledge unless visibility is exact and enforced at runtime.
3. **Memory and tool drift** — agent memory, tool routing, logs, and workflow preferences become hidden operational knowledge without durable labels and audit trails.
4. **No falsifiable proof** — security claims remain promises unless every boundary is testable through conformance cases, probes, and release evidence.

---

## 2 · Clarification

This is not an argument against AI. It is an argument for _runtime sovereignty_.

The models are useful. Retrieval, tool use, memory, orchestration, and agentic workflows are real engineering gains. I am not writing from fear of the technology. I am writing from familiarity with what happens when powerful infrastructure becomes invisible.

Most provider assurances answer an important question: _will my enterprise data be used to train a general model, and is my tenant isolated from other tenants?_ Those are necessary questions. They are not the whole security problem anymore.

> **The missing question:** at runtime, during this specific task, what knowledge is allowed to enter the agent's reasoning space — and who decides that boundary?

That is the custody problem. It is not primarily about whether the provider is malicious. It is about whether the enterprise still owns the architecture that decides what the agent is allowed to know, remember, retrieve, and do.

---

## 3 · Why provider promises are insufficient

No-training guarantees solve one layer. Agentic systems create another.

A provider can truthfully say _"we do not train on your enterprise data,"_ while the agentic runtime still retrieves enterprise documents, injects internal context, calls tools, stores memory, routes requests, logs telemetry, and learns operational preferences during inference.

That may all be authorized. It may even be necessary. But authorization at the user or tenant level is not the same as **domain-scoped reasoning**. A person may have permission to legal, finance, engineering, HR, and strategy documents. That does not mean every request should be allowed to draw from all of them.

> **The deepest enterprise AI security boundary is not the model-training pipeline. It is the reasoning context.**

The problem moves from _"will the provider train on my data?"_ to _"can the runtime silently assemble context across boundaries simply because the user, connector, or service account can technically reach it?"_

---

## 4 · What accumulates around the model

The model is not the only dependency. The surrounding runtime is the dependency.

Enterprise buyers often think they are purchasing model access. In practice, they are beginning to depend on a larger substrate: memory, tool routing, retrieval, permissions, evaluation, guardrails, logs, prompt orchestration, and workflow execution.

- **Operational telemetry** — queries, tool calls, retries, escalations, failure modes, latency tradeoffs, the shape of work itself. None of this has to be "training data" to become strategic signal.
- **Accumulated memory** — over time, the agent learns vocabulary, preferences, escalation paths, institutional habits, workflow shortcuts. That memory becomes operationally valuable.
- **Context assembly** — retrieval, connectors, caches, files, chats, tickets, repositories, and tools become the real reasoning surface. _Whoever controls assembly controls what the agent sees._
- **Evaluation and policy surface** — guardrails, model routing, safety filters, output policies, and evaluator infrastructure shape what the enterprise can build, ask, automate, or even see.

None of this requires misconduct. It is the normal result of useful infrastructure becoming central. The risk is concentration, opacity, and silent boundary expansion.

---

## 5 · The dependency curve

Switching costs grow quietly. By the time they are obvious, exit may be theoretical.

This is the same pattern enterprises learned during cloud adoption — but deeper. In cloud, the dependency was compute, storage, and managed services. In agentic AI, the dependency is _reasoning, memory, and workflow execution_.

| Year  | What you have                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| **0** | API access. Easy to switch. The provider is clearly a vendor.                                                           |
| **1** | Prompts, workflows, fine-tunes, memories, and retrieval indexes accumulate.                                             |
| **2** | Agents are embedded into daily operations. Exit now means re-engineering work.                                          |
| **4** | The provider-adjacent runtime holds institutional memory. Switching is technically possible, but operationally painful. |

The issue is not that providers are bad. The issue is that the layer you depend on for everything becomes the layer you have the least leverage over.

---

## 6 · What "wrong hands" really means

The danger does not require villains. It only requires **concentration**.

"Wrong hands" should not be reduced to a movie scene with an attacker at a keyboard. The more realistic risks are ordinary corporate and geopolitical realities:

- **Pricing power after dependency** — if the runtime holds your operational memory, the provider does not need to be aggressive. It only needs to know that leaving is expensive.
- **Strategic withdrawal** — a provider can stop supporting a use case, region, or industry category. Enterprises then discover their runtime has policy positions they did not choose.
- **Ownership changes** — frontier AI companies can be acquired, restructured, partnered, or redirected. Incentives around the runtime can change faster than enterprise systems can migrate.
- **Silent defaults** — logging, retention, tool access, memory, routing, and connector defaults can drift over time. Each change may be small. The cumulative posture may not be.

### The technofeudal endgame

When an enterprise's reasoning, memory, and institutional habits are fully mediated by a provider-controlled runtime, the provider becomes the _de facto_ owner of the enterprise's operational intelligence.

The enterprise retains its legal structure — the brand, the assets, the shareholder registration — but the entity that decides what knowledge is accessible, what policies apply, and what actions are taken is no longer sovereign. This is the quiet, consensual enclosure of the enterprise mind: the enterprise becomes a tenant on a cognitive estate owned by someone else.

The "custody" in the custody problem is ultimately about whether the enterprise remains an independent economic actor — or whether its shareholders are unknowingly holding a shell whose real economic substance has migrated into a proprietary runtime they do not control.

---

## 7 · The standard I am proposing

Move from provider trust to an enforceable **runtime contract**.

The answer is not to reject frontier providers. Enterprises will use several of them. The answer is to keep the architectural boundary _inside the enterprise_: a domain-aware control plane that decides scope before any provider is called.

> **Hermetic Knowledge Isolation · v1**
>
> _Every artifact belongs to one domain. Every request runs in one active domain. Shared knowledge appears only through explicit publication — never silent global fallback._

Three invariants:

1. **One active domain per request** — the gateway decides where the request is running before retrieval, memory, tools, or model calls begin.
2. **Domain labels never disappear** — artifacts, cache entries, memories, embeddings, tool calls, and outputs preserve provenance and scope.
3. **Publication is the only bridge** — cross-domain knowledge moves through reviewed, auditable publication. Not silent fallback. Not hidden retrieval.

This converts security from a _promise_ into an _invariant_. The provider may still be excellent. The enterprise may still benefit from frontier models. But the authority to widen context remains with the enterprise — not the platform underneath it.

---

## 8 · Closing

Build the boundary while it still belongs to you.

Enterprise AI security cannot stop at _"we do not train on your data."_ That promise matters, but it addresses only part of the risk. Agentic systems reason with context, and **context is power**.

The enterprises that remain sovereign in the agentic era will be the ones that define runtime custody early: what belongs where, what can be retrieved, what can be remembered, what can be shared, and what must be explicitly published before it crosses a domain boundary.

> **In enterprise AI, isolation cannot remain a provider promise. It has to become architecture.**

---

_Henok Ghebrechristos, PhD — deep learning, industrial AI deployment, agentic systems. Author of the HKI (Hermetic Knowledge Isolation) runtime contract._

`#EnterpriseAI` `#AgenticAI` `#AISecurity` `#AIGovernance` `#HKI` `#RuntimeSovereignty` `#TechFeudalism` `#CISO`

---

### Posting checklist (LinkedIn newsletter editor)

- **Title:** _The Custody Problem in Enterprise Agentic AI_
- **Subtitle:** _Why provider privacy promises are not enough — and what runtime sovereignty actually requires_
- **Cover:** upload `docs/images/hki/newsletter-cover.png`
- **Hook (first 2 lines, shown in feed preview):**
  > Provider privacy promises are necessary. They are not enough. The next security boundary is runtime custody — who controls the context, memory, tools, retrieval, and domain boundaries your agents reason through.
- **Suggested CTA at the end:** _"If you are building or buying agentic infrastructure in 2026, the question is no longer whether your provider trains on your data. It is whether your runtime still belongs to you. Reply with the word **custody** if you'd like the v1 spec."_
- **Hashtags:** keep 3–5 max for LinkedIn — recommend `#AgenticAI #AISecurity #EnterpriseAI #AIGovernance #HKI`
