#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

created=0
updated=0
unchanged=0

info() {
  printf "[info] %s\n" "$1"
}

copy_if_missing() {
  local example_relative="$1"
  local target_relative="$2"
  local example_path="${ROOT_DIR}/${example_relative}"
  local target_path="${ROOT_DIR}/${target_relative}"

  if [[ -f "${target_path}" ]]; then
    unchanged=$((unchanged + 1))
    info "Kept existing ${target_relative}"
    return
  fi

  cp "${example_path}" "${target_path}"
  created=$((created + 1))
  info "Created ${target_relative} from ${example_relative}"
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

replace_key_value() {
  local relative_path="$1"
  local key="$2"
  local new_value="$3"
  local absolute_path="${ROOT_DIR}/${relative_path}"
  local temp_file

  temp_file="$(mktemp)"
  awk -v key="${key}" -v value="${new_value}" '
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      next
    }
    { print }
  ' "${absolute_path}" > "${temp_file}"
  mv "${temp_file}" "${absolute_path}"
}

append_key_from_example_if_missing() {
  local example_relative="$1"
  local target_relative="$2"
  local key="$3"
  local example_path="${ROOT_DIR}/${example_relative}"
  local target_path="${ROOT_DIR}/${target_relative}"
  local example_line

  [[ -f "${target_path}" ]] || return

  if grep -Eq "^[[:space:]]*${key}=" "${target_path}"; then
    return
  fi

  example_line="$(grep -E "^[[:space:]]*${key}=" "${example_path}" | tail -n 1 || true)"
  if [[ -z "${example_line}" ]]; then
    return
  fi

  printf '\n%s\n' "${example_line}" >> "${target_path}"
  updated=$((updated + 1))
  info "Added ${key} to ${target_relative} from ${example_relative}"
}

normalize_exact_value() {
  local target_relative="$1"
  local key="$2"
  local old_value="$3"
  local new_value="$4"
  local reason="$5"
  local target_path="${ROOT_DIR}/${target_relative}"
  local current_value

  [[ -f "${target_path}" ]] || return

  if ! current_value="$(read_env_value "${target_path}" "${key}")"; then
    return
  fi

  if [[ "${current_value}" != "${old_value}" ]]; then
    return
  fi

  replace_key_value "${target_relative}" "${key}" "${new_value}"
  updated=$((updated + 1))
  info "Updated ${target_relative} ${key} to ${new_value} (${reason})"
}

printf "Bootstrapping AI Platform local env files in %s\n\n" "${ROOT_DIR}"

copy_if_missing "deploy/compose/.env.example" "deploy/compose/.env"
copy_if_missing "apps/agentic/.env.example" "apps/agentic/.env"
copy_if_missing "services/orchestrator-service/.env.example" "services/orchestrator-service/.env"
copy_if_missing "services/ingestion-pipeline-service/.env.example" "services/ingestion-pipeline-service/.env"
copy_if_missing "services/knowledge-api/.env.example" "services/knowledge-api/.env"
copy_if_missing "services/analytics-service/.env.example" "services/analytics-service/.env"

append_key_from_example_if_missing \
  "services/ingestion-pipeline-service/.env.example" \
  "services/ingestion-pipeline-service/.env" \
  "KNOWLEDGE_API_URL"
append_key_from_example_if_missing \
  "services/orchestrator-service/.env.example" \
  "services/orchestrator-service/.env" \
  "ANALYTICS_SERVICE_URL"
append_key_from_example_if_missing \
  "services/knowledge-api/.env.example" \
  "services/knowledge-api/.env" \
  "ANALYTICS_SERVICE_URL"

normalize_exact_value \
  "deploy/compose/.env" \
  "LITELLM_PORT" \
  "9400" \
  "4000" \
  "local stack now standardizes LiteLLM on port 4000"
normalize_exact_value \
  "apps/agentic/.env" \
  "LLM_GATEWAY_URL" \
  "http://localhost:9400/v1" \
  "http://localhost:4000/v1" \
  "local stack now standardizes LiteLLM on port 4000"
normalize_exact_value \
  "services/orchestrator-service/.env" \
  "LLM_GATEWAY_URL" \
  "http://localhost:9400/v1" \
  "http://localhost:4000/v1" \
  "local stack now standardizes LiteLLM on port 4000"
normalize_exact_value \
  "services/knowledge-api/.env" \
  "EMBEDDING_GATEWAY_URL" \
  "http://localhost:9400/v1" \
  "http://localhost:4000/v1" \
  "local stack now standardizes LiteLLM on port 4000"
normalize_exact_value \
  "services/orchestrator-service/.env" \
  "ANALYTICS_SERVICE_URL" \
  "http://localhost:9512" \
  "http://localhost:9510" \
  "local wrappers bind analytics on port 9510"
normalize_exact_value \
  "services/knowledge-api/.env" \
  "ANALYTICS_SERVICE_URL" \
  "http://localhost:9512" \
  "http://localhost:9510" \
  "local wrappers bind analytics on port 9510"

printf "\nSummary: %d created, %d updated, %d unchanged\n" "${created}" "${updated}" "${unchanged}"
printf "Next: run 'make validate-env' to verify the local setup.\n"
