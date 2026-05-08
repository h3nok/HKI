"""
VectorStoreProtocol — structural typing contract for knowledge-api vector stores.

Both ``VectorStore`` (in-memory) and ``AlloyDBVectorStore`` satisfy this
protocol via duck-typing.  Route handlers and domain functions should
annotate their store parameter as ``VectorStoreProtocol`` so that either
backend can be swapped in transparently.

Lifecycle methods (``connect`` / ``close``) are intentionally excluded
because they are backend-specific and only the lifespan cares about them.
"""

from __future__ import annotations

import typing

import src.domain.models


@typing.runtime_checkable
class VectorStoreProtocol(typing.Protocol):
    """Structural interface implemented by every vector-store backend."""

    # ``allowed_streams`` semantics:
    # - ``None`` means an unscoped admin or migration code path
    # - otherwise only documents with ``stream_id`` in the list are accessible

    # ── Documents ─────────────────────────────────────────────────────────

    async def store_document(
        self, document: src.domain.models.Document, chunks: list[src.domain.models.Chunk]
    ) -> str:
        """Persist a document and its chunks.  Returns the document ID."""
        ...

    async def get_document(
        self,
        document_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.Document | None:
        """Retrieve a single document by ID, or ``None`` if missing."""
        ...

    async def list_documents(
        self,
        limit: int = 50,
        offset: int = 0,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> tuple[list[src.domain.models.Document], int]:
        """Paginated document listing.  Returns ``(docs, total)``."""
        ...

    async def document_inventory_summary(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.DocumentInventorySummary:
        """Return aggregated inventory metrics for dashboard surfaces."""
        ...

    async def delete_document(
        self,
        document_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Delete a document and its chunks.  Returns success flag."""
        ...

    async def update_document_status(
        self,
        document_id: str,
        status: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Change the status field of a document."""
        ...

    async def update_document_metadata(
        self,
        document_id: str,
        metadata_dict: dict,
        org_id: str = "default",  # type: ignore[type-arg]
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> bool:
        """Merge *metadata_dict* into the document's existing metadata."""
        ...

    # ── Chunks ────────────────────────────────────────────────────────────

    async def get_chunk(
        self,
        chunk_id: str,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.Chunk | None:
        """Retrieve a single chunk by ID."""
        ...

    # ── Search ────────────────────────────────────────────────────────────

    async def search(
        self, query: src.domain.models.SearchQuery, query_embedding: list[float] | None = None
    ) -> src.domain.models.SearchResponse:
        """Execute a vector / keyword / hybrid search."""
        ...

    # ── Graph ─────────────────────────────────────────────────────────────

    async def get_neighbors(
        self,
        chunk_id: str,
        max_depth: int = 1,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> src.domain.models.GraphNeighbors:
        """Return graph-neighbor chunks for the knowledge graph view."""
        ...

    # ── Tags ──────────────────────────────────────────────────────────────

    async def list_tags(
        self,
        org_id: str = "default",
        allowed_streams: list[str] | None = None,
        user_id: str | None = None,
        principals: list[str] | None = None,
    ) -> list[str]:
        """Return distinct tag values across all documents."""
        ...

    # ── Stats ─────────────────────────────────────────────────────────────

    def stats(self) -> dict[str, typing.Any]:
        """Return aggregate store statistics (sync)."""
        ...
