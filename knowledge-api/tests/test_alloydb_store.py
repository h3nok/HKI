from __future__ import annotations

from datetime import UTC, datetime

from src.adapters.alloydb_store import (
    _build_filter_clause,
    _build_stream_scope_clause,
    _document_custom_metadata,
    _normalize_keyword_query,
    _row_to_document,
)
from src.domain.models import Document, DocumentMetadata, DocumentType, SearchFilters


def test_build_stream_scope_clause_uses_custom_metadata_expression() -> None:
    clause, params = _build_stream_scope_clause(
        ["pharmacy"],
        base_param_idx=4,
        column_prefix="d.",
    )

    assert "custom_metadata->>'stream_id'" in clause
    assert "d.stream_id" not in clause
    assert "IS NULL" not in clause
    assert params == [["pharmacy"]]


def test_build_stream_scope_clause_without_alias_uses_document_metadata() -> None:
    clause, params = _build_stream_scope_clause(
        ["logistics"],
        base_param_idx=2,
        column_prefix="",
    )

    assert "NULLIF(custom_metadata->>'stream_id', '')" in clause
    assert "stream_id =" not in clause
    assert "IS NULL" not in clause
    assert params == [["logistics"]]


def test_build_filter_clause_uses_custom_metadata_for_stream_scoping() -> None:
    where, params = _build_filter_clause(
        SearchFilters(value_streams=["pharmacy"]),
        org_id="default",
    )

    assert "custom_metadata->>'stream_id'" in where
    assert "d.stream_id" not in where
    assert "IS NULL" not in where
    assert params[-1] == ["pharmacy"]


def test_build_filter_clause_treats_global_scope_as_wildcard() -> None:
    where, params = _build_filter_clause(
        SearchFilters(value_streams=["global"]),
        org_id="default",
    )

    assert "custom_metadata->>'stream_id'" not in where
    assert params == ["default", ["published", "indexed"]]


def test_normalize_keyword_query_rewrites_filename_like_queries() -> None:
    assert _normalize_keyword_query("fall-protection-plan.md") == "fall protection plan"


def test_document_custom_metadata_persists_stream_id() -> None:
    doc = Document(
        id="doc-1",
        content="content",
        stream_id="pharmacy",
        metadata=DocumentMetadata(
            title="Policy",
            document_type=DocumentType.POLICY,
            custom={"owner": "ops"},
        ),
    )

    metadata = _document_custom_metadata(doc)

    assert metadata["owner"] == "ops"
    assert metadata["stream_id"] == "pharmacy"
    assert metadata["classification"] == "internal"
    assert metadata["access_control"] == {
        "allowed_groups": [],
        "allowed_users": [],
        "denied_groups": [],
        "denied_users": [],
    }


def test_row_to_document_recovers_stream_id_from_custom_metadata() -> None:
    now = datetime.now(UTC)
    row = {
        "id": "doc-1",
        "org_id": "default",
        "content": "content",
        "title": "Policy",
        "author": "",
        "department": "pharmacy",
        "document_type": "policy",
        "source_url": "",
        "tags": ["policy"],
        "language": "en",
        "version": "1.0",
        "status": "pending_review",
        "chunk_count": 2,
        "custom_metadata": {"stream_id": "pharmacy", "owner": "ops"},
        "created_at": now,
        "updated_at": now,
    }

    doc = _row_to_document(row)

    assert doc.stream_id == "pharmacy"
    assert doc.metadata.stream_id == "pharmacy"
    assert doc.metadata.custom["owner"] == "ops"
