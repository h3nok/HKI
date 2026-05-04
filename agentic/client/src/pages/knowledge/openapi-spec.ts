/**
 * Static OpenAPI 3.1 spec for the Knowledge Pipeline Service.
 *
 * Generated from the FastAPI app metadata + Pydantic models.
 * Used by the Scalar API explorer when the live backend is unavailable.
 */

export const PIPELINE_OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Knowledge Pipeline Service',
    summary: 'Document ingestion pipeline for organizational knowledge',
    description: `## Overview

The Knowledge Pipeline Service powers the ingestion layer of the Agentic Platform's
knowledge management system. It processes raw content — text, URLs, and HTML —
through a multi-stage pipeline and indexes it into the vector store for
semantic retrieval.

## Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Extract** | Pull raw text from source (text, URL, HTML) |
| **Clean** | Normalize whitespace, strip boilerplate, deduplicate |
| **Enrich** | Extract entities, dates, topics, reading time |
| **Contextualize** | Gemini-generated chunk summaries for better retrieval |
| **Chunk** | Split into overlapping segments |
| **Embed** | Generate vector embeddings (delegated to vector-store) |
| **Index** | Store chunks + metadata in the vector store |

## Architecture

- **Queue**: Google Cloud Pub/Sub (in-memory fallback for local dev)
- **Job Store**: Redis (in-memory fallback)
- **Document Store**: Google Cloud Storage (no-op fallback)
- **Auth**: JWT-based multi-tenant isolation (\`org_id\` from token)

## Authentication

All endpoints require a Bearer JWT token. The \`org_id\` claim scopes all
storage operations for tenant isolation.

\`\`\`
Authorization: Bearer <jwt>
\`\`\``,
    version: '1.0.0',
    contact: {
      name: 'Platform Engineering',
      email: 'platform-eng@hki.com',
    },
    license: {
      name: 'Internal',
      identifier: 'proprietary',
    },
  },
  servers: [
    { url: 'http://localhost:9507', description: 'Local development' },
    { url: 'https://knowledge-pipeline.internal.hki.com', description: 'Production' },
  ],
  tags: [
    {
      name: 'ingestion',
      description:
        'Submit content for processing through the knowledge pipeline. Supports raw text and URL sources with configurable chunking strategies.',
    },
    {
      name: 'jobs',
      description:
        'Monitor and manage ingestion jobs. Track pipeline progress, view processing metrics, and inspect completed job details.',
    },
    {
      name: 'health',
      description: 'Service health and readiness probes for Kubernetes orchestration.',
    },
  ],
  paths: {
    '/v1/ingest/text': {
      post: {
        tags: ['ingestion'],
        summary: 'Ingest raw text',
        description:
          'Ingest raw text content into the knowledge base.\n\nWhen PUBSUB_ENABLED: creates a job record, publishes a message to Pub/Sub, and returns immediately. A worker pod picks it up.\n\nWhen PUBSUB_ENABLED=False: falls back to inline asyncio background task (original behavior for local dev).\n\nAuth: org_id and JWT are forwarded to the vector-store for tenant-scoped storage.',
        operationId: 'ingest_text',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IngestTextRequest' },
              example: {
                content:
                  "HKI's return policy allows members to return most items at any time for a full refund. Electronics must be returned within 90 days.",
                title: 'Return Policy Overview',
                department: 'Member Services',
                document_type: 'policy',
                tags: ['returns', 'refunds', 'member-services'],
                chunk_size: 512,
                chunk_overlap: 64,
                chunk_strategy: 'sentence',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IngestResponse' },
                example: {
                  job_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  status: 'queued',
                  document_id: null,
                  chunk_count: 0,
                  message: 'Job published to queue for processing',
                },
              },
            },
          },
          '400': { description: 'Content cannot be empty' },
          '401': { description: 'Missing or invalid JWT token' },
        },
      },
    },
    '/v1/ingest/url': {
      post: {
        tags: ['ingestion'],
        summary: 'Ingest from URL',
        description:
          'Fetch content from a URL and ingest into the knowledge base.\n\nWhen PUBSUB_ENABLED: publishes to queue. Otherwise inline.',
        operationId: 'ingest_url',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IngestURLRequest' },
              example: {
                url: 'https://www.hki.com/membership-conditions.html',
                title: 'Membership Conditions',
                department: 'Membership',
                document_type: 'policy',
                tags: ['membership', 'terms'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IngestResponse' },
              },
            },
          },
          '400': { description: 'URL cannot be empty' },
          '401': { description: 'Missing or invalid JWT token' },
        },
      },
    },
    '/v1/jobs': {
      get: {
        tags: ['jobs'],
        summary: 'List ingestion jobs',
        description: 'List all ingestion jobs with pagination, ordered by creation time.',
        operationId: 'list_jobs',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Maximum number of jobs to return',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'Number of jobs to skip for pagination',
          },
        ],
        responses: {
          '200': {
            description: 'Paginated job list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobListResponse' },
                example: {
                  jobs: [
                    {
                      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                      status: 'completed',
                      title: 'Return Policy Overview',
                      source_type: 'text',
                      document_id: 'doc-abc123',
                      chunk_count: 12,
                      created_at: '2026-02-17T10:30:00Z',
                      processing_time_ms: 2340.5,
                    },
                  ],
                  total: 1,
                },
              },
            },
          },
          '401': { description: 'Missing or invalid JWT token' },
        },
      },
    },
    '/v1/jobs/{job_id}': {
      get: {
        tags: ['jobs'],
        summary: 'Get job details',
        description: 'Get detailed status of a specific ingestion job.',
        operationId: 'get_job',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'job_id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Unique job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job details with completed stages',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatusResponse' },
              },
            },
          },
          '404': { description: 'Job not found' },
          '401': { description: 'Missing or invalid JWT token' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Liveness probe',
        description: 'Returns healthy if the process is running.',
        operationId: 'health',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    service: { type: 'string', example: 'knowledge-pipeline-service' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['health'],
        summary: 'Readiness probe',
        description: 'Checks downstream dependencies (vector-store).',
        operationId: 'readiness',
        responses: {
          '200': {
            description: 'Service readiness status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ready', 'degraded'] },
                    checks: {
                      type: 'object',
                      properties: {
                        vector_store: { type: 'string', example: 'ok' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token with org_id claim for tenant isolation',
      },
    },
    schemas: {
      JobStatus: {
        type: 'string',
        enum: [
          'queued',
          'extracting',
          'cleaning',
          'enriching',
          'chunking',
          'embedding',
          'indexing',
          'completed',
          'failed',
        ],
        description: 'Lifecycle state of an ingestion job',
      },
      SourceType: {
        type: 'string',
        enum: ['text', 'url', 'html', 'markdown'],
        description: 'Type of input source',
      },
      IngestTextRequest: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'The raw text content to ingest' },
          title: { type: 'string', default: '', description: 'Document title (auto-detected if empty)' },
          department: { type: 'string', default: '', description: 'Organizational department for filtering' },
          document_type: {
            type: 'string',
            default: 'general',
            description: 'Category: general, policy, faq, procedure, etc.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Searchable tags',
          },
          chunk_size: {
            type: 'integer',
            default: 512,
            minimum: 64,
            maximum: 4096,
            description: 'Target tokens per chunk',
          },
          chunk_overlap: {
            type: 'integer',
            default: 64,
            minimum: 0,
            maximum: 512,
            description: 'Overlap tokens between chunks',
          },
          chunk_strategy: {
            type: 'string',
            default: 'sentence',
            description: 'Strategy: sentence, paragraph, fixed',
          },
        },
      },
      IngestURLRequest: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri', description: 'Web URL to fetch and ingest' },
          title: { type: 'string', default: '', description: 'Document title (auto-detected from page if empty)' },
          department: { type: 'string', default: '', description: 'Organizational department for filtering' },
          document_type: { type: 'string', default: 'general', description: 'Category: general, policy, faq, procedure, etc.' },
          tags: { type: 'array', items: { type: 'string' }, default: [], description: 'Searchable tags' },
          chunk_size: { type: 'integer', default: 512, minimum: 64, maximum: 4096, description: 'Target tokens per chunk' },
          chunk_overlap: { type: 'integer', default: 64, minimum: 0, maximum: 512, description: 'Overlap tokens between chunks' },
          follow_links: { type: 'boolean', default: false, description: 'Whether to crawl linked pages' },
        },
      },
      IngestResponse: {
        type: 'object',
        required: ['job_id', 'status'],
        properties: {
          job_id: { type: 'string', format: 'uuid', description: 'Unique job ID for tracking' },
          status: { $ref: '#/components/schemas/JobStatus' },
          document_id: { type: 'string', nullable: true, description: 'Vector store document ID (set on completion)' },
          chunk_count: { type: 'integer', default: 0, description: 'Number of chunks indexed' },
          message: { type: 'string', default: '', description: 'Human-readable status message' },
        },
      },
      IngestionJob: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          org_id: { type: 'string', default: 'default' },
          status: { $ref: '#/components/schemas/JobStatus' },
          source_type: { $ref: '#/components/schemas/SourceType' },
          source_ref: { type: 'string', description: 'URL or filename of the source' },
          title: { type: 'string' },
          department: { type: 'string' },
          document_type: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          document_id: { type: 'string', nullable: true },
          chunk_count: { type: 'integer' },
          entity_count: { type: 'integer' },
          error: { type: 'string', nullable: true },
          raw_size_bytes: { type: 'integer' },
          clean_size_bytes: { type: 'integer' },
          processing_time_ms: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          completed_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      JobListResponse: {
        type: 'object',
        properties: {
          jobs: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of job summaries',
          },
          total: { type: 'integer', description: 'Total number of jobs' },
        },
      },
      JobStatusResponse: {
        type: 'object',
        properties: {
          job: { $ref: '#/components/schemas/IngestionJob' },
          stages_completed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Pipeline stages that have completed',
          },
        },
      },
    },
  },
} as const;
