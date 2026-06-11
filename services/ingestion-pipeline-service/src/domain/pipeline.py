"""
Ingestion Pipeline — document processing orchestration.

Coordinates the multi-stage document processing flow:
    Extract → Clean → Enrich → Contextualize → Index

Each stage is a pure function that transforms data without side effects,
making the pipeline testable and debuggable. The pipeline coordinator
manages stage sequencing, concurrency, retry, and error handling.

Architecture:
    The pipeline owns: extract, clean, enrich, and (optionally) Gemini
    contextualization. It delegates chunking + embedding + indexing to the
    knowledge-api. Auth tokens from the originating JWT are forwarded
    to all downstream service calls for org_id tenant isolation.

    Concurrency is controlled by an asyncio.Semaphore — at most
    MAX_CONCURRENT_JOBS pipelines run in parallel. Jobs are dispatched
    to background tasks so the HTTP handler returns immediately with
    a job ID (the UI polls for status).

    Failed vector-store calls are retried with exponential backoff +
    jitter (up to RETRY_MAX_ATTEMPTS) before the job is marked failed.
"""

from __future__ import annotations

import _csv
import asyncio
import datetime
import random
import re
import time
import typing
import uuid

from .quality_gates import QualityReport
import docx.document
import httpx
import shared.http_client

import src.adapters.analytics_client
import src.core.config
import src.core.logging
import src.domain.models

UNSCOPED_INGEST_ANALYTICS_SCOPE = "unscoped-ingest"

_KB_SOURCE_ID_PATTERN: re.Pattern[str] = re.compile(r"\bKB\d{7}\b", re.IGNORECASE)
_SHORT_SIGNAL_PATTERN: re.Pattern[str] = re.compile(r"\b(?:[A-Z]{1,4}\d{0,2}|\d{2,3})\b")
_IGNORED_SIGNAL_TOKENS: set[str] = {
    "A",
    "AN",
    "AND",
    "API",
    "ARE",
    "DOC",
    "DOCX",
    "EPS",
    "FAQ",
    "FOR",
    "FROM",
    "IN",
    "INTO",
    "IS",
    "KB",
    "MD",
    "OF",
    "ON",
    "OR",
    "PDF",
    "SOP",
    "THE",
    "TO",
    "TXT",
}
_SYSTEM_SIGNAL_PATTERNS: tuple[tuple[re.Pattern[str], str], tuple[re.Pattern[str], str]] = (
    (
        re.compile(r"enterprise pharmacy system\s*\(eps\)", re.IGNORECASE),
        "Enterprise Pharmacy System (EPS)",
    ),
    (re.compile(r"\beps\b", re.IGNORECASE), "Enterprise Pharmacy System (EPS)"),
)


def _dedupe_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        token: str = str(value).strip()
        if not token:
            continue
        key: str = token.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(token)
    return deduped


class IngestionPipeline:
    """
    Orchestrates the document ingestion flow.

    Manages the lifecycle of ingestion jobs, processes documents through
    extract → clean → enrich → (contextualize) → index stages, and
    delegates to the vector-store service for chunking, embedding, and
    indexing.

    Adapters (injected at construction):
        job_store      — Memorystore Redis or in-memory fallback
        document_store — Cloud Storage landing zone or no-op

    Concurrency: bounded by asyncio.Semaphore(MAX_CONCURRENT_JOBS).
    Resilience: exponential backoff retry on downstream failures.
    Auth: JWT forwarded to vector-store for org_id tenant scoping.
    """

    def __init__(
        self,
        job_store: typing.Any = None,
        document_store: typing.Any = None,
        analytics: src.adapters.analytics_client.AnalyticsClient | None = None,
        raptor_builder: typing.Any = None,
        llm_judge: typing.Any = None,
    ) -> None:
        self._job_store = job_store
        self._doc_store = document_store
        self._analytics: src.adapters.analytics_client.AnalyticsClient | None = analytics
        self._raptor_builder = raptor_builder
        self._llm_judge = llm_judge
        self._http: httpx.AsyncClient = shared.http_client.create_service_client(
            "knowledge-pipeline",
            timeout=60.0,
        )
        self._semaphore = asyncio.Semaphore(src.core.config.settings.MAX_CONCURRENT_JOBS)
        self._background_tasks: set[asyncio.Task] = set()
        self._review_workflow: typing.Any | None = None
        self._change_detector: typing.Any | None = None

    def set_review_workflow(self, review_workflow: typing.Any) -> None:
        """Attach review workflow so every successful ingest is governed server-side."""
        self._review_workflow = review_workflow

    def set_change_detector(self, change_detector: typing.Any) -> None:
        """Attach version tracking so source refs can be recorded across ingests."""
        self._change_detector = change_detector

    async def close(self) -> None:
        """Cancel pending tasks and close HTTP connections + adapters."""
        for task in self._background_tasks:
            task.cancel()
        await self._http.aclose()
        if self._job_store:
            await self._job_store.close()
        if self._doc_store:
            await self._doc_store.close()

    # ═══════════════════════════════════════════════════════════════════════
    # Analytics helpers
    # ═══════════════════════════════════════════════════════════════════════

    def _emit_ingest_completed(self, job: src.domain.models.IngestionJob) -> None:
        """Fire a kb.ingest event on successful pipeline completion."""
        if not self._analytics:
            return
        analytics_scope: str = str(job.stream_id or "").strip() or UNSCOPED_INGEST_ANALYTICS_SCOPE
        self._analytics.fire(
            "kb.ingest",
            org_id=job.org_id,
            scope=analytics_scope,
            payload={
                "job_id": job.id,
                "source_type": job.source_type.value,
                "document_id": job.document_id,
                "chunk_count": job.chunk_count,
                "entity_count": job.entity_count,
                "raw_size_bytes": job.raw_size_bytes,
                "clean_size_bytes": job.clean_size_bytes,
                "processing_time_ms": round(job.processing_time_ms, 1),
                "status": "completed",
                "stream_id": job.stream_id,
            },
        )

    def _emit_ingest_failed(self, job: src.domain.models.IngestionJob) -> None:
        """Fire a kb.ingest event on pipeline failure."""
        if not self._analytics:
            return
        analytics_scope: str = str(job.stream_id or "").strip() or UNSCOPED_INGEST_ANALYTICS_SCOPE
        self._analytics.fire(
            "kb.ingest",
            org_id=job.org_id,
            scope=analytics_scope,
            payload={
                "job_id": job.id,
                "source_type": job.source_type.value,
                "processing_time_ms": round(job.processing_time_ms, 1),
                "status": "failed",
                "failed_at_stage": job.failed_at_stage,
                "error": (job.error or "")[:200],
                "stream_id": job.stream_id,
            },
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Public API — returns immediately, processing runs in background
    # ═══════════════════════════════════════════════════════════════════════

    async def ingest_text(
        self,
        content: str,
        title: str = "",
        department: str = "",
        document_type: str = "general",
        tags: list[str] | None = None,
        classification: src.domain.models.DocumentClassification = (
            src.domain.models.DocumentClassification.INTERNAL
        ),
        access_control: src.domain.models.DocumentAccessControl | None = None,
        stream_id: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        chunk_strategy: str = "sentence",
        auth_token: str = "",
        org_id: str = "default",
    ) -> src.domain.models.IngestResponse:
        """
        Submit raw text for ingestion. Returns immediately with a job ID.

        Pipeline stages (run in background):
            1. Extract — validate + wrap raw text
            2. Clean — normalize whitespace, remove control chars
            3. Enrich — extract metadata (title, dates, entities)
            4. Contextualize — (optional) Gemini summary per chunk
            5. Index — send to vector-store for chunking + embedding
        """
        # Validate eagerly (before background dispatch)
        byte_count: int = len(content.encode("utf-8"))
        max_bytes: int = src.core.config.settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
        if byte_count > max_bytes:
            raise ValueError(
                f"Document exceeds maximum size: {byte_count / (1024 * 1024):.1f}MB "
                f"(limit: {src.core.config.settings.MAX_DOCUMENT_SIZE_MB}MB)"
            )

        job: src.domain.models.IngestionJob = await self._create_job(
            source_type=src.domain.models.SourceType.TEXT,
            title=title,
            department=department,
            document_type=document_type,
            tags=tags or [],
            classification=classification,
            access_control=access_control or src.domain.models.DocumentAccessControl(),
            stream_id=stream_id,
            auth_token=auth_token,
            org_id=org_id,
        )

        # Dispatch to background
        task: asyncio.Task[None] = asyncio.create_task(
            self._run_text_pipeline(
                job,
                content,
                title,
                department,
                document_type,
                tags or [],
                chunk_size,
                chunk_overlap,
            )
        )
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

        return src.domain.models.IngestResponse(
            job_id=job.id,
            status=job.status,
            title=title or "",
            message="Job queued for processing",
        )

    async def ingest_url(
        self,
        url: str,
        title: str = "",
        department: str = "",
        document_type: str = "general",
        tags: list[str] | None = None,
        classification: src.domain.models.DocumentClassification = (
            src.domain.models.DocumentClassification.INTERNAL
        ),
        access_control: src.domain.models.DocumentAccessControl | None = None,
        stream_id: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        auth_token: str = "",
        org_id: str = "default",
    ) -> src.domain.models.IngestResponse:
        """
        Submit a URL for ingestion. Returns immediately with a job ID.
        """
        job: src.domain.models.IngestionJob = await self._create_job(
            source_type=src.domain.models.SourceType.URL,
            source_ref=url,
            title=title,
            department=department,
            document_type=document_type,
            tags=tags or [],
            classification=classification,
            access_control=access_control or src.domain.models.DocumentAccessControl(),
            stream_id=stream_id,
            auth_token=auth_token,
            org_id=org_id,
        )

        task: asyncio.Task[None] = asyncio.create_task(
            self._run_url_pipeline(
                job, url, title, department, document_type, tags or [], chunk_size, chunk_overlap
            )
        )
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

        return src.domain.models.IngestResponse(
            job_id=job.id,
            status=job.status,
            title=title or url,
            message="URL job queued for processing",
        )

    async def ingest_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "",
        title: str = "",
        department: str = "",
        source_ref: str = "",
        document_type: str = "general",
        tags: list[str] | None = None,
        classification: src.domain.models.DocumentClassification = (
            src.domain.models.DocumentClassification.INTERNAL
        ),
        access_control: src.domain.models.DocumentAccessControl | None = None,
        stream_id: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        auth_token: str = "",
        org_id: str = "default",
    ) -> src.domain.models.IngestResponse:
        """
        Submit an uploaded file for ingestion. Returns immediately with a job ID.

        Supported formats: PDF, DOCX, TXT, CSV, Markdown.
        Text is extracted from the file, then processed through the standard
        pipeline (clean → enrich → contextualize → index).
        """
        max_bytes: int = src.core.config.settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise ValueError(
                f"File exceeds maximum size: {len(file_bytes) / (1024 * 1024):.1f}MB "
                f"(limit: {src.core.config.settings.MAX_DOCUMENT_SIZE_MB}MB)"
            )

        job: src.domain.models.IngestionJob = await self._create_job(
            source_type=src.domain.models.SourceType.FILE,
            source_ref=source_ref or filename,
            title=title or filename,
            department=department,
            document_type=document_type,
            tags=tags or [],
            classification=classification,
            access_control=access_control or src.domain.models.DocumentAccessControl(),
            stream_id=stream_id,
            auth_token=auth_token,
            org_id=org_id,
        )

        task: asyncio.Task[None] = asyncio.create_task(
            self._run_file_pipeline(
                job,
                file_bytes,
                filename,
                content_type,
                title,
                department,
                document_type,
                tags or [],
                chunk_size,
                chunk_overlap,
            )
        )
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

        return src.domain.models.IngestResponse(
            job_id=job.id,
            status=job.status,
            title=title or filename,
            message=f"File '{filename}' queued for processing",
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Background Pipeline Execution (semaphore-bounded)
    # ═══════════════════════════════════════════════════════════════════════

    async def _run_text_pipeline(
        self,
        job: src.domain.models.IngestionJob,
        content: str,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        """Run the full text ingestion pipeline under the semaphore."""
        async with self._semaphore:
            start: float = time.perf_counter()
            try:
                # Archive raw document to GCS (fire-and-forget)
                await self._archive_to_gcs(
                    job,
                    content,
                    {"title": title, "department": department},
                )

                # Stage 1: Extract
                job.status = src.domain.models.JobStatus.EXTRACTING
                await self._persist_job(job)
                extracted: src.domain.models.ExtractedContent = self._extract_text(content)
                job.raw_size_bytes = extracted.byte_count

                # Stages 2–5: shared pipeline
                await self._run_shared_stages(
                    job,
                    extracted,
                    title,
                    department,
                    document_type,
                    tags,
                    chunk_size,
                    chunk_overlap,
                )

                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_completed(job)
                src.core.logging.logger.info(
                    "Text ingestion completed",
                    extra={
                        "job_id": job.id,
                        "org_id": job.org_id,
                        "document_id": job.document_id,
                        "chunks": job.chunk_count,
                        "time_ms": round(job.processing_time_ms, 1),
                    },
                )

            except Exception as exc:
                job.failed_at_stage = job.status.value
                job.status = src.domain.models.JobStatus.FAILED
                job.error = str(exc)
                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_failed(job)
                src.core.logging.logger.error(
                    "Text ingestion failed",
                    extra={"job_id": job.id, "org_id": job.org_id, "error": str(exc)},
                )

    async def _run_url_pipeline(
        self,
        job: src.domain.models.IngestionJob,
        url: str,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        """Run the full URL ingestion pipeline under the semaphore."""
        async with self._semaphore:
            start: float = time.perf_counter()
            try:
                # Stage 1: Extract from URL
                job.status = src.domain.models.JobStatus.EXTRACTING
                await self._persist_job(job)
                extracted: src.domain.models.ExtractedContent = await self._extract_url(url)
                job.raw_size_bytes = extracted.byte_count

                # Archive fetched content to GCS
                await self._archive_to_gcs(
                    job,
                    extracted.text,
                    {"title": title, "url": url, "department": department},
                )

                # Stages 2–5: shared pipeline
                await self._run_shared_stages(
                    job,
                    extracted,
                    title,
                    department,
                    document_type,
                    tags,
                    chunk_size,
                    chunk_overlap,
                )

                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_completed(job)
                src.core.logging.logger.info(
                    "URL ingestion completed",
                    extra={
                        "job_id": job.id,
                        "org_id": job.org_id,
                        "url": url,
                        "document_id": job.document_id,
                        "chunks": job.chunk_count,
                        "time_ms": round(job.processing_time_ms, 1),
                    },
                )

            except Exception as exc:
                job.failed_at_stage = job.status.value
                job.status = src.domain.models.JobStatus.FAILED
                job.error = str(exc)
                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_failed(job)
                src.core.logging.logger.error(
                    "URL ingestion failed",
                    extra={"job_id": job.id, "org_id": job.org_id, "url": url, "error": str(exc)},
                )

    async def _run_file_pipeline(
        self,
        job: src.domain.models.IngestionJob,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        """Run the full file ingestion pipeline under the semaphore."""
        async with self._semaphore:
            start: float = time.perf_counter()
            try:
                # Stage 1: Extract text from file
                job.status = src.domain.models.JobStatus.EXTRACTING
                await self._persist_job(job)
                extracted: src.domain.models.ExtractedContent = await self._extract_file(
                    file_bytes,
                    filename,
                    content_type,
                )
                job.raw_size_bytes = extracted.byte_count

                # Archive raw file content to GCS
                await self._archive_to_gcs(
                    job,
                    extracted.text,
                    {
                        "title": title,
                        "filename": filename,
                        "department": department,
                        "content_type": content_type,
                    },
                )

                # Stages 2–5: shared pipeline
                await self._run_shared_stages(
                    job,
                    extracted,
                    title or filename,
                    department,
                    document_type,
                    tags,
                    chunk_size,
                    chunk_overlap,
                )

                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_completed(job)
                src.core.logging.logger.info(
                    "File ingestion completed",
                    extra={
                        "job_id": job.id,
                        "org_id": job.org_id,
                        "file_name": filename,
                        "document_id": job.document_id,
                        "chunks": job.chunk_count,
                        "time_ms": round(job.processing_time_ms, 1),
                    },
                )

            except Exception as exc:
                job.failed_at_stage = job.status.value
                job.status = src.domain.models.JobStatus.FAILED
                job.error = str(exc)
                job.processing_time_ms = (time.perf_counter() - start) * 1000
                await self._persist_job(job)
                self._emit_ingest_failed(job)
                src.core.logging.logger.error(
                    "File ingestion failed",
                    extra={
                        "job_id": job.id,
                        "org_id": job.org_id,
                        "file_name": filename,
                        "error": str(exc),
                    },
                )

    async def _run_shared_stages(
        self,
        job: src.domain.models.IngestionJob,
        extracted: src.domain.models.ExtractedContent,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        """Stages 2–5 shared by text and URL pipelines."""
        version_result = None

        # Stage 2: Clean
        job.status = src.domain.models.JobStatus.CLEANING
        await self._persist_job(job)
        cleaned: src.domain.models.CleanedContent = self._clean(extracted)
        job.clean_size_bytes = cleaned.cleaned_length

        if self._change_detector and job.source_ref:
            try:
                version_result = await self._change_detector.detect(
                    org_id=job.org_id,
                    source_ref=job.source_ref,
                    content=cleaned.text,
                )
            except Exception as exc:
                src.core.logging.logger.warning(
                    "Version detection skipped (non-fatal)",
                    extra={"job_id": job.id, "source_ref": job.source_ref, "error": str(exc)},
                )

        # Stage 3: Enrich (metadata extraction) + quality scoring
        job.status = src.domain.models.JobStatus.ENRICHING
        await self._persist_job(job)
        enriched: src.domain.models.EnrichedMetadata = self._enrich(cleaned)
        if not title and enriched.title:
            job.title = enriched.title
            title = enriched.title

        # Run quality scoring now while we still have the cleaned text.
        # The result is forwarded to the review record so reviewers see
        # it immediately without having to trigger a separate check.
        quality_report: dict | None = None
        trust_score: float | None = None
        fingerprint: str = ""
        try:
            from src.domain.quality_gates import content_hash, score_quality

            qr: QualityReport = score_quality(cleaned.text, title)
            quality_report = qr.to_dict()
            trust_score = round(qr.overall_score, 1)
            fingerprint = content_hash(cleaned.text)
        except Exception as exc:
            src.core.logging.logger.debug(
                "Quality scoring skipped",
                extra={"error": str(exc)},
            )

        # Stage 4 (optional): LLM chunk contextualization
        # When enabled, the pipeline pre-chunks the text and generates
        # a context summary for each chunk before sending to vector-store.
        contextualized_text = cleaned.text
        if src.core.config.settings.LLM_ENABLED:
            job.status = src.domain.models.JobStatus.CHUNKING
            await self._persist_job(job)
            contextualized_text: str = await self._contextualize_with_llm(
                cleaned.text,
                title,
                department,
            )

        # Stage 5: Send to vector-store for embedding + indexing
        job.status = src.domain.models.JobStatus.INDEXING
        await self._persist_job(job)
        result: dict[str, typing.Any] = await self._send_to_vector_store(
            text=contextualized_text,
            title=title or "Untitled Document",
            department=department,
            document_type=document_type,
            tags=tags,
            classification=job.classification,
            access_control=job.access_control,
            org_id=job.org_id,
            stream_id=job.stream_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            content_hash=fingerprint,
            enriched=enriched,
        )

        job.document_id = result.get("document_id")
        job.chunk_count = result.get("chunk_count", 0)
        job.entity_count = result.get("entity_count", 0)

        if src.core.config.settings.EVAL_ON_INGEST_ENABLED and job.document_id:
            src.core.logging.logger.info(
                "Evaluation gating enabled. Starting automatic QA-based evaluation...",
                extra={"job_id": job.id, "document_id": job.document_id},
            )
            try:
                score = await self._evaluate_and_gate(
                    org_id=job.org_id,
                    document_id=job.document_id,
                    stream_id=job.stream_id,
                )
                job.evaluation_score = score
                
                # Check threshold for promotion
                if score >= src.core.config.settings.EVAL_PROMOTION_THRESHOLD:
                    src.core.logging.logger.info(
                        "Document promoted to published status",
                        extra={"document_id": job.document_id, "score": score, "threshold": src.core.config.settings.EVAL_PROMOTION_THRESHOLD},
                    )
                    # Call PATCH status to promote to published
                    patch_url = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/internal/documents/{job.document_id}/status"
                    patch_headers = {
                        "Content-Type": "application/json",
                        "X-Service-Name": "knowledge-pipeline-service",
                    }
                    if src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET:
                        patch_headers["X-Pipeline-Secret"] = src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET
                    
                    patch_payload = {
                        "status": "published",
                        "org_id": job.org_id,
                        "stream_id": job.stream_id,
                    }
                    patch_resp = await self._http.patch(patch_url, json=patch_payload, headers=patch_headers)
                    patch_resp.raise_for_status()
                else:
                    src.core.logging.logger.info(
                        "Document kept in pending_review status",
                        extra={"document_id": job.document_id, "score": score, "threshold": src.core.config.settings.EVAL_PROMOTION_THRESHOLD},
                    )
            except Exception as exc:
                src.core.logging.logger.error(
                    "Evaluation gating failed",
                    extra={"job_id": job.id, "document_id": job.document_id, "error": str(exc)},
                )

        if src.core.config.settings.RAPTOR_ENABLED and self._raptor_builder:
            src.core.logging.logger.info(
                "RAPTOR enabled. Spawning background tree building task...",
                extra={"org_id": job.org_id},
            )
            task = asyncio.create_task(
                self._raptor_builder.build(
                    org_id=job.org_id,
                    max_levels=src.core.config.settings.RAPTOR_MAX_LEVELS,
                )
            )
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

        if (
            self._change_detector
            and version_result is not None
            and version_result.should_reingest
            and job.document_id
        ):
            try:
                await self._change_detector.record_version(
                    version_result,
                    job.document_id,
                    org_id=job.org_id,
                    metadata={
                        "source_type": job.source_type.value,
                        "title": title,
                        "document_type": document_type,
                        "stream_id": job.stream_id,
                    },
                )
            except Exception as exc:
                src.core.logging.logger.warning(
                    "Version recording skipped (non-fatal)",
                    extra={"job_id": job.id, "source_ref": job.source_ref, "error": str(exc)},
                )

        await self._submit_review_record(
            job=job,
            title=title,
            department=department,
            document_type=document_type,
            tags=tags,
            quality_report=quality_report,
            trust_score=trust_score,
            is_reingestion=bool(version_result and version_result.previous_version),
        )
        job.status = src.domain.models.JobStatus.COMPLETED
        job.completed_at = datetime.datetime.now(datetime.UTC)
        await self._persist_job(job)

    async def _submit_review_record(
        self,
        job: src.domain.models.IngestionJob,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        quality_report: dict | None = None,
        trust_score: float | None = None,
        is_reingestion: bool = False,
    ) -> None:
        """
        Create governance review record for every successful ingestion.

        This hardens policy enforcement at the pipeline layer so knowledge
        cannot bypass review if ingested outside the UI.
        """
        if not job.document_id:
            raise RuntimeError("Cannot create review record without document_id")
        if not self._review_workflow:
            raise RuntimeError("Review workflow is not configured")
        try:
            from src.domain.review import SubmitRequest

            await self._review_workflow.submit(
                request=SubmitRequest(
                    document_id=job.document_id,
                    stream_id=job.stream_id,
                    source_ref=job.source_ref,
                    title=title or job.title,
                    department=department or job.department,
                    document_type=document_type or job.document_type,
                    tags=tags or job.tags,
                    submitted_by="pipeline",
                    quality_report=quality_report,
                    trust_score=trust_score,
                ),
                org_id=job.org_id,
                is_reingestion=is_reingestion,
            )
        except Exception as exc:
            src.core.logging.logger.error(
                "Auto review submit failed",
                extra={"job_id": job.id, "document_id": job.document_id, "error": str(exc)},
            )
            raise RuntimeError("Auto review submit failed") from exc

    # ═══════════════════════════════════════════════════════════════════════
    # Stage 1: Extraction
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _extract_text(content: str) -> src.domain.models.ExtractedContent:
        """
        Wrap raw text in an ExtractedContent envelope.
        Validates size limits and encoding.
        """
        byte_count: int = len(content.encode("utf-8"))
        max_bytes: int = src.core.config.settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
        if byte_count > max_bytes:
            raise ValueError(
                f"Document exceeds maximum size: {byte_count / (1024 * 1024):.1f}MB "
                f"(limit: {src.core.config.settings.MAX_DOCUMENT_SIZE_MB}MB)"
            )

        return src.domain.models.ExtractedContent(
            text=content,
            source_type=src.domain.models.SourceType.TEXT,
            byte_count=byte_count,
        )

    @staticmethod
    async def _extract_file(
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> src.domain.models.ExtractedContent:
        """
        Extract text from an uploaded file.

        Supports: PDF, DOCX, TXT, CSV, Markdown, Images.
        Uses GCP Document AI for PDFs and images when enabled, and falls back to
        PyPDF and python-docx.
        """
        ext: str = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        ct: str = content_type.lower()

        # ── Images ──────────────────────────────────────────────────
        is_image = ext in ("png", "jpg", "jpeg", "tiff", "tif", "bmp", "gif", "webp") or ct.startswith("image/")
        if is_image:
            from src.adapters.document_ai import create_document_extractor
            extractor = await create_document_extractor()
            try:
                mime_type = ct if ct.startswith("image/") else f"image/{ext if ext != 'jpg' else 'jpeg'}"
                extracted = await extractor.extract_image(
                    content=file_bytes,
                    mime_type=mime_type,
                    filename=filename,
                )
                metadata = extracted.metadata or {}
                metadata.update({"content_type": content_type})
                return src.domain.models.ExtractedContent(
                    text=extracted.text,
                    source_type=src.domain.models.SourceType.FILE,
                    byte_count=len(file_bytes),
                    metadata=metadata,
                )
            finally:
                await extractor.close()

        # ── Plain text / Markdown ───────────────────────────────────
        elif ext in ("txt", "md", "markdown") or "text/plain" in ct:
            text: str = file_bytes.decode("utf-8", errors="replace")

        # ── CSV ─────────────────────────────────────────────────────
        elif ext == "csv" or "text/csv" in ct:
            import csv
            import io

            decoded: str = file_bytes.decode("utf-8", errors="replace")
            reader: _csv.Reader = csv.reader(io.StringIO(decoded))
            rows: list[list[str]] = list(reader)
            # Convert CSV rows into readable text
            if rows:
                headers: list[str] = rows[0]
                lines = []
                for row in rows[1:]:
                    parts: list[str] = [
                        f"{header}: {value}"
                        for header, value in zip(headers, row, strict=False)
                        if value.strip()
                    ]
                    lines.append(". ".join(parts))
                text: str = "\n".join(lines)
            else:
                text: str = decoded

        # ── PDF ─────────────────────────────────────────────────────
        elif ext == "pdf" or "application/pdf" in ct:
            from src.adapters.document_ai import create_document_extractor
            extractor = await create_document_extractor()
            try:
                extracted = await extractor.extract_pdf(file_bytes, filename)
                text = extracted.text
                metadata = extracted.metadata or {}
                metadata.update({"content_type": content_type})
                if not text.strip():
                    raise ValueError(
                        "PDF appears to be empty or image-based with no extractable text."
                    )
                return src.domain.models.ExtractedContent(
                    text=text,
                    source_type=src.domain.models.SourceType.FILE,
                    byte_count=len(file_bytes),
                    metadata=metadata,
                )
            finally:
                await extractor.close()

        # ── DOCX ────────────────────────────────────────────────────
        elif ext == "docx" or "officedocument.wordprocessingml" in ct:
            try:
                import io

                from docx import Document as DocxDocument

                doc: docx.document.Document = DocxDocument(io.BytesIO(file_bytes))
                paragraphs: list[str] = [
                    paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()
                ]
                text: str = "\n\n".join(paragraphs)
                if not text.strip():
                    raise ValueError("DOCX file appears to be empty.")
            except ImportError as exc:
                raise ValueError(
                    "DOCX processing requires python-docx. Install with: pip install python-docx"
                ) from exc

        else:
            # Attempt to decode as UTF-8 text
            try:
                text: str = file_bytes.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise ValueError(
                    f"Unsupported file type: .{ext} "
                    f"(content-type: {content_type}). "
                    "Supported: PDF, DOCX, TXT, CSV, Markdown, Images."
                ) from exc

        return src.domain.models.ExtractedContent(
            text=text,
            source_type=src.domain.models.SourceType.FILE,
            byte_count=len(file_bytes),
            metadata={"filename": filename, "content_type": content_type},
        )

    async def _extract_url(self, url: str) -> src.domain.models.ExtractedContent:
        """
        Fetch a web page and extract its text content.

        Uses BeautifulSoup to strip HTML tags and extract readable text.
        Preserves heading structure for better chunking.
        """
        try:
            resp: httpx.Response = await self._http.get(url, follow_redirects=True)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ValueError(f"Failed to fetch URL: {exc}") from exc

        html: str = resp.text
        text: str = self._strip_html(html)

        return src.domain.models.ExtractedContent(
            text=text,
            source_type=src.domain.models.SourceType.URL,
            byte_count=len(text.encode("utf-8")),
            metadata={"url": url, "status_code": resp.status_code},
        )

    @staticmethod
    def _strip_html(html: str) -> str:
        """
        Strip HTML tags and extract readable text.

        Uses BeautifulSoup for robust HTML parsing. Falls back to regex
        if BeautifulSoup is not available.
        """
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "html.parser")
            # Remove script and style elements
            for element in soup(["script", "style", "nav", "footer", "header"]):
                element.decompose()
            text: str = soup.get_text(separator="\n")
        except ImportError:
             # Fallback: simple regex HTML stripping
            text: str = re.sub(r"<[^>]+>", " ", html)

        return text

    # ═══════════════════════════════════════════════════════════════════════
    # Stage 2: Cleaning
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _clean(extracted: src.domain.models.ExtractedContent) -> src.domain.models.CleanedContent:
        """
        Normalize and clean extracted text.

        Operations:
            1. Remove control characters (except newlines)
            2. Normalize Unicode (NFC form)
            3. Collapse multiple blank lines into one
            4. Collapse multiple spaces into one
            5. Strip leading/trailing whitespace per line
            6. Remove zero-width characters
        """
        import unicodedata

        text: str = extracted.text
        original_length: int = len(text)
        changes: list[str] = []

        # Remove control chars except newline, tab
        cleaned: str = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        if cleaned != text:
            changes.append("removed_control_chars")

        # Normalize Unicode
        cleaned: str = unicodedata.normalize("NFC", cleaned)

        # Remove zero-width characters
        cleaned: str = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", cleaned)

        # Collapse multiple blank lines into double newline
        cleaned: str = re.sub(r"\n\s*\n\s*\n+", "\n\n", cleaned)
        if "collapsed_blank_lines" not in changes and cleaned != text:
            changes.append("collapsed_blank_lines")

        # Collapse multiple spaces
        cleaned: str = re.sub(r"[ \t]+", " ", cleaned)

        # Strip leading/trailing whitespace per line
        lines: list[str] = [line.strip() for line in cleaned.split("\n")]
        cleaned: str = "\n".join(lines).strip()

        # In-Pipeline PII Redaction (Phase 8 Governance)
        from src.core.config import settings
        from src.domain.quality_gates import redact_pii
        if getattr(settings, "PII_REDACTION_ENABLED", True):
            res = redact_pii(cleaned)
            if res.redactions_applied > 0:
                cleaned = res.redacted_text
                changes.append("pii_redacted")

        return src.domain.models.CleanedContent(
            text=cleaned,
            original_length=original_length,
            cleaned_length=len(cleaned),
            changes_applied=changes,
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Stage 3: Enrichment
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _enrich(cleaned: src.domain.models.CleanedContent) -> src.domain.models.EnrichedMetadata:
        """
        Extract metadata from cleaned text.

        Performs lightweight NLP without external dependencies:
            - Title detection (first heading or first sentence)
            - Date extraction via regex patterns
            - Entity extraction (capitalized multi-word phrases)
            - Reading time estimation
            - Word and sentence counting

        In production, enhance with:
            - spaCy NER for better entity extraction
            - LLM-based topic classification
            - Language detection model
        """
        text: str = cleaned.text

        # Title: first line that looks like a heading
        title: str = ""
        lines: list[str] = text.split("\n")
        for line in lines[:5]:
            stripped: str = line.strip()
            if stripped and len(stripped) < 200 and not stripped.endswith("."):
                title = stripped
                break

        # Word count
        words: list[str] = text.split()
        word_count: int = len(words)

        # Sentence count (rough)
        sentences: list[str] = re.split(r"[.!?]+", text)
        sentence_count: int = len([sentence for sentence in sentences if sentence.strip()])

        # Reading time (~200 words per minute)
        reading_time: float = word_count / 200.0

        # Date extraction (various formats)
        date_patterns: list[str] = [
            r"\b\d{4}-\d{2}-\d{2}\b",  # 2026-02-06
            r"\b\d{1,2}/\d{1,2}/\d{4}\b",  # 02/06/2026
            r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
        ]
        dates: list[str] = []
        for pattern in date_patterns:
            dates.extend(re.findall(pattern, text, re.IGNORECASE))
        dates = list(set(dates))[:10]  # Deduplicate, limit

        # Entity extraction (simple: capitalized multi-word phrases)
        entity_pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b"
        raw_entities: list[str] = re.findall(entity_pattern, text)
        # Filter common false positives
        stop_entities: set[str] = {"The", "This", "These", "Those", "Standard Operating"}
        entities: list[str] = list(
            {entity for entity in raw_entities if entity not in stop_entities and len(entity) > 5}
        )[:20]

        # Topic extraction (top repeated multi-word phrases)
        # Simple approach: find bigrams that appear multiple times
        bigrams: dict[str, int] = {}
        lower_words: list[str] = text.lower().split()
        for i in range(len(lower_words) - 1):
            bigram: str = f"{lower_words[i]} {lower_words[i + 1]}"
            if all(len(word) > 3 for word in bigram.split()):
                bigrams[bigram] = bigrams.get(bigram, 0) + 1
        topics: list[str] = [
            bigram
            for bigram, count in sorted(bigrams.items(), key=lambda item: -item[1])
            if count > 2
        ][:5]

        source_id: str = IngestionPipeline._extract_source_id(text)
        system_name: str = IngestionPipeline._detect_system_name(text)
        retrieval_terms: list[str] = IngestionPipeline._extract_retrieval_terms(text, title=title)

        return src.domain.models.EnrichedMetadata(
            title=title,
            detected_language=IngestionPipeline._detect_language(text),
            dates_mentioned=dates,
            entities=entities,
            topics=topics,
            source_id=source_id,
            system_name=system_name,
            retrieval_terms=retrieval_terms,
            estimated_reading_time_min=round(reading_time, 1),
            word_count=word_count,
            sentence_count=sentence_count,
        )

    @staticmethod
    def _extract_source_id(text: str) -> str:
        match: re.Match[str] | None = _KB_SOURCE_ID_PATTERN.search(text)
        return match.group(0).upper() if match else ""

    @staticmethod
    def _detect_system_name(text: str) -> str:
        for pattern, label in _SYSTEM_SIGNAL_PATTERNS:
            if pattern.search(text):
                return label
        return ""

    @staticmethod
    def _extract_retrieval_terms(text: str, *, title: str = "") -> list[str]:
        signal_window: str = "\n".join(
            line.strip() for line in text.splitlines()[:8] if line.strip()
        )[:800]
        terms: list[str] = []

        source_id: str = IngestionPipeline._extract_source_id(signal_window)
        if source_id:
            terms.append(source_id)

        system_name: str = IngestionPipeline._detect_system_name(signal_window)
        if system_name:
            terms.extend([system_name, "EPS"])

        normalized_title: str = re.sub(
            r"^\s*KB\d{7}\s*[—:;\-]*\s*",
            "",
            title or signal_window.split("\n", 1)[0],
            flags=re.IGNORECASE,
        ).strip()
        if normalized_title:
            terms.append(normalized_title)

        for match in _SHORT_SIGNAL_PATTERN.findall(signal_window.upper()):
            token = match.upper()
            if token in _IGNORED_SIGNAL_TOKENS:
                continue
            if len(token) == 2 and token.isdigit():
                continue
            terms.append(token)

        return _dedupe_preserving_order(terms)[:20]

    # ═══════════════════════════════════════════════════════════════════════
    # Language Detection (lightweight heuristic)
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _detect_language(text: str) -> str:
        """
        Detect language using stop-word frequency analysis.

        Checks the first ~500 words against high-frequency stop words
        for each supported language. Returns ISO 639-1 code.
        Defaults to "en" when confidence is too low.
        """
        stop_words: dict[str, set[str]] = {
            "en": {
                "the",
                "is",
                "and",
                "of",
                "to",
                "in",
                "a",
                "that",
                "it",
                "for",
                "was",
                "with",
                "as",
                "are",
                "be",
            },
            "es": {
                "de",
                "la",
                "el",
                "en",
                "y",
                "que",
                "los",
                "del",
                "las",
                "un",
                "por",
                "con",
                "una",
                "su",
                "para",
            },
            "fr": {
                "de",
                "la",
                "le",
                "et",
                "les",
                "des",
                "en",
                "un",
                "du",
                "une",
                "que",
                "est",
                "dans",
                "qui",
                "au",
            },
            "de": {
                "der",
                "die",
                "und",
                "in",
                "den",
                "von",
                "zu",
                "das",
                "mit",
                "sich",
                "des",
                "auf",
                "für",
                "ist",
                "im",
            },
            "pt": {
                "de",
                "que",
                "e",
                "do",
                "da",
                "em",
                "um",
                "para",
                "com",
                "uma",
                "os",
                "no",
                "se",
                "na",
                "por",
            },
            "zh": set(),  # Handled by character range check below
            "ja": set(),  # Handled by character range check below
            "ko": set(),  # Handled by character range check below
        }

        sample: str = text[:3000]

        # CJK character detection (Chinese, Japanese, Korean)
        cjk_count: int = sum(
            1
            for ch in sample
            if "\u4e00" <= ch <= "\u9fff"  # CJK Unified Ideographs
            or "\u3040" <= ch <= "\u309f"  # Hiragana
            or "\u30a0" <= ch <= "\u30ff"  # Katakana
            or "\uac00" <= ch <= "\ud7af"  # Hangul
        )
        alpha_count: int = sum(1 for ch in sample if ch.isalpha())
        if alpha_count > 0 and cjk_count / alpha_count > 0.3:
            # Distinguish CJK scripts
            has_hiragana: bool = any("\u3040" <= ch <= "\u309f" for ch in sample)
            has_hangul: bool = any("\uac00" <= ch <= "\ud7af" for ch in sample)
            if has_hiragana:
                return "ja"
            if has_hangul:
                return "ko"
            return "zh"

        # Stop-word frequency for alphabetic languages
        words: list[str] = sample.lower().split()[:500]
        if not words:
            return "en"

        best_lang = "en"
        best_ratio = 0.0
        for lang, stops in stop_words.items():
            if not stops:
                continue
            hits: int = sum(1 for word in words if word in stops)
            ratio: float = hits / len(words)
            if ratio > best_ratio:
                best_ratio: float = ratio
                best_lang: str = lang

        # Require at least 5% stop-word matches to be confident
        return best_lang if best_ratio >= 0.05 else "en"

    # ═══════════════════════════════════════════════════════════════════════
    # Stage 4 (optional): LLM Chunk Contextualization
    # ═══════════════════════════════════════════════════════════════════════

    async def _contextualize_with_llm(
        self,
        text: str,
        title: str,
        department: str,
    ) -> str:
        """
        Generate a document-level context summary via LiteLLM gateway.

        This summary is prepended to the document text before chunking,
        so every chunk inherits document-level context. This dramatically
        improves retrieval relevance (see: Contextual Retrieval paper).

        When LLM_ENABLED=false, this stage is skipped entirely.
        Returns the original text with a context header prepended.
        """
        try:
            from src.adapters.gemini_client import generate_document_context

            context: str = await generate_document_context(text, title, department)
            if context:
                # Prepend context as a header so every chunk inherits it
                return f"[Document Context: {context}]\n\n{text}"
        except ImportError:
            src.core.logging.logger.warning("LLM client not available — skipping contextualization")
        except Exception as exc:
            src.core.logging.logger.warning(
                "LLM contextualization failed (non-fatal)",
                extra={"error": str(exc)},
            )

        return text

    # ═══════════════════════════════════════════════════════════════════════
    # Stage 5: Vector Store Integration (with retry + auth forwarding)
    # ═══════════════════════════════════════════════════════════════════════

    async def _send_to_vector_store(
        self,
        text: str,
        title: str,
        department: str,
        document_type: str,
        tags: list[str],
        classification: src.domain.models.DocumentClassification | str = (
            src.domain.models.DocumentClassification.INTERNAL
        ),
        access_control: (
            src.domain.models.DocumentAccessControl | dict[str, typing.Any] | None
        ) = None,
        org_id: str = "default",
        stream_id: str | None = None,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        content_hash: str = "",
        enriched: src.domain.models.EnrichedMetadata | None = None,
    ) -> dict[str, typing.Any]:
        """
        Send processed content to knowledge-api /v1/internal/store for
        chunking, embedding, and indexing.

        Auth: X-Pipeline-Secret shared secret (never forwards user JWTs).
        org_id and stream_id are passed explicitly in the request body for
        tenant + value-stream isolation.

        Retry: exponential backoff with jitter on transient failures
        (HTTP 429, 500, 502, 503, 504).
        """
        valid_doc_types: set[str] = {
            "policy",
            "sop",
            "product",
            "faq",
            "training",
            "report",
            "general",
        }
        normalized_doc_type: str = (
            document_type.lower()
            if document_type.lower() in valid_doc_types
            else "general"
        )
        metadata: dict[str, typing.Any] = {
            "title": title,
            "department": department,
            "document_type": normalized_doc_type,
            "tags": tags,
            "language": (enriched.detected_language if enriched else "en"),
            "classification": (
                classification.value
                if isinstance(classification, src.domain.models.DocumentClassification)
                else classification
            ),
            "access_control": (
                access_control.model_dump(mode="json")
                if isinstance(access_control, src.domain.models.DocumentAccessControl)
                else dict(access_control or {})
            ),
        }
        if stream_id:
            metadata["stream_id"] = stream_id

        custom_metadata: dict[str, typing.Any] = {}
        if content_hash:
            custom_metadata["content_hash"] = content_hash
        if enriched:
            if enriched.source_id:
                custom_metadata["source_id"] = enriched.source_id
            if enriched.system_name:
                custom_metadata["system_name"] = enriched.system_name
            if enriched.retrieval_terms:
                custom_metadata["retrieval_terms"] = enriched.retrieval_terms
                custom_metadata["retrieval_text"] = " ".join(enriched.retrieval_terms)
            if enriched.entities:
                custom_metadata["entities"] = enriched.entities[:20]
            if enriched.topics:
                custom_metadata["topics"] = enriched.topics[:10]
            if enriched.dates_mentioned:
                custom_metadata["dates_mentioned"] = enriched.dates_mentioned[:10]
        if custom_metadata:
            metadata["custom"] = custom_metadata

        payload: dict[str, typing.Any] = {
            "org_id": org_id,
            "content": text,
            "metadata": metadata,
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
        }
        if stream_id:
            payload["stream_id"] = stream_id

        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "X-Service-Name": "knowledge-pipeline-service",
        }
        if src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET:
            headers["X-Pipeline-Secret"] = src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET

        url: str = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/internal/store"
        last_exc: Exception | None = None

        for attempt in range(1, src.core.config.settings.RETRY_MAX_ATTEMPTS + 1):
            try:
                resp: httpx.Response = await self._http.post(url, json=payload, headers=headers)

                # Debug: log 422 response body
                if resp.status_code == 422:
                    body: bytes = await resp.aread()
                    src.core.logging.logger.error(
                        "Vector store validation error",
                        extra={"status": 422, "response": body.decode()[:500]},
                    )

                # Non-retryable errors — fail immediately
                if resp.status_code < 500 and resp.status_code != 429:
                    resp.raise_for_status()
                    result = resp.json()
                    # Detect application-level failures (HTTP 200 but status=failed)
                    if result.get("status") == "failed":
                        msg = result.get("message", "Unknown ingestion error")
                        raise RuntimeError(f"Knowledge API returned failed status: {msg}")
                    return result

                # Retryable server errors
                last_exc = httpx.HTTPStatusError(
                    f"HTTP {resp.status_code}",
                    request=resp.request,
                    response=resp,
                )
                src.core.logging.logger.warning(
                    "Vector store returned retryable error",
                    extra={
                        "attempt": attempt,
                        "status": resp.status_code,
                        "max_attempts": src.core.config.settings.RETRY_MAX_ATTEMPTS,
                    },
                )

            except httpx.HTTPError as exc:
                last_exc = exc
                src.core.logging.logger.warning(
                    "Vector store request failed",
                    extra={"attempt": attempt, "error": str(exc)},
                )

            # Exponential backoff with jitter
            if attempt < src.core.config.settings.RETRY_MAX_ATTEMPTS:
                delay = min(
                    src.core.config.settings.RETRY_BASE_DELAY * (2 ** (attempt - 1)),
                    src.core.config.settings.RETRY_MAX_DELAY,
                )
                jitter = delay * 0.2 * random.random()
                await asyncio.sleep(delay + jitter)

        raise RuntimeError(
            f"Knowledge API ingestion failed after {src.core.config.settings.RETRY_MAX_ATTEMPTS} "
            f"attempts: {last_exc}"
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Job Management
    # ═══════════════════════════════════════════════════════════════════════

    # ═══════════════════════════════════════════════════════════════════════
    # Adapter helpers
    # ═══════════════════════════════════════════════════════════════════════

    async def _persist_job(self, job: src.domain.models.IngestionJob) -> None:
        """Persist job state to the job store (Redis or in-memory)."""
        if self._job_store:
            try:
                await self._job_store.save(job)
            except Exception as exc:
                src.core.logging.logger.warning(
                    "Job store write failed (non-fatal)",
                    extra={"job_id": job.id, "error": str(exc)},
                )

    async def _archive_to_gcs(
        self,
        job: src.domain.models.IngestionJob,
        content: str,
        metadata: dict[str, typing.Any],
    ) -> None:
        """Archive raw document to Cloud Storage (fire-and-forget)."""
        if self._doc_store:
            try:
                await self._doc_store.store_raw_document(
                    job_id=job.id,
                    org_id=job.org_id,
                    content=content,
                    metadata=metadata,
                )
            except Exception as exc:
                src.core.logging.logger.warning(
                    "GCS archive failed (non-fatal)",
                    extra={"job_id": job.id, "error": str(exc)},
                )

    # ═══════════════════════════════════════════════════════════════════════
    # Job Management
    # ═══════════════════════════════════════════════════════════════════════

    async def _create_job(
        self,
        source_type: src.domain.models.SourceType,
        source_ref: str = "",
        title: str = "",
        department: str = "",
        document_type: str = "general",
        tags: list[str] | None = None,
        classification: src.domain.models.DocumentClassification = (
            src.domain.models.DocumentClassification.INTERNAL
        ),
        access_control: src.domain.models.DocumentAccessControl | None = None,
        stream_id: str | None = None,
        auth_token: str = "",
        org_id: str = "default",
    ) -> src.domain.models.IngestionJob:
        """Create and persist a new ingestion job."""
        job = src.domain.models.IngestionJob(
            id=str(uuid.uuid4()),
            org_id=org_id,
            stream_id=stream_id,
            source_type=source_type,
            source_ref=source_ref,
            title=title,
            department=department,
            document_type=document_type,
            tags=tags or [],
            classification=classification,
            access_control=access_control or src.domain.models.DocumentAccessControl(),
            auth_token=auth_token,
        )
        await self._persist_job(job)
        return job

    async def _expire_stale_job_if_needed(
        self,
        job: src.domain.models.IngestionJob,
    ) -> src.domain.models.IngestionJob:
        stale_timeout_minutes: int = max(
            int(src.core.config.settings.JOB_STALE_TIMEOUT_MINUTES),
            1,
        )
        terminal_statuses: set[src.domain.models.JobStatus] = {
            src.domain.models.JobStatus.CANCELLED,
            src.domain.models.JobStatus.COMPLETED,
            src.domain.models.JobStatus.FAILED,
        }
        if job.status in terminal_statuses:
            return job

        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        reference_time: datetime.datetime = job.updated_at or job.created_at
        age: datetime.timedelta = now - reference_time
        if age < datetime.timedelta(minutes=stale_timeout_minutes):
            return job

        prior_stage: str = job.status.value
        job.status = src.domain.models.JobStatus.FAILED
        job.failed_at_stage = job.failed_at_stage or prior_stage
        job.error = (
            f"Job exceeded stale timeout ({stale_timeout_minutes} minutes) "
            f"while in '{prior_stage}'"
        )
        job.updated_at = now
        job.completed_at = now
        await self._persist_job(job)
        src.core.logging.logger.warning(
            "Marked stale ingestion job as failed",
            extra={
                "job_id": job.id,
                "status": prior_stage,
                "stale_timeout_minutes": stale_timeout_minutes,
            },
        )
        return job

    async def cancel_job(self, job_id: str) -> src.domain.models.IngestionJob | None:
        """Best-effort cancellation for a queued or active ingestion job."""
        if not self._job_store:
            return None

        job = await self._job_store.get(job_id)
        if job is None:
            return None

        terminal_statuses: set[src.domain.models.JobStatus] = {
            src.domain.models.JobStatus.CANCELLED,
            src.domain.models.JobStatus.COMPLETED,
            src.domain.models.JobStatus.FAILED,
        }
        if job.status in terminal_statuses:
            return job

        prior_stage = job.status.value
        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        job.status = src.domain.models.JobStatus.CANCELLED
        job.failed_at_stage = job.failed_at_stage or prior_stage
        job.error = "Cancelled by user request"
        job.updated_at = now
        job.completed_at = now
        await self._persist_job(job)
        src.core.logging.logger.info(
            "Cancelled ingestion job",
            extra={
                "job_id": job.id,
                "status": prior_stage,
            },
        )
        return job

    async def get_job(self, job_id: str) -> src.domain.models.IngestionJob | None:
        """Get an ingestion job by ID from the persistent store."""
        if self._job_store:
            job = await self._job_store.get(job_id)
            if job is None:
                return None
            return await self._expire_stale_job_if_needed(job)
        return None

    async def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[src.domain.models.IngestionJob], int]:
        """List all jobs with pagination from the persistent store."""
        if self._job_store:
            jobs, total = await self._job_store.list(limit=limit, offset=offset)
            normalized_jobs: list[src.domain.models.IngestionJob] = []
            for job in jobs:
                normalized_jobs.append(await self._expire_stale_job_if_needed(job))
            return normalized_jobs, total
        return [], 0

    def _heuristic_faithfulness(self, answer: str, contexts: list[str]) -> float:
        """Fallback heuristic when no LLM judge is available."""
        if not answer or not contexts:
            return 0.0
        # Simple word overlap
        words = set(re.findall(r"\w+", answer.lower()))
        if not words:
            return 1.0
        context_words = set(re.findall(r"\w+", " ".join(contexts).lower()))
        overlap = words.intersection(context_words)
        return len(overlap) / len(words)

    async def _evaluate_and_gate(
        self,
        org_id: str,
        document_id: str,
        stream_id: str,
    ) -> float:
        """
        Orchestrates evaluation loop and returns average faithfulness score.
        """
        import src.core.config
        from src.domain.synthesis import ChunkSource, DatasetBuilder, GenerationConfig, QuestionType
        from src.domain.qa_backend import GeminiQABackend

        # 1. Fetch chunks for org_id to get leaf chunks
        headers = {
            "X-Service-Name": "knowledge-pipeline-service",
        }
        if src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET:
            headers["X-Pipeline-Secret"] = src.core.config.settings.KNOWLEDGE_API_PIPELINE_SECRET

        try:
            resp = await self._http.get(
                f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/chunks",
                params={"org_id": org_id, "include_embeddings": "false"},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            all_chunks = data.get("chunks", [])
        except Exception as exc:
            src.core.logging.logger.error(
                "Evaluation gating: failed to fetch leaf chunks",
                extra={"org_id": org_id, "document_id": document_id, "error": str(exc)},
            )
            return 0.0

        # 2. Filter matching document_id
        doc_chunks = [c for c in all_chunks if c.get("document_id") == document_id]
        if not doc_chunks:
            src.core.logging.logger.warning(
                "Evaluation gating: no chunks found for document_id",
                extra={"org_id": org_id, "document_id": document_id},
            )
            return 1.0  # Safe default if no chunks were stored

        limit = src.core.config.settings.EVAL_QUESTIONS_PER_DOC
        chunks_to_eval = doc_chunks[:limit]
        sources = [
            ChunkSource(
                chunk_id=c["chunk_id"],
                document_id=c["document_id"],
                content=c["content"],
            )
            for c in chunks_to_eval
        ]

        # 3. Generate QA dataset
        try:
            backend = GeminiQABackend()
            builder = DatasetBuilder(backend)
            config = GenerationConfig(
                questions_per_chunk=1,
                question_types=[QuestionType.FACTOID, QuestionType.REASONING, QuestionType.PROCEDURAL],
            )
            dataset = await builder.build(
                chunks=sources,
                config=config,
                org_id=org_id,
            )
        except Exception as exc:
            src.core.logging.logger.error(
                "Evaluation gating: synthetic QA generation failed",
                extra={"org_id": org_id, "document_id": document_id, "error": str(exc)},
            )
            return 0.0

        if not dataset.qa_pairs:
            src.core.logging.logger.warning(
                "Evaluation gating: no QA pairs generated",
                extra={"org_id": org_id, "document_id": document_id},
            )
            return 1.0

        # 4. Search and Evaluate for each generated QA pair
        scores = []
        for qa in dataset.qa_pairs:
            try:
                payload = {
                    "query": qa.question,
                    "org_id": org_id,
                    "top_k": 3,
                    "include_pending": True,
                }
                if stream_id:
                    payload["stream_id"] = stream_id

                search_resp = await self._http.post(
                    f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/internal/search",
                    json=payload,
                    headers=headers,
                )
                search_resp.raise_for_status()
                search_data = search_resp.json()
                contexts = [r["content"] for r in search_data.get("results", [])]
            except Exception as exc:
                src.core.logging.logger.warning(
                    "Evaluation gating: search request failed for QA",
                    extra={"question": qa.question, "error": str(exc)},
                )
                contexts = []

            # Evaluate faithfulness
            if self._llm_judge:
                try:
                    score = await self._llm_judge.judge_faithfulness(answer=qa.answer, contexts=contexts)
                except Exception as exc:
                    src.core.logging.logger.warning(
                        "Evaluation gating: LLM judge failed, falling back to heuristic",
                        extra={"error": str(exc)},
                    )
                    score = self._heuristic_faithfulness(answer=qa.answer, contexts=contexts)
            else:
                score = self._heuristic_faithfulness(answer=qa.answer, contexts=contexts)

            scores.append(score)

        avg_score = sum(scores) / len(scores) if scores else 0.0
        src.core.logging.logger.info(
            "Evaluation gating complete",
            extra={
                "org_id": org_id,
                "document_id": document_id,
                "score": avg_score,
                "num_questions": len(scores),
            },
        )
        return avg_score
