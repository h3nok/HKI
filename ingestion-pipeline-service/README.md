# Ingestion Pipeline Service

Document ingestion and processing pipeline for the AI Knowledge Base.

## What It Does

- **Document Upload**: Accept PDF, DOCX, TXT, and other document formats
- **Text Extraction**: Extract text from documents (with optional Document AI)
- **Chunking**: Break documents into semantically meaningful chunks
- **Metadata Extraction**: Extract entities, topics, and relationships
- **Quality Gates**: Validate document quality before ingestion
- **Async Processing**: Queue-based processing with Pub/Sub and a dedicated worker
- **Storage**: Cloud Storage document landing zone

## Architecture

```
Upload → GCS Bucket → Pub/Sub → Pipeline Service → Knowledge API → AlloyDB
                                       ↓
                                  Quality Gates
                                       ↓
                                  Document AI (optional)
```

## Local Development

```bash
cd apps/ai-platform/ingestion-pipeline-service

cp .env.example .env
uv sync --extra dev

# Recommended workspace entrypoint
make -C .. dev-ingestion

# Or run standalone
set -a && [ -f .env ] && . .env; set +a
uv run uvicorn src.api.app:app --reload --port 9508 --reload-dir src

# API: http://localhost:9508
# Docs: http://localhost:9508/docs
```

If you are working on the full knowledge workflow, start the supporting services from `apps/ai-platform` with `make dev-services` or `make dev-full`.

## Testing

```bash
AUTH_ENABLED=false pytest tests/ -x --tb=short
make -C .. e2e-test
```

Use the direct pytest command for focused service work and the workspace e2e test when you change ingest-to-store behavior.

## Deployment

**📘 See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.**

## Production Standard

The canonical production deployment path is GKE via [../scripts/deploy-k8s.sh](../scripts/deploy-k8s.sh).

Reference production shape:

- API deployment: `ingestion-pipeline`
- Worker deployment: `ingestion-pipeline-worker`
- Durable queue: Pub/Sub + DLQ
- Raw source persistence: GCS
- Job state: Redis

The Cloud Run Terraform path in `tf/` remains useful for legacy/demo environments, but it is not the reference production topology because the canonical runtime depends on a continuously running worker deployment.

### Quick Start

```bash
# 1. Create required secrets in Google Secret Manager
gcloud secrets create pipeline-knowledge-api-key --replication-policy="automatic"
gcloud secrets create pipeline-redis-url --replication-policy="automatic"

# 2. Set secret values
echo "YOUR_API_KEY" | gcloud secrets versions add pipeline-knowledge-api-key --data-file=-
echo "redis://your-host:6379" | gcloud secrets versions add pipeline-redis-url --data-file=-

# 3. Build and push container
./deploy.sh

# 4. Deploy infrastructure
cd tf/
terraform init
terraform apply
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions, troubleshooting, and configuration options.

## Environment Variables

- `KNOWLEDGE_API_URL` - URL of the knowledge API
- `KNOWLEDGE_API_KEY` - API key for knowledge API authentication
- `GCS_BUCKET` - Cloud Storage bucket for document uploads
- `PUBSUB_TOPIC` - Pub/Sub topic for async processing
- `REDIS_URL` - Redis connection for job state
- `DOCAI_ENABLED` - Whether to use Document AI (optional)
- `DOCAI_PROCESSOR_ID` - Document AI processor resource name (optional)

## API Endpoints

- `POST /api/v1/documents/upload` - Upload a document
- `GET /api/v1/documents/{id}/status` - Check processing status
- `GET /api/v1/jobs` - List processing jobs
- `GET /health` - Health check
- `GET /docs` - API documentation

## Processing Flow

1. User uploads document via API
2. Document stored in GCS bucket
3. Message published to Pub/Sub topic
4. Worker pulls from subscription
5. Document processed (chunked, analyzed)
6. Quality gates validate chunks
7. Chunks sent to Knowledge API
8. Knowledge API stores in AlloyDB

## Dependencies

- **Knowledge API** - Target for processed documents
- **GCS** - Document storage
- **Pub/Sub** - Async job queue
- **Redis** - Job state persistence
- **Document AI** (optional) - PDF/image text extraction

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [Knowledge API](../knowledge-api/README.md) - Document storage service
- [Orchestrator Service](../orchestrator-service/README.md) - Agent orchestration
- [KB Reference Platform](../docs/KB_REFERENCE_PLATFORM.md) - Production bar and adoption standard
