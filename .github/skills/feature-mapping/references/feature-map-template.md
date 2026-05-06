# Feature Map Template

Use this template when a feature mapping session should become a durable document.

```markdown
# <Surface> Feature Map

## Status

Short verdict: shipped, v1-complete, partial, flagged, stub, deprecated, or mixed.

## Scope

- Included:
- Excluded:
- Primary users:
- Primary routes or entry points:

## Feature Inventory

| Feature | Purpose | Entry Points | Backing Data/API | Gates | Status | Evidence | Gaps | Next Action |
| ------- | ------- | ------------ | ---------------- | ----- | ------ | -------- | ---- | ----------- |
|         |         |              |                  |       |        |          |      |             |

## User Journeys

| Journey | Current Path | Works Today? | Missing Pieces | Validation |
| ------- | ------------ | ------------ | -------------- | ---------- |
|         |              |              |                |            |

## Data And Control Plane

| Dependency | Used By | Contract | Failure Mode | Observability |
| ---------- | ------- | -------- | ------------ | ------------- |
|            |         |          |              |               |

## Access And Rollout

- Roles:
- Feature flags:
- Tenant/domain gates:
- Environment gates:
- Launch limits:

## Quality Bar

- Typecheck/lint:
- Unit tests:
- Integration/service tests:
- Browser/runtime checks:
- Docs:
- Known residual risk:

## Recommendations

1. Highest-leverage fix.
2. Next hardening step.
3. Future enhancement.
```

Keep the table evidence-backed. If a field is unknown, write `unknown` and name the search or validation that would resolve it.
