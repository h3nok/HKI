#!/bin/bash
# Dev startup script for knowledge-api
cd "$(dirname "$0")"

# Set up environment
export PYTHONPATH="${PWD}:${PYTHONPATH}"
export ALLOYDB_URL="${ALLOYDB_URL:-postgresql://postgres:postgres@localhost:9432/knowledge_db}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-in-prod}"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-dev-service-auth-secret-change-in-prod}"

# Start service
exec uv run uvicorn src.api.app:app --reload --port 9509 --host 0.0.0.0
