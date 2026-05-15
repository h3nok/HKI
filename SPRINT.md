# HKI — 90-Day Company Sprint Plan

**Owner:** Henok Ghebrechristos  
**Start date:** 2026-05-08  
**End date:** 2026-08-06  
**Goal:** Turn HKI into a credible, externally-known standard with paying customers —
enough traction to justify transitioning out of employment.

This plan is calibrated for **one person working evenings and weekends**.
Each week has a primary deliverable and one or two support tasks.
Nothing here requires funding or collaborators to start.

---

## May 13 checkpoint

**Verdict:** HKI's standard implementation is ahead of Sprint 1; public
distribution is now the blocker.

| Area                      | Current state                                                                                                                                                         | What it means                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Standard implementation   | `conformance.json` reports 28/28 cases, 15/15 threats, 10/10 HTTP probe smoke, and `L4-tested` with a smoke evidence profile.                                         | The core standard is evidence-ready, not still in invention mode.                                           |
| Framework/runtime surface | TypeScript runtime, Python runtime, conformance kits, SDK, MCP guard, six framework adapters, examples, and threat demos are implemented per the engineering roadmap. | Stop adding core-standard scope until the public launch tasks close.                                        |
| Public package release    | `npm view @hki/runtime`, `npm view @hki/conformance`, and PyPI lookup for `hki-runtime` currently return 404; no local `v0.1.0` tag is present.                       | Week 1 is not done until packages are live and clean-install smoke tests pass.                              |
| L4 evidence nuance        | The checked-in registry was built from local/mock-gateway probe evidence; the Cloud Run probe workflow exists for live external evidence.                             | Public copy should say `L4-tested (smoke evidence)` until the live probe artifact is attached to a release. |

### Sprint 1 operating plan

| Lane                          | Status        | Next action                                                                                                                  |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Local implementation evidence | Ahead         | Keep green with `pnpm verify:hki-conformance`, `pnpm test:hki-runtime-py`, `pnpm probe:smoke`, and `pnpm test:hki-adapters`. |
| Package publication           | Blocking      | Create or verify the npm org and PyPI project, publish v0.1.0 packages, then run clean install smoke tests.                  |
| Release evidence              | Ready locally | Rebuild `conformance.json` after `pnpm probe:smoke` and attach the registry plus probe evidence to release notes.            |
| Public positioning            | Next          | Push the public package/repo surface, update README badges to live registry URLs, then ship `hki.dev` or GitHub Pages.       |

### May 15 standard maturity hardening plan

**Purpose:** Move HKI from a strong draft framework to a credible candidate
standard for cross-industry design-partner adoption. This is not a new feature
sprint; it is a standardization sprint that tightens terminology, evidence,
governance, and industry-facing adoption paths.

| Workstream                           | Why it matters                                                                                    | Definition of done                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical conformance ladder         | Current docs use overlapping terms such as Tested, Auditable, Certified, smoke-evidenced, and L4. | `spec/HKI-1.0.md`, `docs/HKI_CONFORMANCE.md`, `ROADMAP.md`, and registry output use one Level 0-5 vocabulary with explicit smoke/live evidence qualifiers.          |
| Clean release evidence bundle        | External readers should not see dirty-state ambiguity, untitled cases, or local-only evidence.    | `conformance.json` is generated from a clean commit, every case has a title, commands are listed, and smoke evidence is clearly separated from live probe evidence. |
| Standards governance pack            | All-industry adoption requires neutral process, not only a repo owned by one author.              | Contribution docs describe RFC workflow, versioning policy, conformance mark rules, decision process, and how independent implementers can propose profiles.        |
| Industry profile skeletons           | The core invariant is universal, but buyers adopt through sector language and audit mappings.     | Draft profile outlines exist for financial services, healthcare, government, legal, retail/operations, and manufacturing/IP with mappings to likely controls.       |
| Independent implementation readiness | A standard becomes real when someone else can implement and prove it without private context.     | Design-partner checklist, adapter author guide, and conformance quickstart let a third party run the kit and produce a shareable evidence bundle.                   |

**Execution order:**

1. Normalize conformance terminology first; every later artifact depends on a
   single maturity vocabulary.
2. Clean the evidence registry and conformance case metadata so public claims
   are reproducible and non-ambiguous.
3. Add the governance pack before asking design partners to treat HKI as a
   standard rather than a library.
4. Add industry profile skeletons last; they should reference the canonical
   conformance ladder and evidence format, not invent new rules.

**Non-goals for this effort:** new runtime semantics, new adapters, UI polish,
or additional reference-platform features. The core is already ahead of public
distribution; the next effort is making the standard adoptable by people who
did not watch it being built.

**May 15 execution note:** canonical conformance terminology is now normalized
across the spec, docs, registry schema, builder, and conformance action. The
registry builder also emits a release evidence manifest with command sources,
component hashes, strict-release blockers, and a manifest hash. Remaining
standardization work should focus on governance and independent implementation
readiness.

**May 15 governance note:** community and contribution docs now define the RFC
workflow, compatibility policy, conformance mark rules, industry profile process,
TSC path, and design-partner evidence checklist. Security mapping now includes
industry profile skeletons for finance, healthcare, government, legal,
retail/operations, and manufacturing/IP. The next blocker is external proof, not
internal process.

---

## Scorecard

| Signal                   | Now | Day 30 target | Day 90 target |
| ------------------------ | --- | ------------- | ------------- |
| npm installs / week      | 0   | 50+           | 500+          |
| GitHub stars             | 0   | 100+          | 500+          |
| arXiv citations          | 0   | submitted     | 5+            |
| LinkedIn article views   | 0   | 2,000+        | —             |
| Design partners engaged  | 0   | 2             | 5+            |
| Paid consulting revenue  | $0  | $0            | $5,000+       |
| Conference talk accepted | 0   | submitted     | 1 accepted    |

---

## Sprint 1 — Ship the standard (Days 1–30)

**Theme:** Get from private repo to publicly installable standard with one strong piece of proof.

### Week 1 (May 8–14) — Publish packages and tag release

**Primary deliverable:** `@hki/runtime`, `@hki/conformance` live on npm; `hki-runtime` live on PyPI.

| Task                                                                      | Notes                                                                                    | Done |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---- |
| Create npm org `@hki` at npmjs.com                                        | Free. Takes 10 min.                                                                      | ☐    |
| Build and publish `@hki/runtime` v0.1.0                                   | `pnpm --filter @hki/runtime build && pnpm --filter @hki/runtime publish --access public` | ☐    |
| Build and publish `@hki/conformance` v0.1.0                               | Same pattern                                                                             | ☐    |
| Create PyPI account and API token                                         | pypi.org — free                                                                          | ☐    |
| Publish `hki-runtime` v0.1.0 to PyPI                                      | `cd packages/hki-runtime-py && uv build && uv publish`                                   | ☐    |
| Tag git release `v0.1.0` with release notes                               | Pull from CHANGELOG.md                                                                   | ☐    |
| Verify installs: `npm install @hki/runtime` and `pip install hki-runtime` | Smoke test in a clean dir                                                                | ☐    |

### Week 2 (May 15–21) — Deploy public website

**Primary deliverable:** `hki.dev` (or GitHub Pages) live with spec, conformance kit link, and install instructions.

| Task                                                                         | Notes                                            | Done |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| Register `hki.dev` domain                                                    | ~$12/year at Cloudflare, Porkbun, or Namecheap   | ☐    |
| Enable GitHub Pages on the public repo                                       | Use `gh-pages` branch or `docs/` folder          | ☐    |
| Write `index.html` or Astro page: problem → contract → install → conformance | Keep it under 500 words. Link to spec, npm, PyPI | ☐    |
| Set DNS to GitHub Pages                                                      | Cloudflare CNAME takes 5 min                     | ☐    |
| Add badge links in README.md pointing to live URLs                           | npm badge, PyPI badge, site badge                | ☐    |

### Week 3 (May 22–28) — LinkedIn article and arXiv preprint

**Primary deliverable:** One piece of public proof that this runs at enterprise scale.

| Task                                                                     | Notes                                                                                                                         | Done |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| Write LinkedIn article: "How we isolated AI knowledge across 14 domains" | ~800 words. Problem → what most teams do wrong → the six invariants → what changed → call to action. No company names needed. | ☐    |
| Post LinkedIn article                                                    | Tag: #AIGovernance #RAG #EnterpriseAI #AgentSecurity #MCP                                                                     | ☐    |
| Fill §6 (Evaluation) of arXiv paper with production metrics              | Use aggregate / anonymized numbers: domain count, violation blocks, latency overhead                                          | ☐    |
| Submit preprint to arXiv cs.CR (Cryptography and Security)               | arXiv.org — free. Requires academic email endorsement if new account.                                                         | ☐    |
| Share arXiv link in LinkedIn comments same day                           | "The full paper is now on arXiv" drives academic traffic                                                                      | ☐    |

### Week 4 (May 29 — Jun 4) — First academic and community outreach

**Primary deliverable:** 5 warm conversations started.

| Task                                                                | Notes                                                                                                                                     | Done |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Identify 5 professors researching AI security / RAG / privacy       | Google Scholar: "retrieval augmented generation security", "LLM agent isolation", "multi-tenant AI"                                       | ☐    |
| Send cold email to each using the template below                    | One paragraph: who you are, what HKI is, you validated it at Fortune 15 scale, would appreciate a read                                    | ☐    |
| Post in r/MachineLearning and r/netsec                              | "I built a runtime isolation standard for agentic systems, validated at enterprise scale — here's the threat catalog with runnable demos" | ☐    |
| Open one GitHub Discussion "Design partners wanted"                 | Describe what a design partner gets: early access, co-authorship on case study, listed in registry                                        | ☐    |
| Submit HKI as a control reference to OWASP LLM Top 10 working group | owasp.org/www-project-top-10-for-large-language-model-applications/                                                                       | ☐    |

**Cold email template:**

```
Subject: Production-validated runtime isolation standard for agentic AI — HKI

Hi [Name],

I've been following your work on [topic]. I recently published a runtime isolation
standard for enterprise agentic systems called HKI (Hermetic Knowledge Isolation),
validated across 14 production domains at a Fortune 15 retailer.

The core idea: standard access controls protect data at rest; HKI protects knowledge
in motion — through retrieval, caching, graph traversal, tool calls, and async jobs.
The standard defines a signed scope envelope that travels unchanged from gateway to
retrieval to tool to audit log.

Repo: https://github.com/h3nok/HKI
Preprint: [arXiv URL]

Would you be open to a brief conversation or feedback on the spec?

— Henok
```

---

## Sprint 2 — Build credibility (Days 31–60)

**Theme:** Third-party voices say HKI matters. Not just you.

### Week 5 (Jun 5–11) — Threat demo video

**Primary deliverable:** 2-minute "Break a RAG in 60 seconds" screen recording.

| Task                                                                                      | Notes                                                                               | Done |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| Script the demo: vanilla LangChain RAG → show 3 threat demos → add `@hki/runtime` → fixed | Use HKI-T01 (global fallback), HKI-T02 (cache contamination), HKI-T05 (vector leak) | ☐    |
| Record with QuickTime / OBS                                                               | No production value needed — a terminal and a browser is enough                     | ☐    |
| Post to YouTube (unlisted is fine for now) and embed in README                            | Link from GitHub and LinkedIn                                                       | ☐    |
| Publish `examples/` directory: `fastapi-rag`, `langgraph-agent`                           | Each ≤200 LOC, self-contained, README-first                                         | ☐    |

### Week 6 (Jun 12–18) — Python conformance kit (M2.2)

**Primary deliverable:** `hki-conformance` Python package mirrors all 28 conformance cases.

| Task                                                | Notes                                                           | Done |
| --------------------------------------------------- | --------------------------------------------------------------- | ---- |
| Scaffold `packages/hki-conformance-py/` with uv     | Mirror the TS package structure                                 | ☐    |
| Port all 28 cases from `@hki/conformance` to pytest | One test function per case; parameterize the adapter under test | ☐    |
| Wire `pnpm test:hki-conformance-py` in CI           | Add to hki-python job                                           | ☐    |
| Publish `hki-conformance` to PyPI                   | v0.1.0                                                          | ☐    |

### Week 7 (Jun 19–25) — Blog posts and community engagement

**Primary deliverable:** Two technical blog posts published.

| Task                                                              | Notes                                                          | Done |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | ---- |
| Write post 1: "Domain-aware RAG isn't isolation — here's what is" | Target: Substack or dev.to. ~1500 words. Link to threat demos. | ☐    |
| Write post 2: "The semantic cache leak nobody notices"            | Technical deep dive on HKI-T02 and HKI-T03. Include code.      | ☐    |
| Publish both posts                                                | Cross-post to LinkedIn                                         | ☐    |
| Engage 5 responses / comments                                     | Reply to every comment within 24 hours                         | ☐    |
| Submit to CNCF TAG-Security for a community presentation slot     | security.cncf.io — mailing list + GitHub issue                 | ☐    |

### Week 8 (Jun 26 — Jul 2) — First design partner

**Primary deliverable:** One formal design partner agreement in writing.

| Task                                                                      | Notes                                                                                                       | Done |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---- |
| Identify 10 AI-native startups or consultancies with RAG / agent products | LinkedIn, YC company list, Product Hunt AI category                                                         | ☐    |
| Send design partner pitch to 10 targets                                   | "Free conformance assessment of your architecture in exchange for a case study we can publish (anonymized)" | ☐    |
| Follow up with anyone who responded to Week 4 outreach                    |                                                                                                             | ☐    |
| Prepare 1-page design partner brief: what they get, what you ask for      | Time commitment: 2 calls + written feedback                                                                 | ☐    |
| Sign MOU with first partner                                               | Simple 1-page agreement. Not a contract.                                                                    | ☐    |

**Design partner pitch (LinkedIn DM):**

```
Hi [Name], I noticed [Company] is building on [LangChain/LlamaIndex/MCP].

I've published an open runtime isolation standard (HKI) validated at enterprise
scale across 14 domains. I'm looking for 3 design partners to run a free
conformance assessment of their architecture.

What you get: a written conformance report, your implementation listed in the
public registry, and co-authorship on a case study.
What I ask: 2 hours of your time and permission to publish an anonymized finding.

Here's the spec: https://github.com/h3nok/HKI

Worth a 20-min call?
```

---

## Sprint 3 — Revenue path (Days 61–90)

**Theme:** Turn credibility into money. One paying client is a business.

### Week 9 (Jul 3–9) — Conference submission

**Primary deliverable:** Talk submitted to at least one top venue.

| Task                                                                                               | Notes                                                              | Done |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| Submit "Hermetic Knowledge Isolation: Runtime Scope Enforcement for Agentic Systems" to MLSys 2026 | Deadline: check mlsys.org                                          | ☐    |
| Prepare backup submission to USENIX ATC or SOSP                                                    | Same paper, different angle: systems paper not ML paper            | ☐    |
| Submit to one practitioner conference (QCon, Strange Loop, KubeCon)                                | 45-minute talk: "The runtime primitive your AI agents are missing" | ☐    |
| Post "CFP submitted" on LinkedIn                                                                   | Creates accountability and generates interest                      | ☐    |

### Week 10 (Jul 10–16) — Consulting rate card and first proposal

**Primary deliverable:** One consulting proposal sent.

| Task                                                                                                                              | Notes                                                                                                              | Done |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| Write rate card: HKI Architecture Review ($5,000 flat); Conformance Assessment ($3,000); HKI Implementation Sprint ($10,000/week) | These are starting numbers. Adjust based on market feedback.                                                       | ☐    |
| Identify the warmest lead from Weeks 4+8 outreach                                                                                 | The person who asked the most questions or engaged most                                                            | ☐    |
| Send consulting proposal to warmest lead                                                                                          | Frame as: "I can assess your architecture, run conformance tests, and give you a Level 2 certification in 2 weeks" | ☐    |
| Create simple Stripe payment link for consulting deposits                                                                         | stripe.com — 15 minutes                                                                                            | ☐    |

### Week 11 (Jul 17–23) — Third blog post and arXiv followup

**Primary deliverable:** Technical reputation compounding.

| Task                                                                      | Notes                                                                    | Done |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| Write post 3: "HKI as an MCP profile — what tool servers need to enforce" | Target MCP developer community specifically                              | ☐    |
| Follow up with arXiv: check if paper was published, share on social       |                                                                          | ☐    |
| Request endorsement from any professor who responded positively in Week 4 | Needed if paper needs revision/endorsement                               | ☐    |
| Publish one more package adapter: MCP server middleware (M12)             | This is the post-3 technical milestone with the highest adoption ceiling | ☐    |

### Week 12 (Jul 24 — Aug 6) — Evaluate and plan the next cycle

**Primary deliverable:** Honest assessment of traction; go/no-go decision point.

| Task                                                                                 | Notes                                                                          | Done |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---- |
| Measure all scorecard metrics (see table above)                                      | Check npm downloads, GitHub stars, LinkedIn article stats, arXiv views         | ☐    |
| Write 1-page personal assessment: what's working, what isn't, what to do differently | Honest. Not for anyone else.                                                   | ☐    |
| Decide: continue as side project, go independent, or seek a co-founder               | Based on signals: inbound interest, consulting revenue, design partner quality | ☐    |
| If go-independent: pick a date, calculate runway needed, start saving                | Rule of thumb: 6 months personal expenses before leaving. Start counting now.  | ☐    |
| Update `SPRINT.md` with next 90-day plan                                             |                                                                                | ☐    |

---

## Dependencies and risks

| Risk                                                | Likelihood | Mitigation                                                                        |
| --------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| arXiv submission blocked (no endorser for cs.CR)    | Medium     | Use cs.AI or cs.DC instead; find endorser in Week 4 outreach                      |
| npm/PyPI name `@hki/runtime` already taken          | Low        | Check before Week 1; fallback: `@hki-spec/runtime`                                |
| No response from academic outreach                  | Medium     | Try industry researchers at Google DeepMind, Meta FAIR, Microsoft Research        |
| First consulting prospect disappears after proposal | High       | Always have 3 proposals out at once; pipeline is more important than any one deal |
| LinkedIn article gets no traction                   | Medium     | Repost as a Twitter/X thread; submit to Hacker News Show HN                       |

---

## Resources needed (all free or near-free)

| Item                          | Cost                              | When    |
| ----------------------------- | --------------------------------- | ------- |
| npm org `@hki`                | Free                              | Week 1  |
| PyPI account                  | Free                              | Week 1  |
| `hki.dev` domain              | ~$12/year                         | Week 2  |
| GitHub Pages hosting          | Free                              | Week 2  |
| arXiv submission              | Free (need endorsement if new)    | Week 3  |
| Stripe account for consulting | Free (2.9% + 30¢ per transaction) | Week 10 |

**Total cash needed to execute this plan: ~$12.**

---

## What "success" looks like at Day 90

The goal is not a unicorn. It is **proof of demand** — enough signal to know whether
this can become a livelihood.

**Minimum viable success (go signal):**

- 1 paid consulting engagement, any amount
- 50+ GitHub stars
- 1 design partner with a written case study

**Strong signal (plan the exit):**

- 2+ paid consulting engagements totaling $5,000+
- 200+ GitHub stars
- arXiv paper accepted or under review
- Conference talk accepted or shortlisted
- 500+ npm/PyPI installs per week

If you hit minimum viable success by Day 90, the next sprint is about productizing
the consulting into a repeatable service. If you hit the strong signal, that is the
sprint where you plan your last day at your current job.
