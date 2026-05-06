# Admin Control Plane Dashboard Design

## Status

Current status: v1 operational dashboard is usable and visually coherent, but it is not yet a complete enterprise observability product.

The dashboard is feature-complete enough for internal adoption, demos, and framework positioning when the goal is to show the shape of HKI operations: service health, knowledge operations, agent quality, tool performance, cost runway, domain footprint, and recent trace activity. It still needs deeper historical storage, alerting, drilldowns, configurable thresholds, and evidence export before it should be called production-grade observability.

## Purpose

The Admin Control Plane dashboard is the operator home for the Agentic reference runtime. It answers four questions quickly:

1. Is the platform healthy enough to trust right now?
2. Are agents producing good, governed answers?
3. Is the knowledge estate ready for production use?
4. What should operators improve next?

The dashboard should feel like an operating console, not a marketing page. It should be dense, scannable, calm, and action-oriented.

## Primary Users

| User                         | Needs                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Platform operator            | See service health, trace quality, tool behavior, and resource pressure.                        |
| Knowledge steward            | See domain coverage, ingestion health, document/chunk/entity counts, and active jobs.           |
| Security/governance reviewer | See guardrail blocks, trace confidence, domain isolation footprint, and risky pressure signals. |
| Framework evaluator          | Understand whether HKI provides reusable operational primitives for agentic platforms.          |

## Current Route and Entry Points

- Route: `/admin`
- Main implementation: `apps/agentic/client/src/pages/admin/DashboardPage.tsx`
- Forward signal model: `apps/agentic/client/src/pages/admin/dashboardSignals.ts`
- Forward signal visual: `apps/agentic/client/src/pages/admin/components/ForwardSignalsPanel.tsx`
- Chart primitives: `apps/agentic/client/src/pages/admin/DashboardCharts.tsx`

## Current Feature Inventory

### 1. Command Banner

Purpose: Give an immediate operating state for the current environment.

Current capabilities:

- Time-aware greeting.
- Environment indicator from `VITE_ENV` or localhost fallback.
- Service health rollup.
- Manual refresh action for dashboard queries.

Data inputs:

- `trpc.knowledge.serviceHealth`
- `VITE_ENV`
- `VITE_OBSERVABILITY_URL`

### 2. KPI Strip

Purpose: Provide the top-level platform pulse in one row.

Current KPIs:

- Avg Confidence
- Conversations
- Tool Calls
- Guardrails
- Domains
- Operators

Current behavior:

- Confidence, conversations, tool calls, and guardrails open the configured observability destination.
- Domains and operators summarize control-plane configuration.

Data inputs:

- `trpc.governance.stats`
- `trpc.admin.listValueStreams`
- `trpc.admin.listUsers`

### 3. Forward Signals

Purpose: Turn current telemetry into forward-looking operating guidance.

Current visual:

- Compact right-rail radar plot.
- Axes: Launch, Risk, SLO, Cost, Coverage, Leverage.
- Headline chips: Ready, Data, Risk.
- Signal key with live values.

Current derived signals:

| Signal              | Meaning                                                                                   | Source                                 |
| ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| Launch Readiness    | Composite launch score across trust, services, tools, knowledge, latency, and guardrails. | Governance, health, knowledge, traces. |
| Risk Horizon        | Pressure from low confidence, tool errors, failed jobs, guardrails, and low readiness.    | Governance, traces, knowledge.         |
| SLO Burn            | p95 trace latency against target.                                                         | Recent traces.                         |
| Cost Runway         | Projected daily tokens against planning budget.                                           | Resource metrics.                      |
| Knowledge Coverage  | Documents, chunks, entities, relationships, and job reliability.                          | Knowledge operations summary.          |
| Automation Leverage | Tool calls per conversation against target.                                               | Governance stats.                      |

Configurable thresholds currently live in `DASHBOARD_TARGETS`:

- `dailyTokenBudget`
- `latencySloSeconds`
- `healthyToolErrorRate`
- `targetToolCallsPerConversation`
- `targetChunksPerDocument`
- `targetEntitiesPerDocument`

### 4. Knowledge Operations

Purpose: Show indexed knowledge health and ingestion state.

Current capabilities:

- Scope selector for all domains or a selected domain.
- Documents count.
- Chunks count.
- Entities count.
- Pipeline state from active/completed/failed jobs.
- Active pipeline job preview when jobs are running.
- Manage/Open KB action.

Data inputs:

- `trpc.admin.knowledgeOperationsSummary`
- `trpc.admin.listValueStreams`

### 5. Descriptive Analytics Plots

Purpose: Show richer visual explanations, not just numeric tiles.

Current plots:

- Agent Quality: confidence trend with rolling average and 80 percent target.
- Tool Performance: ranked tool calls with success rate and average speed.
- Pipeline Health: seven-day completed, active, and failed ingestion job stack.
- Resource Runway: token runway gauge and daily usage bars.

Implementation notes:

- Uses Recharts inside a local `ResponsivePlot` wrapper that measures the
  container and passes explicit dimensions into each chart.
- Empty states exist for missing telemetry.
- The May 2026 reload path was checked in-browser with no Recharts
  width/height warnings captured.

### 6. Domain Rail

Purpose: Keep domain isolation visible and actionable.

Current capabilities:

- Active domain list.
- Domain icon, name, description, operator count, and live/idle state.
- Add domain action.
- Manage domains action.
- Click-through into a knowledge workspace.

### 7. Trace Stream

Purpose: Show recent agent execution activity.

Current capabilities:

- Recent trace feed.
- Query preview.
- Tool count.
- Latency when present.
- Confidence badge.
- Link to full observability.

## Data Contracts

| Query                              | Dashboard Usage                                 | Refresh Cadence       |
| ---------------------------------- | ----------------------------------------------- | --------------------- |
| `admin.listValueStreams`           | Domains, scope selector, domain rail.           | Manual and page load. |
| `admin.listUsers`                  | Operator count.                                 | Manual and page load. |
| `governance.stats`                 | KPI strip, forward signals.                     | 30 seconds.           |
| `governance.recentTraces`          | trace feed, confidence chart, SLO burn, risk.   | 30 seconds.           |
| `governance.toolStats`             | tool performance chart.                         | 60 seconds.           |
| `governance.resourceMetrics`       | resource runway, cost pressure.                 | 60 seconds.           |
| `knowledge.serviceHealth`          | command banner, launch readiness.               | 30 seconds.           |
| `admin.knowledgeOperationsSummary` | knowledge operations, coverage, pipeline chart. | 60 seconds.           |

## Completeness Assessment

### Complete for v1

- Admin dashboard route exists and composes the major operational surfaces.
- Visual language is standardized through admin card primitives.
- KPI strip gives a quick platform pulse.
- Knowledge operations are scoped and actionable.
- Forward-looking metrics exist and are easy to tune from one derived model file.
- Charts are descriptive and cover confidence, tools, ingestion, and resources.
- Domain visibility and recent trace activity are present.
- TypeScript validation passes.

### Not complete for production observability GA

- Thresholds are hardcoded in code, not tenant/environment configuration.
- Derived metrics are not yet persisted for historical trend comparison.
- There is no alert policy state, acknowledgement, or incident workflow.
- No evidence export for release reviews or conformance packages.
- No per-domain deep drilldown from each chart point.
- No browser RUM or client-side error metrics.
- Automated visual smoke tests are not yet wired for dashboard charts.
- No explicit role-specific dashboard modes for operator, steward, auditor, or evaluator.
- No metric catalog with owner, formula, freshness, and confidence for every metric.

## Recommended Completion Standard

Call the dashboard v1 complete when these are true:

1. `pnpm --dir apps/agentic check` passes.
2. Dashboard route loads without console warnings that indicate broken layout or chart sizing.
3. Empty states are polished for all data panels.
4. All forward signal formulas have documented owners, source queries, thresholds, and failure behavior.
5. Each metric either has a clear action path or is removed.
6. Desktop and narrow viewport screenshots show no clipped labels, overlapping text, or oversized panels.
7. The dashboard can be demoed with no seeded data and with realistic seeded data.

Call it production observability complete only after these additional items:

1. Historical metric snapshots are stored and queried.
2. Alert and incident state is represented.
3. Thresholds are configurable per environment or deployment profile.
4. Each chart supports at least one drilldown path.
5. Evidence export exists for release/conformance review.
6. Dashboard health is covered by automated visual smoke tests.

## Design Principles

1. Show operating truth before decorative richness.
2. Prefer compact, scannable panels over wide hero-style sections.
3. Every metric should answer: so what should the operator do?
4. Keep HKI domain boundaries visible in the dashboard structure.
5. Use derived forward signals sparingly and document their formulas.
6. Keep charts quiet: restrained color, clear axes, compact labels, useful tooltips.
7. Never hide missing data as success. Missing data should render as neutral or incomplete evidence.

## Development Plan

### Phase 1: Stabilize v1

Scope:

- Keep reload and resize warning checks in dashboard visual QA.
- Add a small seeded-data fixture path for dashboard QA.
- Add Playwright smoke coverage for `/admin` with no-data and seeded-data states.
- Document formulas in code comments or adjacent metadata, not only in this document.

Acceptance criteria:

- No layout warnings on reload.
- Desktop screenshot and narrow screenshot are reviewed.
- Empty states and populated states both look intentional.

### Phase 2: Metric Catalog

Scope:

- Move dashboard metric definitions into a typed catalog.
- Add fields for owner, formula, source query, threshold, freshness, and action.
- Keep `dashboardSignals.ts` as the derived metric engine, but drive labels and thresholds from the catalog.

Acceptance criteria:

- Adding a signal requires adding metadata.
- Operators can inspect the metric source and meaning.
- Thresholds are easy to override for demos, staging, and production.

### Phase 3: Drilldowns

Scope:

- Forward signal click targets.
- Chart point drilldowns into traces, tools, jobs, or domains.
- Domain filter propagation across dashboard panels.

Acceptance criteria:

- Every major panel has one next action.
- Clicking a risk or coverage signal opens the relevant operational surface.

### Phase 4: Historical Operations

Scope:

- Persist metric snapshots.
- Add trend comparisons: now, 24h, 7d, 30d.
- Add error budget and SLO burn history.

Acceptance criteria:

- Operators can tell whether the platform is improving or degrading.
- Forward signals use trends, not only current snapshots.

### Phase 5: Evidence and Governance

Scope:

- Export dashboard evidence for release reviews.
- Link forward signals to HKI conformance evidence.
- Add auditor view for guardrails, scope integrity, and cross-domain safety.

Acceptance criteria:

- A release reviewer can export a dashboard evidence bundle.
- HKI claims shown in the UI map to verifiable checks.

## Candidate Future Metrics and Visuals

| Metric or Visual        | Why It Matters                                                     | Suggested Visual                   |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| Error budget burn       | Shows whether latency/error SLOs are being consumed too fast.      | Compact burn gauge plus sparkline. |
| Domain coverage heatmap | Shows which domains lack docs, chunks, entities, or relationships. | Matrix heatmap.                    |
| Retrieval answer trust  | Combines citation coverage, confidence, and correction rate.       | Small scorecard plus trend.        |
| Guardrail policy mix    | Shows which policies block most requests.                          | Ranked horizontal bars.            |
| Tool failure taxonomy   | Shows whether failures are auth, timeout, validation, or upstream. | Stacked bars by category.          |
| Knowledge freshness     | Shows stale or unreviewed content pressure.                        | Age histogram or freshness rail.   |
| Operator workload       | Shows review queue, active jobs, and failed jobs by domain.        | Queue pressure strip.              |
| Cost forecast           | Shows projected token/API spend by day and domain.                 | Runway gauge plus 7-day line.      |
| Agent loop detection    | Flags repeated tool calls or retries.                              | Trace anomaly list.                |
| Release readiness       | Combines conformance, coverage, SLOs, and evidence status.         | Checklist plus radar.              |

## Careful Development Rules

Use these rules when extending the dashboard:

1. Start from the operational question, not the chart type.
2. Define the data contract before building the component.
3. Add empty, loading, error, and stale states with the first implementation.
4. Keep threshold constants near the metric model and document why they exist.
5. Add a local seeded-data story or fixture for every new chart.
6. Validate with TypeScript, editor diagnostics, and browser screenshot review.
7. Avoid full-width sections unless the information truly needs that width.
8. Avoid nested cards inside cards; use keys, rails, dividers, and compact chips instead.
9. Treat forward-looking metrics as advisory unless the formula and source freshness are visible.
10. Do not claim production readiness until alerting, history, and evidence export exist.

## Open Questions

1. Should readiness thresholds be deployment-wide, tenant-specific, or domain-specific?
2. Should dashboard snapshots be stored in the BFF database, analytics service, or external observability store?
3. Which role gets the default view: operator, steward, auditor, or framework evaluator?
4. What is the canonical evidence bundle format for release readiness?
5. Should the dashboard own alert state, or only link to Cloud Monitoring and incident tooling?

## Current Verdict

The dashboard is a strong v1 control-plane feature. It has the right architecture and product direction: concise KPIs, scoped knowledge operations, descriptive plots, forward-looking readiness signals, domain visibility, and trace activity. It is not yet finished as a full observability or release-governance system.

The careful path is to stabilize the v1, formalize the metric catalog, add drilldowns, persist history, and then connect the dashboard to evidence and alerting.
