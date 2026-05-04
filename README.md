# HKI Platform

Full-stack AI platform providing agentic chat, knowledge management, and document ingestion.

> **Windows Users:** See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for Windows-specific setup instructions.

## Architecture

```
hki/
├── agentic/                    # BFF + React UI  (:9001)
├── knowledge-api/              # Vector search & retrieval  (:9509)
├── ingestion-pipeline-service/ # Document ingestion & processing  (:9508)
├── orchestrator-service/       # LLM reasoning & tool use  (:9501)
├── analytics-service/          # Usage & event analytics  (:9510)
├── shared/                     # Shared Python library (hki-shared)
├── packages/                   # Shared TS/React packages (@hki/ui, @hki/chat)
├── docker-compose/             # Local dev infrastructure
└── tests/                      # E2E tests
```

**Deployed via:** `scripts/deploy-k8s.sh` and GKE targets in `Makefile`
**Production runtime:** GKE

## Start Here

- [Contributing guide](./CONTRIBUTING.md)
- [First-time setup](./docs/FIRST_SETUP.md)
- [Environment setup](./docs/ENV_SETUP.md)
- [Testing guide](./docs/TESTING.md)
- [Service ports](./docs/SERVICE_PORTS.md)
- [Service boundaries](./docs/SERVICE_BOUNDARIES.md)
- [Docs index](./docs/README.md)

---

## Prerequisites

| Tool     | Version                      |
| -------- | ---------------------------- |
| Python   | 3.12+                        |
| `uv`     | latest — `pip install uv`    |
| Node.js  | 20+                          |
| `pnpm`   | 9+                           |
| Docker   | 24+                          |
| `gcloud` | latest (for deployment only) |

---

## Local Development

### 1. First-time setup

```bash
make init-env
```

This copies any missing `.env` files from their `.env.example` counterparts. Set your GCP project for LiteLLM:

```
VERTEX_PROJECT=<your-gcp-project>
```

Place your GCP service account key at:

```
docker-compose/creds/gcp_creds.json
```

Validate before starting:

```bash
make validate-env
```

### 2. Full-stack startup

```bash
make doctor-dev
make init-env
make install
make dev-full
```

### 3. Split workflow

```bash
make infra-up
make dev-services
cd agentic && pnpm dev
```

### 4. Individual services

```bash
make dev-knowledge-api      # :9509
make dev-ingestion          # :9508
make dev-orchestrator       # :9501
make dev-analytics          # :9510
cd agentic && pnpm dev      # :9001
```

### 5. Status & stop

```bash
make dev-status
make dev-stop       # kill service processes
make infra-down     # stop Docker containers
```

---

## Service Ports

| Service            | Port | Notes                            |
| ------------------ | ---- | -------------------------------- |
| Agentic BFF        | 9001 | tRPC + React UI                  |
| knowledge-api      | 9509 | FastAPI, pgvector                |
| ingestion-pipeline | 9508 | FastAPI, Pub/Sub                 |
| orchestrator       | 9501 | FastAPI, Redis                   |
| analytics          | 9510 | Dev wrapper; cluster uses 9512   |
| LiteLLM            | 4000 | LLM proxy (dev only)             |
| PostgreSQL         | 9432 | pgvector / AlloyDB local         |
| MySQL              | 9306 | Agentic BFF schema               |
| Redis              | 9379 | Orchestrator cache               |
| Neo4j              | 9687 | Knowledge graph (optional)       |

---

## Testing

```bash
make test-services      # pytest all Python services
make lint-services      # ruff all Python services
make e2e-test           # end-to-end ingestion test
make test-prod          # GKE production verification suite
```

Knowledge base evaluation:

```bash
make kb-test-setup      # seed test documents
make kb-test-run        # run evaluation suite
make kb-test-search     # quick search smoke test
```

---

## Deployment

```bash
make check-auth             # verify gcloud auth
make deploy                 # canonical GKE deployment
make gke-deploy             # full GKE deployment
make status                 # show GKE deployment status
make urls                   # show canonical public endpoints
DRY_RUN=true make gke-deploy  # preview without executing
```

---

## Troubleshooting

**`uv` not found:** `pip install uv`

**PostgreSQL not ready:** `make infra-reset` then retry

**LiteLLM 401:** Check `VERTEX_PROJECT` is set and `gcp_creds.json` is in place

**Port already in use:** `make dev-stop` then retry

**doctor check:**

```bash
make doctor-dev
```
