"""Tests for GraphRAG community detection and summarization."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.domain.graph_communities import Community, CommunityDetector, CommunityReport


# ── Helpers ───────────────────────────────────────────────────────────────


def _make_driver_with_louvain(louvain_records: list[dict]):
    """
    Build a mock neo4j driver where the first session.run() returns
    the provided Louvain records; subsequent calls return empty results.
    """
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

    return mock_driver, mock_session


def _community_record(cid: int, members: list[str]) -> dict:
    return {"communityId": cid, "members": members, "memberCount": len(members)}


# ── CommunityDetector init ────────────────────────────────────────────────


class TestCommunityDetectorInit:
    def test_default_min_size(self):
        d = CommunityDetector()
        assert d._min_size == 3

    def test_custom_min_size(self):
        d = CommunityDetector(min_community_size=5)
        assert d._min_size == 5

    def test_driver_defaults_to_none(self):
        d = CommunityDetector()
        assert d._driver is None

    def test_gemini_defaults_to_none(self):
        d = CommunityDetector()
        assert d._gemini is None


# ── detect_and_summarize ──────────────────────────────────────────────────


class TestDetectAndSummarize:
    async def test_returns_empty_report_without_driver(self):
        d = CommunityDetector(neo4j_driver=None)
        report = await d.detect_and_summarize("org1")
        assert isinstance(report, CommunityReport)
        assert report.total_communities == 0
        assert report.communities == []

    async def test_report_org_id_matches_arg(self):
        d = CommunityDetector(neo4j_driver=None)
        report = await d.detect_and_summarize("my-org")
        assert report.org_id == "my-org"

    async def test_returns_empty_report_when_no_communities_detected(self):
        mock_driver, _ = _make_driver_with_louvain([])
        d = CommunityDetector(neo4j_driver=mock_driver)
        report = await d.detect_and_summarize("org1")
        assert report.total_communities == 0

    async def test_filters_communities_below_min_size(self):
        records = [
            _community_record(1, ["A", "B"]),        # size 2 — below min_size=3
            _community_record(2, ["X", "Y", "Z", "W"]),  # size 4 — passes
        ]
        mock_driver, _ = _make_driver_with_louvain(records)
        d = CommunityDetector(neo4j_driver=mock_driver, min_community_size=3)
        report = await d.detect_and_summarize("org1")
        assert report.total_communities == 1

    async def test_counts_all_filtered_communities(self):
        records = [
            _community_record(1, ["A", "B", "C"]),      # passes (size 3)
            _community_record(2, ["D", "E", "F"]),      # passes (size 3)
            _community_record(3, ["G", "H"]),           # fails (size 2)
        ]
        mock_driver, _ = _make_driver_with_louvain(records)
        d = CommunityDetector(neo4j_driver=mock_driver, min_community_size=3)
        report = await d.detect_and_summarize("org1")
        assert report.total_communities == 2

    async def test_duration_ms_is_non_negative(self):
        mock_driver, _ = _make_driver_with_louvain([])
        d = CommunityDetector(neo4j_driver=mock_driver)
        report = await d.detect_and_summarize("org1")
        assert report.duration_ms >= 0

    async def test_generates_summaries_when_gemini_available(self):
        records = [_community_record(1, ["A", "B", "C"])]
        mock_driver, _ = _make_driver_with_louvain(records)
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="Summary of A, B, and C.")
        d = CommunityDetector(neo4j_driver=mock_driver, gemini_client=mock_gemini)
        report = await d.detect_and_summarize("org1")
        assert report.summaries_generated == 1
        assert report.communities[0].summary == "Summary of A, B, and C."

    async def test_gemini_failure_does_not_crash(self):
        records = [_community_record(1, ["A", "B", "C"])]
        mock_driver, _ = _make_driver_with_louvain(records)
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(side_effect=Exception("Gemini down"))
        d = CommunityDetector(neo4j_driver=mock_driver, gemini_client=mock_gemini)
        report = await d.detect_and_summarize("org1")
        assert report.summaries_generated == 0  # failed, not counted

    async def test_communities_populated_in_report(self):
        records = [_community_record(42, ["A", "B", "C"])]
        mock_driver, _ = _make_driver_with_louvain(records)
        d = CommunityDetector(neo4j_driver=mock_driver)
        report = await d.detect_and_summarize("org1")
        assert len(report.communities) == 1
        assert report.communities[0].community_id == 42


# ── _run_louvain ──────────────────────────────────────────────────────────


class TestRunLouvain:
    async def test_returns_community_objects_from_gds(self):
        records = [_community_record(10, ["Alpha", "Beta", "Gamma"])]
        mock_result = AsyncMock()
        mock_result.data = AsyncMock(return_value=records)

        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=mock_result)

        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver, min_community_size=2)
        communities = await d._run_louvain("org1")

        assert len(communities) == 1
        c = communities[0]
        assert isinstance(c, Community)
        assert c.community_id == 10
        assert c.member_count == 3
        assert set(c.entity_names) == {"Alpha", "Beta", "Gamma"}

    async def test_falls_back_to_cypher_when_gds_unavailable(self):
        fallback_records = [_community_record(99, ["X", "Y", "Z"])]
        fallback_result = AsyncMock()
        fallback_result.data = AsyncMock(return_value=fallback_records)

        call_idx = 0

        async def run_side_effect(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                raise Exception("Procedure gds.louvain.stream not found")
            return fallback_result

        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=run_side_effect)
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver, min_community_size=2)
        communities = await d._run_louvain("org1")

        # Fallback was used — two run() calls were made
        assert mock_session.run.call_count == 2
        assert len(communities) == 1
        assert communities[0].community_id == 99

    async def test_returns_empty_list_on_complete_failure(self):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=Exception("Neo4j unreachable"))
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver)
        result = await d._run_louvain("org1")
        assert result == []

    async def test_entity_names_capped_at_20(self):
        many_members = [f"Entity{i}" for i in range(30)]
        records = [{"communityId": 1, "members": many_members, "memberCount": 30}]
        mock_result = AsyncMock()
        mock_result.data = AsyncMock(return_value=records)
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(return_value=mock_result)
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver, min_community_size=2)
        communities = await d._run_louvain("org1")
        assert len(communities[0].entity_names) <= 20


# ── _summarize_community ──────────────────────────────────────────────────


class TestSummarizeCommunity:
    async def test_fallback_without_gemini_includes_entity_names(self):
        d = CommunityDetector(gemini_client=None)
        summary = await d._summarize_community(["Alpha", "Beta", "Gamma"], [])
        assert any(name in summary for name in ["Alpha", "Beta", "Gamma"])

    async def test_uses_gemini_and_strips_whitespace(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="  Generated summary.  ")
        d = CommunityDetector(gemini_client=mock_gemini)
        result = await d._summarize_community(["A"], ["context"])
        assert result == "Generated summary."

    async def test_gemini_failure_returns_empty_string(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(side_effect=RuntimeError("timeout"))
        d = CommunityDetector(gemini_client=mock_gemini)
        result = await d._summarize_community(["A"], ["content"])
        assert result == ""

    async def test_prompt_includes_entity_names(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        d = CommunityDetector(gemini_client=mock_gemini)
        await d._summarize_community(["EntityFoo", "EntityBar"], [])
        prompt = mock_gemini.generate.call_args[0][0]
        assert "EntityFoo" in prompt
        assert "EntityBar" in prompt

    async def test_prompt_includes_chunk_context(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        d = CommunityDetector(gemini_client=mock_gemini)
        await d._summarize_community(["A"], ["representative chunk content here"])
        prompt = mock_gemini.generate.call_args[0][0]
        assert "representative chunk content here" in prompt

    async def test_entity_names_capped_at_15_in_prompt(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        d = CommunityDetector(gemini_client=mock_gemini)
        many_names = [f"Entity{i}" for i in range(20)]
        await d._summarize_community(many_names, [])
        prompt = mock_gemini.generate.call_args[0][0]
        # Entity15 onwards should not appear (cap is 15)
        assert "Entity15" not in prompt

    async def test_chunk_contents_capped_at_5_in_prompt(self):
        mock_gemini = AsyncMock()
        mock_gemini.generate = AsyncMock(return_value="summary")
        d = CommunityDetector(gemini_client=mock_gemini)
        many_chunks = [f"chunk-content-{i}" for i in range(10)]
        await d._summarize_community(["A"], many_chunks)
        prompt = mock_gemini.generate.call_args[0][0]
        assert "chunk-content-5" not in prompt  # capped at 5


# ── _store_community_node ─────────────────────────────────────────────────


class TestStoreCommunityNode:
    async def test_skips_when_no_driver(self):
        d = CommunityDetector(neo4j_driver=None)
        c = Community(community_id=1, summary="test", member_count=3)
        await d._store_community_node(c, "org1")  # must not raise

    async def test_skips_when_summary_is_empty(self):
        mock_session = AsyncMock()
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver)
        c = Community(community_id=1, summary="", member_count=3)
        await d._store_community_node(c, "org1")
        mock_session.run.assert_not_called()

    async def test_stores_node_with_correct_id_and_org(self):
        mock_session = AsyncMock()
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver)
        c = Community(community_id=7, summary="A summary.", member_count=4,
                      entity_names=["A", "B", "C", "D"])
        await d._store_community_node(c, "my-org")

        mock_session.run.assert_awaited_once()
        kwargs = mock_session.run.call_args[1]
        assert kwargs["id"] == 7
        assert kwargs["org_id"] == "my-org"
        assert kwargs["summary"] == "A summary."
        assert kwargs["count"] == 4

    async def test_write_failure_does_not_raise(self):
        mock_session = AsyncMock()
        mock_session.run = AsyncMock(side_effect=Exception("write failed"))
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver)
        c = Community(community_id=1, summary="summary", member_count=3)
        await d._store_community_node(c, "org1")  # must not raise

    async def test_entity_names_capped_at_20_in_storage(self):
        mock_session = AsyncMock()
        mock_driver = MagicMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        d = CommunityDetector(neo4j_driver=mock_driver)
        many_names = [f"E{i}" for i in range(30)]
        c = Community(community_id=1, summary="summary", member_count=30,
                      entity_names=many_names)
        await d._store_community_node(c, "org1")
        kwargs = mock_session.run.call_args[1]
        assert len(kwargs["entities"]) <= 20
