#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# AI Platform - Pre-Deployment Validation
# Checks all prerequisites before running actual deployment
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
HUB_PROJECT_ID="${HUB_PROJECT_ID:-p-642-cilab-infrastructure}"
SPOKE_PROJECT_ID="${SPOKE_PROJECT_ID:-p-642-cilab-demo}"
PROJECT_ID="${SPOKE_PROJECT_ID}"
REGION="${REGION:-us-west1}"
REGISTRY_NAME="${REGISTRY_NAME:-demo-registry}"

# Track validation status
ALL_CHECKS_PASSED=true

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

log_check() {
    echo -e "${BLUE}▶${NC} Checking: $1"
}

log_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
}

log_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ALL_CHECKS_PASSED=false
}

log_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Validation Checks
# ═══════════════════════════════════════════════════════════════════════════════

check_gcloud_installed() {
    log_check "gcloud CLI installed"
    if command -v gcloud &> /dev/null; then
        version=$(gcloud version --format="value(core)" 2>/dev/null)
        log_pass "Found gcloud version $version"
    else
        log_fail "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    fi
}

check_docker_installed() {
    log_check "Docker installed"
    if command -v docker &> /dev/null; then
        version=$(docker --version | cut -d' ' -f3 | tr -d ',')
        log_pass "Found Docker version $version"
    else
        log_fail "Docker not found. Install from: https://docs.docker.com/get-docker/"
    fi
}

check_docker_running() {
    log_check "Docker daemon running"
    if docker info &> /dev/null; then
        log_pass "Docker daemon is running"
    else
        log_fail "Docker daemon not running. Start Docker Desktop."
    fi
}

check_terraform_installed() {
    log_check "Terraform installed"
    if command -v terraform &> /dev/null; then
        version=$(terraform version -json | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
        log_pass "Found Terraform version $version"
    else
        log_fail "Terraform not found. Install from: https://www.terraform.io/downloads"
    fi
}

check_gcloud_auth() {
    log_check "gcloud authentication"
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
    if [ -n "$ACTIVE_ACCOUNT" ]; then
        log_pass "Authenticated as: $ACTIVE_ACCOUNT"
    else
        log_fail "Not authenticated. Run: gcloud auth login"
    fi
}

check_gcloud_project() {
    log_check "gcloud project set"
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$CURRENT_PROJECT" = "$SPOKE_PROJECT_ID" ]; then
        log_pass "Project set to: $SPOKE_PROJECT_ID (spoke project)"
    elif [ "$CURRENT_PROJECT" = "$HUB_PROJECT_ID" ]; then
        log_warn "Project set to hub ($HUB_PROJECT_ID), should be spoke ($SPOKE_PROJECT_ID)"
        log_warn "Run: gcloud config set project $SPOKE_PROJECT_ID"
    else
        log_warn "Current project: $CURRENT_PROJECT (expected: $SPOKE_PROJECT_ID)"
        log_warn "Run: gcloud config set project $SPOKE_PROJECT_ID"
    fi
}

check_docker_auth() {
    log_check "Docker authentication for Artifact Registry"
    if gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet 2>/dev/null; then
        log_pass "Docker authenticated for ${REGION}-docker.pkg.dev"
    else
        log_warn "Docker auth may not be configured"
        log_warn "Run: gcloud auth configure-docker ${REGION}-docker.pkg.dev"
    fi
}

check_artifact_registry() {
    log_check "Artifact Registry exists"
    registry_exists=$(gcloud artifacts repositories describe "$REGISTRY_NAME" \
        --location="$REGION" \
        --format="value(name)" 2>/dev/null || echo "")

    if [ -n "$registry_exists" ]; then
        log_pass "Registry found: $REGISTRY_NAME in $REGION"
    else
        log_fail "Registry not found: $REGISTRY_NAME"
        log_fail "Create with: gcloud artifacts repositories create $REGISTRY_NAME --repository-format=docker --location=$REGION"
    fi
}

check_dockerfiles_exist() {
    log_check "Dockerfiles exist for all services"

    services=(
        "apps/ai-platform/knowledge-api/Dockerfile"
        "apps/ai-platform/orchestrator-service/Dockerfile"
        "apps/ai-platform/ingestion-pipeline-service/Dockerfile"
        "apps/ai-platform/agentic/Dockerfile"
        "apps/ci-portal/Dockerfile"
    )

    all_found=true
    for dockerfile in "${services[@]}"; do
        if [ -f "$MONOREPO_ROOT/$dockerfile" ]; then
            log_pass "Found: $dockerfile"
        else
            log_fail "Missing: $dockerfile"
            all_found=false
        fi
    done
}

check_terraform_dirs() {
    log_check "Terraform directories exist"

    tf_dirs=(
        "apps/ai-platform/knowledge-api/tf"
        "apps/ai-platform/orchestrator-service/tf"
        "apps/ai-platform/ingestion-pipeline-service/tf"
        "apps/ai-platform/k8s/tf"
        "apps/ci-portal/tf"
    )

    for tf_dir in "${tf_dirs[@]}"; do
        if [ -d "$MONOREPO_ROOT/$tf_dir" ]; then
            log_pass "Found: $tf_dir"
        else
            log_fail "Missing: $tf_dir"
        fi
    done
}

check_required_secrets() {
    log_check "Required secrets exist in Secret Manager"

    # This is a basic check - you may want to expand based on actual secret names
    common_secrets=(
        "service-auth-token"
    )

    for secret in "${common_secrets[@]}"; do
        if gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
            log_pass "Found secret: $secret"
        else
            log_warn "Secret not found: $secret (you may need to create it)"
        fi
    done
}

check_apis_enabled() {
    log_check "Required GCP APIs enabled"

    required_apis=(
        "run.googleapis.com"
        "artifactregistry.googleapis.com"
        "secretmanager.googleapis.com"
    )

    for api in "${required_apis[@]}"; do
        if gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
            log_pass "API enabled: $api"
        else
            log_fail "API not enabled: $api"
            log_fail "Enable with: gcloud services enable $api"
        fi
    done
}

check_disk_space() {
    log_check "Sufficient disk space"

    # Get available space in GB (works on macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_gb=$(df -g "$MONOREPO_ROOT" | tail -1 | awk '{print $4}')
    else
        available_gb=$(df -BG "$MONOREPO_ROOT" | tail -1 | awk '{print $4}' | tr -d 'G')
    fi

    if [ "$available_gb" -ge 20 ]; then
        log_pass "Available disk space: ${available_gb}GB"
    else
        log_warn "Low disk space: ${available_gb}GB (recommend at least 20GB for Docker builds)"
    fi
}

check_network_connectivity() {
    log_check "Network connectivity to GCP"

    if curl -s --max-time 5 https://cloud.google.com > /dev/null; then
        log_pass "Can reach cloud.google.com"
    else
        log_fail "Cannot reach cloud.google.com - check internet connection"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Validation Flow
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║   AI Platform - Pre-Deployment Validation                    ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Hub Project: $HUB_PROJECT_ID (shared infrastructure)"
    echo "Spoke Project: $SPOKE_PROJECT_ID (services)"
    echo "Region: $REGION"
    echo ""

    log_section "1. System Requirements"
    check_gcloud_installed
    check_docker_installed
    check_terraform_installed
    check_docker_running
    check_disk_space
    check_network_connectivity

    log_section "2. Authentication & Configuration"
    check_gcloud_auth
    check_gcloud_project
    check_docker_auth

    log_section "3. GCP Resources"
    check_apis_enabled
    check_artifact_registry
    check_required_secrets

    log_section "4. Repository Structure"
    check_dockerfiles_exist
    check_terraform_dirs

    # Final summary
    echo ""
    log_section "📊 VALIDATION SUMMARY"
    echo ""

    if [ "$ALL_CHECKS_PASSED" = true ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✓ All validation checks passed!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "You're ready to deploy! Run:"
        echo ""
        echo "  # Dry run first"
        echo "  DRY_RUN=true ./scripts/deploy-k8s.sh"
        echo ""
        echo "  # Then actual deployment"
        echo "  ./scripts/deploy-k8s.sh"
        echo ""
        exit 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}✗ Some validation checks failed${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Please fix the issues above before deploying."
        echo ""
        exit 1
    fi
}

# Run main
main "$@"
