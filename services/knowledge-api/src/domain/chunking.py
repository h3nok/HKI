"""
Chunking Strategies — text segmentation for embedding.

Provides multiple chunking strategies for splitting documents into
segments suitable for embedding and retrieval. Each strategy produces
Chunk objects with position tracking for citation reconstruction.

Strategies:
    FixedSizeChunker     — Split by token count with overlap
    SentenceChunker      — Split on sentence boundaries (preserves meaning)
    SlidingWindowChunker — Overlapping windows for maximum recall

Usage:
    chunker = SentenceChunker(target_size=512, overlap=64)
    chunks = chunker.chunk(document_id="abc", text="...", metadata={})
"""

from __future__ import annotations

import abc
import re
import uuid
from typing import Any

import src.domain.models


class BaseChunker(abc.ABC):
    """
    Abstract base class for text chunking strategies.

    All chunkers produce a list of Chunk objects from raw text,
    preserving position information for citation extraction.
    """

    def __init__(self, target_size: int = 512, overlap: int = 64) -> None:
        """
        Args:
            target_size: Target number of tokens per chunk.
            overlap: Number of overlapping tokens between consecutive chunks.
        """
        self.target_size: int = target_size
        self.overlap: int = overlap

    @abc.abstractmethod
    def chunk(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        """Split text into chunks."""
        ...

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """
        Rough token count estimation (~4 chars per token for English).
        In production, use tiktoken or the model's actual tokenizer.
        """
        return max(1, len(text) // 4)


class FixedSizeChunker(BaseChunker):
    """
    Split text into fixed-size chunks by approximate token count.

    Simple and fast. Splits on word boundaries to avoid breaking words.
    Good for: uniform chunk sizes, predictable memory usage.
    Bad for: may split mid-sentence, losing semantic coherence.
    """

    def chunk(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        metadata = metadata or {}
        words: list[str] = text.split()
        # Approximate words per chunk (assuming ~1.3 tokens per word)
        words_per_chunk = int(self.target_size / 1.3)
        overlap_words = int(self.overlap / 1.3)

        chunks: list[src.domain.models.Chunk] = []
        pos = 0
        char_offset = 0

        while pos < len(words):
            end: int = min(pos + words_per_chunk, len(words))
            chunk_words: list[str] = words[pos:end]
            chunk_text: str = " ".join(chunk_words)

            # Calculate character offsets in original text
            start_char: int = text.find(chunk_words[0], char_offset) if chunk_words else char_offset
            end_char: int = start_char + len(chunk_text)

            chunks.append(
                src.domain.models.Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    content=chunk_text,
                    position=len(chunks),
                    start_char=start_char,
                    end_char=end_char,
                    token_count=self._estimate_tokens(chunk_text),
                    metadata={**metadata, "strategy": "fixed_size"},
                )
            )

            # Advance with overlap
            pos: int = end - overlap_words if end < len(words) else end
            char_offset: int = start_char

        return chunks


class SentenceChunker(BaseChunker):
    """
    Split text on sentence boundaries, grouping sentences until the
    target chunk size is reached.

    Preserves semantic coherence by never breaking mid-sentence.
    Good for: policies, SOPs, FAQs where sentence integrity matters.
    Recommended as the default strategy.
    """

    def chunk(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        metadata = metadata or {}
        # Split on sentence boundaries (period, exclamation, question mark)
        sentences: list[str | Any] = re.split(r"(?<=[.!?])\s+", text)
        sentences: list[str | Any] = [s.strip() for s in sentences if s.strip()]

        chunks: list[src.domain.models.Chunk] = []
        current_sentences: list[str] = []
        current_tokens = 0
        char_offset = 0

        for sentence in sentences:
            sentence_tokens: int = self._estimate_tokens(sentence)

            # If adding this sentence would exceed target, finalize current chunk
            if current_tokens + sentence_tokens > self.target_size and current_sentences:
                chunk_text: str = " ".join(current_sentences)
                start_char: int = text.find(current_sentences[0], char_offset)
                if start_char == -1:
                    start_char: int = char_offset

                chunks.append(
                    src.domain.models.Chunk(
                        id=str(uuid.uuid4()),
                        document_id=document_id,
                        content=chunk_text,
                        position=len(chunks),
                        start_char=start_char,
                        end_char=start_char + len(chunk_text),
                        token_count=current_tokens,
                        metadata={**metadata, "strategy": "sentence"},
                    )
                )

                # Keep last N sentences for overlap
                overlap_tokens = 0
                overlap_sentences: list[str] = []
                for s in reversed(current_sentences):
                    s_tokens: int = self._estimate_tokens(s)
                    if overlap_tokens + s_tokens > self.overlap:
                        break
                    overlap_sentences.insert(0, s)
                    overlap_tokens += s_tokens

                current_sentences = overlap_sentences
                current_tokens: int = overlap_tokens
                char_offset: int = start_char

            current_sentences.append(sentence)
            current_tokens += sentence_tokens

        # Finalize last chunk
        if current_sentences:
            chunk_text: str = " ".join(current_sentences)
            start_char: int = text.find(current_sentences[0], char_offset)
            if start_char == -1:
                start_char: int = char_offset

            chunks.append(
                src.domain.models.Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    content=chunk_text,
                    position=len(chunks),
                    start_char=start_char,
                    end_char=start_char + len(chunk_text),
                    token_count=current_tokens,
                    metadata={**metadata, "strategy": "sentence"},
                )
            )

        return chunks


class SlidingWindowChunker(BaseChunker):
    """
    Sliding window chunker with configurable stride.

    Creates overlapping windows of text for maximum recall at the cost
    of redundancy. Every position in the text appears in multiple chunks.

    Good for: maximizing recall, dense documents where context spans pages.
    Bad for: higher storage cost (2–3x more chunks than sentence chunking).
    """

    def __init__(self, target_size: int = 512, overlap: int = 256) -> None:
        """
        Note: overlap for sliding window is typically 50% of target_size,
        much higher than sentence chunking.
        """
        super().__init__(target_size=target_size, overlap=overlap)

    def chunk(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        metadata = metadata or {}
        words: list[str] = text.split()
        words_per_chunk = int(self.target_size / 1.3)
        stride: int = max(1, words_per_chunk - int(self.overlap / 1.3))

        chunks: list[src.domain.models.Chunk] = []
        pos = 0

        while pos < len(words):
            end: int = min(pos + words_per_chunk, len(words))
            chunk_words: list[str] = words[pos:end]
            chunk_text: str = " ".join(chunk_words)

            start_char: int = text.find(chunk_words[0], 0) if chunk_words else 0

            chunks.append(
                src.domain.models.Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    content=chunk_text,
                    position=len(chunks),
                    start_char=start_char,
                    end_char=start_char + len(chunk_text),
                    token_count=self._estimate_tokens(chunk_text),
                    metadata={**metadata, "strategy": "sliding_window"},
                )
            )

            if end >= len(words):
                break
            pos += stride

        return chunks


class SemanticChunker(BaseChunker):
    """
    Embedding-based semantic chunking with breakpoint detection.

    Splits text into sentences, embeds each sentence, then detects
    semantic shift points by measuring cosine distance between
    consecutive sentence embeddings. When the distance exceeds a
    percentile-based threshold, a chunk boundary is inserted.

    Requires an embedding function at construction time.

    Good for: documents with distinct topic sections, mixed-content docs.
    Bad for: very short documents, uniform content where every sentence
             is equally related (e.g., a single FAQ answer).
    """

    def __init__(
        self,
        target_size: int = 512,
        overlap: int = 64,
        breakpoint_percentile: float = 0.9,
        embed_fn: callable | None = None,
    ) -> None:
        super().__init__(target_size=target_size, overlap=overlap)
        self._percentile: float = breakpoint_percentile
        self._embed_fn = embed_fn  # async fn(texts: list[str]) -> list[list[float]]

    @staticmethod
    def _cosine_distance(
        a: list[float],
        b: list[float],
    ) -> float:
        """1 - cosine_similarity. Returns 0..2."""
        import math

        dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
        na: float = math.sqrt(sum(x * x for x in a))
        nb: float = math.sqrt(sum(x * x for x in b))
        if na == 0.0 or nb == 0.0:
            return 1.0
        sim: float = dot / (na * nb)
        return max(0.0, 1.0 - sim)

    def _find_breakpoints(
        self,
        distances: list[float],
    ) -> list[int]:
        """Find indices where semantic shift exceeds the threshold."""
        if not distances:
            return []
        sorted_d: list[float] = sorted(distances)
        idx = int(len(sorted_d) * self._percentile)
        idx: int = min(idx, len(sorted_d) - 1)
        threshold: float = sorted_d[idx]
        return [i for i, d in enumerate(distances) if d >= threshold]

    def chunk(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        """
        Synchronous fallback: split on sentences, group by target size.

        For real semantic chunking, use chunk_async() which embeds
        sentences and detects breakpoints.
        """
        # Fall back to sentence chunking if no embeddings available
        fallback = SentenceChunker(
            target_size=self.target_size,
            overlap=self.overlap,
        )
        chunks = fallback.chunk(document_id, text, metadata)
        for c in chunks:
            c.metadata = {**(c.metadata or {}), "strategy": "semantic_fallback"}
        return chunks

    async def chunk_async(
        self,
        document_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> list[src.domain.models.Chunk]:
        """
        Async semantic chunking with embedding-based breakpoint detection.

        Steps:
            1. Split text into sentences
            2. Embed all sentences in batch
            3. Compute cosine distance between consecutive sentences
            4. Detect breakpoints (semantic shifts)
            5. Group sentences between breakpoints into chunks
            6. Merge small chunks into neighbors
        """
        metadata = metadata or {}

        if not self._embed_fn:
            return self.chunk(document_id, text, metadata)

        sentences: list[str | Any] = re.split(r"(?<=[.!?])\s+", text)
        sentences: list[str | Any] = [s.strip() for s in sentences if s.strip()]

        if len(sentences) <= 1:
            return [
                src.domain.models.Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    content=text,
                    position=0,
                    start_char=0,
                    end_char=len(text),
                    token_count=self._estimate_tokens(text),
                    metadata={**metadata, "strategy": "semantic"},
                )
            ]

        # Embed all sentences
        embeddings = await self._embed_fn(sentences)

        # Compute distances between consecutive sentences
        distances: list[float] = [
            self._cosine_distance(embeddings[i], embeddings[i + 1])
            for i in range(len(embeddings) - 1)
        ]

        # Find breakpoints
        breakpoints: set[int] = set(self._find_breakpoints(distances))

        # Group sentences into chunks at breakpoints
        groups: list[list[str]] = [[]]
        for i, sentence in enumerate(sentences):
            groups[-1].append(sentence)
            if i in breakpoints and i < len(sentences) - 1:
                groups.append([])

        # Merge small groups (under 25% of target size)
        min_tokens: int = self.target_size // 4
        merged: list[list[str]] = []
        for group in groups:
            group_text: str = " ".join(group)
            group_tokens: int = self._estimate_tokens(group_text)
            if merged and group_tokens < min_tokens:
                merged[-1].extend(group)
            else:
                merged.append(group)

        # Build Chunk objects
        chunks: list[src.domain.models.Chunk] = []
        char_offset = 0
        for group in merged:
            chunk_text: str = " ".join(group)
            start_char: int = text.find(group[0], char_offset)
            if start_char == -1:
                start_char: int = char_offset

            chunks.append(
                src.domain.models.Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    content=chunk_text,
                    position=len(chunks),
                    start_char=start_char,
                    end_char=start_char + len(chunk_text),
                    token_count=self._estimate_tokens(chunk_text),
                    metadata={**metadata, "strategy": "semantic"},
                )
            )
            char_offset: int = start_char

        return chunks


# ═══════════════════════════════════════════════════════════════════════════════
# Factory
# ═══════════════════════════════════════════════════════════════════════════════

CHUNKERS: dict[str, type[BaseChunker]] = {
    "fixed": FixedSizeChunker,
    "sentence": SentenceChunker,
    "sliding_window": SlidingWindowChunker,
    "semantic": SemanticChunker,
}


def create_chunker(
    strategy: str = "sentence",
    target_size: int = 512,
    overlap: int = 64,
) -> BaseChunker:
    """
    Factory function to create a chunker by strategy name.

    Args:
        strategy: One of "fixed", "sentence", "sliding_window"
        target_size: Target tokens per chunk
        overlap: Token overlap between chunks

    Returns:
        Configured chunker instance.
    """
    cls: type[BaseChunker] = CHUNKERS.get(strategy, SentenceChunker)
    return cls(target_size=target_size, overlap=overlap)
