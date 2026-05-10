# Contributing to HKI

HKI is being developed as an open-source reference implementation for Hermetic
Knowledge Isolation and scoped agentic routing. Contributions should make the
runtime contract easier to enforce, test, operate, or adopt.

## Start Here

- Read `README.md` for the current local-dev and deployment entrypoints.
- Read `docs/COMMUNITY_ENABLEMENT.md` to choose the right contribution lane and
  understand what is public API, reference implementation, or experimental.
- Read `docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md` for the isolation model.
- Read `docs/SCOPED_AGENTIC_ROUTING.md` before changing agent, retrieval, memory,
  cache, tool, or trace behavior.
- Read `docs/HKI_CONFORMANCE.md` before changing runtime scope or publication
  paths.
- Read `docs/FIRST_SETUP.md` before first-time setup or local environment changes.
- Read `docs/TESTING.md` before choosing validation scope for a change.
- Read `docs/DEPENDENCY_POLICY.md` before changing package versions, Node,
  pnpm, dependency overrides, or install-script approvals.
- Read `docs/SERVICE_BOUNDARIES.md` before editing multiple services in one branch.

## Working Rules

- Use the workspace `Makefile`, service-level `uv` commands, or documented package scripts instead of ad hoc commands.
- Never commit secrets, service-account keys, `.env` files, or generated credentials.
- Update docs when you change required environment variables, ports, startup flow, migrations, or deployment entrypoints.
- Treat older Cloud Run deployment material in this subtree as historical unless the task explicitly calls for legacy work. The canonical production path is GKE.
- Do not introduce hardcoded UI colors, shadows, radii, or legacy brand terms in
  public UI code. Use `@hki/ui` tokens and run `pnpm audit:ui-tokens`.
- Do not introduce new runtime `global` fallback behavior, null-scope reads, or
  cross-domain wildcard queries. Use explicit admin-plane paths or publication
  workflows and run `pnpm audit:hki`.

## Contribution Lanes

Choose one primary lane per PR:

- Standard and docs.
- Runtime packages.
- Conformance and evidence.
- Framework or storage adapters.
- Reference services.
- Agentic UI.
- Community operations.

If a change crosses lanes, call out the boundary in the PR summary and validate
at least one producer and one consumer path.

## Validation

- Run the smallest relevant lint, test, or smoke target for the area you touched.
- For UI changes, run `pnpm audit:ui-tokens` and the relevant TypeScript check.
- For scope, auth, retrieval, ingestion, cache, memory, or tool changes, run
  `pnpm audit:hki` plus the closest conformance tests.
- Start local validation with `make init-env`, `make validate-env`, and the relevant commands from `docs/TESTING.md`.
- If you change a shared interface or service contract, validate both the producer and at least one consumer path.
- If you change env vars or ports, update the matching `.env.example`, `README.md`, and `docs/ENV_SETUP.md` together.

## Pull Requests

- Keep changes scoped to one functional area when practical.
- Call out migrations, secret changes, rollout ordering, and manual follow-up in the PR description.
- Prefer follow-up issues over leaving open-ended TODO lists in service READMEs.
- Use `.github/PULL_REQUEST_TEMPLATE.md` and include the exact validation
  commands you ran.
