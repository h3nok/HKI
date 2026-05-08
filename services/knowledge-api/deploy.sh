#!/bin/bash
set -e

# Configuration
export SPOKE_PROJECT_ID="p-642-cilab-demo"
export REGION="us-west1"
export REGISTRY_NAME="demo-registry"
export IMAGE_NAME="knowledge-api"

echo "🔨 Building Knowledge API container image..."
cd "$(dirname "$0")/../.."
docker build -f services/knowledge-api/Dockerfile -t $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest .

echo "🚀 Pushing container image to Artifact Registry..."
docker push $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest

echo "✅ Image pushed successfully!"
echo "📦 Image: $REGION-docker.pkg.dev/$SPOKE_PROJECT_ID/$REGISTRY_NAME/$IMAGE_NAME:latest"
echo ""
echo "Next steps:"
echo "  1. cd tf/"
echo "  2. terraform apply"
