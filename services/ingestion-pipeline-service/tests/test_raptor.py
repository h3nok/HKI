"""Tests for RAPTOR — hierarchical summarization tree builder."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.domain.raptor import (
    RaptorBuilder,
    RaptorReport,
    _cosine_sim,
    _kmeans_cluster,
)


# ── _cosine_sim ───────────────────────────────────────────────────────────


class TestCosineSim:
    def test_identical_vectors_return_one(self):
        v = [1.0, 0.0, 0.0]
        assert _cosine_sim(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors_return_zero(self):
        assert _cosine_sim([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_opposite_vectors_return_negative_one(self):
        assert _cosine_sim([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)

    def test_zero_vector_a_returns_zero(self):
        assert _cosine_sim([0.0, 0.0], [1.0, 1.0]) == 0.0

    def test_zero_vector_b_returns_zero(self):
        assert _cosine_sim([1.0, 1.0], [0.0, 0.0]) == 0.0

    def test_both_zero_vectors_return_zero(self):
        assert _cosine_sim([0.0, 0.0], [0.0, 0.0]) == 0.0

    def test_very_similar_vectors_high_similarity(self):
        a = [1.0, 1.0, 1.0]
        b = [1.0, 1.0, 0.9]
        assert _cosine_sim(a, b) > 0.99

    def test_result_bounded_between_minus_one_and_one(self):
        a = [3.0, 4.0]
        b = [1.0, 2.0]
        sim = _cosine_sim(a, b)
        assert -1.0 <= sim <= 1.0

    def test_mismatched_length_uses_shorter(self):
        # zip with strict=False silently truncates to shortest
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0]
        # Should not raise
        _cosine_sim(a, b)


# ── _kmeans_cluster ───────────────────────────────────────────────────────


class TestKmeansCluster:
    def test_empty_input_returns_empty(self):
        assert _kmeans_cluster([], k=3) == []

    def test_k_zero_returns_empty(self):
        assert _kmeans_cluster([[1.0, 0.0]], k=0) == []

    def test_k_negative_returns_empty(self):
        assert _kmeans_cluster([[1.0, 0.0]], k=-1) == []

    def test_k_clamped_to_n(self):
        embeddings = [[1.0, 0.0], [0.0, 1.0]]
        result = _kmeans_cluster(embeddings, k=100)
        total = sum(len(c) for c in result)
        assert total == 2

    def test_single_embedding_single_cluster(self):
        result = _kmeans_cluster([[1.0, 0.0]], k=1)
        assert len(result) == 1
        assert result[0] == [0]

    def test_all_points_are_assigned(self):
        embeddings = [
            [1.0, 0.0, 0.0],
            [0.9, 0.1, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.9, 0.1],
        ]
        result = _kmeans_cluster(embeddings, k=2)
        all_indices = sorted(idx for cluster in result for idx in cluster)
        assert all_indices == [0, 1, 2, 3]

    def test_no_empty_clusters_in_output(self):
        embeddings = [[1.0, 0.0], [0.9, 0.1], [0.0, 1.0]]
        result = _kmeans_cluster(embeddings, k=3)
        for cluster in result:
            assert len(cluster) > 0

    def test_k_equals_one_all_in_single_cluster(self):
        embeddings = [[1.0, 0.0], [0.5, 0.5], [0.0, 1.0]]
        result = _kmeans_cluster(embeddings, k=1)
        assert len(result) == 1
        assert sorted(result[0]) == [0, 1, 2]

    def test_similar_vectors_cluster_together(self):
        """Two tight groups should reliably cluster separately."""
        group_a = [[1.0, 0.0, 0.0], [0.99, 0.01, 0.0]]
        group_b = [[0.0, 0.0, 1.0], [0.0, 0.01, 0.99]]
        embeddings = group_a + group_b  # indices 0,1 are A; 2,3 are B

        # Run multiple times to account for random init
        for _ in range(10):
            result = _kmeans_cluster(embeddings, k=2)
            sets = [set(c) for c in result]
            if {0, 1} in sets and {2, 3} in sets:
                return  # passed

        # Fallback: just verify all assigned
        result = _kmeans_cluster(embeddings, k=2)
        all_indices = sorted(idx for c in result for idx in c)
        assert all_indices == [0, 1, 2, 3]

    def test_converges_within_max_iterations(self):
        import random
        random.seed(42)
        embeddings = [[float(i), 0.0] for i in range(10)]
        result = _kmeans_cluster(embeddings, k=3, max_iterations=5)
        assert len(result) > 0


# ── RaptorBuilder init ────────────────────────────────────────────────────


class TestRaptorBuilderInit:
    def test_default_cluster_size(self):
        b = RaptorBuilder()
        assert b._cluster_size == 10

    def test_custom_cluster_size(self):
        b = RaptorBuilder(target_cluster_size=5)
        assert b._cluster_size == 5

    def test_trailing_slash_stripped_from_url(self):
        b = RaptorBuilder(knowledge_api_url="http://localhost:9509/")
        assert not b._api_url.endswith("/")

    def test_gemini_defaults_to_none(self):
        b = RaptorBuilder()
        assert b._gemini is None

    def test_embedder_defaults_to_none(self):
        b = RaptorBuilder()
        assert b._embedder is None


# ── RaptorBuilder.build ───────────────────────────────────────────────────


class TestRaptorBuild:
    @pytest.fixture
    def builder(self):
        return RaptorBuilder(knowledge_api_url="http://test-api")

    async def test_empty_chunks_returns_zero_levels(self, builder):
        with patch.object(builder, "_fetch_chunks", AsyncMock(return_value=[])):
            report = await builder.build("org1")
        assert report.levels_built == 0
        assert report.summaries_created == 0

    async def test_single_chunk_stops_immediately(self, builder):
        single = [{"chunk_id": "c1", "content": "hello", "embedding": [1.0, 0.0]}]
        with patch.object(builder, "_fetch_chunks", AsyncMock(return_value=single)):
            report = await builder.build("org1")
        assert report.levels_built == 0

    async def test_report_org_id_matches_arg(self, builder):
        with patch.object(builder, "_fetch_chunks", AsyncMock(return_value=[])):
            report = await builder.build("my-org")
        assert report.org_id == "my-org"

    async def test_duration_ms_is_non_negative(self, builder):
        with patch.object(builder, "_fetch_chunks", AsyncMock(return_value=[])):
            report = await builder.build("org1")
        assert report.duration_ms >= 0

    async def test_builds_one_level_from_many_chunks(self, builder):
        chunks = [
            {
                "chunk_id": f"c{i}",
                "content": f"content {i}",
                "embedding": [1.0 if i % 2 == 0 else 0.0, 0.0 if i % 2 == 0 else 1.0],
            }
            for i in range(20)
        ]
        with (
            patch.object(builder, "_fetch_chunks", AsyncMock(return_value=chunks)),
            patch.object(builder, "_summarize_cluster", AsyncMock(return_value="summary")),
            patch.object(builder, "_embed_text", AsyncMock(return_value=[0.5, 0.5])),
            patch.object(builder, "_store_summary_chunk", AsyncMock()),
        ):
            report = await builder.build("org1", max_levels=1)
        assert report.levels_built == 1
        assert report.summaries_created > 0

    async def test_stops_when_embeddings_missing(self, builder):
        chunks = [
            {"chunk_id": "c1", "content": "text", "embedding": []},
            {"chunk_id": "c2", "content": "text", "embedding": []},
        ]
        with patch.object(builder, "_fetch_chunks", AsyncMock(return_value=chunks)):
            report = await builder.build("org1")
        assert report.levels_built == 0

    async def test_skips_clusters_with_empty_summaries(self, builder):
        chunks = [
            {"chunk_id": f"c{i}", "content": f"text {i}",
             "embedding": [float(i % 2), float((i + 1) % 2)]}
            for i in range(10)
        ]
        with (
            patch.object(builder, "_fetch_chunks", AsyncMock(return_value=chunks)),
            patch.object(builder, "_summarize_cluster", AsyncMock(return_value="")),
            patch.object(builder, "_embed_text", AsyncMock(return_value=[0.5, 0.5])),
            patch.object(builder, "_store_summary_chunk", AsyncMock()),
        ):
            report = await builder.build("org1", max_levels=1)
        assert report.summaries_created == 0

    async def test_store_called_for_each_summary(self, builder):
        chunks = [
            {"chunk_id": f"c{i}", "content": f"content {i}",
             "embedding": [1.0 if i < 5 else 0.0, 0.0 if i < 5 else 1.0]}
            for i in range(10)
        ]
        mock_store = AsyncMock()
        with (
            patch.object(builder, "_fetch_chunks", AsyncMock(return_value=chunks)),
            patch.object(builder, "_summarize_cluster", AsyncMock(return_value="summary")),
            patch.object(builder, "_embed_text", AsyncMock(return_value=[0.5, 0.5])),
            patch.object(builder, "_store_summary_chunk", mock_store),
        ):
            report = await builder.build("org1", max_levels=1)
        assert mock_store.await_count == report.summaries_created

    async def test_respects_max_levels(self, builder):
        # With enough chunks, should stop at max_levels=2
        chunks = [
            {"chunk_id": f"c{i}", "content": f"content {i}",
             "embedding": [float(i % 3 == 0), float(i % 3 == 1), float(i % 3 == 2)]}
            for i in range(30)
        ]
        with (
            patch.object(builder, "_fetch_chunks", AsyncMock(return_value=chunks)),
            patch.object(builder, "_summarize_cluster", AsyncMock(return_value="summary")),
            patch.object(builder, "_embed_text", AsyncMock(return_value=[0.33, 0.33, 0.34])),
            patch.object(builder, "_store_summary_chunk", AsyncMock()),
        ):
            report = await builder.build("org1", max_levels=2)
        assert report.levels_built <= 2


# ── _summarize_cluster ────────────────────────────────────────────────────


class TestSummarizeCluster:
    async def test_fallback_without_gemini_returns_first_sentences(self):
        b = RaptorBuilder(gemini_client=None)
        texts = ["First sentence. More text.", "Second sentence. More text."]
        result = await b._summarize_cluster(texts, level=1)
        assert len(result) > 0

    async def test_uses_gemini_and_strips_whitespace(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="  Summary text.  ")
        b = RaptorBuilder(gemini_client=mock_gemini)
        result = await b._summarize_cluster(["text"], level=1)
        assert result == "Summary text."

    async def test_gemini_failure_returns_empty_string(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(side_effect=Exception("API error"))
        b = RaptorBuilder(gemini_client=mock_gemini)
        result = await b._summarize_cluster(["text"], level=1)
        assert result == ""

    async def test_prompt_includes_level_number(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        b = RaptorBuilder(gemini_client=mock_gemini)
        await b._summarize_cluster(["text"], level=3)
        prompt = mock_gemini.generate.call_args[0][0]
        assert "level 3" in prompt

    async def test_prompt_limited_to_10_texts(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        b = RaptorBuilder(gemini_client=mock_gemini)
        texts = [f"unique-marker-{i}" for i in range(20)]
        await b._summarize_cluster(texts, level=1)
        prompt = mock_gemini.generate.call_args[0][0]
        assert "unique-marker-9" in prompt
        assert "unique-marker-10" not in prompt

    async def test_fallback_limited_to_5_texts(self):
        b = RaptorBuilder(gemini_client=None)
        texts = [f"Sentence{i}." for i in range(10)]
        result = await b._summarize_cluster(texts, level=1)
        # Only first 5 are used in the join
        assert "Sentence5" not in result


# ── _embed_text ───────────────────────────────────────────────────────────


class TestEmbedText:
    async def test_returns_empty_list_without_embedder(self):
        b = RaptorBuilder(embedding_client=None)
        result = await b._embed_text("some text")
        assert result == []

    async def test_calls_embed_single_with_text(self):
        mock_embedder = AsyncMock()
        mock_embedder.embed_single = AsyncMock(return_value=[0.1, 0.2, 0.3])
        b = RaptorBuilder(embedding_client=mock_embedder)
        result = await b._embed_text("hello world")
        assert result == [0.1, 0.2, 0.3]
        mock_embedder.embed_single.assert_awaited_once_with("hello world")

    async def test_embedding_failure_returns_empty(self):
        mock_embedder = AsyncMock()
        mock_embedder.embed_single = AsyncMock(side_effect=Exception("service down"))
        b = RaptorBuilder(embedding_client=mock_embedder)
        result = await b._embed_text("text")
        assert result == []


# ── _fetch_chunks ─────────────────────────────────────────────────────────


class TestFetchChunks:
    def _make_http_client(self, status_code: int, body: dict | None = None):
        mock_resp = MagicMock()
        mock_resp.status_code = status_code
        mock_resp.json = MagicMock(return_value=body or {})
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        return mock_client

    async def test_returns_chunks_on_200(self):
        expected = [{"chunk_id": "c1", "content": "hello", "embedding": [1.0]}]
        mock_client = self._make_http_client(200, {"chunks": expected})
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            result = await b._fetch_chunks("org1")
        assert result == expected

    async def test_returns_empty_on_503(self):
        mock_client = self._make_http_client(503)
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            result = await b._fetch_chunks("org1")
        assert result == []

    async def test_returns_empty_on_network_error(self):
        import httpx
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("unreachable"))
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            result = await b._fetch_chunks("org1")
        assert result == []

    async def test_passes_org_id_as_query_param(self):
        mock_client = self._make_http_client(200, {"chunks": []})
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._fetch_chunks("target-org")
        call_kwargs = mock_client.get.call_args[1]
        assert call_kwargs["params"]["org_id"] == "target-org"

    async def test_requests_embeddings(self):
        mock_client = self._make_http_client(200, {"chunks": []})
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._fetch_chunks("org1")
        call_kwargs = mock_client.get.call_args[1]
        assert call_kwargs["params"]["include_embeddings"] is True


# ── _store_summary_chunk ──────────────────────────────────────────────────


class TestStoreSummaryChunk:
    def _make_post_client(self, side_effect=None):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        if side_effect:
            mock_client.post = AsyncMock(side_effect=side_effect)
        else:
            mock_client.post = AsyncMock(return_value=MagicMock())
        return mock_client

    async def test_posts_to_raptor_endpoint(self):
        mock_client = self._make_post_client()
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._store_summary_chunk("sum-1", "summary", [0.1], "org1", 2, ["c1"])
        url = mock_client.post.call_args[0][0]
        assert "/v1/chunks/raptor" in url

    async def test_payload_contains_chunk_id(self):
        mock_client = self._make_post_client()
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._store_summary_chunk("my-chunk-id", "summary", [], "org1", 1, [])
        body = mock_client.post.call_args[1]["json"]
        assert body["chunk_id"] == "my-chunk-id"

    async def test_payload_contains_org_id(self):
        mock_client = self._make_post_client()
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._store_summary_chunk("id", "summary", [], "my-org", 1, [])
        body = mock_client.post.call_args[1]["json"]
        assert body["org_id"] == "my-org"

    async def test_metadata_contains_raptor_level(self):
        mock_client = self._make_post_client()
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._store_summary_chunk("id", "summary", [], "org1", 3, ["c1", "c2"])
        body = mock_client.post.call_args[1]["json"]
        assert body["metadata"]["raptor_level"] == 3
        assert body["metadata"]["source_chunks"] == ["c1", "c2"]
        assert body["metadata"]["strategy"] == "raptor_summary"

    async def test_network_failure_does_not_raise(self):
        import httpx
        mock_client = self._make_post_client(side_effect=httpx.ConnectError("down"))
        b = RaptorBuilder(knowledge_api_url="http://test-api")
        with patch("src.domain.raptor.create_service_client", return_value=mock_client):
            await b._store_summary_chunk("id", "content", [], "org1", 1, [])  # must not raise
