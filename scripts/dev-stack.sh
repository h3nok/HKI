#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${ROOT_DIR}/.dev"
PID_DIR="${STATE_DIR}/pids"
LOG_DIR="${STATE_DIR}/logs"
RUN_DIR="${STATE_DIR}/run"

mkdir -p "${PID_DIR}" "${LOG_DIR}" "${RUN_DIR}"

if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  DOCKER_COMPOSE=(docker compose)
fi

timestamp() {
  date +"%H:%M:%S"
}

info() {
  printf "[%s] %s\n" "$(timestamp)" "$*"
}

warn() {
  printf "[%s] WARN: %s\n" "$(timestamp)" "$*" >&2
}

error() {
  printf "[%s] ERROR: %s\n" "$(timestamp)" "$*" >&2
}

service_port() {
  case "$1" in
    knowledge-api) echo 9509 ;;
    ingestion-pipeline) echo 9508 ;;
    knowledge-api-auth) echo 9609 ;;
    ingestion-pipeline-auth) echo 9608 ;;
    orchestrator) echo 9501 ;;
    analytics) echo 9510 ;;
    agentic) echo 9001 ;;
    mysql) echo 9306 ;;
    redis) echo 9379 ;;
    postgres) echo 9432 ;;
    litellm) echo 4000 ;;
    *) error "Unknown service: $1"; exit 1 ;;
  esac
}

service_label() {
  case "$1" in
    knowledge-api) echo "knowledge-api" ;;
    ingestion-pipeline) echo "ingestion-pipeline-service" ;;
    knowledge-api-auth) echo "knowledge-api-auth" ;;
    ingestion-pipeline-auth) echo "ingestion-pipeline-auth" ;;
    orchestrator) echo "orchestrator-service" ;;
    analytics) echo "analytics-service" ;;
    agentic) echo "agentic-bff" ;;
    *) echo "$1" ;;
  esac
}

service_log() {
  printf "%s/%s.log" "${LOG_DIR}" "$1"
}

service_pid_file() {
  printf "%s/%s.pid" "${PID_DIR}" "$1"
}

service_runner_file() {
  printf "%s/%s.sh" "${RUN_DIR}" "$1"
}

service_health_url() {
  case "$1" in
    knowledge-api) echo "http://localhost:9509/health" ;;
    ingestion-pipeline) echo "http://localhost:9508/health" ;;
    knowledge-api-auth) echo "http://localhost:9609/health" ;;
    ingestion-pipeline-auth) echo "http://localhost:9608/health" ;;
    orchestrator) echo "http://localhost:9501/health" ;;
    analytics) echo "http://localhost:9510/health" ;;
    agentic) echo "http://localhost:9001/health" ;;
    *) echo "" ;;
  esac
}

launch_runner() {
  local name="$1"
  local runner="$2"
  local log_file
  log_file="$(service_log "${name}")"

  local pid
  pid="$(
    python3 - "${runner}" "${log_file}" <<'PY'
import os
import subprocess
import sys

runner = sys.argv[1]
log_file = sys.argv[2]

with open(log_file, "ab", buffering=0) as log, open(os.devnull, "rb") as devnull:
    proc = subprocess.Popen(
        ["/bin/bash", runner],
        stdin=devnull,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

print(proc.pid)
PY
  )"

  echo "${pid}" >"$(service_pid_file "${name}")"
}

pid_is_running() {
  local pid="$1"
  kill -0 "${pid}" 2>/dev/null
}

port_listener_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

terminate_pid() {
  local pid="$1"
  if ! pid_is_running "${pid}"; then
    return 0
  fi

  pkill -TERM -P "${pid}" 2>/dev/null || true
  kill -TERM "${pid}" 2>/dev/null || true

  for _ in $(seq 1 10); do
    if ! pid_is_running "${pid}"; then
      return 0
    fi
    sleep 1
  done

  warn "PID ${pid} did not exit cleanly; forcing termination"
  pkill -KILL -P "${pid}" 2>/dev/null || true
  kill -KILL "${pid}" 2>/dev/null || true
}

ensure_port_released() {
  local name="$1"
  local port
  port="$(service_port "${name}")"
  local listeners
  listeners="$(port_listener_pids "${port}")"
  if [[ -z "${listeners}" ]]; then
    return 0
  fi

  warn "Port ${port} is already in use; reclaiming it for ${name}"
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    terminate_pid "${pid}"
  done <<< "${listeners}"

  listeners="$(port_listener_pids "${port}")"
  if [[ -n "${listeners}" ]]; then
    error "Port ${port} is still busy after cleanup"
    return 1
  fi
}

wait_for_port() {
  local name="$1"
  local port
  port="$(service_port "${name}")"
  local attempts="${DEV_STACK_WAIT_ATTEMPTS:-90}"
  for _ in $(seq 1 "${attempts}"); do
    if lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  error "${name} did not bind to port ${port}"
  return 1
}

wait_for_health() {
  local name="$1"
  local health
  health="$(service_health_url "${name}")"
  if [[ -z "${health}" ]]; then
    wait_for_port "${name}"
    return 0
  fi

  wait_for_port "${name}"
  local attempts="${DEV_STACK_HEALTH_ATTEMPTS:-90}"
  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${health}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  error "${name} health check did not become ready: ${health}"
  return 1
}

start_knowledge_api() {
  local runner
  runner="$(service_runner_file knowledge-api)"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/knowledge-api"
set -a
[[ -f .env ]] && . ./.env
set +a
export ALLOYDB_URL="postgresql://postgres:postgres@localhost:9432/knowledge"
export AUTH_ENABLED="false"
export ENVIRONMENT="development"
export JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-67890}"
export KB_HERMETIC_ISOLATION="true"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-local-dev-secret-key-12345}"
exec ./.venv/bin/uvicorn src.api.app:app --reload --port 9509 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner knowledge-api "${runner}"
}

start_knowledge_api_auth() {
  local runner
  local auth_secret
  local pipeline_secret
  runner="$(service_runner_file knowledge-api-auth)"
  auth_secret="${KB_AUTH_SECRET:-kb-auth-local-dev-secret-1234567890}"
  pipeline_secret="${KB_PIPELINE_SECRET:-kb-auth-pipeline-secret-1234567890}"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/knowledge-api"
set -a
[[ -f .env ]] && . ./.env
set +a
export ALLOYDB_URL=""
export ANALYTICS_SERVICE_URL=""
export AUTH_ENABLED="true"
export EMBEDDING_GATEWAY_URL=""
export ENTITY_EXTRACTION_ENABLED="false"
export ENVIRONMENT="development"
export KB_HERMETIC_ISOLATION="true"
export JWT_SECRET="${auth_secret}"
export PIPELINE_SERVICE_SECRET="${pipeline_secret}"
export SERVICE_AUTH_SECRET="${auth_secret}"
exec ./.venv/bin/uvicorn src.api.app:app --host 127.0.0.1 --reload --port 9609 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner knowledge-api-auth "${runner}"
}

start_ingestion_pipeline() {
  local runner
  runner="$(service_runner_file ingestion-pipeline)"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/ingestion-pipeline-service"
set -a
[[ -f .env ]] && . ./.env
set +a
export KNOWLEDGE_API_URL="http://localhost:9509"
export REDIS_URL="redis://localhost:9379/0"
export AUTH_ENABLED="false"
export ENVIRONMENT="development"
export JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-67890}"
export KB_HERMETIC_ISOLATION="true"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-local-dev-secret-key-12345}"
exec ./.venv/bin/uvicorn src.api.app:app --reload --port 9508 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner ingestion-pipeline "${runner}"
}

start_ingestion_pipeline_auth() {
  local runner
  local auth_secret
  local pipeline_secret
  runner="$(service_runner_file ingestion-pipeline-auth)"
  auth_secret="${KB_AUTH_SECRET:-kb-auth-local-dev-secret-1234567890}"
  pipeline_secret="${KB_PIPELINE_SECRET:-kb-auth-pipeline-secret-1234567890}"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/ingestion-pipeline-service"
set -a
[[ -f .env ]] && . ./.env
set +a
export ANALYTICS_SERVICE_URL=""
export AUTH_ENABLED="true"
export EMBEDDING_GATEWAY_URL=""
export ENVIRONMENT="development"
export GEMINI_ENABLED="false"
export KB_HERMETIC_ISOLATION="true"
export JWT_SECRET="${auth_secret}"
export KNOWLEDGE_API_PIPELINE_SECRET="${pipeline_secret}"
export KNOWLEDGE_API_URL="http://127.0.0.1:9609"
export LLM_ENABLED="false"
export LLM_GATEWAY_URL=""
export PUBSUB_ENABLED="false"
export REDIS_URL=""
export SERVICE_AUTH_SECRET="${auth_secret}"
exec ./.venv/bin/uvicorn src.api.app:app --host 127.0.0.1 --reload --port 9608 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner ingestion-pipeline-auth "${runner}"
}

start_orchestrator() {
  local runner
  runner="$(service_runner_file orchestrator)"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/orchestrator-service"
set -a
[[ -f .env ]] && . ./.env
set +a
export REDIS_URL="redis://localhost:9379/0"
export AUTH_ENABLED="false"
export JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-67890}"
export SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-local-dev-secret-key-12345}"
exec ./.venv/bin/uvicorn src.api.app:app --reload --port 9501 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner orchestrator "${runner}"
}

start_analytics() {
  local runner
  runner="$(service_runner_file analytics)"
  cat >"${runner}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT_DIR}/analytics-service"
set -a
[[ -f .env ]] && . ./.env
set +a
export ENVIRONMENT="development"
exec ./.venv/bin/uvicorn src.api.app:app --reload --port 9510 --reload-dir src
EOF
  chmod +x "${runner}"
  launch_runner analytics "${runner}"
}

start_service() {
  local name="$1"
  ensure_port_released "${name}"

  case "${name}" in
    knowledge-api) start_knowledge_api ;;
    ingestion-pipeline) start_ingestion_pipeline ;;
    knowledge-api-auth) start_knowledge_api_auth ;;
    ingestion-pipeline-auth) start_ingestion_pipeline_auth ;;
    orchestrator) start_orchestrator ;;
    analytics) start_analytics ;;
    *) error "Unsupported start target: ${name}"; exit 1 ;;
  esac

  info "Starting ${name}..."
  if ! wait_for_health "${name}"; then
    warn "Startup failed for ${name}; recent log output:"
    tail -n 40 "$(service_log "${name}")" 2>/dev/null || true
    return 1
  fi
  info "${name} is ready on :$(service_port "${name}")"
}

stop_service() {
  local name="$1"
  local pid_file
  pid_file="$(service_pid_file "${name}")"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}")"
    terminate_pid "${pid}"
    rm -f "${pid_file}"
  fi

  ensure_port_released "${name}" || true
}

start_infra() {
  info "Starting local infrastructure..."
  (
    cd "${ROOT_DIR}/docker-compose"
    "${DOCKER_COMPOSE[@]}" up -d
  ) >/dev/null

  for dep in mysql redis postgres; do
    info "Waiting for ${dep} on :$(service_port "${dep}")..."
    wait_for_port "${dep}"
  done
  info "Infrastructure is ready"
}

restart_infra() {
  info "Restarting local infrastructure..."
  (
    cd "${ROOT_DIR}/docker-compose"
    "${DOCKER_COMPOSE[@]}" down
    "${DOCKER_COMPOSE[@]}" up -d
  ) >/dev/null

  for dep in mysql redis postgres; do
    info "Waiting for ${dep} on :$(service_port "${dep}")..."
    wait_for_port "${dep}"
  done
  info "Infrastructure is ready"
}

stop_infra() {
  info "Stopping local infrastructure..."
  (
    cd "${ROOT_DIR}/docker-compose"
    "${DOCKER_COMPOSE[@]}" stop
  ) >/dev/null || true
}

status_row() {
  local name="$1"
  local port
  port="$(service_port "${name}")"
  local pid_file
  pid_file="$(service_pid_file "${name}")"
  local pid_display="-"
  if [[ -f "${pid_file}" ]]; then
    pid_display="$(cat "${pid_file}")"
  fi

  if lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    printf "  %-22s :%-5s up    pid=%s\n" "$(service_label "${name}")" "${port}" "${pid_display}"
  else
    printf "  %-22s :%-5s down  pid=%s\n" "$(service_label "${name}")" "${port}" "${pid_display}"
  fi
}

status_infra_row() {
  local name="$1"
  local port
  port="$(service_port "${name}")"
  if lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    printf "  %-22s :%-5s up\n" "${name}" "${port}"
  else
    printf "  %-22s :%-5s down\n" "${name}" "${port}"
  fi
}

show_status() {
  echo ""
  echo "Managed local services"
  echo ""
  for name in knowledge-api ingestion-pipeline orchestrator analytics agentic; do
    status_row "${name}"
  done
  echo ""
  echo "Auth validation services"
  echo ""
  for name in knowledge-api-auth ingestion-pipeline-auth; do
    status_row "${name}"
  done
  echo ""
  echo "Local infrastructure"
  echo ""
  for name in mysql redis postgres litellm; do
    status_infra_row "${name}"
  done
  echo ""
  echo "Logs: ${LOG_DIR}"
  echo ""
}

start_managed_stack() {
  start_infra
  for name in knowledge-api ingestion-pipeline orchestrator analytics; do
    stop_service "${name}"
    start_service "${name}"
  done
  ensure_port_released agentic
}

start_full_stack() {
  start_infra
  for name in knowledge-api ingestion-pipeline orchestrator analytics; do
    stop_service "${name}"
    start_service "${name}"
  done
  ensure_port_released agentic
}

start_auth_kb_stack() {
  start_infra
  for name in knowledge-api-auth ingestion-pipeline-auth; do
    stop_service "${name}"
    start_service "${name}"
  done
}

stop_managed_stack() {
  for name in analytics orchestrator ingestion-pipeline knowledge-api agentic; do
    stop_service "${name}"
  done
}

stop_auth_kb_stack() {
  for name in ingestion-pipeline-auth knowledge-api-auth; do
    stop_service "${name}"
  done
}

usage() {
  cat <<'EOF'
Usage: scripts/dev-stack.sh <command>

Commands:
  start-services   Start infra and Python services in background
  start-full       Start infra + Python services only and free agentic port for foreground UI
  start-kb-auth    Start isolated auth-enabled KB validation services on :9608/:9609
  stop             Stop managed local services and free reserved ports
  stop-kb-auth     Stop isolated auth-enabled KB validation services
  stop-all         Stop managed local services and Docker infra
  restart          Restart managed local services
  reset            Restart Docker infra, then restart managed local services
  status           Show managed service and infra status
EOF
}

main() {
  local command="${1:-}"
  case "${command}" in
    start-services)
      start_managed_stack
      show_status
      ;;
    start-full)
      start_full_stack
      show_status
      ;;
    start-kb-auth)
      start_auth_kb_stack
      show_status
      ;;
    stop)
      stop_managed_stack
      ;;
    stop-kb-auth)
      stop_auth_kb_stack
      ;;
    stop-all)
      stop_managed_stack
      stop_auth_kb_stack
      stop_infra
      ;;
    restart)
      stop_managed_stack
      start_managed_stack
      show_status
      ;;
    reset)
      stop_managed_stack
      restart_infra
      for name in knowledge-api ingestion-pipeline orchestrator analytics; do
        start_service "${name}"
      done
      ensure_port_released agentic
      show_status
      ;;
    status)
      show_status
      ;;
    ""|-h|--help|help)
      usage
      ;;
    *)
      error "Unknown command: ${command}"
      usage
      exit 1
      ;;
  esac
}

main "${@}"
