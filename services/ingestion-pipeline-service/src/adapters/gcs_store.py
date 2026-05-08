"""
GCS Document Store — Cloud Storage landing zone for raw documents.

Every ingested document is persisted to Cloud Storage before processing.
This provides:
    1. Durable source-of-truth for re-ingestion / reprocessing
    2. Audit trail of all ingested content
    3. Input for batch re-indexing pipelines
    4. Trigger point for Eventarc / Pub/Sub notifications

Object layout:
    gs://{bucket}/{prefix}{org_id}/{job_id}/{filename}

GCP:
    Cloud Storage with Standard class, same-region as GKE.
    Workload Identity provides access — no service account keys.

Configuration:
    GCS_ENABLED   — enable/disable (default: false for local dev)
    GCS_BUCKET    — bucket name
    GCS_PREFIX    — object prefix (default: "knowledge/raw/")
"""

from __future__ import annotations

import json
from typing import Any

from src.core.config import settings
from src.core.logging import logger as _root_logger

logger = _root_logger.getChild("gcs_store")


class GCSDocumentStore:
    """
    Persists raw ingested documents to Cloud Storage.

    Uses the google-cloud-storage async-compatible client.
    All writes are fire-and-forget from the pipeline's perspective —
    GCS failures do not block ingestion.
    """

    def __init__(self) -> None:
        from google.cloud import storage  # type: ignore[import-untyped]

        self._client = storage.Client()
        self._bucket = self._client.bucket(settings.GCS_BUCKET)
        self._prefix = settings.GCS_PREFIX
        logger.info(
            "GCS document store initialized",
            extra={"bucket": settings.GCS_BUCKET, "prefix": self._prefix},
        )

    async def store_raw_document(
        self,
        job_id: str,
        org_id: str,
        content: str,
        metadata: dict[str, Any],
        source_type: str = "text",
        filename: str = "document.txt",
    ) -> str:
        """
        Store a raw document and its metadata in Cloud Storage.

        Returns the GCS URI (gs://bucket/path) for reference.
        """
        import asyncio

        base_path = f"{self._prefix}{org_id}/{job_id}"

        # Store the raw content
        content_path = f"{base_path}/{filename}"
        content_blob = self._bucket.blob(content_path)

        # Store metadata as sidecar JSON
        meta_path = f"{base_path}/metadata.json"
        meta_blob = self._bucket.blob(meta_path)

        meta_payload = {
            "job_id": job_id,
            "org_id": org_id,
            "source_type": source_type,
            **metadata,
        }

        # Run blocking I/O in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: content_blob.upload_from_string(
                content,
                content_type="text/plain; charset=utf-8",
            ),
        )
        await loop.run_in_executor(
            None,
            lambda: meta_blob.upload_from_string(
                json.dumps(meta_payload, indent=2, default=str),
                content_type="application/json",
            ),
        )

        uri = f"gs://{settings.GCS_BUCKET}/{content_path}"
        logger.info(
            "Stored raw document in GCS",
            extra={"uri": uri, "job_id": job_id, "org_id": org_id},
        )
        return uri

    async def store_raw_bytes(
        self,
        job_id: str,
        org_id: str,
        data: bytes,
        filename: str,
        content_type: str,
        metadata: dict[str, Any],
    ) -> str:
        """
        Store raw binary content (PDF, DOCX, etc.) in Cloud Storage.
        """
        import asyncio

        base_path = f"{self._prefix}{org_id}/{job_id}"
        blob_path = f"{base_path}/{filename}"
        blob = self._bucket.blob(blob_path)

        # Metadata sidecar
        meta_path = f"{base_path}/metadata.json"
        meta_blob = self._bucket.blob(meta_path)
        meta_payload = {
            "job_id": job_id,
            "org_id": org_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": len(data),
            **metadata,
        }

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: blob.upload_from_string(data, content_type=content_type),
        )
        await loop.run_in_executor(
            None,
            lambda: meta_blob.upload_from_string(
                json.dumps(meta_payload, indent=2, default=str),
                content_type="application/json",
            ),
        )

        uri = f"gs://{settings.GCS_BUCKET}/{blob_path}"
        logger.info(
            "Stored raw binary in GCS",
            extra={"uri": uri, "job_id": job_id, "size": len(data)},
        )
        return uri

    async def close(self) -> None:
        """Close the GCS client."""
        self._client.close()


class NoOpDocumentStore:
    """No-op fallback when GCS is disabled (local dev)."""

    async def store_raw_document(self, **kwargs: Any) -> str:
        return ""

    async def store_raw_bytes(self, **kwargs: Any) -> str:
        return ""

    async def close(self) -> None:
        pass


async def create_document_store() -> GCSDocumentStore | NoOpDocumentStore:
    """Factory — returns GCS store if enabled, no-op otherwise."""
    if not settings.GCS_ENABLED or not settings.GCS_BUCKET:
        logger.info("GCS document store disabled — raw documents not persisted")
        return NoOpDocumentStore()

    try:
        store = GCSDocumentStore()
        logger.info("GCS document store ready")
        return store
    except Exception as exc:
        logger.warning(
            "GCS unavailable — falling back to no-op document store",
            extra={"error": str(exc)},
        )
        return NoOpDocumentStore()
