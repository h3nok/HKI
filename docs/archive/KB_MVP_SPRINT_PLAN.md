# Knowledge Base Platform — MVP Sprint Plan

> Historical note: this MVP plan predates the current onboarding and rollout docs. Use the active docs in `../` for current workflows.

**Date**: March 24, 2026
**Target Delivery**: April 7, 2026 (2 weeks)
**Sprint Duration**: 2 weeks (10 working days)
**Scope**: Ship an internal multi-tenant Knowledge Base with self-service access, auth & RBAC
**Owner**: Henok G.

---

## Vision

**Internal Multi-Tenant Knowledge Base Platform** — a self-service platform where any HKI business team can spin up their own AI-powered knowledge base, upload documents, search with RAG, and govern quality — all within a multi-tenant architecture that enforces org-level access control, authentication, and role-based authorization.

Think: _"Notion meets Pinecone, purpose-built for HKI — with enterprise-grade tenant isolation."_

---

## Goal

Deliver a **production-ready, multi-tenant Knowledge Base Platform** where internal HKI teams can:

1. **Self-provision** a knowledge workspace scoped to their org/department
2. **Upload** documents (file, text, URL) through a guided wizard
3. **Browse & search** indexed knowledge in a self-service library
4. **Test** retrieval quality and get AI-generated answers with citations
5. **Govern** knowledge quality, freshness, and coverage
6. **Surface gaps** — show what the agent can't answer yet
7. **Manage their team** — invite members, assign RBAC roles, control access

**Key architectural principle**: Multi-tenancy patterns (org isolation, RLS, RBAC) serve as the foundation for securely managing each team's data — not for monetization, but for access control and data governance.

---

## Multi-Tenant Architecture — What's Already Built

Multi-tenancy, access control, and data isolation are **already production-grade**:

| Dimension                 | Status   | Details                                                              |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| **Tenant Isolation**      | ✅ 95%   | 4-layer defense: API (JWT `org_id`), AlloyDB (RLS), App-level, Neo4j |
| **Authentication**        | ✅ Done  | Google OAuth, org auto-derived from `hd` claim via `deriveOrgId()`   |
| **Row-Level Security**    | ✅ Done  | AlloyDB RLS policy on `documents` table                              |
| **Vector Search Scoping** | ✅ Done  | All queries include `WHERE org_id = $org_id`                         |
| **RBAC**                  | ✅ Done  | admin → manager → operator → viewer roles in schema                  |
| **Per-Org Analytics**     | 🟡 50%   | Events tagged with `org_id`, BigQuery writes scoped                  |
| **Team Invites**          | ✅ Done  | Email + code workflow, role assignment, expiry tracking              |
| **Value Stream Admin**    | ✅ Done  | Per-stream: system prompt, retrieval strategy, tools, guardrails     |
| **Concurrency Limits**    | 🟡 Basic | `CONCURRENCY_MAX_PER_ORG = 5` in pipeline (not exposed in UI)        |

### What's NOT built yet (Post-MVP)

| Dimension                            | Status     | Sprint   |
| ------------------------------------ | ---------- | -------- |
| Document & storage quotas per org    | ❌ Missing | Post-MVP |
| Org admin settings dashboard         | ❌ Missing | Post-MVP |
| Per-org usage analytics dashboard    | ❌ Missing | Post-MVP |
| Advanced rate limiting per org       | ❌ Missing | Post-MVP |
| Audit log for admin actions          | ❌ Missing | Post-MVP |
| Additional SSO providers (SAML/OIDC) | ❌ Missing | Post-MVP |

> **MVP Strategy**: Ship the self-service experience for **Google Workspace-authenticated HKI teams**. Multi-tenancy enforces org-level data isolation, auth, and RBAC. Quotas, admin dashboards, and additional SSO come in later sprints.

---

## Current State

| Component                    | Complete | Ship-Ready?   | Tenant-Isolated?    |
| ---------------------------- | -------- | ------------- | ------------------- |
| Knowledge API (MCP + REST)   | 95%      | ✅ Yes        | ✅ Org-scoped       |
| Ingestion Pipeline (8-stage) | 85%      | ✅ Yes        | ✅ Org-scoped       |
| Ingest Wizard UI (5 phases)  | 80%      | 🟡 Close      | ✅ Org-scoped       |
| Library / Browse             | 90%      | ✅ Yes        | ✅ Org-scoped       |
| Test Tab                     | 95%      | ✅ Yes        | ✅ Org-scoped       |
| Governance Tab               | 60%      | 🟡 Needs work | ✅ Org-scoped       |
| Gaps Tab                     | 85%      | ✅ Yes        | ✅ Org-scoped       |
| Team Tab                     | 90%      | ✅ Yes        | ✅ Invite + RBAC    |
| Sources / Connectors         | 30%      | ❌ Defer      | —                   |
| Auth & RBAC                  | 95%      | ✅ Yes        | ✅ 4-layer defense  |
| Data Isolation (RLS + App)   | 95%      | ✅ Yes        | ✅ Production-grade |
| Terraform / Infra            | 90%      | ✅ Yes        | —                   |

---

## What's IN Scope (MVP)

**Self-Service Core:**

- Org auto-provisioning via Google OAuth (existing — just login and go)
- Value stream (department/team) creation by admins
- Team invite flow with role-based access
- Upload documents via file, text paste, or URL
- AI-powered pre-analysis (quality, duplicates, PII)
- Review/approval workflow (manual approval; auto-approve deferred)

**Knowledge Platform:**

- Document library with search and detail views
- Hybrid search (vector + BM25 + keyword) via Knowledge API
- RAG test harness with quality evaluation metrics
- Knowledge gap detection from agent logs
- Governance dashboard (quality, freshness, coverage metrics)

**Infrastructure:**

- Production deployment (Cloud Run + AlloyDB + GCS)
- Multi-tenant data isolation (RLS + app-level + Neo4j scoping)
- Per-org analytics event tracking

## What's OUT of Scope (Post-MVP)

**Platform Hardening (Sprint 3–4):**

- Document & storage quotas per org (max docs, max GB)
- Org admin dashboard (settings, user management, usage overview)
- Per-org usage analytics & resource tracking
- Admin audit log for access & data changes
- Additional SSO providers (SAML/OIDC) for non-Google orgs

**Advanced Features (Sprint 5+):**

- External connectors (Google Drive, SharePoint, S3 sync)
- Auto-approval rules engine
- Compliance/attestation tracking
- Team gamification scoring & badges
- GraphRAG community detection
- RAPTOR / Adaptive RAG patterns
- Multi-language support
- Per-org rate limiting policies

---

## Sprint Backlog

### Week 1: Core Pipeline + Ingest Flow (Days 1–5)

#### Day 1–2: Review Workflow Backend Hardening

| #   | Task                                                                                                                                                                                                                                     | File(s)                                                              | Size | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ------ |
| 1.1 | **Wire review state transitions** — Add validation for pending→approved→published and pending→rejected flows in review.py. Currently transition logic is commented/incomplete.                                                           | `ingestion-pipeline-service/src/domain/review.py` ~L241              | M    | ☐      |
| 1.2 | **Replace InMemoryReviewStore with AlloyDB-backed store** — Dev fallback is in-memory only. Production needs persistent review records in AlloyDB. Implement `AlloyDBReviewStore` adapter following existing `alloydb_store.py` pattern. | `ingestion-pipeline-service/src/adapters/` (new file)                | M    | ☐      |
| 1.3 | **Connect IngestTab approval buttons to tRPC mutations** — Review phase (phase 3) shows approve/reject UI but doesn't call `reviewDecide` mutation. Wire the existing tRPC procedures.                                                   | `agentic/client/src/pages/knowledge/components/IngestTab.tsx` ~L1669 | S    | ☐      |
| 1.4 | **Add exponential backoff to pipeline job polling** — Currently polls at fixed interval with no retry limit. Add backoff + max attempts (30 polls × 2s = 60s timeout).                                                                   | `agentic/client/src/pages/knowledge/components/IngestTab.tsx`        | S    | ☐      |

#### Day 3: Ingest Wizard Polish

| #   | Task                                                                                                                                                                                                                                                                          | File(s)                                                   | Size | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- | ------ |
| 2.1 | **Fix language detection in pipeline** — Hardcoded to `"en"` at line 889. Add fasttext-based detection or use Gemini for detection. Fallback to "en" on failure.                                                                                                              | `ingestion-pipeline-service/src/domain/pipeline.py` L889  | S    | ☐      |
| 2.2 | **Add connector config validation** — `SourcesTab.tsx` passes empty `config: {}` when creating connectors. Add per-type schema validation (S3 needs bucket/prefix, Drive needs folder ID). Even though connectors are post-MVP, the schema should reject invalid configs now. | `agentic/server/knowledge.ts` (createConnector procedure) | S    | ☐      |
| 2.3 | **Smoke-test full ingest flow e2e** — Upload a real document (PDF, markdown, URL), verify it goes through all 8 pipeline stages, lands in AlloyDB, and is searchable via Knowledge API. Document any failures.                                                                | Manual testing + test script                              | M    | ☐      |

#### Day 4–5: Library, Search, & Test Tab

| #   | Task                                                                                                                                                                                                      | File(s)                                                         | Size | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- | ------ |
| 3.1 | **Expose context shaping options in TestTab UI** — Server supports `shaping_config` (routes.py L63) but TestTab doesn't surface the toggle. Add checkbox for "Enable context shaping" to search settings. | `agentic/client/src/pages/knowledge/components/TestTab.tsx`     | S    | ☐      |
| 3.2 | **Add document count & chunk stats to Library overview** — Wire the `get_stats` MCP tool to the OverviewTab so managers see real numbers (total docs, chunks, avg quality).                               | `agentic/client/src/pages/knowledge/components/OverviewTab.tsx` | S    | ☐      |
| 3.3 | **Add stale doc actions to GapsTab** — Currently flags docs >90 days old but no action buttons. Add "Re-validate", "Archive", and "Delete" actions per stale doc.                                         | `agentic/client/src/pages/knowledge/components/GapsTab.tsx`     | M    | ☐      |
| 3.4 | **Cache Gemini gap analysis results** — GapsTab calls Gemini on every click with no memoization. Cache analysis for 1 hour using tRPC query key invalidation.                                             | `agentic/client/src/pages/knowledge/components/GapsTab.tsx`     | S    | ☐      |

---

### Week 2: Governance, Hardening, & Deployment (Days 6–10)

#### Day 6–7: Governance & Compliance

| #   | Task                                                                                                                                                                                                                                                                        | File(s)                                                              | Size | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ------ |
| 4.1 | **Replace compliance placeholder with real content** — GovernTab renders a "coming soon" stub for compliance. For MVP, show: (a) PII scan summary (counts from existing piiScan tRPC), (b) last scan timestamp, (c) link to re-scan. Full attestation tracking is post-MVP. | `agentic/client/src/pages/knowledge/components/GovernTab.tsx` L58-73 | M    | ☐      |
| 4.2 | **Wire role-based UI differentiation** — TeamTab assigns roles (manager, operator, viewer) but all users see the same UI. Add simple conditional rendering: viewers = read-only, operators = can ingest, managers = full access.                                            | `agentic/client/src/pages/knowledge/components/TeamTab.tsx`          | S    | ☐      |
| 4.3 | **Add invite expiration display** — Team invites have expiry but UI doesn't show it. Display "Expires in X days" badge on pending invites.                                                                                                                                  | `agentic/client/src/pages/knowledge/components/TeamTab.tsx`          | S    | ☐      |

#### Day 8: Infrastructure & Deployment

| #   | Task                                                                                                                                                                      | File(s)                             | Size | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---- | ------ |
| 5.1 | **Verify AlloyDB terraform plan** — Run `terraform plan` for knowledge-api/tf/ to ensure AlloyDB cluster, PSC, and IAM bindings are correct. Fix any drift.               | `knowledge-api/tf/`                 | M    | ☐      |
| 5.2 | **Verify ingestion pipeline terraform** — Ensure Cloud Tasks, Pub/Sub, GCS bucket configs are correct. Check Redis/Memorystore config.                                    | `ingestion-pipeline-service/tf/`    | M    | ☐      |
| 5.3 | **Test docker-compose local stack** — Bring up full stack (postgres, neo4j, redis, pubsub-emulator, mysql, litellm) and verify all services connect. Document any issues. | `deploy/compose/docker-compose.yml` | M    | ☐      |
| 5.4 | **Centralize service URLs in config** — `knowledge.ts` server router uses hardcoded URLs. Move `KNOWLEDGE_PIPELINE_URL` and `VECTOR_STORE_URL` to shared env config.      | `agentic/server/knowledge.ts`       | S    | ☐      |

#### Day 9–10: E2E Testing & Launch Prep

| #   | Task                                                                                                                                                                   | File(s)              | Size | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---- | ------ |
| 6.1 | **E2E test: Upload → Search → Answer** — Full round-trip test: upload document via UI, verify pipeline processing, search via TestTab, validate answer with citations. | Manual + test script | L    | ☐      |
| 6.2 | **E2E test: Knowledge gap flow** — Send queries the agent can't answer, verify they appear in GapsTab, upload a document to fill the gap, verify gap resolves.         | Manual testing       | M    | ☐      |
| 6.3 | **E2E test: Review workflow** — Submit document, verify it enters pending state, approve via UI, verify it becomes searchable. Test reject flow also.                  | Manual testing       | M    | ☐      |
| 6.4 | **E2E test: Multi-tenant isolation** — Login as two different org users, upload docs as Org A, verify invisible to Org B search. Validate RLS enforcement.             | Manual testing       | M    | ☐      |
| 6.5 | **E2E test: Team self-service** — Create value stream, invite team member, verify invited user can access KB, verify viewer can't ingest.                              | Manual testing       | M    | ☐      |
| 6.6 | **Production deployment** — Deploy all 4 services to Cloud Run via CI/CD. Verify health endpoints. Run smoke tests against production URLs.                            | CI/CD pipeline       | L    | ☐      |
| 6.7 | **Update README & user guide** — Update Knowledge API README, update ARCHITECTURE.md with final state, create quick-start guide for first-time team onboarding.        | `docs/`              | M    | ☐      |

---

## Sprint Metrics

| Metric                      | Target                 |
| --------------------------- | ---------------------- |
| **Total tasks**             | 23                     |
| **Small**                   | 10                     |
| **Medium**                  | 11                     |
| **Large**                   | 2                      |
| **Story points (estimate)** | ~38 (S=1, M=2, L=5)    |
| **MVP feature coverage**    | 100% of in-scope items |
| **E2E tests passing**       | 5/5 critical paths     |

---

## Risk Register

| Risk                                      | Impact   | Mitigation                                                                      |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| AlloyDB connectivity issues in production | High     | Test PSC config early (Day 8). Have local postgres fallback for demo.           |
| Ingestion pipeline slow for large docs    | Medium   | Set reasonable file size limits (50MB). Pipeline already has chunking.          |
| Review store migration (memory → AlloyDB) | Medium   | Start Day 1. Keep in-memory as fallback flag.                                   |
| Gemini quota limits during demo           | Low      | Pre-ingest sample corpus. Cache evaluation results.                             |
| Cross-tenant data leak                    | Critical | Already mitigated: 4-layer isolation (RLS, JWT, app, Neo4j). E2E test on Day 9. |

---

## Definition of Done

A task is **done** when:

- [ ] Code is committed and pushed
- [ ] No regressions in existing functionality
- [ ] Works in local docker-compose environment
- [ ] Error states handled (loading, empty, failure)
- [ ] Tested manually with realistic data
- [ ] Org-scoped (no hardcoded org assumptions)

The **MVP is ship-ready** when:

- [ ] All 5 E2E flows pass (upload→search, gap detection, review workflow, tenant isolation, team self-service)
- [ ] All services healthy in production
- [ ] Manager from any HKI team can login, create a value stream, and upload a document — fully self-service
- [ ] Document is searchable within 2 minutes of upload
- [ ] Org A's documents are invisible to Org B (RLS verified)
- [ ] Knowledge quality metrics are displayed in governance tab
- [ ] User guide exists for first-time users

---

## Daily Standup Checkpoints

| Day        | Expected Deliverable                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| **Day 1**  | Review state transitions working, AlloyDB store started                      |
| **Day 2**  | IngestTab approval buttons wired, review store complete                      |
| **Day 3**  | Language detection fixed, full ingest e2e smoke-tested                       |
| **Day 4**  | TestTab context shaping, Library stats wired                                 |
| **Day 5**  | GapsTab actions + caching done — **Week 1 complete**                         |
| **Day 6**  | Compliance section real content, role-based UI                               |
| **Day 7**  | Invite expiry display, governance polish                                     |
| **Day 8**  | Terraform plans verified, docker-compose validated, service URLs centralized |
| **Day 9**  | All 5 E2E tests passing (incl. tenant isolation + team self-service)         |
| **Day 10** | Production deployed, README updated — **KB Platform MVP shipped**            |

---

## Post-MVP Roadmap

### Sprint 3 (Weeks 3–4): Access Control Hardening & Admin

| #    | Feature                               | Effort | Details                                                                                                                                               |
| ---- | ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3.1 | **Document & storage quotas**         | 1 week | Add `quota_documents`, `quota_storage_gb` to org schema. Enforce in pipeline before upload. Return 429 on quota exceeded. Surface in admin dashboard. |
| S3.2 | **Org admin settings page**           | 1 week | `/settings/organization` — org name, domain, team overview, resource usage, quota display. Wire to existing analytics events.                         |
| S3.3 | **Per-org usage analytics dashboard** | 3 days | `GET /api/analytics/org/usage` — doc count, storage used, search volume, API calls. Surface in OverviewTab as "Your Organization" section.            |
| S3.4 | **Admin audit log**                   | 3 days | Log all admin actions (invite, role change, doc delete, settings change) for access accountability. Display in org admin dashboard.                   |

### Sprint 4 (Weeks 5–6): Connectors + Auto-Approval

| #    | Feature                                | Effort | Details                                                                                                              |
| ---- | -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| S4.1 | **Google Drive connector**             | 1 week | OAuth flow exists. Wire sync worker to poll Drive API, detect changes, auto-ingest.                                  |
| S4.2 | **Auto-approval rules engine**         | 3 days | Wire existing `should_auto_approve()` logic to UI toggles. Per-department rules (trusted sources, file types, tags). |
| S4.3 | **SharePoint connector**               | 1 week | SharePoint Graph API integration. Auth via app registration.                                                         |
| S4.4 | **Compliance tab real implementation** | 3 days | Attestation tracking, PII scan history, audit trail viewer. Replace placeholder.                                     |

### Sprint 5+ (Weeks 7+): Scale & Advanced Features

| #    | Feature                            | Effort  | Details                                                                    |
| ---- | ---------------------------------- | ------- | -------------------------------------------------------------------------- |
| S5.1 | **Additional SSO** (SAML/OIDC)     | 2 weeks | Support non-Google orgs via SAML/OIDC federation, org provisioning API     |
| S5.2 | **Per-org rate limiting policies** | 1 week  | Configurable limits per org (docs, searches/day, concurrent pipelines)     |
| S5.3 | **GraphRAG community detection**   | 1 week  | Neo4j-based hierarchical summaries, automatic topic clustering             |
| S5.4 | **Multi-language support**         | 1 week  | Language detection in pipeline, multilingual embeddings, translated search |
| S5.5 | **Team gamification**              | 1 week  | Contribution scoring, badges, leaderboard wiring                           |

### Platform Maturity Milestones

```
MVP (Sprint 1-2)        → Self-service KB for Google Workspace teams
                           Multi-tenant isolation ✅ | Auth & RBAC ✅ | Core features ✅

Hardening (Sprint 3-4)  → Quotas, org admin, connectors
                           Org admin ✅ | Audit log ✅ | Drive/SharePoint ✅

Scale (Sprint 5+)       → Additional SSO, rate limits, advanced RAG
                           SAML/OIDC ✅ | Per-org policies ✅ | GraphRAG ✅
```
