# Step-by-Step Deployment Plan

> Retired path note: this document describes the legacy Cloud Run deployment order and remains only for historical/break-glass reference. The canonical production path is GKE via `make -C apps/ai-platform gke-deploy`, verified with `make -C apps/ai-platform test-prod`.

## 🎯 Deployment Strategy

Historical deployment order for the retired Cloud Run stack.

## Prerequisites

```bash
# 1. Verify gcloud authentication
gcloud auth list
gcloud config set project p-642-cilab-demo

# 2. Configure Docker for Artifact Registry
gcloud auth configure-docker us-west1-docker.pkg.dev

# 3. Ensure you have access to:
# - AlloyDB instance (for knowledge-api)
# - Redis instance (for orchestrator)
# - Secret Manager
```

---

## 📋 Deployment Order

```
1. Knowledge API (no dependencies)
   ↓
2. Orchestrator Service (needs Knowledge API URL)
   ↓
3. Ingestion Pipeline (needs Knowledge API URL)
   ↓
4. Agentic BFF (needs all above URLs)
```

---

## Step 1: Deploy Knowledge API

### A. Create Secrets First

```bash
# Navigate to knowledge-api
cd apps/ai-platform/knowledge-api

# Create secrets in Secret Manager
gcloud secrets create knowledge-api-alloydb-url \
  --data-file=- <<EOF
postgresql://user:password@10.0.0.5:5432/knowledge
EOF

gcloud secrets create knowledge-api-embedding-key \
  --data-file=- <<EOF
your-litellm-api-key
EOF

gcloud secrets create knowledge-api-service-auth \
  --data-file=- <<EOF
your-service-auth-secret
EOF
```

### B. Build & Push Image

```bash
cd apps/ai-platform

# Build
docker build -f knowledge-api/Dockerfile \
  -t us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/knowledge-api:latest .

# Push
docker push us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/knowledge-api:latest
```

**Or use deploy.sh:**

```bash
cd knowledge-api
./deploy.sh
```

### C. Deploy with Terraform

```bash
cd knowledge-api/tf

# Initialize
terraform init

# Review plan
terraform plan

# Deploy
terraform apply
```

### D. **CAPTURE THE URL** ✅

```bash
# Canonical GKE path
make -C apps/ai-platform urls
make -C apps/ai-platform gke-status
```

---

## Step 2: Deploy Orchestrator Service

### A. Create Secrets

```bash
cd apps/ai-platform/orchestrator-service

# Orchestrator needs 3 secrets
gcloud secrets create orchestrator-litellm-key \
  --data-file=- <<EOF
your-litellm-api-key
EOF

gcloud secrets create orchestrator-redis-url \
  --data-file=- <<EOF
redis://10.0.0.6:6379
EOF

gcloud secrets create orchestrator-service-auth \
  --data-file=- <<EOF
your-service-auth-secret
EOF
```

### B. Update Terraform with Knowledge API URL

Edit `orchestrator-service/tf/cloud_run.tf`:

```hcl
resource "google_cloud_run_v2_service" "orchestrator" {
  # ...

  template {
    containers {
      # ...

      env {
        name  = "KNOWLEDGE_API_URL"
        value = "https://knowledge-api-abc123-uw.a.run.app"  # ← Use URL from Step 1
      }

      env {
        name  = "LITELLM_URL"
        value = "https://litellm-gateway-abc123-uw.a.run.app"  # If you have this
      }
    }
  }
}
```

**Or set via variable:**

```bash
# In orchestrator-service/tf/terraform.tfvars
knowledge_api_url = "https://knowledge-api-abc123-uw.a.run.app"
```

### C. Build & Deploy

```bash
cd apps/ai-platform/orchestrator-service

# Build & push
./deploy.sh

# Deploy
cd tf
terraform init
terraform apply
```

### D. **CAPTURE THE URL** ✅

```bash
export ORCHESTRATOR_URL=$(gcloud run services describe orchestrator-service \
  --region=us-west1 \
  --format='value(status.url)')

echo "Orchestrator URL: $ORCHESTRATOR_URL"
echo "ORCHESTRATOR_URL=$ORCHESTRATOR_URL" >> ~/deployment-urls.env
```

---

## Step 3: Deploy Ingestion Pipeline Service

### A. Create Secrets

```bash
cd apps/ai-platform/ingestion-pipeline-service

gcloud secrets create ingestion-pipeline-gcs-bucket \
  --data-file=- <<EOF
gs://hki-knowledge-docs
EOF

gcloud secrets create ingestion-pipeline-service-auth \
  --data-file=- <<EOF
your-service-auth-secret
EOF
```

### B. Update Terraform with Knowledge API URL

Edit `ingestion-pipeline-service/tf/cloud_run.tf`:

```hcl
env {
  name  = "KNOWLEDGE_API_URL"
  value = "https://knowledge-api-abc123-uw.a.run.app"  # ← From Step 1
}
```

### C. Build & Deploy

```bash
cd apps/ai-platform/ingestion-pipeline-service

./deploy.sh

cd tf
terraform init
terraform apply
```

### D. **CAPTURE THE URL** ✅

```bash
export INGESTION_PIPELINE_URL=$(gcloud run services describe ingestion-pipeline-service \
  --region=us-west1 \
  --format='value(status.url)')

echo "Ingestion Pipeline URL: $INGESTION_PIPELINE_URL"
echo "INGESTION_PIPELINE_URL=$INGESTION_PIPELINE_URL" >> ~/deployment-urls.env
```

---

## Step 4: Deploy Agentic BFF

### A. Create Secrets

```bash
gcloud secrets create agentic-database-url \
  --data-file=- <<EOF
postgresql://user:password@10.0.0.7:5432/agentic
EOF

gcloud secrets create agentic-jwt-secret \
  --data-file=- <<EOF
your-jwt-secret-min-32-chars
EOF

gcloud secrets create agentic-google-client-id \
  --data-file=- <<EOF
your-client-id.apps.googleusercontent.com
EOF

gcloud secrets create agentic-google-client-secret \
  --data-file=- <<EOF
your-client-secret
EOF
```

### B. Update the OAuth Client Outside the Repo

Authorized redirect URIs must include:

```text
https://agentic.cilabs.np.hki.com/api/auth/google/callback
https://agentic.cilabs.np.hki.com/api/connectors/google-drive/callback
```

### C. Build & Deploy

Agentic no longer has a per-service Terraform deployment directory. Deploy it
through the canonical GKE path from `apps/ai-platform`.

```bash
cd /Users/hghebrechristos/Innovation/innovationlab-monorepo/apps/ai-platform

# Canonical redeploy
make gke-deploy-agentic

# Or reuse an already-pushed image without rebuilding
./scripts/deploy-k8s.sh --skip-tf --skip-build --only agentic-bff
```

### D. **CAPTURE THE URL** ✅

```bash
export AGENTIC_URL=https://agentic.cilabs.np.hki.com

echo "Agentic BFF URL: $AGENTIC_URL"
echo "AGENTIC_URL=$AGENTIC_URL" >> ~/deployment-urls.env
```

---

## 🎉 Deployment Complete!

### Review All URLs

```bash
cat ~/deployment-urls.env
```

Output:

```
KNOWLEDGE_API_URL=https://knowledge-api-abc123-uw.a.run.app
ORCHESTRATOR_URL=https://orchestrator-service-def456-uw.a.run.app
INGESTION_PIPELINE_URL=https://ingestion-pipeline-service-ghi789-uw.a.run.app
AGENTIC_URL=https://agentic-jkl012-uw.a.run.app
```

### Test Navigation

```bash
echo "Agentic entry point: $AGENTIC_URL"
```

1. Open Agentic URL in browser
2. Log in
3. Verify AI chat works (calls Orchestrator -> Knowledge API)

---

## 📝 Quick Reference

### Service Dependencies

```
Agentic BFF (9001)
├─► Orchestrator Service (9501)
│   └─► Knowledge API (9509) via MCP
│   └─► LiteLLM Gateway
├─► Ingestion Pipeline (9508)
│   └─► Knowledge API (9509)
└─► Knowledge API (9509)
```

### Update Existing Service URLs

If you need to update a service after deploying others:

```bash
# Update Agentic after upstream service URL changes
cd apps/ai-platform
make gke-deploy-agentic

# The rollout re-syncs runtime config and restarts the GKE deployment.
```

---

## 🔧 Troubleshooting

### Check Service Health

```bash
curl https://knowledge-api-abc123-uw.a.run.app/health
curl https://orchestrator-service-def456-uw.a.run.app/health
curl https://ingestion-pipeline-service-ghi789-uw.a.run.app/health
curl https://agentic-jkl012-uw.a.run.app/health
```

### View Logs

```bash
gcloud run services logs read knowledge-api --region=us-west1 --limit=50
gcloud run services logs read orchestrator-service --region=us-west1 --limit=50
```

### Update Environment Variables

```bash
gcloud run services update agentic \
  --region=us-west1 \
  --set-env-vars="ORCHESTRATOR_URL=https://new-url.a.run.app"
```

---

## ✅ Summary

Deploy in this order, capturing URLs after each step:

1. **Knowledge API** → Get URL → Use in Steps 2, 3, 4
2. **Orchestrator** → Get URL → Use in Step 4
3. **Ingestion Pipeline** → Get URL → Use in Step 4
4. **Agentic BFF** → Final deployment

Each service's Terraform config needs the URLs from services it depends on. By deploying in order and capturing URLs, you ensure all services can communicate correctly.
