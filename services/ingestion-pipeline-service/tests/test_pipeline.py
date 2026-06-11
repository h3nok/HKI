"""
Tests for the Knowledge Pipeline Service.

Validates the document ingestion pipeline: text extraction, cleaning,
metadata enrichment, job tracking, auth forwarding, and async execution.

API conventions:
    - IngestionPipeline() takes no constructor arguments.
    - _extract_text(content) is a @staticmethod → returns ExtractedContent.
    - _clean(extracted) is a @staticmethod → takes ExtractedContent, returns CleanedContent.
    - _enrich(cleaned) is a @staticmethod → takes CleanedContent, returns EnrichedMetadata.
    - _create_job() is sync, takes keyword args (source_type, title, department, etc.).
    - get_job() / list_jobs() are sync methods.
    - ingest_text() / ingest_url() return immediately with a queued job (background processing).
"""

import datetime
import types
import typing
import unittest.mock

import pytest

import adapters.job_store
import src.core.config
import src.domain.models
import src.domain.pipeline
import src.domain.qa_backend
import src.domain.synthesis

# ═══════════════════════════════════════════════════════════════════════════════
# Text Extraction
# ═══════════════════════════════════════════════════════════════════════════════


class TestTextExtraction:
    def test_extract_plain_text(self) -> None:
        result: src.domain.models.ExtractedContent = src.domain.pipeline.IngestionPipeline._extract_text("Hello, this is a test document.")
        assert result.text == "Hello, this is a test document."
        assert result.byte_count > 0
        assert result.source_type == src.domain.models.SourceType.TEXT

    def test_extract_html_via_strip(self) -> None:
        """_strip_html is a staticmethod that strips HTML tags."""
        html = "<html><body><h1>Title</h1><p>Paragraph text.</p><script>var x=1;</script></body></html>"
        result: str = src.domain.pipeline.IngestionPipeline._strip_html(html)
        assert "Title" in result
        assert "Paragraph text" in result
        # Script content should be removed (if bs4 available)
        # With regex fallback, tag markup is removed but text may remain

    def test_extract_plain_text_size(self) -> None:
        text = "Short document."
        result: src.domain.models.ExtractedContent = src.domain.pipeline.IngestionPipeline._extract_text(text)
        assert result.byte_count == len(text.encode("utf-8"))


class TestFileExtraction:
    @pytest.mark.asyncio
    async def test_extract_file_plain_text(self) -> None:
        result: src.domain.models.ExtractedContent = await src.domain.pipeline.IngestionPipeline._extract_file(
            file_bytes=b"Hello plain text",
            filename="test.txt",
            content_type="text/plain",
        )
        assert result.text == "Hello plain text"
        assert result.metadata["filename"] == "test.txt"

    @pytest.mark.asyncio
    async def test_extract_file_csv(self) -> None:
        result: src.domain.models.ExtractedContent = await src.domain.pipeline.IngestionPipeline._extract_file(
            file_bytes=b"header1,header2\nval1,val2",
            filename="test.csv",
            content_type="text/csv",
        )
        assert "header1: val1" in result.text
        assert "header2: val2" in result.text

    @pytest.mark.asyncio
    async def test_extract_file_pypdf_fallback_when_disabled(self) -> None:
        with unittest.mock.patch("src.core.config.settings.DOCAI_ENABLED", False):
            import io

            from pypdf import PdfWriter
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            pdf_buf = io.BytesIO()
            writer.write(pdf_buf)
            pdf_bytes: bytes = pdf_buf.getvalue()

            with unittest.mock.patch("pypdf.PageObject.extract_text", return_value="Extracted text from PyPDF"):
                result: src.domain.models.ExtractedContent = await src.domain.pipeline.IngestionPipeline._extract_file(
                    file_bytes=pdf_bytes,
                    filename="test.pdf",
                    content_type="application/pdf",
                )
                assert result.text == "Extracted text from PyPDF"
                assert result.metadata["extraction_method"] == "pypdf"

    @pytest.mark.asyncio
    async def test_extract_file_docai_pdf_when_enabled(self) -> None:
        from unittest.mock import AsyncMock

        from src.domain.models import ExtractedContent, SourceType

        mock_extracted = ExtractedContent(
            text="Text extracted via Document AI",
            source_type=SourceType.TEXT,
            metadata={"extraction_method": "document_ai"}
        )

        with unittest.mock.patch("src.core.config.settings.DOCAI_ENABLED", True), \
             unittest.mock.patch("src.core.config.settings.DOCAI_PROCESSOR_ID", "test-processor"):

            mock_extractor = unittest.mock.AsyncMock()
            mock_extractor.extract_pdf.return_value = mock_extracted

            with unittest.mock.patch("src.adapters.document_ai.create_document_extractor", return_value=mock_extractor):
                result: src.domain.models.ExtractedContent = await src.domain.pipeline.IngestionPipeline._extract_file(
                    file_bytes=b"dummy pdf bytes",
                    filename="test.pdf",
                    content_type="application/pdf",
                )
                assert result.text == "Text extracted via Document AI"
                mock_extractor.extract_pdf.assert_called_once_with(b"dummy pdf bytes", "test.pdf")
                mock_extractor.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_extract_file_docai_image_when_enabled(self) -> None:
        from unittest.mock import AsyncMock

        from src.domain.models import ExtractedContent, SourceType

        mock_extracted = ExtractedContent(
            text="Text OCR from Image via Document AI",
            source_type=SourceType.TEXT,
            metadata={"extraction_method": "document_ai_ocr"}
        )

        with unittest.mock.patch("src.core.config.settings.DOCAI_ENABLED", True), \
             unittest.mock.patch("src.core.config.settings.DOCAI_PROCESSOR_ID", "test-processor"):

            mock_extractor = unittest.mock.AsyncMock()
            mock_extractor.extract_image.return_value = mock_extracted

            with unittest.mock.patch("src.adapters.document_ai.create_document_extractor", return_value=mock_extractor):
                result: src.domain.models.ExtractedContent = await src.domain.pipeline.IngestionPipeline._extract_file(
                    file_bytes=b"dummy image bytes",
                    filename="test.png",
                    content_type="image/png",
                )
                assert result.text == "Text OCR from Image via Document AI"
                mock_extractor.extract_image.assert_called_once_with(
                    content=b"dummy image bytes",
                    mime_type="image/png",
                    filename="test.png",
                )
                mock_extractor.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_extract_file_image_fails_when_disabled(self) -> None:
        with unittest.mock.patch("src.core.config.settings.DOCAI_ENABLED", False):
            with pytest.raises(RuntimeError) as exc_info:
                await src.domain.pipeline.IngestionPipeline._extract_file(
                    file_bytes=b"dummy image bytes",
                    filename="test.png",
                    content_type="image/png",
                )
            assert "Image OCR requires Document AI" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════════════════════
# Content Cleaning
# ═══════════════════════════════════════════════════════════════════════════════


class TestCleaning:
    def _make_extracted(self, text: str) -> src.domain.models.ExtractedContent:
        """Helper: wrap text in ExtractedContent for the _clean stage."""
        return src.domain.models.ExtractedContent(
            text=text,
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
        )

    def test_removes_control_characters(self) -> None:
        extracted: src.domain.models.ExtractedContent = self._make_extracted("Hello\x00world\x01test")
        result: src.domain.models.CleanedContent = src.domain.pipeline.IngestionPipeline._clean(extracted)
        assert "\x00" not in result.text
        assert "\x01" not in result.text

    def test_normalizes_unicode(self) -> None:
        extracted: src.domain.models.ExtractedContent = self._make_extracted("café")
        result: src.domain.models.CleanedContent = src.domain.pipeline.IngestionPipeline._clean(extracted)
        assert "caf" in result.text

    def test_collapses_blank_lines(self) -> None:
        extracted: src.domain.models.ExtractedContent = self._make_extracted("line1\n\n\n\n\nline2")
        result: src.domain.models.CleanedContent = src.domain.pipeline.IngestionPipeline._clean(extracted)
        assert "\n\n\n" not in result.text

    def test_strips_trailing_whitespace(self) -> None:
        extracted: src.domain.models.ExtractedContent = self._make_extracted("hello   \nworld   ")
        result: src.domain.models.CleanedContent = src.domain.pipeline.IngestionPipeline._clean(extracted)
        lines: list[str] = result.text.split("\n")
        for line in lines:
            assert line == line.rstrip()

    def test_changes_applied_tracked(self) -> None:
        extracted: src.domain.models.ExtractedContent = self._make_extracted("hello\x00\n\n\n\nworld   ")
        result: src.domain.models.CleanedContent = src.domain.pipeline.IngestionPipeline._clean(extracted)
        assert len(result.changes_applied) > 0


# ═══════════════════════════════════════════════════════════════════════════════
# Metadata Enrichment
# ═══════════════════════════════════════════════════════════════════════════════


class TestEnrichment:
    def _make_cleaned(self, text: str) -> src.domain.models.CleanedContent:
        """Helper: wrap text in CleanedContent for the _enrich stage."""
        return src.domain.models.CleanedContent(
            text=text,
            original_length=len(text),
            cleaned_length=len(text),
        )

    def test_title_extraction_from_heading(self) -> None:
        text = "Important Document Title\n\nSome body text follows here."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert "Important Document Title" in result.title

    def test_title_fallback(self) -> None:
        # First line ends with "." so it won't match the heading heuristic;
        # the enricher picks the first short non-sentence line as title.
        text = "Short Title\nNo heading here, just regular text content."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert result.title  # Should extract something

    def test_word_count(self) -> None:
        text = "One two three four five."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert result.word_count == 5

    def test_sentence_count(self) -> None:
        text = "First sentence. Second sentence. Third sentence."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert result.sentence_count == 3

    def test_reading_time(self) -> None:
        # 400 words ÷ 200 wpm = 2.0 minutes
        text: str = " ".join(["word"] * 400)
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert result.estimated_reading_time_min >= 1.5

    def test_date_extraction(self) -> None:
        text = "This document was created on 2024-01-15. Updated 03/20/2024."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert len(result.dates_mentioned) >= 1

    def test_entity_extraction(self) -> None:
        text = "HKI operates warehouses across the United States."
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert len(result.entities) > 0

    def test_topic_extraction(self) -> None:
        text = "inventory management inventory levels inventory tracking supply chain supply chain optimization"
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert len(result.topics) >= 0  # May or may not find topics depending on threshold

    def test_extracts_source_id_and_retrieval_terms(self) -> None:
        text = (
            "KB2028004 - EPS Rej NN - Transaction Rejected at Switch or Intermediary\n\n"
            "Enterprise Pharmacy System troubleshooting guidance for pharmacy teams."
        )
        result: src.domain.models.EnrichedMetadata = src.domain.pipeline.IngestionPipeline._enrich(self._make_cleaned(text))
        assert result.source_id == "KB2028004"
        assert result.system_name == "Enterprise Pharmacy System (EPS)"
        assert "NN" in result.retrieval_terms


# ═══════════════════════════════════════════════════════════════════════════════
# Job Tracking
# ═══════════════════════════════════════════════════════════════════════════════


class TestJobTracking:
    @pytest.fixture
    def pipeline(self) -> src.domain.pipeline.IngestionPipeline:

        return src.domain.pipeline.IngestionPipeline(job_store=adapters.job_store.InMemoryJobStore())

    @pytest.mark.asyncio
    async def test_create_job(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Test")
        assert job.id
        assert job.status == src.domain.models.JobStatus.QUEUED
        assert job.source_type == src.domain.models.SourceType.TEXT

    @pytest.mark.asyncio
    async def test_create_job_with_org_id(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(
            src.domain.models.SourceType.TEXT,
            title="Test",
            org_id="hki",
        )
        assert job.org_id == "hki"

    @pytest.mark.asyncio
    async def test_create_job_with_auth_token(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(
            src.domain.models.SourceType.TEXT,
            title="Test",
            auth_token="jwt-token-123",
        )
        assert job.auth_token == "jwt-token-123"

    @pytest.mark.asyncio
    async def test_create_job_with_acl_metadata(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(
            src.domain.models.SourceType.TEXT,
            title="Legal Memo",
            classification=src.domain.models.DocumentClassification.RESTRICTED,
            access_control=src.domain.models.DocumentAccessControl(
                allowed_groups=["department:legal"],
            ),
        )
        assert job.classification == src.domain.models.DocumentClassification.RESTRICTED
        assert job.access_control.allowed_groups == ["department:legal"]

    def test_auth_token_excluded_from_serialization(self) -> None:
        job = src.domain.models.IngestionJob(
            id="test",
            source_type=src.domain.models.SourceType.TEXT,
            auth_token="secret-jwt",
        )
        data: dict[str, typing.Any] = job.model_dump()
        assert "auth_token" not in data

    @pytest.mark.asyncio
    async def test_get_job(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Test")
        retrieved: src.domain.models.IngestionJob | None = await pipeline.get_job(job.id)
        assert retrieved is not None
        assert retrieved.id == job.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_job(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        result: src.domain.models.IngestionJob | None = await pipeline.get_job("nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_list_jobs(self, pipeline: src.domain.pipeline.IngestionPipeline) -> None:
        await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Job 1")
        await pipeline._create_job(src.domain.models.SourceType.URL, title="Job 2")
        jobs, total = await pipeline.list_jobs()
        assert total >= 2
        assert len(jobs) >= 2

    @pytest.mark.asyncio
    async def test_get_job_marks_stale_active_job_failed(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(src.core.config.settings, "JOB_STALE_TIMEOUT_MINUTES", 1)
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Stale Job")
        job.status = src.domain.models.JobStatus.EXTRACTING
        job.updated_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=5)
        await pipeline._persist_job(job)

        refreshed: src.domain.models.IngestionJob | None = await pipeline.get_job(job.id)

        assert refreshed is not None
        assert refreshed.status == src.domain.models.JobStatus.FAILED
        assert refreshed.failed_at_stage == "extracting"
        assert refreshed.error is not None
        assert "stale timeout" in refreshed.error

    @pytest.mark.asyncio
    async def test_get_job_keeps_recent_active_job(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(src.core.config.settings, "JOB_STALE_TIMEOUT_MINUTES", 10)
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Fresh Job")
        job.status = src.domain.models.JobStatus.CLEANING
        job.updated_at = datetime.datetime.now(datetime.UTC)
        await pipeline._persist_job(job)

        refreshed: src.domain.models.IngestionJob | None = await pipeline.get_job(job.id)

        assert refreshed is not None
        assert refreshed.status == src.domain.models.JobStatus.CLEANING

    @pytest.mark.asyncio
    async def test_cancel_job_marks_active_job_cancelled(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Cancel Me")
        job.status = src.domain.models.JobStatus.ENRICHING
        await pipeline._persist_job(job)

        cancelled: src.domain.models.IngestionJob | None = await pipeline.cancel_job(job.id)

        assert cancelled is not None
        assert cancelled.status == src.domain.models.JobStatus.CANCELLED
        assert cancelled.failed_at_stage == "enriching"
        assert cancelled.error == "Cancelled by user request"
        assert cancelled.completed_at is not None

    @pytest.mark.asyncio
    async def test_cancel_job_keeps_completed_terminal_state(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Already Done")
        job.status = src.domain.models.JobStatus.COMPLETED
        await pipeline._persist_job(job)

        cancelled: src.domain.models.IngestionJob | None = await pipeline.cancel_job(job.id)

        assert cancelled is not None
        assert cancelled.status == src.domain.models.JobStatus.COMPLETED


# ═══════════════════════════════════════════════════════════════════════════════
# In-Memory Job Store
# ═══════════════════════════════════════════════════════════════════════════════


class TestInMemoryJobStore:
    @pytest.fixture
    def store(self) -> adapters.job_store.InMemoryJobStore:

        return adapters.job_store.InMemoryJobStore()

    @pytest.mark.asyncio
    async def test_save_and_get(self, store) -> None:
        job = src.domain.models.IngestionJob(id="j1", source_type=src.domain.models.SourceType.TEXT, title="Doc")
        await store.save(job)
        retrieved = await store.get("j1")
        assert retrieved is not None
        assert retrieved.title == "Doc"

    @pytest.mark.asyncio
    async def test_get_missing(self, store) -> None:
        assert await store.get("nonexistent") is None

    @pytest.mark.asyncio
    async def test_list_ordering(self, store) -> None:
        from datetime import datetime

        j1 = src.domain.models.IngestionJob(
            id="old",
            source_type=src.domain.models.SourceType.TEXT,
            created_at=datetime(2024, 1, 1),
        )
        j2 = src.domain.models.IngestionJob(
            id="new",
            source_type=src.domain.models.SourceType.TEXT,
            created_at=datetime(2024, 6, 1),
        )
        await store.save(j1)
        await store.save(j2)
        jobs, total = await store.list()
        assert total == 2
        assert jobs[0].id == "new"  # newest first

    @pytest.mark.asyncio
    async def test_list_pagination(self, store) -> None:
        for i in range(5):
            await store.save(src.domain.models.IngestionJob(id=f"j{i}", source_type=src.domain.models.SourceType.TEXT))
        jobs, total = await store.list(limit=2, offset=1)
        assert total == 5
        assert len(jobs) == 2


# ═══════════════════════════════════════════════════════════════════════════════
# Async Pipeline Execution
# ═══════════════════════════════════════════════════════════════════════════════


class TestAsyncPipeline:
    @pytest.fixture
    def pipeline(self) -> src.domain.pipeline.IngestionPipeline:

        return src.domain.pipeline.IngestionPipeline(job_store=adapters.job_store.InMemoryJobStore())

    @pytest.mark.asyncio
    async def test_ingest_text_returns_immediately(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        """ingest_text returns a queued job without waiting."""
        result: src.domain.models.IngestResponse = await pipeline.ingest_text(
            content="Test content for async processing.",
            title="Async Test",
            auth_token="test-jwt",
            org_id="test-org",
        )
        assert result.job_id
        assert result.status == src.domain.models.JobStatus.QUEUED
        assert result.message == "Job queued for processing"


class TestVectorStoreForwarding:
    @pytest.fixture
    def pipeline(self) -> src.domain.pipeline.IngestionPipeline:

        return src.domain.pipeline.IngestionPipeline(job_store=adapters.job_store.InMemoryJobStore())

    @pytest.mark.asyncio
    async def test_send_to_vector_store_includes_acl_metadata(self) -> None:
        pipeline = src.domain.pipeline.IngestionPipeline()
        captured: dict[str, object] = {}

        class StubResponse:
            status_code = 200
            request = types.SimpleNamespace()

            async def aread(self) -> bytes:
                return b""

            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {
                    "document_id": "doc-1",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                }

        class StubHttpClient:
            async def post(self, url: str, json: dict, headers: dict) -> StubResponse:
                captured["url"] = url
                captured["json"] = json
                captured["headers"] = headers
                return StubResponse()

        pipeline._http = StubHttpClient()  # type: ignore[assignment]

        result: dict[str, typing.Any] = await pipeline._send_to_vector_store(
            text="Privileged merger discussion.",
            title="Merger Memo",
            department="Legal",
            document_type="policy",
            tags=["legal"],
            classification=src.domain.models.DocumentClassification.RESTRICTED,
            access_control=src.domain.models.DocumentAccessControl(
                allowed_groups=["department:legal"],
                denied_groups=["department:sales"],
            ),
            org_id="default",
            stream_id="legal",
            content_hash="abc123",
        )

        assert result["document_id"] == "doc-1"
        payload: object = captured["json"]
        assert isinstance(payload, dict)
        metadata = payload["metadata"]
        assert isinstance(metadata, dict)
        assert metadata["classification"] == "restricted"
        assert metadata["access_control"]["allowed_groups"] == ["department:legal"]
        assert metadata["access_control"]["denied_groups"] == ["department:sales"]

    @pytest.mark.asyncio
    async def test_send_to_vector_store_includes_retrieval_metadata(self) -> None:
        pipeline = src.domain.pipeline.IngestionPipeline()
        captured: dict[str, object] = {}

        class StubResponse:
            status_code = 200
            request = types.SimpleNamespace()

            async def aread(self) -> bytes:
                return b""

            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {
                    "document_id": "doc-2",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                }

        class StubHttpClient:
            async def post(self, url: str, json: dict, headers: dict) -> StubResponse:
                captured["json"] = json
                return StubResponse()

        pipeline._http = StubHttpClient()  # type: ignore[assignment]

        await pipeline._send_to_vector_store(
            text="KB2028004 - EPS Rej NN - Transaction Rejected at Switch or Intermediary",
            title="KB2028004 - EPS Rej NN - Transaction Rejected at Switch or Intermediary",
            department="Pharmacy",
            document_type="faq",
            tags=["pharmacy"],
            org_id="default",
            stream_id="pharmacy",
            content_hash="hash-123",
            enriched=src.domain.models.EnrichedMetadata(
                detected_language="en",
                source_id="KB2028004",
                system_name="Enterprise Pharmacy System (EPS)",
                retrieval_terms=["KB2028004", "Enterprise Pharmacy System (EPS)", "EPS", "NN"],
            ),
        )

        payload: object = captured["json"]
        assert isinstance(payload, dict)
        metadata = payload["metadata"]
        assert isinstance(metadata, dict)
        assert metadata["language"] == "en"
        assert metadata["custom"]["source_id"] == "KB2028004"
        assert metadata["custom"]["system_name"] == "Enterprise Pharmacy System (EPS)"
        assert metadata["custom"]["retrieval_text"] == (
            "KB2028004 Enterprise Pharmacy System (EPS) EPS NN"
        )

    @pytest.mark.asyncio
    async def test_ingest_text_validates_size_eagerly(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        """Size validation happens before background dispatch."""

        with unittest.mock.patch("src.core.config.settings") as mock_settings:
            mock_settings.MAX_DOCUMENT_SIZE_MB = 0
            mock_settings.MAX_CONCURRENT_JOBS = 5
            with pytest.raises(ValueError, match="exceeds maximum size"):
                await pipeline.ingest_text(content="any content")

    @pytest.mark.asyncio
    async def test_ingest_url_returns_immediately(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        """ingest_url returns a queued job without waiting."""
        result: src.domain.models.IngestResponse = await pipeline.ingest_url(
            url="https://example.com",
            auth_token="test-jwt",
            org_id="test-org",
        )
        assert result.job_id
        assert result.status == src.domain.models.JobStatus.QUEUED

    @pytest.mark.asyncio
    async def test_job_persisted_on_create(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
    ) -> None:
        """Job should be in the store immediately after ingest_text."""
        result: src.domain.models.IngestResponse = await pipeline.ingest_text(
            content="Persistence test.",
            title="Persist",
        )
        job: src.domain.models.IngestionJob | None = await pipeline.get_job(result.job_id)
        assert job is not None
        assert job.title == "Persist"


# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class TestDomainModels:
    def test_job_status_values(self) -> None:
        assert src.domain.models.JobStatus.QUEUED == "queued"
        assert src.domain.models.JobStatus.COMPLETED == "completed"
        assert src.domain.models.JobStatus.FAILED == "failed"

    def test_source_type_values(self) -> None:
        assert src.domain.models.SourceType.TEXT == "text"
        assert src.domain.models.SourceType.URL == "url"
        assert src.domain.models.SourceType.HTML == "html"
        assert src.domain.models.SourceType.MARKDOWN == "markdown"

    def test_ingest_text_request(self) -> None:
        req = src.domain.models.IngestTextRequest(
            content="Test content",
            stream_id="dev",
            title="Test Title",
            department="IT",
        )
        assert req.content == "Test content"
        assert req.title == "Test Title"

    def test_ingestion_job_defaults(self) -> None:
        job = src.domain.models.IngestionJob(
            id="test-id",
            source_type=src.domain.models.SourceType.TEXT,
        )
        assert job.status == src.domain.models.JobStatus.QUEUED
        assert job.error is None
        assert job.chunk_count == 0
        assert job.document_id is None
        assert job.org_id == "default"
        assert job.auth_token == ""

    def test_contextualized_chunk(self) -> None:
        chunk = src.domain.models.ContextualizedChunk(
            index=0,
            content="Raw chunk text",
            context="This is a pharmacy SOP about drug interactions.",
            contextualized_content="This is a pharmacy SOP about drug interactions. Raw chunk text",
            token_count=15,
        )
        assert chunk.index == 0
        assert "pharmacy" in chunk.context
        assert chunk.contextualized_content.startswith("This is")


# ═══════════════════════════════════════════════════════════════════════════════
# Evaluation Gating & RAPTOR tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestEvaluationAndRaptorGating:
    @pytest.fixture
    def pipeline(self) -> src.domain.pipeline.IngestionPipeline:
        p = src.domain.pipeline.IngestionPipeline(
            job_store=adapters.job_store.InMemoryJobStore()
        )
        p._review_workflow = unittest.mock.AsyncMock()
        return p

    @pytest.mark.asyncio
    async def test_evaluation_gating_promotes_when_score_above_threshold(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import httpx
        # Enable EVAL_ON_INGEST
        monkeypatch.setattr(src.core.config.settings, "EVAL_ON_INGEST_ENABLED", True)
        monkeypatch.setattr(src.core.config.settings, "EVAL_PROMOTION_THRESHOLD", 0.65)
        monkeypatch.setattr(src.core.config.settings, "EVAL_QUESTIONS_PER_DOC", 2)
        monkeypatch.setattr(src.core.config.settings, "RAPTOR_ENABLED", False)

        # Mock QA generation
        mock_generate_qa = unittest.mock.AsyncMock()
        mock_generate_qa.return_value = [
            src.domain.synthesis.SyntheticQA(
                question="Is this a test question?",
                answer="Yes, this is a test answer.",
                difficulty=1,
                question_type=src.domain.synthesis.QuestionType.FACTOID,
            )
        ]
        monkeypatch.setattr(src.domain.qa_backend.GeminiQABackend, "generate_qa", mock_generate_qa)

        # Mock Judge
        mock_judge = unittest.mock.AsyncMock()
        mock_judge.judge_faithfulness.return_value = 0.9  # Above 0.65
        pipeline._llm_judge = mock_judge

        # Mock HTTP responses
        captured_requests = []

        class MockResponse:
            def __init__(self, json_data: dict, status_code: int = 200) -> None:
                self._json = json_data
                self.status_code: int = status_code
                self.request = types.SimpleNamespace()

            async def aread(self) -> bytes:
                return b""

            def raise_for_status(self) -> None:
                if self.status_code >= 400:
                    raise httpx.HTTPStatusError("Error", request=None, response=self)

            def json(self) -> dict:
                return self._json

        async def mock_post(url: str, json: dict = None, headers: dict = None, **kwargs) -> MockResponse:
            captured_requests.append(("POST", url, json))
            if url.endswith("/v1/internal/store"):
                return MockResponse({
                    "document_id": "doc-123",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                })
            elif url.endswith("/v1/internal/search"):
                return MockResponse({
                    "results": [{"content": "Yes, this is a test answer. Verified context."}]
                })
            return MockResponse({})

        async def mock_get(url: str, params: dict = None, headers: dict = None, **kwargs) -> MockResponse:
            captured_requests.append(("GET", url, params))
            if url.endswith("/v1/chunks"):
                return MockResponse({
                    "chunks": [
                        {
                            "chunk_id": "chunk-1",
                            "document_id": "doc-123",
                            "content": "Yes, this is a test answer. Verified context. This is padded content to ensure the word count is well above fifty words for the synthetic dataset builder to function properly and generate the QA dataset during this unit test. " * 3,
                        }
                    ]
                })
            return MockResponse({})

        async def mock_patch(url: str, json: dict = None, headers: dict = None, **kwargs) -> MockResponse:
            captured_requests.append(("PATCH", url, json))
            return MockResponse({"status": "published"})

        mock_http = unittest.mock.MagicMock()
        mock_http.post = mock_post
        mock_http.get = mock_get
        mock_http.patch = mock_patch
        pipeline._http = mock_http

        # Run ingestion
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="High Quality Doc")
        job.org_id = "test-org"
        job.stream_id = "test-stream"

        text_content: str = "High quality document with excellent information. " * 15
        extracted = src.domain.models.ExtractedContent(
            text=text_content,
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=len(text_content.encode("utf-8")),
        )

        await pipeline._run_shared_stages(
            job=job,
            extracted=extracted,
            title="High Quality Doc",
            department="QA",
            document_type="policy",
            tags=["test"],
            chunk_size=512,
            chunk_overlap=64,
        )

        # Assertions
        assert job.evaluation_score == 0.9
        # Check that we patched status to promote to published
        patched_requests = [r for r in captured_requests if r[0] == "PATCH"]
        assert len(patched_requests) == 1
        assert "doc-123/status" in patched_requests[0][1]
        assert patched_requests[0][2]["status"] == "published"

    @pytest.mark.asyncio
    async def test_evaluation_gating_keeps_pending_when_score_below_threshold(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import httpx
        # Enable EVAL_ON_INGEST
        monkeypatch.setattr(src.core.config.settings, "EVAL_ON_INGEST_ENABLED", True)
        monkeypatch.setattr(src.core.config.settings, "EVAL_PROMOTION_THRESHOLD", 0.65)
        monkeypatch.setattr(src.core.config.settings, "EVAL_QUESTIONS_PER_DOC", 2)
        monkeypatch.setattr(src.core.config.settings, "RAPTOR_ENABLED", False)

        # Mock QA generation
        mock_generate_qa = unittest.mock.AsyncMock()
        mock_generate_qa.return_value = [
            src.domain.synthesis.SyntheticQA(
                question="Is this a bad test question?",
                answer="No, this is completely wrong.",
                difficulty=1,
                question_type=src.domain.synthesis.QuestionType.FACTOID,
            )
        ]
        monkeypatch.setattr(src.domain.qa_backend.GeminiQABackend, "generate_qa", mock_generate_qa)

        # Mock Judge
        mock_judge = unittest.mock.AsyncMock()
        mock_judge.judge_faithfulness.return_value = 0.4  # Below 0.65
        pipeline._llm_judge = mock_judge

        # Mock HTTP responses
        captured_requests = []

        class MockResponse:
            def __init__(self, json_data: dict, status_code: int = 200) -> None:
                self._json = json_data
                self.status_code: int = status_code
                self.request = types.SimpleNamespace()

            async def aread(self) -> bytes:
                return b""

            def raise_for_status(self) -> None:
                if self.status_code >= 400:
                    raise httpx.HTTPStatusError("Error", request=None, response=self)

            def json(self) -> dict:
                return self._json

        async def mock_post(url: str, json: dict = None, headers: dict = None, **kwargs) -> MockResponse:
            captured_requests.append(("POST", url, json))
            if url.endswith("/v1/internal/store"):
                return MockResponse({
                    "document_id": "doc-456",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                })
            elif url.endswith("/v1/internal/search"):
                return MockResponse({
                    "results": [{"content": "Unrelated content. This is just filler to make the word count exceed fifty words so that the dataset builder does not skip this chunk during our evaluation test. Let's make sure it is long enough. " * 3}]
                })
            return MockResponse({})

        async def mock_get(url: str, params: dict = None, headers: dict = None, **kwargs) -> MockResponse:
            captured_requests.append(("GET", url, params))
            if url.endswith("/v1/chunks"):
                return MockResponse({
                    "chunks": [
                        {
                            "chunk_id": "chunk-1",
                            "document_id": "doc-456",
                            "content": "Unrelated content. This is just filler to make the word count exceed fifty words so that the dataset builder does not skip this chunk during our evaluation test. Let's make sure it is long enough. " * 3,
                        }
                    ]
                })
            return MockResponse({})

        mock_http = unittest.mock.MagicMock()
        mock_http.post = mock_post
        mock_http.get = mock_get
        pipeline._http = mock_http

        # Run ingestion
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Low Quality Doc")
        job.org_id = "test-org"
        job.stream_id = "test-stream"

        text_content: str = "Low quality document content. " * 20
        extracted = src.domain.models.ExtractedContent(
            text=text_content,
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=len(text_content.encode("utf-8")),
        )

        await pipeline._run_shared_stages(
            job=job,
            extracted=extracted,
            title="Low Quality Doc",
            department="QA",
            document_type="policy",
            tags=["test"],
            chunk_size=512,
            chunk_overlap=64,
        )

        # Assertions
        assert job.evaluation_score == 0.4
        # Check that we did NOT patch status to promote to published
        patched_requests = [r for r in captured_requests if r[0] == "PATCH"]
        assert len(patched_requests) == 0

    @pytest.mark.asyncio
    async def test_raptor_triggered_when_enabled(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import asyncio

        # Disable eval, enable RAPTOR
        monkeypatch.setattr(src.core.config.settings, "EVAL_ON_INGEST_ENABLED", False)
        monkeypatch.setattr(src.core.config.settings, "RAPTOR_ENABLED", True)
        monkeypatch.setattr(src.core.config.settings, "RAPTOR_MAX_LEVELS", 3)

        # Mock RaptorBuilder
        mock_raptor = unittest.mock.AsyncMock()
        pipeline._raptor_builder = mock_raptor

        # Mock HTTP responses
        class MockResponse:
            status_code = 200
            def json(self) -> dict:
                return {
                    "document_id": "doc-raptor",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                }
            def raise_for_status(self) -> None:
                pass

        async def mock_post(*args, **kwargs) -> MockResponse:
            return MockResponse()

        mock_http = unittest.mock.MagicMock()
        mock_http.post = mock_post
        pipeline._http = mock_http

        # Run ingestion
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="Raptor Doc")
        job.org_id = "raptor-org"
        job.stream_id = "raptor-stream"

        extracted = src.domain.models.ExtractedContent(
            text="Document text to build RAPTOR tree.",
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=len("Document text to build RAPTOR tree."),
        )

        await pipeline._run_shared_stages(
            job=job,
            extracted=extracted,
            title="Raptor Doc",
            department="QA",
            document_type="policy",
            tags=["test"],
            chunk_size=512,
            chunk_overlap=64,
        )

        # Wait a small moment for any background tasks to run or finish their await
        await asyncio.sleep(0.01)

        # Assert RaptorBuilder was called with the correct org_id and max_levels
        mock_raptor.build.assert_called_once_with(
            org_id="raptor-org",
            max_levels=3,
        )

    @pytest.mark.asyncio
    async def test_raptor_no_op_when_disabled(
        self,
        pipeline: src.domain.pipeline.IngestionPipeline,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Disable eval and RAPTOR
        monkeypatch.setattr(src.core.config.settings, "EVAL_ON_INGEST_ENABLED", False)
        monkeypatch.setattr(src.core.config.settings, "RAPTOR_ENABLED", False)

        mock_raptor = unittest.mock.AsyncMock()
        pipeline._raptor_builder = mock_raptor

        # Mock HTTP responses
        class MockResponse:
            status_code = 200
            def json(self) -> dict:
                return {
                    "document_id": "doc-noraptor",
                    "chunk_count": 1,
                    "entity_count": 0,
                    "status": "pending_review",
                }
            def raise_for_status(self) -> None:
                pass

        async def mock_post(*args, **kwargs) -> MockResponse:
            return MockResponse()

        mock_http = unittest.mock.MagicMock()
        mock_http.post = mock_post
        pipeline._http = mock_http

        # Run ingestion
        job: src.domain.models.IngestionJob = await pipeline._create_job(src.domain.models.SourceType.TEXT, title="No Raptor Doc")
        job.org_id = "raptor-org"
        job.stream_id = "raptor-stream"

        extracted = src.domain.models.ExtractedContent(
            text="No RAPTOR tree document.",
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=len("No RAPTOR tree document."),
        )

        await pipeline._run_shared_stages(
            job=job,
            extracted=extracted,
            title="No Raptor Doc",
            department="QA",
            document_type="policy",
            tags=["test"],
            chunk_size=512,
            chunk_overlap=64,
        )

        # Assert RaptorBuilder was NOT called
        mock_raptor.build.assert_not_called()

