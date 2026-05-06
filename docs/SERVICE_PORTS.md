# Service Ports

These are the ports contributors should expect when running the local AI Platform stack.

| Surface            | Local port | In-cluster port      | Notes                                                                |
| ------------------ | ---------- | -------------------- | -------------------------------------------------------------------- |
| Agentic BFF        | 9001       | external URL         | Local UI and tRPC entrypoint                                         |
| Orchestrator       | 9501       | 9501                 | Chat runtime and tool execution                                      |
| Ingestion Pipeline | 9508       | 9508                 | Uploads, job state, and review flow                                  |
| Knowledge API      | 9509       | 9509                 | Search, storage, citations, and taxonomy                             |
| Analytics Service  | 9510       | 9512                 | Local wrappers bind 9510; container and cluster runtime stay on 9512 |
| LiteLLM            | 4000       | external gateway URL | Local proxy for Vertex-backed model calls                            |
| PostgreSQL         | 9432       | managed              | Local pgvector-compatible dev database                               |
| MySQL              | 9306       | managed              | Agentic application schema                                           |
| Redis              | 9379       | managed              | Cache, traces, and job state                                         |
| Neo4j              | 9687       | optional             | Local graph support                                                  |
| Pub/Sub emulator   | 9085       | managed              | Optional local queue testing                                         |

## Why analytics is different

Analytics is the only service that intentionally differs between local and cluster ports today:

- local dev scripts start it on `9510`
- deployed containers and Kubernetes manifests expose it on `9512`

Local `.env.example` files should point dependent services to `http://localhost:9510`. Cluster configmaps and service definitions remain on `9512`.
