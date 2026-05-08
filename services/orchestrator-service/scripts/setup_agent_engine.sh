#!/bin/bash
# Quick setup script for Agent Engine with Terraform integration

set -e

PROJECT_ID="${GCP_PROJECT_ID:-p-642-cilab-demo}"
LOCATION="${GCP_LOCATION:-us-central1}"
STAGING_BUCKET="gs://${PROJECT_ID}-agent-engine"

echo "🤖 Vertex AI Agent Engine Setup"
echo "================================"
echo "Project: $PROJECT_ID"
echo "Location: $LOCATION"
echo ""

# Check if already deployed
if [ -f scripts/.agent_engine_resource ]; then
  RESOURCE_NAME=$(cat scripts/.agent_engine_resource)
  echo "✅ Agent Engine already deployed:"
  echo "   $RESOURCE_NAME"
  echo ""
  read -p "Deploy a new version? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping deployment."
    exit 0
  fi
fi

# Deploy Agent Engine
echo "📦 Deploying Agent Engine to Vertex AI..."
.venv/bin/python scripts/deploy_agent_engine.py deploy \
  --project "$PROJECT_ID" \
  --location "$LOCATION" \
  --display-name "retail-orchestrator-agent-v1" \
  --staging-bucket "$STAGING_BUCKET"

# Wait for resource name file
echo ""
echo "⏳ Waiting for deployment to complete..."
while [ ! -f scripts/.agent_engine_resource ]; do
  sleep 5
  echo "   Still deploying..."
done

RESOURCE_NAME=$(cat scripts/.agent_engine_resource)
echo ""
echo "✅ Deployment complete!"
echo "   Resource: $RESOURCE_NAME"
echo ""

# Update Secret Manager
echo "📝 Updating Secret Manager..."
echo -n "$RESOURCE_NAME" | gcloud secrets versions add orchestrator-agent-engine-resource-name \
  --project="$PROJECT_ID" \
  --data-file=- \
  2>/dev/null || echo "⚠️  Secret not found. Run 'terraform apply' first to create it."

echo ""
echo "🎉 Agent Engine setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update terraform.tfvars:"
echo "     agent_engine_enabled = \"true\""
echo ""
echo "  2. Apply Terraform:"
echo "     cd tf/ && terraform apply"
echo ""
echo "  3. Test the deployment:"
echo "     .venv/bin/python scripts/deploy_agent_engine.py query \\"
echo "       --resource-name \"$RESOURCE_NAME\" \\"
echo "       --message \"Hello, test message\""
