"""
S3 Document Store — S3-compatible landing zone for raw documents (Phase 8 On-Prem).

Every ingested document is persisted to S3/MinIO before processing.
This provides a local airgap-compatible alternative to GCS.

Object layout:
    s3://{bucket}/{prefix}{org_id}/{job_id}/{filename}
"""

from __future__ import annotations

import json
import asyncio
from typing import Any

from src.core.config import settings
from src.core.logging import logger as _root_logger

logger = _root_logger.getChild("s3_store")


class S3DocumentStore:
    """
    Persists raw ingested documents to an S3-compatible store (e.g. MinIO).

    Uses boto3. All operations run in an executor to avoid blocking the asyncio loop.
    """

    def __init__(self) -> None:
        import boto3  # type: ignore[import-untyped]
        from botocore.client import Config  # type: ignore[import-untyped]

        self._bucket = settings.S3_BUCKET
        self._prefix = settings.S3_PREFIX

        # Initialize boto3 client with custom endpoint url for local/MinIO compatibility
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        logger.info(
            "S3 document store initialized",
            extra={"bucket": self._bucket, "prefix": self._prefix, "endpoint": settings.S3_ENDPOINT_URL},
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
        Store a raw document and its metadata in S3.

        Returns the S3 URI (s3://bucket/path) for reference.
        """
        base_path = f"{self._prefix}{org_id}/{job_id}"

        # Store the raw content
        content_path = f"{base_path}/{filename}"

        # Store metadata as sidecar JSON
        meta_path = f"{base_path}/metadata.json"
        meta_payload = {
            "job_id": job_id,
            "org_id": org_id,
            "source_type": source_type,
            **metadata,
        }

        loop = asyncio.get_event_loop()
        
        # Upload content
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self._bucket,
                Key=content_path,
                Body=content.encode("utf-8"),
                ContentType="text/plain; charset=utf-8",
            ),
        )

        # Upload metadata sidecar
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self._bucket,
                Key=meta_path,
                Body=json.dumps(meta_payload, indent=2, default=str).encode("utf-8"),
                ContentType="application/json",
            ),
        )

        uri = f"s3://{self._bucket}/{content_path}"
        logger.info(
            "Stored raw document in S3",
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
        Store raw binary content (PDF, DOCX, etc.) in S3.
        """
        base_path = f"{self._prefix}{org_id}/{job_id}"
        blob_path = f"{base_path}/{filename}"

        # Metadata sidecar
        meta_path = f"{base_path}/metadata.json"
        meta_payload = {
            "job_id": job_id,
            "org_id": org_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": len(data),
            **metadata,
        }

        loop = asyncio.get_event_loop()

        # Upload raw bytes
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self._bucket,
                Key=blob_path,
                Body=data,
                ContentType=content_type,
            ),
        )

        # Upload metadata sidecar
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self._bucket,
                Key=meta_path,
                Body=json.dumps(meta_payload, indent=2, default=str).encode("utf-8"),
                ContentType="application/json",
            ),
        )

        uri = f"s3://{self._bucket}/{blob_path}"
        logger.info(
            "Stored raw binary in S3",
            extra={"uri": uri, "job_id": job_id, "size": len(data)},
        )
        return uri

    async def close(self) -> None:
        """Close the S3 client."""
        # boto3 client doesn't need explicit close usually, but we implement the method for interface compatibility.
        pass
