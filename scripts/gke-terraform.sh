#!/usr/bin/env bash
set -euo pipefail

# Canonical Terraform wrapper for the AI Platform GKE stack.
# Prefer Make targets:
#   make gke-tf-bootstrap
#   make gke-validate
#   make gke-plan
#   make gke-infra
#   make observability-plan

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="${TF_DIR:-$AI_PLATFORM_DIR/k8s/tf}"
TERRAFORM_BIN="${TERRAFORM_BIN:-terraform}"
DRY_RUN="${DRY_RUN:-false}"
TF_RECONFIGURE="${TF_RECONFIGURE:-true}"
TF_BACKEND="${TF_BACKEND:-true}"
TF_AUTO_APPROVE="${TF_AUTO_APPROVE:-true}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$AI_PLATFORM_DIR/.env.deploy}"

log_info() { echo "[INFO] $1"; }
log_success() { echo "[OK] $1"; }
log_error() { echo "[ERROR] $1" >&2; }
log_step() { printf '\n== %s ==\n' "$1"; }

usage() {
    cat <<EOF
AI Platform GKE Terraform wrapper

Usage:
  scripts/gke-terraform.sh bootstrap        Initialize backend and providers
  scripts/gke-terraform.sh validate         Backend-free provider bootstrap + terraform validate
  scripts/gke-terraform.sh plan [args...]   Initialize backend and run terraform plan
  scripts/gke-terraform.sh apply [args...]  Initialize backend and run terraform apply

Environment:
  DRY_RUN=true                              Print commands without running them
  TF_DIR=path                               Override Terraform directory
  TF_BACKEND=false                          Initialize without backend for bootstrap/plan/apply
  TF_RECONFIGURE=false                      Skip terraform init -reconfigure
  TF_AUTO_APPROVE=false                     Do not add -auto-approve to apply
    DEPLOY_ENV_FILE=path                      Optional env file to source before running Terraform
  OBSERVABILITY_NOTIFICATION_CHANNEL_IDS    Comma-separated Monitoring channel IDs
  OBSERVABILITY_PLATFORM_ERROR_THRESHOLD    Override platform error alert threshold
  OBSERVABILITY_INGESTION_ERROR_THRESHOLD   Override ingestion failure alert threshold

Examples:
  make observability-validate
  make observability-plan
  OBSERVABILITY_NOTIFICATION_CHANNEL_IDS='projects/x/notificationChannels/123' make observability-plan
EOF
}

load_deploy_env() {
    if [ ! -f "$DEPLOY_ENV_FILE" ]; then
        return
    fi

    log_info "Loading deploy env from $DEPLOY_ENV_FILE"
    # shellcheck disable=SC1090
    set -a
    . "$DEPLOY_ENV_FILE"
    set +a
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "Missing required command: $1"
        exit 1
    fi
}

run() {
    if [ "$DRY_RUN" = "true" ]; then
        printf '[DRY RUN]'
        printf ' %q' "$@"
        echo ""
        return 0
    fi
    "$@"
}

run_terraform_init() {
    if [ "$DRY_RUN" = "true" ]; then
        run "$@"
        return 0
    fi

    local output
    if output="$($@ 2>&1)"; then
        echo "$output"
        return 0
    fi

    echo "$output" >&2
    if echo "$output" | grep -Eiq "vpcServiceControls|organization's policy|storage.objects.create access"; then
        log_error "Terraform backend access is blocked before planning can start."
        log_error "Run this from an approved network/perimeter context, such as the expected HKI workstation/VPN path or Cloud Shell with access to the GCS state bucket."
        log_error "Backend-free syntax validation is still available with: make observability-validate"
    fi
    return 1
}

json_list_from_csv() {
    local csv="$1"
    local result="["
    local first="true"
    local item
    local items

    IFS=',' read -ra items <<< "$csv"
    for item in "${items[@]}"; do
        item="${item#${item%%[![:space:]]*}}"
        item="${item%${item##*[![:space:]]}}"
        [ -z "$item" ] && continue
        item="${item//\\/\\\\}"
        item="${item//\"/\\\"}"
        if [ "$first" = "true" ]; then
            first="false"
        else
            result+=","
        fi
        result+="\"$item\""
    done
    result+="]"
    echo "$result"
}

export_observability_vars() {
    if [ -n "${OBSERVABILITY_NOTIFICATION_CHANNEL_IDS:-}" ]; then
        export TF_VAR_observability_notification_channel_ids
        TF_VAR_observability_notification_channel_ids="$(json_list_from_csv "$OBSERVABILITY_NOTIFICATION_CHANNEL_IDS")"
    fi

    if [ -n "${OBSERVABILITY_PLATFORM_ERROR_THRESHOLD:-}" ]; then
        export TF_VAR_observability_platform_error_threshold="$OBSERVABILITY_PLATFORM_ERROR_THRESHOLD"
    fi

    if [ -n "${OBSERVABILITY_INGESTION_ERROR_THRESHOLD:-}" ]; then
        export TF_VAR_observability_ingestion_error_threshold="$OBSERVABILITY_INGESTION_ERROR_THRESHOLD"
    fi
}

terraform_init() {
    require_command "$TERRAFORM_BIN"
    log_step "Terraform bootstrap - GKE platform stack"

    local args=("init" "-input=false" "-upgrade")
    if [ "$TF_BACKEND" = "false" ]; then
        args+=("-backend=false")
    elif [ "$TF_RECONFIGURE" = "true" ]; then
        args+=("-reconfigure")
    fi

    run_terraform_init "$TERRAFORM_BIN" -chdir="$TF_DIR" "${args[@]}"
    log_success "Terraform bootstrap complete"
}

terraform_validate() {
    require_command "$TERRAFORM_BIN"
    log_step "Terraform validate - backend-free"

    local tfdata
    tfdata="$(mktemp -d /tmp/ai-platform-gke-tf.XXXXXX)"
    cleanup() { rm -rf "$tfdata"; }
    trap cleanup EXIT

    run env TF_DATA_DIR="$tfdata" "$TERRAFORM_BIN" -chdir="$TF_DIR" init -backend=false -input=false -upgrade
    run env TF_DATA_DIR="$tfdata" "$TERRAFORM_BIN" -chdir="$TF_DIR" validate

    trap - EXIT
    cleanup
    log_success "Terraform validation complete"
}

terraform_plan() {
    export_observability_vars
    terraform_init
    log_step "Terraform plan - GKE platform stack"
    run "$TERRAFORM_BIN" -chdir="$TF_DIR" plan "$@"
}

terraform_apply() {
    export_observability_vars
    terraform_init
    log_step "Terraform apply - GKE platform stack"

    local args=("apply")
    if [ "$TF_AUTO_APPROVE" = "true" ]; then
        args+=("-auto-approve")
    fi
    args+=("$@")

    run "$TERRAFORM_BIN" -chdir="$TF_DIR" "${args[@]}"
}

main() {
    load_deploy_env

    local command="${1:-help}"
    shift || true

    case "$command" in
        bootstrap) terraform_init "$@" ;;
        validate) terraform_validate "$@" ;;
        plan) terraform_plan "$@" ;;
        apply) terraform_apply "$@" ;;
        help|-h|--help) usage ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
