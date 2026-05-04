"""
Tests for the Vector Store Service.

Validates chunking strategies, vector store operations (search, store,
metadata filtering), citation building, and graph discovery.

Note on API conventions:
    - Chunker constructors use ``target_size`` / ``overlap`` (tokens).
    - ``chunk()`` requires (document_id, text, metadata) → list[Chunk].
    - VectorStore uses ``store_document()`` (not ``ingest``).
    - ``_tokenize`` is a module-level helper, not a VectorStore method.
    - ``stats()`` returns keys: documents, chunks, vocabulary_size, graph_edges.
"""

import datetime
import typing

import pytest

import src.adapters.vector_store
import src.domain.chunking
import src.domain.models

# ═══════════════════════════════════════════════════════════════════════════════
# Chunking Strategies
# ═══════════════════════════════════════════════════════════════════════════════


class TestFixedSizeChunker:
    def test_basic_chunking(self) -> None:
        chunker = src.domain.chunking.FixedSizeChunker(target_size=50, overlap=10)
        text: str = "word " * 100  # ~500 chars → many chunks at 50 tokens each
        chunks = chunker.chunk(document_id="test-doc", text=text)
        assert len(chunks) > 1
        for chunk in chunks:
            assert hasattr(chunk, "content")  # Returns Chunk objects

    def test_short_text_single_chunk(self) -> None:
        chunker = src.domain.chunking.FixedSizeChunker(target_size=200)
        text = "Short text."
        chunks = chunker.chunk(document_id="test-doc", text=text)
        assert len(chunks) == 1
        assert chunks[0].content == "Short text."

    def test_empty_text(self) -> None:
        chunker = src.domain.chunking.FixedSizeChunker()
        chunks = chunker.chunk(document_id="test-doc", text="")
        assert chunks == []


class TestSentenceChunker:
    def test_basic_chunking(self) -> None:
        chunker = src.domain.chunking.SentenceChunker(target_size=50)
        text = "This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five."
        chunks = chunker.chunk(document_id="test-doc", text=text)
        assert len(chunks) >= 1
        # Each chunk content should contain complete sentences
        for chunk in chunks:
            assert chunk.content  # Non-empty content

    def test_single_sentence(self) -> None:
        chunker = src.domain.chunking.SentenceChunker(target_size=500)
        text = "Just one sentence."
        chunks = chunker.chunk(document_id="test-doc", text=text)
        assert len(chunks) == 1

    def test_empty_text(self) -> None:
        chunker = src.domain.chunking.SentenceChunker()
        chunks = chunker.chunk(document_id="test-doc", text="")
        assert chunks == []


class TestSlidingWindowChunker:
    def test_basic_chunking(self) -> None:
        chunker = src.domain.chunking.SlidingWindowChunker(target_size=50, overlap=20)
        text: str = "word " * 100
        chunks = chunker.chunk(document_id="test-doc", text=text)
        assert len(chunks) > 1

    def test_overlap_creates_more_chunks(self) -> None:
        text: str = "word " * 100
        no_overlap = src.domain.chunking.FixedSizeChunker(target_size=50, overlap=0)
        with_overlap = src.domain.chunking.SlidingWindowChunker(target_size=50, overlap=25)
        chunks_no = no_overlap.chunk(document_id="d1", text=text)
        chunks_yes = with_overlap.chunk(document_id="d2", text=text)
        assert len(chunks_yes) >= len(chunks_no)


class TestChunkerFactory:
    def test_create_sentence_chunker(self) -> None:
        chunker: src.domain.chunking.BaseChunker = src.domain.chunking.create_chunker("sentence")
        assert isinstance(chunker, src.domain.chunking.SentenceChunker)

    def test_create_fixed_chunker(self) -> None:
        chunker: src.domain.chunking.BaseChunker = src.domain.chunking.create_chunker("fixed")
        assert isinstance(chunker, src.domain.chunking.FixedSizeChunker)

    def test_create_sliding_chunker(self) -> None:
        chunker: src.domain.chunking.BaseChunker = src.domain.chunking.create_chunker("sliding_window")
        assert isinstance(chunker, src.domain.chunking.SlidingWindowChunker)

    def test_default_is_sentence(self) -> None:
        chunker: src.domain.chunking.BaseChunker = src.domain.chunking.create_chunker("unknown_strategy")
        assert isinstance(chunker, src.domain.chunking.SentenceChunker)

    def test_custom_params(self) -> None:
        chunker: src.domain.chunking.BaseChunker = src.domain.chunking.create_chunker("fixed", target_size=100, overlap=20)
        assert isinstance(chunker, src.domain.chunking.FixedSizeChunker)
        assert chunker.target_size == 100
        assert chunker.overlap == 20


# ═══════════════════════════════════════════════════════════════════════════════
# Vector Store — Search, Store, Metadata
# ═══════════════════════════════════════════════════════════════════════════════


class TestVectorStore:
    @pytest.fixture
    def store(self) -> src.adapters.vector_store.VectorStore:
        return src.adapters.vector_store.VectorStore()

    @pytest.fixture
    def seeded_store(self, store: src.adapters.vector_store.VectorStore) -> src.adapters.vector_store.VectorStore:
        """Store with sample documents pre-loaded via direct dict injection."""
        return_embedding: list[float] = [1.0] + [0.0] * 767
        pharmacy_embedding: list[float] = [0.0, 1.0] + [0.0] * 766
        kirkland_embedding: list[float] = [0.0, 0.0, 1.0] + [0.0] * 765

        # Document 1: HKI Return Policy
        doc1 = src.domain.models.Document(
            id="doc-1",
            content="HKI has a generous return policy. Most items can be returned at any time.",
            metadata=src.domain.models.DocumentMetadata(
                title="Return Policy",
                document_type=src.domain.models.DocumentType.POLICY,
                department="Customer Service",
                tags=["returns", "policy"],
            ),
            status=src.domain.models.DocumentStatus.INDEXED,
            chunk_count=1,
        )
        chunk1 = src.domain.models.Chunk(
            id="chunk-1-1",
            document_id="doc-1",
            content="HKI has a generous return policy. Most items can be returned at any time.",
            position=0,
            token_count=15,
            embedding=return_embedding,
        )

        # Document 2: Pharmacy SOP
        doc2 = src.domain.models.Document(
            id="doc-2",
            content="Pharmacy operations must comply with HIPAA. Controlled substances require verification.",
            metadata=src.domain.models.DocumentMetadata(
                title="Pharmacy Operations Guide",
                document_type=src.domain.models.DocumentType.SOP,
                department="Pharmacy",
                tags=["pharmacy", "compliance", "hipaa"],
            ),
            status=src.domain.models.DocumentStatus.INDEXED,
            chunk_count=1,
        )
        chunk2 = src.domain.models.Chunk(
            id="chunk-2-1",
            document_id="doc-2",
            content="Pharmacy operations must comply with HIPAA. Controlled substances require verification.",
            position=0,
            token_count=12,
            embedding=pharmacy_embedding,
        )

        # Document 3: Kirkland Product Standards (using PRODUCT type)
        doc3 = src.domain.models.Document(
            id="doc-3",
            content="Kirkland Signature products must meet or exceed national brand quality.",
            metadata=src.domain.models.DocumentMetadata(
                title="Kirkland Signature Standards",
                document_type=src.domain.models.DocumentType.PRODUCT,
                department="Merchandising",
                tags=["kirkland", "quality"],
            ),
            status=src.domain.models.DocumentStatus.INDEXED,
            chunk_count=1,
        )
        chunk3 = src.domain.models.Chunk(
            id="chunk-3-1",
            document_id="doc-3",
            content="Kirkland Signature products must meet or exceed national brand quality.",
            position=0,
            token_count=12,
            embedding=kirkland_embedding,
        )

        store._documents = {"doc-1": doc1, "doc-2": doc2, "doc-3": doc3}
        store._chunks = {"chunk-1-1": chunk1, "chunk-2-1": chunk2, "chunk-3-1": chunk3}
        store._doc_chunks = {
            "doc-1": ["chunk-1-1"],
            "doc-2": ["chunk-2-1"],
            "doc-3": ["chunk-3-1"],
        }
        store._total_chunks = 3

        # Build inverted index for keyword search using module-level _tokenize
        for chunk in [chunk1, chunk2, chunk3]:
            tokens: list[str] = src.adapters.vector_store._tokenize(chunk.content)
            unique_terms: set[str] = set(tokens)
            for token in unique_terms:
                if token not in store._inverted_index:
                    store._inverted_index[token] = set()
                    store._doc_freq[token] = 0
                store._inverted_index[token].add(chunk.id)
                store._doc_freq[token] += 1

        return store

    @pytest.mark.asyncio
    async def test_keyword_search(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
        )
        result = await seeded_store.search(query, query_embedding=None)
        assert result.total_results > 0
        # Return policy doc should match
        matched_docs = {r.document_id for r in result.results}
        assert "doc-1" in matched_docs
        assert result.results[0].score_scale == src.domain.models.ScoreScale.RAW_RANK
        assert result.results[0].keyword_score_scale == src.domain.models.ScoreScale.RAW_RANK

    @pytest.mark.asyncio
    async def test_vector_search(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        # Use an embedding close to doc-1's embedding
        query_embedding: list[float] = [1.0] + [0.0] * 767
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.VECTOR,
            top_k=3,
        )
        result = await seeded_store.search(query, query_embedding=query_embedding)
        assert result.total_results > 0
        # Should rank doc-1 highest (identical embedding)
        assert result.results[0].document_id == "doc-1"
        assert result.results[0].score_scale == src.domain.models.ScoreScale.NORMALIZED
        assert result.results[0].vector_score_scale == src.domain.models.ScoreScale.NORMALIZED

    @pytest.mark.asyncio
    async def test_hybrid_search(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query_embedding: list[float] = [1.0] + [0.0] * 767
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.HYBRID,
            top_k=5,
        )
        result = await seeded_store.search(query, query_embedding=query_embedding)
        assert result.total_results > 0
        assert result.results[0].score_scale == src.domain.models.ScoreScale.NORMALIZED
        assert result.results[0].keyword_score_scale == src.domain.models.ScoreScale.RAW_RANK

    @pytest.mark.asyncio
    async def test_department_filter(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="operations",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
            filters=src.domain.models.SearchFilters(departments=["Pharmacy"]),
        )
        result = await seeded_store.search(query, query_embedding=None)
        for r in result.results:
            doc = seeded_store._documents[r.document_id]
            assert doc.metadata.department == "Pharmacy"

    @pytest.mark.asyncio
    async def test_document_inventory_summary(self, store: src.adapters.vector_store.VectorStore) -> None:
        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        docs: list[src.domain.models.Document] = [
            src.domain.models.Document(
                id="live-current",
                content="Current published policy",
                metadata=src.domain.models.DocumentMetadata(
                    title="Current Policy",
                    document_type=src.domain.models.DocumentType.POLICY,
                    department="Pharmacy",
                    updated_at=now - datetime.timedelta(days=10),
                ),
                status=src.domain.models.DocumentStatus.PUBLISHED,
                chunk_count=1,
                created_at=now - datetime.timedelta(days=10),
                updated_at=now - datetime.timedelta(days=10),
            ),
            src.domain.models.Document(
                id="pending-review",
                content="Awaiting review",
                metadata=src.domain.models.DocumentMetadata(
                    title="Pending Review",
                    document_type=src.domain.models.DocumentType.SOP,
                    department="Pharmacy",
                    updated_at=now - datetime.timedelta(days=45),
                ),
                status=src.domain.models.DocumentStatus.PENDING_REVIEW,
                chunk_count=1,
                created_at=now - datetime.timedelta(days=45),
                updated_at=now - datetime.timedelta(days=45),
            ),
            src.domain.models.Document(
                id="processing-stale",
                content="Still processing",
                metadata=src.domain.models.DocumentMetadata(
                    title="Processing",
                    document_type=src.domain.models.DocumentType.GENERAL,
                    department="",
                    updated_at=now - datetime.timedelta(days=120),
                ),
                status=src.domain.models.DocumentStatus.PROCESSING,
                chunk_count=1,
                created_at=now - datetime.timedelta(days=120),
                updated_at=now - datetime.timedelta(days=120),
            ),
        ]

        store._documents = {doc.id: doc for doc in docs}

        summary = await store.document_inventory_summary()

        assert summary.total_documents == 3
        assert summary.live_count == 1
        assert summary.pending_review_count == 1
        assert summary.processing_count == 1
        assert summary.archived_count == 0
        assert summary.failed_count == 0
        assert summary.missing_labels_count == 1
        assert summary.top_departments == [
            src.domain.models.DepartmentCount(label="Pharmacy", value=2)
        ]
        assert summary.freshness.current_count == 1
        assert summary.freshness.review_count == 1
        assert summary.freshness.stale_count == 1
        assert summary.freshness.unknown_count == 0

    @pytest.mark.asyncio
    async def test_global_scope_allows_search_across_streams(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
            filters=src.domain.models.SearchFilters(value_streams=["global"]),
        )

        result = await seeded_store.search(query, query_embedding=None)

        assert result.total_results > 0
        matched_docs = {r.document_id for r in result.results}
        assert "doc-1" in matched_docs

    @pytest.mark.asyncio
    async def test_filename_query_matches_document_title(self, store: src.adapters.vector_store.VectorStore) -> None:
        doc = src.domain.models.Document(
            id="doc-filename",
            content="Workers must use harnesses near unprotected edges.",
            metadata=src.domain.models.DocumentMetadata(
                title="fall-protection-plan.md",
                document_type=src.domain.models.DocumentType.POLICY,
            ),
            status=src.domain.models.DocumentStatus.PUBLISHED,
            chunk_count=1,
        )
        chunk = src.domain.models.Chunk(
            id="chunk-filename-1",
            document_id=doc.id,
            content=doc.content,
            position=0,
            token_count=8,
            embedding=[0.4] * 768,
        )
        await store.store_document(doc, [chunk])

        result = await store.search(
            src.domain.models.SearchQuery(
                query="fall-protection-plan.md",
                mode=src.domain.models.SearchMode.KEYWORD,
                top_k=5,
            ),
            query_embedding=None,
        )

        assert result.total_results == 1
        assert result.results[0].document_id == doc.id

    @pytest.mark.asyncio
    async def test_keyword_search_uses_retrieval_metadata(self, store: src.adapters.vector_store.VectorStore) -> None:
        doc = src.domain.models.Document(
            id="doc-pharmacy",
            content="Use the pharmacy troubleshooting playbook for additional detail.",
            metadata=src.domain.models.DocumentMetadata(
                title="Pharmacy rejection playbook",
                department="Pharmacy",
                tags=["pharmacy"],
                custom={
                    "source_id": "KB2028004",
                    "system_name": "Enterprise Pharmacy System (EPS)",
                    "retrieval_text": "KB2028004 Enterprise Pharmacy System EPS NN switch intermediary",
                },
            ),
            status=src.domain.models.DocumentStatus.PUBLISHED,
            chunk_count=1,
        )
        chunk = src.domain.models.Chunk(
            id="chunk-pharmacy-1",
            document_id=doc.id,
            content=doc.content,
            position=0,
            token_count=9,
            embedding=[0.2] * 768,
        )
        await store.store_document(doc, [chunk])

        result = await store.search(
            src.domain.models.SearchQuery(
                query="KB2028004 EPS NN switch intermediary",
                mode=src.domain.models.SearchMode.KEYWORD,
                top_k=5,
            ),
            query_embedding=None,
        )

        assert result.total_results == 1
        assert result.results[0].document_id == doc.id

    @pytest.mark.asyncio
    async def test_document_type_filter(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="operations",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
            filters=src.domain.models.SearchFilters(document_types=[src.domain.models.DocumentType.SOP]),
        )
        result = await seeded_store.search(query, query_embedding=None)
        for r in result.results:
            doc = seeded_store._documents[r.document_id]
            assert doc.metadata.document_type == src.domain.models.DocumentType.SOP

    @pytest.mark.asyncio
    async def test_citations_generated(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
            include_citations=True,
        )
        result = await seeded_store.search(query, query_embedding=None)
        assert len(result.citations) > 0
        for citation in result.citations:
            assert citation.document_title
            assert citation.chunk_id
            assert citation.content_preview

    @pytest.mark.asyncio
    async def test_store_document(self, store: src.adapters.vector_store.VectorStore) -> None:
        """Test that store_document persists document + chunks correctly."""
        import uuid

        doc = src.domain.models.Document(
            id=str(uuid.uuid4()),
            content="Test document content for ingestion.",
            metadata=src.domain.models.DocumentMetadata(title="Test Doc"),
        )
        chunk = src.domain.models.Chunk(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            content="Test document content for ingestion.",
            position=0,
            token_count=7,
            embedding=[0.5] * 768,
        )
        doc_id: str = await store.store_document(doc, [chunk])
        assert doc_id == doc.id
        stats: dict[str, typing.Any] = store.stats()
        assert stats["documents"] >= 1
        assert stats["chunks"] >= 1

    @pytest.mark.asyncio
    async def test_restricted_document_requires_matching_group(self, store: src.adapters.vector_store.VectorStore) -> None:
        doc = src.domain.models.Document(
            id="legal-doc",
            content="Privileged legal memo about active litigation.",
            metadata=src.domain.models.DocumentMetadata(
                title="Legal Litigation Memo",
                document_type=src.domain.models.DocumentType.POLICY,
                department="Legal",
                classification=src.domain.models.DocumentClassification.RESTRICTED,
                access_control=src.domain.models.DocumentAccessControl(
                    allowed_groups=["department:legal"],
                ),
            ),
            status=src.domain.models.DocumentStatus.PUBLISHED,
            chunk_count=1,
        )
        chunk = src.domain.models.Chunk(
            id="legal-chunk",
            document_id=doc.id,
            content=doc.content,
            position=0,
            token_count=8,
            embedding=[0.1] * 768,
        )
        await store.store_document(doc, [chunk])

        blocked = await store.search(
            src.domain.models.SearchQuery(
                query="litigation memo",
                mode=src.domain.models.SearchMode.KEYWORD,
                top_k=5,
                filters=src.domain.models.SearchFilters(
                    document_statuses=[src.domain.models.DocumentStatus.PUBLISHED],
                    caller_user_id="ops-user",
                    caller_principals=["department:operations"],
                ),
            )
        )
        assert blocked.total_results == 0

        allowed = await store.search(
            src.domain.models.SearchQuery(
                query="litigation memo",
                mode=src.domain.models.SearchMode.KEYWORD,
                top_k=5,
                filters=src.domain.models.SearchFilters(
                    document_statuses=[src.domain.models.DocumentStatus.PUBLISHED],
                    caller_user_id="legal-user",
                    caller_principals=["department:legal"],
                ),
            )
        )
        assert allowed.total_results == 1
        assert allowed.results[0].document_id == doc.id

    @pytest.mark.asyncio
    async def test_document_acl_allows_explicit_user(self, store: src.adapters.vector_store.VectorStore) -> None:
        doc = src.domain.models.Document(
            id="user-acl-doc",
            content="Case strategy notes for outside counsel.",
            metadata=src.domain.models.DocumentMetadata(
                title="Case Strategy",
                classification=src.domain.models.DocumentClassification.RESTRICTED,
                access_control=src.domain.models.DocumentAccessControl(
                    allowed_users=["legal.lead@example.com"],
                ),
            ),
            status=src.domain.models.DocumentStatus.PUBLISHED,
        )
        chunk = src.domain.models.Chunk(
            id="user-acl-chunk",
            document_id=doc.id,
            content=doc.content,
            position=0,
            token_count=6,
            embedding=[0.2] * 768,
        )
        await store.store_document(doc, [chunk])

        assert (
            await store.get_document(
                doc.id,
                user_id="someone.else@example.com",
                principals=["department:legal"],
            )
            is None
        )
        assert (
            await store.get_document(
                doc.id,
                user_id="legal.lead@example.com",
                principals=["department:operations"],
            )
            is not None
        )

    @pytest.mark.asyncio
    async def test_get_document(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        doc = await seeded_store.get_document("doc-1")
        assert doc is not None
        assert doc.metadata.title == "Return Policy"

    @pytest.mark.asyncio
    async def test_delete_document(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        initial_count: int = len(seeded_store._documents)
        result: bool = await seeded_store.delete_document("doc-1")
        assert result is True
        assert len(seeded_store._documents) == initial_count - 1
        assert "doc-1" not in seeded_store._documents

    @pytest.mark.asyncio
    async def test_stats(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        stats: dict[str, typing.Any] = seeded_store.stats()
        assert stats["documents"] == 3
        assert stats["chunks"] == 3
        assert "vocabulary_size" in stats

    @pytest.mark.asyncio
    async def test_search_no_results(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="xyznonexistentquery123",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
        )
        result = await seeded_store.search(query, query_embedding=None)
        assert result.total_results == 0

    @pytest.mark.asyncio
    async def test_min_score_filter(self, seeded_store: src.adapters.vector_store.VectorStore) -> None:
        query = src.domain.models.SearchQuery(
            query="return policy",
            mode=src.domain.models.SearchMode.KEYWORD,
            top_k=5,
            min_score=0.99,  # Very high threshold
        )
        result = await seeded_store.search(query, query_embedding=None)
        for r in result.results:
            assert r.score >= 0.99


# ═══════════════════════════════════════════════════════════════════════════════
# Tokenizer Utility (module-level function)
# ═══════════════════════════════════════════════════════════════════════════════


class TestTokenizer:
    def test_basic_tokenization(self) -> None:
        tokens: list[str] = src.adapters.vector_store._tokenize("Hello world, this is a test!")
        assert "hello" in tokens
        assert "world" in tokens
        assert "test" in tokens

    def test_stop_words_removed(self) -> None:
        tokens: list[str] = src.adapters.vector_store._tokenize("this is a the and of")
        # Most common stop words should be filtered
        assert "this" not in tokens or len(tokens) == 0

    def test_empty_string(self) -> None:
        tokens: list[str] = src.adapters.vector_store._tokenize("")
        assert tokens == []
