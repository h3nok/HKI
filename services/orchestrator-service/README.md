# Orchestrator Service

Consolidated Agent Orchestration Service for the Retail Agentic Platform.

## Architecture

This service replaces 9 separate microservice stubs with a single in-process
agent orchestration layer. All agent coordination happens within one process
to eliminate unnecessary network hops while maintaining clean separation of
concerns through the skill/tool abstraction.

```
┌─────────────────────────────────────────────────────────┐
│                  Orchestrator Service                    │
│                                                         │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Supervisor  │→ │  Router  │→ │  Worker Agents    │  │
│  │  (ReAct)     │  │ (Intent) │  │  ┌─────────────┐ │  │
│  └─────────────┘  └──────────┘  │  │ RetailAgent  │ │  │
│                                  │  │ ToolAgent    │ │  │
│  ┌─────────────┐  ┌──────────┐  │  │ GenAgent     │ │  │
│  │  Guardrails  │  │  Memory  │  │  └─────────────┘ │  │
│  │  (in/out)    │  │ (Redis)  │  └───────────────────┘  │
│  └─────────────┘  └──────────┘                          │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │         Tool Registry (MCP or inline)               ││
│  │  search_products · check_inventory · get_pricing    ││
│  │  get_member_info · check_order · analyze_sales      ││
│  │  search_knowledge · get_product_details             ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Running

```bash
cd apps/ai-platform/orchestrator-service

# First-time setup
cp .env.example .env
uv sync --extra dev

# Recommended workspace entrypoint
make -C .. dev-orchestrator

# Or run standalone from this directory
set -a && [ -f .env ] && . .env; set +a
uv run uvicorn src.api.app:app --reload --port 9501 --reload-dir src

# Test
AUTH_ENABLED=false pytest --cov=src tests/
```

The workspace-level `make -C .. dev-orchestrator` target is the safest default because it matches the rest of the local AI Platform stack.

### Tool Modes

The orchestrator supports two tool registry backends, controlled by the
`MCP_SERVERS` environment variable:

| Mode                      | `MCP_SERVERS`      | How tools load                                                              |
| ------------------------- | ------------------ | --------------------------------------------------------------------------- |
| **MCP (recommended)**     | Set to JSON config | Connects to MCP servers, discovers tools dynamically                        |
| **Inline (dev fallback)** | Not set            | Uses hardcoded mock tools from `domain/tools.py` for local development only |

MCP config format:

```json
// HTTP (local or deployed MCP server)
{"retail-tools": {"url": "http://retail-tools-mcp:8100/mcp"}}

// HTTP (GKE — connects to remote MCP server pod)
{"retail-tools": {"url": "http://retail-tools-mcp:8100/mcp"}}
```

This repo does not currently ship a dedicated `mcp-servers/` workspace. Point `MCP_SERVERS` at the server you are integrating, or leave it unset to use the inline fallback tools during local development.

Leaving `MCP_SERVERS` unset is acceptable for local UI and agent-loop development. Staging, pre-production, and production validation should point at real MCP or service-backed tool providers and should not rely on the inline fallback registry.

## Deployment to GCP

Production deployment is GKE-first. The old Cloud Run path is retired.

```bash
cd apps/ai-platform
make gke-deploy-orchestrator

# or deploy only orchestrator through the shared script
./scripts/deploy-k8s.sh --only orchestrator
```

### Legacy Cloud Run Terraform (retired)

The `tf/` directory contains:

- **backend.tf** — GCS state backend (prefix: `lab/apps/orchestrator-service`)
- **provider.tf** — Google Cloud provider config
- **variables.tf** — Input variables (hub/spoke projects, URLs)
- **terraform.tfvars** — Variable values (update for your environment)
- **apis.tf** — Required GCP APIs for the legacy Cloud Run path
- **cloud_run.tf** — Retired Cloud Run service definition kept for historical reference
- **secrets.tf** — Secret Manager resources
- **agent_engine.tf** — (Optional) Vertex AI Agent Engine resources

### Vertex AI Agent Engine (Optional)

The orchestrator supports two deployment modes:

1. **In-Process AdkAgent** (default) — Agent runs inside the orchestrator container
2. **Vertex AI Agent Engine** — Agent deployed as a managed reasoning engine

To enable Agent Engine:

```bash
# 1. Deploy the agent wrapper to Vertex AI (optional but recommended during deploy.sh)
DEPLOY_AGENT_ENGINE=true ./deploy.sh

# Or deploy separately:
cd orchestrator-service
.venv/bin/python scripts/deploy_agent_engine.py deploy \
  --project p-642-cilab-demo \
  --location us-central1 \
  --display-name "retail-orchestrator-agent-v1" \
  --staging-bucket "gs://p-642-cilab-demo-agent-engine"

# The script saves the resource name to scripts/.agent_engine_resource

# 2. Update Secret Manager with the resource name
export RESOURCE_NAME=$(cat scripts/.agent_engine_resource)
echo -n "$RESOURCE_NAME" | gcloud secrets versions add orchestrator-agent-engine-resource-name \
  --project=p-642-cilab-demo \
  --data-file=-

# 3. Enable Agent Engine mode in terraform.tfvars
echo 'agent_engine_enabled = "true"' >> tf/terraform.tfvars

# 4. Apply Terraform to update the legacy Cloud Run environment
cd tf/
terraform apply
```

Agent Engine commands:

```bash
# List deployed engines
.venv/bin/python scripts/deploy_agent_engine.py list --project p-642-cilab-demo

# Test query
.venv/bin/python scripts/deploy_agent_engine.py query \
  --resource-name "$RESOURCE_NAME" \
  --message "What is your return policy?"

# Delete engine
.venv/bin/python scripts/deploy_agent_engine.py delete \
  --resource-name "$RESOURCE_NAME"
```

## API

- `POST /v1/chat` — Send a message, get streamed agent response with thought traces
- `POST /v1/chat/stream` — SSE streaming variant
- `GET  /v1/tools` — List available tools
- `GET  /health` — Health check
- `GET  /health/ready` — Readiness check (LLM + Redis connectivity)
