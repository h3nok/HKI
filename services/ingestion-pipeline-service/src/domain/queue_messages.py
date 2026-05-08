"""
Queue Messages — Pub/Sub message schemas for the ingestion pipeline.

Defines the contract between the API (publisher) and the worker (subscriber).
All messages are JSON-serialized Pydantic models.

Message Flow:
    API → Pub/Sub topic → Worker subscription → IngestionPipeline
"""

from __future__ import annotations

import datetime
import enum

import pydantic

import src.domain.models


class IngestionMessageType(enum.StrEnum):
    """Type of ingestion message."""

    INGEST_TEXT = "ingest_text"
    INGEST_URL = "ingest_url"


class IngestionMessage(pydantic.BaseModel):
    """
    Pub/Sub message payload for ingestion jobs.

    Published by the API when a user submits content.
    Consumed by the worker to run the pipeline.
    """

    message_type: IngestionMessageType
    job_id: str
    org_id: str = "default"

    # Source content (one of these will be set)
    content: str = ""  # For INGEST_TEXT
    url: str = ""  # For INGEST_URL

    # Document metadata
    title: str = ""
    department: str = ""
    document_type: str = "general"
    tags: list[str] = pydantic.Field(default_factory=list)
    classification: src.domain.models.DocumentClassification = (
        src.domain.models.DocumentClassification.INTERNAL
    )
    access_control: src.domain.models.DocumentAccessControl = pydantic.Field(
        default_factory=src.domain.models.DocumentAccessControl
    )
    stream_id: str = pydantic.Field(
        min_length=1
    )  # Runtime isolation field; required for every queued job

    # Processing options
    chunk_size: int = 512
    chunk_overlap: int = 64
    chunk_strategy: str = "sentence"

    # Auth context — forwarded to downstream services
    auth_token: str = ""

    # Metadata
    published_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    attempt: int = 0  # Delivery attempt counter (set by subscriber)

    def to_json_bytes(self) -> bytes:
        """Serialize for Pub/Sub publish."""
        return self.model_dump_json().encode("utf-8")

    @classmethod
    def from_json_bytes(cls, data: bytes) -> IngestionMessage:
        """Deserialize from Pub/Sub message data."""
        return cls.model_validate_json(data)
