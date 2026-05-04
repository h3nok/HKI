# Contributing to AI Platform

This guide applies to work inside `apps/ai-platform` only.

## Start Here

- Read `README.md` for the current local-dev and deployment entrypoints.
- Read `docs/FIRST_SETUP.md` before first-time setup or local environment changes.
- Read `docs/TESTING.md` before choosing validation scope for a change.
- Read `docs/SERVICE_BOUNDARIES.md` before editing multiple services in one branch.

## Working Rules

- Use the workspace `Makefile`, service-level `uv` commands, or documented package scripts instead of ad hoc commands.
- Never commit secrets, service-account keys, `.env` files, or generated credentials.
- Update docs when you change required environment variables, ports, startup flow, migrations, or deployment entrypoints.
- Treat older Cloud Run deployment material in this subtree as historical unless the task explicitly calls for legacy work. The canonical production path is GKE.

## Validation

- Run the smallest relevant lint, test, or smoke target for the area you touched.
- Start local validation with `make init-env`, `make validate-env`, and the relevant commands from `docs/TESTING.md`.
- If you change a shared interface or service contract, validate both the producer and at least one consumer path.
- If you change env vars or ports, update the matching `.env.example`, `README.md`, and `docs/ENV_SETUP.md` together.

## Pull Requests

- Keep changes scoped to one functional area when practical.
- Call out migrations, secret changes, rollout ordering, and manual follow-up in the PR description.
- Prefer follow-up issues over leaving open-ended TODO lists in service READMEs.