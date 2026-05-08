#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Terraform State Import — GKE Platform Infrastructure
# ═══════════════════════════════════════════════════════════════════════════════
# Run this script once to import manually-provisioned resources into Terraform
# state so subsequent `terraform plan` runs show no unexpected diffs.
#
# Pre-requisites:
#   cd apps/ai-platform/k8s/tf
#   terraform init
#
# Usage:
#   ./import.sh
#   ./import.sh --dry-run   # echo commands without executing
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi

HUB="p-642-cilab-infrastructure"
SPOKE="p-642-cilab-demo"
GKE="p-642-cilab-gke"
REGION="us-west1"
CLUSTER="cilab-platform"
NS="platform"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

tf_import() {
  local addr="$1"
  local id="$2"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}[DRY RUN]${NC} terraform import '${addr}' '${id}'"
  else
    echo -e "${BLUE}→${NC} terraform import '${addr}' '${id}'"
    terraform import "${addr}" "${id}" || echo -e "${YELLOW}  ↳ skipped (may already be in state or not exist)${NC}"
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Terraform State Import — GKE Platform                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Networking — Subnet (shared VPC, secondary ranges already added) ────────

echo -e "\n${GREEN}[1/9] Subnet${NC}"
tf_import \
  "google_compute_subnetwork.common_apps_with_ranges" \
  "projects/${HUB}/regions/${REGION}/subnetworks/common-apps-subnet"

# ── 2. Shared VPC service project attachment ───────────────────────────────────

echo -e "\n${GREEN}[2/9] Shared VPC attachment${NC}"
tf_import \
  "google_compute_shared_vpc_service_project.gke" \
  "${HUB}/${GKE}"

# ── 3. GKE node service account ───────────────────────────────────────────────

echo -e "\n${GREEN}[3/9] GKE node service account${NC}"
tf_import \
  "google_service_account.gke_node" \
  "projects/${GKE}/serviceAccounts/gke-node-sa@${GKE}.iam.gserviceaccount.com"

# ── 4. GKE Autopilot cluster ──────────────────────────────────────────────────

echo -e "\n${GREEN}[4/9] GKE Autopilot cluster${NC}"
tf_import \
  "google_container_cluster.cilab_platform" \
  "projects/${GKE}/locations/${REGION}/clusters/${CLUSTER}"

# ── 5. Memorystore Redis ───────────────────────────────────────────────────────

echo -e "\n${GREEN}[5/9] Memorystore Redis${NC}"
tf_import \
  "google_redis_instance.platform" \
  "projects/${HUB}/locations/${REGION}/instances/platform-redis"

# ── 6. AlloyDB PSC — static IP + forwarding rule ──────────────────────────────

echo -e "\n${GREEN}[6/9] AlloyDB PSC IP address${NC}"
tf_import \
  "google_compute_address.alloydb_psc_ip" \
  "projects/${HUB}/regions/${REGION}/addresses/alloydb-knowledge-psc-ip"

echo -e "\n${GREEN}[6b] AlloyDB PSC forwarding rule${NC}"
tf_import \
  "google_compute_forwarding_rule.alloydb_psc" \
  "projects/${HUB}/regions/${REGION}/forwardingRules/alloydb-knowledge-psc"

# ── 7. Cloud DNS ───────────────────────────────────────────────────────────────

echo -e "\n${GREEN}[7/9] Cloud DNS managed zone${NC}"
tf_import \
  "google_dns_managed_zone.alloydb_psc" \
  "projects/${HUB}/managedZones/alloydb-psc"

echo -e "\n${GREEN}[7b] Cloud DNS A record${NC}"
tf_import \
  "google_dns_record_set.alloydb_knowledge_psc" \
  "${HUB}/alloydb-psc/c0b844b4-95f2-4300-9167-d24ecea0ad35.d62a1b11-a89a-49bf-8144-49643195eaf3.${REGION}.alloydb-psc.goog./A"

# ── 8. GCP service accounts (spoke project) ───────────────────────────────────

echo -e "\n${GREEN}[8/9] GCP service accounts${NC}"
for sa in orchestrator-sa knowledge-api-sa ingestion-pipeline-sa agentic-bff-sa analytics-sa; do
  local_name="${sa//-/_}"
  local_name="${local_name//_sa/}"
  # Map SA IDs to TF resource names
  case "$sa" in
    orchestrator-sa)       tf_addr="google_service_account.orchestrator" ;;
    knowledge-api-sa)      tf_addr="google_service_account.knowledge_api" ;;
    ingestion-pipeline-sa) tf_addr="google_service_account.ingestion_pipeline" ;;
    agentic-bff-sa)        tf_addr="google_service_account.agentic_bff" ;;
    analytics-sa)          tf_addr="google_service_account.analytics" ;;
  esac
  tf_import \
    "${tf_addr}" \
    "projects/${SPOKE}/serviceAccounts/${sa}@${SPOKE}.iam.gserviceaccount.com"
done

# ── 9. Workload Identity bindings (SA IAM members) ────────────────────────────

echo -e "\n${GREEN}[9/9] Workload Identity bindings${NC}"
WIF_POOL="${GKE}.svc.id.goog"

declare -A WIF_MAP=(
  ["google_service_account_iam_member.wif_orchestrator"]="orchestrator-sa orchestrator"
  ["google_service_account_iam_member.wif_knowledge_api"]="knowledge-api-sa knowledge-api"
  ["google_service_account_iam_member.wif_ingestion_pipeline"]="ingestion-pipeline-sa ingestion-pipeline"
  ["google_service_account_iam_member.wif_agentic_bff"]="agentic-bff-sa agentic-bff"
  ["google_service_account_iam_member.wif_analytics"]="analytics-sa analytics"
)

for tf_addr in "${!WIF_MAP[@]}"; do
  read -r sa_name k8s_name <<< "${WIF_MAP[$tf_addr]}"
  sa_id="projects/${SPOKE}/serviceAccounts/${sa_name}@${SPOKE}.iam.gserviceaccount.com"
  member="serviceAccount:${WIF_POOL}[${NS}/${k8s_name}]"
  tf_import "${tf_addr}" "${sa_id} roles/iam.workloadIdentityUser ${member}"
done

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Import complete. Verify with:"
echo "  terraform plan"
echo ""
echo "Note: google_project_service and google_project_iam_member resources"
echo "are additive/idempotent — no import needed; terraform apply is safe."
echo ""
echo "Note: null_resource.alloydb_psc_consumers cannot be meaningfully"
echo "imported. If the PSC consumer projects are already set (ACCEPTED),"
echo "you can taint it to re-run, or leave as-is (curl will re-PATCH)."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
