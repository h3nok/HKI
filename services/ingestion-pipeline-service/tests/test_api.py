"""
Endpoint integration tests for the ingestion-pipeline-service HTTP API.

Tests hit real FastAPI routes via TestClient.  The lifespan initialises
in-memory stores (jobs, docs, versions, feedback, review) so no external
DBs or Redis are needed.  Endpoints that phone external services (knowledge-api
health check, Gemini, LiteLLM) are mocked at the network boundary.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from src.domain.models import IngestionJob
from src.domain.pre_ingest import ContradictionMatch
from src.domain.review import ReviewRecord

# ═══════════════════════════════════════════════════════════════════════════════
# Health probes
# ═══════════════════════════════════════════════════════════════════════════════


class TestHealthEndpoints:
    """Liveness and readiness probes."""

    def test_liveness(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "service" in data

    def test_readiness_ok(self, client: TestClient) -> None:
        """Readiness returns 'ready' when downstream knowledge-api is reachable."""
        mock_resp = httpx.Response(200, json={"status": "ok"})
        with patch.object(
            client.app.state.http,  # type: ignore[union-attr]
            "get",
            new_callable=AsyncMock,
            return_value=mock_resp,
        ):
            resp = client.get("/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["checks"]["vector_store"] == "ok"

    def test_readiness_degraded(self, client: TestClient) -> None:
        """Readiness returns 'degraded' when knowledge-api returns non-200."""
        mock_resp = httpx.Response(503, json={"error": "down"})
        with patch.object(
            client.app.state.http,  # type: ignore[union-attr]
            "get",
            new_callable=AsyncMock,
            return_value=mock_resp,
        ):
            resp = client.get("/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "degraded"

    def test_readiness_alias(self, client: TestClient) -> None:
        mock_resp = httpx.Response(200, json={"status": "ok"})
        with patch.object(
            client.app.state.http,  # type: ignore[union-attr]
            "get",
            new_callable=AsyncMock,
            return_value=mock_resp,
        ):
            resp = client.get("/health/ready")
        assert resp.status_code == 200

    def test_readiness_blocks_when_hvsi_finds_legacy_rows(self, client: TestClient) -> None:
        from src.core.config import settings

        original_flag = settings.KB_HERMETIC_ISOLATION
        settings.KB_HERMETIC_ISOLATION = True

        job_store = client.app.state.job_store  # type: ignore[union-attr]
        review_store = client.app.state.review_store  # type: ignore[union-attr]

        job_store._jobs["legacy-job"] = IngestionJob(id="legacy-job", stream_id=None)
        review_store._records["legacy-review"] = ReviewRecord(
            id="legacy-review",
            document_id="doc-1",
            stream_id=None,
        )

        mock_resp = httpx.Response(200, json={"status": "ok"})
        with patch.object(
            client.app.state.http,  # type: ignore[union-attr]
            "get",
            new_callable=AsyncMock,
            return_value=mock_resp,
        ):
            try:
                resp = client.get("/ready")
            finally:
                settings.KB_HERMETIC_ISOLATION = original_flag

        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "blocked"
        assert data["hvsi"]["issues"]["jobs_missing_stream"] == 1
        assert data["hvsi"]["issues"]["reviews_missing_stream"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Jobs
# ═══════════════════════════════════════════════════════════════════════════════


class TestJobs:
    """Job listing and lookup."""

    def test_list_jobs_empty(self, client: TestClient) -> None:
        resp = client.get("/v1/jobs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 0
        assert isinstance(data["jobs"], list)

    def test_get_job_not_found(self, client: TestClient) -> None:
        resp = client.get("/v1/jobs/does-not-exist")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Text Ingestion
# ═══════════════════════════════════════════════════════════════════════════════


class TestIngestText:
    """POST /v1/ingest/text — inline mode (PUBSUB_ENABLED=False)."""

    def test_ingest_text_success(self, client: TestClient) -> None:
        """Ingest plaintext and get back a job with chunks."""
        resp = client.post(
            "/v1/ingest/text",
            json={
                "content": "HKI is a membership-based warehouse club. " * 20,
                "stream_id": "dev",
                "title": "Pipeline Test Doc",
                "department": "test",
                "document_type": "policy",
                "tags": ["test"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("completed", "queued", "processing")
        assert data["job_id"]
        assert data["title"] == "Pipeline Test Doc"

    def test_ingest_empty_content_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/ingest/text",
            json={"content": "   ", "title": "Empty", "stream_id": "dev"},
        )
        assert resp.status_code == 400

    def test_ingest_missing_stream_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/ingest/text",
            json={"content": "Missing stream should fail.", "title": "No Stream"},
        )
        assert resp.status_code == 422

    def test_ingest_global_stream_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/ingest/text",
            json={
                "content": "Global runtime streams should fail closed.",
                "title": "Global Stream",
                "stream_id": "global",
            },
        )
        assert resp.status_code == 403

    def test_ingest_then_list_jobs(self, client: TestClient) -> None:
        """After ingestion, the job appears in the jobs list."""
        ingest_resp = client.post(
            "/v1/ingest/text",
            json={
                "content": "Some content for the pipeline to process. " * 10,
                "stream_id": "dev",
                "title": "Job List Test",
            },
        )
        assert ingest_resp.status_code == 200
        job_id = ingest_resp.json()["job_id"]

        jobs_resp = client.get("/v1/jobs")
        assert jobs_resp.status_code == 200
        job_ids = [j["id"] for j in jobs_resp.json()["jobs"]]
        assert job_id in job_ids

    def test_ingest_then_get_job(self, client: TestClient) -> None:
        """After ingestion, the individual job endpoint returns details."""
        ingest_resp = client.post(
            "/v1/ingest/text",
            json={
                "content": "Pipeline testing content for job detail check. " * 10,
                "stream_id": "dev",
                "title": "Job Detail Test",
            },
        )
        assert ingest_resp.status_code == 200
        job_id = ingest_resp.json()["job_id"]

        detail = client.get(f"/v1/jobs/{job_id}")
        assert detail.status_code == 200
        data = detail.json()
        assert data["job"]["id"] == job_id
        assert isinstance(data["stages_completed"], list)

    def test_ingest_creates_visible_pending_review(self, client: TestClient) -> None:
        """A successful ingestion should appear in the review queue for the same org."""
        ingest_resp = client.post(
            "/v1/ingest/text",
            json={
                "content": "Review queue wiring test. " * 20,
                "stream_id": "dev",
                "title": "Queue Visibility Test",
                "department": "test",
                "document_type": "faq",
            },
        )
        assert ingest_resp.status_code == 200
        job_id = ingest_resp.json()["job_id"]

        document_id = None
        deadline = time.monotonic() + 2.0
        while time.monotonic() < deadline:
            detail = client.get(f"/v1/jobs/{job_id}")
            assert detail.status_code == 200
            document_id = detail.json()["job"]["document_id"]
            if document_id:
                break
            time.sleep(0.02)

        assert document_id

        pending = client.get("/v1/review/pending")
        assert pending.status_code == 200
        pending_ids = [record["document_id"] for record in pending.json()]
        assert document_id in pending_ids


# ═══════════════════════════════════════════════════════════════════════════════
# Quality Gates (pure logic — no external calls)
# ═══════════════════════════════════════════════════════════════════════════════


class TestQualityGates:
    """Quality scoring, PII scan, and PII redaction."""

    def test_quality_score(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/quality/score",
            json={
                "text": (
                    "HKI Corporation operates a chain of "
                    "membership-only warehouse clubs. The company was "
                    "founded in 1983 and is headquartered in Issaquah, "
                    "Washington. HKI offers a wide range of products "
                    "including groceries, electronics, and apparel."
                ),
                "title": "HKI Overview",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 0.0 <= data["overall_score"] <= 100.0
        assert "completeness" in data
        assert "readability" in data
        assert "pii_scan" in data
        assert isinstance(data["auto_approve_eligible"], bool)

    def test_pii_scan_clean_text(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/quality/pii-scan",
            json={"text": "HKI offers great deals on bulk items."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pii_detected"] is False
        assert data["match_count"] == 0

    def test_pii_scan_detects_email(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/quality/pii-scan",
            json={"text": "Contact john.doe@example.com for details."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pii_detected"] is True
        assert data["match_count"] >= 1

    def test_pii_redact(self, client: TestClient) -> None:
        text = "Call me at 555-123-4567 or email test@example.com."
        resp = client.post(
            "/v1/quality/pii-redact",
            json={"text": text},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["original_length"] == len(text)


# ═══════════════════════════════════════════════════════════════════════════════
# Pre-ingest analysis
# ═══════════════════════════════════════════════════════════════════════════════


class TestPreIngestAnalysis:
    def test_pre_ingest_allows_routine_contact_info(self, client: TestClient) -> None:
        with (
            patch(
                "src.domain.pre_ingest._check_duplicates",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "src.domain.pre_ingest._check_contradictions",
                new=AsyncMock(return_value=[]),
            ),
        ):
            resp = client.post(
                "/v1/pre-ingest/analyze",
                json={
                    "title": "Receiving checklist",
                    "content": (
                        "Warehouse supervisors should reconcile inbound manifests daily, "
                        "document shortages, and escalate damaged inventory to control. "
                        "For receiving questions, call 555-123-4567 or email "
                        "receiving@example.com."
                    ),
                    "value_stream_description": "Warehouse operations and receiving guidance",
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["validate"]["pii_detected"] is False
        assert data["validate"]["contact_info_detected"] is True
        assert sorted(data["validate"]["contact_info_categories"]) == ["Email", "Phone (US)"]
        assert data["decide"]["recommendation"] != "reject"
        assert data["decide"]["contradictions"] == []

    def test_pre_ingest_returns_contradiction_signals(self, client: TestClient) -> None:
        with (
            patch(
                "src.domain.pre_ingest._check_duplicates",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "src.domain.pre_ingest._check_contradictions",
                new=AsyncMock(
                    return_value=[
                        ContradictionMatch(
                            document_id="doc-7",
                            title="Store dosing SOP",
                            candidate_claim="Maximum dose is 2000mg per day.",
                            conflicting_claim="Maximum dose is 2550mg per day.",
                            chunk_preview="Existing SOP says 2550mg per day.",
                            confidence=0.88,
                            rationale="Conflicting numeric dosage guidance detected.",
                        )
                    ]
                ),
            ),
        ):
            resp = client.post(
                "/v1/pre-ingest/analyze",
                json={
                    "title": "New dosing note",
                    "content": "Maximum dose is 2000mg per day for adults.",
                    "value_stream_description": "Pharmacy operations and medication safety",
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["decide"]["contradictions"]) == 1
        assert data["decide"]["contradictions"][0]["document_id"] == "doc-7"


# ═══════════════════════════════════════════════════════════════════════════════
# Generated Answer
# ═══════════════════════════════════════════════════════════════════════════════


class TestGeneratedAnswer:
    def test_generate_answer_preserves_score_scale_and_document_id(
        self, client: TestClient
    ) -> None:
        mock_result = {
            "answer": "You can return most merchandise at any time. [1]",
            "confidence": 0.9,
            "citations": [
                {
                    "index": 1,
                    "title": "Return Policy",
                    "score": 2.75,
                    "score_scale": "raw_rank",
                    "document_id": "doc-123",
                }
            ],
        }
        with patch(
            "src.adapters.gemini_client.generate_answer",
            new=AsyncMock(return_value=mock_result),
        ):
            resp = client.post(
                "/v1/generate/answer",
                json={
                    "query": "What is the return policy?",
                    "chunks": [
                        {
                            "content": "Members can return most merchandise at any time.",
                            "score": 2.75,
                            "score_scale": "raw_rank",
                            "metadata": {"document_id": "doc-123"},
                        }
                    ],
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"]
        assert data["citations"][0]["score_scale"] == "raw_rank"
        assert data["citations"][0]["document_id"] == "doc-123"

    def test_pii_redact_selective_categories(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/quality/pii-redact",
            json={
                "text": "Email test@example.com or call 555-123-4567.",
                "categories": ["email"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        # At minimum, some redactions are attempted when categories are specified
        assert isinstance(data["redacted_text"], str)
        assert data["original_length"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# Versioning — Diff
# ═══════════════════════════════════════════════════════════════════════════════


class TestDiff:
    """POST /v1/versions/diff — pure text comparison."""

    def test_diff_with_changes(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/versions/diff",
            json={
                "old_text": "Line one\nLine two\nLine three\n",
                "new_text": "Line one\nLine TWO\nLine three\nLine four\n",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stats"]["added_count"] >= 1
        assert data["stats"]["removed_count"] >= 1
        assert isinstance(data["lines"], list)

    def test_diff_identical(self, client: TestClient) -> None:
        text = "Same content\n"
        resp = client.post(
            "/v1/versions/diff",
            json={"old_text": text, "new_text": text},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stats"]["added_count"] == 0
        assert data["stats"]["removed_count"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Feedback
# ═══════════════════════════════════════════════════════════════════════════════


class TestFeedback:
    """Chunk feedback recording and flagged-chunk listing."""

    def test_record_feedback(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/feedback/chunk",
            json={
                "signal": "down",
                "query": "What is HKI?",
                "answer": "A warehouse club.",
                "chunk_ids": ["chunk-1", "chunk-2"],
                "document_ids": ["doc-1"],
                "confidence": 0.8,
                "eval_score": 0.3,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["recorded"] >= 1

    def test_get_flagged_empty(self, client: TestClient) -> None:
        resp = client.get("/v1/feedback/flagged")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ═══════════════════════════════════════════════════════════════════════════════
# Observability
# ═══════════════════════════════════════════════════════════════════════════════


class TestObservability:
    """Trace viewer and summary endpoints."""

    def test_get_traces(self, client: TestClient) -> None:
        resp = client.get("/v1/observability/traces")
        assert resp.status_code == 200
        data = resp.json()
        assert "traces" in data
        assert "total" in data

    def test_get_trace_summary(self, client: TestClient) -> None:
        resp = client.get("/v1/observability/summary")
        assert resp.status_code == 200
        # Summary is a dict with aggregated stats
        assert isinstance(resp.json(), dict)


# ═══════════════════════════════════════════════════════════════════════════════
# Version History
# ═══════════════════════════════════════════════════════════════════════════════


class TestVersions:
    """Version history lookup."""

    def test_version_history_empty(self, client: TestClient) -> None:
        resp = client.get("/v1/versions/some-doc-ref")
        assert resp.status_code == 200
        data = resp.json()
        assert data["source_ref"] == "some-doc-ref"
        assert data["total"] == 0
        assert data["versions"] == []

    def test_file_ingest_uses_explicit_source_ref(self, client: TestClient) -> None:
        source_ref = "google-drive:file-123"
        resp = client.post(
            "/v1/ingest/file",
            files={
                "file": (
                    "drive-sync.txt",
                    b"HKI warehouse policy update. " * 20,
                    "text/plain",
                )
            },
            data={
                "title": "Drive Sync Document",
                "source_ref": source_ref,
                "stream_id": "dev",
            },
        )
        assert resp.status_code == 200

        deadline = time.monotonic() + 2.0
        total = 0
        while time.monotonic() < deadline:
            versions_resp = client.get(f"/v1/versions/{source_ref}")
            assert versions_resp.status_code == 200
            data = versions_resp.json()
            total = data["total"]
            if total > 0:
                break
            time.sleep(0.02)

        assert total == 1
        assert data["source_ref"] == source_ref
        assert data["versions"][0]["version"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Review Workflow
# ═══════════════════════════════════════════════════════════════════════════════


class TestReview:
    """Review submission, listing, and decision endpoints."""

    def test_list_pending_empty(self, client: TestClient) -> None:
        resp = client.get("/v1/review/pending")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_submit_review(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-1",
                "stream_id": "dev",
                "title": "Test Review",
                "quality_report": {"overall_score": 0.85},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["document_id"] == "doc-review-1"
        assert data["status"] == "pending_review"

    def test_submit_review_missing_stream_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-no-stream",
                "title": "Missing Stream",
                "quality_report": {"overall_score": 0.85},
            },
        )
        assert resp.status_code == 422

    def test_submit_review_global_stream_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-global",
                "stream_id": "global",
                "title": "Global Review",
            },
        )
        assert resp.status_code == 403

    def test_submit_then_list_pending(self, client: TestClient) -> None:
        client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-2",
                "stream_id": "dev",
                "title": "Pending Test",
                "quality_report": {"overall_score": 0.7},
            },
        )
        resp = client.get("/v1/review/pending")
        assert resp.status_code == 200
        ids = [r["document_id"] for r in resp.json()]
        assert "doc-review-2" in ids

    def test_submit_then_get_by_id(self, client: TestClient) -> None:
        submit = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-3",
                "stream_id": "dev",
                "title": "Get By ID Test",
                "quality_report": {"overall_score": 0.9},
            },
        )
        record_id = submit.json()["id"]

        detail = client.get(f"/v1/review/{record_id}")
        assert detail.status_code == 200
        assert detail.json()["id"] == record_id

    def test_get_review_not_found(self, client: TestClient) -> None:
        resp = client.get("/v1/review/nonexistent")
        assert resp.status_code == 404

    def test_approve_review(self, client: TestClient) -> None:
        submit = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-approve",
                "stream_id": "dev",
                "title": "Approve Test",
                "quality_report": {"overall_score": 0.95},
            },
        )
        record_id = submit.json()["id"]

        decide = client.post(
            "/v1/review/decide",
            json={
                "record_id": record_id,
                "decision": "approve",
                "reviewer": "test-reviewer",
                "notes": "Looks good",
            },
        )
        assert decide.status_code == 200
        assert decide.json()["status"] == "approved"

    def test_reject_review(self, client: TestClient) -> None:
        submit = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-reject",
                "stream_id": "dev",
                "title": "Reject Test",
                "quality_report": {"overall_score": 0.3},
            },
        )
        record_id = submit.json()["id"]

        decide = client.post(
            "/v1/review/decide",
            json={
                "record_id": record_id,
                "decision": "reject",
                "reviewer": "test-reviewer",
                "notes": "Needs improvement",
            },
        )
        assert decide.status_code == 200
        assert decide.json()["status"] == "rejected"

    def test_publish_review_forwards_service_auth_for_status_sync(self, client: TestClient) -> None:
        submit = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-publish-sync",
                "stream_id": "dev",
                "title": "Publish Sync Test",
                "quality_report": {"overall_score": 0.95},
            },
        )
        record_id = submit.json()["id"]

        decide = client.post(
            "/v1/review/decide",
            json={
                "record_id": record_id,
                "decision": "approve",
                "reviewer": "test-reviewer",
            },
        )
        assert decide.status_code == 200

        sync_response = httpx.Response(200, json={"status": "published"})
        with patch.object(
            client.app.state.http,  # type: ignore[union-attr]
            "patch",
            new_callable=AsyncMock,
            return_value=sync_response,
        ) as sync_patch:
            publish = client.post(
                f"/v1/review/{record_id}/publish",
                headers={
                    "Authorization": "Bearer cloud-run-id-token",
                    "X-Service-Auth": "Bearer request-jwt",
                },
            )

        assert publish.status_code == 200
        assert publish.json()["status"] == "published"
        sync_patch.assert_awaited_once()
        assert sync_patch.await_args.kwargs["headers"]["X-Service-Auth"] == ("Bearer request-jwt")
        assert sync_patch.await_args.kwargs["headers"]["Authorization"] == (
            "Bearer cloud-run-id-token"
        )

    def test_remind_assigned_review(self, client: TestClient) -> None:
        submit = client.post(
            "/v1/review/submit",
            json={
                "document_id": "doc-review-remind",
                "stream_id": "dev",
                "title": "Reminder Test",
                "quality_report": {"overall_score": 0.82},
            },
        )
        record_id = submit.json()["id"]

        assign = client.post(
            f"/v1/review/{record_id}/assign",
            json={
                "record_id": record_id,
                "assignee": "owner@example.com",
            },
        )
        assert assign.status_code == 200

        remind = client.post(
            f"/v1/review/{record_id}/remind",
            json={
                "record_id": record_id,
                "message": "Please take a look today.",
            },
        )
        assert remind.status_code == 200
        data = remind.json()
        assert data["assigned_to"] == "owner@example.com"
        assert data["last_reminded_at"] is not None
        assert data["comments"][-1]["author"] == "dev-user"
        assert "Please take a look today." in data["comments"][-1]["text"]
