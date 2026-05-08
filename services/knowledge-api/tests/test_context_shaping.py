"""Tests for the Context Shaping pipeline."""

from __future__ import annotations

import pytest

from src.domain.context_shaping import (
    ContextFormat,
    ContextShaper,
    ScoredChunk,
    ShapedContext,
    ShapingConfig,
    _cosine_sim,
    _estimate_tokens,
)


# ── Fixtures ──────────────────────────────────────────────────────────────


def _make_chunk(
    cid: str,
    content: str = "chunk content",
    relevance: float = 0.8,
    metadata: dict | None = None,
) -> ScoredChunk:
    return ScoredChunk(
        chunk_id=cid,
        document_id="doc-1",
        content=content,
        relevance_score=relevance,
        token_count=_estimate_tokens(content),
        metadata=metadata or {},
    )


def _make_embedding(dim: int = 4, seed: float = 1.0) -> list[float]:
    """Generate a simple deterministic embedding."""
    return [seed * (i + 1) / dim for i in range(dim)]


@pytest.fixture
def shaper():
    return ContextShaper()


# ── Unit tests: utilities ─────────────────────────────────────────────────


class TestCosineSim:
    def test_identical(self):
        v = [1.0, 2.0, 3.0]
        assert _cosine_sim(v, v) == pytest.approx(1.0, abs=0.001)

    def test_orthogonal(self):
        assert _cosine_sim([1, 0], [0, 1]) == pytest.approx(0.0, abs=0.001)

    def test_empty(self):
        assert _cosine_sim([], []) == 0.0


class TestEstimateTokens:
    def test_basic(self):
        assert _estimate_tokens("hello world") >= 1

    def test_empty(self):
        assert _estimate_tokens("") == 1


# ── Integration tests: shaping pipeline ───────────────────────────────────


class TestContextShaper:
    def test_relevance_gate_filters_low_scores(self, shaper):
        chunks = [
            _make_chunk("c1", relevance=0.9),
            _make_chunk("c2", relevance=0.1),  # below threshold
            _make_chunk("c3", relevance=0.5),
        ]
        config = ShapingConfig(min_relevance=0.3)
        query_emb = _make_embedding(4, 1.0)
        chunk_embs = [_make_embedding(4, float(i)) for i in range(3)]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert result.chunks_received == 3
        assert result.chunks_after_gate == 2  # c2 filtered out

    def test_token_budget_enforced(self, shaper):
        # Each chunk ~100 tokens. Budget 150 → only 1 chunk fits
        chunks = [
            _make_chunk("c1", content="x " * 100, relevance=0.9),
            _make_chunk("c2", content="y " * 100, relevance=0.8),
        ]
        config = ShapingConfig(max_tokens=150, min_relevance=0.0)
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding(4, 1.0), _make_embedding(4, 2.0)]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert result.chunks_final <= 2
        assert result.total_tokens <= 150

    def test_max_chunks_limit(self, shaper):
        chunks = [_make_chunk(f"c{i}", relevance=0.9) for i in range(20)]
        config = ShapingConfig(max_chunks=5, min_relevance=0.0, max_tokens=100000)
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding(4, float(i)) for i in range(20)]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert result.chunks_after_mmr <= 5

    def test_empty_chunks(self, shaper):
        result = shaper.shape([], _make_embedding(), [], ShapingConfig())
        assert result.text == ""
        assert result.chunks_final == 0

    def test_plain_format(self, shaper):
        chunks = [
            _make_chunk("c1", content="First chunk.", relevance=0.9),
            _make_chunk("c2", content="Second chunk.", relevance=0.8),
        ]
        config = ShapingConfig(
            format=ContextFormat.PLAIN,
            min_relevance=0.0,
            max_tokens=10000,
        )
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding(4, 1.0), _make_embedding(4, 2.0)]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert "---" in result.text
        assert "First chunk." in result.text

    def test_numbered_format(self, shaper):
        chunks = [_make_chunk("c1", content="Hello.", relevance=0.9)]
        config = ShapingConfig(
            format=ContextFormat.NUMBERED,
            min_relevance=0.0,
            max_tokens=10000,
        )
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding()]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert result.text.startswith("[1]")

    def test_xml_format(self, shaper):
        chunks = [_make_chunk("c1", content="Data.", relevance=0.9)]
        config = ShapingConfig(
            format=ContextFormat.XML,
            min_relevance=0.0,
            max_tokens=10000,
        )
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding()]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert "<context>" in result.text
        assert "<chunk" in result.text

    def test_markdown_format(self, shaper):
        chunks = [
            _make_chunk("c1", content="Info.", relevance=0.9, metadata={"title": "Doc"}),
        ]
        config = ShapingConfig(
            format=ContextFormat.MARKDOWN,
            min_relevance=0.0,
            max_tokens=10000,
        )
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding()]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert "### Doc" in result.text

    def test_mmr_promotes_diversity(self, shaper):
        """Two identical chunks should not both be top-ranked."""
        # c1 and c2 have identical embeddings, c3 is different
        identical_emb = [1.0, 0.0, 0.0, 0.0]
        different_emb = [0.0, 1.0, 0.0, 0.0]

        chunks = [
            _make_chunk("c1", content="Same info A.", relevance=0.9),
            _make_chunk("c2", content="Same info B.", relevance=0.9),
            _make_chunk("c3", content="Different info.", relevance=0.7),
        ]
        config = ShapingConfig(
            diversity_weight=0.5, min_relevance=0.0, max_tokens=10000,
        )
        query_emb = [1.0, 0.5, 0.0, 0.0]
        chunk_embs = [identical_emb, identical_emb, different_emb]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        # c3 should appear in top results due to diversity
        used_ids = [c.chunk_id for c in result.chunks_used]
        assert "c3" in used_ids

    def test_shaped_context_stats(self, shaper):
        chunks = [_make_chunk(f"c{i}", relevance=0.5 + i * 0.1) for i in range(5)]
        config = ShapingConfig(min_relevance=0.3, max_tokens=10000)
        query_emb = _make_embedding()
        chunk_embs = [_make_embedding(4, float(i + 1)) for i in range(5)]

        result = shaper.shape(chunks, query_emb, chunk_embs, config)
        assert result.chunks_received == 5
        assert result.chunks_after_gate >= 1
        assert isinstance(result.config, ShapingConfig)
