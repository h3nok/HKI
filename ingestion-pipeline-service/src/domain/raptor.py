"""
RAPTOR — Recursive Abstractive Processing for Tree-Organized Retrieval.

Implements hierarchical summarization of knowledge chunks:
    1. Cluster related chunks using embedding similarity
    2. Summarize each cluster with Gemini
    3. Embed the summaries as new "level 1" chunks
    4. Repeat recursively to build a summary tree

This enables multi-resolution retrieval: precise answers from leaf chunks
and high-level overviews from summary chunks.

Reference: RAPTOR paper (Sarthi et al., 2024)

Architecture:
    Leaf chunks (level 0)
      → Cluster (k-means on embeddings)
      → Summarize per cluster (Gemini)
      → Embed summaries → Store as level 1 chunks
      → Cluster level 1 → Summarize → level 2 chunks
      → ... until single root summary

Usage:
    builder = RaptorBuilder(
        knowledge_api_url="...",
        gemini_client=gemini,
        embedding_client=embedder,
    )
    report = await builder.build(org_id="default", max_levels=3)
"""

from __future__ import annotations

import math
import random
import typing
import uuid

import httpx
import pydantic
import shared.http_client

import src.core.logging

create_service_client: typing.Callable[..., httpx.AsyncClient] = (
    shared.http_client.create_service_client
)

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class RaptorCluster(pydantic.BaseModel):
    """A cluster of related chunks at a given level."""

    cluster_id: str
    level: int
    chunk_ids: list[str] = pydantic.Field(default_factory=list)
    summary: str = ""
    summary_chunk_id: str = ""
    centroid: list[float] = pydantic.Field(default_factory=list)


class RaptorReport(pydantic.BaseModel):
    """Report from a RAPTOR build run."""

    org_id: str = "default"
    levels_built: int = 0
    clusters_per_level: dict[int, int] = pydantic.Field(default_factory=dict)
    summaries_created: int = 0
    duration_ms: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Clustering
# ═══════════════════════════════════════════════════════════════════════════════


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
    na: float = math.sqrt(sum(x * x for x in a))
    nb: float = math.sqrt(sum(x * x for x in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def _kmeans_cluster(
    embeddings: list[list[float]],
    k: int,
    max_iterations: int = 20,
) -> list[list[int]]:
    """
    Simple k-means clustering on embedding vectors.

    Returns list of k clusters, each containing indices into
    the embeddings list.
    """
    if not embeddings or k <= 0:
        return []

    n: int = len(embeddings)
    dim: int = len(embeddings[0])
    k = min(k, n)

    # Initialize centroids randomly
    indices: list[int] = random.sample(range(n), k)
    centroids: list[list[float]] = [list(embeddings[i]) for i in indices]

    assignments: list[int] = [0] * n

    for _ in range(max_iterations):
        # Assign each point to nearest centroid
        new_assignments = []
        for emb in embeddings:
            best_c = 0
            best_sim: float = -1.0
            for c_idx, centroid in enumerate(centroids):
                sim: float = _cosine_sim(emb, centroid)
                if sim > best_sim:
                    best_sim: float = sim
                    best_c: int = c_idx
            new_assignments.append(best_c)

        if new_assignments == assignments:
            break
        assignments = new_assignments

        # Recompute centroids
        for c_idx in range(k):
            members: list[list[float]] = [
                embeddings[i] for i in range(n) if assignments[i] == c_idx
            ]
            if members:
                centroids[c_idx] = [
                    sum(member[d] for member in members) / len(members)
                    for d in range(dim)
                ]

    # Build cluster lists
    clusters: list[list[int]] = [[] for _ in range(k)]
    for i, c in enumerate(assignments):
        clusters[c].append(i)

    # Remove empty clusters
    return [cluster for cluster in clusters if cluster]


# ═══════════════════════════════════════════════════════════════════════════════
# RAPTOR Builder
# ═══════════════════════════════════════════════════════════════════════════════


class RaptorBuilder:
    """
    Builds a RAPTOR summary tree from knowledge base chunks.

    Requires:
    - knowledge_api_url: For fetching chunks and storing summaries
    - gemini_client: For generating summaries (with generate() method)
    - embedding_client: For embedding summaries (with embed_batch())
    """

    def __init__(
        self,
        knowledge_api_url: str = "http://localhost:9509",
        gemini_client: typing.Any = None,
        embedding_client: typing.Any = None,
        target_cluster_size: int = 10,
    ) -> None:
        self._api_url: str = knowledge_api_url.rstrip("/")
        self._gemini = gemini_client
        self._embedder = embedding_client
        self._cluster_size: int = target_cluster_size

    async def build(
        self,
        org_id: str = "default",
        max_levels: int = 3,
    ) -> RaptorReport:
        """
        Build the RAPTOR summary tree.

        1. Fetch all leaf chunks with embeddings
        2. For each level: cluster → summarize → embed → store
        3. Use the new summary chunks as input for the next level
        """
        import time

        start: float = time.perf_counter()
        report = RaptorReport(org_id=org_id)

        # Fetch leaf chunks
        chunks: list[dict[str, typing.Any]] = await self._fetch_chunks(org_id)
        if not chunks:
            src.core.logging.logger.info("No chunks to build RAPTOR tree from")
            return report

        current_level_chunks: list[dict[str, typing.Any]] = chunks
        for level in range(1, max_levels + 1):
            if len(current_level_chunks) <= 1:
                break

            # Determine number of clusters
            k: int = max(
                2,
                len(current_level_chunks) // self._cluster_size,
            )

            # Extract embeddings
            embeddings: list[typing.Any] = [
                chunk.get("embedding", []) for chunk in current_level_chunks
            ]
            if not embeddings or not embeddings[0]:
                src.core.logging.logger.warning(
                    "No embeddings available for clustering",
                    extra={"level": level},
                )
                break

            # Cluster
            cluster_indices: list[list[int]] = _kmeans_cluster(embeddings, k)
            report.clusters_per_level[level] = len(cluster_indices)

            # Summarize each cluster
            next_level_chunks = []
            for _cluster_idx, indices in enumerate(cluster_indices):
                cluster_texts: list[typing.Any] = [
                    current_level_chunks[i].get("content", "") for i in indices
                ]
                cluster_ids: list[typing.Any] = [
                    current_level_chunks[i].get("chunk_id", "") for i in indices
                ]

                # Generate summary
                summary: str = await self._summarize_cluster(
                    cluster_texts,
                    level,
                )
                if not summary:
                    continue

                # Embed summary
                summary_embedding: list[float] = await self._embed_text(summary)

                # Store as a new chunk
                summary_chunk_id = str(uuid.uuid4())
                await self._store_summary_chunk(
                    chunk_id=summary_chunk_id,
                    content=summary,
                    embedding=summary_embedding,
                    org_id=org_id,
                    level=level,
                    source_chunk_ids=cluster_ids,
                )

                report.summaries_created += 1
                next_level_chunks.append(
                    {
                        "chunk_id": summary_chunk_id,
                        "content": summary,
                        "embedding": summary_embedding,
                    }
                )

            current_level_chunks = next_level_chunks
            report.levels_built = level

            src.core.logging.logger.info(
                f"RAPTOR level {level} complete",
                extra={
                    "clusters": len(cluster_indices),
                    "summaries": len(next_level_chunks),
                },
            )

        report.duration_ms = (time.perf_counter() - start) * 1000

        src.core.logging.logger.info(
            "RAPTOR build complete",
            extra={
                "levels": report.levels_built,
                "summaries": report.summaries_created,
                "duration_ms": round(report.duration_ms, 1),
            },
        )

        return report

    async def _fetch_chunks(
        self,
        org_id: str,
    ) -> list[dict[str, typing.Any]]:
        """Fetch all chunks with embeddings from the knowledge API."""
        try:
            async with create_service_client(
                "pipeline-raptor", timeout=30.0
            ) as client:
                resp: httpx.Response = await client.get(
                    f"{self._api_url}/v1/chunks",
                    params={"org_id": org_id, "include_embeddings": True},
                )
                if resp.status_code == 200:
                    return resp.json().get("chunks", [])
                return []
        except Exception as exc:
            src.core.logging.logger.warning(
                "Failed to fetch chunks for RAPTOR",
                extra={"error": str(exc)},
            )
            return []

    async def _summarize_cluster(
        self,
        texts: list[str],
        level: int,
    ) -> str:
        """Generate a summary of a cluster of chunks."""
        if not self._gemini:
            # Fallback: concatenate first sentences
            return " ".join(text.split(".")[0] + "." for text in texts[:5] if text)

        combined: str = "\n\n---\n\n".join(texts[:10])
        prompt: str = (
            f"Summarize the following {len(texts)} related knowledge "
            f"chunks into a single coherent paragraph. "
            f"Preserve key facts, figures, and proper nouns. "
            f"This is level {level} of a hierarchical summary.\n\n"
            f"{combined}"
        )

        try:
            response = await self._gemini.generate(prompt)
            return response.strip() if response else ""
        except Exception as exc:
            src.core.logging.logger.warning(
                "RAPTOR summarization failed",
                extra={"level": level, "error": str(exc)},
            )
            return ""

    async def _embed_text(self, text: str) -> list[float]:
        """Embed a single text using the embedding client."""
        if not self._embedder:
            return []
        try:
            return await self._embedder.embed_single(text)
        except Exception:
            return []

    async def _store_summary_chunk(
        self,
        chunk_id: str,
        content: str,
        embedding: list[float],
        org_id: str,
        level: int,
        source_chunk_ids: list[str],
    ) -> None:
        """Store a RAPTOR summary chunk in the knowledge API."""
        try:
            async with create_service_client(
                "pipeline-raptor", timeout=15.0
            ) as client:
                await client.post(
                    f"{self._api_url}/v1/chunks/raptor",
                    json={
                        "chunk_id": chunk_id,
                        "content": content,
                        "embedding": embedding,
                        "org_id": org_id,
                        "metadata": {
                            "raptor_level": level,
                            "source_chunks": source_chunk_ids,
                            "strategy": "raptor_summary",
                        },
                    },
                )
        except Exception as exc:
            src.core.logging.logger.warning(
                "Failed to store RAPTOR summary",
                extra={
                    "chunk_id": chunk_id,
                    "level": level,
                    "error": str(exc),
                },
            )
