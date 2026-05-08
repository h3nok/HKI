"""Tests for the Incremental Ingestion / Versioning system."""

from __future__ import annotations

import pytest

from src.domain.versioning import (
    ChangeDetector,
    ChangeType,
    ContentFingerprint,
    DocumentVersion,
    InMemoryVersionStore,
    compute_fingerprint,
    normalize_content,
)


# ── Unit tests: fingerprinting ────────────────────────────────────────────


class TestNormalizeContent:
    def test_collapses_whitespace(self):
        assert normalize_content("hello   world") == "hello world"

    def test_strips_leading_trailing(self):
        assert normalize_content("  hello  ") == "hello"

    def test_lowercases(self):
        assert normalize_content("Hello World") == "hello world"

    def test_removes_zero_width_chars(self):
        assert normalize_content("he\u200bllo") == "hello"

    def test_tabs_and_newlines(self):
        assert normalize_content("a\n\tb") == "a b"


class TestComputeFingerprint:
    def test_deterministic(self):
        fp1 = compute_fingerprint("Hello World")
        fp2 = compute_fingerprint("Hello World")
        assert fp1.sha256 == fp2.sha256

    def test_whitespace_invariant(self):
        fp1 = compute_fingerprint("Hello   World")
        fp2 = compute_fingerprint("Hello World")
        assert fp1.sha256 == fp2.sha256

    def test_case_invariant(self):
        fp1 = compute_fingerprint("HELLO")
        fp2 = compute_fingerprint("hello")
        assert fp1.sha256 == fp2.sha256

    def test_different_content_different_hash(self):
        fp1 = compute_fingerprint("alpha")
        fp2 = compute_fingerprint("beta")
        assert fp1.sha256 != fp2.sha256

    def test_word_count(self):
        fp = compute_fingerprint("one two three")
        assert fp.word_count == 3

    def test_content_length(self):
        fp = compute_fingerprint("Hello World")
        assert fp.content_length == len("hello world")


# ── Store tests ───────────────────────────────────────────────────────────


class TestInMemoryVersionStore:
    @pytest.fixture
    def store(self):
        return InMemoryVersionStore()

    @pytest.mark.asyncio
    async def test_save_and_get_latest(self, store):
        v = DocumentVersion(
            org_id="org1",
            source_ref="doc.txt",
            version=1,
            fingerprint=compute_fingerprint("content"),
        )
        await store.save(v)
        latest = await store.get_latest("org1", "doc.txt")
        assert latest is not None
        assert latest.version == 1

    @pytest.mark.asyncio
    async def test_latest_returns_newest(self, store):
        for i in range(1, 4):
            v = DocumentVersion(
                org_id="org1",
                source_ref="doc.txt",
                version=i,
                fingerprint=compute_fingerprint(f"content v{i}"),
            )
            await store.save(v)

        latest = await store.get_latest("org1", "doc.txt")
        assert latest is not None
        assert latest.version == 3

    @pytest.mark.asyncio
    async def test_get_latest_missing(self, store):
        assert await store.get_latest("org1", "nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_history(self, store):
        for i in range(1, 6):
            v = DocumentVersion(
                org_id="org1",
                source_ref="doc.txt",
                version=i,
                fingerprint=compute_fingerprint(f"v{i}"),
            )
            await store.save(v)

        history = await store.get_history("org1", "doc.txt", limit=3)
        assert len(history) == 3
        assert history[0].version == 5  # newest first

    @pytest.mark.asyncio
    async def test_get_by_document_id(self, store):
        v = DocumentVersion(
            org_id="org1",
            source_ref="doc.txt",
            version=1,
            fingerprint=compute_fingerprint("content"),
            document_id="doc-abc",
        )
        await store.save(v)
        found = await store.get_by_document_id("doc-abc")
        assert found is not None
        assert found.source_ref == "doc.txt"

    @pytest.mark.asyncio
    async def test_get_by_document_id_missing(self, store):
        assert await store.get_by_document_id("nope") is None


# ── Change Detector tests ─────────────────────────────────────────────────


class TestChangeDetector:
    @pytest.fixture
    def store(self):
        return InMemoryVersionStore()

    @pytest.fixture
    def detector(self, store):
        return ChangeDetector(store=store)

    @pytest.mark.asyncio
    async def test_new_content(self, detector):
        result = await detector.detect("org1", "new-doc.txt", "brand new content")
        assert result.change_type == ChangeType.NEW
        assert result.should_reingest is True
        assert result.next_version_number == 1
        assert result.previous_version is None

    @pytest.mark.asyncio
    async def test_unchanged_content(self, detector, store):
        # First ingestion
        fp = compute_fingerprint("stable content")
        v1 = DocumentVersion(
            org_id="org1",
            source_ref="stable.txt",
            version=1,
            fingerprint=fp,
            document_id="doc-1",
        )
        await store.save(v1)

        # Same content again
        result = await detector.detect("org1", "stable.txt", "stable content")
        assert result.change_type == ChangeType.UNCHANGED
        assert result.should_reingest is False
        assert result.next_version_number == 1

    @pytest.mark.asyncio
    async def test_modified_content(self, detector, store):
        fp = compute_fingerprint("original content")
        v1 = DocumentVersion(
            org_id="org1",
            source_ref="changing.txt",
            version=1,
            fingerprint=fp,
            document_id="doc-1",
        )
        await store.save(v1)

        result = await detector.detect("org1", "changing.txt", "updated content here")
        assert result.change_type == ChangeType.MODIFIED
        assert result.should_reingest is True
        assert result.next_version_number == 2

    @pytest.mark.asyncio
    async def test_whitespace_only_change_is_unchanged(self, detector, store):
        fp = compute_fingerprint("hello world")
        v1 = DocumentVersion(
            org_id="org1",
            source_ref="ws.txt",
            version=1,
            fingerprint=fp,
        )
        await store.save(v1)

        result = await detector.detect("org1", "ws.txt", "  hello   world  ")
        assert result.change_type == ChangeType.UNCHANGED

    @pytest.mark.asyncio
    async def test_record_version(self, detector):
        result = await detector.detect("org1", "new.txt", "new content")
        version = await detector.record_version(
            result, document_id="doc-new", org_id="org1",
        )
        assert version.version == 1
        assert version.document_id == "doc-new"
        assert version.change_type == ChangeType.NEW

    @pytest.mark.asyncio
    async def test_record_version_with_diff(self, detector, store):
        fp = compute_fingerprint("short")
        v1 = DocumentVersion(
            org_id="org1",
            source_ref="diff.txt",
            version=1,
            fingerprint=fp,
        )
        await store.save(v1)

        result = await detector.detect("org1", "diff.txt", "much longer content here")
        version = await detector.record_version(
            result, document_id="doc-2", org_id="org1",
        )
        assert version.version == 2
        assert version.diff_summary != ""
        assert "chars" in version.diff_summary

    @pytest.mark.asyncio
    async def test_get_history(self, detector, store):
        for i in range(1, 4):
            v = DocumentVersion(
                org_id="org1",
                source_ref="history.txt",
                version=i,
                fingerprint=compute_fingerprint(f"v{i}"),
            )
            await store.save(v)

        history = await detector.get_history("org1", "history.txt")
        assert len(history) == 3
