"""
Document AI Adapter — GCP Document AI for structured document extraction.

Extracts text, tables, and layout from PDFs, images, and scanned documents
using Google Cloud Document AI. Falls back to basic PyPDF extraction when
Document AI is not configured (local dev).

Architecture:
    Document AI provides enterprise-grade OCR + layout parsing that
    preserves heading structure, table formatting, and reading order.
    This dramatically improves chunking quality compared to naive
    text extraction.

    The adapter batches pages for large documents and respects
    Document AI's 20MB per-request limit by splitting as needed.

GCP:
    Document AI API (documentai.googleapis.com)
    Processor: General (OCR) processor, provisioned per-project.
    Workload Identity provides access — no service account keys.

Configuration:
    DOCAI_ENABLED       — enable/disable (default: false)
    DOCAI_PROCESSOR_ID  — Document AI processor resource name
    GCP_PROJECT_ID      — GCP project
    GEMINI_LOCATION     — region (reused from Gemini config)
"""

from __future__ import annotations

import io

from src.core.config import settings
from src.core.logging import logger as _root_logger
from src.domain.models import ExtractedContent, SourceType

logger = _root_logger.getChild("document_ai")

# Document AI per-request size limit
_MAX_DOCAI_BYTES = 20 * 1024 * 1024  # 20MB


class DocumentAIExtractor:
    """
    Extract text from PDFs and images using Google Cloud Document AI.

    Uses the Document AI Online Processing API for synchronous extraction.
    For documents over 20MB, falls back to batch processing or splitting.
    """

    def __init__(self, processor_name: str) -> None:
        from google.cloud import documentai_v1 as docai  # type: ignore[import-untyped]

        self._client = docai.DocumentProcessorServiceAsyncClient()
        self._processor_name = processor_name
        logger.info(
            "Document AI extractor initialized",
            extra={"processor": processor_name},
        )

    async def extract_pdf(
        self,
        content: bytes,
        filename: str = "document.pdf",
    ) -> ExtractedContent:
        """
        Extract text from a PDF using Document AI.

        Returns ExtractedContent with the full text, preserving
        heading structure and table formatting.
        """
        from google.cloud import documentai_v1 as docai

        if len(content) > _MAX_DOCAI_BYTES:
            logger.warning(
                "Document exceeds Document AI limit, splitting",
                extra={"size_mb": len(content) / (1024 * 1024)},
            )
            return await self._extract_large_pdf(content, filename)

        raw_document = docai.RawDocument(
            content=content,
            mime_type="application/pdf",
        )
        request = docai.ProcessRequest(
            name=self._processor_name,
            raw_document=raw_document,
        )

        result = await self._client.process_document(request=request)
        document = result.document

        # Extract text with layout awareness
        text = document.text or ""

        # Extract page-level metadata
        page_count = len(document.pages) if document.pages else 0

        return ExtractedContent(
            text=text,
            source_type=SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
            metadata={
                "filename": filename,
                "page_count": page_count,
                "extraction_method": "document_ai",
                "mime_type": "application/pdf",
                "original_size_bytes": len(content),
            },
        )

    async def extract_image(
        self,
        content: bytes,
        mime_type: str = "image/png",
        filename: str = "image.png",
    ) -> ExtractedContent:
        """Extract text from an image via Document AI OCR."""
        from google.cloud import documentai_v1 as docai

        raw_document = docai.RawDocument(
            content=content,
            mime_type=mime_type,
        )
        request = docai.ProcessRequest(
            name=self._processor_name,
            raw_document=raw_document,
        )

        result = await self._client.process_document(request=request)
        text = result.document.text or ""

        return ExtractedContent(
            text=text,
            source_type=SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
            metadata={
                "filename": filename,
                "extraction_method": "document_ai_ocr",
                "mime_type": mime_type,
                "original_size_bytes": len(content),
            },
        )

    async def _extract_large_pdf(
        self,
        content: bytes,
        filename: str,
    ) -> ExtractedContent:
        """
        Handle PDFs over 20MB by splitting into page ranges
        and processing each chunk separately.
        """
        try:
            import pypdf
        except ImportError:
            raise RuntimeError(
                f"PDF is {len(content) / (1024 * 1024):.1f}MB (over 20MB limit) "
                "and pypdf is not installed for splitting. Install pypdf."
            ) from None

        reader = pypdf.PdfReader(io.BytesIO(content))
        total_pages = len(reader.pages)
        chunk_size = 50  # pages per chunk

        all_text: list[str] = []
        for start in range(0, total_pages, chunk_size):
            end = min(start + chunk_size, total_pages)
            writer = pypdf.PdfWriter()
            for page_num in range(start, end):
                writer.add_page(reader.pages[page_num])

            buf = io.BytesIO()
            writer.write(buf)
            chunk_bytes = buf.getvalue()

            if len(chunk_bytes) <= _MAX_DOCAI_BYTES:
                result = await self.extract_pdf(chunk_bytes, f"{filename}_p{start}-{end}")
                all_text.append(result.text)
            else:
                # Individual chunk still too large — fall back to PyPDF
                for page_num in range(start, end):
                    page_text = reader.pages[page_num].extract_text() or ""
                    all_text.append(page_text)

        text = "\n\n".join(all_text)
        return ExtractedContent(
            text=text,
            source_type=SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
            metadata={
                "filename": filename,
                "page_count": total_pages,
                "extraction_method": "document_ai_chunked",
                "original_size_bytes": len(content),
            },
        )

    async def close(self) -> None:
        """Close the gRPC client."""
        await self._client.__aexit__(None, None, None)


class PyPDFExtractor:
    """
    Fallback PDF extractor using pypdf (local dev, no Document AI).

    Significantly lower quality than Document AI — no OCR, no layout
    awareness, no table extraction. But works offline.
    """

    async def extract_pdf(
        self,
        content: bytes,
        filename: str = "document.pdf",
    ) -> ExtractedContent:
        try:
            import pypdf
        except ImportError:
            raise RuntimeError(
                "Neither Document AI nor pypdf is available. "
                "Install pypdf for local PDF extraction."
            ) from None

        reader = pypdf.PdfReader(io.BytesIO(content))
        pages_text: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)

        text = "\n\n".join(pages_text)
        return ExtractedContent(
            text=text,
            source_type=SourceType.TEXT,
            byte_count=len(text.encode("utf-8")),
            metadata={
                "filename": filename,
                "page_count": len(reader.pages),
                "extraction_method": "pypdf",
                "original_size_bytes": len(content),
            },
        )

    async def extract_image(
        self,
        content: bytes,
        mime_type: str = "image/png",
        filename: str = "image.png",
    ) -> ExtractedContent:
        """Images require OCR — not available without Document AI."""
        raise RuntimeError(
            "Image OCR requires Document AI. Set DOCAI_ENABLED=true "
            "and configure DOCAI_PROCESSOR_ID."
        )

    async def close(self) -> None:
        pass


async def create_document_extractor() -> DocumentAIExtractor | PyPDFExtractor:
    """
    Factory — returns Document AI extractor if configured,
    PyPDF fallback otherwise.
    """
    docai_processor = getattr(settings, "DOCAI_PROCESSOR_ID", "")
    docai_enabled = getattr(settings, "DOCAI_ENABLED", False)

    if docai_enabled and docai_processor:
        try:
            extractor = DocumentAIExtractor(docai_processor)
            logger.info("Document AI extractor ready")
            return extractor
        except Exception as exc:
            logger.warning(
                "Document AI unavailable — falling back to PyPDF",
                extra={"error": str(exc)},
            )

    return PyPDFExtractor()
