# First-Time Setup

This is the shortest reliable path from a fresh checkout to a working local AI Platform stack.

## Quick path

Run these commands from `apps/ai-platform`:

```bash
make doctor-dev
make init-env
make validate-env
make install
make dev-full
```

`make dev-full` starts Docker infrastructure, restarts the Python services, checks Agentic migrations, and launches the Agentic UI in the foreground.

## Required one-time setup

Before the first successful run, make sure these exist:

- `deploy/compose/creds/gcp_creds.json` - service-account key used by local LiteLLM when talking to Vertex AI
- `deploy/compose/.env` with `VERTEX_PROJECT` set to a GCP project you can use for local model calls

If you do not have GCP access yet, you can still work on large parts of the UI and service wiring, but model-backed flows will fail until LiteLLM can authenticate.

## Split-stack workflow

Use this when you want the backend stack running in the background and the Agentic UI in a separate terminal:

```bash
make infra-up
make dev-services
cd apps/agentic && pnpm dev
```

This is the better option when you are iterating on frontend code and want to stop or restart only the UI process.

## Success criteria

You are fully onboarded when all of the following are true:

- `make dev-status` shows MySQL, Redis, PostgreSQL, and LiteLLM up
- `http://localhost:9001` loads Agentic
- `http://localhost:9501/health` returns orchestrator health
- `http://localhost:9509/health` returns knowledge-api health
- `http://localhost:9508/health` returns ingestion-pipeline health

## Common fixes

- If `make validate-env` fails, run `make init-env` first, then fill in any remaining required values.
- If Agentic starts but database-backed pages fail, run `make db-migrate-local`.
- If LiteLLM returns `401` or `403`, verify `VERTEX_PROJECT` and the `deploy/compose/creds/gcp_creds.json` file.
- If a port is already busy, run `make dev-stop` and retry.
- If Docker infra looks healthy but the app is still broken, use `make infra-reset` and then restart the stack.

## Next steps

- Read `ENV_SETUP.md` before changing any shared local defaults.
- Read `TESTING.md` before opening a PR.
- Read `SERVICE_BOUNDARIES.md` before changing multiple services in one branch.
