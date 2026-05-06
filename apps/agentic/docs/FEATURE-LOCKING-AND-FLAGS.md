# Feature Locking and Flags for Agentic

## Purpose

This document defines the recommended state-of-the-art model for feature locking across the Agentic platform.

The goal is to support four separate needs without mixing them together:

1. permission and stream-scoped access
2. release control for unfinished or next-version features
3. debug-only UI and support tooling
4. operational kill switches for risky paths

The central rule is simple:

UI hiding is presentation.
Security, data isolation, admin actions, and expensive operations must still be enforced on the server.

## Current Platform Anchors

The platform already has strong building blocks that should remain the foundation:

1. environment and runtime config in `server/_core/env.ts`
2. authenticated and scoped request context in `server/_core/trpc.ts`
3. role and permission definitions in `shared/access-control.ts`
4. client-side permission helpers in `client/src/_core/hooks/usePermissions.ts`
5. authenticated viewer bootstrap via `auth.me` in `server/routers.ts`

That means Agentic does not need an ad hoc flagging model layered on top of random component checks.
It needs a first-class platform feature access model.

## Design Principles

### 1. Server authoritative

If a feature touches:

1. data access
2. admin operations
3. stream-scoped information
4. cost-producing actions
5. integrations or tool execution

then the server must evaluate access.

The client may still hide or disable the control, but the backend remains the source of truth.

### 2. Separate flag classes

Do not put every gated behavior behind one boolean concept called "feature flag".

Use different classes with different expectations:

1. permission gates
2. entitlement or scope gates
3. release flags
4. experiment flags
5. debug flags
6. kill switches

### 3. Typed registry, not scattered strings

All gates should be defined in one typed registry in code.

Bad:

1. `if (process.env.NODE_ENV === "development")`
2. `if (user.role === "admin")`
3. `if (flag === "newThing")`

spread across dozens of components.

Good:

1. a single registry of feature definitions
2. a single evaluation service on the server
3. a single client access hook

### 4. Deploy != release

The platform should be free to ship code before it is visible.

That is the normal modern operating model:

1. deploy dormant code
2. release internally first
3. expand gradually by role, stream, or cohort
4. keep a kill switch available during rollout

### 5. Temporary flags must expire

Release flags and debug gates tend to accumulate unless they are governed.

Every non-permanent gate should have:

1. owner
2. category
3. creation date
4. expiry date
5. removal expectation

## Recommended Flag Classes

### Permission gates

Use when access is determined by role and capability.

Examples in Agentic:

1. user management
2. admin pages
3. connector management
4. release creation
5. knowledge governance actions

Source of truth:

1. role and permission model in `shared/access-control.ts`
2. scoped TRPC procedures in `server/_core/trpc.ts`

### Scope and entitlement gates

Use when a feature is available only for a subset of streams, tenants, customers, or licensed tiers.

Examples in Agentic:

1. stream-scoped KB features
2. premium governance flows
3. integrations enabled for specific business groups

Source of truth:

1. authenticated user context
2. assigned value streams
3. tenant or org configuration

### Release flags

Use when a feature is implemented but not yet broadly launched.

Examples in Agentic:

1. new knowledge release workflow
2. new trace visualizations
3. redesigned admin modules
4. next-version AI helper panels

Expected lifecycle:

1. created before rollout
2. enabled for internal users or beta cohorts
3. removed after general availability

### Experiment flags

Use when comparing alternative UX or behavior.

Examples in Agentic:

1. alternate response formatting
2. alternate onboarding copy
3. alternate chat startup states

These should stay separate from release flags because the operational and analytics needs are different.

### Debug flags

Use for tooling that should exist only for privileged users during diagnosis.

Examples in Agentic:

1. raw tool payloads
2. thought-trace internals
3. stream router ranking telemetry
4. auth/session diagnostics
5. integration status payloads

Debug features should not appear because a user opened DevTools or because the app is in development mode.
They should require an explicit debug capability.

### Kill switches

Use for emergency shutdown of risky platform behavior.

Examples in Agentic:

1. disable tool calling
2. disable streaming responses
3. disable connector sync
4. disable ingest mutations
5. disable release publishing

These are operational controls and should be enforceable even if a feature is otherwise launched.

## Recommended Architecture

### 1. Shared typed registry

Add a shared registry file for feature definitions.

Recommended location:

`apps/ai-platform/agentic/shared/feature-flags.ts`

Each definition should include:

1. key
2. category
3. owner
4. description
5. default state
6. environments allowed
7. expiry date for temporary flags
8. whether client visibility is allowed
9. whether server enforcement is required

Suggested categories:

1. `permission`
2. `entitlement`
3. `release`
4. `experiment`
5. `debug`
6. `kill_switch`

### 2. Server-side evaluation service

Add a server evaluator that resolves feature access for the current viewer.

Recommended location:

`apps/ai-platform/agentic/server/_core/feature-flags.ts`

It should evaluate using:

1. environment
2. role
3. permissions
4. org
5. assigned streams
6. explicit release targeting
7. debug session state
8. kill switch state

This evaluator should return two kinds of answers:

1. `isFeatureVisible` for UI presentation
2. `isFeatureAllowed` for backend enforcement

Those are not always identical.

### 3. Viewer capability snapshot

Do not force the client to re-implement server feature logic.

Add a viewer bootstrap payload that returns:

1. user
2. permissions
3. scopes
4. evaluated feature visibility
5. evaluated debug capabilities
6. active experiments

Recommended rollout path:

1. keep `auth.me` stable for now
2. add a new query such as `auth.viewerContext`
3. migrate UI gating to the new snapshot
4. optionally merge later once consumers are updated

Recommended location:

`apps/ai-platform/agentic/server/routers.ts`

### 4. Client feature access layer

Add one client hook and one optional gate component.

Recommended locations:

1. `client/src/_core/hooks/useFeatureAccess.ts`
2. `client/src/components/system/FeatureGate.tsx`

The hook should expose:

1. `canView(featureKey)`
2. `canUse(featureKey)`
3. `isDebugEnabled(featureKey)`
4. `variant(featureKey)` for experiments

The UI should stop scattering logic like:

1. `role === "admin"`
2. `process.env.NODE_ENV === "development"`
3. stream checks directly in presentation components

except in leaf cases where the check is trivial and harmless.

### 5. Explicit debug sessions

Debug-only UI in production should require more than role.

Recommended model:

1. user must have admin or designated support permission
2. user explicitly enables debug mode
3. server issues a short-lived signed debug capability
4. all debug-only endpoints and UI read from that capability
5. activation is logged for auditability

Recommended duration:

1. 15 to 60 minutes
2. auto-expire by default

This is safer than leaving permanent debug visibility on for privileged users.

### 6. Hybrid flag storage

Use a hybrid approach, not a single mechanism for everything.

#### Static code registry

Use for:

1. type safety
2. discoverability
3. ownership
4. expiry metadata

#### Dynamic runtime values

Use for:

1. staged rollouts
2. internal-only enablement
3. beta cohorts
4. experiments

The current Agentic implementation stores org-scoped admin overrides in the
`featureFlagOverrides` table and applies them through the admin Feature Controls
page.

Editable org-scoped rollout presets now persist in the `featureFlagPresets`
table and are seeded from shared code templates the first time an org opens the
Settings page.

That means release posture can now be changed per org without redeploying.

#### Deployment presets

For deployment baselines, use named presets that apply a known override set
instead of toggling individual flags ad hoc.

The first implemented preset template is:

1. `mvp.first`
2. `mvp.curated`
3. `beta.full`

`mvp.first` is the first editable MVP rollout for a curated Knowledge pilot:

1. chat prompt generator and rerun enabled
2. chat attachments and voice disabled
3. clear-all tasks stays debug-only
4. KB overview, ingest, library, pipelines, and activity enabled
5. file upload enabled
6. text paste disabled
7. URL crawl disabled
8. connectors disabled
9. Google Drive disabled
10. validate and govern surfaces disabled
11. debug trace surfaces disabled

This gives the platform a practical first MVP posture that exposes the safest
curated KB path while keeping advanced validation, governance, and connector
surfaces dark until they are intentionally launched. Org admins can edit the
seeded preset and apply it by preset record, rather than being limited to fixed
static deployment keys.

`mvp.curated` is the recommended preset for the first real manager workflow:

1. chat prompt generator, rerun, and backend feedback capture stay in
2. chat attachments and voice stay off
3. clear-all tasks stays debug-only
4. KB overview, ingest, library, validate, govern, pipelines, and activity enabled
5. file upload enabled
6. validate limited to test sandbox, quality, and eval suites
7. govern limited to review queue
8. text paste disabled
9. URL crawl disabled
10. connectors disabled
11. collections, taxonomy, and graph surfaces disabled
12. gaps, users/access, and compliance disabled

This gives the platform a tighter pilot posture for a curated single-stream KB:
manager uploads, reviews, publishes, reruns, captures feedback, tests grounded answers, and runs curated eval suites without
opening the broader connector, graph, or advanced governance surface area.

`beta.full` is the expanded KB workspace posture for teams that need the entire
Knowledge shell rather than the curated MVP cutline:

1. all KB tabs stay enabled
2. all ingest modes are enabled, including text paste, URL crawl, and connectors
3. all library views are enabled, including collections, taxonomy, and graph
4. all validate sections are enabled, including gaps, compare, and context shaping
5. all govern sections are enabled, including users/access and compliance
6. activity monitoring keeps both jobs and alert history enabled
7. Google Drive connector rollout is enabled
8. debug chat diagnostics remain off

This is the preset to use when you want the whole KB workspace available in one
rollout without hand-curating dozens of individual flag overrides.

This can live in:

1. a DB-backed config table
2. a dedicated flag service
3. a vendor system later if needed

#### Environment variables

Use only for:

1. boot-time hard disables
2. infra-sensitive kill switches
3. local dev defaults

Do not use environment variables as the main UI release mechanism.

## Evaluation Order

For any gated capability, Agentic should evaluate in this order:

1. authenticated user exists
2. required permission is satisfied
3. required stream or entitlement is satisfied
4. feature is released for this viewer or cohort
5. debug capability is present if required
6. no kill switch blocks execution

That ordering prevents accidental visibility from release flags alone.

## Platform-Specific Recommendations

### Chat UI

Use release flags for:

1. new message rendering treatments
2. alternate startup cards
3. new synthesis or summary UI
4. prompt generation helpers

Use debug flags for:

1. raw trace payloads
2. tool arguments and result payload views
3. stream routing scores
4. token and latency internals

Server enforcement is required when the debug feature exposes payloads not normally visible to the user.

### Knowledge UI

Use permission and scope gates for:

1. add content
2. approvals and releases
3. connector onboarding
4. team management
5. governance and launch readiness

Use release flags for:

1. upcoming overview modules
2. next-version evaluation visuals
3. new release workflow steps
4. advanced analytics surfaces

### Admin UI

Use permission gates first, not release flags, for:

1. users page
2. stream management
3. enterprise governance
4. system configuration

Use release flags only when an admin feature is unfinished or gradually rolling out.

### Connectors and Ingest

Use release flags for:

1. new connector types
2. connector setup redesigns
3. automated sync controls

The current implementation already applies this pattern to the live ingest
surface:

1. `release.knowledge.ingest.fileUpload`
2. `release.knowledge.ingest.textPaste`
3. `release.knowledge.ingest.urlCrawl`
4. `release.knowledge.ingest.connectors`
5. `release.connectors.googleDrive`

These flags are enforced in both places:

1. the client, to hide unavailable ingest methods and connector cards
2. the server, to reject disabled ingest and connector operations directly

Use kill switches for:

1. pausing connector sync globally
2. disabling ingest mutations
3. disabling outbound integration calls during incidents

### Governance and Trace Surfaces

These should follow a strict split:

1. high-level health and business metrics may be standard admin features
2. raw trace internals and payload diagnostics should be debug-only

## Initial Flag Set for Agentic

The following are a sensible first pass for the platform.

### Debug

1. `debug.chat.traceTimeline`
2. `debug.chat.rawToolPayloads`
3. `debug.chat.streamRouterScores`
4. `debug.auth.sessionDiagnostics`
5. `debug.knowledge.releaseInternals`
6. `debug.connectors.syncPayloads`

### Release

1. `release.chat.promptGenerator`
2. `release.knowledge.launchReadiness`
3. `release.knowledge.releases`
4. `release.connectors.googleDrive`
5. `release.admin.commandCenterRefactor`
6. `release.governance.traceExplorer`

### Experiments

1. `experiment.chat.responseDensity`
2. `experiment.chat.welcomeState`
3. `experiment.knowledge.overviewVisuals`

### Kill switches

1. `kill.chat.streaming`
2. `kill.chat.toolCalling`
3. `kill.knowledge.ingest`
4. `kill.connectors.sync`
5. `kill.releases.publish`

## UI Behavior Guidelines

### Hidden vs disabled vs visible with explanation

Use these intentionally.

#### Hide completely

Use when:

1. the feature is internal-only
2. the feature is debug-only
3. discoverability adds no value

#### Show disabled with explanation

Use when:

1. the user is expected to get access later
2. the feature is planned for the next release
3. the user needs to understand why it is unavailable

Good examples:

1. `Coming soon`
2. `Available to Knowledge Admins`
3. `Requires debug session`

#### Show and allow

Only when both visibility and backend authorization are satisfied.

## Anti-Patterns to Avoid

1. using `NODE_ENV` as the primary UI lock
2. hiding admin features in the client without backend enforcement
3. mixing permission logic and release logic in a single boolean
4. long-lived flags with no owner or expiry
5. string literals for feature names spread throughout the codebase
6. client-only experiment selection for server-impacting behavior
7. exposing raw debug payloads to all admins by default in production

## Recommended Rollout Plan

### Phase 1

Create the shared registry and server evaluator.

### Phase 2

Add `auth.viewerContext` with evaluated feature visibility.

### Phase 3

Introduce client-side `useFeatureAccess` and migrate the highest-risk UI surfaces first:

1. admin pages
2. governance panels
3. trace internals
4. connector setup

### Phase 4

Add explicit short-lived debug sessions.

### Phase 5

Move staged release controls into a dynamic flag source and reserve env vars for hard operational switches.

## Recommended End State

The Agentic platform should operate like this:

1. permissions determine who may ever use a capability
2. scope and entitlement determine where they may use it
3. release flags determine whether it is launched yet
4. debug capabilities determine whether diagnostic UI is exposed
5. kill switches let the platform disable risky behavior instantly
6. the server evaluates all of the above and sends a clean capability snapshot to the client

That model is the right fit for the entire Agentic platform because it keeps product rollout, debugging, authorization, and operational safety separate while still giving the UI one simple contract to render against.
