# Agentic BFF

Full-stack chat application (React frontend + Node.js tRPC backend) that provides the UI for interacting with the AI platform.

## Architecture

- **Frontend**: React + Vite + TanStack Query
- **Backend**: Node.js + tRPC + Drizzle ORM
- **Port**: 9001
- **Dependencies**:
  - Orchestrator Service (for agent interactions)
  - Knowledge API (for knowledge base queries)
  - Cloud SQL MySQL (for application data)
  - Redis (for multi-instance broadcast and connector sync locking)

## Local Development

### Agentic only

```bash
cd apps/ai-platform/agentic

cp .env.example .env
pnpm install
pnpm dev
```

Agentic runs on `http://localhost:9001` and exposes its tRPC API at `http://localhost:9001/api/trpc`.

### Full AI Platform

If you are working across Agentic and the Python services, start the stack from `apps/ai-platform` instead:

```bash
make init-env
make validate-env
make install
make dev-full
```

Use `make dev-services` plus `cd agentic && pnpm dev` when you want the UI in a separate terminal.

## Testing

```bash
pnpm test
pnpm test:kb-role-e2e
pnpm test:kb-feature-flags-e2e
pnpm test:kb-ui-e2e
pnpm test:kb-api-e2e
pnpm db:migrate:status
```

For workspace-level guidance, see `../docs/TESTING.md`.

## Troubleshooting

- If app pages fail with database errors, run `make -C .. db-migrate-local`.
- If Google OAuth or connector callbacks fail locally, confirm `BASE_URL` and `GOOGLE_DRIVE_REDIRECT_URI` match `http://localhost:9001`.
- If KB/admin flows fail after backend changes, restart the workspace with `make -C .. dev-full` so the dependent Python services are refreshed.

## Deployment

```bash
# 1. Configure secrets (one-time)
gcloud secrets versions add agentic-database-url --data-file=- <<< "mysql://..."
gcloud secrets versions add agentic-google-client-id --data-file=- <<< "your-client-id"
gcloud secrets versions add agentic-google-client-secret --data-file=- <<< "your-secret"

# 2. Update the Google OAuth client outside the repo
# Authorized redirect URIs must include:
#   https://agentic.cilabs.np.hki.com/api/auth/google/callback
#   https://agentic.cilabs.np.hki.com/api/connectors/google-drive/callback
# OAuth scopes must allow:
#   https://www.googleapis.com/auth/drive.readonly
#   https://www.googleapis.com/auth/userinfo.email

# 3. Deploy or redeploy Agentic on GKE
cd ..
make gke-deploy-agentic

# Alternative when the image is already pushed:
./scripts/deploy-k8s.sh --skip-tf --skip-build --only agentic-bff
```

## Environment Variables

- `ORCHESTRATOR_URL` - URL of the orchestrator service
- `ENABLE_GEMINI_ORCHESTRATOR_FALLBACK` - When `true`, KB/admin Gemini routes retry through the orchestrator if the primary LLM gateway returns `429`, `5xx`, or times out
- `KNOWLEDGE_API_URL` - URL of the knowledge API
- `DATABASE_URL` - MySQL connection string
- `GOOGLE_CLIENT_ID` - OAuth client ID (if using Google auth)
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `CONNECTOR_CREDENTIALS_SECRET` - Encrypts stored connector OAuth credentials at rest
- `REDIS_URL` - Required for multi-instance WebSocket broadcast and connector sync locking
- `GOOGLE_DRIVE_REDIRECT_URI` - Redirect URI for the Drive connector OAuth callback

## Google OAuth

Secret Manager stores the client ID and secret consumed by the GKE deploy flow,
but it does not manage Google OAuth authorized redirect URIs.

For the current shared deployment, the OAuth client must allow:

```text
https://agentic.cilabs.np.hki.com/api/auth/google/callback
https://agentic.cilabs.np.hki.com/api/connectors/google-drive/callback
```

If the login URI is missing, Google login fails with `Error 400: redirect_uri_mismatch`.
If the Drive callback or scopes are missing, connector setup fails before background sync can start.

## Deployment Notes

- The service-local `agentic/tf` directory has been removed; Agentic rollout is GKE-only.
- `scripts/deploy-k8s.sh` now defaults to `BUILD_MODE=auto`: it tries Cloud Build first, and if that fails from a laptop it falls back to local `docker buildx` pushes using the same registry tags.
- Set `BUILD_MODE=cloud-build` to force remote builds only, or `BUILD_MODE=local-docker` to skip Cloud Build entirely.
- GKE deploys now sync `CONNECTOR_CREDENTIALS_SECRET` from Secret Manager, bootstrap `agentic-connector-credentials-secret` if it is missing, and patch `REDIS_URL` from Terraform outputs or a direct Memorystore lookup during `scripts/deploy-k8s.sh`.
- For production, do not leave `REDIS_URL` empty if scheduled connector sync can run on multiple instances.

## Features

- Chat interface for AI interactions
- Admin dashboard
- Conversation history
- Multi-agent workflows
- Knowledge base integration
- User authentication (OAuth)
