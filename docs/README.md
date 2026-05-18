# HKI Docs

Use this directory as the current documentation index for HKI, the Hermetic
Knowledge Isolation reference platform.

## Start here

- `../README.md` - workspace entrypoint, quick start, local dev, deployment summary
- `FIRST_SETUP.md` - first-time local onboarding from fresh checkout to running stack
- `ENV_SETUP.md` - required `.env` files, local defaults, and one-time GCP setup
- `TESTING.md` - test matrix, when to run each suite, and pre-PR checks
- `KB_INITIAL_MVP_RELEASE_NOTE.md` - shareable release note for the currently deployed KB MVP scope and how to position it with EA and partner teams
- `KB_FILE_UPLOAD_E2E_QA_PLAN.md` - manual QA runbook for value stream creation, file-upload KB workflows, review and publish, and Agentic validation
- `KB_FILE_UPLOAD_E2E_QA_CHECKLIST.csv` - spreadsheet-friendly sign-off checklist aligned to the KB file upload QA plan
- `AGENTIC_PLATFORM_FEATURE_MAP.md` - evidence-backed map of non-dashboard
  product surfaces, service dependencies, status, gaps, and next actions
- `ADMIN_CONTROL_PLANE_DASHBOARD_DESIGN.md` - design, feature inventory,
  completeness bar, and careful development plan for the Agentic admin dashboard
- `COMMUNITY_ENABLEMENT.md` - contribution lanes, public/reference/experimental
  boundaries, HKI safety bar, and agentic UI review checklist
- `HKI_CONFORMANCE.md` - implementer-facing conformance bar for runtime scope,
  artifacts, storage, caches, tools, admin plane, and publication
- `HKI_SERVICE_EVIDENCE.md` - black-box service evidence runner, strict-auth
  local commands, and hashed bundle format
- `HKI_PUBLIC_READINESS_PLAN.md` - end-to-end roadmap for making HKI ready for
  public adoption as an open-source standard and reference runtime
- `SERVICE_PORTS.md` - local and in-cluster port reference
- `SERVICE_BOUNDARIES.md` - service ownership by responsibility and change surface

## Deployment and operations

- `DEPLOYMENT_AUTOMATION.md` - current GKE deployment mechanics and prerequisites
- `DEPLOYMENT_CHECKLIST.md` - release checklist and dependency ordering
- `KB_REFERENCE_PLATFORM.md` - knowledge-base platform quality bar and operating model

## Agentic isolation and routing

- `../spec/HKI-1.0.md` - draft normative HKI 1.0 standard
- `../spec/HKI-Agent-Gateway-Profile.md` - gateway conformance profile for MCP, A2A, tools, memory, cache, and retrieval
- `../packages/hki-runtime/README.md` - TypeScript runtime helpers and JSON Schemas for HKI envelopes and artifact labels
- `../packages/hki-runtime-py/README.md` - Python runtime helpers for the same HKI envelope and artifact-label contract
- `../packages/hki-conformance/README.md` - conformance adapter contract and CLI runner for runtime evidence
- `HKI-package/custody_problem.md` - research note defining HKI as inference-time data sovereignty through usage control, provenance, scoped delegation, and falsifiable runtime checks
- `HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md` - full Hermetic Knowledge Isolation paper and runtime model
- `SCOPED_AGENTIC_ROUTING.md` - operational standard for scoped agentic routing across models, knowledge, memory, tools, cache, eval, and audit
- `MCP_GATEWAY_AND_BUS.md` - MCP tool control-plane design bound to HKI/SAR enforcement
- `HKI_SECURITY_MAPPING.md` - mapping from HKI to MCP, A2A, OWASP, NIST, and gateway controls

## Historical and point-in-time docs

These files are still useful for context, but they are not the canonical onboarding path:

- `archive/DEPLOYMENT_ORDER.md` - retired Cloud Run deployment order
- `archive/README.md` - archived sprint plans, dashboards, and historical risk/debt snapshots

If current behavior and a historical doc disagree, trust `../README.md`, the active Make targets, and the live service READMEs.
