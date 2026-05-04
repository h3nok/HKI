# Testing Guide

Use the smallest test surface that proves your change, then add broader checks when you change shared contracts, auth, migrations, or deployment wiring.

## Workspace-level targets

Run these from `apps/ai-platform`:

| Command              | Use when                                                                              |
| -------------------- | ------------------------------------------------------------------------------------- |
| `make test-services` | You changed Python service logic and want the default pytest sweep                    |
| `make lint-services` | You changed Python code and want the default Ruff sweep                               |
| `make e2e-test`      | You changed ingestion or document storage behavior                                    |
| `make kb-test-run`   | You changed retrieval quality or KB evaluation logic                                  |
| `make kb-acl-smoke`  | You changed auth, ACL, or validate-access behavior                                    |
| `make kb-ui-e2e`     | You changed KB UI flows or browser interactions                                       |
| `make test-prod`     | You changed deployment/runtime behavior and need the canonical GKE verification suite |

## GitHub QA companions

- Use the GitHub issue template `KB File Upload QA Run` when you want a durable task list, evidence links, and release-gate sign-off in GitHub.
- `AI Platform Quality` runs on AI Platform pushes and pull requests. It enforces `pnpm --dir agentic test` plus `make test-services`. The Python Ruff sweep still runs as advisory visibility while the remaining legacy lint debt is burned down.
- Use the GitHub Actions workflow `KB QA Smoke` with `workflow_dispatch` for the hosted GKE smoke subset.
- `KB QA Smoke` is aimed at hosted checks such as `make test-prod` and `pnpm --dir apps/ai-platform/agentic run test:kb-gke-hvsi-smoke`.
- Local-stack scripts such as `make kb-ui-e2e` and `make kb-acl-smoke` remain developer-run unless you wire a self-hosted runner with the required local stack setup.

## Service-level commands

### Agentic

Run from `apps/ai-platform/agentic`:

```bash
pnpm test
pnpm test:kb-role-e2e
pnpm test:kb-feature-flags-e2e
pnpm test:kb-ui-e2e
pnpm test:kb-api-e2e
```

### Python services

Run from the service directory you touched:

```bash
AUTH_ENABLED=false pytest tests/ -x --tb=short
```

Use this for `knowledge-api`, `ingestion-pipeline-service`, `orchestrator-service`, and `analytics-service`.

## Suggested test selection

- UI-only changes: `pnpm test` plus the narrow browser flow that covers the page you changed
- Knowledge search changes: `knowledge-api` unit tests plus `make kb-test-run` or `make kb-test-search`
- Ingestion changes: `ingestion-pipeline-service` tests plus `make e2e-test`
- Auth, roles, or feature-flag changes: service tests plus `make kb-acl-smoke`
- Deployment or config changes: targeted local validation plus `make test-prod` when appropriate

## Before opening a PR

- Run at least one targeted test that directly covers the changed behavior.
- Run lint for the language you touched.
- If you changed env vars, ports, or startup flow, run `make validate-env` and refresh the docs.
- If you changed a service interface, verify at least one dependent service path end to end.
