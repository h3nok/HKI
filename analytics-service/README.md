# Analytics Service

Event ingest and usage-summary service for the AI Platform.

## Status

This service is a supporting runtime dependency rather than a standalone product surface.

- Local dev wrapper port: `9510`
- Container and GKE runtime port: `9512`
- Local storage mode: in-memory unless database or GCP analytics settings are configured

## Responsibilities

- accept platform analytics and event writes
- expose usage and event summary endpoints
- provide an optional downstream sink for Agentic, Orchestrator, and Knowledge API

## Local Development

### Recommended workspace entrypoint

Run this from `apps/ai-platform`:

```bash
make dev-analytics
```

That matches the rest of the local stack and binds the service to `http://localhost:9510`.

### Standalone run

```bash
cd apps/ai-platform/analytics-service
cp .env.example .env
uv sync --extra dev
uv run uvicorn src.api.app:app --reload --port 9510 --reload-dir src
```

## Testing

```bash
AUTH_ENABLED=false pytest tests/ -x --tb=short
AUTH_ENABLED=false pytest --cov=src tests/
```

## API Documentation

Once running locally, visit:

- Swagger UI: `http://localhost:9510/docs`
- ReDoc: `http://localhost:9510/redoc`
- Health Check: `http://localhost:9510/health`

## Deployment

Production deployment is GKE-first via the shared AI Platform rollout. Cluster manifests and container runtime keep this service on port `9512`, so local `.env` files for dependent services should use `9510` while Kubernetes config stays on `9512`.

## Contributor Notes

- Keep backlog or follow-up gaps in issues or sprint tracking, not in this README.
- If you change event schemas or analytics endpoints, verify every local caller that points at the service.
