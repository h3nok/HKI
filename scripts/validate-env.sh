#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

errors=0
warnings=0

ok() {
  printf "[ok] %s\n" "$1"
}

warn() {
  warnings=$((warnings + 1))
  printf "[warn] %s\n" "$1"
}

fail() {
  errors=$((errors + 1))
  printf "[error] %s\n" "$1"
}

env_file_exists() {
  local relative_path="$1"
  local absolute_path="${ROOT_DIR}/${relative_path}"

  if [[ -f "${absolute_path}" ]]; then
    ok "Found ${relative_path}"
    return 0
  fi

  fail "Missing ${relative_path}. Run 'make init-env' to copy missing templates, then fill required values."
  return 1
}

read_env_value() {
  local file_path="$1"
  local key="$2"
  local match

  match="$(grep -E "^[[:space:]]*${key}=" "${file_path}" | tail -n 1 || true)"
  if [[ -z "${match}" ]]; then
    return 1
  fi

  printf '%s\n' "${match#*=}"
}

require_value() {
  local relative_path="$1"
  local key="$2"
  local description="$3"
  local absolute_path="${ROOT_DIR}/${relative_path}"
  local value

  if ! value="$(read_env_value "${absolute_path}" "${key}")"; then
    fail "${relative_path} is missing ${key} (${description}). Run 'make init-env' to backfill defaults, then review the value."
    return
  fi

  if [[ -z "${value// }" ]]; then
    fail "${relative_path} has an empty ${key} (${description})."
    return
  fi

  ok "${relative_path} sets ${key}"
}

warn_on_local_port_mismatch() {
  local relative_path="$1"
  local key="$2"
  local expected_fragment="$3"
  local message="$4"
  local absolute_path="${ROOT_DIR}/${relative_path}"
  local value

  if ! value="$(read_env_value "${absolute_path}" "${key}")"; then
    return
  fi

  if [[ "${value}" == *localhost* && "${value}" != *"${expected_fragment}"* ]]; then
    warn "${relative_path} sets ${key}=${value}. ${message}"
  fi
}

printf "Checking AI Platform local environment files in %s\n\n" "${ROOT_DIR}"

if env_file_exists "deploy/compose/.env"; then
  require_value "deploy/compose/.env" "VERTEX_PROJECT" "GCP project for local LiteLLM and Vertex AI"

  if [[ ! -f "${ROOT_DIR}/deploy/compose/creds/gcp_creds.json" ]]; then
    warn "deploy/compose/creds/gcp_creds.json is missing. Model-backed local flows will fail until this file is present."
  else
    ok "Found deploy/compose/creds/gcp_creds.json"
  fi

  warn_on_local_port_mismatch \
    "deploy/compose/.env" \
    "LITELLM_PORT" \
    "4000" \
    "Local docs and service defaults assume LiteLLM is on port 4000."
fi

if env_file_exists "agentic/.env"; then
  require_value "agentic/.env" "DATABASE_URL" "local MySQL connection string"
  require_value "agentic/.env" "ORCHESTRATOR_URL" "orchestrator base URL"
  require_value "agentic/.env" "KNOWLEDGE_API_URL" "knowledge-api base URL"
  require_value "agentic/.env" "KNOWLEDGE_PIPELINE_URL" "ingestion-pipeline base URL"
  warn_on_local_port_mismatch \
    "agentic/.env" \
    "LLM_GATEWAY_URL" \
    "4000" \
    "Agentic local dev expects the shared LiteLLM container on port 4000."
fi

if env_file_exists "orchestrator-service/.env"; then
  require_value "orchestrator-service/.env" "LLM_GATEWAY_URL" "LiteLLM gateway URL"
  require_value "orchestrator-service/.env" "KNOWLEDGE_API_URL" "knowledge-api base URL"
  warn_on_local_port_mismatch \
    "orchestrator-service/.env" \
    "ANALYTICS_SERVICE_URL" \
    "9510" \
    "Local wrappers start analytics on port 9510 even though cluster runtime uses 9512."
fi

if env_file_exists "ingestion-pipeline-service/.env"; then
  require_value "ingestion-pipeline-service/.env" "KNOWLEDGE_API_URL" "knowledge-api base URL"
fi

if env_file_exists "knowledge-api/.env"; then
  warn_on_local_port_mismatch \
    "knowledge-api/.env" \
    "ANALYTICS_SERVICE_URL" \
    "9510" \
    "Local wrappers start analytics on port 9510 even though cluster runtime uses 9512."
fi

env_file_exists "analytics-service/.env" || true

printf "\nSummary: %d error(s), %d warning(s)\n" "${errors}" "${warnings}"

if (( errors > 0 )); then
  exit 1
fi

exit 0
