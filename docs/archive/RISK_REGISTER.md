# AI Platform - Risk Register & Mitigation Strategies

> Historical note: this risk register is preserved as a point-in-time snapshot and is not the live operational source of truth.

**Last Updated**: April 4, 2026
**Review Frequency**: Weekly during sprints

---

## 🔴 Critical Risks (P0)

### ~~Risk 1: WebSocket Authentication Vulnerability~~ ✅ RESOLVED

**Resolution**: WebSocket authentication was implemented in `server/websocket.ts`.
The upgrade handler validates the session cookie via JWT, looks up the user,
and verifies conversation ownership before allowing the connection. Connections
without a valid session are rejected with 401/403. Rate limiting (10 connections
per conversation) and heartbeat-based dead connection cleanup are also in place.

**Status**: ✅ Resolved

**Attack Vector**:

```javascript
// Any user can connect to any conversation
const ws = new WebSocket(
  "wss://agentic-bff/ws?conversationId=someone-elses-conv-123",
);
// No session check → connection succeeds
```

**Business Impact**:

- Data breach (conversation privacy violated)
- Compliance violation (PII exposure)
- Reputational damage
- Potential regulatory fines

**Mitigation Strategy**:

1. **Immediate** (this week):
   - Document vulnerability in security register
   - Add monitoring for suspicious WebSocket patterns
   - Consider temporary feature flag to disable WebSocket if needed

2. **Short-term** (Sprint 1 Day 1-2):
   - Implement session validation (detailed in [SPRINT_1_ACTION_ITEMS.md](./SPRINT_1_ACTION_ITEMS.md))
   - Add ownership verification
   - Deploy to production ASAP

3. **Long-term** (Sprint 2):
   - Add audit logging for all WebSocket connections
   - Implement anomaly detection (multiple connections from different IPs)
   - Security penetration testing

**Status**: 🔴 Open
**Owner**: Backend Team
**Due**: Sprint 1 Day 2

---

### ~~Risk 2: Unstructured Logging = Blind Production~~ ✅ RESOLVED

**Current State**: ~~Mix of console.log, print(), basic logging~~ All structured JSON logging
**Likelihood**: ~~Guaranteed~~ Resolved
**Impact**: ~~High~~ Resolved

**Scenario**:

```
[Production Incident]
User: "Chat isn't working!"
Engineer: *opens logs*
Logs:
  console.log("starting chat")
  got here
  test
  Error: undefined

Engineer: "Which user? Which request? What time exactly?"
Logs: 🤷 "No correlation info"
```

**Business Impact**:

- Extended downtime (can't debug quickly)
- Poor customer experience
- Increased ops costs (manual investigation)
- SLA violations

**Mitigation Strategy**:

1. **Immediate**:
   - Enable verbose logging on production (temporary)
   - Document current logging patterns

2. **Short-term** (Sprint 1 Day 3-5):
   - Implement structured logging (Pino + structlog)
   - Add request ID correlation
   - Deploy incrementally (one service at a time)

3. **Long-term** (Sprint 2-3):
   - Set up log aggregation (GCP Logging/Datadog)
   - Create common query dashboards
   - Train team on log searching

**Status**: ✅ Resolved
**Owner**: DevOps + Backend Team
**Due**: Sprint 1 Day 5

**Resolution**: All 48 `console.log/warn/error` calls in the BFF server were
migrated to Pino structured JSON logging via `createLogger()`. Python services
already used structlog. Request ID correlation is in place across all services.

---

## 🟠 High Risks (P1)

### ~~Risk 3: No E2E Tests = Production Gambling~~ ✅ RESOLVED

**Resolution**: Comprehensive test suite created with 271 passing tests (0 failures).
Coverage includes 38 orchestrator E2E tests (chat flows, guardrails, error handling),
12 BFF tRPC integration tests, and full unit test coverage for agent loop, LLM client,
memory, prompt builder, guardrails, and API routes. All pre-existing test failures (20)
were diagnosed and fixed.

**Current State**: ~~3 unit tests total, zero E2E coverage~~ 271 tests, 0 failures
**Likelihood**: ~~High~~ Low (comprehensive test coverage)
**Impact**: ~~High~~ Low (regressions caught before deploy)

**Recent Example** (hypothetical):

```
Deploy: "Added new feature to chat UI"
Result: Login button broken (different code path)
Detection: User reports next morning
Rollback: 2 hours downtime
Root Cause: No E2E test for login flow
```

**Business Impact**:

- Frequent production incidents
- Loss of user trust
- Expensive rollbacks
- Slowed development velocity (fear of deploying)

**Mitigation Strategy**:

1. **Immediate**:
   - Manual QA checklist before each deploy
   - Smoke test script (curl-based)

2. **Short-term** (Sprint 2):
   - Playwright E2E for critical paths
   - CI/CD integration
   - Staging environment tests

3. **Long-term** (Sprint 3-4):
   - Expand to 80% E2E coverage
   - Visual regression testing
   - Load testing

**Status**: ✅ Resolved
**Owner**: QA + Full Team
**Due**: ~~Sprint 2 End~~ Completed Sprint 1

---

### ~~Risk 4: Rate Limiting Absent = DoS Vulnerability~~ ✅ RESOLVED

**Resolution**: Per-user RPM rate limiting implemented in `guardrails.py` via
`check_input()` on every chat request. Uses Redis-backed distributed rate limiting
with in-memory fallback. Configurable via `RATE_LIMIT_RPM` setting. Returns 429
with clear error message when exceeded.

**Current State**: ~~No rate limiting on any endpoint~~ Per-user rate limiting active
**Likelihood**: ~~Medium~~ Low (rate limiting enforced)
**Impact**: ~~High~~ Low (cost attacks blocked)

**Attack Scenarios**:

1. **Accidental DoS**: User's script hits API in loop
2. **Credential Stuffing**: Attacker tries 10,000 passwords
3. **Cost Attack**: Malicious user sends 10,000 LLM requests ($$$$)

**Financial Impact**:

```
Scenario: Malicious user sends 10,000 chat messages
LLM Cost: ~$0.03 per request × 10,000 = $300
Orchestrator cost: 4 instances × $0.10/hr × 24hrs = $10
Total: $310 in one day from one user
```

**Mitigation Strategy**:

1. **Immediate**:
   - Monitor usage patterns
   - Set up cost alerts in GCP ($500/day threshold)

2. **Short-term** (Sprint 1 Day 7-8):
   - Implement express-rate-limit
   - Per-user and per-IP limits
   - Graceful error messages

3. **Long-term** (Sprint 3):
   - Advanced rate limiting (Redis-backed)
   - Per-endpoint custom limits
   - User tier-based limits (free vs paid)

**Status**: ✅ Resolved
**Owner**: Backend Team
**Due**: ~~Sprint 1 Day 8~~ Completed Sprint 1

---

### Risk 5: Foreign Key Bug = Data Integrity Issues

**Current State**: Drizzle ORM v0.31.x bug, using manual FK constraints
**Likelihood**: Low (workaround in place)
**Impact**: Medium (data consistency issues if workaround fails)

**Technical Debt**:

```sql
-- Manual FK management (fragile)
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_conversation
  FOREIGN KEY (conversation_id) REFERENCES conversations(id);

-- If migrations fail, FKs might be missing
-- Orphaned messages possible
```

**Business Impact**:

- Data inconsistencies
- Harder to debug issues
- Tech debt buildup
- Migration complexity

**Mitigation Strategy**:

1. **Immediate**:
   - Document workaround in README
   - Add FK validation tests

2. **Short-term** (ongoing):
   - Monitor Drizzle GitHub issues for fix
   - Test each new Drizzle version

3. **Long-term** (when upstream fixed):
   - Upgrade Drizzle
   - Remove manual FK scripts
   - Validate data integrity post-migration

**Status**: 🟢 Mitigated (workaround stable)
**Owner**: Backend Team
**Due**: Upstream dependent

---

### Risk 6: Mock Tools in Production = Limited Functionality

**Current State**: Orchestrator uses mock product search, WMS, pricing APIs
**Likelihood**: Guaranteed (current state)
**Impact**: Medium (platform works but not with real data)

**User Impact**:

```
User: "What's the price of Kirkland toilet paper?"
Agent: *calls mock pricing tool*
Response: "$19.99" (fake data from mock)
User: "That's wrong, it's $24.99 in store"
Trust: Lost
```

**Business Impact**:

- Users don't trust responses
- Platform seen as "demo only"
- Can't launch to real users
- Delays revenue

**Mitigation Strategy**:

1. **Immediate**:
   - Clearly label platform as "Beta" in UI
   - Add disclaimer about mock data
   - Track which responses used mock tools

2. **Short-term** (Sprint 4):
   - Coordinate with backend API team for access
   - Implement real integrations one-by-one
   - Fall back to mocks gracefully if API down

3. **Long-term** (Post-Sprint 4):
   - Remove all mocks
   - Real-time data only
   - SLA monitoring on backend APIs

**Status**: 🟡 Accepted Risk (Beta phase)
**Owner**: Backend + Integration Team
**Due**: Sprint 4

---

## 🟡 Medium Risks (P2)

### Risk 7: No Staging Environment

**Current State**: Only production and local docker-compose
**Likelihood**: High (every deploy is risky)
**Impact**: Medium (limited blast radius with Cloud Run rollback)

**Mitigation**:

- Use Cloud Run revisions (rollback in 30s)
- Canary deployments (10% traffic to new revision)
- Comprehensive local testing before deploy

**Status**: 🟢 Accepted (Cloud Run mitigates)
**Owner**: DevOps

---

### ~~Risk 8: LiteLLM Gateway Single Point of Failure~~ ✅ RESOLVED

**Resolution**: Circuit breaker pattern implemented in `LLMClient` using
the shared `CircuitBreaker` class (5 consecutive failures → trip, 30s
recovery). When the gateway circuit trips, requests automatically fall back
to direct Vertex AI calls via `litellm.acompletion()` + ADC — zero downtime
for end users. Circuit breaker state tracked per-client with structured
logging on state transitions.

**Current State**: ~~All LLM calls go through LiteLLM, no fallback~~ Circuit breaker + direct Vertex AI fallback
**Likelihood**: ~~Low~~ Resolved
**Impact**: ~~High~~ Low (automatic fallback)

**Mitigation**:

- ~~Circuit breaker pattern (detect failures, stop sending)~~ ✅ Implemented
- ~~Fallback to direct Vertex AI calls~~ ✅ Implemented
- Health monitoring with alerts

**Status**: ✅ Resolved
**Owner**: Backend Team

---

### Risk 9: No Multi-Tenancy = Hard to Add Later

**Current State**: Single-org architecture
**Likelihood**: N/A (design choice)
**Impact**: High (expensive refactor if needed later)

**Future Scenario**:

```
Stakeholder: "We want to white-label this for partners"
Engineer: "That will take 3 months to add tenantId everywhere"
```

**Mitigation**:

- Document single-tenant assumption
- Design with multi-tenant in mind (avoid global state)
- Backlog item to add `tenantId` when needed

**Status**: 🟢 Accepted (MVP is single-tenant)
**Owner**: Architecture Team

---

### Risk 10: WCAG Accessibility Gaps

**Current State**: No accessibility audit done
**Likelihood**: High (likely issues exist)
**Impact**: Medium (limits user base, potential legal issue if public sector)

**Mitigation**:

- Sprint 3 accessibility audit
- Fix critical issues (keyboard nav, screen readers)
- Ongoing testing

**Status**: 🟡 Planned (Sprint 3)
**Owner**: Frontend Team

---

## 📊 Risk Tracking Dashboard

| Risk ID | Title                | Severity    | Likelihood | Impact   | Status      | Owner       | Due         |
| ------- | -------------------- | ----------- | ---------- | -------- | ----------- | ----------- | ----------- |
| R1      | WebSocket Auth Vuln  | 🔴 Critical | High       | Critical | ✅ Resolved | Backend     | Sprint 1 D2 |
| R2      | Unstructured Logging | 🔴 Critical | Guaranteed | High     | ✅ Resolved | DevOps      | Sprint 1 D5 |
| R3      | No E2E Tests         | 🟠 High     | High       | High     | ✅ Resolved | QA          | Sprint 1    |
| R4      | No Rate Limiting     | 🟠 High     | Medium     | High     | ✅ Resolved | Backend     | Sprint 1    |
| R5      | FK Bug Workaround    | 🟠 High     | Low        | Medium   | Mitigated   | Backend     | External    |
| R6      | Mock Tools           | 🟠 High     | Guaranteed | Medium   | Accepted    | Integration | Sprint 4    |
| R7      | No Staging Env       | 🟡 Medium   | High       | Medium   | Accepted    | DevOps      | N/A         |
| R8      | LiteLLM SPOF         | 🟡 Medium   | Low        | High     | ✅ Resolved | Backend     | Sprint 1    |
| R9      | No Multi-Tenancy     | 🟡 Medium   | N/A        | High     | Accepted    | Arch        | Backlog     |
| R10     | WCAG Gaps            | 🟡 Medium   | High       | Medium   | Planned     | Frontend    | Sprint 3    |

---

## 🛡️ Risk Monitoring & Review Process

**Weekly Risk Review** (during sprint):

1. Review risk register
2. Update status of active risks
3. Identify new risks
4. Re-prioritize based on sprint progress
5. Update mitigation strategies

**Risk Escalation Criteria**:

- Likelihood increases to "High"
- Impact increases to "Critical"
- Mitigation strategy blocked
- New information changes risk assessment

**Escalation Path**:

1. Scrum Master → Engineering Lead
2. Engineering Lead → Product Owner
3. Product Owner → Executive Sponsor (if business decision needed)

---

## 📝 Risk Response Strategies

### Avoid

- Eliminate the risk entirely
- Example: Don't expose unauthenticated endpoints

### Mitigate

- Reduce likelihood or impact
- Example: Add rate limiting to reduce DoS impact

### Transfer

- Share risk with third party
- Example: Use managed services (Cloud Run) to transfer infrastructure risk

### Accept

- Acknowledge risk, but don't act (low priority)
- Example: Accept no staging env due to cost

---

## 🚨 Incident Response Plan (If Risk Materializes)

**WebSocket Auth Exploited**:

1. Immediately disable WebSocket feature (feature flag)
2. Investigate scope (how many users affected)
3. Notify affected users
4. Deploy fix within 24 hours
5. Security post-mortem

**Production Down Due to DoS**:

1. Enable Cloud Armor WAF rules (emergency)
2. Manually block attacking IPs
3. Deploy rate limiting (emergency patch)
4. Increase Cloud Run instances temporarily
5. Root cause analysis

**Data Integrity Issue (FK bug)**:

1. Stop writes to affected tables
2. Identify orphaned records
3. Run data reconciliation script
4. Validate FKs exist in schema
5. Resume operations

---

**Document Owner**: Engineering Lead
**Review Cycle**: Weekly during sprints, monthly after GA
**Last Reviewed**: March 23, 2026
