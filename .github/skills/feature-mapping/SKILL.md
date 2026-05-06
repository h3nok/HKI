---
name: feature-mapping
description: "Use when: mapping product features, feature inventory, capability map, feature map, featre maping, completeness review, adoption readiness, gap analysis, or planning what feature/component to inspect next. Produces evidence-backed maps of UI, API, data, flags, docs, tests, gaps, and next actions."
argument-hint: "feature area, route, package, or 'all features'"
user-invocable: true
---

# Feature Mapping

Use this skill to turn a broad product surface into a practical feature map: what exists, where it lives, how complete it is, what backs it, how it is gated, and what should be checked next.

## When To Use

- The user asks to look at all features, other features, a feature map, a capability map, a product inventory, or a completeness review.
- The user wants to decide what component or feature area to improve next.
- The work needs evidence across UI routes, backend APIs, feature flags, docs, tests, telemetry, and known gaps.
- The request is broad enough that a normal code search would become scattered.

## Core Output

Produce a map that separates facts from judgment. Each mapped feature should include:

- Name and user-facing purpose.
- Entry points: routes, nav items, tabs, commands, APIs, package exports, or service endpoints.
- Implementation files: the primary UI, server, shared types, service, package, and docs paths.
- Data and dependencies: tRPC procedures, REST endpoints, DB tables, service calls, env vars, model/tool dependencies, or external services.
- Access and rollout: role gates, feature flags, tenant/domain gates, environment gates, or launch state.
- Current status using the status taxonomy below.
- Evidence: clickable file links and validation commands when available.
- Gaps: missing data, partial UX, stubbed flows, weak tests, risky coupling, unclear ownership, or production-readiness limits.
- Recommended next action.

Use [the feature map template](./references/feature-map-template.md) when creating or updating a durable document.

## Status Taxonomy

- `shipped`: implemented, reachable, backed by real data, covered by reasonable checks, and documented enough for current users.
- `v1-complete`: useful and internally adoptable, but not yet full production-grade or enterprise-complete.
- `partial`: meaningful implementation exists, but at least one major element is missing or weak.
- `flagged`: implemented but intentionally hidden, gated, or limited by feature flag, role, tenant, domain, or environment.
- `stub`: visible or documented, but mostly placeholder, mock, fake, or disconnected.
- `deprecated`: historical or intentionally removed from active product direction.
- `unknown`: not enough evidence yet. Use this sparingly and name what evidence is missing.

## Procedure

1. Define the scope.
   - If the user gave a surface, use it directly.
   - If the user says "all features," start from product surfaces and navigation instead of every file in the repo.
   - If the scope is huge, split into logical maps such as Admin Control Plane, Knowledge Domains, Chat/Agent Runtime, HKI Framework Packages, Services, Connectors, Governance, and Deployment.

2. Gather evidence.
   - Use fast file and text search first: routes, navigation labels, page directories, feature flags, tRPC routers, service endpoints, docs, tests, package exports, and env gates.
   - Prefer a read-only `Explore` subagent for broad codebase exploration.
   - Read enough source to confirm behavior, not just naming.
   - Treat docs as intent, source as implementation, tests as confidence, and running UI/API checks as current behavior.

3. Map from user journey to implementation.
   - For each feature, identify the user-visible entry point first.
   - Then trace the backing API/data path.
   - Then identify gates, docs, and tests.
   - If any link in that chain is missing, record it as a gap rather than filling it in by assumption.

4. Check product readiness.
   - Mark feature status with the taxonomy above.
   - Call out whether the feature is adoption-ready, demo-ready, framework-ready, or production-observability/enterprise-ready.
   - Avoid overclaiming. A good v1 is not the same thing as GA enterprise completeness.

5. Recommend what to do next.
   - Prefer the highest-leverage fixes: broken routes, stale docs, missing gates, stubbed backend flows, obvious console/runtime errors, missing tests around risky behavior, or unclear feature ownership.
   - Keep recommendations scoped. Do not mix unrelated refactors into the feature map.

6. Validate if edits are made.
   - Run the smallest relevant typecheck/test/lint command.
   - For frontend feature maps, inspect the running page when available and capture browser console warnings when meaningful.
   - If validation is unavailable, state why and name the best next verification command.

## Repo-Specific Discovery Starting Points

Use these as starting points, then verify with current files because paths may change:

- Product UI: `apps/agentic/client/src/pages/`, `apps/agentic/client/src/components/`, `packages/ui/`, `packages/chat/`.
- Admin/control-plane surfaces: `apps/agentic/client/src/pages/admin/`, `docs/ADMIN_CONTROL_PLANE_DASHBOARD_DESIGN.md`.
- Knowledge/domain surfaces: `apps/agentic/client/src/pages/knowledge/`, `apps/agentic/server/knowledge.ts`, `apps/agentic/docs/`.
- Chat/runtime surfaces: `apps/agentic/server/chat.ts`, `orchestrator-service/src/`, `packages/hki-runtime/`, `packages/hki-conformance/`.
- Feature access and rollout: search for `feature`, `featureFlag`, `FeatureFlagKey`, `release.`, `enabled`, `canAccess`, `role`, and `valueStreamId`.
- Tests and confidence: search for `.test.`, `.spec.`, Playwright tests, smoke scripts, `docs/TESTING.md`, and package scripts.

## Evidence Rules

- Use clickable workspace-relative file links in final output when referencing files.
- Do not cite files that were not read or search-confirmed.
- Separate "documented intent" from "implemented behavior."
- Treat stale docs, archived docs, and removed features as historical unless current source still references them.
- Do not reintroduce removed product surfaces unless the current codebase proves they are active.

## Suggested Deliverables

- Quick scan: one concise table plus top risks.
- Deep map: durable markdown doc using the template.
- Implementation follow-up: prioritized todo list grouped by feature area.
- Review mode: findings first, ordered by severity, with tests and residual risk.