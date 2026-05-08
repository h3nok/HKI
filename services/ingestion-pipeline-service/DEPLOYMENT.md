# Ingestion Pipeline Service - Deployment Guide

> Production note
>
> This document describes the legacy/demo Cloud Run deployment path for the ingestion pipeline service.
> The canonical production path for the AI Platform knowledge base is GKE via [../scripts/deploy-k8s.sh](../scripts/deploy-k8s.sh), where the ingestion API and the ingestion worker run as separate deployments and can be verified with [../scripts/verify-kb-runtime.sh](../scripts/verify-kb-runtime.sh).

## Prerequisites

- Google Cloud CLI (`gcloud`) configured
- Docker installed
- Terraform installed
- Access to GCP project: `p-642-cilab-demo`
- Artifact Registry: `demo-registry` in `us-west1`

## Step 1: Configure Secrets

Before deploying, you need to create and populate the required secrets in Google Secret Manager.

### Required Secrets

```bash
# Set your project
PROJECT_ID="p-642-cilab-demo"
REGION="us-west1"

# 1. Knowledge API Key (for sending processed documents)
# Get this from the knowledge-api service account or generate one
gcloud secrets create pipeline-knowledge-api-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

echo "YOUR_KNOWLEDGE_API_KEY" | gcloud secrets versions add pipeline-knowledge-api-key \
  --project=$PROJECT_ID \
  --data-file=-

# 2. Redis URL (for job state persistence)
# Format: redis://host:port or redis://host:port/db
# If you don't have Redis yet, you can use a placeholder and deploy Redis later
gcloud secrets create pipeline-redis-url \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

echo "redis://your-redis-host:6379" | gcloud secrets versions add pipeline-redis-url \
  --project=$PROJECT_ID \
  --data-file=-
```

### Verify Secrets

```bash
# List all secrets
gcloud secrets list --project=$PROJECT_ID | grep pipeline

# View secret metadata (not the actual value)
gcloud secrets describe pipeline-knowledge-api-key --project=$PROJECT_ID
gcloud secrets describe pipeline-redis-url --project=$PROJECT_ID
```

## Step 2: Build and Push Container

```bash
# Navigate to the service directory
cd apps/ai-platform/ingestion-pipeline-service

# Run the deployment script
./deploy.sh
```

This script will:

1. Build the Docker image from the parent directory context
2. Tag it as `us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/ingestion-pipeline-service:latest`
3. Push to Artifact Registry

### Manual Build (if needed)

```bash
# From apps/ai-platform/ directory
cd apps/ai-platform

docker build -f ingestion-pipeline-service/Dockerfile \
  -t us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/ingestion-pipeline-service:latest .

docker push us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/ingestion-pipeline-service:latest
```

## Step 3: Deploy Infrastructure with Terraform

```bash
# Navigate to terraform directory
cd tf/

# Initialize Terraform (first time only)
terraform init

# Review the deployment plan
terraform plan

# Apply the infrastructure
terraform apply
```

### What Gets Created

Terraform will create:

1. **Cloud Run Service**
   - Service: `ingestion-pipeline-service`
   - Port: 9508
   - VPC-connected to `cilab-shared-vpc`
   - Service account: `cloudrun-sa`

2. **Cloud Storage Bucket**
   - Name: `cilab-demo-knowledge-documents`
   - Versioning enabled
   - 90-day lifecycle policy

3. **Pub/Sub Resources**
   - Topic: `ingestion-pipeline-documents`
   - Subscription: `ingestion-pipeline-documents-sub`
   - Dead letter topic: `ingestion-pipeline-dead-letter`

4. **IAM Permissions**
   - Storage bucket access
   - Pub/Sub publisher/subscriber
   - Secret Manager accessor

## Step 4: Verify Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe ingestion-pipeline-service \
  --region=us-west1 \
  --project=p-642-cilab-demo \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl $SERVICE_URL/health

# Test API docs
curl $SERVICE_URL/docs
```

## Step 5: Test Document Upload

```bash
# Upload a test document
curl -X POST $SERVICE_URL/api/v1/documents/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-document.pdf" \
  -F "title=Test Document" \
  -F "document_type=general" \
  -F "department=Engineering"

# Check job status
curl $SERVICE_URL/api/v1/jobs
```

## Configuration Updates

### Update Secret Values

```bash
# Update Knowledge API key
echo "NEW_API_KEY" | gcloud secrets versions add pipeline-knowledge-api-key \
  --project=p-642-cilab-demo \
  --data-file=-

# Update Redis URL
echo "redis://new-host:6379" | gcloud secrets versions add pipeline-redis-url \
  --project=p-642-cilab-demo \
  --data-file=-

# Restart Cloud Run to pick up new secrets
gcloud run services update ingestion-pipeline-service \
  --region=us-west1 \
  --project=p-642-cilab-demo
```

### Update Service Configuration

Edit `tf/terraform.tfvars` and run `terraform apply`:

```hcl
# Update knowledge API URL
knowledge_api_url = "https://new-knowledge-api-url"

# Update GCS bucket name (requires recreate)
gcs_bucket_name = "new-bucket-name"
```

## Troubleshooting

### Check Service Logs

```bash
# Stream logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=ingestion-pipeline-service" \
  --project=p-642-cilab-demo

# View recent errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ingestion-pipeline-service AND severity>=ERROR" \
  --project=p-642-cilab-demo \
  --limit=50
```

### Check Secret Access

```bash
# Verify service account has access
gcloud secrets get-iam-policy pipeline-knowledge-api-key \
  --project=p-642-cilab-demo

# Should show: serviceAccount:cloudrun-sa@p-642-cilab-demo.iam.gserviceaccount.com
```

### Check Pub/Sub

```bash
# View topic
gcloud pubsub topics describe ingestion-pipeline-documents \
  --project=p-642-cilab-demo

# View pending messages
gcloud pubsub subscriptions describe ingestion-pipeline-documents-sub \
  --project=p-642-cilab-demo
```

## Teardown

```bash
# Destroy all infrastructure
cd tf/
terraform destroy

# Delete secrets (if needed)
gcloud secrets delete pipeline-knowledge-api-key --project=p-642-cilab-demo
gcloud secrets delete pipeline-redis-url --project=p-642-cilab-demo
```

## Next Steps

1. Configure Document AI processor (optional) for better PDF extraction
2. Set up monitoring and alerting
3. Configure custom domain with Cloud Load Balancer
4. Enable IAP for authentication
5. Set up CI/CD pipeline
