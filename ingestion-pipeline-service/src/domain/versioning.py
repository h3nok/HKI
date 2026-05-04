"""
Incremental Ingestion — content hashing, change detection, and versioning.

Detects whether incoming content has changed since the last ingestion,
enabling incremental re-indexing instead of full re-processing. Every
ingested document gets a content fingerprint and version record.

Architecture Blueprint alignment:
    "Design for incremental knowledge. The system must intercept change
     triggers and re-ingest the modified knowledge into vector stores.
     It is also important to log and version such changes for auditability."

Components:
    ContentFingerprint  — SHA-256 of normalized content
    DocumentVersion     — immutable version record
    ChangeDetector      — compares incoming vs. stored fingerprint
    VersionStore        — Protocol for version persistence
"""

from __future__ import annotations

import datetime
import enum
import hashlib
import re
import typing
import uuid

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class ChangeType(enum.StrEnum):
    """Classification of content change between versions."""

    NEW = "new"  # First time this source_ref is seen
    MODIFIED = "modified"  # Content changed
    UNCHANGED = "unchanged"  # Fingerprint matches — skip re-ingestion
    DELETED = "deleted"  # Source removed (tombstone)


class ContentFingerprint(pydantic.BaseModel):
    """
    A deterministic hash of normalized document content.

    Normalization strips whitespace variance so minor formatting changes
    don't trigger re-ingestion. The hash covers the full content.
    """

    sha256: str
    content_length: int  # Length of normalized content
    word_count: int


class DocumentVersion(pydantic.BaseModel):
    """
    Immutable record of a specific version of a document.

    Versions are append-only. The latest version for a given
    (org_id, source_ref) pair is the active one.
    """

    id: str = pydantic.Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = "default"
    source_ref: str  # Stable identifier (URL, filepath, doc ID)
    version: int = 1  # Monotonically increasing
    fingerprint: ContentFingerprint
    change_type: ChangeType = ChangeType.NEW
    document_id: str = ""  # Resulting document_id in vector store
    diff_summary: str = ""  # Human-readable change description
    metadata: dict = pydantic.Field(default_factory=dict)
    created_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )


class ChangeDetectionResult(pydantic.BaseModel):
    """Output of the change detection comparison."""

    source_ref: str
    change_type: ChangeType
    current_fingerprint: ContentFingerprint
    previous_version: DocumentVersion | None = None
    next_version_number: int = 1
    should_reingest: bool = True


# ═══════════════════════════════════════════════════════════════════════════════
# Store Protocol
# ═══════════════════════════════════════════════════════════════════════════════


class VersionStore(typing.Protocol):
    """Persistence interface for document versions."""

    async def save(self, version: DocumentVersion) -> None: ...

    async def get_latest(
        self,
        org_id: str,
        source_ref: str,
    ) -> DocumentVersion | None: ...

    async def get_history(
        self,
        org_id: str,
        source_ref: str,
        limit: int = 50,
    ) -> list[DocumentVersion]: ...

    async def get_by_document_id(
        self,
        document_id: str,
    ) -> DocumentVersion | None: ...


# ═══════════════════════════════════════════════════════════════════════════════
# In-Memory Store (development fallback)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryVersionStore:
    """
    In-memory version store for local development.

    Production: replace with AlloyDB-backed store.
    The versions table needs columns:
        id, org_id, source_ref, version, sha256, content_length,
        word_count, change_type, document_id, diff_summary, created_at
    Index on (org_id, source_ref, version DESC) for latest-version lookups.
    """

    def __init__(self) -> None:
        self._versions: dict[str, DocumentVersion] = {}  # id → version
        # Index: (org_id, source_ref) → list of version IDs (newest first)
        self._by_source: dict[tuple[str, str], list[str]] = {}

    async def save(self, version: DocumentVersion) -> None:
        self._versions[version.id] = version
        key: tuple[str, str] = (version.org_id, version.source_ref)
        if key not in self._by_source:
            self._by_source[key] = []
        self._by_source[key].insert(0, version.id)  # newest first

    async def get_latest(
        self,
        org_id: str,
        source_ref: str,
    ) -> DocumentVersion | None:
        key: tuple[str, str] = (org_id, source_ref)
        ids: list[str] = self._by_source.get(key, [])
        if not ids:
            return None
        return self._versions.get(ids[0])

    async def get_history(
        self,
        org_id: str,
        source_ref: str,
        limit: int = 50,
    ) -> list[DocumentVersion]:
        key: tuple[str, str] = (org_id, source_ref)
        ids: list[str] = self._by_source.get(key, [])[:limit]
        return [self._versions[vid] for vid in ids if vid in self._versions]

    async def get_by_document_id(
        self,
        document_id: str,
    ) -> DocumentVersion | None:
        for version in self._versions.values():
            if version.document_id == document_id:
                return version
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Content Fingerprinting — pure functions
# ═══════════════════════════════════════════════════════════════════════════════


def normalize_content(text: str) -> str:
    """
    Normalize text for consistent fingerprinting.

    Strips leading/trailing whitespace, collapses internal whitespace,
    lowercases, and removes zero-width characters. This ensures that
    minor formatting changes don't trigger re-ingestion.
    """
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)
    return text.lower()


def compute_fingerprint(content: str) -> ContentFingerprint:
    """Compute a deterministic fingerprint of document content."""
    normalized: str = normalize_content(content)
    sha: str = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    words: list[str] = normalized.split()
    return ContentFingerprint(
        sha256=sha,
        content_length=len(normalized),
        word_count=len(words),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Change Detector — core business logic
# ═══════════════════════════════════════════════════════════════════════════════


class ChangeDetector:
    """
    Compares incoming content against the most recent stored version
    to determine if re-ingestion is needed.

    Stateless — all state comes from the injected VersionStore.

    Usage:
        detector = ChangeDetector(store=version_store)
        result = await detector.detect(org_id, source_ref, new_content)
        if result.should_reingest:
            # run the ingestion pipeline
            version = await detector.record_version(result, document_id)
    """

    def __init__(self, store: VersionStore) -> None:
        self._store: VersionStore = store

    async def detect(
        self,
        org_id: str,
        source_ref: str,
        content: str,
    ) -> ChangeDetectionResult:
        """
        Detect whether content has changed since the last ingestion.

        Returns a ChangeDetectionResult with:
            - change_type: NEW, MODIFIED, or UNCHANGED
            - should_reingest: True unless UNCHANGED
            - next_version_number: the version to assign if re-ingesting
        """
        fingerprint: ContentFingerprint = compute_fingerprint(content)
        previous: DocumentVersion | None = await self._store.get_latest(org_id, source_ref)

        if previous is None:
            return ChangeDetectionResult(
                source_ref=source_ref,
                change_type=ChangeType.NEW,
                current_fingerprint=fingerprint,
                previous_version=None,
                next_version_number=1,
                should_reingest=True,
            )

        if previous.fingerprint.sha256 == fingerprint.sha256:
            return ChangeDetectionResult(
                source_ref=source_ref,
                change_type=ChangeType.UNCHANGED,
                current_fingerprint=fingerprint,
                previous_version=previous,
                next_version_number=previous.version,
                should_reingest=False,
            )

        return ChangeDetectionResult(
            source_ref=source_ref,
            change_type=ChangeType.MODIFIED,
            current_fingerprint=fingerprint,
            previous_version=previous,
            next_version_number=previous.version + 1,
            should_reingest=True,
        )

    async def record_version(
        self,
        result: ChangeDetectionResult,
        document_id: str,
        org_id: str = "default",
        metadata: dict | None = None,
    ) -> DocumentVersion:
        """
        Create and persist a new version record after successful ingestion.

        Call this after the ingestion pipeline completes successfully.
        """
        diff: str = ""
        if result.previous_version:
            diff: str = self._summarize_diff(
                result.previous_version.fingerprint,
                result.current_fingerprint,
            )

        version = DocumentVersion(
            org_id=org_id,
            source_ref=result.source_ref,
            version=result.next_version_number,
            fingerprint=result.current_fingerprint,
            change_type=result.change_type,
            document_id=document_id,
            diff_summary=diff,
            metadata=metadata or {},
        )
        await self._store.save(version)
        return version

    async def get_history(
        self,
        org_id: str,
        source_ref: str,
        limit: int = 50,
    ) -> list[DocumentVersion]:
        """Return version history for a source reference."""
        return await self._store.get_history(org_id, source_ref, limit)

    @staticmethod
    def _summarize_diff(
        old: ContentFingerprint,
        new: ContentFingerprint,
    ) -> str:
        """Generate a human-readable summary of the change."""
        parts: list[str] = []
        len_delta: int = new.content_length - old.content_length
        word_delta: int = new.word_count - old.word_count

        if len_delta > 0:
            parts.append(f"+{len_delta} chars")
        elif len_delta < 0:
            parts.append(f"{len_delta} chars")

        if word_delta > 0:
            parts.append(f"+{word_delta} words")
        elif word_delta < 0:
            parts.append(f"{word_delta} words")

        if not parts:
            parts.append("content restructured (same length)")

        return ", ".join(parts)
