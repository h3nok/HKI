#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# AI Platform — GKE Deployment Script
# Canonical deployment script for the supported GKE runtime.
#
# Deployment order:
#   1. Infrastructure Terraform (cluster, networking, IAM, Redis, AlloyDB PSC)
#   2. Cloud Build — build & push all service images
#   3. kubectl — apply manifests in dependency order
#   4. Health checks on deployed services
#
# Usage:
#   ./scripts/deploy-k8s.sh                          # Full deploy
#   ./scripts/deploy-k8s.sh --skip-tf                # Skip Terraform
#   ./scripts/deploy-k8s.sh --skip-build             # Skip image builds
#   ./scripts/deploy-k8s.sh --only knowledge-api     # Single service
#   BUILD_MODE=local-docker ./scripts/deploy-k8s.sh  # Force local docker buildx
#   BUILD_MODE=cloud-build ./scripts/deploy-k8s.sh   # Force Cloud Build only
#   APPLY_GKE_INGRESS=true ./scripts/deploy-k8s.sh   # Also apply standalone GKE ingress
#   DRY_RUN=true ./scripts/deploy-k8s.sh             # Dry run
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$AI_PLATFORM_DIR/k8s"
TF_DIR="$K8S_DIR/tf"

# ── Configuration ─────────────────────────────────────────────────────────────
HUB_PROJECT_ID="${HUB_PROJECT_ID:-p-642-cilab-infrastructure}"
SPOKE_PROJECT_ID="${SPOKE_PROJECT_ID:-p-642-cilab-demo}"
GKE_PROJECT_ID="${GKE_PROJECT_ID:-p-642-cilab-gke}"
REGION="${REGION:-us-west1}"
CLUSTER_NAME="${CLUSTER_NAME:-cilab-platform}"
K8S_NAMESPACE="${K8S_NAMESPACE:-platform}"
REGISTRY="us-west1-docker.pkg.dev/${HUB_PROJECT_ID}/cilab"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TF="${SKIP_TF:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
APPLY_GKE_INGRESS="${APPLY_GKE_INGRESS:-false}"
BUILD_MODE="${BUILD_MODE:-auto}"
CLOUD_BUILD_SERVICE_ACCOUNT="${CLOUD_BUILD_SERVICE_ACCOUNT-projects/${HUB_PROJECT_ID}/serviceAccounts/cloudrun-sa@${HUB_PROJECT_ID}.iam.gserviceaccount.com}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-platform-redis}"
REDIS_DB_INDEX="${REDIS_DB_INDEX:-0}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$AI_PLATFORM_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
ONLY_SERVICE=""
DOCKER_AUTH_CONFIGURED=false

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error()   { echo -e "${RED}✗${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_step()    { echo ""; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

execute() {
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${YELLOW}[DRY RUN]${NC} $1"
    else
        eval "$1"
    fi
}

command_exists() {
    command -v "$1" &>/dev/null
}

service_matches_selection() {
    local service=$1
    [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "$service" ]
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tf)    SKIP_TF=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --only)       ONLY_SERVICE="$2"; shift 2 ;;
        --dry-run)    DRY_RUN=true; shift ;;
        *) log_error "Unknown argument: $1"; exit 1 ;;
    esac
done

# ── Prerequisites ─────────────────────────────────────────────────────────────

check_prereqs() {
    log_step "Checking prerequisites"

    local missing=0
    for cmd in gcloud kubectl; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Missing: $cmd"
            missing=1
        fi
    done

    if [ "$SKIP_TF" != "true" ] && ! command_exists terraform; then
        log_error "Missing: terraform"
        missing=1
    fi

    case "$BUILD_MODE" in
        auto|cloud-build|local-docker) ;;
        *)
            log_error "Invalid BUILD_MODE: $BUILD_MODE (expected auto, cloud-build, or local-docker)"
            missing=1
            ;;
    esac

    if [ "$SKIP_BUILD" != "true" ]; then
        if [ "$BUILD_MODE" = "local-docker" ] && ! command_exists docker; then
            log_error "Missing: docker (required for BUILD_MODE=local-docker)"
            missing=1
        elif [ "$BUILD_MODE" = "auto" ] && ! command_exists docker; then
            log_warning "docker not found; automatic fallback to local docker buildx will be unavailable"
        fi
    fi

    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
    if [ -z "$ACTIVE_ACCOUNT" ]; then
        log_error "Not authenticated with gcloud. Run: gcloud auth login"
        missing=1
    fi

    [ $missing -eq 1 ] && exit 1
    log_success "Authenticated as: $ACTIVE_ACCOUNT"
}

# ── Step 1: Terraform infrastructure ──────────────────────────────────────────

apply_terraform() {
    if [ "$SKIP_TF" = "true" ]; then
        log_warning "Skipping Terraform (--skip-tf)"
        return 0
    fi

    log_step "STEP 1: Terraform — GKE infrastructure"

    execute "$SCRIPT_DIR/gke-terraform.sh apply"

    log_success "Terraform apply complete"
}

# ── Step 2: Get GKE credentials ───────────────────────────────────────────────

get_cluster_credentials() {
    log_step "STEP 2: Configuring kubectl"
    execute "gcloud container clusters get-credentials $CLUSTER_NAME \
        --region=$REGION --project=$GKE_PROJECT_ID --dns-endpoint"
    log_success "kubectl configured for cluster: $CLUSTER_NAME"
}

# ── Step 3: Build and push images ─────────────────────────────────────────────

service_cloudbuild_config() {
    case "$1" in
        knowledge-api)      echo "knowledge-api/cloudbuild.yaml" ;;
        orchestrator)       echo "orchestrator-service/cloudbuild.yaml" ;;
        ingestion-pipeline) echo "ingestion-pipeline-service/cloudbuild.yaml" ;;
        analytics)          echo "analytics-service/cloudbuild.yaml" ;;
        agentic-bff)        echo "agentic/cloudbuild.yaml" ;;
        *) return 1 ;;
    esac
}

service_dockerfile() {
    case "$1" in
        knowledge-api)      echo "knowledge-api/Dockerfile" ;;
        orchestrator)       echo "orchestrator-service/Dockerfile" ;;
        ingestion-pipeline) echo "ingestion-pipeline-service/Dockerfile" ;;
        analytics)          echo "analytics-service/Dockerfile" ;;
        agentic-bff)        echo "agentic/Dockerfile" ;;
        *) return 1 ;;
    esac
}

service_image_name() {
    case "$1" in
        knowledge-api)      echo "knowledge-api" ;;
        orchestrator)       echo "orchestrator-service" ;;
        ingestion-pipeline) echo "ingestion-pipeline-service" ;;
        analytics)          echo "analytics" ;;
        agentic-bff)        echo "agentic" ;;
        *) return 1 ;;
    esac
}

ensure_local_build_prereqs() {
    if ! command_exists docker; then
        log_error "docker is required for local image builds"
        return 1
    fi

    if ! docker buildx version >/dev/null 2>&1; then
        log_error "docker buildx is required for local image builds"
        return 1
    fi

    if [ "$DOCKER_AUTH_CONFIGURED" != "true" ]; then
        if ! execute "gcloud auth configure-docker us-west1-docker.pkg.dev --quiet"; then
            return 1
        fi
        DOCKER_AUTH_CONFIGURED=true
    fi

    if ! execute "docker buildx inspect --bootstrap >/dev/null 2>&1 || true"; then
        return 1
    fi
}

build_image_via_cloud_build() {
    local service=$1
    local config_path=$2
    local service_account_arg=""

    if [ -n "$CLOUD_BUILD_SERVICE_ACCOUNT" ]; then
        service_account_arg="--service-account=$CLOUD_BUILD_SERVICE_ACCOUNT"
    fi

    log_info "Building $service via Cloud Build..."
    if execute "gcloud builds submit $AI_PLATFORM_DIR \
        --config=$AI_PLATFORM_DIR/$config_path \
        --project=$HUB_PROJECT_ID \
        $service_account_arg \
        --substitutions=COMMIT_SHA=$IMAGE_TAG \
        --timeout=1200s"; then
        return 0
    fi

    return 1
}

build_image_via_local_docker() {
    local service=$1
    local dockerfile=$2
    local image_name=$3
    local image_latest="$REGISTRY/$image_name:latest"
    local image_tagged="$REGISTRY/$image_name:$IMAGE_TAG"

    ensure_local_build_prereqs || return 1

    log_info "Building $service locally via docker buildx..."
    if execute "docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --sbom=false \
        -f $AI_PLATFORM_DIR/$dockerfile \
        -t $image_tagged \
        -t $image_latest \
        --push \
        $AI_PLATFORM_DIR"; then
        return 0
    fi

    return 1
}

build_selected_service() {
    local service=$1
    local config_path
    local dockerfile
    local image_name

    if ! service_matches_selection "$service"; then
        return 0
    fi

    config_path="$(service_cloudbuild_config "$service")" || {
        log_error "No Cloud Build config registered for $service"
        return 1
    }
    dockerfile="$(service_dockerfile "$service")" || {
        log_error "No Dockerfile registered for $service"
        return 1
    }
    image_name="$(service_image_name "$service")" || {
        log_error "No image name registered for $service"
        return 1
    }

    case "$BUILD_MODE" in
        auto)
            if build_image_via_cloud_build "$service" "$config_path"; then
                log_success "$service image built and pushed via Cloud Build"
                return 0
            fi

            log_warning "Cloud Build failed for $service; falling back to local docker buildx"
            build_image_via_local_docker "$service" "$dockerfile" "$image_name"
            log_success "$service image built and pushed locally"
            ;;
        cloud-build)
            build_image_via_cloud_build "$service" "$config_path"
            log_success "$service image built and pushed via Cloud Build"
            ;;
        local-docker)
            build_image_via_local_docker "$service" "$dockerfile" "$image_name"
            log_success "$service image built and pushed locally"
            ;;
    esac
}

build_image() {
    local service=$1

    if [ "$SKIP_BUILD" = "true" ]; then
        log_warning "Skipping build for $service (--skip-build)"
        return 0
    fi

    build_selected_service "$service"
}

build_all_images() {
    log_step "STEP 3: Building service images"

    # Respect --only for image builds too; agentic remains last when doing a full build.
    build_image "knowledge-api"
    build_image "orchestrator"
    build_image "ingestion-pipeline"
    build_image "analytics"
    build_image "agentic-bff"
}

# ── Step 4: Apply k8s manifests ───────────────────────────────────────────────

apply_manifest() {
    local path=$1
    execute "kubectl apply -f $path"
}

terraform_output() {
    local name=$1
    terraform -chdir="$TF_DIR" output -raw "$name" 2>/dev/null || true
}

generate_secret_value() {
    if command_exists openssl; then
        openssl rand -hex 32
        return 0
    fi

    if command_exists python3; then
        python3 -c 'import secrets; print(secrets.token_hex(32))'
        return 0
    fi

    return 1
}

ensure_connector_credentials_secret() {
    local secret_name="agentic-connector-credentials-secret"
    local secret_value

    if gcloud secrets versions access latest --secret="$secret_name" --project="$SPOKE_PROJECT_ID" >/dev/null 2>&1; then
        return 0
    fi

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would bootstrap Secret Manager secret: $secret_name"
        return 0
    fi

    if ! secret_value="$(generate_secret_value)"; then
        log_warning "Could not generate $secret_name automatically; deploy will fall back to JWT_SECRET"
        return 0
    fi

    if gcloud secrets describe "$secret_name" --project="$SPOKE_PROJECT_ID" >/dev/null 2>&1; then
        printf "%s" "$secret_value" | gcloud secrets versions add "$secret_name" --project="$SPOKE_PROJECT_ID" --data-file=- >/dev/null
    else
        printf "%s" "$secret_value" | gcloud secrets create "$secret_name" --project="$SPOKE_PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
    fi

    log_success "Bootstrapped Secret Manager secret: $secret_name"
}

sync_agentic_runtime_config() {
    local redis_host
    local redis_port
    local redis_url
    local redis_source="Terraform outputs"
    local redis_endpoint

    redis_host="$(terraform_output redis_host)"
    redis_port="$(terraform_output redis_port)"

    if [ -z "$redis_host" ] || [ -z "$redis_port" ]; then
        redis_endpoint="$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
            --region="$REGION" \
            --project="$HUB_PROJECT_ID" \
            --format='value(host,port)' 2>/dev/null || true)"
        if [ -n "$redis_endpoint" ]; then
            read -r redis_host redis_port <<< "$redis_endpoint"
            redis_source="Memorystore API"
        fi
    fi

    if [ -z "$redis_host" ] || [ -z "$redis_port" ]; then
        log_warning "Redis endpoint unavailable from Terraform outputs or Memorystore API; leaving agentic REDIS_URL unchanged"
        return 0
    fi

    redis_url="redis://${redis_host}:${redis_port}/${REDIS_DB_INDEX}"
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would patch configmap/agentic-bff-config with REDIS_URL=$redis_url"
        return 0
    fi

    kubectl patch configmap agentic-bff-config -n "$K8S_NAMESPACE" --type merge \
        -p "{\"data\":{\"REDIS_URL\":\"$redis_url\"}}" >/dev/null
    log_success "agentic-bff-config REDIS_URL synced from $redis_source"
}

run_agentic_db_migrations() {
        local pod_name="agentic-db-migrate"
        local agentic_image="$REGISTRY/$(service_image_name agentic-bff):latest"

        if [ "$DRY_RUN" = "true" ]; then
                log_warning "[DRY RUN] Would run Agentic DB migrations using $agentic_image"
                return 0
        fi

        log_info "Running Agentic DB migrations before agentic-bff rollout..."

        kubectl delete pod "$pod_name" -n "$K8S_NAMESPACE" --ignore-not-found --wait=true >/dev/null 2>&1 || true

                kubectl apply -f - <<EOF
{
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
        "name": "${pod_name}",
        "namespace": "${K8S_NAMESPACE}",
        "labels": {
            "app.kubernetes.io/name": "agentic-db-migrate",
            "app.kubernetes.io/component": "migration"
        }
    },
    "spec": {
        "restartPolicy": "Never",
        "serviceAccountName": "agentic-bff",
        "volumes": [
            {
                "name": "cloudsql",
                "emptyDir": {}
            }
        ],
        "containers": [
            {
                "name": "migrate",
                "image": "${agentic_image}",
                "imagePullPolicy": "Always",
                "command": ["sh", "-lc", "trap 'exit 0' TERM INT; while true; do sleep 3600; done"],
                "envFrom": [
                    {
                        "configMapRef": {
                            "name": "agentic-bff-config"
                        }
                    },
                    {
                        "secretRef": {
                            "name": "agentic-bff-secrets"
                        }
                    }
                ],
                "volumeMounts": [
                    {
                        "name": "cloudsql",
                        "mountPath": "/cloudsql"
                    }
                ]
            },
            {
                "name": "cloud-sql-proxy",
                "image": "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2",
                "args": [
                    "--private-ip",
                    "--unix-socket=/cloudsql",
                    "p-642-cilab-demo:us-west1:agentic-db"
                ],
                "volumeMounts": [
                    {
                        "name": "cloudsql",
                        "mountPath": "/cloudsql"
                    }
                ],
                "resources": {
                    "requests": {
                        "cpu": "100m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "500m",
                        "memory": "256Mi"
                    }
                },
                "securityContext": {
                    "runAsNonRoot": true
                }
            }
        ]
    }
}
EOF

        if ! kubectl wait --for=condition=Ready --timeout=180s pod/"$pod_name" -n "$K8S_NAMESPACE" >/dev/null; then
                log_error "Agentic DB migration pod did not become ready"
                kubectl describe pod "$pod_name" -n "$K8S_NAMESPACE" || true
                return 1
        fi

        if ! kubectl exec -n "$K8S_NAMESPACE" "$pod_name" -c migrate -- node dist/db-migrate-cli.js; then
                log_error "Agentic DB migrations failed"
                kubectl logs "$pod_name" -n "$K8S_NAMESPACE" -c cloud-sql-proxy || true
                return 1
        fi

        kubectl delete pod "$pod_name" -n "$K8S_NAMESPACE" --wait=true >/dev/null 2>&1 || true
        log_success "Agentic DB migrations completed"
}

apply_service() {
    local service=$1
    local dir=$2

    log_info "Applying manifests for $service..."
    for resource in configmap serviceaccount deployment worker-deployment service hpa worker-hpa pdb worker-pdb; do
        if [ -f "$dir/$resource.yaml" ]; then
            apply_manifest "$dir/$resource.yaml"
        fi
    done
    log_success "$service manifests applied"
}

verify_ingestion_pipeline_runtime() {
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would verify ingestion pipeline runtime settings"
        return 0
    fi

    local failures=0

    _config_value() {
        local key=$1
        kubectl get configmap ingestion-pipeline-config -n "$K8S_NAMESPACE" \
            -o "jsonpath={.data.${key}}" 2>/dev/null || true
    }

    _require_config_equals() {
        local key=$1
        local expected=$2
        local actual
        actual="$(_config_value "$key")"
        if [ "$actual" = "$expected" ]; then
            log_success "ingestion-pipeline-config ${key}=${expected}"
        else
            log_error "ingestion-pipeline-config ${key} expected '${expected}' but found '${actual}'"
            failures=$((failures + 1))
        fi
    }

    _require_config_nonempty() {
        local key=$1
        local actual
        actual="$(_config_value "$key")"
        if [ -n "$actual" ]; then
            log_success "ingestion-pipeline-config ${key} is set"
        else
            log_error "ingestion-pipeline-config ${key} is empty"
            failures=$((failures + 1))
        fi
    }

    _require_ready_deployment() {
        local deployment=$1
        local ready
        ready=$(kubectl get deployment "$deployment" -n "$K8S_NAMESPACE" \
            -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        if [ "$ready" -ge 1 ] 2>/dev/null; then
            log_success "$deployment has ready replicas"
        else
            log_error "$deployment does not have any ready replicas"
            failures=$((failures + 1))
        fi
    }

    log_info "Verifying ingestion pipeline durable runtime configuration..."
    _require_ready_deployment "ingestion-pipeline"
    _require_ready_deployment "ingestion-pipeline-worker"
    _require_config_equals "GCS_ENABLED" "true"
    _require_config_nonempty "GCS_BUCKET"
    _require_config_equals "PUBSUB_ENABLED" "true"
    _require_config_nonempty "PUBSUB_PROJECT_ID"
    _require_config_nonempty "PUBSUB_TOPIC"
    _require_config_nonempty "PUBSUB_SUBSCRIPTION"
    _require_config_nonempty "PUBSUB_DLQ_TOPIC"
    _require_config_nonempty "REDIS_URL"

    if [ "$failures" -gt 0 ]; then
        log_error "Ingestion pipeline verification failed"
        exit 1
    fi

    log_success "Ingestion pipeline runtime verified"
}

restart_deployment() {
    local deployment=$1
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would restart deployment: $deployment"
        return 0
    fi

    log_info "Restarting $deployment to pick up synced secrets/config..."
    kubectl rollout restart deployment/"$deployment" -n "$K8S_NAMESPACE"
}

wait_for_rollout() {
    local deployment=$1
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would wait for rollout: $deployment"
        return 0
    fi
    log_info "Waiting for $deployment rollout..."
    kubectl rollout status deployment/"$deployment" -n "$K8S_NAMESPACE" --timeout=300s
    log_success "$deployment is ready"
}

check_pod_health() {
    local service=$1
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "[DRY RUN] Would check health of $service"
        return 0
    fi

    local ready
    ready=$(kubectl get deployment "$service" -n "$K8S_NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired
    desired=$(kubectl get deployment "$service" -n "$K8S_NAMESPACE" \
        -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

    if [ "$ready" -ge 1 ] 2>/dev/null; then
        log_success "$service: $ready/$desired replicas ready"
    else
        log_warning "$service: $ready/$desired replicas ready (may still be starting)"
    fi
}

apply_all_manifests() {
    log_step "STEP 4: Applying k8s manifests"

    # 1. Namespace (must exist before everything else)
    apply_manifest "$K8S_DIR/namespace.yaml"

    # 2. Secrets from Secret Manager — sync k8s Secrets if they don't exist
    sync_secrets

    # 3. Services in dependency order
    if [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "knowledge-api" ]; then
        apply_service "knowledge-api" "$AI_PLATFORM_DIR/knowledge-api/k8s"
        restart_deployment "knowledge-api"
        wait_for_rollout "knowledge-api"
        check_pod_health "knowledge-api"
    fi

    if [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "analytics" ]; then
        apply_service "analytics" "$AI_PLATFORM_DIR/analytics-service/k8s"
        restart_deployment "analytics"
        wait_for_rollout "analytics"
        check_pod_health "analytics"
    fi

    if [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "ingestion-pipeline" ]; then
        apply_service "ingestion-pipeline" "$AI_PLATFORM_DIR/ingestion-pipeline-service/k8s"
        restart_deployment "ingestion-pipeline"
        restart_deployment "ingestion-pipeline-worker"
        wait_for_rollout "ingestion-pipeline"
        wait_for_rollout "ingestion-pipeline-worker"
        check_pod_health "ingestion-pipeline"
        check_pod_health "ingestion-pipeline-worker"
        verify_ingestion_pipeline_runtime
    fi

    if [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "orchestrator" ]; then
        apply_service "orchestrator" "$AI_PLATFORM_DIR/orchestrator-service/k8s"
        restart_deployment "orchestrator"
        wait_for_rollout "orchestrator"
        check_pod_health "orchestrator"
    fi

    # Agentic BFF last — depends on all above
    if [ -z "$ONLY_SERVICE" ] || [ "$ONLY_SERVICE" = "agentic-bff" ]; then
        apply_service "agentic-bff" "$AI_PLATFORM_DIR/agentic/k8s"
        sync_agentic_runtime_config
        if [ "$APPLY_GKE_INGRESS" = "true" ]; then
            apply_manifest "$AI_PLATFORM_DIR/agentic/k8s/ingress.yaml"
        fi
        run_agentic_db_migrations
        restart_deployment "agentic-bff"
        wait_for_rollout "agentic-bff"
        check_pod_health "agentic-bff"
    fi
}

# ── Step 5: Sync secrets from Secret Manager ──────────────────────────────────
# Reconciles k8s Secrets from Secret Manager.
# Existing secrets are updated in place so newly added keys are propagated.

sync_secrets() {
    log_info "Syncing secrets from Secret Manager..."

    if [ "$DRY_RUN" = "true" ]; then
        ensure_connector_credentials_secret
        for name in orchestrator-secrets knowledge-api-secrets ingestion-pipeline-secrets agentic-bff-secrets analytics-secrets; do
            log_info "  [DRY RUN] Would sync secret: $name"
        done
        log_success "Secrets sync dry run complete"
        return 0
    fi

    _upsert_secret() {
        local name=$1; shift
        log_info "  Syncing secret: $name"
        kubectl create secret generic "$name" -n "$K8S_NAMESPACE" "$@" --dry-run=client -o yaml | kubectl apply -f -
    }

    _sm() {
        gcloud secrets versions access latest --secret="$1" --project="$SPOKE_PROJECT_ID" 2>/dev/null
    }

    _sm_optional() {
        local name=$1
        local default_value="${2:-}"
        local value=""

        if value=$(gcloud secrets versions access latest --secret="$name" --project="$SPOKE_PROJECT_ID" 2>/dev/null); then
            printf "%s" "$value"
            return 0
        fi

        if [ -n "$default_value" ]; then
            log_warning "Optional secret missing: $name (using default)" >&2
            printf "%s" "$default_value"
        else
            log_warning "Optional secret missing: $name (using empty value)" >&2
            printf ""
        fi
    }

    _upsert_secret orchestrator-secrets \
        --from-literal=SERVICE_AUTH_SECRET="$(_sm agentic-jwt-secret)" \
        --from-literal=LITELLM_API_KEY="$(_sm orchestrator-litellm-api-key)" \
        --from-literal=AGENT_ENGINE_RESOURCE_NAME="$(_sm orchestrator-agent-engine-resource-name)"

    _upsert_secret knowledge-api-secrets \
        --from-literal=SERVICE_AUTH_SECRET="$(_sm knowledge-api-service-auth-secret)" \
        --from-literal=DB_PASSWORD="$(_sm knowledge-api-db-password)" \
        --from-literal=EMBEDDING_KEY="$(_sm knowledge-api-embedding-key)" \
        --from-literal=ALLOYDB_URL="$(_sm knowledge-api-alloydb-url)"

    _upsert_secret ingestion-pipeline-secrets \
        --from-literal=SERVICE_AUTH_SECRET="$(_sm pipeline-service-auth-secret)" \
        --from-literal=KNOWLEDGE_API_KEY="$(_sm pipeline-knowledge-api-key)" \
        --from-literal=LITELLM_API_KEY="$(_sm pipeline-litellm-api-key)"

    ensure_connector_credentials_secret

    _upsert_secret agentic-bff-secrets \
        --from-literal=DATABASE_URL="$(_sm agentic-database-url)" \
        --from-literal=GOOGLE_CLIENT_ID="$(_sm agentic-google-client-id)" \
        --from-literal=GOOGLE_CLIENT_SECRET="$(_sm agentic-google-client-secret)" \
        --from-literal=SUPER_ADMIN_EMAILS="$(_sm_optional agentic-super-admin-emails 'hghebrechristos@hki.com')" \
        --from-literal=CONNECTOR_CREDENTIALS_SECRET="$(_sm_optional agentic-connector-credentials-secret "$(_sm agentic-jwt-secret)")" \
        --from-literal=SMTP_HOST="$(_sm_optional agentic-smtp-host)" \
        --from-literal=SMTP_PORT="$(_sm_optional agentic-smtp-port 587)" \
        --from-literal=SMTP_USER="$(_sm_optional agentic-smtp-user)" \
        --from-literal=SMTP_PASS="$(_sm_optional agentic-smtp-pass)" \
        --from-literal=SMTP_SECURE="$(_sm_optional agentic-smtp-secure false)" \
        --from-literal=EMAIL_FROM="$(_sm_optional agentic-email-from 'AI Platform <noreply@hki.com>')" \
        --from-literal=EMAIL_ENABLED="$(_sm_optional agentic-email-enabled false)" \
        --from-literal=SERVICE_AUTH_SECRET="$(_sm agentic-jwt-secret)" \
        --from-literal=JWT_SECRET="$(_sm agentic-jwt-secret)"

    _upsert_secret analytics-secrets \
        --from-literal=SERVICE_AUTH_SECRET="$(_sm agentic-jwt-secret)"

    log_success "Secrets synced"
}

# ── Step 6: Print status ──────────────────────────────────────────────────────

print_status() {
    log_step "DEPLOYMENT SUMMARY"

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN — no changes were applied"
        return 0
    fi

    echo ""
    kubectl get pods -n "$K8S_NAMESPACE" 2>/dev/null || true
    echo ""
    if [ "$APPLY_GKE_INGRESS" = "true" ]; then
        kubectl get ingress -n "$K8S_NAMESPACE" 2>/dev/null || true
        echo ""
    fi

    log_info "Cluster:    $GKE_PROJECT_ID/$CLUSTER_NAME ($REGION)"
    log_info "Namespace:  $K8S_NAMESPACE"
    if [ "$APPLY_GKE_INGRESS" = "true" ]; then
        INGRESS_IP=$(kubectl get ingress agentic-bff -n "$K8S_NAMESPACE" \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
        log_info "Ingress IP: $INGRESS_IP"
    else
        log_info "Ingress:   Managed by shared lab load balancer"
    fi
    log_info "Agentic UI: https://agentic.cilabs.np.hki.com"
    echo ""
    log_success "GKE deployment complete"
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║   AI Platform — GKE Deployment                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""

    [ "$DRY_RUN" = "true" ] && log_warning "DRY RUN MODE — no actual changes"

    log_info "Hub:     $HUB_PROJECT_ID"
    log_info "Spoke:   $SPOKE_PROJECT_ID"
    log_info "GKE:     $GKE_PROJECT_ID"
    log_info "Cluster: $CLUSTER_NAME ($REGION)"
    [ -n "$ONLY_SERVICE" ] && log_info "Service: $ONLY_SERVICE (only)"
    echo ""

    check_prereqs
    apply_terraform
    get_cluster_credentials
    build_all_images
    apply_all_manifests
    print_status
}

main "$@"
