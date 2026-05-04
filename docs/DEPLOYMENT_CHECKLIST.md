# AI Platform - Complete Deployment Checklist

## 📦 Services Overview

```
apps/ai-platform/
├── knowledge-api/              ✅ Vector store + MCP server
├── orchestrator-service/       ✅ Agent brain (ReAct loop)
├── agentic/                    ✅ Full-stack BFF (React + tRPC)
├── ingestion-pipeline-service/ ✅ Document ingestion pipeline
└── shared/                     ✅ Shared Python utilities (REQUIRED)
```

## 🔧 Shared Module

The **shared/** package provides common utilities used by all Python services:

### What's in shared/

- `auth_middleware.py` - JWT authentication
- `gcp_secrets.py` - Secret Manager integration
- `pubsub_publisher.py` - Pub/Sub publishing
- `tracing.py` - OpenTelemetry tracing
- `logging.py` - Structured JSON logging
- `health.py` - Health check utilities
- `http_client.py` - HTTP client helpers
- `errors.py` - Common error types

### How it's used

All Python services reference it in their `pyproject.toml`:

```toml
dependencies = [
    "hki-shared",
    # ... other deps
]

[tool.uv.sources]
hki-shared = { path = "../shared", editable = true }
```

### Docker Build Context

**IMPORTANT**: All Python services MUST be built from the `apps/ai-platform/` directory so the shared module is accessible:

```bash
cd apps/ai-platform/

# ✅ Correct - shared/ is accessible
docker build -f knowledge-api/Dockerfile -t knowledge-api .
docker build -f orchestrator-service/Dockerfile -t orchestrator-service .
docker build -f ingestion-pipeline-service/Dockerfile -t ingestion-pipeline .
```

The Dockerfiles already include:

```dockerfile
COPY shared/ ./shared/
```

## � Frontend Shared Packages

The monorepo includes shared frontend packages (in `packages/`) used by the agentic BFF and other Node.js applications:

### packages/chat/ - Chat Components & Hooks

Shared React components and hooks for chat interfaces:

- **Components**: `ChatContainer`, `MessageList`, `MessageInput`, `TypingIndicator`
- **Hooks**: `useChat`, `useMessages`, `useConversation`, `useTypingIndicator`
- **Adapters**: tRPC integration, WebSocket support, HTTP client adapters
- **Types**: Message, Conversation, ChatState type definitions

### packages/ui/ - Component Library

Production-ready UI component library with Tailwind CSS + Radix UI:

- **50+ Components**: Button, Card, Dialog, Input, Select, Tabs, and more
- **Theming**: Complete design token system (primitives, semantic)
- **Agentic Theme**: Custom theme for AI Platform (`tokens/themes/agentic.css`)
- **Glass Effects**: Modern frosted glass UI styles (`tokens/glass.css`)
- **Storybook**: Interactive component documentation and development
- **Tailwind Config**: Exportable config for app consumption

### packages/typescript-config/

Shared TypeScript configurations for consistency across apps:

- `base.json` - Base TS config for all projects
- `nextjs.json` - Next.js specific config
- `react-library.json` - React library config

### packages/eslint-config/

Shared ESLint rules and configuration for code quality

### Workspace Setup

The monorepo uses **pnpm workspaces** + **Turbo** for efficient package management:

- **pnpm-workspace.yaml** - Defines workspace packages (`apps/*`, `packages/*`)
- **package.json** (root) - Turbo scripts for parallel builds
- **turbo.json** - Build pipeline configuration with caching

**Package references** use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@hki/chat": "workspace:*",
    "@hki/ui": "workspace:*"
  }
}
```

**Building packages**:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Build specific package
turbo run build --filter=@hki/ui

# Development mode (watch)
cd packages/chat && pnpm run dev
```

## �🚀 Deployment Order

Deploy services in this order due to dependencies:

### 1. Knowledge API (Foundation)

```bash
cd apps/ai-platform/knowledge-api

# Prerequisites:
# - AlloyDB cluster deployed
# - Secrets configured: alloydb-url, embedding-api-key, service-auth-secret

./deploy.sh          # Build & push
cd tf/
terraform apply      # Deploy infrastructure
```

**Dependencies**: AlloyDB, LiteLLM Gateway (optional)

### 2. Orchestrator Service (Agent Brain)

```bash
cd apps/ai-platform/orchestrator-service

# Prerequisites:
# - Knowledge API deployed (for MCP tools)
# - Secrets configured: litellm-api-key and redis-url

./deploy.sh          # Build & push
cd tf/
terraform apply      # Deploy infrastructure
```

**Dependencies**: Knowledge API, LiteLLM Gateway, Redis

### 3. Ingestion Pipeline Service (Document Upload)

```bash
cd apps/ai-platform/ingestion-pipeline-service

# Prerequisites:
# - Knowledge API deployed (receives processed documents)
# - Secrets configured: pipeline-knowledge-api-key, pipeline-redis-url

# Step 1: Create secrets
gcloud secrets create pipeline-knowledge-api-key --replication-policy="automatic"
gcloud secrets create pipeline-redis-url --replication-policy="automatic"

echo "YOUR_API_KEY" | gcloud secrets versions add pipeline-knowledge-api-key --data-file=-
echo "redis://host:6379" | gcloud secrets versions add pipeline-redis-url --data-file=-

# Step 2: Deploy
./deploy.sh          # Build & push
cd tf/
terraform apply      # Deploy infrastructure
```

**Dependencies**: Knowledge API, Redis, GCS, Pub/Sub

### 4. Agentic BFF (User Interface)

```bash
cd apps/ai-platform/agentic

# Prerequisites:
# - Orchestrator Service deployed
# - Knowledge API deployed
# - Secrets configured: database-url, google oauth keys

./deploy.sh          # Build & push
cd tf/
terraform apply      # Deploy infrastructure
```

**Dependencies**: Orchestrator Service, Knowledge API, PostgreSQL

## 🔐 Complete Secrets List

### Knowledge API

```bash
gcloud secrets create knowledge-api-alloydb-url --replication-policy="automatic"
gcloud secrets create knowledge-api-embedding-key --replication-policy="automatic"
gcloud secrets create knowledge-api-service-auth-secret --replication-policy="automatic"
```

### Orchestrator Service

```bash
gcloud secrets create orchestrator-litellm-api-key --replication-policy="automatic"
gcloud secrets create orchestrator-redis-url --replication-policy="automatic"
gcloud secrets create orchestrator-service-auth-secret --replication-policy="automatic"
```

### Ingestion Pipeline Service

```bash
gcloud secrets create pipeline-knowledge-api-key --replication-policy="automatic"
gcloud secrets create pipeline-redis-url --replication-policy="automatic"
```

### Agentic BFF

```bash
gcloud secrets create agentic-database-url --replication-policy="automatic"
gcloud secrets create agentic-google-client-id --replication-policy="automatic"
gcloud secrets create agentic-google-client-secret --replication-policy="automatic"
gcloud secrets create agentic-smtp-host --replication-policy="automatic"
gcloud secrets create agentic-smtp-port --replication-policy="automatic"
gcloud secrets create agentic-smtp-user --replication-policy="automatic"
gcloud secrets create agentic-smtp-pass --replication-policy="automatic"
gcloud secrets create agentic-smtp-secure --replication-policy="automatic"
gcloud secrets create agentic-email-from --replication-policy="automatic"
gcloud secrets create agentic-email-enabled --replication-policy="automatic"
```

Manual Google OAuth step after creating the secret values:

```text
Authorized redirect URI:
https://agentic.cilabs.np.hki.com/api/auth/google/callback
```

This redirect URI is configured in the Google OAuth client itself, not by Terraform.

Email delivery for invites and access approvals is separate from Google OAuth.
Use Google Workspace SMTP relay and populate the Agentic SMTP secrets before
expecting invite emails to send. See `apps/ai-platform/docs/AGENTIC_SMTP_SETUP.md`.

Recommended default values:

```bash
printf '587' | gcloud secrets versions add agentic-smtp-port --data-file=- --project=p-642-cilab-demo
printf 'false' | gcloud secrets versions add agentic-smtp-secure --data-file=- --project=p-642-cilab-demo
printf 'AI Platform <noreply@hki.com>' | gcloud secrets versions add agentic-email-from --data-file=- --project=p-642-cilab-demo
printf 'false' | gcloud secrets versions add agentic-email-enabled --data-file=- --project=p-642-cilab-demo
```

Keep `agentic-email-enabled` at `false` until Workspace relay is configured and
the SMTP host and credentials are populated.

## 📋 Infrastructure Dependencies

Before deploying any services, ensure these are available:

### Required

- ✅ **AlloyDB Cluster** - For knowledge-api vector storage
- ✅ **Artifact Registry** - `demo-registry` in `us-west1`
- ✅ **VPC Network** - `cilab-shared-vpc` with `common-apps-subnet`
- ✅ **Service Account** - `cloudrun-sa@p-642-cilab-demo.iam.gserviceaccount.com`

### Optional (but recommended)

- ⭐ **Redis (Memorystore)** - For orchestrator memory & pipeline jobs
- ⭐ **LiteLLM Gateway** - For unified LLM access
- ⭐ **Cloud SQL PostgreSQL** - For agentic BFF database
- ⭐ **Neo4j** - For knowledge graph (optional)

## ✅ Quick Deployment Script

```bash
#!/bin/bash
set -e

PROJECT_ID="p-642-cilab-demo"
REGION="us-west1"

echo "Starting AI Platform deployment..."

# 1. Knowledge API
cd apps/ai-platform/knowledge-api
./deploy.sh
cd tf/ && terraform init && terraform apply -auto-approve
cd ../../..

# 2. Orchestrator Service
cd apps/ai-platform/orchestrator-service
./deploy.sh
cd tf/ && terraform init && terraform apply -auto-approve
cd ../../..

# 3. Ingestion Pipeline Service
cd apps/ai-platform/ingestion-pipeline-service
./deploy.sh
cd tf/ && terraform init && terraform apply -auto-approve
cd ../../..

# 4. Agentic BFF
cd apps/ai-platform/agentic
./deploy.sh
cd tf/ && terraform init && terraform apply -auto-approve
cd ../../..

echo "✅ All services deployed!"
```

## 🔍 Verification

After deployment, verify each service:

```bash
# Canonical cluster verification
make -C apps/ai-platform gke-status
make -C apps/ai-platform test-prod

# Public entrypoint
curl -I https://agentic.cilabs.np.hki.com
```

## 📚 Service Documentation

- [Knowledge API](knowledge-api/README.md)
- [Orchestrator Service](orchestrator-service/README.md)
- [Ingestion Pipeline Service](ingestion-pipeline-service/DEPLOYMENT.md)
- [Agentic BFF](agentic/README.md)

## 🆘 Troubleshooting

### Build fails with "hki-shared not found"

- Ensure you're building from `apps/ai-platform/` directory
- Verify `shared/` directory exists

### Service fails to start

- Check logs: `kubectl -n platform logs deployment/<service> --tail=100`
- Verify all secrets are set
- Check service account has Secret Manager accessor role

### Can't connect to other services

- Verify VPC networking is configured
- Check service URLs in environment variables
- Ensure IAP/invoker permissions are set correctly

---

## 📋 Backlog / Future Enhancements

### Per-Value-Stream LLM Key Configuration

**What:** Allow each value stream to configure its own LiteLLM virtual key from the Admin Streams UI, instead of using a single global key shared across all streams.

**Why:** Enables per-team cost attribution, independent rate limits, and the ability for different business units (Pharmacy, Fresh Foods, Logistics) to operate with separate API budget controls.

**Architecture is mostly ready:**

- `stream_config` is already passed from BFF → orchestrator on every chat request
- Orchestrator already reads `system_prompt`, `enabled_tools`, and `retrieval_strategy` from it
- Just needs: a `llm_api_key` field added to the stream schema + Admin UI field + orchestrator reading it when calling the LiteLLM gateway

**Effort:** ~1 day (schema migration + UI field + orchestrator change)

### Legacy Cloud Run hardening notes (retired path)

**What:** Historical note from the retired Cloud Run path.

**Status:** The legacy Cloud Run services were deleted on 2026-04-13 and the canonical runtime is now GKE.

**Impact:** Keep only as reference if a break-glass legacy recovery is ever needed.
