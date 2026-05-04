#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AI Platform — GKE End-to-End Test Suite
#
# Tests every service in the k8s cluster end-to-end:
#   1. Infrastructure:  pods, HPAs, secrets, configmaps
#   2. knowledge-api:   health, readiness (AlloyDB), auth enforcement, search
#   3. orchestrator:    health, tools list, auth enforcement
#   4. ingestion-pipeline: health, job list, auth enforcement
#   5. analytics:       health, auth enforcement
#   6. agentic-bff:     health, frontend, tRPC auth
#   7. Inter-service:   Redis connectivity, cross-service JWT flow
#   8. Ingress:         IP resolution, WAF presence
#
# Uses kubectl port-forward for each service — no public IP required.
# Mints a real HS256 JWT from the k8s SECRET for authenticated tests.
#
# Usage:
#   ./scripts/test-k8s-e2e.sh
#   VERBOSE=true ./scripts/test-k8s-e2e.sh
#   NAMESPACE=platform ./scripts/test-k8s-e2e.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

NAMESPACE="${NAMESPACE:-platform}"
VERBOSE="${VERBOSE:-false}"
PF_PIDS=()

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Counters ──────────────────────────────────────────────────────────────────
PASS=0; FAIL=0; SKIP=0

pass() { PASS=$((PASS+1)); printf "  ${GREEN}✓${NC} %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "  ${RED}✗${NC} %s\n" "$1"; [ "$VERBOSE" = "true" ] && echo "    → $2" || true; }
skip() { SKIP=$((SKIP+1)); printf "  ${YELLOW}○${NC} %s\n" "$1"; }
section() { echo ""; echo -e "${BLUE}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── HTTP helpers ──────────────────────────────────────────────────────────────
http_code() { curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$@" 2>/dev/null || echo "000"; }
http_body() { curl -s --max-time 8 "$@" 2>/dev/null || echo ""; }

# ── Port-forward manager ─────────────────────────────────────────────────────
# Ports are pre-assigned as constants so that start_pf can be called inside
# $() subshell substitutions without losing the counter increment.
PF_PORT_knowledge_api=19501
PF_PORT_orchestrator=19502
PF_PORT_ingestion_pipeline=19503
PF_PORT_analytics=19504
PF_PORT_agentic_bff=19505

start_pf() {
  local svc=$1 svc_port=$2
  # Derive the pre-assigned port from the service name (hyphens → underscores).
  local port_var="PF_PORT_$(echo "$svc" | tr '-' '_')"
  local local_port="${!port_var}"
  if [ -z "$local_port" ]; then
    echo "ERROR: no pre-assigned port for service $svc" >&2
    echo "0"
    return 1
  fi
  # Kill any leftover port-forward on this port before starting a fresh one.
  # Use lsof (macOS/Linux compatible) instead of fuser (Linux-only).
  kill "$(lsof -ti "tcp:${local_port}" 2>/dev/null)" 2>/dev/null || true
  kubectl port-forward "svc/$svc" "${local_port}:${svc_port}" \
    -n "$NAMESPACE" &>/tmp/pf-${svc}.log &
  PF_PIDS+=($!)
  sleep 3
  echo "$local_port"
}

cleanup() {
  for pid in "${PF_PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# ── JWT minting ───────────────────────────────────────────────────────────────
# Reads SERVICE_AUTH_SECRET from the knowledge-api-secrets k8s Secret.
# Falls back gracefully if python3/PyJWT not available.

mint_jwt() {
  local secret
  secret=$(kubectl get secret knowledge-api-secrets -n "$NAMESPACE" \
    -o jsonpath='{.data.SERVICE_AUTH_SECRET}' 2>/dev/null | base64 --decode 2>/dev/null || echo "")

  if [ -z "$secret" ]; then
    echo ""
    return
  fi

  # Use python3 + PyJWT (available in the project venv)
  python3 - "$secret" <<'PYEOF' 2>/dev/null || echo ""
import sys, time, json, base64, hmac, hashlib

secret = sys.argv[1].encode()
now = int(time.time())

header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).rstrip(b'=').decode()
payload = base64.urlsafe_b64encode(json.dumps({
    "sub": "1",
    "name": "e2e-test",
    "role": "admin",
    "scope": "global",
    "scopes": ["global"],
    "org_id": "hki-labs",
    "iss": "agentic-bff",
    "aud": "internal-services",
    "iat": now,
    "exp": now + 300,
}).encode()).rstrip(b'=').decode()

sig_input = f"{header}.{payload}".encode()
sig = base64.urlsafe_b64encode(
    hmac.new(secret, sig_input, hashlib.sha256).digest()
).rstrip(b'=').decode()

print(f"{header}.{payload}.{sig}")
PYEOF
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   AI Platform — GKE End-to-End Test Suite                    ║${NC}"
echo -e "${BOLD}║   $(date -u '+%Y-%m-%d %H:%M UTC')                                     ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Namespace: ${CYAN}$NAMESPACE${NC}"
echo -e "  Cluster:   ${CYAN}$(kubectl config current-context 2>/dev/null || echo 'unknown')${NC}"

# ── 1. Infrastructure ─────────────────────────────────────────────────────────
section "1. Infrastructure"

# Pods
for svc in knowledge-api orchestrator ingestion-pipeline analytics agentic-bff; do
  ready=$(kubectl get deployment "$svc" -n "$NAMESPACE" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  desired=$(kubectl get deployment "$svc" -n "$NAMESPACE" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  if [ "${ready:-0}" -ge 1 ] 2>/dev/null; then
    pass "$svc — $ready/$desired pods ready"
  else
    fail "$svc — $ready/$desired pods ready" "deployment not healthy"
  fi
done

# Secrets
for s in knowledge-api-secrets orchestrator-secrets ingestion-pipeline-secrets agentic-bff-secrets analytics-secrets; do
  if kubectl get secret "$s" -n "$NAMESPACE" &>/dev/null; then
    pass "Secret: $s"
  else
    fail "Secret: $s" "missing — run sync_secrets in deploy-k8s.sh"
  fi
done

# ConfigMaps
for cm in knowledge-api-config orchestrator-config ingestion-pipeline-config agentic-bff-config analytics-config; do
  if kubectl get configmap "$cm" -n "$NAMESPACE" &>/dev/null; then
    pass "ConfigMap: $cm"
  else
    fail "ConfigMap: $cm" "missing"
  fi
done

# HPAs
for hpa in knowledge-api orchestrator ingestion-pipeline analytics agentic-bff; do
  if kubectl get hpa "$hpa" -n "$NAMESPACE" &>/dev/null; then
    pass "HPA: $hpa"
  else
    skip "HPA: $hpa (not yet applied)"
  fi
done

# ── Mint JWT for authenticated tests ─────────────────────────────────────────
section "JWT Auth Token"
JWT=$(mint_jwt)
if [ -n "$JWT" ] && echo "$JWT" | grep -qE "^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$"; then
  pass "JWT minted from k8s secret (exp +5min)"
  AUTH_HEADER="X-Service-Auth: Bearer $JWT"
else
  skip "JWT minting failed — authenticated tests will be skipped"
  AUTH_HEADER=""
fi

# ── 2. knowledge-api ──────────────────────────────────────────────────────────
section "2. knowledge-api  (port 9509)"
KA_PORT=$(start_pf "knowledge-api" 9509)
KA="http://localhost:${KA_PORT}"

H=$(http_code "$KA/health")
[ "$H" = "200" ] && pass "Health check — HTTP $H" || fail "Health check" "HTTP $H"

READY_BODY=$(http_body "$KA/ready")
if echo "$READY_BODY" | grep -q '"status":"ready"'; then
  BACKEND=$(echo "$READY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin).get('store',{}); print(d.get('backend','?'))" 2>/dev/null || echo "?")
  DOCS=$(echo "$READY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin).get('store',{}); print(d.get('documents',0))" 2>/dev/null || echo "?")
  CHUNKS=$(echo "$READY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin).get('store',{}); print(d.get('chunks',0))" 2>/dev/null || echo "?")
  pass "Ready — backend=$BACKEND, docs=$DOCS, chunks=$CHUNKS"
else
  fail "Readiness endpoint" "$READY_BODY"
fi

H=$(http_code "$KA/v1/search" -X POST -H "Content-Type: application/json" -d '{"query":"test"}')
[ "$H" = "401" ] && pass "Auth enforcement — unauthenticated blocked (HTTP $H)" \
  || fail "Auth enforcement" "Expected 401, got $H"

if [ -n "$AUTH_HEADER" ]; then
  SEARCH_RESP=$(http_body "$KA/v1/search" -X POST \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"query":"what is the knowledge platform","top_k":3,"scope":"global"}')
  if echo "$SEARCH_RESP" | grep -qE '"results"|"chunks"|"documents"'; then
    RESULT_COUNT=$(echo "$SEARCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',d.get('chunks',d.get('documents',[])))))" 2>/dev/null || echo "?")
    pass "Authenticated search — returned $RESULT_COUNT results"
  else
    fail "Authenticated search" "Unexpected response: ${SEARCH_RESP:0:120}"
  fi

  H=$(http_code "$KA/v1/documents" -H "$AUTH_HEADER")
  [ "$H" = "200" ] && pass "Document list — HTTP $H" || fail "Document list" "HTTP $H"

  H=$(http_code "$KA/v1/stats" -H "$AUTH_HEADER")
  [ "$H" = "200" ] && pass "Stats endpoint — HTTP $H" || fail "Stats endpoint" "HTTP $H"
else
  skip "Authenticated search — JWT unavailable"
  skip "Document list — JWT unavailable"
  skip "Stats endpoint — JWT unavailable"
fi

# ── 3. orchestrator ───────────────────────────────────────────────────────────
section "3. orchestrator  (port 9501)"
OR_PORT=$(start_pf "orchestrator" 9501)
OR="http://localhost:${OR_PORT}"

H=$(http_code "$OR/health")
[ "$H" = "200" ] && pass "Health check — HTTP $H" || fail "Health check" "HTTP $H"

H=$(http_code "$OR/ready")
[ "$H" = "200" ] && pass "Ready endpoint — HTTP $H" || fail "Ready endpoint" "HTTP $H"

H=$(http_code "$OR/v1/chat/stream" -X POST -H "Content-Type: application/json" -d '{}')
[ "$H" = "401" ] && pass "Auth enforcement — unauthenticated blocked (HTTP $H)" \
  || fail "Auth enforcement" "Expected 401, got $H"

if [ -n "$AUTH_HEADER" ]; then
  TOOLS_BODY=$(http_body "$OR/v1/tools" -H "$AUTH_HEADER")
  if echo "$TOOLS_BODY" | python3 -c "import sys,json; t=json.load(sys.stdin); assert len(t)>0" 2>/dev/null; then
    TOOL_COUNT=$(echo "$TOOLS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    pass "Tools registry — $TOOL_COUNT tools registered"
  else
    fail "Tools registry" "${TOOLS_BODY:0:120}"
  fi
else
  skip "Tools registry — JWT unavailable"
fi

# ── 4. ingestion-pipeline ─────────────────────────────────────────────────────
section "4. ingestion-pipeline  (port 9508)"
IP_PORT=$(start_pf "ingestion-pipeline" 9508)
IP="http://localhost:${IP_PORT}"

H=$(http_code "$IP/health")
[ "$H" = "200" ] && pass "Health check — HTTP $H" || fail "Health check" "HTTP $H"

H=$(http_code "$IP/v1/ingest/text" -X POST -H "Content-Type: application/json" -d '{"text":"test"}')
[ "$H" = "401" ] && pass "Auth enforcement — unauthenticated blocked (HTTP $H)" \
  || fail "Auth enforcement" "Expected 401, got $H"

if [ -n "$AUTH_HEADER" ]; then
  JOBS_BODY=$(http_body "$IP/v1/jobs" -H "$AUTH_HEADER")
  if echo "$JOBS_BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    JOB_COUNT=$(echo "$JOBS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else d.get('total',len(d.get('jobs',[]))))" 2>/dev/null || echo "?")
    pass "Job list — $JOB_COUNT jobs in history"
  else
    fail "Job list" "${JOBS_BODY:0:120}"
  fi

  # Ingest a small test document and verify it lands.
  # Required fields: content (str), stream_id (str).
  INGEST_RESP=$(http_body "$IP/v1/ingest/text" -X POST \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"content":"E2E test document: HKI AI Platform GKE smoke test.","stream_id":"global","title":"GKE Smoke Test","department":"Innovation"}')
  if echo "$INGEST_RESP" | grep -qE '"job_id"|"id"|"status"'; then
    JOB_ID=$(echo "$INGEST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job_id',d.get('id','?')))" 2>/dev/null || echo "?")
    pass "Text ingest submitted — job_id=$JOB_ID"
  else
    fail "Text ingest" "${INGEST_RESP:0:120}"
  fi
else
  skip "Job list — JWT unavailable"
  skip "Text ingest — JWT unavailable"
fi

# ── 5. analytics ──────────────────────────────────────────────────────────────
section "5. analytics  (port 9512)"
AN_PORT=$(start_pf "analytics" 9512)
AN="http://localhost:${AN_PORT}"

H=$(http_code "$AN/health")
[ "$H" = "200" ] && pass "Health check — HTTP $H" || fail "Health check" "HTTP $H"

H=$(http_code "$AN/ready")
[ "$H" = "200" ] && pass "Ready endpoint — HTTP $H" || fail "Ready endpoint" "HTTP $H"

# ── 6. agentic-bff ────────────────────────────────────────────────────────────
section "6. agentic-bff  (port 9001)"
BFF_PORT=$(start_pf "agentic-bff" 9001)
BFF="http://localhost:${BFF_PORT}"

H=$(http_code "$BFF/health")
[ "$H" = "200" ] && pass "Health check — HTTP $H" || fail "Health check" "HTTP $H"

H=$(http_code "$BFF/")
[ "$H" = "200" ] && pass "Frontend served — HTTP $H" || fail "Frontend served" "HTTP $H"

H=$(http_code "$BFF/login")
[ "$H" = "200" ] && pass "Login page — HTTP $H" || fail "Login page" "HTTP $H"

# tRPC auth.me — must return result structure (not an error)
TRPC_BODY=$(http_body "$BFF/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D")
if echo "$TRPC_BODY" | grep -q '"result"'; then
  pass "tRPC auth.me — responds with result structure"
else
  fail "tRPC auth.me" "${TRPC_BODY:0:120}"
fi

# Unauthenticated mutation must return 401
H=$(http_code -X POST "$BFF/api/trpc/chat.createTask?batch=1" \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"content":"test","scope":"global"}}}')
[ "$H" = "401" ] && pass "tRPC auth enforcement — mutation blocked (HTTP $H)" \
  || fail "tRPC auth enforcement" "Expected 401, got $H"

# ── 7. Inter-service connectivity ─────────────────────────────────────────────
section "7. Inter-service connectivity"

# knowledge-api /ready shows AlloyDB pool — already tested above
# Check Redis via orchestrator configmap
REDIS_URL=$(kubectl get configmap orchestrator-config -n "$NAMESPACE" \
  -o jsonpath='{.data.REDIS_URL}' 2>/dev/null || echo "")
if echo "$REDIS_URL" | grep -qE "^redis://"; then
  REDIS_HOST=$(echo "$REDIS_URL" | sed 's|redis://||' | cut -d: -f1)
  pass "Redis URL configured — $REDIS_HOST"
else
  fail "Redis URL" "orchestrator-config missing REDIS_URL"
fi

# knowledge-api configmap points at same Redis
KA_REDIS=$(kubectl get configmap knowledge-api-config -n "$NAMESPACE" \
  -o jsonpath='{.data.REDIS_URL}' 2>/dev/null || echo "")
PIPE_REDIS=$(kubectl get configmap ingestion-pipeline-config -n "$NAMESPACE" \
  -o jsonpath='{.data.REDIS_URL}' 2>/dev/null || echo "")

KA_HOST=$(echo "$KA_REDIS" | sed 's|redis://||' | cut -d: -f1)
OR_HOST=$(echo "$REDIS_URL" | sed 's|redis://||' | cut -d: -f1)
PI_HOST=$(echo "$PIPE_REDIS" | sed 's|redis://||' | cut -d: -f1)

[ "$KA_HOST" = "$OR_HOST" ] && [ "$KA_HOST" = "$PI_HOST" ] \
  && pass "All services point to same Redis ($KA_HOST)" \
  || fail "Redis consistency" "knowledge-api=$KA_HOST, orchestrator=$OR_HOST, pipeline=$PI_HOST"

# DB_PASSWORD present in knowledge-api secret (AlloyDB connectivity proven by /ready)
DB_PASS=$(kubectl get secret knowledge-api-secrets -n "$NAMESPACE" \
  -o jsonpath='{.data.DB_PASSWORD}' 2>/dev/null | base64 --decode | wc -c | tr -d ' ')
[ "${DB_PASS:-0}" -gt 8 ] \
  && pass "AlloyDB password present in secret" \
  || fail "AlloyDB password" "DB_PASSWORD missing or too short"

# Verify knowledge-api /ready shows alloydb backend with data
if echo "${READY_BODY:-}" | grep -q '"backend":"alloydb"'; then
  pass "AlloyDB connection confirmed via /ready endpoint"
else
  fail "AlloyDB connection" "backend not reporting as alloydb"
fi

# ── 8. Ingress ────────────────────────────────────────────────────────────────
section "8. Ingress & WAF"

INGRESS_IP=$(kubectl get ingress agentic-bff -n "$NAMESPACE" \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$INGRESS_IP" ]; then
  pass "Ingress provisioned — IP: $INGRESS_IP"
  H=$(http_code "http://$INGRESS_IP/" -H "Host: agentic.cilabs.np.hki.com")
  [ "$H" = "301" ] || [ "$H" = "302" ] || [ "$H" = "200" ] \
    && pass "Ingress responds — HTTP $H" || fail "Ingress responds" "HTTP $H"
else
  skip "Ingress IP not yet assigned (GCE load balancer provisioning — takes 3-5 min)"
  skip "Ingress HTTP check — waiting for IP"
fi

# Cloud Armor WAF
WAF=$(gcloud compute security-policies describe agentic-waf \
  --project=p-642-cilab-gke --format="value(name)" 2>/dev/null || echo "")
[ "$WAF" = "agentic-waf" ] \
  && pass "Cloud Armor WAF policy present" \
  || fail "Cloud Armor WAF" "agentic-waf not found in p-642-cilab-gke"

# Static IP
STATIC_IP=$(gcloud compute addresses describe cilab-platform-ip --global \
  --project=p-642-cilab-gke --format="value(address)" 2>/dev/null || echo "")
[ -n "$STATIC_IP" ] \
  && pass "Static IP reserved — $STATIC_IP" \
  || fail "Static IP" "cilab-platform-ip not found in p-642-cilab-gke"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS+FAIL+SKIP))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL ${PASS}/${TOTAL} CHECKS PASSED${NC}${YELLOW} ($SKIP skipped)${NC}"
else
  echo -e "  ${RED}${BOLD}$FAIL FAILURES${NC} · $PASS passed · $SKIP skipped · $TOTAL total"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

[ "$FAIL" -eq 0 ]
