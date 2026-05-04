# 🚀 AI Platform Sprint Planning Dashboard

> Historical note: this dashboard is preserved as a planning snapshot. For current contributor guidance, start with `../README.md` and `../FIRST_SETUP.md`.

**Planning Date**: March 23, 2026
**Team**: Innovation Lab AI Platform Team
**Platform Status**: ✅ MVP in Production | ⚠️ Security & Ops Hardening Needed

---

## 📍 Quick Links

- [📋 Full Sprint Plan](./SPRINT_PLANNING.md) - Complete 4-sprint roadmap
- [⚡ Sprint 1 Actions](./SPRINT_1_ACTION_ITEMS.md) - Day-by-day tasks
- [🛡️ Risk Register](./RISK_REGISTER.md) - Threats & mitigations
- [💳 Technical Debt](./TECHNICAL_DEBT.md) - Code quality issues
- [🏗️ Architecture](../../ARCHITECTURE.md) - System design
- [🚢 Deployment Checklist](../DEPLOYMENT_CHECKLIST.md) - Release process

---

## 🎯 Platform Health Scorecard

| Metric                          | Current      | Sprint 1 Target | Sprint 4 Target  | Status      |
| ------------------------------- | ------------ | --------------- | ---------------- | ----------- |
| **Test Coverage**               | 3 unit tests | 30%             | 70%              | 🔴 Critical |
| **E2E Tests**                   | 0            | 0               | 5 critical paths | 🔴 Critical |
| **Security Issues**             | 2 critical   | 0               | 0                | 🔴 Critical |
| **P0 Bugs**                     | 2            | 0               | 0                | 🔴 Critical |
| **Tech Debt Items**             | 10           | 8               | 5                | 🟡 Medium   |
| **Production Uptime**           | 95%          | 99%             | 99.5%            | 🟡 Medium   |
| **Service Response Time (p95)** | ~5s          | ~4s             | <3s              | 🟡 Medium   |
| **Documentation**               | 60%          | 80%             | 95%              | 🟢 Good     |

---

## 🔴 Critical Issues (Fix Immediately)

### 1. WebSocket Authentication Vulnerability

- **Risk**: Any user can access any conversation via WebSocket
- **Impact**: Privacy breach, PII exposure
- **Fix By**: Sprint 1, Day 2
- **Owner**: Backend Team
- **Status**: 🔴 **BLOCKING PRODUCTION LAUNCH**

### 2. No Structured Logging

- **Risk**: Cannot debug production issues
- **Impact**: Extended downtime, poor MTTR
- **Fix By**: Sprint 1, Day 5
- **Owner**: DevOps + Backend
- **Status**: 🟡 **HIGH PRIORITY**

### 3. Zero E2E Test Coverage

- **Risk**: Breaking changes go undetected
- **Impact**: Frequent production incidents
- **Fix By**: Sprint 2, End
- **Owner**: QA + Full Team
- **Status**: 🟡 **HIGH PRIORITY**

---

## 📅 Sprint Overview

### Sprint 1: Security & Observability (2 weeks)

**Goal**: Make platform production-ready from ops perspective
**Velocity**: 9 days engineering

| Priority | Story              | Days | Owner   | Status   |
| -------- | ------------------ | ---- | ------- | -------- |
| P0       | WebSocket auth     | 2    | Backend | 📋 Ready |
| P0       | Structured logging | 4    | DevOps  | 📋 Ready |
| P1       | Health endpoints   | 1    | Backend | 📋 Ready |
| P1       | Rate limiting      | 2    | Backend | 📋 Ready |

**Success Criteria**:

- ✅ Zero P0 security issues
- ✅ All services have structured logs with request IDs
- ✅ All services have health endpoints
- ✅ Rate limiting active on auth + chat

---

### Sprint 2: Test Coverage & Quality (2 weeks)

**Goal**: Build deployment confidence
**Velocity**: 10 days engineering

| Priority | Story              | Days | Owner        | Status     |
| -------- | ------------------ | ---- | ------------ | ---------- |
| P0       | E2E chat flow      | 3    | QA + Backend | 📋 Planned |
| P1       | E2E knowledge test | 2    | QA + Backend | 📋 Planned |
| P1       | Integration tests  | 3    | Backend      | 📋 Planned |
| P1       | Unit test coverage | 2    | All          | 📋 Planned |

**Success Criteria**:

- ✅ 5+ E2E tests running in CI/CD
- ✅ 60%+ code coverage on critical paths
- ✅ Integration tests for service-to-service calls

---

### Sprint 3: Feature Polish & Enterprise (2 weeks)

**Goal**: Complete half-finished features
**Velocity**: 11 days engineering

| Priority | Story                       | Days | Owner              | Status     |
| -------- | --------------------------- | ---- | ------------------ | ---------- |
| P1       | Knowledge ingestion polish  | 3    | Backend + Frontend | 📋 Planned |
| P1       | WCAG accessibility audit    | 3    | Frontend           | 📋 Planned |
| P2       | Agent performance dashboard | 3    | Frontend + Backend | 📋 Planned |
| P2       | Monitoring components       | 2    | Frontend           | 📋 Planned |

**Success Criteria**:

- ✅ All features functional (no stubs)
- ✅ WCAG AA compliant
- ✅ Real-time monitoring visible

---

### Sprint 4: Real Integrations (2 weeks)

**Goal**: Replace mocks with production systems
**Velocity**: 12 days engineering

| Priority | Story               | Days | Owner           | Status     |
| -------- | ------------------- | ---- | --------------- | ---------- |
| P1       | Product search API  | 4    | Backend + Infra | 📋 Planned |
| P2       | WMS integration     | 3    | Backend + Infra | 📋 Planned |
| P2       | Pricing API         | 3    | Backend + Infra | 📋 Planned |
| P1       | Performance testing | 2    | QA + DevOps     | 📋 Planned |

**Success Criteria**:

- ✅ Zero mock tools in production
- ✅ Sub-3s p95 response time
- ✅ Load tested to 100 concurrent users

---

## 🏗️ Platform Architecture (Quick Reference)

```
┌─────────────┐
│   Users     │
│   (IAP)     │
└──────┬──────┘
       │
┌──────▼──────────────────┐
│  Agentic BFF :9001      │  ← React UI + tRPC + Auth
│  (TypeScript + MySQL)   │
└──────┬──────────────────┘
       │
       ├──────────────┬─────────────────┬──────────────┐
       │              │                 │              │
┌──────▼─────┐ ┌──────▼─────┐ ┌────────▼───────┐ ┌───▼────────┐
│Orchestrator│ │ Knowledge  │ │  Ingestion     │ │ Analytics  │
│   :9501    │ │ API :9509  │ │ Pipeline :9508 │ │   :9510    │
│            │ │            │ │                │ │            │
│ • ReAct    │ │ • Vector   │ │ • Doc Parser   │ │ • Metrics  │
│ • LLM Call │ │ • Graph    │ │ • Quality Gate │ │ • Events   │
│ • MCP      │ │ • MCP      │ │ • Pub/Sub      │ │            │
└────────────┘ └────────────┘ └────────────────┘ └────────────┘
```

**Tech Stack**:

- **Frontend**: React 19 + Vite + TanStack Query
- **Backend**: Node.js (tRPC) + Python 3.12 (FastAPI)
- **Databases**: MySQL/PostgreSQL + AlloyDB (pgvector) + Neo4j
- **Caching**: Redis
- **LLM Gateway**: LiteLLM → Vertex AI
- **Infrastructure**: GKE + Artifact Registry

---

## 📊 Service Status

| Surface        | Endpoint                                              | Health | Last Check | Notes                       |
| -------------- | ----------------------------------------------------- | ------ | ---------- | --------------------------- |
| **Agentic**    | [Link](https://agentic.cilabs.np.hki.com)       | ✅ Up  | 2026-04-13 | Canonical public entrypoint |
| **AI Gateway** | [Link](https://aigateway.cilabs.np.hki.com/ui/) | ✅ Up  | 2026-04-13 | Gateway dashboard           |

Internal platform services now run on GKE and are verified through `make -C apps/ai-platform test-prod` and `make -C apps/ai-platform gke-status` rather than individual `run.app` URLs.

---

## 🎯 Key Performance Indicators (KPIs)

### Current Performance

- **Chat Response Time (p95)**: ~5 seconds
- **Knowledge Search**: ~800ms
- **Uptime**: 95%
- **Error Rate**: 2-3%

### Sprint 1 Targets

- **Chat Response Time (p95)**: <4 seconds
- **Knowledge Search**: <600ms
- **Uptime**: 99%
- **Error Rate**: <1%

### Sprint 4 Targets

- **Chat Response Time (p95)**: <3 seconds
- **Knowledge Search**: <500ms
- **Uptime**: 99.5%
- **Error Rate**: <0.5%

---

## 🛡️ Top Risks

| Risk               | Severity    | Mitigation   | Owner       |
| ------------------ | ----------- | ------------ | ----------- |
| WebSocket auth gap | 🔴 Critical | Sprint 1 fix | Backend     |
| No structured logs | 🔴 Critical | Sprint 1 fix | DevOps      |
| No E2E tests       | 🟠 High     | Sprint 2     | QA          |
| No rate limiting   | 🟠 High     | Sprint 1 fix | Backend     |
| Mock tools in prod | 🟡 Medium   | Sprint 4     | Integration |

[Full Risk Register →](./RISK_REGISTER.md)

---

## 💳 Technical Debt Summary

**Total Items**: 10
**High Interest**: 2 items (8 days to fix)
**Medium Interest**: 4 items (28 days to fix)
**Low Interest**: 4 items (10 days to fix)

**Top 3 to Address**:

1. **Console logging** (TD-2) - Sprint 1 ✅
2. **Foreign key workaround** (TD-1) - Waiting on upstream
3. **Mock tools** (TD-4) - Sprint 4

[Full Debt Register →](./TECHNICAL_DEBT.md)

---

## 📋 Sprint 1 Checklist (Next 2 Weeks)

**Week 1**:

- [ ] Day 1-2: Implement WebSocket authentication
- [ ] Day 3-5: Deploy structured logging (all services)
- [ ] Day 6: Add health endpoints

**Week 2**:

- [ ] Day 7-8: Implement rate limiting
- [ ] Day 9: Integration testing
- [ ] Day 10: Sprint review + retrospective

**Definition of Done**:

- [ ] All P0 issues closed
- [ ] Code reviewed + merged
- [ ] Deployed to production
- [ ] Smoke tested
- [ ] Documentation updated

---

## 🚦 Go/No-Go Criteria (Before Broader Launch)

### Must Have (Blockers)

- ✅ WebSocket auth implemented
- ✅ Structured logging in place
- ✅ E2E tests passing (5+ critical paths)
- ✅ Zero critical security issues
- ✅ Rate limiting active
- ✅ Health endpoints on all services

### Should Have (Strong Preference)

- ✅ WCAG AA compliant
- ✅ 60%+ test coverage
- ✅ Performance SLAs met (< 3s p95)
- ✅ Real backend integrations (no mocks)

### Nice to Have

- Multi-tenancy support
- Advanced monitoring dashboards
- Load tested to 500+ concurrent users

---

## 📞 Team Contacts

| Role                 | Name | Responsibility                    |
| -------------------- | ---- | --------------------------------- |
| **Engineering Lead** | TBD  | Architecture, technical decisions |
| **Scrum Master**     | TBD  | Sprint facilitation, blockers     |
| **Backend Lead**     | TBD  | Python services, orchestrator     |
| **Frontend Lead**    | TBD  | React UI, TypeScript              |
| **DevOps Lead**      | TBD  | Deployment, observability         |
| **QA Lead**          | TBD  | Testing, quality gates            |
| **Product Owner**    | TBD  | Prioritization, stakeholder mgmt  |

---

## 🗓️ Sprint Ceremonies

**Daily Standup**: 9:30 AM (15 min)

- What did I do yesterday?
- What will I do today?
- Any blockers?

**Sprint Planning**: Week 1, Monday (2 hours)

- Review backlog
- Estimate stories
- Commit to sprint goal

**Sprint Review**: Week 2, Friday (1 hour)

- Demo completed work
- Stakeholder feedback
- Accept/reject stories

**Sprint Retrospective**: Week 2, Friday (45 min)

- What went well?
- What could improve?
- Action items for next sprint

---

## 📈 Success Metrics (End of Sprint 1)

| Metric               | Current | Sprint 1 Goal | How to Measure                  |
| -------------------- | ------- | ------------- | ------------------------------- |
| **P0 Issues**        | 2       | 0             | Jira "Critical" count           |
| **Test Coverage**    | 3 tests | 30%           | `pnpm test --coverage`          |
| **Structured Logs**  | 0%      | 100%          | All services use Pino/structlog |
| **Health Endpoints** | 50%     | 100%          | All return 200 status           |
| **Rate Limits**      | None    | Active        | 429 on limit exceeded           |
| **Security Scan**    | Not run | Pass          | No critical findings            |

---

## 🎓 Learning Resources

**For New Team Members**:

1. Read [ARCHITECTURE.md](../../ARCHITECTURE.md) - System overview
2. Read [NAVIGATION_GUIDE.md](./NAVIGATION_GUIDE.md) - Codebase tour
3. Run `make dev` - Start all services locally
4. Review [agentic/docs/ENTERPRISE-EVALUATION.md](../../agentic/docs/ENTERPRISE-EVALUATION.md)

**Technical Deep Dives**:

- [Knowledge Self-Service Design](../../agentic/docs/KNOWLEDGE-SELF-SERVICE-DESIGN.md)
- [Knowledge Validation Workflow](../../agentic/docs/KNOWLEDGE-VALIDATION-AND-PATTERNS.md)
- [AI Gateway Integration](../AI_GATEWAY_INTEGRATION.md)

---

## ✅ Next Actions (This Week)

**Immediate**:

1. [ ] Share sprint plan with stakeholders (today)
2. [ ] Schedule sprint 1 planning meeting (this week)
3. [ ] Set up Jira/Linear board (today)
4. [ ] Confirm team availability (today)

**Before Sprint 1 Starts**: 5. [ ] All dev environments working 6. [ ] All team members have GCP access 7. [ ] Sprint 1 stories have acceptance criteria 8. [ ] Assign story owners 9. [ ] Set up CI/CD for tests

**Sprint 1 Day 1**: 10. [ ] Sprint kickoff meeting 11. [ ] Start WebSocket auth implementation (pair programming) 12. [ ] Set up daily standup recurring invite

---

**Last Updated**: March 23, 2026
**Next Review**: End of Sprint 1
**Document Owner**: Engineering Lead

---

## 💡 Quick Reference Commands

```bash
# Local development
make dev                    # Start all services
make status                 # Check service health
make test                   # Run all tests

# Database
pnpm db:push               # Apply schema changes
pnpm db:studio             # Visual DB explorer

# Deployment
./deploy.sh                # Build & push container
cd tf/ && terraform apply  # Deploy infrastructure

# Health checks
curl http://localhost:9001/health  # Agentic BFF
curl http://localhost:9501/health  # Orchestrator
curl http://localhost:9509/health  # Knowledge API
curl http://localhost:9508/health  # Ingestion
```

---

## 📊 Sprint Burndown (Update Daily)

_Sprint 1 - Week 1_

| Day | Stories Remaining | Tasks Completed    | Blockers |
| --- | ----------------- | ------------------ | -------- |
| Mon | 4                 | 0                  | None     |
| Tue | 4                 | WebSocket auth 50% | None     |
| Wed | 3                 | WebSocket auth ✅  | None     |
| Thu | 3                 | Logging 30%        | None     |
| Fri | 2                 | Logging 70%        | None     |

_(Template - fill in during sprint)_

---

**🚀 Let's ship it!**
