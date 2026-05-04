#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTIC_DIR="${ROOT_DIR}/agentic"
DEV_STACK_SCRIPT="${ROOT_DIR}/scripts/dev-stack.sh"
STATE_DIR="${ROOT_DIR}/.dev"
LOG_DIR="${STATE_DIR}/logs"
AGENTIC_LOG="${LOG_DIR}/agentic-ui-e2e.log"
KB_AUTH_SECRET="${KB_AUTH_SECRET:-kb-auth-local-dev-secret-1234567890}"
KB_PIPELINE_SECRET="${KB_PIPELINE_SECRET:-kb-auth-pipeline-secret-1234567890}"
KB_PIPELINE_URL="${KB_PIPELINE_URL:-http://127.0.0.1:9608}"
KB_VECTOR_URL="${KB_VECTOR_URL:-http://127.0.0.1:9609}"
AGENTIC_PORT="${AGENTIC_PORT:-9101}"
AGENTIC_BASE_URL="${AGENTIC_BASE_URL:-http://127.0.0.1:${AGENTIC_PORT}}"
AGENTIC_HEALTH_URL="${AGENTIC_BASE_URL}/health"

mkdir -p "${LOG_DIR}"

STARTED_AGENTIC=0
AGENTIC_PID=""

timestamp() {
  date +"%H:%M:%S"
}

info() {
  printf "[%s] %s\n" "$(timestamp)" "$*"
}

error() {
  printf "[%s] ERROR: %s\n" "$(timestamp)" "$*" >&2
}

health_ok() {
  curl -fsS "$1" >/dev/null 2>&1
}

wait_for_health() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"

  for _ in $(seq 1 "${attempts}"); do
    if health_ok "${url}"; then
      return 0
    fi
    sleep 1
  done

  error "${name} did not become healthy at ${url}"
  return 1
}

terminate_agentic() {
  if [[ "${STARTED_AGENTIC}" -ne 1 || -z "${AGENTIC_PID}" ]]; then
    return 0
  fi

  if kill -0 "${AGENTIC_PID}" 2>/dev/null; then
    pkill -TERM -P "${AGENTIC_PID}" 2>/dev/null || true
    kill -TERM "${AGENTIC_PID}" 2>/dev/null || true
    wait "${AGENTIC_PID}" 2>/dev/null || true
  fi
}

cleanup() {
  terminate_agentic
}

trap cleanup EXIT

ensure_managed_services() {
  if health_ok "${KB_PIPELINE_URL}/health" && health_ok "${KB_VECTOR_URL}/health"; then
    info "Reusing auth-enabled knowledge services on ${KB_PIPELINE_URL#http://127.0.0.1}:${KB_VECTOR_URL#http://127.0.0.1}"
    return 0
  fi

  info "Starting auth-enabled KB services"
  KB_AUTH_SECRET="${KB_AUTH_SECRET}" KB_PIPELINE_SECRET="${KB_PIPELINE_SECRET}" \
    bash "${DEV_STACK_SCRIPT}" start-kb-auth >/dev/null
}

start_agentic_if_needed() {
  if health_ok "${AGENTIC_HEALTH_URL}"; then
    info "Reusing running agentic UI on ${AGENTIC_BASE_URL}"
    return 0
  fi

  if lsof -iTCP:"${AGENTIC_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    error "Port ${AGENTIC_PORT} is busy but ${AGENTIC_HEALTH_URL} is not healthy. Free the port or choose a different AGENTIC_PORT."
    return 1
  fi

  info "Starting agentic UI on :${AGENTIC_PORT}"
  (
    cd "${AGENTIC_DIR}"
    NODE_ENV=development \
    PORT="${AGENTIC_PORT}" \
    DEV_BYPASS=true \
    KB_HERMETIC_ISOLATION=true \
    JWT_SECRET="${KB_AUTH_SECRET}" \
    SERVICE_AUTH_SECRET="${KB_AUTH_SECRET}" \
    KNOWLEDGE_PIPELINE_URL="${KB_PIPELINE_URL}" \
    VECTOR_STORE_URL="${KB_VECTOR_URL}" \
    pnpm exec tsx watch --ignore './client/**' server/_core/index.ts
  ) >"${AGENTIC_LOG}" 2>&1 &
  AGENTIC_PID=$!
  STARTED_AGENTIC=1

  if ! wait_for_health "agentic" "${AGENTIC_HEALTH_URL}" 90; then
    tail -n 80 "${AGENTIC_LOG}" >&2 || true
    return 1
  fi
}

main() {
  ensure_managed_services
  start_agentic_if_needed

  info "Running knowledge UI e2e"
  (
    cd "${AGENTIC_DIR}"
    AGENTIC_BASE_URL="${AGENTIC_BASE_URL}" pnpm test:kb-ui-e2e
  )
  info "Knowledge UI e2e passed"
}

main "$@"
