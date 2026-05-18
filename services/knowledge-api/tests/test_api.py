"""
API endpoint integration tests — verifies route wiring, request validation,
and response shapes using the in-memory vector store.

These tests exercise the full HTTP request → route → domain → adapter path
without mocking, using the TestClient which triggers the real lifespan
(in-memory stores, local dev embedder, etc.).
"""

from __future__ import annotations

import typing

import fastapi.testclient
import httpx
import pytest

import src.core.auth

# ═══════════════════════════════════════════════════════════════════════════════
# Health & Readiness
# ═══════════════════════════════════════════════════════════════════════════════


class TestHealthEndpoints:
    def test_liveness(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "service" in data

    def test_readiness(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("ready", "degraded")
        # Response includes store info (backend, document/chunk counts)
        assert "store" in data

    def test_readiness_alias(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/health/ready")
        assert resp.status_code == 200

    def test_readiness_blocks_when_hvsi_finds_legacy_rows(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        from src.core.config import settings

        original_flag: bool = settings.KB_HERMETIC_ISOLATION
        original_audit: typing.Any | None = getattr(
            client.app.state.vector_store, "hvsi_audit", None
        )
        settings.KB_HERMETIC_ISOLATION = True
        client.app.state.vector_store.hvsi_audit = lambda: {
            "documents_missing_stream": 1,
            "chunks_missing_stream": 0,
        }

        try:
            resp: httpx.Response = client.get("/ready")
        finally:
            settings.KB_HERMETIC_ISOLATION = original_flag
            if original_audit is None:
                delattr(client.app.state.vector_store, "hvsi_audit")
            else:
                client.app.state.vector_store.hvsi_audit = original_audit

        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "blocked"
        assert data["hvsi"]["issues"]["documents_missing_stream"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Search
# ═══════════════════════════════════════════════════════════════════════════════


class TestSearch:
    def test_search_returns_200(self, client: fastapi.testclient.TestClient) -> None:
        """Empty store search should return 200 with empty results."""
        resp: httpx.Response = client.post("/v1/search", json={"query": "test query"})
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_search_missing_query_returns_422(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.post("/v1/search", json={})
        assert resp.status_code == 422

    def test_search_keyword_mode(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.post(
            "/v1/search",
            json={"query": "Kirkland toilet paper", "mode": "keyword", "top_k": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data

    def test_search_exposes_score_scale_metadata(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        client.post(
            "/v1/internal/store",
            json={
                "org_id": "default",
                "stream_id": "dev",
                "content": "Members can return most merchandise at any time.",
                "metadata": {
                    "title": "Return Policy",
                    "document_type": "policy",
                },
            },
        )

        resp: httpx.Response = client.post(
            "/v1/search",
            json={
                "query": "return policy",
                "mode": "keyword",
                "top_k": 3,
                "include_pending": True,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"]
        top = data["results"][0]
        assert top["score_scale"] == "raw_rank"
        assert top["vector_score_scale"] == "normalized"
        assert top["keyword_score_scale"] == "raw_rank"

    def test_search_include_pending_returns_draft_documents(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        client.post(
            "/v1/internal/store",
            json={
                "org_id": "default",
                "stream_id": "dev",
                "content": "Electronics must be returned within 90 days of purchase.",
                "metadata": {
                    "title": "Electronics Return Policy",
                    "document_type": "policy",
                },
            },
        )

        hidden: httpx.Response = client.post(
            "/v1/search",
            json={"query": "electronics return policy", "mode": "keyword", "top_k": 5},
        )
        assert hidden.status_code == 200
        assert hidden.json()["total_results"] == 0

        visible: httpx.Response = client.post(
            "/v1/search",
            json={
                "query": "electronics return policy",
                "mode": "keyword",
                "top_k": 5,
                "include_pending": True,
            },
        )
        assert visible.status_code == 200
        assert visible.json()["total_results"] >= 1

    def test_search_respects_document_acl_groups(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        store_resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={
                "org_id": "default",
                "stream_id": "dev",
                "content": "Privileged legal memo for active antitrust litigation.",
                "metadata": {
                    "title": "Antitrust Litigation Memo",
                    "document_type": "policy",
                    "classification": "restricted",
                    "access_control": {
                        "allowed_groups": ["department:legal"],
                    },
                },
            },
        )
        assert store_resp.status_code == 200
        document_id = store_resp.json()["document_id"]

        def ops_identity() -> src.core.auth.RequestIdentity:
            return src.core.auth.RequestIdentity(
                user_id="ops-user",
                name="Ops User",
                role="manager",
                scope="dev",
                scopes=["dev"],
                org_id="default",
                groups=["department:operations", "role:manager"],
            )

        def legal_identity() -> src.core.auth.RequestIdentity:
            return src.core.auth.RequestIdentity(
                user_id="legal-user",
                name="Legal User",
                role="manager",
                scope="dev",
                scopes=["dev"],
                org_id="default",
                groups=["department:legal", "role:manager"],
            )

        original_overrides = dict(client.app.dependency_overrides)
        try:
            client.app.dependency_overrides[src.core.auth.verify_request_jwt] = ops_identity
            blocked: httpx.Response = client.post(
                "/v1/search",
                json={
                    "query": "antitrust litigation memo",
                    "mode": "keyword",
                    "top_k": 5,
                    "include_pending": True,
                },
            )
            assert blocked.status_code == 200
            assert blocked.json()["total_results"] == 0

            blocked_doc: httpx.Response = client.get(f"/v1/documents/{document_id}")
            assert blocked_doc.status_code == 404

            client.app.dependency_overrides[src.core.auth.verify_request_jwt] = legal_identity
            allowed: httpx.Response = client.post(
                "/v1/search",
                json={
                    "query": "antitrust litigation memo",
                    "mode": "keyword",
                    "top_k": 5,
                    "include_pending": True,
                },
            )
            assert allowed.status_code == 200
            assert allowed.json()["total_results"] >= 1

            allowed_doc: httpx.Response = client.get(f"/v1/documents/{document_id}")
            assert allowed_doc.status_code == 200
        finally:
            client.app.dependency_overrides = original_overrides

    def test_search_emits_native_hki_audit_event(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        class FakeAnalytics:
            def __init__(self) -> None:
                self.audit_events: list[dict[str, typing.Any]] = []

            def fire(self, *args: typing.Any, **kwargs: typing.Any) -> None:
                pass

            def fire_audit_event(self, **kwargs: typing.Any) -> None:
                self.audit_events.append(kwargs)

        def pharmacy_identity() -> src.core.auth.RequestIdentity:
            return src.core.auth.RequestIdentity(
                user_id="pharmacy-user",
                name="Pharmacy User",
                role="manager",
                scope="pharmacy",
                scopes=["pharmacy"],
                org_id="default",
                groups=["role:manager"],
            )

        fake_analytics = FakeAnalytics()
        client.app.state.analytics = fake_analytics
        original_overrides = dict(client.app.dependency_overrides)
        try:
            client.app.dependency_overrides[src.core.auth.verify_request_jwt] = pharmacy_identity
            resp: httpx.Response = client.post(
                "/v1/search",
                json={"query": "flu shot policy", "mode": "keyword", "top_k": 1},
            )
        finally:
            client.app.dependency_overrides = original_overrides

        assert resp.status_code == 200
        assert fake_analytics.audit_events
        event: dict[str, Any] = fake_analytics.audit_events[-1]
        assert event["operation_type"] == "retrieval.search"
        assert event["active_domain"] == "pharmacy"
        assert event["authorized_domains"] == ["pharmacy"]
        assert event["evidence"]["redaction_profile"] == "metadata-only"


# ═══════════════════════════════════════════════════════════════════════════════
# Internal Store (pipeline-service → knowledge-api write path)
# ═══════════════════════════════════════════════════════════════════════════════


class TestInternalStore:
    """Tests for POST /v1/internal/store — the pipeline-service write endpoint.

    No user JWT required. PIPELINE_SERVICE_SECRET is empty in tests so the
    token check is skipped (same as local dev behaviour).
    """

    def test_store_document(self, client: fastapi.testclient.TestClient) -> None:
        """Storing a document should return 200 with chunk count > 0."""
        resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={
                "org_id": "test-org",
                "stream_id": "dev",
                "content": (
                    "Kirkland Signature Organic Extra Virgin Olive Oil is cold-pressed "
                    "from organic olives sourced from select farms. It has a rich flavor "
                    "profile with notes of green fruit and a peppery finish. Each bottle "
                    "contains 2 liters and is certified USDA Organic. This product is "
                    "available in all HKI warehouse locations."
                ),
                "metadata": {
                    "title": "Kirkland Olive Oil",
                    "document_type": "product",
                    "department": "grocery",
                    "tags": ["kirkland", "olive-oil", "organic"],
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "document_id" in data
        assert data["chunk_count"] > 0

    def test_store_empty_content_returns_chunks_zero(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        """Empty content should produce zero chunks (graceful, not a 4xx)."""
        resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={
                "org_id": "test-org",
                "stream_id": "dev",
                "content": "",
                "metadata": {"title": "Empty Doc", "document_type": "general"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chunk_count"] == 0

    def test_store_missing_content_returns_422(self, client: fastapi.testclient.TestClient) -> None:
        """/v1/internal/store requires a content field."""
        resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={"org_id": "test-org", "stream_id": "dev"},
        )
        assert resp.status_code == 422

    def test_store_missing_stream_returns_422(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={
                "org_id": "test-org",
                "content": "A document without a stream should be rejected.",
                "metadata": {"title": "Missing Stream", "document_type": "general"},
            },
        )
        assert resp.status_code == 422

    def test_old_ingest_endpoint_gone(self, client: fastapi.testclient.TestClient) -> None:
        """/v1/ingest must no longer exist — callers must use /v1/internal/store."""
        resp: httpx.Response = client.post("/v1/ingest", json={"content": "test", "metadata": {}})
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Documents CRUD
# ═══════════════════════════════════════════════════════════════════════════════


class TestDocuments:
    @pytest.fixture()
    def ingested_doc_id(self, client: fastapi.testclient.TestClient) -> str:
        """Store a document via the internal endpoint and return its ID.

        org_id must match the dev JWT's org_id ("default") so that the
        subsequent GET/DELETE assertions can find the document.
        """
        resp: httpx.Response = client.post(
            "/v1/internal/store",
            json={
                "org_id": "default",
                "stream_id": "dev",
                "content": (
                    "HKI wholesale membership benefits include exclusive access "
                    "to warehouse pricing, Kirkland Signature products, optical "
                    "services, pharmacy services, and travel packages. Gold Star "
                    "membership costs $65 per year."
                ),
                "metadata": {
                    "title": "Membership Benefits",
                    "document_type": "general",
                    "department": "membership",
                },
            },
        )
        return resp.json()["document_id"]

    def test_list_documents(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.get("/v1/documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data
        assert len(data["documents"]) >= 1

    def test_document_inventory_summary(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.get("/v1/documents/summary")
        assert resp.status_code == 200

        data = resp.json()
        assert data["total_documents"] >= 1
        assert data["live_count"] >= 0
        assert data["pending_review_count"] >= 0
        assert data["processing_count"] >= 0
        assert data["missing_labels_count"] >= 0
        assert set(data["freshness"].keys()) == {
            "current_count",
            "review_count",
            "stale_count",
            "unknown_count",
        }

    def test_get_document_by_id(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.get(f"/v1/documents/{ingested_doc_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == ingested_doc_id

    def test_get_document_not_found(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/v1/documents/nonexistent-id")
        assert resp.status_code == 404

    def test_get_document_content(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.get(f"/v1/documents/{ingested_doc_id}/content")
        assert resp.status_code == 200
        data = resp.json()
        assert "content" in data
        assert len(data["content"]) > 0

    def test_delete_document(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.delete(f"/v1/documents/{ingested_doc_id}")
        assert resp.status_code == 200

        # Verify it's gone
        resp2: httpx.Response = client.get(f"/v1/documents/{ingested_doc_id}")
        assert resp2.status_code == 404

    def test_update_document_metadata(
        self, client: fastapi.testclient.TestClient, ingested_doc_id: str
    ) -> None:
        resp: httpx.Response = client.patch(
            f"/v1/documents/{ingested_doc_id}/metadata",
            json={"tags": ["updated-tag"]},
        )
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# Feedback
# ═══════════════════════════════════════════════════════════════════════════════


class TestFeedback:
    def test_submit_feedback(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.post(
            "/v1/feedback",
            json={
                "query": "Is Kirkland olive oil organic?",
                "chunk_id": "test-chunk-123",
                "rating": "positive",
            },
        )
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# Stats
# ═══════════════════════════════════════════════════════════════════════════════


class TestStats:
    def test_stats_endpoint(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/v1/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_documents" in data or "documents" in data or isinstance(data, dict)


class TestEvaluation:
    def test_auto_evaluate_returns_metrics_for_pending_documents(
        self, client: fastapi.testclient.TestClient
    ) -> None:
        class FakeAnalytics:
            def __init__(self) -> None:
                self.events: list[dict[str, typing.Any]] = []

            def fire(
                self,
                event_type: str,
                *,
                org_id: str,
                user_id: str = "",
                scope: str = "global",
                payload: dict[str, typing.Any] | None = None,
            ) -> None:
                self.events.append(
                    {
                        "event_type": event_type,
                        "org_id": org_id,
                        "user_id": user_id,
                        "scope": scope,
                        "payload": payload or {},
                    }
                )

        fake_analytics = FakeAnalytics()
        client.app.state.analytics = fake_analytics

        client.post(
            "/v1/internal/store",
            json={
                "org_id": "default",
                "stream_id": "dev",
                "content": "Forklifts require a pre-operation inspection before use.",
                "metadata": {
                    "title": "Forklift SOP",
                    "document_type": "sop",
                    "department": "warehouse",
                },
            },
        )

        resp: httpx.Response = client.post(
            "/v1/evaluate/auto",
            json={
                "suite_name": "auto-eval-test",
                "cases": [{"id": "1", "query": "forklift inspection"}],
                "include_pending": True,
                "departments": ["warehouse"],
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_cases"] == 1
        assert len(data["case_results"][0]["metrics"]) > 0
        assert fake_analytics.events
        event: dict[str, Any] = fake_analytics.events[-1]
        assert event["event_type"] == "kb.evaluation"
        assert event["payload"]["source"] == "auto"
        assert event["payload"]["suite_name"] == "auto-eval-test"
        assert event["payload"]["case_count"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Tags
# ═══════════════════════════════════════════════════════════════════════════════


class TestTags:
    def test_list_tags(self, client: fastapi.testclient.TestClient) -> None:
        resp: httpx.Response = client.get("/v1/tags")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, (list, dict))
