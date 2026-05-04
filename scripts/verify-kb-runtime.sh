#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GKE_PROJECT_ID="${GKE_PROJECT_ID:-p-642-cilab-gke}"
REGION="${REGION:-us-west1}"
CLUSTER_NAME="${CLUSTER_NAME:-cilab-platform}"
K8S_NAMESPACE="${K8S_NAMESPACE:-platform}"
SKIP_CREDENTIALS="${SKIP_CREDENTIALS:-false}"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error()   { echo -e "${RED}✗${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_prereqs() {
    local missing=0
    for cmd in gcloud kubectl; do
        if ! command_exists "$cmd"; then
            log_error "Missing required command: $cmd"
            missing=1
        fi
    done
    [ "$missing" -eq 0 ] || exit 1
}

ensure_credentials() {
    if [ "$SKIP_CREDENTIALS" = "true" ]; then
        log_warning "Skipping get-credentials because SKIP_CREDENTIALS=true"
        return 0
    fi

    log_info "Refreshing kubectl credentials for ${GKE_PROJECT_ID}/${CLUSTER_NAME}"
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --region="$REGION" \
        --project="$GKE_PROJECT_ID" \
        --dns-endpoint >/dev/null
}

deployment_ready() {
    local name=$1
    local desired
    local ready

    if ! kubectl get deployment "$name" -n "$K8S_NAMESPACE" >/dev/null 2>&1; then
        log_error "Deployment missing: $name"
        return 1
    fi

    desired="$(kubectl get deployment "$name" -n "$K8S_NAMESPACE" -o jsonpath='{.spec.replicas}')"
    ready="$(kubectl get deployment "$name" -n "$K8S_NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
    desired="${desired:-0}"
    ready="${ready:-0}"

    if [ "$ready" -ge 1 ] 2>/dev/null; then
        log_success "${name}: ${ready}/${desired} replicas ready"
        return 0
    fi

    log_error "${name}: ${ready}/${desired} replicas ready"
    return 1
}

config_value() {
    local key=$1
    kubectl get configmap ingestion-pipeline-config -n "$K8S_NAMESPACE" -o "jsonpath={.data.${key}}" 2>/dev/null || true
}

require_config_equals() {
    local key=$1
    local expected=$2
    local value
    value="$(config_value "$key")"

    if [ "$value" = "$expected" ]; then
        log_success "Config ${key}=${expected}"
        return 0
    fi

    log_error "Config ${key} expected '${expected}' but found '${value}'"
    return 1
}

require_config_nonempty() {
    local key=$1
    local value
    value="$(config_value "$key")"

    if [ -n "$value" ]; then
        log_success "Config ${key} is set"
        return 0
    fi

    log_error "Config ${key} is empty"
    return 1
}

main() {
    local failures=0

    check_prereqs
    ensure_credentials

    log_info "Checking KB runtime deployments in namespace ${K8S_NAMESPACE}"
    for deployment in \
        knowledge-api \
        analytics \
        ingestion-pipeline \
        ingestion-pipeline-worker \
        orchestrator \
        agentic-bff; do
        deployment_ready "$deployment" || failures=$((failures + 1))
    done

    log_info "Checking ingestion pipeline durable-runtime settings"
    require_config_equals GCS_ENABLED true || failures=$((failures + 1))
    require_config_nonempty GCS_BUCKET || failures=$((failures + 1))
    require_config_equals PUBSUB_ENABLED true || failures=$((failures + 1))
    require_config_nonempty PUBSUB_PROJECT_ID || failures=$((failures + 1))
    require_config_nonempty PUBSUB_TOPIC || failures=$((failures + 1))
    require_config_nonempty PUBSUB_SUBSCRIPTION || failures=$((failures + 1))
    require_config_nonempty PUBSUB_DLQ_TOPIC || failures=$((failures + 1))
    require_config_nonempty REDIS_URL || failures=$((failures + 1))

    if [ "$failures" -gt 0 ]; then
        log_error "KB runtime verification failed with ${failures} issue(s)"
        exit 1
    fi

    log_success "KB runtime verification passed"
}

main "$@"
