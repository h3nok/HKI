"""
Knowledge API — Configuration

Manages all settings via environment variables with sensible local-dev defaults.
In production, values come from GCP Secret Manager or K8s ConfigMaps.

Inherits common fields (auth, OTel, CORS, GCP, logging) from
``shared.config.ServiceSettings``.

Environment Variables:
    SERVICE_PORT            — HTTP port (default 9509)
    EMBEDDING_GATEWAY_URL   — LiteLLM proxy URL for embedding requests
    EMBEDDING_MODEL         — Model name for text embeddings
    EMBEDDING_DIMENSIONS    — Dimensionality of embedding vectors
    REDIS_URL               — Redis connection for optional caching
    MAX_RESULTS             — Default number of search results to return
"""

from shared.config import ServiceSettings


class Settings(ServiceSettings):
    """Application settings loaded from environment."""

    KB_HERMETIC_ISOLATION: bool = False

    # ── Service Identity (overrides) ──────────────────────────────────────
    SERVICE_NAME: str = "knowledge-api"
    SERVICE_PORT: int = 9509
    CORS_ORIGINS: list[str] = [
        "http://localhost:9001",
        "http://localhost:9002",
        "http://localhost:9501",
    ]

    # ── Embedding (Gateway or Vertex AI direct) ────────────────────────
    # When EMBEDDING_GATEWAY_URL is empty, embeddings are generated via
    # Vertex AI directly using google.genai + ADC (no gateway needed).
    EMBEDDING_GATEWAY_URL: str = ""
    EMBEDDING_API_KEY: str = "sk-1234"
    EMBEDDING_MODEL: str = "text-embedding-004"
    EMBEDDING_DIMENSIONS: int = 768
    VERTEX_AI_LOCATION: str = "us-central1"
    # When set, evaluation runs are recorded in Vertex AI Experiments under this name.
    # Empty = evaluations run but results are not persisted to Experiments.
    VERTEX_AI_EXPERIMENT: str = ""

    # ── Search Defaults ───────────────────────────────────────────────────
    MAX_RESULTS: int = 10
    SIMILARITY_THRESHOLD: float = 0.3  # minimum cosine similarity to include
    BM25_WEIGHT: float = 0.3  # weight of keyword score in hybrid search
    VECTOR_WEIGHT: float = 0.7  # weight of vector score in hybrid search

    # ── AlloyDB (production vector store) ────────────────────────────────
    # Set ALLOYDB_URL to enable persistent storage. When empty, uses in-memory.
    # Local:  postgresql://postgres:password@localhost:5432/knowledge
    # GKE:   postgresql://postgres@localhost:5432/knowledge  (via Auth Proxy)
    ALLOYDB_URL: str = ""
    ALLOYDB_POOL_MIN: int = 2
    ALLOYDB_POOL_MAX: int = 20

    # ── Neo4j (knowledge graph) ──────────────────────────────────────────
    # Set NEO4J_URI to enable knowledge graph. Empty = graph disabled.
    # Local:  bolt://localhost:9687
    # Aura:   neo4j+s://xxxx.databases.neo4j.io
    NEO4J_URI: str = ""
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = "neo4j"

    # ── Entity Extraction ─────────────────────────────────────────────
    ENTITY_EXTRACTION_ENABLED: bool = True
    ENTITY_EXTRACTION_MODEL: str = "gemini-2.0-flash"

    # ── Contextual Retrieval ──────────────────────────────────────────────
    CONTEXTUAL_RETRIEVAL_ENABLED: bool = False
    CONTEXTUAL_RETRIEVAL_MODEL: str = "gemini-2.0-flash"

    # ── Pipeline-to-Store Write Secret ────────────────────────────────────
    # Shared secret that knowledge-pipeline-service must present in the
    # X-Pipeline-Secret header when calling POST /v1/internal/store.
    # Empty = check disabled (local dev). In production set a long random value
    # matching KNOWLEDGE_API_PIPELINE_SECRET in knowledge-pipeline-service.
    PIPELINE_SERVICE_SECRET: str = ""

    # ── Analytics Service ─────────────────────────────────────────────────
    # Set to emit kb.search / kb.ingest events for CMOS and ingest metrics.
    # Empty = analytics disabled (no-op client).
    ANALYTICS_SERVICE_URL: str = ""
    ANALYTICS_INGEST_SECRET: str = ""

    # ── Redis (optional caching layer) ────────────────────────────────────
    REDIS_URL: str = "redis://localhost:9379/1"


settings = Settings()
