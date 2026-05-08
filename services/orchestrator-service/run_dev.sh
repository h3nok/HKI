#!/bin/bash
# Dev startup script for orchestrator-service
cd "$(dirname "$0")"

set -a
[[ -f .env ]] && . ./.env
set +a

export PYTHONPATH="${PWD}:${PYTHONPATH:-}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-in-prod}"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-dev-service-auth-secret-change-in-prod}"
export KNOWLEDGE_API_URL="${KNOWLEDGE_API_URL:-http://localhost:9509}"

exec uv run uvicorn src.api.app:app --reload --port 9501 --host 0.0.0.0
