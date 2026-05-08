# Environment Setup

AI Platform local development uses one environment file per service plus a shared Docker infrastructure file.

## Copy commands

Run this from `apps/ai-platform`:

```bash
make init-env
```

`make init-env` copies any missing `.env` files from the matching `.env.example`, backfills a few safe local defaults into older env files, and leaves existing values in place.

If you want to do it manually instead, the command sequence is:

```bash
cp deploy/compose/.env.example deploy/compose/.env
cp agentic/.env.example agentic/.env
cp orchestrator-service/.env.example orchestrator-service/.env
cp ingestion-pipeline-service/.env.example ingestion-pipeline-service/.env
cp knowledge-api/.env.example knowledge-api/.env
cp analytics-service/.env.example analytics-service/.env
```

Then run:

```bash
make validate-env
```

## Required files and values

| File                              | Purpose                                         | Required before first run                                                         |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `deploy/compose/.env`             | Shared Docker infra ports and LiteLLM config    | `VERTEX_PROJECT`                                                                  |
| `agentic/.env`                    | Agentic BFF, UI, and local MySQL wiring         | `DATABASE_URL`, `ORCHESTRATOR_URL`, `KNOWLEDGE_API_URL`, `KNOWLEDGE_PIPELINE_URL` |
| `orchestrator-service/.env`       | Orchestrator models, Redis, downstream services | `LLM_GATEWAY_URL`, `KNOWLEDGE_API_URL`                                            |
| `ingestion-pipeline-service/.env` | Ingestion pipeline, review flow, queue options  | `KNOWLEDGE_API_URL`                                                               |
| `knowledge-api/.env`              | Search, storage, graph, and optional analytics  | `ALLOYDB_URL` for persistent local search, otherwise defaults can stay as copied  |
| `analytics-service/.env`          | Analytics service runtime settings              | Defaults are enough for local dev                                                 |

## One-time local GCP setup

Local LiteLLM talks to Vertex AI through the credentials file mounted by Docker Compose.

- Put a service-account key at `deploy/compose/creds/gcp_creds.json`
- Set `VERTEX_PROJECT` in `deploy/compose/.env`
- Keep `LITELLM_PORT=4000` unless you are deliberately changing every local service URL that points at LiteLLM

## Local defaults that matter

- Local LiteLLM runs on `http://localhost:4000`
- Local Agentic runs on `http://localhost:9001`
- Local analytics traffic uses `http://localhost:9510`
- In-cluster analytics stays on port `9512`; do not copy that cluster port back into the local `.env` files unless you also change the local wrappers

## Auth and secrets

- Local dev usually runs with `AUTH_ENABLED=false` in Python services
- `SERVICE_AUTH_SECRET` matters when you are validating authenticated service-to-service flows
- Google OAuth values are optional for most local development and required for shared deployments
- Connector credentials and long-lived secrets belong in Secret Manager for deployed environments, not in committed files

## When to update docs

If you change a required variable, default port, or local service URL:

- update the relevant `.env.example`
- update `../README.md`
- update this file
- rerun `make validate-env`
