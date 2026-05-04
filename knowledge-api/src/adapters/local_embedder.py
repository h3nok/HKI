"""
Local Dev Embedder — deterministic hash-based embeddings for local development.

When the LLM gateway (Vertex AI / LiteLLM) is unavailable (VPC blocked,
no credentials, etc.), this fallback generates deterministic embeddings
from text content using SHA-256 hashing. The vectors are NOT semantically
meaningful but allow the full ingestion pipeline to work end-to-end:
  chunk → embed → store → search (keyword mode still works; vector mode
  will return results but with random-quality relevance).

Usage:
    embedder = LocalDevEmbedder(dimensions=768)
    vectors = await embedder.embed(["Hello world"])
"""

from __future__ import annotations

import hashlib
import struct

from src.core.logging import logger


class LocalDevEmbedder:
    """
    Deterministic hash-based embedder for local dev/testing.

    Same text always produces the same vector, enabling consistent
    behavior in tests. Not suitable for production — no semantic meaning.
    """

    def __init__(self, dimensions: int = 768) -> None:
        self._dimensions = dimensions

    async def close(self) -> None:
        """No-op — no connections to clean up."""
        pass

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate deterministic pseudo-embeddings from text hashes."""
        if not texts:
            return []

        vectors = []
        for text in texts:
            vector = self._hash_to_vector(text)
            vectors.append(vector)

        logger.debug(
            "Local embedder generated vectors",
            extra={"count": len(vectors), "dimensions": self._dimensions},
        )
        return vectors

    async def embed_single(self, text: str) -> list[float]:
        """Convenience method to embed a single text string."""
        vectors = await self.embed([text])
        return vectors[0]

    def _hash_to_vector(self, text: str) -> list[float]:
        """
        Generate a deterministic float vector from text using iterative hashing.

        Uses SHA-256 to produce 32 bytes at a time, then converts to floats
        in [-1, 1] range. Chains hashes to produce the required dimensionality.
        """
        vector: list[float] = []
        seed = text.encode("utf-8")
        counter = 0

        while len(vector) < self._dimensions:
            # Hash text + counter to get 32 bytes
            h = hashlib.sha256(seed + struct.pack(">I", counter)).digest()
            # Convert each 4-byte chunk to a float in [-1, 1]
            for i in range(0, 32, 4):
                if len(vector) >= self._dimensions:
                    break
                # Unpack as unsigned int, normalize to [-1, 1]
                val = struct.unpack(">I", h[i : i + 4])[0]
                normalized = (val / (2**32 - 1)) * 2 - 1
                vector.append(normalized)
            counter += 1

        # L2 normalize for cosine similarity compatibility
        magnitude = sum(v * v for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]

        return vector
