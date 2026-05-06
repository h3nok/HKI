"""
AlloyDB Vector Store — production storage adapter with pgvector.

Drop-in replacement for the in-memory VectorStore. Uses AlloyDB (PostgreSQL)
with the pgvector extension for persistent vector similarity search and
PostgreSQL's native tsvector/tsquery for full-text keyword search.

Architecture:
    - asyncpg connection pool for non-blocking I/O
    - HNSW index for ANN vector search (no training, good recall)
    - GIN index on tsvector for full-text search
    - Reciprocal Rank Fusion (RRF) for hybrid search
    - Graph edges stored in a separate table for knowledge graph traversal

Connection:
    Local dev:  postgresql://postgres:password@localhost:5432/knowledge
    GKE prod:   Via AlloyDB Auth Proxy sidecar (IAM-based, no password)
"""

from __future__ import annotations

import json
import pathlib
import re
import time
import typing
import urllib.parse
from typing import Any

import asyncpg

import src.core.config
import src.core.logging
import src.domain.models


class AlloyDBVectorStore:
    """
    Production vector store backed by AlloyDB + pgvector.

    Provides the same interface as the in-memory VectorStore so the API
    routes don't need to change. All search, storage, and graph operations
    are implemented as SQL queries.
    """

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    # ═══════════════════════════════════════════════════════════════════════
    # Lifecycle
    # ═══════════════════════════════════════════════════════════════════════

    async def connect(self, dsn: str | None = None) -> None:
        """Create the connection pool and ensure schema exists."""
        dsn = dsn or src.core.config.settings.ALLOYDB_URL

        # First, try to create the database if it doesn't exist
        # Connect to the 'postgres' maintenance database to create 'knowledge'
        from urllib.parse import urlparse, urlunparse

        parsed: urllib.parse.ParseResult = urlparse(dsn)
        dbname: str = parsed.path[1:] if parsed.path else "postgres"

        # Connect to postgres database to create target database if needed
        if dbname != "postgres":
            maintenance_dsn: str = urlunparse(parsed._replace(path="/postgres"))
            try:
                conn = await asyncpg.connect(maintenance_dsn, timeout=10)
                try:
                    # Check if database exists
                    exists = await conn.fetchval(
                        "SELECT 1 FROM pg_database WHERE datname = $1", dbname
                    )
                    if not exists:
                        await conn.execute(f'CREATE DATABASE "{dbname}"')
                        src.core.logging.logger.info(f"Created database: {dbname}")
                except Exception as e:
                    src.core.logging.logger.warning(f"Could not create database {dbname}: {e}")
                finally:
                    await conn.close()
            except Exception as e:
                src.core.logging.logger.warning(f"Could not connect to maintenance database: {e}")

        # Now connect to the target database
        self._pool = await asyncpg.create_pool(
            dsn,
            min_size=2,
            max_size=20,
            command_timeout=30,
        )

        # Run schema migration (idempotent — all CREATE IF NOT EXISTS)
        schema_path: pathlib.Path = pathlib.Path(__file__).parent / "schema.sql"
        schema_sql: str = schema_path.read_text(encoding="utf-8")
        async with self._pool.acquire() as conn:
            await conn.execute(schema_sql)

        src.core.logging.logger.info(
            "AlloyDB vector store connected",
            extra={"dsn": _redact_dsn(dsn), "pool_size": "2-20"},
        )

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            src.core.logging.logger.info("AlloyDB vector store closed")

    def _ensure_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("AlloyDB pool not initialized — call connect() first")
        return self._pool

    @staticmethod
    def _normalize_user_id(user_id: str | None) -> str | None:
        if user_id is None:
            return None
        token: str = str(user_id).strip().lower()
        return token or None

    @staticmethod
    def _normalize_principals(principals: list[str] | None) -> set[str]:
        return {
            str(principal).strip().lower()
            for principal in (principals or [])
            if str(principal).strip()
        }

    @classmethod
    def _acl_access_allowed(
        cls,
        doc: src.domain.models.Document,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        access_control = doc.metadata.access_control or src.domain.models.DocumentAccessControl()
        classification = doc.metadata.classification
        normalized_user: str | None = cls._normalize_user_id(user_id)
        normalized_principals: set[str] = cls._normalize_principals(principals)

        if normalized_user and normalized_user in set(access_control.denied_users):
            return False
        if normalized_principals & set(access_control.denied_groups):
            return False

        if access_control.has_explicit_allow_list():
            if normalized_user and normalized_user in set(access_control.allowed_users):
                return True
            if normalized_principals & set(access_control.allowed_groups):
                return True
            return False

        return classification not in (
            src.domain.models.DocumentClassification.RESTRICTED,
            src.domain.models.DocumentClassification.PRIVILEGED,
        )

    async def _get_document_in_conn(
        self,
        conn: asyncpg.Connection,
        document_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
    ) -> src.domain.models.Document | None:
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=3,
            column_prefix="",
        )
        row = await conn.fetchrow(
            f"SELECT * FROM documents WHERE id = $1 AND org_id = $2{stream_clause}",
            document_id,
            org_id,
            *stream_params,
        )
        if not row:
            return None
        return _row_to_document(row)

    async def _filter_search_results_by_acl(
        self,
        conn: asyncpg.Connection,
        results: list[src.domain.models.SearchResult],
        *,
        org_id: str,
        allowed_streams: list[str] | None,
        user_id: str | None,
        principals: list[str] | None,
        top_k: int,
    ) -> list[src.domain.models.SearchResult]:
        if not results:
            return []

        authorized_docs: dict[str, bool] = {}
        filtered: list[src.domain.models.SearchResult] = []
        for result in results:
            if result.document_id not in authorized_docs:
                doc = await self._get_document_in_conn(
                    conn,
                    result.document_id,
                    org_id=org_id,
                    allowed_streams=allowed_streams,
                )
                authorized_docs[result.document_id] = bool(
                    doc and self._acl_access_allowed(doc, user_id=user_id, principals=principals)
                )
            if authorized_docs[result.document_id]:
                filtered.append(result)
            if len(filtered) >= top_k:
                break
        return filtered

    # ═══════════════════════════════════════════════════════════════════════
    # Document & Chunk Storage
    # ═══════════════════════════════════════════════════════════════════════

    async def store_document(self, document: src.domain.models.Document, chunks: list[src.domain.models.Chunk]) -> str:
        """Store a document and its chunks. Builds graph edges."""
        pool: asyncpg.Pool = self._ensure_pool()
        org_id: typing.Any | str = getattr(document, "org_id", "default")
        custom_metadata: dict[str, typing.Any] = _document_custom_metadata(document)
        async with pool.acquire() as conn, conn.transaction():
            # Insert document
            await conn.execute(
                """
                INSERT INTO documents (
                    id, org_id, content, title, author, department,
                    document_type, source_url, tags, language, version,
                    status, chunk_count, custom_metadata,
                    created_at, updated_at
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
                )
                ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    title = EXCLUDED.title,
                    status = EXCLUDED.status,
                    chunk_count = EXCLUDED.chunk_count,
                    updated_at = NOW()
                """,
                document.id,
                org_id,
                document.content,
                document.metadata.title,
                document.metadata.author,
                document.metadata.department,
                document.metadata.document_type.value,
                document.metadata.source_url,
                document.metadata.tags,
                document.metadata.language,
                document.metadata.version,
                document.status.value,
                len(chunks),
                json.dumps(custom_metadata, default=str),
                document.metadata.created_at,
                document.metadata.updated_at,
            )

            # Insert chunks (batch)
            chunk_records = [
                (
                    chunk.id,
                    chunk.document_id,
                    org_id,
                    chunk.content,
                    _to_pgvector(chunk.embedding),
                    chunk.position,
                    chunk.start_char,
                    chunk.end_char,
                    chunk.token_count,
                    json.dumps(chunk.metadata, default=str),
                )
                for chunk in chunks
            ]
            await conn.executemany(
                """
                INSERT INTO chunks (
                    id, document_id, org_id, content, embedding,
                    position, start_char, end_char, token_count, metadata
                ) VALUES (
                    $1,$2,$3,$4,$5::vector,$6,$7,$8,$9,$10::jsonb
                )
                ON CONFLICT (id) DO NOTHING
                """,
                chunk_records,
            )

            # Build co-occurrence graph edges
            chunk_ids = [c.id for c in chunks]
            edge_records = []
            for i, cid_a in enumerate(chunk_ids):
                for cid_b in chunk_ids[i + 1 :]:
                    edge_records.append((cid_a, cid_b, org_id, "same_document", 0.8))

            if edge_records:
                await conn.executemany(
                    """
                    INSERT INTO graph_edges (
                        source_id, target_id, org_id,
                        relationship, weight
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                    """,
                    edge_records,
                )

        src.core.logging.logger.info(
            "Document stored (AlloyDB)",
            extra={
                "document_id": document.id,
                "org_id": org_id,
                "chunks": len(chunks),
            },
        )
        return document.id

    async def get_document(
        self,
        document_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.Document | None:
        """Retrieve a document by ID, scoped by org_id."""
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            doc = await self._get_document_in_conn(
                conn,
                document_id,
                org_id=org_id,
                allowed_streams=allowed_streams,
            )
        if not doc or not self._acl_access_allowed(doc, user_id=user_id, principals=principals):
            return None
        return doc

    async def get_chunk(
        self,
        chunk_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.Chunk | None:
        """Retrieve a single chunk by ID, scoped by org_id."""
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=3,
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT c.*
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.id = $1 AND c.org_id = $2{stream_clause}
                """,
                chunk_id,
                org_id,
                *stream_params,
            )
            if not row:
                return None
            doc = await self._get_document_in_conn(
                conn,
                row["document_id"],
                org_id=org_id,
                allowed_streams=allowed_streams,
            )
        if not doc or not self._acl_access_allowed(doc, user_id=user_id, principals=principals):
            return None
        return _row_to_chunk(row)

    async def list_documents(
        self,
        limit: int = 50,
        offset: int = 0,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> tuple[list[src.domain.models.Document], int]:
        """List documents with pagination, scoped by org_id."""
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=2,
            column_prefix="",
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT * FROM documents
                WHERE org_id = $1{stream_clause}
                ORDER BY created_at DESC
                """,
                org_id,
                *stream_params,
            )
        docs = [
            doc
            for doc in (_row_to_document(r) for r in rows)
            if self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ]
        total: int = len(docs)
        return docs[offset : offset + limit], total

    async def update_document_status(
        self,
        document_id: str,
        status: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Update the status of a document (e.g. archive, reactivate)."""
        existing = await self.get_document(
            document_id,
            org_id=org_id,
            allowed_streams=allowed_streams,
            user_id=user_id,
            principals=principals,
        )
        if not existing:
            return False
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=4,
            column_prefix="",
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"""
                UPDATE documents SET status = $1, updated_at = NOW()
                WHERE id = $2 AND org_id = $3{stream_clause}
                """,
                status,
                document_id,
                org_id,
                *stream_params,
            )
        updated = result == "UPDATE 1"
        if updated:
            src.core.logging.logger.info(
                "Document status updated (AlloyDB)",
                extra={"document_id": document_id, "new_status": status, "org_id": org_id},
            )
        return updated

    async def update_document_metadata(
        self,
        document_id: str,
        metadata_dict: dict,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Update document metadata fields including JSONB ACL/classification state."""
        existing = await self.get_document(
            document_id,
            org_id=org_id,
            allowed_streams=allowed_streams,
            user_id=user_id,
            principals=principals,
        )
        if not existing:
            return False
        merged = existing.metadata.model_dump(mode="python")
        merged.update(metadata_dict)
        metadata = src.domain.models.DocumentMetadata(**merged)
        custom_metadata: dict[str, typing.Any] = _document_custom_metadata(
            existing.model_copy(update={"metadata": metadata})
        )
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=11,
            column_prefix="",
        )

        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"""
                UPDATE documents
                SET title = $1,
                    department = $2,
                    document_type = $3,
                    tags = $4::text[],
                    source_url = $5,
                    author = $6,
                    language = $7,
                    version = $8,
                    custom_metadata = $9::jsonb,
                    updated_at = NOW()
                WHERE id = $10 AND org_id = $11{stream_clause}
                """,
                metadata.title,
                metadata.department,
                metadata.document_type.value,
                metadata.tags,
                metadata.source_url,
                metadata.author,
                metadata.language,
                metadata.version,
                json.dumps(custom_metadata, default=str),
                document_id,
                org_id,
                *stream_params,
            )

        updated = result == "UPDATE 1"
        if updated:
            src.core.logging.logger.info(
                "Document metadata updated (AlloyDB)",
                extra={
                    "document_id": document_id,
                    "org_id": org_id,
                    "fields": list(metadata_dict.keys()),
                },
            )
        return updated

    async def document_inventory_summary(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.DocumentInventorySummary:
        """Return aggregate document inventory metrics with SQL-side grouping."""
        pool: asyncpg.Pool = self._ensure_pool()

        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=2,
            column_prefix="",
        )

        async with pool.acquire() as conn:
            status_rows = await conn.fetch(
                f"""
                SELECT status, COUNT(*) AS count
                FROM documents d
                WHERE org_id = $1
                {stream_clause}
                GROUP BY status
                """,
                org_id,
                *stream_params,
            )

            department_rows = await conn.fetch(
                f"""
                SELECT department AS label, COUNT(*) AS value
                FROM documents d
                WHERE org_id = $1
                  AND NULLIF(BTRIM(COALESCE(department, '')), '') IS NOT NULL
                  {stream_clause}
                GROUP BY department
                ORDER BY COUNT(*) DESC, department ASC
                LIMIT 3
                """,
                org_id,
                *stream_params,
            )

            freshness_row = await conn.fetchrow(
                f"""
                SELECT
                    COUNT(*) AS total_documents,
                    COUNT(*) FILTER (
                        WHERE NULLIF(BTRIM(COALESCE(department, '')), '') IS NULL
                    ) AS missing_labels_count,
                    COUNT(*) FILTER (
                        WHERE COALESCE(updated_at, created_at) IS NULL
                    ) AS unknown_count,
                    COUNT(*) FILTER (
                        WHERE COALESCE(updated_at, created_at) > CURRENT_TIMESTAMP - INTERVAL '30 days'
                    ) AS current_count,
                    COUNT(*) FILTER (
                        WHERE COALESCE(updated_at, created_at) <= CURRENT_TIMESTAMP - INTERVAL '30 days'
                          AND COALESCE(updated_at, created_at) > CURRENT_TIMESTAMP - INTERVAL '90 days'
                    ) AS review_count,
                    COUNT(*) FILTER (
                        WHERE COALESCE(updated_at, created_at) <= CURRENT_TIMESTAMP - INTERVAL '90 days'
                    ) AS stale_count
                FROM documents d
                WHERE org_id = $1
                {stream_clause}
                """,
                org_id,
                *stream_params,
            )

        status_counts: dict[str, int] = {
            str(row["status"]): int(row["count"] or 0) for row in status_rows
        }
        top_departments = [
            src.domain.models.DepartmentCount(
                label=str(row["label"]), value=int(row["value"] or 0)
            )
            for row in department_rows
        ]

        return src.domain.models.DocumentInventorySummary(
            total_documents=int(freshness_row["total_documents"] or 0),
            live_count=status_counts.get("published", 0)
            + status_counts.get("indexed", 0),
            pending_review_count=status_counts.get("pending_review", 0),
            processing_count=status_counts.get("pending", 0)
            + status_counts.get("processing", 0),
            archived_count=status_counts.get("archived", 0),
            failed_count=status_counts.get("failed", 0),
            missing_labels_count=int(freshness_row["missing_labels_count"] or 0),
            top_departments=top_departments,
            freshness=src.domain.models.DocumentFreshnessSummary(
                current_count=int(freshness_row["current_count"] or 0),
                review_count=int(freshness_row["review_count"] or 0),
                stale_count=int(freshness_row["stale_count"] or 0),
                unknown_count=int(freshness_row["unknown_count"] or 0),
            ),
        )

    async def list_tags(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> list[str]:
        """Return all unique tags across documents for a given org."""
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=2,
            column_prefix="",
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT *
                FROM documents
                WHERE org_id = $1{stream_clause} AND tags != '{{}}'
                ORDER BY created_at DESC
                """,
                org_id,
                *stream_params,
            )
        tags: set[str] = set()
        for row in rows:
            doc = _row_to_document(row)
            if not self._acl_access_allowed(doc, user_id=user_id, principals=principals):
                continue
            tags.update(doc.metadata.tags)
        return sorted(tags)

    async def delete_document(
        self,
        document_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Remove a document and all chunks (CASCADE), scoped by org_id."""
        existing = await self.get_document(
            document_id,
            org_id=org_id,
            allowed_streams=allowed_streams,
            user_id=user_id,
            principals=principals,
        )
        if not existing:
            return False
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=3,
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn, conn.transaction():
            # Clean up graph edges for this document's chunks
            await conn.execute(
                f"""
                DELETE FROM graph_edges
                WHERE org_id = $2
                  AND (source_id IN (
                      SELECT c.id FROM chunks c
                      JOIN documents d ON d.id = c.document_id
                      WHERE c.document_id = $1{stream_clause}
                  ) OR target_id IN (
                      SELECT c.id FROM chunks c
                      JOIN documents d ON d.id = c.document_id
                      WHERE c.document_id = $1{stream_clause}
                  ))
                """,
                document_id,
                org_id,
                *stream_params,
            )
            # CASCADE deletes chunks
            delete_stream_clause, delete_stream_params = _build_stream_scope_clause(
                allowed_streams,
                base_param_idx=3,
                column_prefix="",
            )
            result = await conn.execute(
                f"DELETE FROM documents WHERE id = $1 AND org_id = $2{delete_stream_clause}",
                document_id,
                org_id,
                *delete_stream_params,
            )

        deleted = result == "DELETE 1"
        if deleted:
            src.core.logging.logger.info(
                "Document deleted (AlloyDB)",
                extra={"document_id": document_id, "org_id": org_id},
            )
        return deleted

    # ═══════════════════════════════════════════════════════════════════════
    # Search — Vector, Keyword, and Hybrid
    # ═══════════════════════════════════════════════════════════════════════

    async def search(
        self,
        query: src.domain.models.SearchQuery,
        query_embedding: list[float] | None = None,
    ) -> src.domain.models.SearchResponse:
        """Execute search using the specified mode."""
        start: float = time.perf_counter()
        pool: asyncpg.Pool = self._ensure_pool()

        results: list[src.domain.models.SearchResult] = []
        actual_mode = query.mode

        org_id: typing.Any | str = getattr(query, "org_id", "default")
        fetch_top_k = max(query.top_k * 5, query.top_k)

        async with pool.acquire() as conn:
            if query.mode == src.domain.models.SearchMode.VECTOR and query_embedding:
                results = await self._vector_search(
                    conn,
                    query_embedding,
                    query.filters,
                    fetch_top_k,
                    org_id=org_id,
                )
            elif query.mode == src.domain.models.SearchMode.KEYWORD:
                results = await self._keyword_search(
                    conn,
                    query.query,
                    query.filters,
                    fetch_top_k,
                    org_id=org_id,
                )
            elif query.mode == src.domain.models.SearchMode.HYBRID and query_embedding:
                results = await self._hybrid_search(
                    conn,
                    query.query,
                    query_embedding,
                    query.filters,
                    fetch_top_k,
                    org_id=org_id,
                )
            else:
                actual_mode = src.domain.models.SearchMode.KEYWORD
                results = await self._keyword_search(
                    conn,
                    query.query,
                    query.filters,
                    fetch_top_k,
                    org_id=org_id,
                )

            # Apply minimum score before ACL truncation so later authorized hits
            # are not crowded out by lower-scoring candidates.
            if query.min_score > 0:
                results = [r for r in results if r.score >= query.min_score]

            results = await self._filter_search_results_by_acl(
                conn,
                results,
                org_id=org_id,
                allowed_streams=query.filters.value_streams,
                user_id=query.filters.caller_user_id,
                principals=query.filters.caller_principals,
                top_k=query.top_k,
            )
            if len(results) > query.top_k:
                results = results[: query.top_k]

            # Generate citations
            citations: list[src.domain.models.Citation] = []
            if query.include_citations:
                for result in results:
                    citation = await self._build_citation(conn, result)
                    if citation:
                        result.citation = citation
                        citations.append(citation)

            # Strip content if not requested
            if not query.include_content:
                for result in results:
                    result.content = ""

        elapsed_ms: float = (time.perf_counter() - start) * 1000

        return src.domain.models.SearchResponse(
            query=query.query,
            mode=actual_mode,
            results=results,
            total_results=len(results),
            citations=citations,
            search_time_ms=round(elapsed_ms, 2),
        )

    async def _vector_search(
        self,
        conn: asyncpg.Connection,
        query_embedding: list[float],
        filters: src.domain.models.SearchFilters,
        top_k: int,
        org_id: str = "default",
    ) -> list[src.domain.models.SearchResult]:
        """ANN vector search using pgvector's HNSW index."""
        filter_clause, filter_params = _build_filter_clause(filters, org_id=org_id)
        embedding_str: str = _to_pgvector(query_embedding)

        query_sql: str = f"""
            SELECT c.id, c.document_id, c.content, c.metadata,
                   1 - (c.embedding <=> $1::vector) AS score
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            {filter_clause}
            ORDER BY c.embedding <=> $1::vector
            LIMIT $2
        """
        params = [embedding_str, top_k] + filter_params
        rows = await conn.fetch(query_sql, *params)

        return [
            src.domain.models.SearchResult(
                chunk_id=row["id"],
                document_id=row["document_id"],
                content=row["content"],
                score=round(float(row["score"]), 4),
                score_scale=src.domain.models.ScoreScale.NORMALIZED,
                vector_score=round(float(row["score"]), 4),
                vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                keyword_score=0.0,
                keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            )
            for row in rows
            if float(row["score"]) >= src.core.config.settings.SIMILARITY_THRESHOLD
        ]

    async def _keyword_search(
        self,
        conn: asyncpg.Connection,
        query: str,
        filters: src.domain.models.SearchFilters,
        top_k: int,
        org_id: str = "default",
    ) -> list[src.domain.models.SearchResult]:
        """Full-text search using PostgreSQL tsvector + ts_rank_cd."""
        filter_clause, filter_params = _build_filter_clause(filters, org_id=org_id)
        normalized_query: str = _normalize_keyword_query(query)
        if not normalized_query:
            return []
        title_vector: str = _title_search_vector_expr("d.")
        metadata_vector: str = _metadata_search_vector_expr("d.")
        normalized_title: str = _normalized_text_expr("COALESCE(d.title, '')")
        normalized_query_like = "trim(regexp_replace(lower($1), '\\s+or\\s+', ' ', 'g'))"

        # Convert natural language queries to OR-joined terms so any
        # matching keyword returns results (AND is too strict for questions).
        or_query: str = " OR ".join(normalized_query.split())

        query_sql: str = f"""
            SELECT c.id, c.document_id, c.content, c.metadata,
                   (
                       COALESCE(ts_rank_cd(c.search_vector, websearch_to_tsquery('english', $1)), 0)
                       + 2.5 * COALESCE(ts_rank_cd({title_vector}, websearch_to_tsquery('english', $1)), 0)
                       + 1.25 * COALESCE(ts_rank_cd({metadata_vector}, websearch_to_tsquery('english', $1)), 0)
                       + CASE
                           WHEN {normalized_title} LIKE '%' || {normalized_query_like} || '%'
                           THEN 3.0
                           ELSE 0.0
                         END
                   ) AS score
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            {filter_clause}
                {"AND" if filter_clause else "WHERE"}
                (
                    c.search_vector @@ websearch_to_tsquery('english', $1)
                    OR {title_vector} @@ websearch_to_tsquery('english', $1)
                    OR {metadata_vector} @@ websearch_to_tsquery('english', $1)
                    OR {normalized_title} LIKE '%' || {normalized_query_like} || '%'
                )
            ORDER BY score DESC
            LIMIT $2
        """
        params = [or_query, top_k] + filter_params
        rows = await conn.fetch(query_sql, *params)

        return [
            src.domain.models.SearchResult(
                chunk_id=row["id"],
                document_id=row["document_id"],
                content=row["content"],
                score=round(float(row["score"]), 4),
                score_scale=src.domain.models.ScoreScale.RAW_RANK,
                vector_score=0.0,
                vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                keyword_score=round(float(row["score"]), 4),
                keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            )
            for row in rows
        ]

    async def _hybrid_search(
        self,
        conn: asyncpg.Connection,
        query: str,
        query_embedding: list[float],
        filters: src.domain.models.SearchFilters,
        top_k: int,
        org_id: str = "default",
    ) -> list[src.domain.models.SearchResult]:
        """
        Hybrid search: vector + keyword fused with Reciprocal Rank Fusion.

        Runs both searches in parallel (fetch 3x top_k each), then merges
        using RRF with configurable weights.
        """
        fetch_k: int = top_k * 3
        vector_results = await self._vector_search(
            conn,
            query_embedding,
            filters,
            fetch_k,
            org_id=org_id,
        )
        keyword_results = await self._keyword_search(
            conn,
            query,
            filters,
            fetch_k,
            org_id=org_id,
        )

        # Build rank maps
        vector_ranks = {r.chunk_id: i for i, r in enumerate(vector_results)}
        keyword_ranks = {r.chunk_id: i for i, r in enumerate(keyword_results)}
        all_chunk_ids = set(vector_ranks.keys()) | set(keyword_ranks.keys())

        # RRF scoring
        k = 60
        rrf_scores: list[tuple[str, float, float, float]] = []
        for chunk_id in all_chunk_ids:
            v_rank: int = vector_ranks.get(chunk_id, fetch_k + 1)
            k_rank: int = keyword_ranks.get(chunk_id, fetch_k + 1)
            v_rrf = src.core.config.settings.VECTOR_WEIGHT / (k + v_rank)
            k_rrf = src.core.config.settings.BM25_WEIGHT / (k + k_rank)
            combined = v_rrf + k_rrf

            v_score = next((r.vector_score for r in vector_results if r.chunk_id == chunk_id), 0.0)
            k_score = next(
                (r.keyword_score for r in keyword_results if r.chunk_id == chunk_id), 0.0
            )
            rrf_scores.append((chunk_id, combined, v_score, k_score))

        rrf_scores.sort(key=lambda x: x[1], reverse=True)
        max_score: float = rrf_scores[0][1] if rrf_scores else 1.0

        # Build lookup for content + metadata from both result sets
        result_lookup: dict[str, src.domain.models.SearchResult] = {}
        for r in vector_results:
            result_lookup[r.chunk_id] = r
        for r in keyword_results:
            if r.chunk_id not in result_lookup:
                result_lookup[r.chunk_id] = r

        results: list[src.domain.models.SearchResult] = []
        for chunk_id, score, v_score, k_score in rrf_scores[:top_k]:
            source_result = result_lookup.get(chunk_id)
            if not source_result:
                continue
            results.append(
                src.domain.models.SearchResult(
                    chunk_id=chunk_id,
                    document_id=source_result.document_id,
                    content=source_result.content,
                    score=round(score / max_score, 4) if max_score > 0 else 0.0,
                    score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    vector_score=round(v_score, 4),
                    vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    keyword_score=round(k_score, 4),
                    keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                    metadata=source_result.metadata,
                )
            )

        return results

    # ═══════════════════════════════════════════════════════════════════════
    # Citations
    # ═══════════════════════════════════════════════════════════════════════

    async def _build_citation(
        self, conn: asyncpg.Connection, result: src.domain.models.SearchResult
    ) -> src.domain.models.Citation | None:
        """Build citation from search result by looking up parent document."""
        row = await conn.fetchrow(
            "SELECT title, source_url FROM documents WHERE id = $1",
            result.document_id,
        )
        if not row:
            return None

        preview = result.content[:200] + "..." if len(result.content) > 200 else result.content
        # Extract first meaningful sentence for highlight
        import re

        sentences: list[str] = re.split(r"[.!?]+", result.content)
        highlight: str = ""
        for s in sentences:
            stripped: str | typing.Any = s.strip()
            if len(stripped) > 20:
                highlight: str | typing.Any = stripped[:100]
                break

        return src.domain.models.Citation(
            document_id=result.document_id,
            document_title=row["title"] or f"Document {result.document_id[:8]}",
            chunk_id=result.chunk_id,
            content_preview=preview,
            relevance_score=result.score,
            relevance_score_scale=result.score_scale,
            source_url=row["source_url"] or "",
            page_or_section=f"Section {result.metadata.get('position', '?')}",
            highlight=highlight,
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Graph Discovery
    # ═══════════════════════════════════════════════════════════════════════

    async def get_neighbors(
        self,
        chunk_id: str,
        max_depth: int = 1,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.GraphNeighbors:
        """Traverse knowledge graph to find related chunks, scoped by org_id."""
        stream_clause, stream_params = _build_stream_scope_clause(
            allowed_streams,
            base_param_idx=3,
        )
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            # Get center node
            chunk_row = await conn.fetchrow(
                f"""
                SELECT c.id, c.document_id, c.org_id, c.position,
                       c.metadata, d.title
                FROM chunks c JOIN documents d ON d.id = c.document_id
                WHERE c.id = $1 AND c.org_id = $2{stream_clause}
                """,
                chunk_id,
                org_id,
                *stream_params,
            )
            if not chunk_row:
                return src.domain.models.GraphNeighbors(center_node=src.domain.models.GraphNode(id=chunk_id, label="Unknown"))
            center_doc = await self._get_document_in_conn(
                conn,
                chunk_row["document_id"],
                org_id=org_id,
                allowed_streams=allowed_streams,
            )
            if not center_doc or not self._acl_access_allowed(
                center_doc,
                user_id=user_id,
                principals=principals,
            ):
                return src.domain.models.GraphNeighbors(center_node=src.domain.models.GraphNode(id=chunk_id, label="Unknown"))

            center = src.domain.models.GraphNode(
                id=chunk_id,
                org_id=org_id,
                label=chunk_row["title"] or chunk_id[:8],
                node_type="chunk",
                metadata={
                    "document_id": chunk_row["document_id"],
                    "position": chunk_row["position"],
                },
            )

            # Get edges
            edge_rows = await conn.fetch(
                """
                SELECT e.source_id, e.target_id, e.relationship, e.weight,
                       c.document_id, c.position, c.content, d.title
                FROM graph_edges e
                JOIN chunks c ON c.id = CASE
                    WHEN e.source_id = $1 THEN e.target_id
                    ELSE e.source_id
                END
                JOIN documents d ON d.id = c.document_id
                WHERE (e.source_id = $1 OR e.target_id = $1)
                  AND e.org_id = $2
                LIMIT 20
                """,
                chunk_id,
                org_id,
            )

            neighbors: list[src.domain.models.GraphNode] = []
            edges: list[src.domain.models.GraphEdge] = []
            for row in edge_rows:
                neighbor_id = row["target_id"] if row["source_id"] == chunk_id else row["source_id"]
                neighbor_doc = await self._get_document_in_conn(
                    conn,
                    row["document_id"],
                    org_id=org_id,
                    allowed_streams=allowed_streams,
                )
                if not neighbor_doc or not self._acl_access_allowed(
                    neighbor_doc,
                    user_id=user_id,
                    principals=principals,
                ):
                    continue
                neighbors.append(
                    src.domain.models.GraphNode(
                        id=neighbor_id,
                        label=row["title"] or neighbor_id[:8],
                        node_type="chunk",
                        metadata={
                            "document_id": row["document_id"],
                            "position": row["position"],
                            "preview": (row["content"] or "")[:100],
                        },
                    )
                )
                edges.append(
                    src.domain.models.GraphEdge(
                        source_id=row["source_id"],
                        target_id=row["target_id"],
                        relationship=row["relationship"],
                        weight=row["weight"],
                    )
                )

        return src.domain.models.GraphNeighbors(center_node=center, neighbors=neighbors, edges=edges)

    # ═══════════════════════════════════════════════════════════════════════
    # Stats
    # ═══════════════════════════════════════════════════════════════════════

    def stats(
        self,
        org_id: str | None = None,
        allowed_streams: list[str] | None = None,
    ) -> dict[str, typing.Any]:
        """Synchronous stats — returns cached or basic info."""
        return {
            "backend": "alloydb",
            "status": "connected" if self._pool and not self._pool._closed else "disconnected",
        }

    async def stats_async(
        self,
        org_id: str | None = None,
        allowed_streams: list[str] | None = None,
    ) -> dict[str, typing.Any]:
        """Full stats with counts from the database, scoped to org_id when provided."""
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            if org_id:
                stream_clause_docs, stream_params_docs = _build_stream_scope_clause(
                    allowed_streams,
                    base_param_idx=2,
                    column_prefix="",
                )
                stream_clause_chunks, stream_params_chunks = _build_stream_scope_clause(
                    allowed_streams,
                    base_param_idx=2,
                    column_prefix="",
                )
                doc_count = await conn.fetchval(
                    f"SELECT COUNT(*) FROM documents WHERE org_id = $1{stream_clause_docs}",
                    org_id,
                    *stream_params_docs,
                )
                chunk_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM chunks WHERE document_id IN "
                    f"(SELECT id FROM documents WHERE org_id = $1{stream_clause_chunks})",
                    org_id,
                    *stream_params_chunks,
                )
                edge_stream_clause, edge_stream_params = _build_stream_scope_clause(
                    allowed_streams,
                    base_param_idx=2,
                    column_prefix="d.",
                )
                edge_count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM graph_edges e
                    JOIN chunks c ON c.id = e.source_id
                    JOIN documents d ON d.id = c.document_id
                    WHERE e.org_id = $1
                    """
                    + edge_stream_clause,
                    org_id,
                    *edge_stream_params,
                )
            else:
                doc_count = await conn.fetchval("SELECT COUNT(*) FROM documents")
                chunk_count = await conn.fetchval("SELECT COUNT(*) FROM chunks")
                edge_count = await conn.fetchval("SELECT COUNT(*) FROM graph_edges")
        return {
            "backend": "alloydb",
            "documents": doc_count,
            "chunks": chunk_count,
            "graph_edges": edge_count,
            "pool_size": self._pool.get_size() if self._pool else 0,
            "pool_free": self._pool.get_idle_size() if self._pool else 0,
        }

    async def hvsi_audit(self, org_id: str | None = None) -> dict[str, int]:
        pool: asyncpg.Pool = self._ensure_pool()
        async with pool.acquire() as conn:
            if org_id:
                documents_missing_stream = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM documents
                    WHERE org_id = $1
                      AND NULLIF(custom_metadata->>'stream_id', '') IS NULL
                    """,
                    org_id,
                )
                chunks_missing_stream = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM chunks
                    WHERE org_id = $1
                      AND NULLIF(metadata->>'stream_id', '') IS NULL
                    """,
                    org_id,
                )
            else:
                documents_missing_stream = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM documents
                    WHERE NULLIF(custom_metadata->>'stream_id', '') IS NULL
                    """
                )
                chunks_missing_stream = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM chunks
                    WHERE NULLIF(metadata->>'stream_id', '') IS NULL
                    """
                )

        return {
            "documents_missing_stream": int(documents_missing_stream or 0),
            "chunks_missing_stream": int(chunks_missing_stream or 0),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _to_pgvector(embedding: list[float]) -> str | None:
    """Convert a Python list to pgvector string format: '[0.1,0.2,...]'."""
    if not embedding:
        return None
    return "[" + ",".join(str(x) for x in embedding) + "]"


def _normalize_stream_id(value: typing.Any) -> str | None:
    """Normalize stream ids so empty strings are treated as unset."""
    if value is None:
        return None
    normalized: str = str(value).strip()
    return normalized or None


def _runtime_stream_filters(values: list[str] | None) -> list[str]:
    return [
        stream
        for stream in (_normalize_stream_id(value) for value in values or [])
        if stream and stream.lower() != "global"
    ]


def _document_stream_id(document: src.domain.models.Document) -> str | None:
    """Resolve the effective stream id from the document payload."""
    return _normalize_stream_id(
        document.stream_id
        or document.metadata.stream_id
        or document.metadata.custom.get("stream_id")
    )


def _document_custom_metadata(document: src.domain.models.Document) -> dict[str, typing.Any]:
    """Persist stream scope plus ACL state inside custom metadata for schema compatibility."""
    custom = dict(document.metadata.custom or {})
    stream_id: str | None = _document_stream_id(document)
    if stream_id:
        custom["stream_id"] = stream_id
    else:
        custom.pop("stream_id", None)
    custom["classification"] = document.metadata.classification.value
    custom["access_control"] = document.metadata.access_control.model_dump(mode="json")
    return custom


def _stream_id_expr(column_prefix: str = "d.") -> str:
    """
    Return the SQL expression for the effective stream id.

    Production AlloyDB currently stores stream scope in ``custom_metadata``
    rather than a dedicated ``documents.stream_id`` column.
    """
    prefix: str = column_prefix or ""
    return f"NULLIF({prefix}custom_metadata->>'stream_id', '')"


_IGNORED_FILENAME_TOKENS: set[str] = {
    "csv",
    "doc",
    "docx",
    "json",
    "markdown",
    "md",
    "pdf",
    "ppt",
    "pptx",
    "txt",
    "xls",
    "xlsx",
}


def _normalize_keyword_query(query: str) -> str:
    """Normalize filename-like keyword queries into searchable terms."""
    raw_tokens: list[str] = re.findall(r"[a-z0-9]+", str(query).lower())
    if not raw_tokens:
        return str(query).strip()
    normalized_tokens: list[str] = [
        token for token in raw_tokens if token not in _IGNORED_FILENAME_TOKENS
    ]
    return " ".join(normalized_tokens or raw_tokens)


def _title_search_vector_expr(column_prefix: str = "d.") -> str:
    """Build a normalized tsvector expression for document titles."""
    prefix: str = column_prefix or ""
    title_expr = _normalized_text_expr(f"COALESCE({prefix}title, '')")
    return f"to_tsvector('english', {title_expr})"


def _metadata_search_text_expr(column_prefix: str = "d.") -> str:
    prefix: str = column_prefix or ""
    return (
        "concat_ws(' ', "
        f"COALESCE(array_to_string({prefix}tags, ' '), ''), "
        f"COALESCE({prefix}department, ''), "
        f"COALESCE({prefix}custom_metadata->>'source_id', ''), "
        f"COALESCE({prefix}custom_metadata->>'system_name', ''), "
        f"COALESCE({prefix}custom_metadata->>'retrieval_text', ''), "
        f"COALESCE({prefix}custom_metadata->>'entities', ''), "
        f"COALESCE({prefix}custom_metadata->>'topics', '')"
        ")"
    )


def _metadata_search_vector_expr(column_prefix: str = "d.") -> str:
    return (
        "to_tsvector('english', "
        f"{_normalized_text_expr(_metadata_search_text_expr(column_prefix))}"
        ")"
    )


def _normalized_text_expr(text_expr: str) -> str:
    return f"regexp_replace(lower({text_expr}), '[^a-z0-9]+', ' ', 'g')"


def _build_stream_scope_clause(
    allowed_streams: list[str] | None,
    *,
    base_param_idx: int,
    column_prefix: str = "d.",
) -> tuple[str, list[typing.Any]]:
    """
    Build an SQL fragment enforcing value-stream access on the ``documents`` table alias ``d``.

    Semantics:
        - no runtime scopes => no rows
        - non-global scopes => allow only stream-specific documents that match the caller scope
    """
    stream_filters: list[str] = _runtime_stream_filters(allowed_streams)
    if not stream_filters:
        return " AND FALSE", []
    stream_col: str = _stream_id_expr(column_prefix)
    return (
        f" AND {stream_col} = ANY(${base_param_idx}::text[])",
        [stream_filters],
    )


def _build_filter_clause(
    filters: src.domain.models.SearchFilters,
    org_id: str = "default",
) -> tuple[str, list[typing.Any]]:
    """
    Build a SQL WHERE clause from search filters.
    Returns (clause_string, params_list). Params are numbered starting at $3
    because $1 and $2 are reserved for the query embedding and top_k.
    Always includes org_id filter for tenant isolation.
    """
    conditions: list[str] = []
    params: list[typing.Any] = []
    param_idx = 3  # $1=embedding/query, $2=top_k

    # Always scope by org_id
    conditions.append(f"d.org_id = ${param_idx}")
    params.append(org_id)
    param_idx += 1

    # Governance gate: filter by document status. Use provided statuses or default to published/indexed.
    doc_statuses = (
        filters.document_statuses
        if filters.document_statuses
        else [src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED]
    )
    status_values = [
        status.value if hasattr(status, "value") else str(status) for status in doc_statuses
    ]
    conditions.append(f"d.status = ANY(${param_idx}::text[])")
    params.append(status_values)
    param_idx += 1

    if filters.document_types:
        types = [dt.value if hasattr(dt, "value") else str(dt) for dt in filters.document_types]
        conditions.append(f"d.document_type = ANY(${param_idx}::text[])")
        params.append(types)
        param_idx += 1

    if filters.departments:
        conditions.append(f"LOWER(d.department) = ANY(${param_idx}::text[])")
        params.append([dept.lower() for dept in filters.departments])
        param_idx += 1

    if filters.tags:
        conditions.append(f"d.tags && ${param_idx}::text[]")
        params.append(filters.tags)
        param_idx += 1

    stream_filters: list[str] = _runtime_stream_filters(filters.value_streams)
    if stream_filters:
        stream_expr: str = _stream_id_expr("d.")
        conditions.append(f"{stream_expr} = ANY(${param_idx}::text[])")
        params.append(stream_filters)
        param_idx += 1
    else:
        conditions.append("FALSE")

    if filters.date_from:
        conditions.append(f"d.created_at >= ${param_idx}")
        params.append(filters.date_from)
        param_idx += 1

    if filters.date_to:
        conditions.append(f"d.created_at <= ${param_idx}")
        params.append(filters.date_to)
        param_idx += 1

    if not conditions:
        return "", []

    return "WHERE " + " AND ".join(conditions), params


def _row_to_document(row: asyncpg.Record) -> src.domain.models.Document:
    """Convert a database row to a Document model."""
    raw_custom = row["custom_metadata"]
    if isinstance(raw_custom, str):
        metadata_custom = json.loads(raw_custom) if raw_custom else {}
    elif raw_custom:
        metadata_custom: dict[typing.Any, typing.Any] = dict(raw_custom)
    else:
        metadata_custom = {}
    classification_value = metadata_custom.pop(
        "classification",
        src.domain.models.DocumentClassification.INTERNAL.value,
    )
    access_control_value = metadata_custom.pop("access_control", {})
    stream_id: str | None = _normalize_stream_id(row.get("stream_id")) or _normalize_stream_id(
        metadata_custom.get("stream_id")
    )
    metadata_custom.pop("stream_id", None)
    try:
        classification = src.domain.models.DocumentClassification(str(classification_value).lower())
    except ValueError:
        classification = src.domain.models.DocumentClassification.INTERNAL
    try:
        access_control = src.domain.models.DocumentAccessControl.model_validate(access_control_value)
    except Exception:
        access_control = src.domain.models.DocumentAccessControl()
    return src.domain.models.Document(
        id=row["id"],
        org_id=row.get("org_id", "default"),
        stream_id=stream_id,
        content=row["content"],
        metadata=src.domain.models.DocumentMetadata(
            title=row["title"],
            author=row["author"],
            department=row["department"],
            document_type=src.domain.models.DocumentType(row["document_type"]),
            source_url=row["source_url"],
            tags=list(row["tags"]) if row["tags"] else [],
            language=row["language"],
            version=row["version"],
            classification=classification,
            access_control=access_control,
            stream_id=stream_id,
            custom=metadata_custom,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        ),
        status=src.domain.models.DocumentStatus(row["status"]),
        chunk_count=row["chunk_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_chunk(row: asyncpg.Record) -> src.domain.models.Chunk:
    """Convert a database row to a Chunk model."""
    return src.domain.models.Chunk(
        id=row["id"],
        document_id=row["document_id"],
        org_id=row.get("org_id", "default"),
        content=row["content"],
        embedding=[],  # Don't load full embedding vector into memory
        position=row["position"],
        start_char=row["start_char"],
        end_char=row["end_char"],
        token_count=row["token_count"],
        metadata=json.loads(row["metadata"]) if row["metadata"] else {},
    )


def _redact_dsn(dsn: str) -> str:
    """Redact password from DSN for logging."""
    import re

    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", dsn)
