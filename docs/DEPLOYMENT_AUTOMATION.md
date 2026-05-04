# Deployment Automation Analysis

## What the Deployment Script Handles Automatically ✅

### 1. Service URL Dependencies

The script correctly handles the dependency chain:

```

Knowledge API (no deps)
    ↓ (captures URL)
Orchestrator ← KNOWLEDGE_API_URL
    ↓ (captures URL)
Ingestion Pipeline ← KNOWLEDGE_API_URL
    ↓ (captures URLs)
Agentic BFF ← ORCHESTRATOR_URL, KNOWLEDGE_API_URL, INGESTION_PIPELINE_URL
    ↓ (captures URL)
CI Portal ← AGENTIC_URL

```

Each service:

- Deploys via the GKE rollout script with correct config and secret sync
- Waits for Kubernetes workloads to become ready
- Validates the canonical public endpoints and in-cluster connectivity
- Applies dependencies in deployment order

### 2. Docker Image Management

- Builds images from correct contexts
- Tags with registry path
- Pushes to Artifact Registry
- Terraform references latest tag

### 3. Infrastructure as Code

- Terraform state in GCS
- Idempotent deployments
- VPC networking auto-configured
- Service accounts auto-configured
- IAM bindings auto-configured

---

## What Needs Manual Setup First ⚠️

### 1. GCP Prerequisites

**APIs** (enable once):

```bash
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable alloydb.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable storage.googleapis.com
```

**Artifact Registry** (create once):

```bash
gcloud artifacts repositories create demo-registry \
  --repository-format=docker \
  --location=us-west1 \
  --project=p-642-cilab-demo
```

**GCS Terraform State Bucket** (create once):

```bash
gcloud storage buckets create gs://p-642-cilab-infrastructure-terraform-state \
  --location=us-west1 \
  --project=p-642-cilab-demo
```

### 2. Infrastructure Dependencies

**AlloyDB Cluster** (for Knowledge API):

- Needs to be created first
- Connection string required
- Database credentials required

**Redis Instance** (for Orchestrator):

- Needs to be created first
- Connection URL required

**LiteLLM Gateway** (for Orchestrator):

- Should be deployed first
- URL and API key required

**PostgreSQL Databases** (for Agentic & CI Portal):

- Cloud SQL or AlloyDB instances
- Connection strings required

### 3. Secret Values

Some secrets are **auto-generated** by Terraform:

- ✅ Service auth tokens (uses `random_password`)
- ✅ JWT secrets (uses `random_password`)

Others need **manual creation** before deployment:

- ❌ Database URLs/passwords
- ❌ Redis connection URLs
- ❌ LiteLLM API keys
- ❌ OAuth client IDs/secrets

### 4. Network Configuration

**VPC & Subnets** (must exist):

- Hub VPC: `gdx-platform-vpc-hub` or `cilab-shared-vpc`
- Subnet: `gdx-common-apps-us-west1` or `common-apps-subnet`
- Serverless VPC connector configured

**Service Accounts** (must exist):

- GKE deploy identity and runtime service accounts with proper IAM
- With proper IAM roles

---

## Recommended Setup Sequence

### Phase 1: One-Time Infrastructure (Manual)

```bash
# 1. Enable APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com alloydb.googleapis.com redis.googleapis.com

# 2. Create Artifact Registry
gcloud artifacts repositories create demo-registry \
  --repository-format=docker --location=us-west1

# 3. Create Terraform state bucket
gcloud storage buckets create gs://p-642-cilab-infrastructure-terraform-state

# 4. Deploy supporting infrastructure
# - AlloyDB cluster for Knowledge API
# - Redis instance for Orchestrator
# - Cloud SQL for Agentic/CI Portal
# - LiteLLM gateway
```

### Phase 2: Populate Secrets (Manual)

```bash
# Knowledge API secrets
echo -n "postgresql://user:pass@host/db" | \
  gcloud secrets create knowledge-api-alloydb-url --data-file=-

# Orchestrator secrets
echo -n "redis://host:6379" | \
  gcloud secrets create orchestrator-redis-url --data-file=-
echo -n "sk-litellm-key" | \
  gcloud secrets create orchestrator-litellm-key --data-file=-

# Agentic secrets
echo -n "postgresql://user:pass@host/agentic" | \
  gcloud secrets create agentic-database-url --data-file=-

# CI Portal secrets
echo -n "postgresql://user:pass@host/ciportal" | \
  gcloud secrets create ci-portal-database-url --data-file=-
```

### Phase 3: Automated Deployment (Script)

```bash
# ONE COMMAND - deploys everything in order!
cd apps/ai-platform
make deploy
```

---

## Full Flow Example

```bash
# 1. Validate prerequisites
./scripts/validate-deployment.sh

# 2. Fix any issues found

# 3. Test with dry run
DRY_RUN=true ./scripts/deploy-k8s.sh

# 4. Deploy everything
make deploy
```

The script will:

1. ✅ Build and push service images as needed
2. ✅ Sync secrets and configmaps
3. ✅ Apply Kubernetes manifests in dependency order
4. ✅ Restart workloads and wait for readiness
5. ✅ Run the post-deploy KB cleanup pass
6. ✅ Verify public endpoint and service connectivity

If you need to extend or override the cleanup pass, change the cleanup arguments on the deploy command:

```bash
POST_DEPLOY_CLEANUP_ARGS='--apply --duplicate-email you@hki.com' make deploy
```

Canonical endpoints are available via `make urls` and rollout state via `make gke-status`.

---

## What Could Be Further Automated

To make it 100% automated, you could add:

1. **Infrastructure Bootstrapping**:
   - Script to create AlloyDB, Redis, Cloud SQL
   - Script to enable all required APIs
   - Script to create Artifact Registry

2. **Secret Generation**:
   - Generate database passwords
   - Create databases automatically
   - Store credentials in Secret Manager

3. **Database Migration**:
   - Run schema migrations after deployment
   - Seed initial data

4. **Health Validation**:
   - Wait for databases to be ready
   - Test service connectivity
   - Verify end-to-end flow

---

## Summary

**What Works Automatically**: ✅

- Service deployment order
- Docker build/push
- Kubernetes apply / rollout
- Health checks
- Canonical verification

**What Needs Manual Setup**: ⚠️

- GCP APIs enabled
- Artifact Registry created
- Databases (AlloyDB, Redis, Cloud SQL)
- Secret values (DB URLs, API keys)
- VPC/network infrastructure
- Service accounts

**Bottom Line**:
The deployment script handles **service orchestration** perfectly, but you need to set up the **foundational infrastructure** first. This is actually a good separation of concerns - infrastructure is created once, but services can be deployed/redeployed many times.
