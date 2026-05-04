# AI Platform Docs

Use this directory as the current documentation index for `apps/ai-platform`.

## Start here

- `../README.md` - workspace entrypoint, quick start, local dev, deployment summary
- `FIRST_SETUP.md` - first-time local onboarding from fresh checkout to running stack
- `ENV_SETUP.md` - required `.env` files, local defaults, and one-time GCP setup
- `TESTING.md` - test matrix, when to run each suite, and pre-PR checks
- `KB_INITIAL_MVP_RELEASE_NOTE.md` - shareable release note for the currently deployed KB MVP scope and how to position it with EA and partner teams
- `KB_FILE_UPLOAD_E2E_QA_PLAN.md` - manual QA runbook for value stream creation, file-upload KB workflows, review and publish, and Agentic validation
- `KB_FILE_UPLOAD_E2E_QA_CHECKLIST.csv` - spreadsheet-friendly sign-off checklist aligned to the KB file upload QA plan
- `SERVICE_PORTS.md` - local and in-cluster port reference
- `SERVICE_BOUNDARIES.md` - service ownership by responsibility and change surface

## Deployment and operations

- `DEPLOYMENT_AUTOMATION.md` - current GKE deployment mechanics and prerequisites
- `DEPLOYMENT_CHECKLIST.md` - release checklist and dependency ordering
- `KB_REFERENCE_PLATFORM.md` - knowledge-base platform quality bar and operating model

## Agentic isolation and routing

- `HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md` - full Hermetic Knowledge Isolation paper and runtime model
- `SCOPED_AGENTIC_ROUTING.md` - operational standard for scoped agentic routing across models, knowledge, memory, tools, cache, eval, and audit
- `MCP_GATEWAY_AND_BUS.md` - MCP tool control-plane design bound to HKI/SAR enforcement

## Historical and point-in-time docs

These files are still useful for context, but they are not the canonical onboarding path:

- `archive/DEPLOYMENT_ORDER.md` - retired Cloud Run deployment order
- `archive/NAVIGATION_GUIDE.md` - earlier navigation and integration notes
- `archive/README.md` - archived sprint plans, dashboards, and historical risk/debt snapshots

If current behavior and a historical doc disagree, trust `../README.md`, the active Make targets, and the live service READMEs.
