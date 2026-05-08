# Knowledge API — MCP Server

Knowledge Platform — hybrid search with vector similarity, BM25 keyword matching, and graph discovery via the Model Context Protocol (MCP).

**Port**: 9509

## MCP Architecture

This service implements the **MCP Streamable HTTP** transport pattern, following the same architecture as the `mcp_calculator` service. It exposes all knowledge platform functionality as MCP tools that can be called by LLM agents through MCP-compatible gateways (LiteLLM, Kong, etc.).

```
src/
├── mcp_server.py        # MCP server with FastMCP (NEW - primary entry point)
├── api/
│   ├── app.py           # FastAPI app (LEGACY - kept for backward compatibility)
│   ├── routes.py        # REST endpoints (LEGACY)
│   ├── evaluation_routes.py
│   └── taxonomy_routes.py
├── adapters/
│   ├── vector_store.py      # In-memory store (dev default)
│   ├── alloydb_store.py     # AlloyDB + pgvector (production)
│   ├── neo4j_graph.py       # Neo4j knowledge graph (optional)
│   ├── embedding_client.py  # Vertex AI embeddings via LiteLLM
│   └── schema.sql           # AlloyDB schema (pgvector + tsvector + graph + RLS)
├── domain/
│   ├── models.py            # Document, Chunk, SearchQuery, SearchResult, Citation
│   ├── chunking.py          # Sentence, FixedSize, SlidingWindow chunkers
│   ├── entity_extraction.py # LLM-based entity/relationship extraction
│   ├── taxonomy.py          # Hierarchical taxonomy management
│   ├── evaluation.py        # RAGAS-style retrieval metrics
│   └── seed.py              # Sample data for development
└── core/
    ├── config.py        # Settings (env vars)
    ├── auth.py          # JWT verification (handled by gateway in MCP mode)
    └── logging.py       # Structured JSON logging
```

## MCP Tools

The service exposes the following MCP tools:

### Core Search & Ingestion

- **search_knowledge** - Hybrid search (vector + keyword + filters) with optional context shaping
- **ingest_document** - Add documents to knowledge base with automatic chunking and embedding

### Document Management

- **list_documents** - Browse indexed documents with pagination
- **get_document** - View detailed document metadata
- **delete_document** - Remove documents from the knowledge base

### Graph Discovery

- **discover_graph_neighbors** - Find related content through knowledge graph relationships

### Taxonomy Management

- **create_taxonomy_node** - Build hierarchical taxonomy for tag organization
- **list_taxonomy_roots** - Explore taxonomy tree structure
- **validate_tags** - Validate tags against the taxonomy

### Retrieval Evaluation

- **evaluate_retrieval** - Run RAGAS-style quality metrics on test cases
- **auto_evaluate** - End-to-end retrieval testing (search + evaluate)

### Statistics

- **get_stats** - Get knowledge base metrics (document/chunk counts)

## API Endpoints

FastMCP automatically provides these HTTP endpoints:

- **GET /** - Server status and available tools list
- **GET /tools** - Detailed tool descriptions with parameters
- **POST /call/<tool_name>** - Call a specific tool with JSON body

### Example MCP Tool Calls

```bash
# List all available tools
curl http://localhost:9509/tools

# Search knowledge base
curl -X POST http://localhost:9509/call/search_knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is our return policy?",
    "org_id": "hki",
    "mode": "hybrid",
    "top_k": 5
  }'

# Ingest a document
curl -X POST http://localhost:9509/call/ingest_document \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Company Policy: All items can be returned...",
    "org_id": "hki",
    "title": "Return Policy",
    "document_type": "policy",
    "department": "Customer Service"
  }'

# Get knowledge base statistics
curl -X POST http://localhost:9509/call/get_stats \
  -H "Content-Type: application/json" \
  -d '{"org_id": "hki"}'
```

## Storage Backends

| Backend                | When                          | Persistence                  | Config                |
| ---------------------- | ----------------------------- | ---------------------------- | --------------------- |
| **In-memory**          | `ALLOYDB_URL` empty (default) | None — data lost on restart  | No setup needed       |
| **AlloyDB + pgvector** | `ALLOYDB_URL` set             | Full persistence, ANN search | PostgreSQL + pgvector |

The backend is selected automatically at startup based on the `ALLOYDB_URL` environment variable.

## Multi-Tenant Isolation

All data is scoped by `org_id` — an organization identifier derived from Google SSO at login. **`org_id` is never client-supplied**; it is always extracted from the authenticated JWT.

```
Google Login (hd: "hki.com")
  → BFF: deriveOrgId() → "hki"
    → Request JWT: { org_id: "hki", sub: "123", role: "operator" }
      → Python auth.py: identity.org_id = "hki"
        → Every query: WHERE org_id = 'hki'
```

### Isolation Layers

| Layer         | Mechanism                                                               |
| ------------- | ----------------------------------------------------------------------- |
| **API**       | `identity.org_id` from JWT on every route handler                       |
| **AlloyDB**   | `org_id` column + composite indexes + Row-Level Security (RLS) policies |
| **In-memory** | Python-level `org_id` filter in `_apply_filters()`                      |
| **Neo4j**     | `org_id` property on all nodes, Cypher `WHERE` filters                  |

### AlloyDB RLS (Defense in Depth)

```sql
-- Each transaction sets the org context
SET app.current_org_id = 'hki';

-- RLS policy enforces isolation even if adapter code has a bug
CREATE POLICY document_isolation_policy ON documents
  USING (org_id = current_setting('app.current_org_id', true));
```

## Knowledge Graph (Neo4j)

Optional Neo4j integration for entity-relationship discovery. Enabled when `NEO4J_URI` is set.

```
Ingestion Pipeline:
  Document → Chunks → Embeddings → AlloyDB
                    → Entity Extraction (LLM) → Neo4j
                        ├── Entity nodes (Person, Org, Product, Concept)
                        ├── MENTIONED_IN → Chunk/Document
                        ├── RELATED_TO → other entities
                        └── NEXT → sequential chunk links
```

### Entity Extraction

Uses `gemini-2.0-flash` to extract structured entities and relationships from each chunk during ingestion. Falls back to regex-based extraction if the LLM is unavailable.

### Graph Endpoints

| Method | Path                         | Description                       |
| ------ | ---------------------------- | --------------------------------- |
| POST   | `/v1/graph/entities/search`  | Search entities by name/type      |
| POST   | `/v1/graph/entities/context` | Multi-hop entity neighborhood     |
| GET    | `/v1/graph/stats`            | Graph statistics for caller's org |

## Development

### Running for the AI Platform stack

```bash
cd apps/ai-platform/knowledge-api
cp .env.example .env
uv sync --extra dev

# FastAPI mode used by the local AI Platform stack
make -C .. dev-knowledge-api

# Full local graph mode
make -C .. dev-knowledge-api-full
```

These workspace targets match the way Agentic, Orchestrator, and Ingestion expect to talk to the service locally.

### Running the standalone MCP server

Use this when you are validating the MCP transport directly rather than the full app stack:

```bash
cd apps/ai-platform/knowledge-api
cp .env.example .env
uv sync --extra dev
python -m src.mcp_server
```

The standalone MCP server starts on port 9509 unless overridden.

### Testing MCP Tools

```bash
# List all available tools
curl http://localhost:9509/tools | jq

# Test search tool
curl -X POST http://localhost:9509/call/search_knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "return policy", "org_id": "default", "top_k": 3}' | jq

# Test ingest tool
curl -X POST http://localhost:9509/call/ingest_document \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test document content",
    "org_id": "default",
    "title": "Test Doc",
    "document_type": "general"
  }' | jq
```

### Running with AlloyDB

```bash
# 1. Start infrastructure (PostgreSQL + pgvector on :9432)
make -C .. infra-up

# 2. Run MCP server with AlloyDB
ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \
  python -m src.mcp_server
```

### Legacy FastAPI Mode

The original REST API is still available for backward compatibility:

```bash
# Run legacy FastAPI server
uvicorn src.api.app:app --reload --port 9509
```

**Note**: New development should use the MCP server. The FastAPI endpoints will be deprecated in a future release.

The schema (`schema.sql`) is applied automatically on first connect.

### Full stack mode (AlloyDB + Neo4j + entity extraction)

```bash
# 1. Start infrastructure (PostgreSQL + pgvector + Neo4j)
make -C .. infra-up

# 2. Run with all features
make -C .. dev-knowledge-api-full
```

### Testing

```bash
AUTH_ENABLED=false pytest
AUTH_ENABLED=false pytest --cov=src tests/
```

## Environment Variables

| Variable                    | Default                    | Description                                     |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| `SERVICE_PORT`              | `9509`                     | HTTP port                                       |
| `ALLOYDB_URL`               | `""` (empty = in-memory)   | PostgreSQL/AlloyDB connection string            |
| `ALLOYDB_POOL_MIN`          | `2`                        | Connection pool minimum                         |
| `ALLOYDB_POOL_MAX`          | `20`                       | Connection pool maximum                         |
| `EMBEDDING_GATEWAY_URL`     | `http://localhost:4000/v1` | LiteLLM/Vertex AI embeddings                    |
| `EMBEDDING_MODEL`           | `text-embedding-004`       | Embedding model name                            |
| `EMBEDDING_DIMENSIONS`      | `768`                      | Vector dimensions                               |
| `SIMILARITY_THRESHOLD`      | `0.3`                      | Minimum cosine similarity                       |
| `VECTOR_WEIGHT`             | `0.7`                      | Hybrid search vector weight                     |
| `BM25_WEIGHT`               | `0.3`                      | Hybrid search keyword weight                    |
| `NEO4J_URI`                 | `""` (empty = disabled)    | Neo4j bolt URI (e.g. `bolt://localhost:9687`)   |
| `NEO4J_USERNAME`            | `neo4j`                    | Neo4j username                                  |
| `NEO4J_PASSWORD`            | `""`                       | Neo4j password                                  |
| `NEO4J_DATABASE`            | `neo4j`                    | Neo4j database name                             |
| `ENTITY_EXTRACTION_ENABLED` | `true`                     | Enable LLM entity extraction during ingest      |
| `ENTITY_EXTRACTION_MODEL`   | `gemini-2.0-flash`         | Model for entity extraction                     |
| `AUTH_ENABLED`              | `true`                     | Enable JWT verification (`false` for local dev) |

## API Endpoints

| Method | Path                         | Description                                                |
| ------ | ---------------------------- | ---------------------------------------------------------- |
| POST   | `/v1/search`                 | Hybrid search (vector + keyword + RRF)                     |
| POST   | `/v1/ingest`                 | Ingest document (chunk → embed → store → extract entities) |
| GET    | `/v1/documents`              | List documents with pagination                             |
| GET    | `/v1/documents/{id}`         | Get document details                                       |
| DELETE | `/v1/documents/{id}`         | Delete document + chunks                                   |
| GET    | `/v1/graph/{chunk_id}`       | Graph neighbor discovery                                   |
| POST   | `/v1/graph/entities/search`  | Search entities by name/type (Neo4j)                       |
| POST   | `/v1/graph/entities/context` | Multi-hop entity neighborhood (Neo4j)                      |
| GET    | `/v1/graph/stats`            | Knowledge graph statistics                                 |
| GET    | `/v1/stats`                  | Store statistics                                           |
| GET    | `/health`                    | Liveness probe                                             |
| GET    | `/ready`                     | Readiness probe (includes store stats)                     |

All `/v1/*` endpoints require a valid request JWT. The `org_id` is extracted from the token automatically.

Swagger UI: http://localhost:9509/docs

## GKE Deployment

In the staging and production environments, the knowledge-api runs on GKE Autopilot.

```
Pod (via apps/ai-platform/k8s/tf and Kubernetes manifests)
├── knowledge-api  (port 9509)
│   └── ALLOYDB_URL=postgresql://postgres@localhost:5432/knowledge
└── alloydb-auth-proxy    (port 5432 → AlloyDB instance)
    └── Uses Workload Identity (no passwords)
```

The production deployment is managed through the AI Platform GKE path: `apps/ai-platform/scripts/gke-terraform.sh`, `apps/ai-platform/scripts/deploy-k8s.sh`, and `apps/ai-platform/k8s/tf`.
Base Kubernetes manifests for local testing or reference can be found in `./k8s/`.
