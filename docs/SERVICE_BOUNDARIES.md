# Service Boundaries

Use this table to decide where a change belongs before editing multiple services.

| Area                          | Owns                                                                                                  | Change here when                                                                                   | Verify with                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `agentic/`                    | User-facing UI, tRPC BFF, auth/session wiring, KB admin workflows, connectors, MySQL-backed app state | The user sees the change in the browser, a tRPC contract changes, or session/auth behavior changes | `pnpm test`, targeted KB browser or role e2e flows           |
| `orchestrator-service/`       | Chat reasoning loop, tool selection, traces, execution policy, Redis-backed chat runtime              | Response planning, tool calling, guardrails, or thought-trace behavior changes                     | service pytest plus local `/v1/chat` smoke                   |
| `knowledge-api/`              | Search, vector storage, taxonomy, citations, retrieval evaluation, graph-backed discovery             | Search relevance, document retrieval, citation shaping, or storage metadata changes                | service pytest plus KB search/eval smoke                     |
| `ingestion-pipeline-service/` | Upload intake, chunking, review workflow, job lifecycle, forwarding to Knowledge API                  | File ingest, metadata extraction, review queues, or job tracking changes                           | service pytest plus `make e2e-test`                          |
| `analytics-service/`          | Event ingestion, usage summaries, analytics storage adapters                                          | Event schema, analytics queries, or reporting endpoints change                                     | service pytest and downstream smoke if a caller changed      |
| `shared/`                     | Shared Python auth, logging, tracing, HTTP, and error handling utilities                              | Multiple Python services need the same infrastructure behavior                                     | At least one caller service test from every affected runtime |
| `packages/chat/`              | Shared chat primitives used by Agentic and related Node surfaces                                      | A chat UI primitive or shared hook changes                                                         | package or app consumer test                                 |
| `packages/ui/`                | Shared UI components and design primitives                                                            | A reusable component or token changes                                                              | package consumer page or component test                      |

## Cross-service rules

- If you change an HTTP contract, update both the caller and callee in the same branch.
- If you add or change an env var, update the `.env.example`, `../README.md`, and `ENV_SETUP.md` together.
- If you add a migration, document rollout order in the PR and verify startup behavior that depends on that schema.
- If you touch shared auth or request context, review Agentic, Orchestrator, Knowledge API, and Ingestion together.
