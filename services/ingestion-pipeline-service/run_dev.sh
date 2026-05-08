#!/bin/bash
# Dev startup script for ingestion-pipeline-service
cd "$(dirname "$0")"

# Set up environment
export PYTHONPATH="${PWD}:${PYTHONPATH}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-in-prod}"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-dev-service-auth-secret-change-in-prod}"
export KNOWLEDGE_API_URL="${KNOWLEDGE_API_URL:-http://localhost:9509}"

# Start service
exec uv run uvicorn src.api.app:app --reload --port 9508 --host 0.0.0.0
