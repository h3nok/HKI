"""Tests for the Knowledge Synthesis — synthetic Q&A generation."""

from __future__ import annotations

import json

import pytest

from src.domain.synthesis import (
    ChunkSource,
    DatasetBuilder,
    DatasetExporter,
    ExportFormat,
    GenerationConfig,
    QuestionType,
    SyntheticDataset,
    SyntheticQA,
    build_generation_prompt,
)


# ── Mock backend ──────────────────────────────────────────────────────────


class MockQABackend:
    """Deterministic Q&A generator for testing."""

    async def generate_qa(
        self,
        chunk_text: str,
        question_type: QuestionType,
        config: GenerationConfig,
    ) -> list[SyntheticQA]:
        return [SyntheticQA(
            question=f"What about {chunk_text[:20]}?",
            answer=f"Answer based on: {chunk_text[:20]}",
            question_type=question_type,
            difficulty=2,
        )]


class FailingBackend:
    """Backend that always raises."""

    async def generate_qa(self, *args, **kwargs) -> list[SyntheticQA]:
        raise RuntimeError("LLM unavailable")


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def backend():
    return MockQABackend()


@pytest.fixture
def builder(backend):
    return DatasetBuilder(backend=backend)


@pytest.fixture
def sample_chunks():
    return [
        ChunkSource(
            chunk_id="c1",
            document_id="doc-1",
            content="The return policy allows customers to return items within "
                    "ninety days of purchase for a full refund. Items must be in "
                    "original packaging and accompanied by the receipt. Customers "
                    "should bring the item to the returns counter at the front of "
                    "the warehouse where a team member will process the return and "
                    "issue a refund to the original payment method used.",
        ),
        ChunkSource(
            chunk_id="c2",
            document_id="doc-1",
            content="Membership benefits include access to exclusive discounts, "
                    "free shipping on orders over fifty dollars, and early access "
                    "to seasonal sales events throughout the year. Gold star members "
                    "also receive additional perks such as two percent cashback on "
                    "qualifying purchases and priority access to special buying events "
                    "held quarterly at select warehouse locations across the country.",
        ),
        ChunkSource(
            chunk_id="c3",
            document_id="doc-2",
            content="Short.",  # Too short, should be skipped
        ),
    ]


@pytest.fixture
def sample_dataset():
    return SyntheticDataset(
        name="test-set",
        org_id="org1",
        qa_pairs=[
            SyntheticQA(
                id="qa-1",
                question="What is the return policy?",
                answer="Items can be returned within 90 days.",
                question_type=QuestionType.FACTOID,
                difficulty=1,
                source_document_id="doc-1",
                source_chunk_ids=["c1"],
                source_content="The return policy allows returns within 90 days.",
            ),
            SyntheticQA(
                id="qa-2",
                question="How do membership benefits work?",
                answer="Members get discounts and free shipping.",
                question_type=QuestionType.REASONING,
                difficulty=3,
                source_document_id="doc-1",
                source_chunk_ids=["c2"],
                source_content="Membership benefits include discounts and shipping.",
            ),
        ],
        total_pairs=2,
    )


# ── Unit tests: prompt building ───────────────────────────────────────────


class TestBuildGenerationPrompt:
    def test_contains_chunk_text(self):
        prompt = build_generation_prompt("My chunk text", QuestionType.FACTOID, 3)
        assert "My chunk text" in prompt

    def test_contains_question_type(self):
        prompt = build_generation_prompt("text", QuestionType.REASONING, 2)
        assert "reasoning" in prompt

    def test_contains_count(self):
        prompt = build_generation_prompt("text", QuestionType.FACTOID, 5)
        assert "5" in prompt

    def test_json_instruction(self):
        prompt = build_generation_prompt("text", QuestionType.FACTOID)
        assert "JSON" in prompt


# ── Integration tests: dataset builder ────────────────────────────────────


class TestDatasetBuilder:
    @pytest.mark.asyncio
    async def test_build_generates_pairs(self, builder, sample_chunks):
        dataset = await builder.build(
            chunks=sample_chunks,
            name="test-build",
            org_id="org1",
        )
        assert dataset.name == "test-build"
        assert dataset.org_id == "org1"
        # c3 too short → only c1 and c2 generate pairs
        assert dataset.total_pairs > 0
        assert len(dataset.qa_pairs) == dataset.total_pairs
        assert dataset.generation_time_ms > 0

    @pytest.mark.asyncio
    async def test_skips_short_chunks(self, builder, sample_chunks):
        config = GenerationConfig(min_chunk_length=50, questions_per_chunk=1)
        dataset = await builder.build(
            chunks=sample_chunks, config=config,
        )
        # "Short." has only 1 word, should be skipped
        source_ids = {qa.source_document_id for qa in dataset.qa_pairs}
        assert "doc-2" not in source_ids or all(
            len(qa.source_content.split()) >= 50
            for qa in dataset.qa_pairs
            if qa.source_document_id == "doc-2"
        )

    @pytest.mark.asyncio
    async def test_source_document_ids_tracked(self, builder, sample_chunks):
        dataset = await builder.build(chunks=sample_chunks)
        assert "doc-1" in dataset.source_document_ids

    @pytest.mark.asyncio
    async def test_qa_pairs_have_provenance(self, builder, sample_chunks):
        config = GenerationConfig(questions_per_chunk=1)
        dataset = await builder.build(chunks=sample_chunks, config=config)
        for qa in dataset.qa_pairs:
            assert qa.source_chunk_ids
            assert qa.source_document_id
            assert qa.source_content

    @pytest.mark.asyncio
    async def test_question_type_rotation(self, builder, sample_chunks):
        config = GenerationConfig(
            questions_per_chunk=3,
            question_types=[QuestionType.FACTOID, QuestionType.REASONING],
        )
        dataset = await builder.build(chunks=sample_chunks, config=config)
        types = {qa.question_type for qa in dataset.qa_pairs}
        assert QuestionType.FACTOID in types
        assert QuestionType.REASONING in types

    @pytest.mark.asyncio
    async def test_failing_backend_graceful(self, sample_chunks):
        builder = DatasetBuilder(backend=FailingBackend())
        dataset = await builder.build(chunks=sample_chunks)
        # Should not raise, just produce empty dataset
        assert dataset.total_pairs == 0

    @pytest.mark.asyncio
    async def test_empty_chunks(self, builder):
        dataset = await builder.build(chunks=[])
        assert dataset.total_pairs == 0
        assert dataset.qa_pairs == []

    @pytest.mark.asyncio
    async def test_custom_config(self, builder, sample_chunks):
        config = GenerationConfig(
            questions_per_chunk=2,
            temperature=0.3,
            max_answer_tokens=128,
        )
        dataset = await builder.build(chunks=sample_chunks, config=config)
        assert dataset.config.temperature == 0.3
        assert dataset.config.max_answer_tokens == 128


# ── Exporter tests ────────────────────────────────────────────────────────


class TestDatasetExporter:
    def test_to_json(self, sample_dataset):
        output = DatasetExporter.to_json(sample_dataset)
        parsed = json.loads(output)
        assert parsed["name"] == "test-set"
        assert parsed["total"] == 2
        assert len(parsed["pairs"]) == 2
        assert parsed["pairs"][0]["question"] == "What is the return policy?"

    def test_to_jsonl(self, sample_dataset):
        output = DatasetExporter.to_jsonl(sample_dataset)
        lines = output.strip().split("\n")
        assert len(lines) == 2
        first = json.loads(lines[0])
        assert "question" in first
        assert "ground_truth" in first
        assert "contexts" in first

    def test_to_csv(self, sample_dataset):
        output = DatasetExporter.to_csv(sample_dataset)
        lines = output.strip().split("\n")
        assert len(lines) == 3  # header + 2 rows
        assert "question" in lines[0]
        assert "What is the return policy?" in lines[1]

    def test_export_json(self, sample_dataset):
        output = DatasetExporter.export(sample_dataset, ExportFormat.JSON)
        assert json.loads(output)["total"] == 2

    def test_export_jsonl(self, sample_dataset):
        output = DatasetExporter.export(sample_dataset, ExportFormat.JSONL)
        lines = output.strip().split("\n")
        assert len(lines) == 2

    def test_export_csv(self, sample_dataset):
        output = DatasetExporter.export(sample_dataset, ExportFormat.CSV)
        assert "question" in output

    def test_empty_dataset_json(self):
        empty = SyntheticDataset(name="empty", total_pairs=0)
        output = DatasetExporter.to_json(empty)
        parsed = json.loads(output)
        assert parsed["pairs"] == []

    def test_empty_dataset_jsonl(self):
        empty = SyntheticDataset(name="empty")
        output = DatasetExporter.to_jsonl(empty)
        assert output == ""
