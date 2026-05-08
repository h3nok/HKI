"""
Chunk-level Feedback Loop — trace bad answers back to source chunks.

When a user gives negative feedback on a generated answer, this module:
1. Records the feedback signal (up/down) for each contributing chunk
2. Aggregates chunk-level quality scores over time
3. Provides a score adjustment factor for search-time reranking

Architecture:
    Feedback signals are stored per (org_id, chunk_id). Over time,
    chunks with consistently negative feedback get deprioritized
    during search result reranking. This creates a virtuous feedback
    loop: bad content surfaces less, good content surfaces more.

Storage:
    In-memory for dev, AlloyDB chunk_feedback table in production.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from src.core.logging import logger


@dataclass
class FeedbackSignal:
    """A single feedback event tied to a chunk."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = "default"
    chunk_id: str = ""
    document_id: str = ""
    query: str = ""
    answer_snippet: str = ""
    signal: str = "down"  # "up" or "down"
    confidence: float = 0.0  # generation confidence at time of feedback
    eval_score: float = 0.0  # RAG eval overall score (if available)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class ChunkReputation:
    """Aggregated reputation for a single chunk."""

    chunk_id: str
    document_id: str = ""
    upvotes: int = 0
    downvotes: int = 0
    total_signals: int = 0
    reputation_score: float = 1.0  # 0.0–1.0, starts neutral at 1.0

    def compute_score(self) -> None:
        """Bayesian-smoothed reputation score."""
        # Prior: 2 virtual upvotes (assume chunks are ok until proven bad)
        prior_up = 2
        prior_total = 4
        effective_up = self.upvotes + prior_up
        effective_total = self.total_signals + prior_total
        self.reputation_score = round(effective_up / max(effective_total, 1), 4)


# ═══════════════════════════════════════════════════════════════════════════════
# Store Protocol
# ═══════════════════════════════════════════════════════════════════════════════


class FeedbackStore(Protocol):
    """Persistence interface for chunk feedback."""

    async def record(self, signal: FeedbackSignal) -> None: ...

    async def get_reputation(
        self,
        org_id: str,
        chunk_id: str,
    ) -> ChunkReputation | None: ...

    async def get_reputations(
        self,
        org_id: str,
        chunk_ids: list[str],
    ) -> dict[str, ChunkReputation]: ...

    async def get_flagged_chunks(
        self,
        org_id: str,
        threshold: float,
        limit: int,
    ) -> list[ChunkReputation]: ...


# ═══════════════════════════════════════════════════════════════════════════════
# In-Memory Store (development)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryFeedbackStore:
    """In-memory feedback store for local dev."""

    def __init__(self) -> None:
        self._signals: list[FeedbackSignal] = []
        # (org_id, chunk_id) → ChunkReputation
        self._reputations: dict[tuple[str, str], ChunkReputation] = {}

    async def record(self, signal: FeedbackSignal) -> None:
        self._signals.append(signal)
        key = (signal.org_id, signal.chunk_id)
        rep = self._reputations.get(key)
        if not rep:
            rep = ChunkReputation(
                chunk_id=signal.chunk_id,
                document_id=signal.document_id,
            )
            self._reputations[key] = rep

        if signal.signal == "up":
            rep.upvotes += 1
        else:
            rep.downvotes += 1
        rep.total_signals += 1
        rep.compute_score()

    async def get_reputation(
        self,
        org_id: str,
        chunk_id: str,
    ) -> ChunkReputation | None:
        return self._reputations.get((org_id, chunk_id))

    async def get_reputations(
        self,
        org_id: str,
        chunk_ids: list[str],
    ) -> dict[str, ChunkReputation]:
        result = {}
        for cid in chunk_ids:
            rep = self._reputations.get((org_id, cid))
            if rep:
                result[cid] = rep
        return result

    async def get_flagged_chunks(
        self,
        org_id: str,
        threshold: float = 0.4,
        limit: int = 50,
    ) -> list[ChunkReputation]:
        flagged = [
            rep
            for (oid, _), rep in self._reputations.items()
            if oid == org_id and rep.reputation_score < threshold
        ]
        flagged.sort(key=lambda r: r.reputation_score)
        return flagged[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# Feedback Processor — business logic
# ═══════════════════════════════════════════════════════════════════════════════


class FeedbackProcessor:
    """
    Records feedback and computes chunk reputations.

    Usage:
        processor = FeedbackProcessor(store=feedback_store)
        await processor.record_feedback(
            org_id="hki",
            signal="down",
            query="...",
            answer="...",
            chunk_ids=["chunk-1", "chunk-2"],
            confidence=0.85,
        )
        adjustments = await processor.get_score_adjustments(
            org_id="hki",
            chunk_ids=["chunk-1", "chunk-2"],
        )
    """

    def __init__(self, store: FeedbackStore) -> None:
        self._store = store

    async def record_feedback(
        self,
        org_id: str,
        signal: str,
        query: str,
        answer: str,
        chunk_ids: list[str],
        document_ids: list[str] | None = None,
        confidence: float = 0.0,
        eval_score: float = 0.0,
    ) -> int:
        """
        Record feedback for all chunks that contributed to an answer.

        Returns number of signals recorded.
        """
        doc_ids = document_ids or [""] * len(chunk_ids)
        count = 0
        for i, cid in enumerate(chunk_ids):
            sig = FeedbackSignal(
                org_id=org_id,
                chunk_id=cid,
                document_id=doc_ids[i] if i < len(doc_ids) else "",
                query=query,
                answer_snippet=answer[:200],
                signal=signal,
                confidence=confidence,
                eval_score=eval_score,
            )
            await self._store.record(sig)
            count += 1

        logger.info(
            "Chunk feedback recorded",
            extra={
                "org_id": org_id,
                "signal": signal,
                "chunks": count,
                "query_preview": query[:80],
            },
        )
        return count

    async def get_score_adjustments(
        self,
        org_id: str,
        chunk_ids: list[str],
    ) -> dict[str, float]:
        """
        Get reputation-based score adjustment factors for chunks.

        Returns a dict of chunk_id → multiplier (0.0–1.0).
        Chunks with no feedback get 1.0 (no adjustment).
        """
        reps = await self._store.get_reputations(org_id, chunk_ids)
        return {cid: reps[cid].reputation_score if cid in reps else 1.0 for cid in chunk_ids}

    async def get_flagged_chunks(
        self,
        org_id: str,
        threshold: float = 0.4,
        limit: int = 50,
    ) -> list[ChunkReputation]:
        """Return chunks with reputation below the threshold."""
        return await self._store.get_flagged_chunks(org_id, threshold, limit)
