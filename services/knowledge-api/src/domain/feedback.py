"""
Feedback Loop — close the retrieval quality flywheel.

When users give thumbs-up/down on agent responses, this module updates
chunk relevance scores in the vector store so future retrievals are
boosted or penalized.

Flow:
    User thumbs-up → BFF tRPC → knowledge-api POST /v1/feedback
        → update chunk scores in AlloyDB
        → record feedback event for analytics

Scoring model:
    Each chunk has a `feedback_score` column (default 0.0).
    - Thumbs up on a response with citations:  +0.05 per cited chunk
    - Thumbs down:                              -0.03 per cited chunk
    Scores are clamped to [-1.0, 1.0].
    The search query uses `score + feedback_score * 0.1` for ranking.

This creates a reinforcement loop: good chunks get surfaced more,
bad chunks get demoted, and the knowledge base self-improves.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from src.core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class FeedbackRequest(BaseModel):
    """Inbound feedback from the BFF."""

    message_id: str
    conversation_id: str
    feedback_type: str  # "up" | "down"
    chunk_ids: list[str] = Field(default_factory=list)
    query: str = ""
    user_id: str = ""
    org_id: str = "default"


class FeedbackRecord(BaseModel):
    """Persisted feedback event for analytics."""

    id: str
    message_id: str
    conversation_id: str
    feedback_type: str
    chunk_ids: list[str]
    query: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class FeedbackResponse(BaseModel):
    """Response after processing feedback."""

    processed: bool = True
    chunks_updated: int = 0
    message: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# Feedback Processor
# ═══════════════════════════════════════════════════════════════════════════════

# Score adjustments per feedback type
_SCORE_DELTAS = {
    "up": 0.05,
    "down": -0.03,
}

# Absolute bounds for feedback scores
_MIN_SCORE = -1.0
_MAX_SCORE = 1.0


class FeedbackProcessor:
    """
    Processes user feedback and updates chunk relevance scores.

    Requires a vector store adapter that supports update_chunk_score().
    Falls back to logging-only mode if the store doesn't support scoring.
    """

    def __init__(self, vector_store: Any) -> None:
        self._store = vector_store

    async def process(
        self,
        feedback: FeedbackRequest,
    ) -> FeedbackResponse:
        """
        Process a feedback event.

        1. Validate the feedback type
        2. Compute score delta
        3. Update each cited chunk's feedback_score
        4. Log the event for analytics
        """
        delta = _SCORE_DELTAS.get(feedback.feedback_type)
        if delta is None:
            return FeedbackResponse(
                processed=False,
                message=f"Unknown feedback type: {feedback.feedback_type}",
            )

        if not feedback.chunk_ids:
            logger.info(
                "Feedback received but no chunks to update",
                extra={
                    "message_id": feedback.message_id,
                    "type": feedback.feedback_type,
                },
            )
            return FeedbackResponse(
                processed=True,
                chunks_updated=0,
                message="No chunks to update",
            )

        updated = 0
        for chunk_id in feedback.chunk_ids:
            try:
                success = await self._update_chunk_score(
                    chunk_id,
                    delta,
                )
                if success:
                    updated += 1
            except Exception as exc:
                logger.warning(
                    "Failed to update chunk score",
                    extra={
                        "chunk_id": chunk_id,
                        "error": str(exc),
                    },
                )

        logger.info(
            "Feedback processed",
            extra={
                "message_id": feedback.message_id,
                "type": feedback.feedback_type,
                "chunks_updated": updated,
                "total_chunks": len(feedback.chunk_ids),
                "query": feedback.query[:100],
            },
        )

        return FeedbackResponse(
            processed=True,
            chunks_updated=updated,
            message=f"Updated {updated}/{len(feedback.chunk_ids)} chunks",
        )

    async def _update_chunk_score(
        self,
        chunk_id: str,
        delta: float,
    ) -> bool:
        """
        Update a chunk's feedback score in the vector store.

        Uses atomic increment if available, otherwise read-modify-write.
        """
        # Try the atomic update path (AlloyDB adapter)
        if hasattr(self._store, "update_feedback_score"):
            await self._store.update_feedback_score(
                chunk_id=chunk_id,
                delta=delta,
                min_score=_MIN_SCORE,
                max_score=_MAX_SCORE,
            )
            return True

        # Fallback: log-only mode for stores without scoring
        logger.debug(
            "Store does not support feedback scoring",
            extra={"chunk_id": chunk_id, "delta": delta},
        )
        return False
