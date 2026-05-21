#!/bin/bash
set -e

# Configuration
export SPOKE_PROJECT_ID="${GCP_PROJECT_ID:-YOUR_GCP_PROJECT}"
export REGION="us-west1"
export REGISTRY_NAME="demo-registry"
export IMAGE_NAME="agentic-bff"

echo "🔨 Building Agentic BFF (Frontend + Backend) container image..."
# Build from ai-platform directory since it contains pnpm workspace
cd "$(dirname "$0")/.."
docker build --platform linux/amd64 -f agentic/Dockerfile -t $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest .

echo "🚀 Pushing container image to Artifact Registry..."
docker push $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest

echo "✅ Image pushed successfully!"
echo "📦 Image: $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest"
echo ""
echo "Next steps:"
echo "  1. cd apps/ai-platform"
echo "  2. ./scripts/deploy-k8s.sh --skip-tf --skip-build --only agentic-bff"
