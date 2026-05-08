"""
Context Shaping — post-retrieval, pre-agent context optimization.

Sits between the retrieval layer and the agent layer to ensure the
context window contains only high-relevance, non-redundant, properly
formatted knowledge — preventing context poisoning and maximizing
agent reasoning quality.

Pipeline:
    Retrieved chunks
      → Relevance Gate     (drop below dynamic threshold)
      → Diversity Reranker (MMR to reduce redundancy)
      → Token Budget       (trim to fit model context window)
      → Context Formatter  (structure for agent consumption)
      → Shaped context

Design Principles (from Architecture Blueprint):
    - Context Shaping: "filter, structure and reformat so the final
      context window reflects only the most relevant information"
    - Small World: scoped, goal-aligned representations
    - Context Isolation: precise, high-relevance context delivery

Architecture:
    ShapingConfig     — tuneable parameters for each stage
    ScoredChunk       — chunk with relevance + diversity scores
    ShapedContext      — final output consumed by the agent layer
    ContextShaper     — stateless pipeline, injected dependencies
"""

from __future__ import annotations

import collections.abc
import enum
import math
from collections.abc import Sequence

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class ContextFormat(enum.StrEnum):
    """Output format for the shaped context."""
    PLAIN = "plain"           # Concatenated text with separators
    NUMBERED = "numbered"     # Numbered citations: [1] chunk text ...
    XML = "xml"               # XML-tagged chunks with metadata
    MARKDOWN = "markdown"     # Markdown sections with headings


class ShapingConfig(pydantic.BaseModel):
    """
    Tuneable parameters for the context shaping pipeline.

    Defaults are calibrated for Gemini 2.0 Flash (1M context) with
    typical RAG workloads. Adjust per use case.
    """
    # Relevance gate
    min_relevance: float = pydantic.Field(
        0.35, ge=0.0, le=1.0,
        description="Drop chunks below this cosine similarity",
    )
    # Diversity (MMR)
    diversity_weight: float = pydantic.Field(
        0.3, ge=0.0, le=1.0,
        description="Lambda for MMR: 0=pure relevance, 1=pure diversity",
    )
    # Token budget
    max_tokens: int = pydantic.Field(
        4096, ge=128,
        description="Maximum tokens in shaped context",
    )
    max_chunks: int = pydantic.Field(
        15, ge=1,
        description="Maximum chunks to include",
    )
    # Formatting
    format: ContextFormat = ContextFormat.NUMBERED
    include_metadata: bool = True
    include_source_url: bool = False


class ScoredChunk(pydantic.BaseModel):
    """A retrieved chunk annotated with scoring metadata."""
    chunk_id: str
    document_id: str
    content: str
    relevance_score: float = 0.0       # cosine sim to query
    diversity_score: float = 0.0       # MMR diversity component
    combined_score: float = 0.0        # final ranking score
    token_count: int = 0
    metadata: dict = pydantic.Field(default_factory=dict)


class ShapedContext(pydantic.BaseModel):
    """
    The final shaped context delivered to the agent layer.

    Contains the formatted text, provenance trail, and shaping stats
    for observability and debugging.
    """
    text: str                                   # Formatted context string
    chunks_used: list[ScoredChunk] = pydantic.Field(default_factory=list)
    total_tokens: int = 0
    chunks_received: int = 0                    # Before filtering
    chunks_after_gate: int = 0                  # After relevance gate
    chunks_after_mmr: int = 0                   # After diversity reranking
    chunks_final: int = 0                       # After token budget
    config: ShapingConfig = pydantic.Field(default_factory=ShapingConfig)


# ═══════════════════════════════════════════════════════════════════════════════
# Vector math — pure functions
# ═══════════════════════════════════════════════════════════════════════════════


def _cosine_sim(a: collections.abc.Sequence[float], b: collections.abc.Sequence[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
    na: float = math.sqrt(sum(x * x for x in a))
    nb: float = math.sqrt(sum(x * x for x in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return max(0.0, min(1.0, dot / (na * nb)))


def _estimate_tokens(text: str) -> int:
    """Approximate token count (~4 chars/token for English)."""
    return max(1, len(text) // 4)


# ═══════════════════════════════════════════════════════════════════════════════
# Context Shaper — the shaping pipeline
# ═══════════════════════════════════════════════════════════════════════════════


class ContextShaper:
    """
    Stateless context shaping pipeline.

    Takes raw retrieval results and produces an optimized context window
    for agent consumption. Each stage is a pure transformation.

    Usage:
        shaper = ContextShaper()
        shaped = shaper.shape(
            chunks=scored_chunks,
            query_embedding=q_emb,
            chunk_embeddings=c_embs,
            config=ShapingConfig(max_tokens=2048),
        )
    """

    def shape(
        self,
        chunks: list[ScoredChunk],
        query_embedding: collections.abc.Sequence[float],
        chunk_embeddings: list[collections.abc.Sequence[float]],
        config: ShapingConfig | None = None,
    ) -> ShapedContext:
        """
        Run the full shaping pipeline.

        Args:
            chunks: Retrieved chunks with relevance_score pre-populated.
            query_embedding: The query's embedding vector.
            chunk_embeddings: Embedding for each chunk (parallel to chunks list).
            config: Shaping parameters. Uses defaults if None.
        """
        cfg: ShapingConfig = config or ShapingConfig()
        received: int = len(chunks)

        # Stage 1: Relevance gate
        gated: list[ScoredChunk] = self._relevance_gate(chunks, cfg.min_relevance)
        after_gate: int = len(gated)

        # Stage 2: Diversity reranking (MMR)
        embeddings_map: dict[str, Sequence[float]] = {
            c.chunk_id: emb
            for c, emb in zip(chunks, chunk_embeddings, strict=False)
        }
        reranked: list[ScoredChunk] = self._mmr_rerank(
            gated, query_embedding, embeddings_map,
            lam=1.0 - cfg.diversity_weight,
            max_results=cfg.max_chunks,
        )
        after_mmr: int = len(reranked)

        # Stage 3: Token budget
        budgeted: list[ScoredChunk] = self._apply_token_budget(reranked, cfg.max_tokens)
        total_tokens: int = sum(c.token_count for c in budgeted)

        # Stage 4: Format
        text: str = self._format(budgeted, cfg)

        return ShapedContext(
            text=text,
            chunks_used=budgeted,
            total_tokens=total_tokens,
            chunks_received=received,
            chunks_after_gate=after_gate,
            chunks_after_mmr=after_mmr,
            chunks_final=len(budgeted),
            config=cfg,
        )

    # ── Stage 1: Relevance Gate ────────────────────────────────────────────

    @staticmethod
    def _relevance_gate(
        chunks: list[ScoredChunk],
        threshold: float,
    ) -> list[ScoredChunk]:
        """Drop chunks below the relevance threshold."""
        return [c for c in chunks if c.relevance_score >= threshold]

    # ── Stage 2: MMR Diversity Reranking ───────────────────────────────────

    @staticmethod
    def _mmr_rerank(
        chunks: list[ScoredChunk],
        query_embedding: collections.abc.Sequence[float],
        embeddings: dict[str, collections.abc.Sequence[float]],
        lam: float = 0.7,
        max_results: int = 15,
    ) -> list[ScoredChunk]:
        """
        Maximal Marginal Relevance reranking.

        Balances relevance (similarity to query) with diversity
        (dissimilarity to already-selected chunks).

        lam: weight for relevance. (1 - lam) = weight for diversity.
        """
        if not chunks:
            return []

        remaining: list[ScoredChunk] = list(chunks)
        selected: list[ScoredChunk] = []
        selected_embs: list[collections.abc.Sequence[float]] = []

        while remaining and len(selected) < max_results:
            best_score: float = -1.0
            best_idx = 0

            for i, candidate in enumerate(remaining):
                c_emb: Sequence[float] = embeddings.get(candidate.chunk_id, [])
                if not c_emb:
                    continue

                relevance: float = _cosine_sim(query_embedding, c_emb)

                # Max similarity to any already-selected chunk
                max_sim_to_selected = 0.0
                for s_emb in selected_embs:
                    sim: float = _cosine_sim(c_emb, s_emb)
                    if sim > max_sim_to_selected:
                        max_sim_to_selected: float = sim

                mmr: float = lam * relevance - (1.0 - lam) * max_sim_to_selected

                if mmr > best_score:
                    best_score: float = mmr
                    best_idx: int = i

            winner: ScoredChunk = remaining.pop(best_idx)
            winner.diversity_score = round(best_score, 4)
            winner.combined_score = round(best_score, 4)
            selected.append(winner)
            w_emb: Sequence[float] = embeddings.get(winner.chunk_id, [])
            if w_emb:
                selected_embs.append(w_emb)

        return selected

    # ── Stage 3: Token Budget ──────────────────────────────────────────────

    @staticmethod
    def _apply_token_budget(
        chunks: list[ScoredChunk],
        max_tokens: int,
    ) -> list[ScoredChunk]:
        """Include chunks in rank order until the token budget is exhausted."""
        result: list[ScoredChunk] = []
        total = 0
        for chunk in chunks:
            tokens: int = chunk.token_count or _estimate_tokens(chunk.content)
            chunk.token_count = tokens
            if total + tokens > max_tokens:
                break
            result.append(chunk)
            total += tokens
        return result

    # ── Stage 4: Formatting ────────────────────────────────────────────────

    @staticmethod
    def _format(chunks: list[ScoredChunk], cfg: ShapingConfig) -> str:
        """Format chunks into the requested output format."""
        if not chunks:
            return ""

        if cfg.format == ContextFormat.NUMBERED:
            lines: list[str] = []
            for i, c in enumerate(chunks, 1):
                header: str = f"[{i}]"
                if cfg.include_metadata and c.metadata.get("title"):
                    header += f" ({c.metadata['title']})"
                lines.append(f"{header} {c.content}")
            return "\n\n".join(lines)

        if cfg.format == ContextFormat.XML:
            parts: list[str] = ["<context>"]
            for i, c in enumerate(chunks, 1):
                attrs: str = f' id="{i}" relevance="{c.relevance_score:.2f}"'
                if cfg.include_metadata and c.metadata.get("title"):
                    attrs += f' source="{c.metadata["title"]}"'
                parts.append(f"  <chunk{attrs}>{c.content}</chunk>")
            parts.append("</context>")
            return "\n".join(parts)

        if cfg.format == ContextFormat.MARKDOWN:
            sections: list[str] = []
            for i, c in enumerate(chunks, 1):
                title = (
                    c.metadata.get("title", f"Source {i}")
                    if cfg.include_metadata
                    else f"Source {i}"
                )
                sections.append(f"### {title}\n\n{c.content}")
            return "\n\n---\n\n".join(sections)

        # PLAIN
        return "\n\n---\n\n".join(c.content for c in chunks)
