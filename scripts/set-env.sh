#!/bin/bash
# ============================================================================
# AI Platform - Environment Configuration
# Source this file to set environment variables for deployment
# ============================================================================

# GCP Project Configuration
export HUB_PROJECT_ID="p-642-cilab-infrastructure"
export SPOKE_PROJECT_ID="p-642-cilab-demo"

# Deployment Configuration
export REGION="us-west1"
export REGISTRY_NAME="demo-registry"

# Set active project to spoke for gcloud commands
gcloud config set project "$SPOKE_PROJECT_ID" 2>/dev/null

echo "✓ Environment configured:"
echo "  Hub Project:   $HUB_PROJECT_ID (shared VPC/infrastructure)"
echo "  Spoke Project: $SPOKE_PROJECT_ID (services)"
echo "  Region:        $REGION"
echo "  Registry:      $REGISTRY_NAME"
echo ""
echo "Run deployment with: ./scripts/deploy-k8s.sh"
