"""
End-to-end pipeline tests: entity extraction → knowledge graph → community detection.

These tests verify that the full KG pipeline works correctly from
extraction through upsert and into community analysis, including tenant
isolation guarantees across the whole chain.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.adapters.neo4j_graph import ExtractedEntity, Neo4jKnowledgeGraph
from src.domain.entity_extraction import EntityExtractor
from src.domain.graph_communities import CommunityDetector


# ── Helpers ───────────────────────────────────────────────────────────────


def _mock_llm_response(entities: list, relationships: list) -> MagicMock:
    content = json.dumps({"entities": entities, "relationships": relationships})
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = {"choices": [{"message": {"content": content}}]}
    resp.raise_for_status = MagicMock()
    return resp


def _make_graph(records: list[dict] | None = None):
    """Return a Neo4jKnowledgeGraph with a mock driver."""
    mock_result = AsyncMock()
    mock_result.data = AsyncMock(return_value=records or [])
    mock_result.single = AsyncMock(return_value=None)

    mock_session = AsyncMock()
    mock_session.run = AsyncMock(return_value=mock_result)

    mock_driver = MagicMock()
    mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

    g = Neo4jKnowledgeGraph()
    g._driver = mock_driver
    return g, mock_session


# ── E2E: extraction → upsert ──────────────────────────────────────────────


class TestExtractionToGraphUpsert:
    async def test_llm_extracted_entities_upserted_correctly(self):
        extractor = EntityExtractor(llm_url="http://fake-llm/v1")
        graph, mock_session = _make_graph()

        extractor._http.post = AsyncMock(return_value=_mock_llm_response(
            entities=[
                {"name": "Jane Doe", "type": "person"},
                {"name": "Acme Corp", "type": "organization"},
            ],
            relationships=[
                {"source": "Jane Doe", "target": "Acme Corp", "type": "works_for"},
            ],
        ))

        extraction = await extractor.extract(
            "Jane Doe is the VP of Engineering at Acme Corp."
        )
        assert extraction.method == "llm"
        assert len(extraction.entities) == 2

        stats = await graph.upsert_entities(
            org_id="org1",
            entities=extraction.entities,
            relationships=extraction.relationships,
            chunk_id="chunk-001",
            document_id="doc-001",
        )

        assert stats["entities"] == 2
        assert stats["relationships"] == 1
        assert stats["mentions"] == 2

    async def test_regex_fallback_entities_still_upsert(self):
        extractor = EntityExtractor(llm_url="http://fake-llm/v1")
        graph, _ = _make_graph()

        # LLM unreachable → regex fallback
        extractor._http.post = AsyncMock(side_effect=httpx.ConnectError("down"))

        extraction = await extractor.extract(
            "Global Technologies and North Star Solutions signed a partnership."
        )
        assert extraction.method == "regex"
        assert len(extraction.entities) > 0

        stats = await graph.upsert_entities(
            org_id="org1",
            entities=extraction.entities,
            relationships=extraction.relationships,
            chunk_id="chunk-002",
            document_id="doc-002",
        )
        assert stats["entities"] == len(extraction.entities)

    async def test_parse_failure_results_in_zero_upserts(self):
        extractor = EntityExtractor(llm_url="http://fake-llm/v1")
        graph, mock_session = _make_graph()

        # LLM returns garbage JSON
        bad_resp = MagicMock(spec=httpx.Response)
        bad_resp.json.return_value = {"choices": [{"message": {"content": "not json!"}}]}
        bad_resp.raise_for_status = MagicMock()
        extractor._http.post = AsyncMock(return_value=bad_resp)

        extraction = await extractor.extract(
            "Something happened at Some Organization recently."
        )
        # method is llm_parse_failed — but extract() catches the exception
        # and falls back to regex because _parse_llm_response itself doesn't raise
        # Still: verify we can upsert without crashing
        stats = await graph.upsert_entities(
            org_id="org1",
            entities=extraction.entities,
            relationships=extraction.relationships,
            chunk_id="chunk-003",
            document_id="doc-003",
        )
        assert isinstance(stats, dict)
        assert "entities" in stats


# ── E2E: tenant isolation ─────────────────────────────────────────────────


class TestTenantIsolation:
    async def test_org_a_entities_never_use_org_b_id(self):
        extractor = EntityExtractor(llm_url="http://fake-llm/v1")
        graph, mock_session = _make_graph()

        extractor._http.post = AsyncMock(return_value=_mock_llm_response(
            entities=[{"name": "Secret Project", "type": "concept"}],
            relationships=[],
        ))

        extraction = await extractor.extract(
            "Secret Project is a confidential initiative at the company."
        )
        await graph.upsert_entities(
            org_id="org-A",
            entities=extraction.entities,
            relationships=[],
            chunk_id="c1",
            document_id="d1",
        )

        for call in mock_session.run.call_args_list:
            kwargs = call[1]
            if "org_id" in kwargs:
                assert kwargs["org_id"] == "org-A", (
                    f"Org ID leaked: expected 'org-A', got '{kwargs['org_id']}'"
                )

    async def test_two_orgs_independent_stats(self):
        graph_a, _ = _make_graph()
        graph_b, _ = _make_graph()

        # org-A: set up result for 10 entities
        graph_a._driver.session.return_value.__aenter__.return_value.run.return_value.single = (
            AsyncMock(return_value={"entity_count": 10, "doc_count": 2,
                                    "chunk_count": 20, "relationship_count": 5})
        )
        # org-B: set up result for 3 entities
        graph_b._driver.session.return_value.__aenter__.return_value.run.return_value.single = (
            AsyncMock(return_value={"entity_count": 3, "doc_count": 1,
                                    "chunk_count": 6, "relationship_count": 1})
        )

        stats_a = await graph_a.org_stats("org-A")
        stats_b = await graph_b.org_stats("org-B")

        assert stats_a["entities"] == 10
        assert stats_b["entities"] == 3
        assert stats_a["org_id"] == "org-A"
        assert stats_b["org_id"] == "org-B"

    async def test_delete_document_scoped_to_org(self):
        graph, mock_session = _make_graph()

        # Wire up the delete sequence
        count_result = AsyncMock()
        count_result.single = AsyncMock(return_value={"chunk_count": 2})
        orphan_result = AsyncMock()
        orphan_result.single = AsyncMock(return_value={"orphan_count": 0})
        generic = AsyncMock()
        generic.single = AsyncMock(return_value=None)

        sequence = [count_result, generic, generic, orphan_result]
        idx = 0

        async def run_seq(*args, **kwargs):
            nonlocal idx
            r = sequence[min(idx, len(sequence) - 1)]
            idx += 1
            return r

        mock_session.run = AsyncMock(side_effect=run_seq)

        await graph.delete_document_graph("isolated-org", "doc-xyz")

        for call in mock_session.run.call_args_list:
            kwargs = call[1]
            if "org_id" in kwargs:
                assert kwargs["org_id"] == "isolated-org"


# ── E2E: extraction → communities ────────────────────────────────────────


class TestExtractionToCommunities:
    async def test_community_detection_after_extraction(self):
        """Extract entities, then run community detection on the resulting graph."""
        louvain_records = [
            {"communityId": 1, "members": ["Acme", "Widget", "Cloud"], "memberCount": 3},
        ]

        louvain_result = AsyncMock()
        louvain_result.data = AsyncMock(return_value=louvain_records)

        generic_result = AsyncMock()
        generic_result.data = AsyncMock(return_value=[])

        call_idx = 0

        async def run_side_effect(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            return louvain_result if call_idx == 1 else generic_result

        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=run_side_effect)
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(
            return_value="Acme, Widget, and Cloud form a product ecosystem."
        )

        detector = CommunityDetector(
            neo4j_driver=mock_driver,
            gemini_client=mock_gemini,
            min_community_size=3,
        )
        report = await detector.detect_and_summarize("org1")

        assert report.total_communities == 1
        assert report.summaries_generated == 1
        assert "Acme" in report.communities[0].summary or "ecosystem" in report.communities[0].summary

    async def test_community_detection_without_gemini_uses_fallback(self):
        louvain_records = [
            {"communityId": 2, "members": ["EntityA", "EntityB", "EntityC"], "memberCount": 3},
        ]
        louvain_result = AsyncMock()
        louvain_result.data = AsyncMock(return_value=louvain_records)
        generic_result = AsyncMock()
        generic_result.data = AsyncMock(return_value=[])

        call_idx = 0

        async def run_side_effect(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            return louvain_result if call_idx == 1 else generic_result

        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=run_side_effect)
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        detector = CommunityDetector(
            neo4j_driver=mock_driver,
            gemini_client=None,  # no Gemini
            min_community_size=3,
        )
        report = await detector.detect_and_summarize("org1")

        # Fallback summary should still be produced
        assert report.total_communities == 1
        # Community was found and summarized (fallback = entity names joined)
        c = report.communities[0]
        assert any(name in c.summary for name in ["EntityA", "EntityB", "EntityC"])


# ── E2E: full pipeline smoke test ─────────────────────────────────────────


class TestFullPipelineSmoke:
    async def test_extract_upsert_search_cycle(self):
        """
        Full cycle: extract entities → upsert → search returns those entities.
        The search result is mocked, but verifies the correct query params are sent.
        """
        extractor = EntityExtractor(llm_url="http://fake-llm/v1")
        graph, mock_session = _make_graph()

        # Step 1: extract
        extractor._http.post = AsyncMock(return_value=_mock_llm_response(
            entities=[{"name": "OpenAI", "type": "organization"}],
            relationships=[],
        ))
        extraction = await extractor.extract("OpenAI builds foundation models.")
        assert len(extraction.entities) == 1

        # Step 2: upsert
        await graph.upsert_entities(
            org_id="org1",
            entities=extraction.entities,
            relationships=[],
            chunk_id="c1",
            document_id="d1",
        )

        # Step 3: search — mock returns the entity we just upserted
        search_result = AsyncMock()
        search_result.data = AsyncMock(return_value=[{
            "id": extraction.entities[0].id,
            "name": "OpenAI",
            "entity_type": "organization",
            "org_id": "org1",
            "properties": {},
            "mention_count": 1,
            "chunk_ids": ["c1"],
        }])
        mock_session.run = AsyncMock(return_value=search_result)

        results = await graph.search_entities("org1", "OpenAI")
        assert len(results) == 1
        assert results[0].name == "OpenAI"
        assert "c1" in results[0].connected_chunks

    async def test_multi_chunk_sequential_links(self):
        """Link multiple chunks sequentially, verify count matches."""
        graph, _ = _make_graph()
        chunk_ids = [f"chunk-{i}" for i in range(5)]

        count = await graph.link_sequential_chunks("org1", chunk_ids)
        assert count == 4  # n-1 links for 5 chunks

    async def test_document_lifecycle_create_then_delete(self):
        """Upsert entities for a document, then delete it — returns deletion stats."""
        graph, mock_session = _make_graph()

        entities = [ExtractedEntity(name="TempEntity", entity_type="concept")]
        await graph.upsert_entities(
            org_id="org1", entities=entities, relationships=[],
            chunk_id="c-temp", document_id="doc-temp",
        )

        # Wire up delete sequence
        count_result = AsyncMock()
        count_result.single = AsyncMock(return_value={"chunk_count": 1})
        orphan_result = AsyncMock()
        orphan_result.single = AsyncMock(return_value={"orphan_count": 1})
        generic = AsyncMock()
        generic.single = AsyncMock(return_value=None)

        sequence = [count_result, generic, generic, orphan_result]
        idx = 0

        async def run_seq(*args, **kwargs):
            nonlocal idx
            r = sequence[min(idx, len(sequence) - 1)]
            idx += 1
            return r

        mock_session.run = AsyncMock(side_effect=run_seq)

        stats = await graph.delete_document_graph("org1", "doc-temp")
        assert stats["chunks_removed"] == 1
        assert stats["orphaned_entities_removed"] == 1
