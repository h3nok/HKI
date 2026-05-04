# Sprint 1 - Immediate Action Items

> Historical note: this task breakdown is preserved as an earlier sprint artifact, not the current execution plan.

**Sprint Goal**: Production Security & Observability Hardening
**Duration**: 2 weeks
**Start Date**: TBD

---

## 🔴 Critical Path (Must Complete in Order)

### Day 1-2: WebSocket Authentication

**Owner**: Backend Team
**Files to Modify**:

- `agentic/server/websocket.ts`
- `agentic/server/_core/auth.ts` (add session validation helper)

**Implementation Checklist**:

```typescript
// ✅ Step 1: Create session validation helper
export async function validateSessionFromCookie(
  cookieHeader: string,
): Promise<User | null> {
  // Parse cookie, verify JWT, check expiration
}

// ✅ Step 2: Verify conversation ownership
export async function userOwnsConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  // Query database
}

// ✅ Step 3: Update WebSocket handler
wss.on("connection", async (ws, req) => {
  const session = await validateSessionFromCookie(req.headers.cookie);
  if (!session) {
    ws.close(1008, "Unauthorized");
    return;
  }

  const conversationId = getConversationId(req.url);
  if (!(await userOwnsConversation(session.id, conversationId))) {
    ws.close(1008, "Forbidden");
    return;
  }

  // Continue with authenticated connection
});
```

**Testing**:

- [ ] Test with valid session → connection succeeds
- [ ] Test with no session → 1008 close
- [ ] Test with wrong user's conversation → 1008 close
- [ ] Test token expiration handling

---

### Day 3-5: Structured Logging

#### 3a. Agentic BFF (TypeScript)

**Owner**: Backend Team
**Files to Modify**:

- `agentic/server/_core/logger.ts` (already has Pino, needs enhancement)
- `agentic/server/trpc.ts` (add middleware)
- Replace all `console.log` calls

**Implementation**:

```typescript
// In trpc.ts - add logging middleware
import { randomUUID } from "crypto";

export const loggerMiddleware = t.middleware(
  async ({ path, type, next, ctx }) => {
    const requestId = randomUUID();

    logger.info({
      requestId,
      path,
      type,
      userId: ctx.user?.id,
      event: "trpc_request_start",
    });

    const start = Date.now();

    try {
      const result = await next({ ctx: { ...ctx, requestId } });
      logger.info({
        requestId,
        duration: Date.now() - start,
        event: "trpc_request_success",
      });
      return result;
    } catch (error) {
      logger.error({
        requestId,
        duration: Date.now() - start,
        error,
        event: "trpc_request_error",
      });
      throw error;
    }
  },
);

// Apply to all procedures
export const protectedProcedure = t.procedure
  .use(authMiddleware)
  .use(loggerMiddleware);
```

**Find & Replace**:

```bash
# Find all console.log
grep -r "console\.\(log\|info\|warn\|error\)" agentic/server --include="*.ts"

# Replace with logger.<level>
# console.log(...) → logger.info(...)
# console.error(...) → logger.error(...)
```

---

#### 3b. Python Services (Orchestrator, Knowledge API, Ingestion)

**Owner**: Backend Team
**Files to Modify**:

- Each service: `src/core/logging.py`
- Each service: `src/api/app.py` (add middleware)

**Implementation**:

```python
# In src/core/logging.py
import structlog
import logging
import sys

def configure_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
    )

# In src/api/app.py
import uuid
from structlog import contextvars

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    contextvars.bind_contextvars(request_id=request_id)

    logger.info("request_start",
                method=request.method,
                path=request.url.path,
                client_ip=request.client.host)

    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    logger.info("request_end",
                status_code=response.status_code,
                duration_ms=int(duration * 1000))

    response.headers["X-Request-ID"] = request_id
    return response
```

**Find & Replace**:

```bash
# Find all print() statements (should not be in production code)
grep -r "print(" apps/ai-platform/{orchestrator-service,knowledge-api,ingestion-pipeline-service}/src --include="*.py"

# Replace with logger calls
```

**Service-to-Service Correlation**:

```typescript
// When agentic calls orchestrator, propagate request ID
const response = await fetch(`${ORCHESTRATOR_URL}/v1/chat`, {
  headers: {
    "X-Request-ID": ctx.requestId, // Pass through
    Authorization: `Bearer ${token}`,
  },
});
```

---

### Day 6: Health Endpoints

**Owner**: Backend Team
**Files to Create/Modify**:

- `agentic/server/health.ts` (new)
- `orchestrator-service/src/api/health.py` (enhance existing)
- `knowledge-api/src/api/health.py` (add)
- `ingestion-pipeline-service/src/api/health.py` (add)

**Standard Format**:

```typescript
// Agentic BFF
app.get("/health", async (req, res) => {
  const health = {
    service: "agentic-bff",
    version: process.env.npm_package_version,
    status: "healthy",
    timestamp: new Date().toISOString(),
    dependencies: {
      database: await checkDatabase(),
      orchestrator: await checkOrchestrator(),
      redis: await checkRedis(),
    },
  };

  const allHealthy = Object.values(health.dependencies).every(
    (d) => d.status === "healthy",
  );

  res.status(allHealthy ? 200 : 503).json(health);
});

async function checkDatabase() {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "healthy", latency_ms: 0 };
  } catch (error) {
    return { status: "unhealthy", error: error.message };
  }
}
```

**Testing**:

```bash
# All services should return 200
curl http://localhost:9001/health
curl http://localhost:9501/health
curl http://localhost:9509/health
curl http://localhost:9508/health

# Should return JSON with dependencies
```

---

### Day 7-8: Rate Limiting

**Owner**: Backend Team
**Files to Modify**:

- `agentic/server/api.ts`
- `agentic/package.json` (add `express-rate-limit`)

**Implementation**:

```typescript
import rateLimit from "express-rate-limit";

// Auth rate limiting (per IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later",
});

// Chat rate limiting (per user)
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Extract user ID from session
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip for admins
    return req.user?.role === "admin";
  },
  message: "Rate limit exceeded. Max 100 messages per hour.",
});

// Apply limiters
app.use("/api/auth", authLimiter);
app.post("/api/trpc/chat.*", chatLimiter);
```

**Testing**:

```bash
# Test auth rate limit
for i in {1..15}; do
  curl -X POST http://localhost:9001/api/auth/login
done
# Should get 429 after 10 requests

# Test chat rate limit (need to simulate user)
# Use a test script that sends 101 messages as same user
```

**Configuration**:

- [ ] Add `RATE_LIMIT_ENABLED` env var (default: true in prod, false in dev)
- [ ] Add `RATE_LIMIT_WINDOW_MS` (configurable)
- [ ] Add `RATE_LIMIT_MAX_REQUESTS` (configurable)

---

### Day 9-10: Testing & Documentation

#### Testing Checklist

**Unit Tests**:

- [ ] WebSocket auth middleware test
- [ ] Rate limiter behavior test
- [ ] Health endpoint test (DB up/down scenarios)
- [ ] Logger middleware test (request ID propagation)

**Integration Tests**:

- [ ] End-to-end chat with auth (via Playwright or Postman)
- [ ] Health check all services
- [ ] Rate limit enforcement
- [ ] Log correlation across services

**Manual QA**:

- [ ] Login → chat → verify logs have request IDs
- [ ] Try accessing another user's conversation via WebSocket
- [ ] Hit rate limits, verify graceful error
- [ ] Simulate DB down, verify health returns 503

#### Documentation Updates

- [ ] Update `agentic/README.md` with new env vars
- [ ] Add troubleshooting section to READMEs
- [ ] Document rate limit values
- [ ] Add logging guide (how to search logs, common queries)

---

## 📋 Definition of Done

A story is "done" when:

- [x] Code is written and passes local tests
- [x] Unit tests added with >70% coverage of new code
- [x] Integration test passes
- [x] Code reviewed and approved by 1+ team member
- [x] Merged to main branch
- [x] Deployed to staging/dev environment
- [x] Smoke tested in deployed environment
- [x] Documentation updated
- [x] No new security vulnerabilities introduced (verified by scan)

---

## 🚀 Sprint Ceremonies

**Daily Standup** (15 min @ 9:30am):

- What did I do yesterday?
- What will I do today?
- Any blockers?

**Sprint Planning** (2 hours):

- Review stories
- Estimate effort
- Assign owners
- Define acceptance criteria

**Sprint Review** (1 hour, end of week 2):

- Demo completed work
- Stakeholder feedback
- Update backlog

**Sprint Retrospective** (45 min, end of week 2):

- What went well?
- What could improve?
- Action items for next sprint

---

## 🛠️ Development Setup Checklist

Before starting sprint, ensure:

- [ ] All services running locally (`make dev` from ai-platform root)
- [ ] Environment variables configured (.env files)
- [ ] Database migrations applied
- [ ] Redis running
- [ ] Access to GCP project for secrets
- [ ] Git branch strategy defined (feature branches from main)
- [ ] CI/CD pipeline tested

---

## 📞 Emergency Contacts

**Blockers**:

- Can't access GCP: Contact DevOps lead
- Database issues: Contact DBA
- OAuth not working: Contact Auth team
- Questions on architecture: Refer to ../../ARCHITECTURE.md

**Escalation Path**:

1. Try to unblock yourself (docs, teammates)
2. Ask in team Slack channel
3. Tag engineering lead
4. Schedule pairing session

---

## ✅ Quick Wins (If Ahead of Schedule)

If you finish early, tackle these:

- [ ] Add `pnpm db:reset` command to Makefile (useful for local dev)
- [ ] Create Postman collection for all API endpoints
- [ ] Write shell script to test all health endpoints
- [ ] Add TypeScript strict mode to agentic (fix type errors)
- [ ] Optimize slow database queries (add indexes)
- [ ] Add request timeout middleware (prevent hanging requests)

---

**Sprint Start**: [DATE]
**Sprint End**: [DATE]
**Team**: [NAMES]
**Sprint Master**: [NAME]
