"""
In-Memory Vector Store — MVP storage adapter.

Provides vector similarity search and BM25 keyword search over
document chunks stored entirely in memory. Suitable for development
and small-scale deployments (< 100K chunks).

Production Replacement:
    Replace this adapter with AlloyDB + pgvector for persistent,
    scalable vector search. The interface (VectorStoreAdapter) stays
    the same — only the implementation changes.

Architecture Note:
    This implements the Repository pattern. The domain layer calls
    abstract methods (store, search, delete) without knowing whether
    the backend is in-memory, AlloyDB, Pinecone, or Vertex AI Search.
"""

# ruff: noqa: E501

from __future__ import annotations

import collections
import datetime
import math
import re
import typing

import src.core.config
import src.core.logging
import src.domain.models


def _normalize_stream_id(value: typing.Any) -> str | None:
    if value is None:
        return None
    normalized: str = str(value).strip()
    return normalized or None


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


def _normalize_keyword_query(text: str) -> str:
    raw_tokens: list[str] = re.findall(r"[a-z0-9]+", text.lower())
    if not raw_tokens:
        return text
    normalized_tokens: list[str] = [
        token for token in raw_tokens if token not in _IGNORED_FILENAME_TOKENS
    ]
    return " ".join(normalized_tokens or raw_tokens)


def _normalize_phrase(text: str) -> str:
    normalized: str = re.sub(r"[^a-z0-9]+", " ", text.lower())
    return re.sub(r"\s+", " ", normalized).strip()


def _coerce_text_list(value: typing.Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if value is None:
        return []
    token: str = str(value).strip()
    return [token] if token else []


def _metadata_search_text(doc: src.domain.models.Document | None, chunk: src.domain.models.Chunk | None = None) -> str:
    if not doc:
        return ""

    custom: typing.Any | dict[str, typing.Any] = getattr(doc.metadata, "custom", {}) or {}
    parts: list[str] = [
        doc.metadata.department,
        " ".join(doc.metadata.tags),
        str(custom.get("source_id", "")),
        str(custom.get("system_name", "")),
        str(custom.get("retrieval_text", "")),
        " ".join(_coerce_text_list(custom.get("entities"))),
        " ".join(_coerce_text_list(custom.get("topics"))),
    ]
    if chunk:
        parts.extend(
            [
                str(chunk.metadata.get("search_text", "")),
                " ".join(_coerce_text_list(chunk.metadata.get("search_terms"))),
                str(chunk.metadata.get("source_id", "")),
                str(chunk.metadata.get("system_name", "")),
            ]
        )
    return " ".join(part for part in parts if part)


def _keyword_bonus(query: str, title: str, metadata_text: str) -> float:
    normalized_query: str = _normalize_phrase(_normalize_keyword_query(query))
    if not normalized_query:
        return 0.0

    bonus = 0.0
    normalized_title: str = _normalize_phrase(title)
    normalized_metadata: str = _normalize_phrase(metadata_text)
    if normalized_query in normalized_title:
        bonus += 3.0
    if normalized_query in normalized_metadata:
        bonus += 1.0

    kb_ids: set[str] = set(re.findall(r"\bkb\d{7}\b", normalized_query))
    if kb_ids & set(re.findall(r"\bkb\d{7}\b", f"{normalized_title} {normalized_metadata}")):
        bonus += 4.0

    return bonus


class VectorStore:
    """
    In-memory vector store with hybrid search capabilities.

    Stores documents and their chunks in dictionaries, performs
    cosine similarity for vector search and BM25 for keyword search.

    This is the MVP implementation. In production, swap this for
    AlloyDB with pgvector extension:
        - Documents table with JSONB metadata
        - Chunks table with vector(768) column
        - GIN index for full-text search
        - IVFFlat or HNSW index for vector search
    """

    @staticmethod
    def _stream_access_allowed(
        doc: src.domain.models.Document,
        allowed_streams: list[str] | None,
    ) -> bool:
        if not allowed_streams or "global" in allowed_streams:
            return True
        doc_stream: str | None = _normalize_stream_id(
            getattr(doc, "stream_id", None)
            or getattr(doc.metadata, "stream_id", None)
            or (getattr(doc.metadata, "custom", {}) or {}).get("stream_id")
        )
        return doc_stream in allowed_streams

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
        metadata: typing.Any | None = getattr(doc, "metadata", None)
        if metadata is None:
            return True

        access_control = getattr(metadata, "access_control", None) or src.domain.models.DocumentAccessControl()
        classification = getattr(metadata, "classification", src.domain.models.DocumentClassification.INTERNAL)
        normalized_user: str | None = cls._normalize_user_id(user_id)
        normalized_principals: set[str] = cls._normalize_principals(principals)

        if normalized_user and normalized_user in set(access_control.denied_users):
            return False
        if normalized_principals & set(access_control.denied_groups):
            return False

        has_explicit_allow_list = access_control.has_explicit_allow_list()
        if has_explicit_allow_list:
            if normalized_user and normalized_user in set(access_control.allowed_users):
                return True
            return bool(normalized_principals & set(access_control.allowed_groups))

        return classification not in (
            src.domain.models.DocumentClassification.RESTRICTED,
            src.domain.models.DocumentClassification.PRIVILEGED,
        )

    def __init__(self) -> None:
        # Primary storage: document_id → Document
        self._documents: dict[str, src.domain.models.Document] = {}
        # Chunk storage: chunk_id → Chunk
        self._chunks: dict[str, src.domain.models.Chunk] = {}
        # Index: document_id → list of chunk_ids (ordered by position)
        self._doc_chunks: dict[str, list[str]] = {}
        # Inverted index for BM25: term → set of chunk_ids
        self._inverted_index: dict[str, set[str]] = {}
        # Document frequency: term → number of chunks containing it
        self._doc_freq: dict[str, int] = {}
        # Total chunks (for IDF calculation)
        self._total_chunks: int = 0
        # Graph edges: (source_id, target_id) → GraphEdge
        self._graph_edges: dict[tuple[str, str], src.domain.models.GraphEdge] = {}

    # ═══════════════════════════════════════════════════════════════════════
    # Document & Chunk Storage
    # ═══════════════════════════════════════════════════════════════════════

    async def store_document(self, document: src.domain.models.Document, chunks: list[src.domain.models.Chunk]) -> str:
        """
        Store a document and its chunks. Updates the inverted index
        for keyword search and builds graph edges between related chunks.

        Args:
            document: The parent document with metadata.
            chunks: Pre-processed chunks with embedding vectors.

        Returns:
            The document ID.
        """
        self._documents[document.id] = document
        chunk_ids: list[str] = []

        for chunk in chunks:
            self._chunks[chunk.id] = chunk
            chunk_ids.append(chunk.id)
            # Update inverted index for BM25
            terms: list[str] = _tokenize(f"{chunk.content} {_metadata_search_text(document, chunk)}")
            unique_terms: set[str] = set(terms)
            for term in unique_terms:
                if term not in self._inverted_index:
                    self._inverted_index[term] = set()
                    self._doc_freq[term] = 0
                self._inverted_index[term].add(chunk.id)
                self._doc_freq[term] += 1

        self._doc_chunks[document.id] = chunk_ids
        self._total_chunks += len(chunks)

        # Build co-occurrence graph edges between chunks of the same document
        for i, cid_a in enumerate(chunk_ids):
            for cid_b in chunk_ids[i + 1 :]:
                edge_key: tuple[str, str] = (cid_a, cid_b)
                self._graph_edges[edge_key] = src.domain.models.GraphEdge(
                    source_id=cid_a,
                    target_id=cid_b,
                    relationship="same_document",
                    weight=0.8,
                )

        # Preserve lifecycle status from ingestion workflow (e.g. pending_review).
        if document.status == src.domain.models.DocumentStatus.PROCESSING:
            document.status = src.domain.models.DocumentStatus.PENDING_REVIEW
        document.chunk_count = len(chunks)

        src.core.logging.logger.info(
            "Document stored",
            extra={
                "document_id": document.id,
                "chunks": len(chunks),
                "total_chunks": self._total_chunks,
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
        doc = self._documents.get(document_id)
        if (
            doc
            and getattr(doc, "org_id", "default") == org_id
            and self._stream_access_allowed(doc, allowed_streams)
            and self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ):
            return doc
        return None

    async def get_chunk(
        self,
        chunk_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.Chunk | None:
        """Retrieve a single chunk by ID, scoped by org_id."""
        chunk = self._chunks.get(chunk_id)
        if not chunk or getattr(chunk, "org_id", "default") != org_id:
            return None
        doc = self._documents.get(chunk.document_id)
        if (
            doc
            and self._stream_access_allowed(doc, allowed_streams)
            and self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ):
            return chunk
        return None

    async def list_documents(
        self,
        limit: int = 50,
        offset: int = 0,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> tuple[list[src.domain.models.Document], int]:
        """
        List documents with pagination, scoped by org_id.
        Returns (documents, total_count).
        """
        docs = [
            d
            for d in self._documents.values()
            if getattr(d, "org_id", "default") == org_id
            and self._stream_access_allowed(d, allowed_streams)
            and self._acl_access_allowed(d, user_id=user_id, principals=principals)
        ]
        total: int = len(docs)
        return docs[offset : offset + limit], total

    async def document_inventory_summary(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.DocumentInventorySummary:
        """Return aggregate document counts for overview dashboards."""
        docs = [
            d
            for d in self._documents.values()
            if getattr(d, "org_id", "default") == org_id
            and self._stream_access_allowed(d, allowed_streams)
            and self._acl_access_allowed(d, user_id=user_id, principals=principals)
        ]

        status_counts: collections.Counter[src.domain.models.DocumentStatus] = collections.Counter(
            doc.status for doc in docs
        )
        department_counts: collections.Counter[str] = collections.Counter()
        freshness = src.domain.models.DocumentFreshnessSummary()
        now: datetime.datetime = datetime.datetime.now(datetime.UTC)

        for doc in docs:
            department = doc.metadata.department.strip()
            if department:
                department_counts[department] += 1

            freshness_at = doc.updated_at or doc.created_at or None
            if freshness_at is None:
                freshness.unknown_count += 1
                continue

            age_days = (now - freshness_at).days
            if age_days < 30:
                freshness.current_count += 1
            elif age_days < 90:
                freshness.review_count += 1
            else:
                freshness.stale_count += 1

        top_departments = [
            src.domain.models.DepartmentCount(label=label, value=value)
            for label, value in department_counts.most_common(3)
        ]

        return src.domain.models.DocumentInventorySummary(
            total_documents=len(docs),
            live_count=(
                status_counts[src.domain.models.DocumentStatus.PUBLISHED]
                + status_counts[src.domain.models.DocumentStatus.INDEXED]
            ),
            pending_review_count=status_counts[
                src.domain.models.DocumentStatus.PENDING_REVIEW
            ],
            processing_count=(
                status_counts[src.domain.models.DocumentStatus.PENDING]
                + status_counts[src.domain.models.DocumentStatus.PROCESSING]
            ),
            archived_count=status_counts[src.domain.models.DocumentStatus.ARCHIVED],
            failed_count=status_counts[src.domain.models.DocumentStatus.FAILED],
            missing_labels_count=sum(
                1 for doc in docs if not doc.metadata.department.strip()
            ),
            top_departments=top_departments,
            freshness=freshness,
        )

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
        doc = self._documents.get(document_id)
        if (
            not doc
            or getattr(doc, "org_id", "default") != org_id
            or not self._stream_access_allowed(doc, allowed_streams)
            or not self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ):
            return False
        doc.status = src.domain.models.DocumentStatus(status)
        src.core.logging.logger.info(
            "Document status updated",
            extra={"document_id": document_id, "new_status": status},
        )
        return True

    async def update_document_metadata(
        self,
        document_id: str,
        metadata_dict: dict,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Update document metadata fields (title, department, tags, etc.)."""
        doc = self._documents.get(document_id)
        if (
            not doc
            or getattr(doc, "org_id", "default") != org_id
            or not self._stream_access_allowed(doc, allowed_streams)
            or not self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ):
            return False
        from src.domain.models import DocumentMetadata

        existing = doc.metadata.model_dump(mode="python")
        existing.update(metadata_dict)
        doc.metadata = DocumentMetadata(**existing)
        src.core.logging.logger.info(
            "Document metadata updated",
            extra={"document_id": document_id},
        )
        return True

    async def list_tags(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> list[str]:
        """Return all unique tags across documents for a given org."""
        tags: set[str] = set()
        for doc in self._documents.values():
            if getattr(doc, "org_id", "default") != org_id:
                continue
            if not self._stream_access_allowed(doc, allowed_streams):
                continue
            if not self._acl_access_allowed(doc, user_id=user_id, principals=principals):
                continue
            if doc.metadata and doc.metadata.tags:
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
        """
        Remove a document and all its chunks from the store.
        Also cleans up inverted index entries and graph edges.
        """
        doc = self._documents.get(document_id)
        if (
            not doc
            or getattr(doc, "org_id", "default") != org_id
            or not self._stream_access_allowed(doc, allowed_streams)
            or not self._acl_access_allowed(doc, user_id=user_id, principals=principals)
        ):
            return False

        chunk_ids: list[str] = self._doc_chunks.get(document_id, [])
        for cid in chunk_ids:
            chunk = self._chunks.pop(cid, None)
            if chunk:
                # Clean up inverted index
                terms: set[str] = set(_tokenize(chunk.content))
                for term in terms:
                    if term in self._inverted_index:
                        self._inverted_index[term].discard(cid)
                        self._doc_freq[term] = max(0, self._doc_freq.get(term, 1) - 1)
                self._total_chunks -= 1

            # Clean up graph edges
            edges_to_remove: list[tuple[str, str]] = [
                key for key in self._graph_edges if cid in key
            ]
            for key in edges_to_remove:
                del self._graph_edges[key]

        del self._documents[document_id]
        self._doc_chunks.pop(document_id, None)

        src.core.logging.logger.info(
            "Document deleted", extra={"document_id": document_id, "chunks_removed": len(chunk_ids)}
        )
        return True

    # ═══════════════════════════════════════════════════════════════════════
    # Search — Vector, Keyword, and Hybrid
    # ═══════════════════════════════════════════════════════════════════════

    async def search(
        self,
        query: src.domain.models.SearchQuery,
        query_embedding: list[float] | None = None,
    ) -> src.domain.models.SearchResponse:
        """
        Execute a search query using the specified mode.

        Args:
            query: The search query with mode, filters, and top_k.
            query_embedding: Pre-computed embedding for the query text.
                Required for vector and hybrid modes.

        Returns:
            SearchResponse with ranked results and citations.
        """
        import time

        start: float = time.perf_counter()

        # Get candidate chunk IDs (apply metadata + org_id filters)
        org_id: typing.Any | str = getattr(query, "org_id", "default")
        candidate_ids: set[str] | None = self._apply_filters(query.filters, org_id=org_id)

        results: list[src.domain.models.SearchResult] = []

        if query.mode == src.domain.models.SearchMode.VECTOR and query_embedding:
            results = self._vector_search(query_embedding, candidate_ids, query.top_k)
        elif query.mode == src.domain.models.SearchMode.KEYWORD:
            results = self._keyword_search(query.query, candidate_ids, query.top_k)
        elif query.mode == src.domain.models.SearchMode.HYBRID and query_embedding:
            results = self._hybrid_search(query.query, query_embedding, candidate_ids, query.top_k)
        else:
            # Fallback to keyword if no embedding available
            results = self._keyword_search(query.query, candidate_ids, query.top_k)

        # Apply minimum score filter
        if query.min_score > 0:
            results = [r for r in results if r.score >= query.min_score]

        # Generate citations
        citations: list[src.domain.models.Citation] = []
        if query.include_citations:
            for result in results:
                citation = self._build_citation(result)
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
            mode=query.mode,
            results=results,
            total_results=len(results),
            citations=citations,
            search_time_ms=round(elapsed_ms, 2),
        )

    def _apply_filters(
        self,
        filters: src.domain.models.SearchFilters,
        org_id: str = "default",
    ) -> set[str] | None:
        """
        Apply metadata + org_id + value-stream filters to narrow candidate chunks.

                Enforcement order (fail-closed):
                    1. org_id    — always applied, primary tenant boundary
                    2. value_streams — when non-empty, document must belong to one of
                                                        the listed streams. Unscoped documents are denied.
                    3. Metadata  — document_type, department, tags, date range

        Returns a set of chunk_ids that match all filters.
        """
        stream_filters: list[str] = [str(stream).strip() for stream in (filters.value_streams or []) if str(stream).strip()]
        enforce_streams: bool = bool(stream_filters) and "global" not in stream_filters

        matching_doc_ids: set[str] = set()
        for doc_id, doc in self._documents.items():
            # 1. Org-level tenant isolation — always enforced
            if getattr(doc, "org_id", "default") != org_id:
                continue
            # 1b. Governance gate — hide unapproved knowledge from retrieval
            #     unless the caller explicitly included pending_review status.
            allowed_statuses = (
                set(filters.document_statuses)
                if filters.document_statuses
                else {src.domain.models.DocumentStatus.PUBLISHED, src.domain.models.DocumentStatus.INDEXED}
            )
            if doc.status not in allowed_statuses:
                continue

            # 2. Value-stream isolation
            if enforce_streams:
                doc_stream: typing.Any | None = getattr(doc, "stream_id", None) or getattr(doc.metadata, "stream_id", None)
                if not doc_stream or doc_stream not in stream_filters:
                    continue

            # 3. Document-type filter
            if filters.document_types and doc.metadata.document_type not in filters.document_types:
                continue
            # 4. Department filter (case-insensitive)
            if filters.departments and (doc.metadata.department or "").lower() not in [
                d.lower() for d in filters.departments
            ]:
                continue
            # 5. Tags filter (any match)
            if filters.tags and not set(filters.tags) & set(doc.metadata.tags):
                continue
            # 6. Date range filter
            if filters.date_from and doc.metadata.created_at < filters.date_from:
                continue
            if filters.date_to and doc.metadata.created_at > filters.date_to:
                continue
            if not self._acl_access_allowed(
                doc,
                user_id=filters.caller_user_id,
                principals=filters.caller_principals,
            ):
                continue
            matching_doc_ids.add(doc_id)

        # Resolve to chunk IDs
        chunk_ids: set[str] = set()
        for doc_id in matching_doc_ids:
            chunk_ids.update(self._doc_chunks.get(doc_id, []))

        return chunk_ids

    def _vector_search(
        self,
        query_embedding: list[float],
        candidate_ids: set[str] | None,
        top_k: int,
    ) -> list[src.domain.models.SearchResult]:
        """
        Pure semantic search using cosine similarity.

        Compares the query embedding against all chunk embeddings and
        returns the top_k most similar chunks.
        """
        scores: list[tuple[str, float]] = []

        chunks_to_search = (
            {cid: self._chunks[cid] for cid in candidate_ids if cid in self._chunks}
            if candidate_ids is not None
            else self._chunks
        )

        for chunk_id, chunk in chunks_to_search.items():
            if not chunk.embedding:
                continue
            similarity: float = _cosine_similarity(query_embedding, chunk.embedding)
            if similarity >= src.core.config.settings.SIMILARITY_THRESHOLD:
                scores.append((chunk_id, similarity))

        # Sort by similarity descending
        scores.sort(key=lambda x: x[1], reverse=True)

        results: list[src.domain.models.SearchResult] = []
        for chunk_id, score in scores[:top_k]:
            chunk = self._chunks[chunk_id]
            results.append(
                src.domain.models.SearchResult(
                    chunk_id=chunk_id,
                    document_id=chunk.document_id,
                    content=chunk.content,
                    score=score,
                    score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    vector_score=score,
                    vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    keyword_score=0.0,
                    keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                    metadata=chunk.metadata,
                )
            )

        return results

    def _keyword_search(
        self,
        query: str,
        candidate_ids: set[str] | None,
        top_k: int,
    ) -> list[src.domain.models.SearchResult]:
        """
        BM25 keyword search using the inverted index.

        Tokenizes the query, looks up matching chunks via the inverted
        index, and scores them using BM25.
        """
        query_terms: list[str] = _tokenize(_normalize_keyword_query(query))
        if not query_terms:
            return []

        # Collect all candidate chunk IDs that contain any query term in the
        # chunk content or the parent document title.
        query_term_set: set[str] = set(query_terms)
        matching_chunk_ids: set[str] = set()
        for chunk_id, chunk in self._chunks.items():
            if candidate_ids is not None and chunk_id not in candidate_ids:
                continue
            doc = self._documents.get(chunk.document_id)
            title = doc.metadata.title if doc else ""
            metadata_text: str = _metadata_search_text(doc, chunk)
            searchable_terms: set[str] = set(_tokenize(f"{title} {metadata_text} {chunk.content}"))
            if searchable_terms & query_term_set:
                matching_chunk_ids.add(chunk_id)

        # Apply candidate filter
        if candidate_ids is not None:
            matching_chunk_ids &= candidate_ids

        # Score each matching chunk using BM25
        scores: list[tuple[str, float]] = []
        for chunk_id in matching_chunk_ids:
            chunk = self._chunks.get(chunk_id)
            if not chunk:
                continue
            doc = self._documents.get(chunk.document_id)
            title = doc.metadata.title if doc else ""
            metadata_text: str = _metadata_search_text(doc, chunk)
            score: float = self._bm25_score(query_terms, f"{title} {metadata_text} {chunk.content}")
            score += _keyword_bonus(query, title, metadata_text)
            scores.append((chunk_id, score))

        scores.sort(key=lambda x: x[1], reverse=True)

        results: list[src.domain.models.SearchResult] = []
        for chunk_id, score in scores[:top_k]:
            chunk = self._chunks[chunk_id]
            results.append(
                src.domain.models.SearchResult(
                    chunk_id=chunk_id,
                    document_id=chunk.document_id,
                    content=chunk.content,
                    score=score,
                    score_scale=src.domain.models.ScoreScale.RAW_RANK,
                    vector_score=0.0,
                    vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    keyword_score=score,
                    keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                    metadata=chunk.metadata,
                )
            )

        return results

    def _hybrid_search(
        self,
        query: str,
        query_embedding: list[float],
        candidate_ids: set[str] | None,
        top_k: int,
    ) -> list[src.domain.models.SearchResult]:
        """
        Hybrid search combining vector similarity and BM25 keyword scores.

        Uses Reciprocal Rank Fusion (RRF) to merge the two ranked lists,
        weighted by VECTOR_WEIGHT and BM25_WEIGHT from settings.

        RRF is preferred over simple score averaging because it handles
        the different score scales (cosine 0–1 vs BM25 0–∞) gracefully.
        """
        # Get both result sets (request extra to ensure good fusion coverage)
        fetch_k: int = top_k * 3
        vector_results = self._vector_search(query_embedding, candidate_ids, fetch_k)
        keyword_results = self._keyword_search(query, candidate_ids, fetch_k)

        # Build rank maps (chunk_id → rank position, 0-indexed)
        vector_ranks: dict[str, int] = {r.chunk_id: i for i, r in enumerate(vector_results)}
        keyword_ranks: dict[str, int] = {r.chunk_id: i for i, r in enumerate(keyword_results)}

        # Collect all unique chunk IDs
        all_chunk_ids: set[str] = set(vector_ranks.keys()) | set(keyword_ranks.keys())

        # RRF scoring: score = sum(weight / (k + rank)) for each list
        k = 60  # RRF constant (standard value from literature)
        rrf_scores: list[tuple[str, float, float, float]] = []

        for chunk_id in all_chunk_ids:
            v_rank: int = vector_ranks.get(chunk_id, fetch_k + 1)
            k_rank: int = keyword_ranks.get(chunk_id, fetch_k + 1)
            v_rrf = src.core.config.settings.VECTOR_WEIGHT / (k + v_rank)
            k_rrf = src.core.config.settings.BM25_WEIGHT / (k + k_rank)
            combined = v_rrf + k_rrf

            # Retrieve component scores for the response
            v_score = next((r.vector_score for r in vector_results if r.chunk_id == chunk_id), 0.0)
            k_score = next(
                (r.keyword_score for r in keyword_results if r.chunk_id == chunk_id), 0.0
            )

            rrf_scores.append((chunk_id, combined, v_score, k_score))

        rrf_scores.sort(key=lambda x: x[1], reverse=True)

        # Normalize scores to 0–1 range
        max_score: float = rrf_scores[0][1] if rrf_scores else 1.0

        results: list[src.domain.models.SearchResult] = []
        for chunk_id, score, v_score, k_score in rrf_scores[:top_k]:
            chunk = self._chunks.get(chunk_id)
            if not chunk:
                continue
            results.append(
                src.domain.models.SearchResult(
                    chunk_id=chunk_id,
                    document_id=chunk.document_id,
                    content=chunk.content,
                    score=round(score / max_score, 4) if max_score > 0 else 0.0,
                    score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    vector_score=round(v_score, 4),
                    vector_score_scale=src.domain.models.ScoreScale.NORMALIZED,
                    keyword_score=round(k_score, 4),
                    keyword_score_scale=src.domain.models.ScoreScale.RAW_RANK,
                    metadata=chunk.metadata,
                )
            )

        return results

    def _bm25_score(self, query_terms: list[str], document_text: str) -> float:
        """
        Compute BM25 score for a document against query terms.

        BM25 Parameters:
            k1 = 1.5  (term frequency saturation)
            b  = 0.75 (length normalization)

        Formula per term:
            score += IDF(term) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl))
        """
        k1 = 1.5
        b = 0.75
        doc_terms: list[str] = _tokenize(document_text)
        dl: int = len(doc_terms)
        avgdl: int = max(1, self._total_chunks)  # approximate
        term_freq: collections.Counter[str] = collections.Counter(doc_terms)

        score = 0.0
        for term in query_terms:
            tf: int = term_freq.get(term, 0)
            if tf == 0:
                continue
            df: int = self._doc_freq.get(term, 0)
            # IDF: log((N - df + 0.5) / (df + 0.5) + 1)
            idf: float = math.log((self._total_chunks - df + 0.5) / (df + 0.5) + 1.0)
            numerator: float = tf * (k1 + 1)
            denominator: float = tf + k1 * (1 - b + b * dl / max(avgdl, 1))
            score += idf * numerator / denominator

        return score

    # ═══════════════════════════════════════════════════════════════════════
    # Citation Builder
    # ═══════════════════════════════════════════════════════════════════════

    def _build_citation(self, result: src.domain.models.SearchResult) -> src.domain.models.Citation | None:
        """
        Construct a Citation from a search result by looking up the
        parent document metadata.
        """
        doc = self._documents.get(result.document_id)
        if not doc:
            return None

        preview = result.content[:200] + "..." if len(result.content) > 200 else result.content

        return src.domain.models.Citation(
            document_id=result.document_id,
            document_title=doc.metadata.title or f"Document {result.document_id[:8]}",
            chunk_id=result.chunk_id,
            content_preview=preview,
            relevance_score=result.score,
            relevance_score_scale=result.score_scale,
            source_url=doc.metadata.source_url,
            page_or_section=f"Section {result.metadata.get('position', '?')}",
            highlight=_extract_highlight(result.content, 100),
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
        """
        Traverse the knowledge graph to find related chunks/documents.

        Starting from a given chunk, follows graph edges to discover
        related content. Useful for "see also" suggestions and
        expanding the context window for RAG.

        Args:
            chunk_id: Starting node for traversal.
            max_depth: How many hops to traverse (default 1).

        Returns:
            GraphNeighbors with the center node and connected nodes.
        """
        chunk = await self.get_chunk(
            chunk_id,
            org_id=org_id,
            allowed_streams=allowed_streams,
            user_id=user_id,
            principals=principals,
        )
        if not chunk:
            return src.domain.models.GraphNeighbors(
                center_node=src.domain.models.GraphNode(id=chunk_id, label="Unknown"),
            )

        doc = self._documents.get(chunk.document_id)
        center = src.domain.models.GraphNode(
            id=chunk_id,
            label=doc.metadata.title if doc else chunk_id[:8],
            node_type="chunk",
            metadata={"document_id": chunk.document_id, "position": chunk.position},
        )

        neighbors: list[src.domain.models.GraphNode] = []
        edges: list[src.domain.models.GraphEdge] = []

        # Find all edges connected to this chunk
        for (source_id, target_id), edge in self._graph_edges.items():
            neighbor_id = None
            if source_id == chunk_id:
                neighbor_id: str = target_id
            elif target_id == chunk_id:
                neighbor_id: str = source_id

            if neighbor_id and neighbor_id in self._chunks:
                neighbor_chunk = self._chunks[neighbor_id]
                neighbor_doc = self._documents.get(neighbor_chunk.document_id)
                if (
                    getattr(neighbor_chunk, "org_id", "default") != org_id
                    or not neighbor_doc
                    or not self._stream_access_allowed(neighbor_doc, allowed_streams)
                    or not self._acl_access_allowed(
                        neighbor_doc,
                        user_id=user_id,
                        principals=principals,
                    )
                ):
                    continue
                neighbors.append(
                    src.domain.models.GraphNode(
                        id=neighbor_id,
                        label=neighbor_doc.metadata.title if neighbor_doc else neighbor_id[:8],
                        node_type="chunk",
                        metadata={
                            "document_id": neighbor_chunk.document_id,
                            "position": neighbor_chunk.position,
                            "preview": neighbor_chunk.content[:100],
                        },
                    )
                )
                edges.append(edge)

        return src.domain.models.GraphNeighbors(center_node=center, neighbors=neighbors, edges=edges)

    # ═══════════════════════════════════════════════════════════════════════
    # Stats
    # ═══════════════════════════════════════════════════════════════════════

    def stats(
        self,
        org_id: str | None = None,
        allowed_streams: list[str] | None = None,
    ) -> dict[str, typing.Any]:
        """Return store statistics for health/readiness checks."""
        if org_id:
            org_docs = {
                k: v
                for k, v in self._documents.items()
                if v.org_id == org_id and self._stream_access_allowed(v, allowed_streams)
            }
            org_chunks: int = sum(doc.chunk_count for doc in org_docs.values())
            return {
                "documents": len(org_docs),
                "total_documents": len(org_docs),
                "chunks": org_chunks,
                "total_chunks": org_chunks,
            }
        return {
            "documents": len(self._documents),
            "total_documents": len(self._documents),
            "chunks": self._total_chunks,
            "total_chunks": self._total_chunks,
            "vocabulary_size": len(self._inverted_index),
            "graph_edges": len(self._graph_edges),
        }

    def hvsi_audit(self, org_id: str | None = None) -> dict[str, int]:
        documents = [
            doc
            for doc in self._documents.values()
            if org_id is None or getattr(doc, "org_id", "default") == org_id
        ]
        chunks = [
            chunk
            for chunk in self._chunks.values()
            if org_id is None or getattr(chunk, "org_id", "default") == org_id
        ]

        return {
            "documents_missing_stream": sum(
                1
                for doc in documents
                if _normalize_stream_id(
                    getattr(doc, "stream_id", None)
                    or getattr(doc.metadata, "stream_id", None)
                    or getattr(doc.metadata, "custom", {}).get("stream_id")
                )
                is None
            ),
            "chunks_missing_stream": sum(
                1
                for chunk in chunks
                if _normalize_stream_id(chunk.metadata.get("stream_id")) is None
            ),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════════════════════════


def _tokenize(text: str) -> list[str]:
    """
    Simple whitespace + punctuation tokenizer with lowercasing.
    Strips common stop words for better BM25 precision.

    In production, consider using a proper tokenizer (e.g., spaCy)
    or the database's built-in full-text search tokenization.
    """
    # Lowercase, split on non-alphanumeric
    tokens: list[str] = re.findall(r"\b[a-z0-9]+\b", text.lower())
    # Remove very short tokens and common stop words
    stop_words: set[str] = {
        "the",
        "a",
        "an",
        "is",
        "it",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "and",
        "or",
        "but",
        "not",
        "with",
        "this",
        "that",
        "from",
        "by",
        "as",
        "be",
        "are",
        "was",
        "were",
        "been",
        "has",
        "have",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "can",
        "shall",
    }
    return [t for t in tokens if len(t) > 1 and t not in stop_words]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.

    Returns a value in [-1, 1] where 1 means identical direction.
    Uses pure Python math for the MVP; in production, use numpy or
    the database's built-in vector distance functions.
    """
    if len(a) != len(b) or not a:
        return 0.0

    dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a: float = math.sqrt(sum(x * x for x in a))
    norm_b: float = math.sqrt(sum(x * x for x in b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


def _extract_highlight(text: str, max_length: int = 100) -> str:
    """Extract the first meaningful sentence from text for highlighting."""
    # Find first sentence
    sentences: list[str] = re.split(r"[.!?]+", text)
    for sentence in sentences:
        stripped: str = sentence.strip()
        if len(stripped) > 20:  # Skip very short fragments
            return stripped[:max_length]
    return text[:max_length]
