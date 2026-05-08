#!/bin/bash
set -e

# Alternative — Cloud Build (from apps/ai-platform). If the default Cloud Build SA is missing,
# pass cloudrun-sa and ensure Cloud Build Service Agent has roles/iam.serviceAccountUser on the project:
#   gcloud builds submit --config=services/orchestrator-service/cloudbuild.yaml --project=p-642-cilab-demo \
#     --service-account=projects/p-642-cilab-demo/serviceAccounts/cloudrun-sa@p-642-cilab-demo.iam.gserviceaccount.com \
#     --timeout=1200s .
#   gcloud run services update orchestrator-service --project=p-642-cilab-demo --region=us-west1 \
#     --image=us-west1-docker.pkg.dev/p-642-cilab-demo/demo-registry/orchestrator-service:latest --quiet
#
# Configuration
export SPOKE_PROJECT_ID="p-642-cilab-demo"
export REGION="us-west1"
export REGISTRY_NAME="demo-registry"
export IMAGE_NAME="orchestrator-service"
export DEPLOY_AGENT_ENGINE="${DEPLOY_AGENT_ENGINE:-false}"
# After push, point Cloud Run at the new digest (set false to only push the image)
export UPDATE_CLOUD_RUN="${UPDATE_CLOUD_RUN:-true}"

IMAGE_URI="${REGION}-docker.pkg.dev/${SPOKE_PROJECT_ID}/${REGISTRY_NAME}/${IMAGE_NAME}:latest"

echo "🔨 Building Orchestrator Service container image (linux/amd64 for Cloud Run)..."
cd "$(dirname "$0")/../.."

# Cloud Run runs amd64; default docker build on Apple Silicon produces arm64 or an OCI index
# that fails with: Container manifest type 'application/vnd.oci.image.index.v1+json' must support amd64/linux.
docker buildx version >/dev/null 2>&1 || {
  echo "docker buildx is required (ships with Docker Desktop / recent Engine)."
  exit 1
}
docker buildx inspect --bootstrap >/dev/null 2>&1 || true

docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -f services/orchestrator-service/Dockerfile \
  -t "${IMAGE_URI}" \
  --push \
  .

echo "✅ Image pushed successfully!"
echo "📦 Image: ${IMAGE_URI}"
echo ""

if [ "${UPDATE_CLOUD_RUN}" = "true" ]; then
  echo "☁️  Updating Cloud Run orchestrator-service to use the new image..."
  gcloud run services update orchestrator-service \
    --project="${SPOKE_PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE_URI}" \
    --quiet
  echo "✅ Cloud Run updated."
  echo ""
fi

# Optional: Deploy Agent Engine to Vertex AI
if [ "$DEPLOY_AGENT_ENGINE" = "true" ]; then
  echo "🤖 Deploying Agent Engine to Vertex AI..."
  cd services/orchestrator-service
  .venv/bin/python scripts/deploy_agent_engine.py deploy \
    --project "$SPOKE_PROJECT_ID" \
    --location us-central1 \
    --display-name "retail-orchestrator-agent-v1" \
    --staging-bucket "gs://${SPOKE_PROJECT_ID}-agent-engine"

  # Save resource name to Secret Manager
  RESOURCE_NAME=$(cat scripts/.agent_engine_resource)
  echo "📝 Saving Agent Engine resource name to Secret Manager..."
  echo -n "$RESOURCE_NAME" | gcloud secrets versions add orchestrator-agent-engine-resource-name \
    --project="$SPOKE_PROJECT_ID" \
    --data-file=-

  echo "✅ Agent Engine deployed: $RESOURCE_NAME"
  cd ..
fi

echo ""
echo "Next steps:"
echo "  1. cd tf/"
echo "  2. terraform apply (if infra/env not already applied)"
if [ "$DEPLOY_AGENT_ENGINE" = "true" ]; then
  echo "  3. Set agent_engine_enabled = \"true\" in terraform.tfvars"
  echo "  4. terraform apply again to enable Agent Engine mode"
fi
