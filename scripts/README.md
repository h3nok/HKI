# Deployment Scripts

Automated deployment scripts for the AI Platform services.

> Production deployment is now GKE-first, and the legacy Cloud Run services in `p-642-cilab-demo/us-west1` have been removed.

## Quick Start

### Testing & Validation (DO THIS FIRST!)

Before deploying, validate your environment:

```bash
# Check all prerequisites (from ai-platform directory)
./scripts/validate-deployment.sh
```

Then test the deployment logic without actually deploying:

```bash
# Dry run - simulates full GKE deployment
DRY_RUN=true ./scripts/deploy-k8s.sh

# Dry run - single service
DRY_RUN=true ./scripts/deploy-k8s.sh --only knowledge-api
```

### Full Deployment (All Services)

```bash
./scripts/deploy-k8s.sh
```

This will deploy the GKE platform services in order:

1. Knowledge API
2. Orchestrator Service
3. Ingestion Pipeline Service
4. Agentic BFF

The public entrypoint is `https://agentic.cilabs.np.hki.com`; backend services run in-cluster.

### Selective Deployment

Deploy specific services:

```bash
# Deploy only orchestrator (requires knowledge-api already deployed)
./scripts/deploy-k8s.sh --only orchestrator

# Deploy multiple services in sequence
./scripts/deploy-k8s.sh --only knowledge-api
./scripts/deploy-k8s.sh --only orchestrator

# Re-deploy agentic after updating code
./scripts/deploy-k8s.sh --only agentic
```

Available services:

- `knowledge-api`
- `orchestrator`
- `ingestion-pipeline`
- `agentic`

## Features

✅ **Pre-flight Validation** - Checks all prerequisites before deployment
✅ **Dry Run Mode** - Test deployment logic without actually deploying
✅ **Secret Sync** - Kubernetes secrets and configmaps are refreshed during deploy
✅ **Health Checks** - Verifies each service is responding
✅ **Progress Tracking** - Clear visual progress indicators
✅ **Idempotent** - Can re-run safely
✅ **Selective Rollout** - Re-deploy only the services you changed

## Configuration

Set environment variables before running:

```bash
export SPOKE_PROJECT_ID="p-642-cilab-demo"
export GKE_PROJECT_ID="p-642-cilab-gke"
export REGION="us-west1"
export REGISTRY_NAME="demo-registry"

./scripts/deploy-k8s.sh
```

Or use defaults (shown above).

## Output

Canonical deployment endpoints and rollout status are available via:

```bash
make urls
make gke-status
```

The deprecated `deployed-urls.env` file no longer tracks deleted `run.app` services.

## Prerequisites

Before running deployment scripts:

1. **Authenticate with gcloud**:

   ```bash
   gcloud auth login
   gcloud config set project p-642-cilab-demo
   ```

2. **Configure Docker for Artifact Registry**:

   ```bash
   gcloud auth configure-docker us-west1-docker.pkg.dev
   ```

3. **Create required secrets** (see [../docs/DEPLOYMENT_CHECKLIST.md](../docs/DEPLOYMENT_CHECKLIST.md)):

   ```bash
   # Knowledge API secrets
   gcloud secrets create knowledge-api-alloydb-url --data-file=...
   gcloud secrets create knowledge-api-embedding-key --data-file=...

   # Orchestrator secrets
   gcloud secrets create orchestrator-litellm-key --data-file=...
   gcloud secrets create orchestrator-redis-url --data-file=...

   # ... etc
   ```

4. **Initialize Terraform backends** (first time only):
   ```bash
   make gke-tf-bootstrap
   ```

## Workflow Example

```bash
# 1. Validate environment
./scripts/validate-deployment.sh

# 2. Fix issues
gcloud config set project p-642-cilab-demo
gcloud services enable artifactregistry.googleapis.com secretmanager.googleapis.com container.googleapis.com

# 3. Test with dry run
DRY_RUN=true ./scripts/deploy-k8s.sh

# 4. Run actual deployment
export SPOKE_PROJECT_ID="p-642-cilab-demo"
export GKE_PROJECT_ID="p-642-cilab-gke"
./scripts/deploy-k8s.sh

# 5. Access deployed services
make urls
open https://agentic.cilabs.np.hki.com
```

## Troubleshooting

### Check deployment status

```bash
# Show cluster rollout state
make gke-status

# Check orchestrator logs
kubectl -n platform logs deployment/orchestrator --tail=50
```

### Re-deploy a single service

```bash
# If orchestrator deployment failed, fix issue and re-run:
./scripts/deploy-k8s.sh --only orchestrator
```

### Clean slate

```bash
# Re-deploy everything on GKE
./scripts/deploy-k8s.sh
```

## Advanced Usage

### Custom Terraform Variables

Pass additional variables to Terraform through the Make/script wrapper:

```bash
OBSERVABILITY_NOTIFICATION_CHANNEL_IDS='projects/p-642-cilab-gke/notificationChannels/CHANNEL_ID' make observability-plan
OBSERVABILITY_NOTIFICATION_CHANNEL_IDS='projects/p-642-cilab-gke/notificationChannels/CHANNEL_ID' make observability-apply
```

### One-Time Env Setup (recommended)

To avoid retyping notification channel IDs for every deploy:

```bash
cp .env.deploy.example .env.deploy
# edit .env.deploy and set OBSERVABILITY_NOTIFICATION_CHANNEL_IDS (if needed)
```

`scripts/gke-terraform.sh` automatically sources `.env.deploy` before running
`bootstrap`, `plan`, or `apply`, so you can run:

```bash
make observability-plan
make observability-apply
```

**Email Verification for Alerts:** The `.env.deploy.example` includes a pre-configured notification channel (email). Google Cloud sends a verification link to confirm delivery. Check your email (hghebrechristos@hki.com) for a message from Google Cloud and click the verification link. If you don't receive one within a few minutes, the channel may auto-verify (corporate domains often do)—you'll know when the first alert fires.

### Dry Run

See what would be deployed without actually rolling out changes:

```bash
DRY_RUN=true ./scripts/deploy-k8s.sh
```

### CI/CD Integration

Use in GitHub Actions or other CI/CD:

```yaml
# .github/workflows/deploy.yml
- name: Deploy AI Platform
  run: |
    export SPOKE_PROJECT_ID="${{ secrets.GCP_PROJECT_ID }}"
      ./scripts/deploy-k8s.sh
```

## See Also

- [DEPLOYMENT_ORDER.md](../docs/archive/DEPLOYMENT_ORDER.md) - Historical manual deployment order
- [DEPLOYMENT_CHECKLIST.md](../docs/DEPLOYMENT_CHECKLIST.md) - Complete deployment guide
- [KB_REFERENCE_PLATFORM.md](../docs/KB_REFERENCE_PLATFORM.md) - Knowledge platform reference standard
- [NAVIGATION_GUIDE.md](../docs/archive/NAVIGATION_GUIDE.md) - Historical inter-service navigation notes
