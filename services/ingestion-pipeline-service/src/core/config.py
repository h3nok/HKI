"""
Knowledge Pipeline Service — Configuration

Controls document ingestion behavior: source connectors, processing
limits, and downstream vector store connectivity.

Inherits common fields (auth, OTel, CORS, GCP, logging) from
``shared.config.ServiceSettings``.

Environment Variables:
    SERVICE_PORT            — HTTP port (default 9508)
    KNOWLEDGE_API_URL       — Where to send processed documents for indexing
    MAX_DOCUMENT_SIZE_MB    — Maximum single document size to accept
    DEFAULT_CHUNK_SIZE      — Default tokens per chunk
    DEFAULT_CHUNK_OVERLAP   — Default token overlap between chunks
"""

import shared.config


class Settings(shared.config.ServiceSettings):
    """Application settings loaded from environment."""

    KB_HERMETIC_ISOLATION: bool = False

    # ── Service Identity (overrides) ──────────────────────────────────────
    SERVICE_NAME: str = "knowledge-pipeline-service"
    SERVICE_PORT: int = 9508
    CORS_ORIGINS: list[str] = [
        "http://localhost:9001",
        "http://localhost:9002",
        "http://localhost:9501",
    ]

    # ── Downstream Services ───────────────────────────────────────────────
    KNOWLEDGE_API_URL: str = "http://localhost:9509"
    # Shared secret this service presents in X-Pipeline-Secret when calling
    # knowledge-api POST /v1/internal/store. Must match PIPELINE_SERVICE_SECRET
    # in knowledge-api. Empty = no header sent (safe in local dev when
    # knowledge-api PIPELINE_SERVICE_SECRET is also empty).
    KNOWLEDGE_API_PIPELINE_SECRET: str = ""

    # ── Analytics Service ─────────────────────────────────────────────────
    # Set to emit kb.ingest events for pipeline metrics.
    # Empty = analytics disabled (no-op client).
    ANALYTICS_SERVICE_URL: str = ""
    ANALYTICS_INGEST_SECRET: str = ""

    # ── Memorystore Redis (job persistence + cache) ────────────────────
    REDIS_URL: str = ""  # redis://host:port (empty = in-memory fallback)
    REDIS_JOB_TTL_HOURS: int = 72  # Auto-expire jobs after 72h
    REDIS_JOB_PREFIX: str = "kp:job:"  # Key prefix for job hashes

    # ── Processing Limits ─────────────────────────────────────────────────
    MAX_DOCUMENT_SIZE_MB: int = 50  # Reject documents larger than this
    MAX_CONCURRENT_JOBS: int = 5  # Parallel ingestion jobs (semaphore)
    JOB_STALE_TIMEOUT_MINUTES: int = 30  # Auto-fail non-terminal jobs stuck past this age
    DEFAULT_CHUNK_SIZE: int = 512  # Target tokens per chunk
    DEFAULT_CHUNK_OVERLAP: int = 64  # Token overlap between chunks
    DEFAULT_CHUNK_STRATEGY: str = "sentence"  # fixed | sentence | sliding_window

    # ── Retry / Resilience ────────────────────────────────────────────────
    RETRY_MAX_ATTEMPTS: int = 3  # Retries on vector-store calls
    RETRY_BASE_DELAY: float = 1.0  # Initial backoff delay (seconds)
    RETRY_MAX_DELAY: float = 30.0  # Ceiling for exponential backoff

    # ── LLM (Gateway or Vertex AI direct) ────────────────────────────────
    LLM_ENABLED: bool = False  # Enable LLM chunk contextualization
    LLM_GATEWAY_URL: str = ""  # Empty = Vertex AI direct via google.genai + ADC
    LLM_API_KEY: str = "sk-1234"  # LiteLLM master key (gateway only)
    LLM_MODEL: str = "gemini-2.5-flash"  # Model for contextualization
    LLM_MAX_CONCURRENT: int = 5  # Max parallel LLM calls
    LLM_CONTEXT_MAX_TOKENS: int = 200  # Max tokens per context summary
    VERTEX_AI_LOCATION: str = "us-central1"  # For Vertex AI direct mode

    # ── RAPTOR Hierarchical Summarization (KB-1) ──────────────────────────
    RAPTOR_ENABLED: bool = False
    RAPTOR_MAX_LEVELS: int = 3

    # ── Evaluation Gating (KB-2) ──────────────────────────────────────────
    EVAL_ON_INGEST_ENABLED: bool = False
    EVAL_PROMOTION_THRESHOLD: float = 0.65
    EVAL_QUESTIONS_PER_DOC: int = 5

    # ── Governance Controls (Phase 8) ─────────────────────────────────────
    PII_REDACTION_ENABLED: bool = True


    # ── Gemini (pre-ingestion enrichment) ───────────────────────────────
    GEMINI_ENABLED: bool = False  # Enable Gemini-based pre-ingestion enrichment

    # ── Cloud Storage (landing zone) ─────────────────────────────────────
    GCS_ENABLED: bool = False  # Enable GCS landing zone
    GCS_BUCKET: str = ""  # Bucket name for raw documents
    GCS_PREFIX: str = "knowledge/raw/"  # Object prefix

    # ── S3-Compatible / MinIO Storage (Phase 8 On-Prem) ───────────────────
    S3_ENABLED: bool = False
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin"
    S3_BUCKET: str = "knowledge-raw"
    S3_PREFIX: str = "knowledge/raw/"
    S3_REGION: str = "us-east-1"

    # ── Document AI (optional OCR/layout extraction) ─────────────────────
    DOCAI_ENABLED: bool = False
    DOCAI_PROCESSOR_ID: str = ""

    # ── Cloud Pub/Sub (durable job queue) ─────────────────────────────────
    PUBSUB_ENABLED: bool = False  # True → publish to Pub/Sub; False → inline asyncio
    PUBSUB_PROJECT_ID: str = ""  # GCP project ID (auto-detected on GKE)
    PUBSUB_TOPIC: str = "knowledge-ingestion"  # Topic for ingestion messages
    PUBSUB_SUBSCRIPTION: str = "knowledge-ingestion-worker"  # Pull subscription
    PUBSUB_DLQ_TOPIC: str = "knowledge-ingestion-dlq"  # Dead letter topic
    PUBSUB_ACK_DEADLINE_SEC: int = 600  # 10 min — long enough for full pipeline
    PUBSUB_MAX_DELIVERY_ATTEMPTS: int = 5  # Retries before DLQ
    PUBSUB_EMULATOR_HOST: str = ""  # Set for local dev: localhost:8085

    # ── Per-tenant Concurrency ──────────────────────────────────────────────
    CONCURRENCY_MAX_PER_ORG: int = 5  # Max simultaneous jobs per org_id
    CONCURRENCY_KEY_PREFIX: str = "kp:concurrency:"  # Redis key prefix
    CONCURRENCY_SLOT_TTL: int = 3600  # Safety TTL for stuck slots (1h)

    # ── Web Scraping ──────────────────────────────────────────────────────
    SCRAPER_TIMEOUT: float = 30.0  # HTTP timeout for URL fetching
    SCRAPER_MAX_PAGES: int = 10  # Max pages to follow per crawl

    # ── Observability Data Source ───────────────────────────────────────
    OBSERVABILITY_BACKEND: str = "cache"  # cache | dynatrace | auto
    OBSERVABILITY_LOOKBACK_MINUTES: int = 60
    DYNATRACE_BASE_URL: str = ""  # e.g. https://abc123.live.dynatrace.com
    DYNATRACE_API_TOKEN: str = ""  # API token with log read permissions
    DYNATRACE_LOGS_ENDPOINT: str = "/api/v2/logs/export"
    DYNATRACE_TIMEOUT_SEC: float = 8.0
    DYNATRACE_LOG_QUERY: str = 'log_type="llm_trace"'


settings = Settings()
