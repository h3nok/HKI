# AI Platform — Sprint Planning

> Historical note: this roadmap reflects an earlier delivery phase. For current contributor workflows, start with `../README.md`, `../FIRST_SETUP.md`, and `../TESTING.md`.

**Date**: March 23, 2026
**Analysis Scope**: Complete Agentic AI Platform
**Status**: Production MVP (v1.0) - 80% Feature Complete

---

## 🎯 Executive Summary

The AI Platform is an **enterprise-grade multi-service agentic system** currently deployed to GCP Cloud Run. The platform consists of 5 microservices working together to provide AI-powered chat, knowledge management, and document ingestion capabilities.

**Current State**:

- ✅ Core functionality operational in production
- ✅ All services deployed and accessible
- ⚠️ Security gaps need immediate attention (WebSocket auth)
- ⚠️ Observability needs improvement (structured logging)
- ⚠️ Test coverage insufficient for production confidence

**Production URLs**:

- Agentic BFF: https://agentic-bff-54phzop7ua-uw.a.run.app
- Orchestrator: https://orchestrator-service-54phzop7ua-uw.a.run.app
- Knowledge API: https://knowledge-api-54phzop7ua-uw.a.run.app
- Ingestion Pipeline: https://ingestion-pipeline-service-54phzop7ua-uw.a.run.app

---

## 📊 Platform Overview

### Service Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Users / Clients (IAP)                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Agentic BFF (:9001) - TypeScript                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  React UI  │  │  tRPC API    │  │  PostgreSQL/MySQL    │    │
│  │  + Vite    │◄─┤  Auth/RBAC   │  │  (conversation data) │    │
│  └────────────┘  └──────┬───────┘  └──────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────────┐
          ▼               ▼               ▼                   ▼
┌────────────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐
│ Orchestrator   │ │ Knowledge    │ │ Ingestion      │ │ Analytics    │
│ Service :9501  │ │ API :9509    │ │ Pipeline :9508 │ │ Service :9510│
│                │ │              │ │                │ │              │
│ • ReAct Loop   │ │ • Vector DB  │ │ • Doc Parser   │ │ • Events     │
│ • Guardrails   │ │ • Graph DB   │ │ • Chunking     │ │ • Metrics    │
│ • MCP Client   │ │ • MCP Server │ │ • Quality Gates│ │ • Dashboards │
│ • LLM via      │ │ • Hybrid     │ │ • GCS Upload   │ │              │
│   LiteLLM      │ │   Search     │ │ • Pub/Sub      │ │              │
└────────────────┘ └──────────────┘ └────────────────┘ └──────────────┘
         │                 │                 │                  │
         ▼                 ▼                 ▼                  ▼
┌────────────────────────────────────────────────────────────────┐
│           Shared Infrastructure (GCP)                          │
│  • AlloyDB (pgvector)  • Neo4j  • Redis  • GCS  • Pub/Sub     │
└────────────────────────────────────────────────────────────────┘
```

### Technology Stack by Service

| Service                | Language    | Framework              | Database         | Port |
| ---------------------- | ----------- | ---------------------- | ---------------- | ---- |
| **Agentic BFF**        | TypeScript  | React + tRPC + Express | MySQL/PostgreSQL | 9001 |
| **Orchestrator**       | Python 3.12 | FastAPI + LangChain    | Redis (memory)   | 9501 |
| **Knowledge API**      | Python 3.12 | FastAPI + FastMCP      | AlloyDB + Neo4j  | 9509 |
| **Ingestion Pipeline** | Python 3.12 | FastAPI                | GCS + Pub/Sub    | 9508 |
| **Analytics**          | Python 3.12 | FastAPI                | PostgreSQL       | 9510 |

---

## 🔴 Critical Issues (P0 - Must Fix Before Broader Launch)

### 1. WebSocket Authentication Gap

**Service**: Agentic BFF
**Risk**: Critical Security Vulnerability
**Impact**: Unauthorized users can connect to chat WebSocket with just a conversation ID

**Current Behavior**:

```typescript
// server/websocket.ts - NO AUTH CHECK
wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const conversationId = new URL(req.url, "http://localhost").searchParams.get(
    "conversationId",
  );
  // Missing: validate session cookie/token
  // Missing: verify user owns this conversation
});
```

**Required Fix**:

```typescript
wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
  const conversationId = new URL(req.url, "http://localhost").searchParams.get(
    "conversationId",
  );

  // 1. Parse session cookie from req.headers.cookie
  const session = await validateSessionCookie(req);
  if (!session) {
    ws.close(1008, "Unauthorized");
    return;
  }

  // 2. Verify user owns this conversation
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!conversation || conversation.userId !== session.userId) {
    ws.close(1008, "Forbidden");
    return;
  }

  // 3. Continue with authorized connection
  // ...
});
```

**Effort**: 1-2 days
**Owner**: Backend team

---

### 2. Structured Logging Missing

**Service**: All Python services + Agentic BFF
**Risk**: Cannot debug production issues
**Impact**: No correlation IDs, inconsistent log formats, console.log in production

**Current State**:

- Agentic BFF: Mix of `console.log` and Pino logger
- Python services: Mix of `print()` and basic logging module
- No request ID correlation across service boundaries

**Required Changes**:

**Agentic BFF**:

```typescript
// Add tRPC middleware for request IDs
import { randomUUID } from "crypto";

export const loggerMiddleware = t.middleware(
  async ({ path, type, next, ctx }) => {
    const requestId = randomUUID();
    ctx.requestId = requestId;

    logger.info(
      { requestId, path, type, userId: ctx.user?.id },
      "tRPC request start",
    );
    const start = Date.now();

    try {
      return await next({ ctx: { ...ctx, requestId } });
    } finally {
      logger.info(
        { requestId, duration: Date.now() - start },
        "tRPC request end",
      );
    }
  },
);
```

**Python Services**:

```python
# Use structlog consistently
import structlog

logger = structlog.get_logger()

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(request_id=request_id)

    logger.info("request_start", path=request.url.path, method=request.method)
    response = await call_next(request)
    logger.info("request_end", status_code=response.status_code)

    return response
```

**Effort**: 3-4 days across all services
**Owner**: DevOps + Backend teams

---

### 3. No E2E Test Coverage

**Service**: All
**Risk**: Production regressions undetected
**Impact**: Cannot deploy with confidence

**Current State**:

- Agentic BFF: 3 unit tests only
- Python services: Minimal pytest coverage
- No integration tests
- No E2E smoke tests

**Required Tests**:

**Priority 1 - Critical Paths**:

```typescript
// tests/e2e/chat-flow.spec.ts (Playwright)
test("complete chat flow", async ({ page }) => {
  // 1. Login via OAuth
  await page.goto("http://localhost:9001");
  await loginWithGoogle(page);

  // 2. Send message
  await page.fill('[data-testid="chat-input"]', "What products do you have?");
  await page.click('[data-testid="send-button"]');

  // 3. Verify response from orchestrator
  await page.waitForSelector('[data-testid="agent-response"]', {
    timeout: 30000,
  });
  const response = await page.textContent('[data-testid="agent-response"]');
  expect(response).toBeTruthy();

  // 4. Verify thought trace
  const thoughtSteps = await page
    .locator('[data-testid="thought-step"]')
    .count();
  expect(thoughtSteps).toBeGreaterThan(0);
});

test("knowledge ingestion flow", async ({ page }) => {
  await loginAsManager(page);

  // Upload document
  await page.setInputFiles(
    '[data-testid="file-upload"]',
    "test-data/sample.pdf",
  );
  await page.click('[data-testid="validate-button"]');

  // Wait for validation
  await page.waitForSelector('[data-testid="validation-success"]');

  // Approve and ingest
  await page.click('[data-testid="approve-button"]');
  await page.waitForSelector('[data-testid="ingestion-complete"]');
});
```

**Priority 2 - Service Integration**:

```python
# tests/integration/test_orchestrator_to_knowledge.py
async def test_search_tool_execution():
    # 1. Send chat request to orchestrator
    response = await client.post("/v1/chat", json={
        "message": "What is our return policy?",
        "conversation_id": "test-123",
        "user_id": "user-001"
    })

    # 2. Verify orchestrator called knowledge API
    assert response.status_code == 200
    data = response.json()

    # 3. Check tool execution trace
    tool_calls = [step for step in data["trace"] if step["type"] == "tool_call"]
    assert any(tc["tool_name"] == "search_knowledge" for tc in tool_calls)

    # 4. Verify citations returned
    assert len(data["citations"]) > 0
```

**Effort**: 5-6 days
**Owner**: QA + Full team

---

## ⚠️ High Priority Issues (P1 - Needed for Enterprise)

### 4. Rate Limiting Not Implemented

**Service**: Agentic BFF
**Risk**: DoS vulnerability, runaway costs

**Required**:

```typescript
import rateLimit from "express-rate-limit";

// Auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per IP
  message: "Too many authentication attempts",
});
app.use("/api/auth", authLimiter);

// Chat endpoints (per user)
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 messages per user per hour
  keyGenerator: (req) => req.user?.id || req.ip,
});
app.use("/api/chat", chatLimiter);
```

**Effort**: 1-2 days

---

### 5. Health Endpoints Inconsistent

**Service**: All
**Current State**: Some services have `/health`, some don't, format varies

**Required Standard**:

```typescript
// All services
app.get("/health", async (req, res) => {
  const checks = {
    service: "agentic-bff",
    status: "healthy",
    timestamp: new Date().toISOString(),
    dependencies: {
      database: await checkDatabase(),
      orchestrator: await checkOrchestrator(),
      redis: await checkRedis(),
    },
  };

  const allHealthy = Object.values(checks.dependencies).every(
    (d) => d.status === "healthy",
  );
  res.status(allHealthy ? 200 : 503).json(checks);
});
```

**Effort**: 1 day across all services

---

### 6. Mock Tools in Orchestrator Need Real Implementations

**Service**: Orchestrator
**File**: `src/domain/tools.py`

**TODOs Found**:

```python
# Line 29
# TODO: Replace with real product search API or ADK Connector

# Line 68
# TODO: Replace with real WMS API call

# Line 81
# TODO: Replace with real POS/Pricing API call
```

**Required**: Connect to actual HKI backend systems or implement proper mocks for demo

**Effort**: 3-5 days (depends on API availability)
**Blocker**: May need backend API team involvement

---

### 7. Foreign Key Constraint Workaround

**Service**: Agentic BFF
**Issue**: Drizzle ORM v0.31.x has FK bug, currently using manual constraints

**Current Workaround** (in Makefile):

```makefile
db-add-fk:
	mysql ... -e "ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation ..."
```

**Required**: Upgrade Drizzle when bug is fixed, remove manual FK management

**Effort**: 1 day (when upstream fix available)

---

## 🎯 Recommended Sprint Plan (2-Week Sprints)

### **Sprint 1: Security & Observability Hardening**

_Focus: Make platform production-ready from ops perspective_

| Story                  | Priority | Effort | Owner   | Acceptance Criteria                                                                                                               |
| ---------------------- | -------- | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **WebSocket Auth**     | P0       | 2d     | Backend | ✅ Session validation on WS upgrade<br>✅ User ownership check<br>✅ Graceful rejection with 1008 code                            |
| **Structured Logging** | P0       | 4d     | DevOps  | ✅ Request IDs in all services<br>✅ JSON output format<br>✅ Correlation across service calls<br>✅ No console.log in production |
| **Health Endpoints**   | P1       | 1d     | Backend | ✅ Standard format across all services<br>✅ Dependency checks<br>✅ K8s probe compatibility                                      |
| **Rate Limiting**      | P1       | 2d     | Backend | ✅ Per-user limits (100/hr chat)<br>✅ Per-IP limits (10/min auth)<br>✅ Clear error messages                                     |

**Velocity**: 9 days engineering
**Success Criteria**: No P0 security issues, production logs usable for debugging

---

### **Sprint 2: Test Coverage & Quality**

_Focus: Build confidence in deployments_

| Story                  | Priority | Effort | Owner        | Acceptance Criteria                                                                                     |
| ---------------------- | -------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------- |
| **E2E Chat Flow Test** | P0       | 3d     | QA + Backend | ✅ Playwright test: login → chat → response<br>✅ Runs in CI/CD<br>✅ Covers happy path + 2 error cases |
| **E2E Knowledge Test** | P1       | 2d     | QA + Backend | ✅ Upload → validate → ingest → search<br>✅ Verifies end-to-end pipeline                               |
| **Integration Tests**  | P1       | 3d     | Backend      | ✅ Orchestrator → Knowledge API<br>✅ Orchestrator → LiteLLM<br>✅ Agentic → Orchestrator               |
| **Unit Test Coverage** | P1       | 2d     | All          | ✅ 60%+ coverage on critical paths<br>✅ RBAC tests<br>✅ Auth middleware tests                         |

**Velocity**: 10 days engineering
**Success Criteria**: CI/CD pipeline runs E2E tests, 60%+ coverage on critical services

---

### **Sprint 3: Feature Polish & Enterprise Readiness**

_Focus: Complete half-finished features_

| Story                           | Priority | Effort | Owner              | Acceptance Criteria                                                                                        |
| ------------------------------- | -------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Knowledge Ingestion Polish**  | P1       | 3d     | Backend + Frontend | ✅ Error recovery & retry logic<br>✅ Progress indicators<br>✅ Bulk upload UI                             |
| **WCAG Accessibility Audit**    | P1       | 3d     | Frontend           | ✅ Keyboard navigation works<br>✅ ARIA labels on interactive elements<br>✅ axe audit passes on all pages |
| **Agent Performance Dashboard** | P2       | 3d     | Frontend + Backend | ✅ Real-time trace visualization<br>✅ Response time metrics<br>✅ Tool execution stats                    |
| **Monitoring Components**       | P2       | 2d     | Frontend           | ✅ Implement stub components<br>✅ Wire to telemetry data                                                  |

**Velocity**: 11 days engineering
**Success Criteria**: All advertised features functional, WCAG AA compliant

---

### **Sprint 4: Real Integrations & Optimizations**

_Focus: Replace mocks with real systems_

| Story                          | Priority | Effort | Owner           | Acceptance Criteria                                                                                    |
| ------------------------------ | -------- | ------ | --------------- | ------------------------------------------------------------------------------------------------------ |
| **Product Search Integration** | P1       | 4d     | Backend + Infra | ✅ Connect to real product API<br>✅ Replace mock in orchestrator<br>✅ Handle API failures gracefully |
| **WMS Integration**            | P2       | 3d     | Backend + Infra | ✅ Real inventory checks<br>✅ Caching strategy                                                        |
| **Pricing API Integration**    | P2       | 3d     | Backend + Infra | ✅ Real pricing data<br>✅ Member vs non-member pricing                                                |
| **Performance Testing**        | P1       | 2d     | QA + DevOps     | ✅ Load test with k6/Artillery<br>✅ Identify bottlenecks<br>✅ Optimize slow queries                  |

**Velocity**: 12 days engineering
**Success Criteria**: Zero mock tools in production orchestrator, sub-3s p95 response time

---

### **Backlog (Post-Sprint 4)**

**Multi-Tenancy**

- Introduce `tenantId` in all schemas
- Scope queries by tenant
- Tenant isolation testing
- _Effort_: 5-7 days

**Audit Logging**

- Security event tracking (login, permission denied, guardrail violations)
- Compliance reporting (SOC 2 prep)
- _Effort_: 3-4 days

**Advanced RAG Patterns**

- Corrective RAG (CRAG) implementation
- Adaptive RAG based on query complexity
- Self-RAG (reflection + retry)
- _Effort_: 5-8 days (research + implementation)

**Deployment Automation**

- Runbook documentation
- Terraform modules cleanup
- CI/CD pipeline improvements
- _Effort_: 4-5 days

---

## 📈 Quality Metrics & Definition of Done

### Service Health Metrics (Target for Sprint 1)

- ✅ All services return `/health` with 200 status
- ✅ All dependencies checked (DB, Redis, downstream services)
- ✅ Health checks run in CI/CD

### Test Coverage (Target for Sprint 2)

- ✅ Agentic BFF: 60%+ coverage
- ✅ Orchestrator: 70%+ coverage (critical ReAct logic)
- ✅ Knowledge API: 65%+ coverage
- ✅ E2E tests: 5+ critical paths covered

### Security Checklist (Target for Sprint 1-2)

- ✅ No unauthenticated endpoints except `/health`, `/`, public assets
- ✅ WebSocket auth validated
- ✅ Rate limiting active on all mutation endpoints
- ✅ JWT expiration enforced
- ✅ RBAC tested for all roles (viewer, operator, manager, admin)
- ✅ PII guardrails active in orchestrator

### Performance SLAs (Target for Sprint 4)

- P95 chat response time: < 3 seconds
- P99 chat response time: < 5 seconds
- Knowledge search: < 500ms
- Document ingestion: < 10s for 10MB PDF
- WebSocket latency: < 100ms

---

## 🚧 Known Blockers & Dependencies

| Blocker                       | Impact                                             | Mitigation                                      | ETA                |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------- | ------------------ |
| **Drizzle FK Bug**            | Can't use auto-FK, manual migration scripts needed | Monitor upstream issue, use Makefile workaround | Q2 2026 (upstream) |
| **HKI API Access**         | Can't replace mock tools with real data            | Use mock mode with realistic data for demo      | Depends on IT      |
| **Neo4j Production Instance** | Knowledge graph features limited                   | Use AlloyDB-only mode, add Neo4j later          | Q2 2026            |
| **No Staging Environment**    | Can't test deploys before production               | Use local docker-compose as staging proxy       | Sprint 1           |
| **LiteLLM Dependency**        | If gateway down, all LLM calls fail                | Add circuit breaker + fallback                  | Sprint 2           |

---

## 🎓 Documentation Gaps to Address

**Missing Runbooks**:

- [ ] Production deployment procedure (step-by-step)
- [ ] Rollback procedure
- [ ] Incident response guide
- [ ] Troubleshooting common issues
- [ ] Performance tuning guide

**Missing Integration Guides**:

- [ ] How to consume Agentic BFF APIs from other apps
- [ ] How to add new tools to orchestrator
- [ ] How to add new knowledge connectors
- [ ] How to configure new value streams

**Missing Architecture Docs**:

- [ ] Data flow diagrams (request → response path)
- [ ] Security model documentation
- [ ] RBAC permission matrix
- [ ] Error handling patterns

**Effort**: 3-4 days (tech writer + SME review)

---

## 💰 Cost Considerations

**Current Cloud Run Costs** (estimated):

- Agentic BFF: $50-100/month (0-4 instances)
- Orchestrator: $100-200/month (LLM calls via LiteLLM)
- Knowledge API: $30-50/month
- Ingestion Pipeline: $20-30/month
- **Total**: ~$200-380/month at low usage

**Scaling Concerns**:

- LLM API costs scale linearly with usage (biggest variable)
- AlloyDB: $500-1000/month (fixed, shared across platform)
- Redis: $50-100/month
- **Need**: Usage monitoring + budget alerts

**Cost Optimization Opportunities**:

- Semantic caching in LiteLLM (reduce duplicate LLM calls)
- Vector search result caching
- Batch processing for ingestion (reduce Cloud Run time)

---

## ✅ Definition of Ready (Before Starting Sprint)

**Sprint 1**:

- [ ] All P0 stories have acceptance criteria
- [ ] Team capacity confirmed (9 days available)
- [ ] Stakeholder approval on security priorities
- [ ] Dev environments working for all team members

**Sprint 2**:

- [ ] Test infrastructure set up (Playwright, pytest)
- [ ] CI/CD pipeline can run tests
- [ ] QA environment available
- [ ] Test data available

**Sprint 3**:

- [ ] Design reviews complete for dashboards
- [ ] Accessibility expert available for audit
- [ ] Telemetry backend ready

**Sprint 4**:

- [ ] API access confirmed or realistic mocks ready
- [ ] Load testing environment configured
- [ ] Performance baselines established

---

## 📊 Sprint Success Metrics

| Metric                   | Sprint 1 Target | Sprint 2 Target | Sprint 3 Target | Sprint 4 Target |
| ------------------------ | --------------- | --------------- | --------------- | --------------- |
| **P0 Issues Open**       | 0               | 0               | 0               | 0               |
| **Test Coverage**        | 30%             | 60%             | 65%             | 70%             |
| **E2E Tests**            | 0               | 5               | 8               | 10              |
| **Security Issues**      | 0               | 0               | 0               | 0               |
| **Production Incidents** | N/A             | < 2             | < 1             | 0               |
| **WCAG Violations**      | N/A             | N/A             | 0 critical      | 0               |
| **Mock Tools**           | 3               | 3               | 2               | 0               |

---

## 🗣️ Open Questions for Stakeholders

1. **Multi-tenancy**: Is single-org deployment acceptable for MVP or do we need multi-tenant from day 1?
2. **Compliance**: What audit/compliance requirements exist (SOC 2, HIPAA, PCI)?
3. **API Integrations**: When can we get access to real product/WMS/pricing APIs?
4. **Budget**: What's the monthly cloud spend budget for this platform?
5. **Staging Environment**: Can we provision a true staging env or continue with docker-compose?
6. **Launch Timeline**: When is target GA/public launch date?
7. **Performance SLAs**: Are the proposed targets (3s p95) acceptable?
8. **Monitoring**: Preference for monitoring tools (Datadog, New Relic, GCP native)?

---

## 📅 Next Steps

**This Week**:

1. ✅ Share this sprint plan with stakeholders
2. Schedule sprint planning meeting
3. Assign sprint 1 stories to team members
4. Set up Jira/Linear board for tracking
5. Confirm team capacity and availability

**Sprint 1 Kickoff** (Recommended):

- Sprint goal: "Production security & observability hardening"
- Daily standups at 9:30am
- Sprint review + retro at end of week 2
- Pair on WebSocket auth (critical security fix)

---

## 📚 Reference Links

- [Platform Architecture](../../ARCHITECTURE.md)
- [Agentic BFF README](../../agentic/README.md)
- [Orchestrator README](../../orchestrator-service/README.md)
- [Knowledge API README](../../knowledge-api/README.md)
- [Ingestion Pipeline README](../../ingestion-pipeline-service/README.md)
- [Enterprise Evaluation](../../agentic/docs/ENTERPRISE-EVALUATION.md)
- [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md)
- [Deployed URLs](../../deployed-urls.env)

---

**Document Owner**: Engineering Team
**Last Updated**: March 23, 2026
**Next Review**: End of Sprint 1
