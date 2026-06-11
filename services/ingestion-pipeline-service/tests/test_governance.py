from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch
import src.domain.pre_ingest
from src.domain.pipeline import IngestionPipeline
from src.domain.models import ExtractedContent, CleanedContent, SourceType
from src.adapters.gcs_store import create_document_store
from src.adapters.s3_store import S3DocumentStore


class TestGovernanceContradictions:
    def _interpret(self) -> src.domain.pre_ingest.InterpretResult:
        return src.domain.pre_ingest.InterpretResult(
            detected_type="Memo",
            department="Legal",
            tags=["legal", "compliance"],
            entities=[],
            summary="Legal intake guidance.",
            language="English",
            confidence=0.7,
        )

    def test_high_confidence_contradiction_rejects(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            "Pharmacy technicians must verify a hard stop before dispensing opioids.",
            "Dispensing control",
        )

        decision: src.domain.pre_ingest.DecideResult = src.domain.pre_ingest._heuristic_decide(
            validate,
            self._interpret(),
            "Pharmacy operations and dispensing controls",
            contradictions=[
                src.domain.pre_ingest.ContradictionMatch(
                    document_id="doc-existing",
                    title="Legacy opioid SOP",
                    candidate_claim="Technicians must verify a hard stop before dispensing opioids.",
                    conflicting_claim="Technicians may bypass the hard stop when a pharmacist is busy.",
                    chunk_preview="Legacy guidance says the hard stop can be bypassed.",
                    confidence=0.88,
                    rationale="Direct contradiction on technician bypass permissions.",
                )
            ],
        )

        # Confidence is 0.88 (>= 0.85) -> Must be "reject" (Hard Gate)
        assert decision.recommendation == "reject"
        assert "High-confidence contradiction found" in decision.reasoning
        assert "Direct policy conflict" in decision.reasoning
        assert len(decision.contradictions) == 1

    def test_moderate_confidence_contradiction_sends_to_review(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            "Pharmacy technicians must verify a hard stop before dispensing opioids.",
            "Dispensing control",
        )

        decision: src.domain.pre_ingest.DecideResult = src.domain.pre_ingest._heuristic_decide(
            validate,
            self._interpret(),
            "Pharmacy operations and dispensing controls",
            contradictions=[
                src.domain.pre_ingest.ContradictionMatch(
                    document_id="doc-existing",
                    title="Legacy opioid SOP",
                    candidate_claim="Technicians must verify a hard stop before dispensing opioids.",
                    conflicting_claim="Technicians may bypass the hard stop when a pharmacist is busy.",
                    chunk_preview="Legacy guidance says the hard stop can be bypassed.",
                    confidence=0.80,
                    rationale="Direct contradiction on technician bypass permissions.",
                )
            ],
        )

        # Confidence is 0.80 (< 0.85) -> Sends to "review"
        assert decision.recommendation == "review"
        assert "Potential contradiction" in decision.reasoning
        assert len(decision.contradictions) == 1


class TestGovernancePiiRedaction:
    def test_pipeline_clean_redacts_pii(self) -> None:
        text = "Contact the customer service at john.doe@example.com or call Jane Doe at SSN: 123-45-6789."
        extracted = ExtractedContent(
            text=text,
            source_type=SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
        )

        # Run pipeline orchestrator cleaning
        with patch("src.core.config.settings.PII_REDACTION_ENABLED", True):
            cleaned: CleanedContent = IngestionPipeline._clean(extracted)
            
            # Assert PII is redacted
            assert "123-45-6789" not in cleaned.text
            assert "john.doe@example.com" not in cleaned.text
            assert "pii_redacted" in cleaned.changes_applied


class TestOnPremiseS3Store:
    @patch("boto3.client")
    @pytest.mark.asyncio
    async def test_s3_store_uploads_files(self, mock_boto_client: MagicMock) -> None:
        # Mock boto3 s3 client
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        with patch("src.core.config.settings.S3_ENABLED", True), \
             patch("src.core.config.settings.S3_BUCKET", "test-bucket"), \
             patch("src.core.config.settings.S3_PREFIX", "test-prefix/"):
            
            store = S3DocumentStore()
            uri = await store.store_raw_document(
                job_id="job-123",
                org_id="org-456",
                content="test raw content",
                metadata={"title": "Test Title"},
                source_type="text",
                filename="document.txt",
            )

            # Assert correct URI
            assert uri == "s3://test-bucket/test-prefix/org-456/job-123/document.txt"

            # Assert put_object called for content and metadata
            assert mock_s3.put_object.call_count == 2
            
            # Verify call arguments
            mock_s3.put_object.assert_any_call(
                Bucket="test-bucket",
                Key="test-prefix/org-456/job-123/document.txt",
                Body=b"test raw content",
                ContentType="text/plain; charset=utf-8",
            )

    @patch("boto3.client")
    @pytest.mark.asyncio
    async def test_create_document_store_factory(self, mock_boto_client: MagicMock) -> None:
        # Verify factory returns S3DocumentStore if enabled
        with patch("src.core.config.settings.S3_ENABLED", True), \
             patch("src.core.config.settings.S3_BUCKET", "test-bucket"):
            
            store = await create_document_store()
            assert isinstance(store, S3DocumentStore)
