"""
Knowledge Synthesis — synthetic Q&A generation for evaluation datasets.

Generates question-answer pairs from ingested knowledge chunks, producing
ground-truth datasets for the Evaluation Pipeline. Supports multiple
generation strategies and export formats.

Architecture Blueprint alignment:
    "Services for generating, validating, and integrating synthetic data
     to support prompt tuning, scenario generation, and evaluation of
     agent behaviors."

Components:
    SyntheticQA       — a single generated question + answer + source
    GenerationConfig  — parameters controlling generation behavior
    QAGenerator       — LLM-powered Q&A pair generator (Gemini)
    DatasetBuilder    — orchestrates generation across documents
    DatasetExporter   — serializes datasets to JSON/JSONL/CSV
"""

from __future__ import annotations

import _csv
import datetime
import enum
import json
import typing
import uuid

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class QuestionType(enum.StrEnum):
    """Type of generated question for dataset diversity."""

    FACTOID = "factoid"  # Direct fact extraction
    REASONING = "reasoning"  # Requires inference across chunks
    COMPARISON = "comparison"  # Compare two concepts
    PROCEDURAL = "procedural"  # Step-by-step process questions
    EDGE_CASE = "edge_case"  # Boundary conditions, exceptions
    MULTI_HOP = "multi_hop"  # Requires chaining multiple facts


class ExportFormat(enum.StrEnum):
    """Serialization format for evaluation datasets."""

    JSON = "json"
    JSONL = "jsonl"
    CSV = "csv"


class SyntheticQA(pydantic.BaseModel):
    """
    A single synthetic question-answer pair with full provenance.

    Each QA traces back to the source chunk(s) that ground the answer,
    enabling the Evaluation Pipeline to measure retrieval recall.
    """

    id: str = pydantic.Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    question_type: QuestionType = QuestionType.FACTOID
    source_chunk_ids: list[str] = pydantic.Field(default_factory=list)
    source_document_id: str = ""
    source_content: str = ""  # The chunk text used to generate
    difficulty: int = pydantic.Field(1, ge=1, le=5)
    metadata: dict = pydantic.Field(default_factory=dict)
    created_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )


class GenerationConfig(pydantic.BaseModel):
    """Parameters controlling Q&A generation behavior."""

    questions_per_chunk: int = pydantic.Field(3, ge=1, le=10)
    question_types: list[QuestionType] = pydantic.Field(
        default_factory=lambda: [
            QuestionType.FACTOID,
            QuestionType.REASONING,
            QuestionType.PROCEDURAL,
        ],
    )
    min_chunk_length: int = pydantic.Field(
        50,
        description="Skip chunks shorter than this (words)",
    )
    temperature: float = pydantic.Field(0.7, ge=0.0, le=2.0)
    max_answer_tokens: int = pydantic.Field(256, ge=32, le=2048)
    include_edge_cases: bool = False


class SyntheticDataset(pydantic.BaseModel):
    """A complete evaluation dataset with metadata."""

    id: str = pydantic.Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    org_id: str = "default"
    qa_pairs: list[SyntheticQA] = pydantic.Field(default_factory=list)
    config: GenerationConfig = pydantic.Field(default_factory=GenerationConfig)
    source_document_ids: list[str] = pydantic.Field(default_factory=list)
    total_pairs: int = 0
    generation_time_ms: float = 0.0
    created_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )


# ═══════════════════════════════════════════════════════════════════════════════
# LLM Protocol — injectable generator backend
# ═══════════════════════════════════════════════════════════════════════════════


class QAGeneratorBackend(typing.Protocol):
    """
    LLM backend for generating Q&A pairs from chunk text.

    Production: Gemini via Vertex AI.
    Testing: mock that returns deterministic pairs.
    """

    async def generate_qa(
        self,
        chunk_text: str,
        question_type: QuestionType,
        config: GenerationConfig,
    ) -> list[SyntheticQA]: ...


# ═══════════════════════════════════════════════════════════════════════════════
# Prompt templates — structured prompts for Q&A generation
# ═══════════════════════════════════════════════════════════════════════════════


_SYSTEM_PROMPT = """You are an expert at creating evaluation datasets \
for retrieval-augmented generation systems. Given a passage of text, \
generate high-quality question-answer pairs that test whether a \
retrieval system can find and use this information correctly."""

_TYPE_INSTRUCTIONS: dict[QuestionType, str] = {
    QuestionType.FACTOID: (
        "Generate questions that ask for specific facts directly "
        "stated in the text. Answers should be concise (1-2 sentences)."
    ),
    QuestionType.REASONING: (
        "Generate questions that require understanding and inference "
        "from the text. Answers should explain the reasoning."
    ),
    QuestionType.COMPARISON: (
        "Generate questions that compare or contrast concepts mentioned in the text."
    ),
    QuestionType.PROCEDURAL: (
        "Generate questions about processes, steps, or procedures "
        "described in the text. Answers should list steps clearly."
    ),
    QuestionType.EDGE_CASE: (
        "Generate questions about edge cases, exceptions, or boundary "
        "conditions implied by the text."
    ),
    QuestionType.MULTI_HOP: (
        "Generate questions that require combining multiple pieces "
        "of information from the text to answer."
    ),
}


def build_generation_prompt(
    chunk_text: str,
    question_type: QuestionType,
    count: int = 3,
) -> str:
    """
    Build the prompt for Q&A generation.

    Returns a structured prompt that instructs the LLM to produce
    JSON-formatted Q&A pairs from the given chunk text.
    """
    type_instruction: str = _TYPE_INSTRUCTIONS.get(
        question_type,
        _TYPE_INSTRUCTIONS[QuestionType.FACTOID],
    )
    return (
        f"{_SYSTEM_PROMPT}\n\n"
        f"Question type: {question_type.value}\n"
        f"Instructions: {type_instruction}\n\n"
        f"Generate exactly {count} question-answer pairs from this text.\n"
        f"Return ONLY a JSON array of objects with 'question', 'answer', "
        f"and 'difficulty' (1-5) keys.\n\n"
        f"Text:\n---\n{chunk_text}\n---"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Dataset Builder — orchestrates generation
# ═══════════════════════════════════════════════════════════════════════════════


class ChunkSource(pydantic.BaseModel):
    """Input chunk for Q&A generation."""

    chunk_id: str
    document_id: str
    content: str
    metadata: dict = pydantic.Field(default_factory=dict)


class DatasetBuilder:
    """
    Orchestrates synthetic Q&A generation across a set of chunks.

    Usage:
        builder = DatasetBuilder(backend=gemini_generator)
        dataset = await builder.build(
            chunks=chunk_sources,
            config=GenerationConfig(questions_per_chunk=5),
            name="nightly-eval-set",
        )
    """

    def __init__(self, backend: QAGeneratorBackend) -> None:
        self._backend: QAGeneratorBackend = backend

    async def build(
        self,
        chunks: list[ChunkSource],
        config: GenerationConfig | None = None,
        name: str = "",
        org_id: str = "default",
    ) -> SyntheticDataset:
        """
        Generate a complete evaluation dataset from source chunks.

        Skips chunks that are too short (below min_chunk_length words).
        Distributes question types evenly across chunks.
        """
        import time

        t0: float = time.monotonic()
        cfg: GenerationConfig = config or GenerationConfig()
        all_pairs: list[SyntheticQA] = []
        doc_ids: set[str] = set()

        for chunk in chunks:
            word_count: int = len(chunk.content.split())
            if word_count < cfg.min_chunk_length:
                continue

            doc_ids.add(chunk.document_id)
            chunk_pairs: list[SyntheticQA] = await self._generate_for_chunk(chunk, cfg)
            all_pairs.extend(chunk_pairs)

        elapsed: float = (time.monotonic() - t0) * 1000
        return SyntheticDataset(
            name=name,
            org_id=org_id,
            qa_pairs=all_pairs,
            config=cfg,
            source_document_ids=sorted(doc_ids),
            total_pairs=len(all_pairs),
            generation_time_ms=round(elapsed, 1),
        )

    async def _generate_for_chunk(
        self,
        chunk: ChunkSource,
        config: GenerationConfig,
    ) -> list[SyntheticQA]:
        """Generate Q&A pairs for a single chunk, rotating question types."""
        pairs: list[SyntheticQA] = []
        types: list[QuestionType] = config.question_types
        if not types:
            types: list[QuestionType] = [QuestionType.FACTOID]

        for i in range(config.questions_per_chunk):
            q_type: QuestionType = types[i % len(types)]
            try:
                generated: list[SyntheticQA] = await self._backend.generate_qa(
                    chunk_text=chunk.content,
                    question_type=q_type,
                    config=config,
                )
                for qa in generated:
                    qa.source_chunk_ids = [chunk.chunk_id]
                    qa.source_document_id = chunk.document_id
                    qa.source_content = chunk.content
                    qa.question_type = q_type
                pairs.extend(generated)
            except Exception:
                # Non-fatal: skip this chunk/type, log upstream
                continue

        return pairs


# ═══════════════════════════════════════════════════════════════════════════════
# Dataset Exporter — serialization to multiple formats
# ═══════════════════════════════════════════════════════════════════════════════


class DatasetExporter:
    """
    Serializes SyntheticDataset to various formats for consumption
    by evaluation tools (RAGAS, DeepEvals) or human review.
    """

    @staticmethod
    def to_json(dataset: SyntheticDataset, indent: int = 2) -> str:
        """Export as a single JSON document."""
        rows = [
            {
                "id": qa.id,
                "question": qa.question,
                "answer": qa.answer,
                "question_type": qa.question_type.value,
                "difficulty": qa.difficulty,
                "source_chunk_ids": qa.source_chunk_ids,
                "source_document_id": qa.source_document_id,
            }
            for qa in dataset.qa_pairs
        ]
        return json.dumps(
            {"name": dataset.name, "total": dataset.total_pairs, "pairs": rows},
            indent=indent,
        )

    @staticmethod
    def to_jsonl(dataset: SyntheticDataset) -> str:
        """Export as newline-delimited JSON (one object per line)."""
        lines: list[str] = []
        for qa in dataset.qa_pairs:
            obj = {
                "question": qa.question,
                "ground_truth": qa.answer,
                "contexts": [qa.source_content] if qa.source_content else [],
                "question_type": qa.question_type.value,
            }
            lines.append(json.dumps(obj, separators=(",", ":")))
        return "\n".join(lines)

    @staticmethod
    def to_csv(dataset: SyntheticDataset) -> str:
        """Export as CSV with header row."""
        import csv
        import io

        buf = io.StringIO()
        writer: _csv.Writer = csv.writer(buf)
        writer.writerow(
            [
                "id",
                "question",
                "answer",
                "question_type",
                "difficulty",
                "source_document_id",
            ]
        )
        for qa in dataset.qa_pairs:
            writer.writerow(
                [
                    qa.id,
                    qa.question,
                    qa.answer,
                    qa.question_type.value,
                    qa.difficulty,
                    qa.source_document_id,
                ]
            )
        return buf.getvalue()

    @staticmethod
    def export(
        dataset: SyntheticDataset,
        fmt: ExportFormat = ExportFormat.JSONL,
    ) -> str:
        """Export a dataset in the requested format."""
        exporters = {
            ExportFormat.JSON: DatasetExporter.to_json,
            ExportFormat.JSONL: DatasetExporter.to_jsonl,
            ExportFormat.CSV: DatasetExporter.to_csv,
        }
        return exporters[fmt](dataset)
