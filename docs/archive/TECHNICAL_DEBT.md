# AI Platform - Technical Debt Register

> Historical note: this debt register is archived for context and may not reflect the current post-MVP state.

**Last Updated**: April 4, 2026
**Purpose**: Track technical debt items, estimate impact, prioritize paydown

---

## 🎯 Technical Debt Definition

**Technical Debt** = shortcuts taken during development that make future changes more difficult or risky.

**Categories**:

- **Code Debt**: Poor code quality, duplication, complexity
- **Architecture Debt**: Design decisions that don't scale
- **Test Debt**: Missing or inadequate test coverage
- **Documentation Debt**: Missing or outdated docs
- **Infrastructure Debt**: Brittle deployment, manual processes

---

## 📊 Debt Inventory

### 🔴 High Interest (Pay Down Soon)

#### TD-1: Foreign Key Manual Management

**Category**: Code + Infrastructure Debt
**Location**: `agentic/drizzle/`, Makefile
**Accrued**: February 2026 (Drizzle v0.31.x bug workaround)

**The Debt**:

```typescript
// In schema.ts - FKs commented out
export const messages = mysqlTable('messages', {
  conversationId: varchar('conversation_id', { length: 255 })
    // .references(() => conversations.id)  ← Commented out due to bug
});

// In Makefile - manual FK creation
db-add-fk:
	mysql ... -e "ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation ..."
```

**Why It's Debt**:

- Fragile (migration might forget to add FKs)
- Inconsistent (some environments might miss FKs)
- Error-prone (manual SQL scripts)

**Consequences**:

- Orphaned records possible (messages without conversations)
- Data integrity issues hard to detect
- New developers confused by commented-out code

**Paydown Plan**:

1. Monitor Drizzle GitHub for fix (https://github.com/drizzle-team/drizzle-orm/issues/...)
2. Test new Drizzle versions in dev
3. When fixed: uncomment FKs, remove Makefile scripts
4. Validate existing data integrity

**Interest Rate**: Medium (stable workaround, but ongoing risk)
**Paydown Effort**: 1 day (when upstream fixed)
**Blocker**: Upstream Drizzle fix
**Owner**: Backend Team

---

#### TD-2: ~~Console.log Instead of Structured Logging~~ ✅ RESOLVED

**Category**: Code + Observability Debt
**Location**: `agentic/server/**/*.ts`, all Python services
**Accrued**: Initial development (Q4 2025)
**Resolved**: April 3, 2026

**Resolution**: All 48 `console.log/warn/error` calls in the BFF server
migrated to Pino structured JSON logging via `createLogger()`. Files
updated: `env.ts`, `sdk.ts`, `oauth.ts`, `static.ts`, `vite.ts`,
`migration-runner.ts`, `admin.ts`, `google-drive-auth.ts`,
`google-drive-sync.ts`. Python services already used structlog.

**Status**: ✅ Resolved

---

#### ~~TD-3: Component Stubs Not Implemented~~ ✅ RESOLVED

**Category**: Code Debt
**Location**: `packages/ui/src/components/agentic/`
**Accrued**: December 2025 (UI scaffolding phase)
**Resolved**: April 4, 2026

**Resolution**: All 91 stub components deleted (Option B). Seven empty
directories removed (`onboarding/`, `monitoring/`, `advanced/`, `retail/`,
`feedback/`, `multi-agent/`, `context/`) plus 32 individual stub files from
mixed directories. Barrel exports updated. 17 real implemented components
retained across core, execution, thought-trace, tool-use, evidence,
guardrails, and hitl categories.

**Status**: ✅ Resolved

---

### 🟡 Medium Interest (Plan to Address)

#### TD-4: Mock Tools in Orchestrator

**Category**: Architecture Debt
**Location**: `orchestrator-service/src/domain/tools.py`
**Accrued**: January 2026 (MVP phase)

**The Debt**:

```python
# TODO: Replace with real product search API
def search_products(query: str) -> List[Product]:
    return [Product(id="mock-1", name="Kirkland Toilet Paper", price=19.99)]

# TODO: Replace with real WMS API
def check_inventory(product_id: str) -> int:
    return 42  # Mock quantity
```

**Why It's Debt**:

- Platform gives incorrect information
- Can't be used for real business decisions
- Users lose trust

**Consequences**:

- Limits platform to demo/prototype status
- Blocks production launch
- User expectation mismatch

**Paydown Plan**:

- Sprint 4: Implement real integrations
- Coordinate with backend API team
- Fallback to mocks if API unavailable
- Feature flag for mock vs real mode

**Interest Rate**: Medium (acceptable for beta, blocks GA)
**Paydown Effort**: 8-10 days (depends on API complexity)
**Blocker**: Backend API access + documentation
**Owner**: Integration Team
**Status**: 🟡 Planned (Sprint 4)

---

#### TD-5: No TypeScript Strict Mode

**Category**: Code Debt
**Location**: `agentic/tsconfig.json`
**Accrued**: Initial setup (Q4 2025)

**The Debt**:

```json
{
  "compilerOptions": {
    "strict": false, // ← Should be true
    "noImplicitAny": false
  }
}
```

**Why It's Debt**:

- Type safety gaps
- Runtime errors that could be caught at compile time
- Harder to refactor

**Consequences**:

- Bugs like `undefined is not a function`
- Poor IDE autocomplete
- Tech debt compounds (implicit any spreads)

**Paydown Plan**:

1. Enable `strict: true`
2. Fix all type errors (likely 100-200)
3. Add explicit types to function signatures
4. Refactor any hacks

**Interest Rate**: Medium (adds up over time)
**Paydown Effort**: 3-4 days
**Blocker**: None (can do incrementally)
**Owner**: Frontend Team
**Status**: 🟢 Backlog

---

#### TD-6: No Database Migration Rollback Scripts

**Category**: Infrastructure Debt
**Location**: `agentic/drizzle/migrations/`
**Accrued**: Ongoing

**The Debt**:

- Only have "up" migrations (schema changes)
- No "down" migrations (rollback)

**Why It's Debt**:

- Can't undo a bad migration easily
- Risky deployments

**Consequences**:

- Manual rollback (error-prone)
- Potential data loss
- Longer incident response

**Paydown Plan**:

1. Add `down.sql` for each migration
2. Test rollback in dev
3. Document rollback procedure

**Interest Rate**: Low (migrations rare, usually forward-only)
**Paydown Effort**: 2-3 days
**Blocker**: None
**Owner**: Backend Team
**Status**: 🟢 Backlog

---

### 🟢 Low Interest (Acceptable for Now)

#### TD-7: No Load Testing

**Category**: Test Debt
**Accrued**: MVP phase

**The Debt**: Never tested with >10 concurrent users

**Paydown Plan**: Sprint 4, use k6 or Artillery
**Effort**: 2 days
**Status**: 🟡 Planned

---

#### TD-8: Hardcoded Configuration Values

**Category**: Code Debt
**Location**: Various

**The Debt**:

```typescript
const MAX_RETRIES = 3; // Should be env var
const TIMEOUT_MS = 30000; // Should be configurable
```

**Paydown Plan**: Extract to config files
**Effort**: 1 day
**Status**: 🟢 Backlog

---

#### TD-9: No Dependency Update Strategy

**Category**: Infrastructure Debt

**The Debt**: Dependencies pinned, no regular updates

**Consequences**: Security vulnerabilities, missing features

**Paydown Plan**: Monthly dependency audits, Dependabot
**Effort**: Ongoing
**Status**: 🟢 Backlog

---

#### TD-10: Shared Auth Logic Duplicated

**Category**: Code Debt
**Location**: `agentic/server/_core/auth.ts`, `orchestrator-service/src/core/auth.py`

**The Debt**:

```typescript
// agentic/server
function verifyJWT(token: string) { ... }

# orchestrator-service
def verify_jwt(token: str): ...

# Same logic, different languages
```

**Consequences**: Inconsistent behavior, double maintenance

**Paydown Plan**: Create shared auth spec/library
**Effort**: 2 days
**Status**: 🟢 Low Priority

---

## 📊 Debt Tracking Dashboard

| ID    | Item             | Category       | Interest | Effort  | Blocker    | Status   | Owner       |
| ----- | ---------------- | -------------- | -------- | ------- | ---------- | -------- | ----------- |
| TD-1  | FK Manual Mgmt   | Code + Infra   | Medium   | 1d      | Upstream   | Waiting  | Backend     |
| TD-2  | Console Logging  | Code + Obs     | High     | 4d      | None       | Sprint 1 | DevOps      |
| TD-3  | Component Stubs  | Code           | Low      | 2-5d    | Product    | Backlog  | Frontend    |
| TD-4  | Mock Tools       | Architecture   | Medium   | 10d     | API Access | Sprint 4 | Integration |
| TD-5  | No TS Strict     | Code           | Medium   | 4d      | None       | Backlog  | Frontend    |
| TD-6  | No Rollback      | Infrastructure | Low      | 3d      | None       | Backlog  | Backend     |
| TD-7  | No Load Tests    | Test           | Low      | 2d      | None       | Sprint 4 | QA          |
| TD-8  | Hardcoded Config | Code           | Low      | 1d      | None       | Backlog  | Backend     |
| TD-9  | No Dep Updates   | Infrastructure | Low      | Ongoing | None       | Backlog  | DevOps      |
| TD-10 | Auth Duplication | Code           | Low      | 2d      | None       | Backlog  | Backend     |

---

## 💰 Interest Calculation

**Interest Rate** = Cost of maintaining debt per sprint

| Interest   | Impact per Sprint | Example                                         |
| ---------- | ----------------- | ----------------------------------------------- |
| **High**   | 4+ hours wasted   | Console logging: 4h debugging production issues |
| **Medium** | 1-3 hours wasted  | Manual FK scripts: 1h per migration             |
| **Low**    | <1 hour wasted    | Component stubs: occasional confusion           |

---

## 🎯 Debt Paydown Strategy

### The 20% Rule

**Reserve 20% of each sprint for technical debt paydown**

Example (10-day sprint):

- 8 days: New features
- 2 days: Tech debt

### Prioritization Formula

```
Priority Score = (Interest Rate × 10) + (Risk × 5) - (Effort in days)

High Interest = 10
Medium Interest = 5
Low Interest = 2

High Risk = 10
Medium Risk = 5
Low Risk = 2
```

**Example**:

```
TD-2 (Console Logging):
  Score = (10 × 10) + (10 × 5) - 4 = 100 + 50 - 4 = 146 (HIGH PRIORITY)

TD-10 (Auth Duplication):
  Score = (2 × 10) + (2 × 5) - 2 = 20 + 10 - 2 = 28 (LOW PRIORITY)
```

### When to Pay Down

**Immediate** (this sprint):

- High interest + High risk
- Blocking new features
- Security issue

**Planned** (next 2-3 sprints):

- Medium interest
- Growing complexity
- Team velocity impact

**Backlog** (opportunistic):

- Low interest + Low risk
- Nice to have
- Pay down when touching nearby code

---

## 🔄 Debt Review Process

**Weekly** (during sprint):

- Review debt being paid down
- Track completion
- Add newly discovered debt

**Monthly**:

- Full debt inventory review
- Re-calculate priority scores
- Archive paid-down items
- Trend analysis (debt increasing or decreasing?)

**Quarterly**:

- Architectural debt review
- Major refactoring opportunities
- Technology upgrade planning

---

## 📈 Debt Metrics

### Debt Age

- **Fresh** (<1 month): New shortcuts, recently added
- **Aging** (1-3 months): Starting to hurt
- **Rotten** (>3 months): Significantly impacting velocity

### Current Inventory

- 10 items tracked
- 2 high interest
- 4 medium interest
- 4 low interest
- Total estimated paydown: 32-42 days

### Debt Ratio

```
Debt Ratio = Estimated Paydown Effort / Total Sprint Capacity

Current: 40 days / (team size × sprint length)
Example: 40 days / (5 engineers × 10 days) = 80% debt ratio

Goal: Keep below 50%
```

---

## ✅ Success Stories (Paid Down Debt)

### ~~TD-X: No RBAC~~

**Paid Down**: January 2026
**Before**: Anyone could access admin endpoints
**After**: Role-based permissions enforced
**Benefit**: Production-ready security
**Effort**: 3 days

_(Add more as debt is paid down)_

---

## 🚨 Debt Warning Signs

**Red Flags**:

- New features taking >2x longer to implement
- Fear of refactoring
- Frequent production bugs in same area
- Team says "we should rewrite this"
- New engineers confused by code

**Action**: Schedule refactoring sprint or allocate 40% time to debt

---

**Document Owner**: Engineering Lead
**Review Cycle**: Weekly (sprint), Monthly (full review)
**Last Reviewed**: March 23, 2026
**Next Review**: End of Sprint 1
