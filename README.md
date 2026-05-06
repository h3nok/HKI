# HKI: Hermetic Knowledge Isolation

HKI is an open-source reference implementation for enforcing isolation standards
in agentic knowledge systems. It combines the Hermetic Knowledge Isolation
runtime model with scoped agentic routing, a React/BFF control surface, knowledge
retrieval services, ingestion workflows, orchestrator services, and shared UI
tokens.

The project goal is direct: make isolation identity a runtime invariant for
agentic RAG, MCP tools, scoped memory, caches, traces, background jobs, and
knowledge publication.

## Core Promise

An HKI-conformant runtime path must prove:

- every runtime artifact has exactly one domain label
- every request executes inside exactly one active domain
- missing, null, `global`, ambiguous, or unauthorized runtime scope fails closed
- cache, graph, memory, tool, trace, ingestion, review, and publication paths
  preserve the same signed scope envelope
- cross-domain sharing happens only through explicit publication into
  domain-local artifacts

Start with the full paper:
[Hermetic Knowledge Isolation](./docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md).
For the operational runtime standard, read
[Scoped Agentic Routing](./docs/SCOPED_AGENTIC_ROUTING.md).
For the draft normative standard, read [HKI 1.0](./spec/HKI-1.0.md) and the
[HKI Agent Gateway Profile](./spec/HKI-Agent-Gateway-Profile.md).

## Current Status

This repository is a working reference platform, not a finished certification
suite. It already includes HKI strict-mode enforcement hooks, scoped chat and
knowledge paths, MCP gateway documentation, and public-readiness audit ratchets.
The remaining work is tracked in
[Public Readiness Plan](./docs/HKI_PUBLIC_READINESS_PLAN.md).

> **Windows Users:** See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for Windows-specific setup instructions.

## Architecture

```
hki/
├── apps/agentic/               # BFF + React UI (:9001)
├── knowledge-api/              # Vector search and retrieval (:9509)
├── ingestion-pipeline-service/ # Document ingestion and processing (:9508)
├── orchestrator-service/       # LLM reasoning, routing, and tools (:9501)
├── analytics-service/          # Usage and event analytics (:9510)
├── shared/                     # Shared Python auth, tracing, and service helpers
├── packages/                   # Shared packages, including @hki/runtime and @hki/conformance
├── docker-compose/             # Local development infrastructure
├── docs/                       # HKI standard, SAR standard, operations docs
└── tests/                      # E2E and platform checks
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
- [HKI conformance guide](./docs/HKI_CONFORMANCE.md)
- [Public readiness plan](./docs/HKI_PUBLIC_READINESS_PLAN.md)
- [HKI 1.0 draft standard](./spec/HKI-1.0.md)
- [HKI agent gateway profile](./spec/HKI-Agent-Gateway-Profile.md)
- [HKI security mapping](./docs/HKI_SECURITY_MAPPING.md)
- [Docs index](./docs/README.md)

## Public Packages

| Package | Purpose |
| --- | --- |
| [`@hki/runtime`](./packages/hki-runtime/README.md) | Runtime envelope validation, artifact visibility checks, cache-key derivation, gateway target decisions, telemetry attributes, and JSON Schemas. |
| [`hki-runtime`](./packages/hki-runtime-py/README.md) | Python parity helpers for FastAPI services, Python gateways, retrieval adapters, caches, and MCP tool routers. |
| [`@hki/conformance`](./packages/hki-conformance/README.md) | Adapter contract, conformance fixtures, CLI runner, and evidence report for HKI-compatible gateways and agent runtimes. |

---

## Prerequisites

| Tool     | Version                      |
| -------- | ---------------------------- |
| Python   | 3.12+                        |
| `uv`     | latest — `pip install uv`    |
| Node.js  | 20+                          |
| `pnpm`   | 10+                          |
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
cd apps/agentic && pnpm dev
```

### 4. Individual services

```bash
make dev-knowledge-api      # :9509
make dev-ingestion          # :9508
make dev-orchestrator       # :9501
make dev-analytics          # :9510
cd apps/agentic && pnpm dev # :9001
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
pnpm audit:ui-tokens   # ratchet hardcoded UI token and legacy-copy debt
pnpm audit:hki         # ratchet known HKI scope fallback debt
pnpm typecheck:hki-runtime
pnpm test:hki-runtime
pnpm test:hki-runtime-py
pnpm lint:hki-runtime-py
pnpm typecheck:hki-conformance
pnpm test:hki-conformance
pnpm verify:hki-conformance
make hki-check        # HKI runtime, Python runtime, conformance, and audit gates
pnpm --dir packages/ui typecheck
pnpm --dir apps/agentic check
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

## License

MIT. See [LICENSE](./LICENSE).
