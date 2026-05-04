"""Tests for the Neo4j Knowledge Graph adapter — multi-tenant entity/relationship store."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.adapters.neo4j_graph import (
    EntitySearchResult,
    ExtractedEntity,
    ExtractedRelationship,
    GraphPath,
    Neo4jKnowledgeGraph,
)

# ── Helpers ───────────────────────────────────────────────────────────────


def _make_driver(records: list[dict] | None = None, single_record: dict | None = None):
    """
    Return (mock_driver, mock_session, mock_result).

    mock_result.data() returns `records`.
    mock_result.single() returns `single_record`.
    """
    mock_result = AsyncMock()
    mock_result.data = AsyncMock(return_value=records or [])
    mock_result.single = AsyncMock(return_value=single_record)

    mock_session = AsyncMock()
    mock_session.run = AsyncMock(return_value=mock_result)

    mock_driver = MagicMock()
    mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)
    mock_driver.verify_connectivity = AsyncMock()
    mock_driver.close = AsyncMock()

    return mock_driver, mock_session, mock_result


@pytest.fixture
def graph():
    return Neo4jKnowledgeGraph()


@pytest.fixture
def connected(graph):
    mock_driver, mock_session, mock_result = _make_driver()
    graph._driver = mock_driver
    return graph, mock_driver, mock_session, mock_result


# ── Dataclasses ───────────────────────────────────────────────────────────


class TestExtractedEntity:
    def test_auto_generates_id(self):
        e = ExtractedEntity(name="Acme", entity_type="organization")
        assert e.id.startswith("ent_")
        assert len(e.id) > 4

    def test_unique_ids_across_instances(self):
        e1 = ExtractedEntity(name="A", entity_type="person")
        e2 = ExtractedEntity(name="B", entity_type="person")
        assert e1.id != e2.id

    def test_custom_id_is_preserved(self):
        e = ExtractedEntity(name="X", entity_type="concept", id="my-id")
        assert e.id == "my-id"

    def test_default_confidence_is_1(self):
        e = ExtractedEntity(name="X", entity_type="concept")
        assert e.confidence == 1.0

    def test_default_properties_empty_dict(self):
        e = ExtractedEntity(name="X", entity_type="concept")
        assert e.properties == {}

    def test_properties_not_shared_between_instances(self):
        e1 = ExtractedEntity(name="A", entity_type="concept")
        e2 = ExtractedEntity(name="B", entity_type="concept")
        e1.properties["key"] = "val"
        assert "key" not in e2.properties


class TestExtractedRelationship:
    def test_default_weight(self):
        r = ExtractedRelationship(source_name="A", target_name="B", relationship_type="related_to")
        assert r.weight == 1.0

    def test_default_properties_empty_dict(self):
        r = ExtractedRelationship(source_name="A", target_name="B", relationship_type="works_for")
        assert r.properties == {}


# ── Connection management ─────────────────────────────────────────────────


class TestConnection:
    def test_not_connected_initially(self, graph):
        assert not graph.connected

    def test_connected_after_driver_assigned(self, graph):
        graph._driver = MagicMock()
        assert graph.connected

    def test_ensure_driver_raises_when_not_connected(self, graph):
        with pytest.raises(RuntimeError, match="connect()"):
            graph._ensure_driver()

    async def test_close_clears_driver(self, connected):
        g, mock_driver, _, _ = connected
        await g.close()
        assert g._driver is None
        mock_driver.close.assert_awaited_once()

    async def test_close_when_not_connected_is_noop(self, graph):
        await graph.close()  # must not raise

    async def test_connect_calls_verify_connectivity(self):
        g = Neo4jKnowledgeGraph()
        mock_session_cm = MagicMock()
        mock_session_cm.__aenter__ = AsyncMock(return_value=AsyncMock())
        mock_session_cm.__aexit__ = AsyncMock(return_value=False)

        mock_driver = MagicMock()
        mock_driver.verify_connectivity = AsyncMock()
        mock_driver.session = MagicMock(return_value=mock_session_cm)
        mock_driver.close = AsyncMock()

        with patch("neo4j.AsyncGraphDatabase.driver", return_value=mock_driver):
            await g.connect("neo4j://localhost", "password")

        mock_driver.verify_connectivity.assert_awaited_once()

    async def test_connect_sets_driver(self):
        g = Neo4jKnowledgeGraph()
        mock_session_cm = MagicMock()
        mock_session_cm.__aenter__ = AsyncMock(return_value=AsyncMock())
        mock_session_cm.__aexit__ = AsyncMock(return_value=False)

        mock_driver = MagicMock()
        mock_driver.verify_connectivity = AsyncMock()
        mock_driver.session = MagicMock(return_value=mock_session_cm)
        mock_driver.close = AsyncMock()

        with patch("neo4j.AsyncGraphDatabase.driver", return_value=mock_driver):
            await g.connect("neo4j://localhost", "password")

        assert g.connected


# ── upsert_entities ───────────────────────────────────────────────────────


class TestUpsertEntities:
    async def test_returns_correct_entity_count(self, connected):
        g, _, _, _ = connected
        entities = [
            ExtractedEntity(name="Alice", entity_type="person"),
            ExtractedEntity(name="Acme", entity_type="organization"),
        ]
        result = await g.upsert_entities("org1", entities, [], "chunk1", "doc1")
        assert result["entities"] == 2

    async def test_returns_correct_relationship_count(self, connected):
        g, _, _, _ = connected
        entities = [
            ExtractedEntity(name="Alice", entity_type="person"),
            ExtractedEntity(name="Acme", entity_type="organization"),
        ]
        rels = [ExtractedRelationship("Alice", "Acme", "works_for")]
        result = await g.upsert_entities("org1", entities, rels, "chunk1", "doc1")
        assert result["relationships"] == 1

    async def test_returns_correct_mention_count(self, connected):
        g, _, _, _ = connected
        entities = [
            ExtractedEntity(name="Alice", entity_type="person"),
            ExtractedEntity(name="Bob", entity_type="person"),
        ]
        result = await g.upsert_entities("org1", entities, [], "chunk1", "doc1")
        assert result["mentions"] == 2

    async def test_empty_entities_returns_zeros(self, connected):
        g, _, _, _ = connected
        result = await g.upsert_entities("org1", [], [], "chunk1", "doc1")
        assert result == {"entities": 0, "relationships": 0, "mentions": 0}

    async def test_session_run_called_for_doc_and_chunk(self, connected):
        g, _, mock_session, _ = connected
        await g.upsert_entities("org1", [], [], "chunk1", "doc1")
        # At minimum: 1 doc merge + 1 chunk merge
        assert mock_session.run.call_count >= 2

    async def test_org_id_passed_to_cypher(self, connected):
        g, _, mock_session, _ = connected
        entities = [ExtractedEntity(name="X", entity_type="concept")]
        await g.upsert_entities("my-org", entities, [], "c1", "d1")
        for call in mock_session.run.call_args_list:
            kwargs = call[1]
            if "org_id" in kwargs:
                assert kwargs["org_id"] == "my-org"

    async def test_entity_properties_passed_to_cypher(self, connected):
        g, _, mock_session, _ = connected
        e = ExtractedEntity(name="X", entity_type="concept", properties={"foo": "bar"})
        await g.upsert_entities("org1", [e], [], "c1", "d1")
        # Find the call that has entity properties
        entity_calls = [
            call for call in mock_session.run.call_args_list if call[1].get("name") == "X"
        ]
        assert len(entity_calls) == 1
        assert entity_calls[0][1]["properties"] == {"foo": "bar"}

    async def test_document_stream_id_is_written_when_present(self, connected):
        g, _, mock_session, _ = connected
        await g.upsert_entities(
            "org1",
            [],
            [],
            "chunk1",
            "doc1",
            stream_id="pharmacy",
        )

        doc_calls = [
            call for call in mock_session.run.call_args_list if call[1].get("doc_id") == "doc1"
        ]
        assert doc_calls
        assert doc_calls[0][1]["stream_id"] == "pharmacy"


# ── link_sequential_chunks ────────────────────────────────────────────────


class TestLinkSequentialChunks:
    async def test_returns_n_minus_one_links(self, connected):
        g, _, _, _ = connected
        count = await g.link_sequential_chunks("org1", ["a", "b", "c"])
        assert count == 2

    async def test_single_chunk_returns_zero(self, connected):
        g, _, _, _ = connected
        count = await g.link_sequential_chunks("org1", ["only"])
        assert count == 0

    async def test_empty_list_returns_zero(self, connected):
        g, _, _, _ = connected
        count = await g.link_sequential_chunks("org1", [])
        assert count == 0

    async def test_two_chunks_returns_one_link(self, connected):
        g, _, _, _ = connected
        count = await g.link_sequential_chunks("org1", ["a", "b"])
        assert count == 1

    async def test_correct_chunk_ids_passed(self, connected):
        g, _, mock_session, _ = connected
        await g.link_sequential_chunks("org1", ["first", "second"])
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["a_id"] == "first"
        assert call_kwargs["b_id"] == "second"


# ── search_entities ───────────────────────────────────────────────────────


class TestSearchEntities:
    async def test_returns_entity_search_results(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(
            return_value=[
                {
                    "id": "ent_abc",
                    "name": "John Smith",
                    "entity_type": "person",
                    "org_id": "org1",
                    "properties": {},
                    "mention_count": 3,
                    "chunk_ids": ["c1", "c2"],
                }
            ]
        )
        results = await g.search_entities("org1", "John")
        assert len(results) == 1
        assert isinstance(results[0], EntitySearchResult)
        assert results[0].name == "John Smith"
        assert results[0].connected_chunks == ["c1", "c2"]

    async def test_empty_graph_returns_empty_list(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        results = await g.search_entities("org1", "nobody")
        assert results == []

    async def test_entity_type_filter_passed_as_param(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.search_entities("org1", "Acme", entity_type="organization")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs.get("entity_type") == "organization"

    async def test_no_entity_type_param_when_none(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.search_entities("org1", "Acme", entity_type=None)
        call_kwargs = mock_session.run.call_args[1]
        assert "entity_type" not in call_kwargs

    async def test_tenant_org_id_scoped(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.search_entities("tenant-A", "test")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["org_id"] == "tenant-A"

    async def test_limit_passed_to_query(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.search_entities("org1", "test", limit=5)
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["limit"] == 5

    async def test_returns_multiple_results(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(
            return_value=[
                {
                    "id": "e1",
                    "name": "Alice",
                    "entity_type": "person",
                    "org_id": "org1",
                    "properties": {},
                    "mention_count": 2,
                    "chunk_ids": [],
                },
                {
                    "id": "e2",
                    "name": "Bob",
                    "entity_type": "person",
                    "org_id": "org1",
                    "properties": {},
                    "mention_count": 1,
                    "chunk_ids": [],
                },
            ]
        )
        results = await g.search_entities("org1", "a")
        assert len(results) == 2


# ── get_entity_context ────────────────────────────────────────────────────


class TestGetEntityContext:
    async def test_returns_graph_paths(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(
            return_value=[
                {
                    "nodes": [
                        {"id": "e1", "name": "Acme", "type": "organization", "org_id": "org1"}
                    ],
                    "rels": [
                        {"type": "RELATED_TO", "weight": 1.0, "source": "Acme", "target": "Cloud"}
                    ],
                    "total_weight": 1.0,
                }
            ]
        )
        paths = await g.get_entity_context("org1", "Acme")
        assert len(paths) == 1
        assert isinstance(paths[0], GraphPath)
        assert paths[0].total_weight == 1.0
        assert len(paths[0].nodes) == 1
        assert len(paths[0].relationships) == 1

    async def test_empty_graph_returns_empty_list(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        paths = await g.get_entity_context("org1", "nobody")
        assert paths == []

    async def test_max_depth_passed_to_query(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.get_entity_context("org1", "Acme", max_depth=3)
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["max_depth"] == 3

    async def test_entity_name_passed_to_query(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.get_entity_context("org1", "TargetEntity")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["entity_name"] == "TargetEntity"

    async def test_org_id_scoped(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.get_entity_context("org-B", "Foo")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["org_id"] == "org-B"


# ── get_chunk_entities ────────────────────────────────────────────────────


class TestGetChunkEntities:
    async def test_returns_entities_for_chunk(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(
            return_value=[
                {
                    "id": "ent_1",
                    "name": "NASA",
                    "entity_type": "organization",
                    "org_id": "org1",
                    "properties": {},
                    "confidence": 0.95,
                }
            ]
        )
        results = await g.get_chunk_entities("org1", "chunk-abc")
        assert len(results) == 1
        assert results[0].name == "NASA"
        assert results[0].relevance == 0.95
        assert results[0].connected_chunks == ["chunk-abc"]

    async def test_empty_chunk_returns_empty_list(self, connected):
        g, _, _, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        results = await g.get_chunk_entities("org1", "empty-chunk")
        assert results == []

    async def test_chunk_id_in_query_params(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.data = AsyncMock(return_value=[])
        await g.get_chunk_entities("org1", "my-chunk-id")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["chunk_id"] == "my-chunk-id"


# ── delete_document_graph ─────────────────────────────────────────────────


class TestDeleteDocumentGraph:
    def _setup_delete_mocks(self, chunk_count: int, orphan_count: int):
        """Return a driver whose session.run() simulates the delete sequence."""
        count_result = AsyncMock()
        count_result.single = AsyncMock(return_value={"chunk_count": chunk_count})

        orphan_result = AsyncMock()
        orphan_result.single = AsyncMock(return_value={"orphan_count": orphan_count})

        generic_result = AsyncMock()
        generic_result.single = AsyncMock(return_value=None)

        call_idx = 0
        # Calls: 1=chunk_count, 2=delete_chunks, 3=delete_doc, 4=orphan_cleanup
        sequence = [count_result, generic_result, generic_result, orphan_result]

        async def run_side_effect(*args, **kwargs):
            nonlocal call_idx
            result = sequence[min(call_idx, len(sequence) - 1)]
            call_idx += 1
            return result

        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=run_side_effect)
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)
        return mock_driver, mock_session

    async def test_returns_chunks_removed(self):
        g = Neo4jKnowledgeGraph()
        mock_driver, _ = self._setup_delete_mocks(chunk_count=3, orphan_count=0)
        g._driver = mock_driver
        stats = await g.delete_document_graph("org1", "doc1")
        assert stats["chunks_removed"] == 3

    async def test_returns_orphaned_entities_removed(self):
        g = Neo4jKnowledgeGraph()
        mock_driver, _ = self._setup_delete_mocks(chunk_count=0, orphan_count=2)
        g._driver = mock_driver
        stats = await g.delete_document_graph("org1", "doc1")
        assert stats["orphaned_entities_removed"] == 2

    async def test_org_id_scoped_in_all_queries(self):
        g = Neo4jKnowledgeGraph()
        mock_driver, mock_session = self._setup_delete_mocks(chunk_count=0, orphan_count=0)
        g._driver = mock_driver
        await g.delete_document_graph("specific-org", "doc1")
        for call in mock_session.run.call_args_list:
            kwargs = call[1]
            if "org_id" in kwargs:
                assert kwargs["org_id"] == "specific-org"

    async def test_document_id_passed_to_queries(self):
        g = Neo4jKnowledgeGraph()
        mock_driver, mock_session = self._setup_delete_mocks(chunk_count=0, orphan_count=0)
        g._driver = mock_driver
        await g.delete_document_graph("org1", "target-doc")
        doc_calls = [
            call
            for call in mock_session.run.call_args_list
            if call[1].get("doc_id") == "target-doc"
        ]
        assert len(doc_calls) >= 1


# ── org_stats ─────────────────────────────────────────────────────────────


class TestOrgStats:
    async def test_returns_full_stats(self, connected):
        g, _, _, mock_result = connected
        mock_result.single = AsyncMock(
            return_value={
                "entity_count": 10,
                "doc_count": 5,
                "chunk_count": 50,
                "relationship_count": 25,
            }
        )
        stats = await g.org_stats("org1")
        assert stats["entities"] == 10
        assert stats["documents"] == 5
        assert stats["chunks"] == 50
        assert stats["relationships"] == 25
        assert stats["org_id"] == "org1"

    async def test_returns_zeros_when_no_data(self, connected):
        g, _, _, mock_result = connected
        mock_result.single = AsyncMock(return_value=None)
        stats = await g.org_stats("empty-org")
        assert stats == {
            "org_id": "empty-org",
            "entities": 0,
            "documents": 0,
            "chunks": 0,
            "relationships": 0,
        }

    async def test_tenant_isolation_org_id_param(self, connected):
        g, _, mock_session, mock_result = connected
        mock_result.single = AsyncMock(
            return_value={
                "entity_count": 0,
                "doc_count": 0,
                "chunk_count": 0,
                "relationship_count": 0,
            }
        )
        await g.org_stats("tenant-x")
        call_kwargs = mock_session.run.call_args[1]
        assert call_kwargs["org_id"] == "tenant-x"
