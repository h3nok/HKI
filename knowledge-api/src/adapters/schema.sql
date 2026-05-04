-- ═══════════════════════════════════════════════════════════════════════════════
-- Knowledge Platform Schema — AlloyDB + pgvector (Multi-Tenant)
--
-- Tenant Isolation:
--   Every table carries org_id for organization-level data segmentation.
--   Row-Level Security (RLS) policies enforce isolation at the database layer.
--
-- Tables:
--   documents   — Source documents with JSONB metadata
--   chunks      — Document segments with vector embeddings + full-text search
--   graph_edges — Co-occurrence and cross-reference relationships
--
-- Indexes:
--   HNSW on chunks.embedding      — ANN vector similarity search
--   GIN  on chunks.search_vector  — Full-text keyword search (replaces BM25)
--   BTREE on chunks.document_id   — Fast joins and cascade deletes
--   Composite (org_id, ...) indexes for tenant-scoped queries
--
-- Usage:
--   psql -h <alloydb-ip> -U postgres -d knowledge -f schema.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pgvector extension (must be superuser or have CREATE privilege)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Documents ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL DEFAULT 'default',
    content         TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT '',
    author          TEXT NOT NULL DEFAULT '',
    department      TEXT NOT NULL DEFAULT '',
    document_type   TEXT NOT NULL DEFAULT 'general',
    source_url      TEXT NOT NULL DEFAULT '',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    language        TEXT NOT NULL DEFAULT 'en',
    version         TEXT NOT NULL DEFAULT '1.0',
    status          TEXT NOT NULL DEFAULT 'pending',
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    custom_metadata JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant-scoped indexes (org_id prefix for partition-like query plans)
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents (org_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_department ON documents (org_id, department);
CREATE INDEX IF NOT EXISTS idx_documents_org_type ON documents (org_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents (org_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_department ON documents (department);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_documents_custom_metadata ON documents USING GIN (custom_metadata);

-- ── Chunks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chunks (
    id              TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    org_id          TEXT NOT NULL DEFAULT 'default',
    content         TEXT NOT NULL,
    embedding       vector(768),           -- Vertex AI text-embedding-004/005
    position        INTEGER NOT NULL DEFAULT 0,
    start_char      INTEGER NOT NULL DEFAULT 0,
    end_char        INTEGER NOT NULL DEFAULT 0,
    token_count     INTEGER NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    search_vector   tsvector,              -- PostgreSQL full-text search
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity search (HNSW = no training, good recall, fast queries)
-- m=16 connections per node, ef_construction=64 for build quality
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Full-text search (GIN index on tsvector column)
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector ON chunks
    USING GIN (search_vector);

-- Foreign key lookup (cascade deletes, document-scoped queries)
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks (document_id);

-- Tenant-scoped chunk lookups
CREATE INDEX IF NOT EXISTS idx_chunks_org ON chunks (org_id);
CREATE INDEX IF NOT EXISTS idx_chunks_org_doc ON chunks (org_id, document_id);

-- Position ordering within a document
CREATE INDEX IF NOT EXISTS idx_chunks_doc_position ON chunks (document_id, position);

-- ── Trigger: auto-populate search_vector on insert/update ──────────────────

CREATE OR REPLACE FUNCTION chunks_search_vector_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_search_vector ON chunks;
CREATE TRIGGER trg_chunks_search_vector
    BEFORE INSERT OR UPDATE OF content ON chunks
    FOR EACH ROW
    EXECUTE FUNCTION chunks_search_vector_trigger();

-- ── Graph edges (co-occurrence, cross-reference) ───────────────────────────

CREATE TABLE IF NOT EXISTS graph_edges (
    source_id       TEXT NOT NULL,
    target_id       TEXT NOT NULL,
    org_id          TEXT NOT NULL DEFAULT 'default',
    relationship    TEXT NOT NULL DEFAULT 'same_document',
    weight          REAL NOT NULL DEFAULT 1.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_id, target_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges (source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges (target_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_org ON graph_edges (org_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- Row-Level Security — defense-in-depth tenant isolation
-- ══════════════════════════════════════════════════════════════════════════════
-- RLS policies enforce that each session can only see rows matching its org_id.
-- Set per-transaction: SET app.current_org_id = 'acme';
-- Application adapter sets this before every query.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;

-- Policies: app role can only see/modify rows matching current org_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_documents'
    ) THEN
        CREATE POLICY tenant_isolation_documents ON documents
            USING (org_id = current_setting('app.current_org_id', true));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_chunks'
    ) THEN
        CREATE POLICY tenant_isolation_chunks ON chunks
            USING (org_id = current_setting('app.current_org_id', true));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_graph_edges'
    ) THEN
        CREATE POLICY tenant_isolation_graph_edges ON graph_edges
            USING (org_id = current_setting('app.current_org_id', true));
    END IF;
END $$;
