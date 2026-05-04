# Knowledge Full-Scope Execution Plan

> **Status**: Proposed
> **Date**: April 2026
> **Horizon**: 90 days to full-scope beta, 180 days to enterprise rollout readiness
> **Builds on**: KNOWLEDGE-MVP-CUTLINE.md, HERMETIC-VALUE-STREAM-ISOLATION.md, KNOWLEDGE-SELF-SERVICE-DESIGN.md, KNOWLEDGE-VALIDATION-AND-PATTERNS.md, FEATURE-LOCKING-AND-FLAGS.md

---

## 1. Goal

Achieve a full-scope Knowledge Base without collapsing the product under too many simultaneous surfaces.

For this plan, "full scope" means:

1. hermetic single-stream runtime isolation
2. curated D2K workflow from ingest through publish
3. review intelligence and regression evaluation
4. freshness, lineage, and shared-knowledge publication
5. connector-based ingestion for selected enterprise sources
6. explicit admin-plane governance and rollout controls
7. advanced retrieval patterns only after the corpus and evaluation loop are stable

## 2. Program Outcome

### By Day 90

The platform should support a **full-scope beta**:

1. `mvp.curated` workflow is stable in production for pilot streams
2. HVSI strict mode is operationally enforceable
3. review queue includes quality signals, duplicate detection, and contradiction checks
4. test-before-publish exists via shadow retrieval
5. publication lineage and freshness rules are visible
6. at least one connector path is in beta for one enterprise source
7. admin users can inspect rollout health without weakening runtime isolation

### By Day 180

The platform should be ready for broader enterprise rollout:

1. publication fan-out supports shared enterprise knowledge safely
2. multiple connector types are supported
3. eval suites and regression gates are part of release readiness
4. graph and advanced retrieval features are enabled only where they outperform baseline hybrid retrieval

## 3. Team Model

Use clear ownership by workstream:

| Workstream                          | Primary Owner             | Secondary Owner    |
| ----------------------------------- | ------------------------- | ------------------ |
| Product scope and rollout           | Product / PM              | Platform lead      |
| BFF, RBAC, feature presets          | Agentic app backend       | Security           |
| Knowledge API and storage           | Knowledge platform team   | Data platform      |
| Ingestion and connectors            | Pipeline/integration team | Platform ops       |
| Review intelligence and evals       | Applied AI / LLM team     | Knowledge platform |
| Workspace UX                        | Agentic frontend          | Product design     |
| HVSI audits, controls, and runbooks | Security / platform ops   | Backend owners     |

## 4. Operating Rules

1. No feature expands runtime scope beyond one explicit stream.
2. No advanced retrieval work lands without an eval path.
3. No connector reaches beta without stream ownership, lineage, and deletion behavior defined.
4. No governance surface may bypass runtime filters.
5. Presets, not ad hoc flags, control rollout posture.

## 5. Phase Plan

### Phase 0: Week 0

Purpose: lock the program around one sequence.

| Epic              | Primary Owner | Deliverable                                     | Acceptance Criteria                                                 |
| ----------------- | ------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Program alignment | Product / PM  | Approved roadmap and pilot stream list          | MVP cutline, full-scope plan, and pilot streams are signed off      |
| Rollout posture   | Platform lead | `mvp.first` and `mvp.curated` preset usage plan | Org rollout has named presets and a default posture per environment |
| Ownership model   | Platform lead | Workstream owner list                           | Every epic below has a named DRI and success metric                 |

### Phase 1: Days 1-30

Purpose: make the curated workflow production-safe.

| Epic                       | Primary Owner                            | Deliverable                                                       | Acceptance Criteria                                                                   |
| -------------------------- | ---------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| HVSI strict mode           | Agentic app backend + knowledge platform | explicit stream-only runtime path                                 | KB reads and writes require one stream; ambiguous requests fail closed                |
| Stream data cleanup        | Knowledge platform team                  | null-stream backfill and audit gate                               | strict mode blocks rollout if null-stream artifacts remain                            |
| Curated workflow hardening | Agentic frontend + backend               | stable upload, review, publish, and test flow                     | a manager can complete the gold path with no manual backend help                      |
| Preset-driven rollout      | Platform lead                            | pilot orgs on `mvp.curated`                                       | validate and govern only expose quality, test sandbox, eval suites, and review queue  |
| Pilot observability        | Platform ops                             | dashboard and runbook for ingest, publish, and retrieval failures | on-call can identify stream, job, document, and failure class within one workflow run |

### Phase 2: Days 31-60

Purpose: add the intelligence layer that makes curation scalable.

| Epic                                  | Primary Owner                | Deliverable                                    | Acceptance Criteria                                                      |
| ------------------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Duplicate and contradiction detection | Applied AI / LLM team        | pre-review risk signals                        | reviewer sees likely duplicates and contradictions for candidate docs    |
| Shadow retrieval                      | Knowledge platform team      | before/after comparison path                   | reviewers can ask a test question and compare current vs proposed answer |
| Eval suite and regression harness     | Applied AI / LLM team        | curated stream eval suite                      | at least one stream has a maintained golden set with repeatable metrics  |
| Freshness and lineage                 | Pipeline team + frontend     | document version lineage and stale-state rules | published docs show source lineage, supersession, and next review date   |
| Publication model design              | Product + knowledge platform | publication workspace and fan-out design       | one approved design exists for shared knowledge replication under HVSI   |

### Phase 3: Days 61-90

Purpose: move from curated-only beta to full-scope beta.

| Epic                 | Primary Owner                  | Deliverable                                      | Acceptance Criteria                                                                         |
| -------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Connector foundation | Pipeline/integration team      | stream-scoped connector identity and sync runs   | connector records and sync jobs carry explicit stream ownership                             |
| First connector beta | Pipeline/integration team      | one source connector in pilot                    | a pilot stream can sync one approved source with reviewable artifacts and rollback path     |
| Publication fan-out  | Knowledge platform team        | stream-specific replication for shared knowledge | one enterprise source can publish to multiple target streams without shared runtime records |
| Admin-plane controls | Agentic app backend + frontend | admin inventory, migration, and rollout views    | admins can inspect multi-stream status through explicit admin-only queries                  |
| Beta readiness gate  | Product / PM + platform lead   | beta go/no-go review                             | HVSI, curation, evals, connector pilot, and admin visibility all meet phase targets         |

## 6. Phase Exit Gates

### Exit Gate: Day 30

1. `mvp.curated` is live for pilot orgs
2. KB runtime no longer falls back to first-scoped or wildcard `global`
3. strict-mode audits can block rollout
4. pilot managers can ingest, review, publish, and test content in one stream

### Exit Gate: Day 60

1. review queue includes duplicate and contradiction signals
2. shadow retrieval exists for at least one review path
3. a maintained eval suite exists for one pilot stream
4. stale and superseded content are visible in the workspace

### Exit Gate: Day 90

1. one connector path is in controlled beta
2. shared knowledge can publish through stream-specific replication
3. admin-plane rollout and inventory views exist
4. full-scope beta is possible without weakening HVSI

## 7. Metrics

Track these weekly:

| Metric                                     | Target By Day 30     | Target By Day 60     | Target By Day 90 |
| ------------------------------------------ | -------------------- | -------------------- | ---------------- |
| Gold-path completion rate                  | > 80%                | > 90%                | > 90%            |
| Null-stream artifacts in strict orgs       | 0                    | 0                    | 0                |
| Pending-review leakage in normal retrieval | 0                    | 0                    | 0                |
| Review turnaround median                   | < 1 business day     | < 4 hours            | < 4 hours        |
| Eval suite faithfulness                    | baseline established | > 0.85               | > 0.90           |
| Connector pilot successful sync rate       | not applicable       | baseline established | > 95%            |
| Shared publication fan-out success         | not applicable       | design only          | > 95% in pilot   |

## 8. Beyond Day 90

These items should not block full-scope beta, but they are required for full-scope enterprise maturity:

| Wave         | Focus                                                                        | Exit Condition                                                                       |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Days 91-120  | graph exploration and community summaries                                    | graph features prove incremental value over baseline hybrid retrieval                |
| Days 121-150 | adaptive retrieval, CRAG, and reranking policy                               | advanced retrieval improves eval metrics without unacceptable latency or cost        |
| Days 151-180 | additional connectors, broader publication rollout, release readiness gating | multiple enterprise streams can run on the platform under the same operational model |

## 9. Risks

| Risk                                                   | Why It Matters                                 | Mitigation                                                                         |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| HVSI remains transitional                              | every later feature becomes harder and riskier | finish stream-model cleanup before connector expansion                             |
| Evaluation lags behind feature work                    | retrieval changes become untestable            | require eval coverage before advanced retrieval rollout                            |
| Connector work lands before lineage and deletion rules | stale or unsafe content accumulates            | block connector beta until publication and rollback semantics exist                |
| Review UX becomes overloaded                           | managers stop curating content                 | keep reviewer surfaces narrow and prioritize triage clarity over dashboard breadth |
| Admin surfaces reuse runtime queries                   | cross-stream bleed risk increases              | force separate admin-plane endpoints and audit them independently                  |

## 10. Practical Sequencing Rule

The order is fixed:

1. isolation
2. curated workflow
3. evaluation
4. publication
5. connectors
6. admin-plane governance
7. advanced retrieval

If a team wants to skip ahead, the burden of proof is on that team to show it does not weaken the earlier layers.
