"""Tests for entity extraction — LLM-based NER with regex fallback."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.adapters.neo4j_graph import ExtractedEntity, ExtractedRelationship
from src.domain.entity_extraction import EntityExtractor, ExtractionResult


# ── Helpers ───────────────────────────────────────────────────────────────


def _llm_response_body(entities: list, relationships: list) -> dict:
    content = json.dumps({"entities": entities, "relationships": relationships})
    return {"choices": [{"message": {"content": content}}]}


def _mock_http_ok(json_data: dict) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    return resp


# ── Unit: _parse_llm_response ─────────────────────────────────────────────


class TestParseLlmResponse:
    def setup_method(self):
        self.extractor = EntityExtractor()

    def test_parses_valid_json(self):
        content = json.dumps({
            "entities": [{"name": "John Smith", "type": "person"}],
            "relationships": [{"source": "John Smith", "target": "Acme", "type": "works_for"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.method == "llm"
        assert len(result.entities) == 1
        assert result.entities[0].name == "John Smith"
        assert result.entities[0].entity_type == "person"
        assert len(result.relationships) == 1
        assert result.relationships[0].relationship_type == "works_for"

    def test_strips_markdown_fences_with_lang(self):
        content = '```json\n{"entities": [], "relationships": []}\n```'
        result = self.extractor._parse_llm_response(content)
        assert result.method == "llm"
        assert result.entities == []

    def test_strips_markdown_fences_no_lang(self):
        content = '```\n{"entities": [], "relationships": []}\n```'
        result = self.extractor._parse_llm_response(content)
        assert result.method == "llm"

    def test_extracts_json_embedded_in_prose(self):
        content = 'Here is the result: {"entities": [{"name": "NASA", "type": "organization"}], "relationships": []}'
        result = self.extractor._parse_llm_response(content)
        assert len(result.entities) == 1
        assert result.entities[0].name == "NASA"

    def test_invalid_json_returns_parse_failed(self):
        result = self.extractor._parse_llm_response("not json at all!!!")
        assert result.method == "llm_parse_failed"
        assert result.entities == []

    def test_skips_entities_without_name(self):
        content = json.dumps({
            "entities": [{"type": "person"}, {"name": "Valid", "type": "concept"}],
            "relationships": [],
        })
        result = self.extractor._parse_llm_response(content)
        assert len(result.entities) == 1
        assert result.entities[0].name == "Valid"

    def test_skips_relationships_missing_source(self):
        content = json.dumps({
            "entities": [],
            "relationships": [{"target": "B", "type": "related_to"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.relationships == []

    def test_skips_relationships_missing_target(self):
        content = json.dumps({
            "entities": [],
            "relationships": [{"source": "A", "type": "related_to"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.relationships == []

    def test_keeps_valid_relationship(self):
        content = json.dumps({
            "entities": [],
            "relationships": [{"source": "A", "target": "B", "type": "related_to"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert len(result.relationships) == 1

    def test_default_entity_type_is_concept(self):
        content = json.dumps({"entities": [{"name": "SomeEntity"}], "relationships": []})
        result = self.extractor._parse_llm_response(content)
        assert result.entities[0].entity_type == "concept"

    def test_default_relationship_type_is_related_to(self):
        content = json.dumps({
            "entities": [],
            "relationships": [{"source": "A", "target": "B"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.relationships[0].relationship_type == "related_to"

    def test_default_confidence_is_0_9(self):
        content = json.dumps({"entities": [{"name": "X", "type": "concept"}], "relationships": []})
        result = self.extractor._parse_llm_response(content)
        assert result.entities[0].confidence == 0.9

    def test_properties_passed_through(self):
        content = json.dumps({
            "entities": [{"name": "X", "type": "person", "properties": {"role": "engineer"}}],
            "relationships": [],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.entities[0].properties == {"role": "engineer"}

    def test_empty_entities_and_relationships(self):
        content = json.dumps({"entities": [], "relationships": []})
        result = self.extractor._parse_llm_response(content)
        assert result.method == "llm"
        assert result.entities == []
        assert result.relationships == []

    def test_default_relationship_weight(self):
        content = json.dumps({
            "entities": [],
            "relationships": [{"source": "A", "target": "B", "type": "related_to"}],
        })
        result = self.extractor._parse_llm_response(content)
        assert result.relationships[0].weight == 1.0


# ── Unit: _extract_regex ──────────────────────────────────────────────────


class TestExtractRegex:
    def test_extracts_capitalized_multi_word_phrases(self):
        text = "John Smith works at Acme Corporation in New York."
        result = EntityExtractor._extract_regex(text)
        assert result.method == "regex"
        names = [e.name for e in result.entities]
        assert "John Smith" in names
        assert "Acme Corporation" in names
        assert "New York" in names

    def test_extracts_acronyms(self):
        text = "The FBI and CIA are federal agencies. Also the NSA."
        result = EntityExtractor._extract_regex(text)
        names = [e.name for e in result.entities]
        assert "FBI" in names
        assert "CIA" in names
        assert "NSA" in names

    def test_acronyms_get_organization_type(self):
        text = "The NASA program is ongoing."
        result = EntityExtractor._extract_regex(text)
        acronym = next((e for e in result.entities if e.name == "NASA"), None)
        assert acronym is not None
        assert acronym.entity_type == "organization"

    def test_capitalized_phrases_get_concept_type(self):
        text = "The Global Innovation Team leads the initiative."
        result = EntityExtractor._extract_regex(text)
        phrase = next((e for e in result.entities if "Global Innovation" in e.name), None)
        assert phrase is not None
        assert phrase.entity_type == "concept"

    def test_acronyms_have_lower_confidence_than_llm(self):
        text = "The FBI runs programs."
        result = EntityExtractor._extract_regex(text)
        acronym = next((e for e in result.entities if e.name == "FBI"), None)
        assert acronym is not None
        assert acronym.confidence < 0.9

    def test_limits_to_20_entities(self):
        words = " and ".join(f"Entity{i} Corp" for i in range(30))
        result = EntityExtractor._extract_regex(words)
        assert len(result.entities) <= 20

    def test_no_relationships_from_regex(self):
        text = "John Smith works at Acme Corp and manages the team."
        result = EntityExtractor._extract_regex(text)
        assert result.relationships == []

    def test_deduplicates_entities(self):
        text = "John Smith mentioned John Smith again and again."
        result = EntityExtractor._extract_regex(text)
        names = [e.name for e in result.entities]
        assert names.count("John Smith") == 1

    def test_short_single_words_excluded_from_capitalized_phrases(self):
        # Pattern requires at least two capitalized words joined
        text = "Just some Text here."
        result = EntityExtractor._extract_regex(text)
        # Single capitalized words don't match the multi-word pattern
        names = [e.name for e in result.entities]
        assert "Text" not in names

    def test_returns_extraction_result_type(self):
        result = EntityExtractor._extract_regex("Some text here.")
        assert isinstance(result, ExtractionResult)


# ── Unit: extract() routing ───────────────────────────────────────────────


class TestExtractRouting:
    @pytest.fixture
    def extractor(self):
        return EntityExtractor()

    async def test_very_short_text_returns_skip(self, extractor):
        result = await extractor.extract("Hi")
        assert result.method == "skip"
        assert result.entities == []
        assert result.relationships == []

    async def test_text_under_20_chars_is_skipped(self, extractor):
        result = await extractor.extract("A" * 19)
        assert result.method == "skip"

    async def test_text_of_exactly_20_chars_calls_llm(self, extractor):
        llm_body = _llm_response_body([{"name": "X", "type": "concept"}], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        result = await extractor.extract("A" * 20)
        assert result.method == "llm"

    async def test_llm_connect_error_falls_back_to_regex(self, extractor):
        extractor._http.post = AsyncMock(side_effect=httpx.ConnectError("timeout"))
        text = "John Smith works at Acme Corporation in Dallas."
        result = await extractor.extract(text)
        assert result.method == "regex"

    async def test_http_status_error_falls_back_to_regex(self, extractor):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )
        extractor._http.post = AsyncMock(return_value=mock_resp)
        result = await extractor.extract("John Smith at Global Technologies today.")
        assert result.method == "regex"

    async def test_successful_llm_extraction(self, extractor):
        llm_body = _llm_response_body(
            [{"name": "Google", "type": "organization"}],
            [{"source": "Google", "target": "Cloud", "type": "produces"}],
        )
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        result = await extractor.extract("Google produces Cloud computing solutions.")
        assert result.method == "llm"
        assert len(result.entities) == 1
        assert result.entities[0].name == "Google"


# ── Unit: _extract_llm ────────────────────────────────────────────────────


class TestExtractLlm:
    @pytest.fixture
    def extractor(self):
        return EntityExtractor(llm_url="http://fake-llm/v1", llm_api_key="sk-test")

    async def test_posts_to_chat_completions(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        await extractor._extract_llm("Some text about things.")
        url = extractor._http.post.call_args[0][0]
        assert url.endswith("/chat/completions")

    async def test_sends_bearer_auth_header(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        await extractor._extract_llm("Some text about things.")
        headers = extractor._http.post.call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer sk-test"

    async def test_uses_configured_model(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        await extractor._extract_llm("Some text.")
        payload = extractor._http.post.call_args[1]["json"]
        assert payload["model"] == "gemini-2.0-flash"

    async def test_zero_temperature(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        await extractor._extract_llm("Some text.")
        payload = extractor._http.post.call_args[1]["json"]
        assert payload["temperature"] == 0.0

    async def test_truncates_text_beyond_4000_chars(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        long_text = "x" * 8000
        await extractor._extract_llm(long_text)
        payload = extractor._http.post.call_args[1]["json"]
        sent = payload["messages"][0]["content"]
        # The original text (truncated to 4000) shouldn't contain char 4001+
        assert "x" * 4001 not in sent

    async def test_short_text_not_truncated(self, extractor):
        llm_body = _llm_response_body([], [])
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        short_text = "Hello world this is a test."
        await extractor._extract_llm(short_text)
        payload = extractor._http.post.call_args[1]["json"]
        sent = payload["messages"][0]["content"]
        assert short_text in sent

    async def test_returns_extraction_result(self, extractor):
        llm_body = _llm_response_body(
            [{"name": "OpenAI", "type": "organization"}],
            [],
        )
        extractor._http.post = AsyncMock(return_value=_mock_http_ok(llm_body))
        result = await extractor._extract_llm("OpenAI builds AI systems.")
        assert isinstance(result, ExtractionResult)
        assert result.entities[0].name == "OpenAI"

    async def test_calls_raise_for_status(self, extractor):
        llm_body = _llm_response_body([], [])
        mock_resp = _mock_http_ok(llm_body)
        extractor._http.post = AsyncMock(return_value=mock_resp)
        await extractor._extract_llm("Some text.")
        mock_resp.raise_for_status.assert_called_once()


# ── Lifecycle ─────────────────────────────────────────────────────────────


class TestLifecycle:
    async def test_close_shuts_down_http_client(self):
        extractor = EntityExtractor()
        extractor._http.aclose = AsyncMock()
        await extractor.close()
        extractor._http.aclose.assert_awaited_once()
