"""
E2E tests for the orchestrator chat flow.

These tests exercise the full request lifecycle through the API layer
with a mock ADK agent, validating:
  - Chat request → trace events → aggregated response
  - Tool dispatching with the real (demo) tool implementations
  - Guardrail enforcement (input validation, PII detection)
  - SSE streaming endpoint
  - Error handling for malformed requests

The underlying LLM calls are mocked, but tool execution, guardrails,
prompt assembly, and API serialization are all exercised end-to-end.
"""

from __future__ import annotations

import json
import time
from typing import Any
from unittest.mock import MagicMock

import hki_runtime
from fastapi.testclient import TestClient

from src.api.app import app
from src.domain.tools import check_inventory, get_product_pricing, search_products

# ── Helpers ───────────────────────────────────────────────────────────────


def _make_mock_agent(
    chunks: list[dict[str, Any] | str] | None = None,
    tools: list | None = None,
):
    """Build a mock AdkAgent whose ``chat_stream`` yields *chunks*."""
    agent = MagicMock()

    if chunks is None:
        chunks = [{"type": "final_response_chunk", "content": "Hello!"}]

    async def _fake_stream(*, session_id: str, message: str, **kwargs):  # noqa: ARG001
        for c in chunks:
            yield c

    agent.chat_stream = _fake_stream
    agent.tools = tools if tools is not None else []
    return agent


def _inject_agent(agent) -> TestClient:
    """Return a ``TestClient`` with the given mock agent on ``app.state``."""
    app.state.agent = agent
    return TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-HKI-Envelope": _hki_envelope_header()},
    )


def _hki_envelope_header(active_domain: str = "dev") -> str:
    now = int(time.time())
    envelope = {
        "hki_version": "1.0",
        "envelope_id": f"env-test-{active_domain}",
        "org_id": "default",
        "subject_id": "0",
        "active_domain": active_domain,
        "authorized_domains": [active_domain],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "policy-test",
        "issued_at": now - 1,
        "expires_at": now + 300,
        "issuer": "agentic-bff",
    }
    envelope["signature"] = hki_runtime.sign_envelope(
        envelope,
        "unit-test-hki-secret",
    )
    return json.dumps(envelope)


def _chat_payload(
    message: str = "Hi",
    conversation_id: str = "conv-e2e",
    scopes: list[str] | None = None,
) -> dict:
    payload: dict = {
        "message": message,
        "conversation_id": conversation_id,
    }
    if scopes:
        payload["scopes"] = scopes
    return payload


# ═════════════════════════════════════════════════════════════════════════════
# E2E: Full Chat Flow (/v1/chat — synchronous accumulation endpoint)
# ═════════════════════════════════════════════════════════════════════════════


class TestE2EChatFlow:
    """Full request lifecycle through the orchestrator's /v1/chat endpoint."""

    def test_simple_greeting_returns_200_with_all_fields(self):
        """Simplest happy path: one final_response_chunk → valid response."""
        agent = _make_mock_agent(
            chunks=[{"type": "final_response_chunk", "content": "Hi there!"}],
        )
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("Hello"))
        assert resp.status_code == 200

        body = resp.json()
        assert body["content"] == "Hi there!"
        assert body["message_id"] == "msg-adk"
        assert "agent_used" in body
        assert body["guardrails"]["passed"] is True
        assert isinstance(body["tool_calls"], list)
        assert isinstance(body["trace"], list)
        assert isinstance(body["citations"], list)

    def test_multi_chunk_content_concatenated(self):
        """Multiple final_response_chunk events are concatenated."""
        agent = _make_mock_agent(
            chunks=[
                {"type": "final_response_chunk", "content": "Part one. "},
                {"type": "final_response_chunk", "content": "Part two."},
            ],
        )
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("Tell me more"))
        assert resp.status_code == 200
        assert resp.json()["content"] == "Part one. Part two."

    def test_thinking_and_tool_events_in_trace(self):
        """Thinking, tool_call, and tool_result events populate trace and tool_calls."""
        agent = _make_mock_agent(
            chunks=[
                {"type": "thinking", "step": 1, "content": "Let me search for that."},
                {
                    "type": "tool_call",
                    "step": 2,
                    "content": "Calling search_products",
                    "metadata": {
                        "tool": "search_products",
                        "arguments": {"query": "water"},
                        "tool_call_id": "tc-1",
                    },
                },
                {
                    "type": "tool_result",
                    "step": 3,
                    "content": '{"results": []}',
                    "metadata": {
                        "result": {
                            "tool_call_id": "tc-1",
                            "output": {"results": []},
                            "duration_ms": 12,
                        },
                    },
                },
                {"type": "final_response_chunk", "content": "Found some products."},
            ],
        )
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("Find water"))
        assert resp.status_code == 200

        body = resp.json()
        assert body["content"] == "Found some products."
        # thinking event goes into trace
        assert any(t["type"] == "thinking" for t in body["trace"])
        # tool_call is extracted into tool_calls with metadata
        assert len(body["tool_calls"]) == 1
        assert body["tool_calls"][0]["name"] == "search_products"
        assert body["tool_calls"][0]["tool_call_id"] == "tc-1"
        assert body["tool_calls"][0]["duration_ms"] == 12

    def test_string_chunks_concatenated_as_content(self):
        """Plain string chunks (not dicts) are appended to full_response."""
        agent = _make_mock_agent(chunks=["Hello ", "world!"])
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("Greet me"))
        assert resp.status_code == 200
        assert resp.json()["content"] == "Hello world!"

    def test_knowledge_retrieval_populates_citations(self):
        """knowledge_retrieval chunks populate the citations list."""
        agent = _make_mock_agent(
            chunks=[
                {
                    "type": "knowledge_retrieval",
                    "step": 1,
                    "content": "Retrieved 2 docs",
                    "metadata": {
                        "citations": [
                            {"title": "Policy Doc", "url": "https://example.com/a"},
                            {"title": "FAQ", "url": "https://example.com/b"},
                        ],
                    },
                },
                {"type": "final_response_chunk", "content": "Here is what I found."},
            ],
        )
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("Tell me about returns"))
        assert resp.status_code == 200

        body = resp.json()
        assert len(body["citations"]) == 2
        assert body["citations"][0]["title"] == "Policy Doc"

    def test_missing_conversation_id_returns_422(self):
        """conversation_id is a required field."""
        agent = _make_mock_agent()
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json={"message": "Hi"})
        assert resp.status_code == 422

    def test_missing_message_returns_422(self):
        """message is a required field."""
        agent = _make_mock_agent()
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json={"conversation_id": "conv-val"})
        assert resp.status_code == 422

    def test_empty_body_returns_422(self):
        """Completely empty body is rejected."""
        agent = _make_mock_agent()
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json={})
        assert resp.status_code == 422

    def test_response_metadata_propagated(self):
        """response_metadata chunk populates agent_used and confidence."""
        agent = _make_mock_agent(
            chunks=[
                {
                    "type": "response_metadata",
                    "metadata": {
                        "agent": "pharmacy_specialist",
                        "confidence": 0.92,
                    },
                },
                {"type": "final_response_chunk", "content": "Take as directed."},
            ],
        )
        client = _inject_agent(agent)

        resp = client.post("/v1/chat", json=_chat_payload("How to take aspirin?"))
        assert resp.status_code == 200

        body = resp.json()
        assert body["agent_used"] == "pharmacy_specialist"
        assert body["confidence"] == 0.92


# ═════════════════════════════════════════════════════════════════════════════
# E2E: SSE Streaming (/v1/chat/stream)
# ═════════════════════════════════════════════════════════════════════════════


class TestE2EStreamingChat:
    """POST /v1/chat/stream — Server-Sent Events."""

    def _parse_sse_events(self, response) -> list[dict | str]:
        """Parse SSE data lines from a streaming response."""
        events: list[dict | str] = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                raw = line[6:]
                if raw == "[DONE]":
                    events.append("[DONE]")
                else:
                    events.append(json.loads(raw))
        return events

    def test_stream_yields_guardrail_then_content_then_done(self):
        """SSE stream: guardrail event → chunk → final response → [DONE]."""
        agent = _make_mock_agent(
            chunks=[{"type": "final_response_chunk", "content": "Here you go."}],
        )
        client = _inject_agent(agent)

        with client.stream(
            "POST",
            "/v1/chat/stream",
            json=_chat_payload("Stream test"),
        ) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")
            events = self._parse_sse_events(resp)

        # First event is the input guardrail pass
        assert events[0]["type"] == "guardrail"
        assert events[0]["metadata"]["section"] == "INPUT_GUARDRAILS"
        assert events[0]["metadata"]["passed"] is True

        chunk_events = [
            e for e in events if isinstance(e, dict) and e.get("type") == "final_response_chunk"
        ]
        response_events = [
            e for e in events if isinstance(e, dict) and e.get("type") == "final_response"
        ]
        assert len(chunk_events) == 1
        assert chunk_events[0]["content"] == "Here you go."
        assert len(response_events) >= 1
        assert response_events[-1]["content"] == "Here you go."

        # Last event is [DONE]
        assert events[-1] == "[DONE]"

    def test_stream_thinking_events_propagated(self):
        """Thinking events appear in the SSE stream."""
        agent = _make_mock_agent(
            chunks=[
                {"type": "thinking", "step": 1, "content": "Reasoning..."},
                {"type": "final_response_chunk", "content": "Done."},
            ],
        )
        client = _inject_agent(agent)

        with client.stream(
            "POST",
            "/v1/chat/stream",
            json=_chat_payload("Think about this"),
        ) as resp:
            events = self._parse_sse_events(resp)

        thinking_events = [e for e in events if isinstance(e, dict) and e.get("type") == "thinking"]
        assert len(thinking_events) >= 1
        assert thinking_events[0]["content"] == "Reasoning..."

    def test_stream_missing_fields_returns_422(self):
        """Missing required fields return 422, not a stream."""
        agent = _make_mock_agent()
        client = _inject_agent(agent)

        resp = client.post("/v1/chat/stream", json={"message": "hi"})
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# E2E: Tool Execution (Real Demo Tool Implementations)
# ═════════════════════════════════════════════════════════════════════════════


class TestE2EToolExecution:
    """Validate the mock tool implementations return sensible data."""

    def test_search_products_finds_by_keyword(self):
        result = search_products("toilet paper")
        assert result["total_results"] > 0
        names = [r["name"].lower() for r in result["results"]]
        assert any("tissue" in n or "towel" in n or "toilet" in n for n in names)

    def test_search_products_filters_by_category(self):
        result = search_products("water", category="Beverages")
        for r in result["results"]:
            assert r["category"] == "Beverages"

    def test_search_products_no_match_returns_empty(self):
        result = search_products("xyznonexistent9999")
        assert result["total_results"] == 0
        assert result["results"] == []

    def test_check_inventory_valid_sku(self):
        result = check_inventory("KS-2001")
        assert "quantity" in result
        assert "product_name" in result
        assert result["sku"] == "KS-2001"

    def test_check_inventory_unknown_sku(self):
        result = check_inventory("FAKE-999")
        assert "error" in result

    def test_get_product_pricing_valid_sku(self):
        result = get_product_pricing("EL-5001")
        assert "base_price" in result
        assert "current_price" in result

    def test_get_product_pricing_unknown_sku(self):
        result = get_product_pricing("FAKE-999")
        assert "error" in result

    def test_search_products_relevance_ranking(self):
        """More relevant products rank higher."""
        result = search_products("kirkland water")
        if result["total_results"] >= 2:
            first_name = result["results"][0]["name"].lower()
            assert "kirkland" in first_name or "water" in first_name


# ═════════════════════════════════════════════════════════════════════════════
# E2E: Health & Tools Endpoints
# ═════════════════════════════════════════════════════════════════════════════


class TestE2EHealthAndTools:
    """Validate the health and tool catalog endpoints."""

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_readiness_probe(self, client):
        resp = client.get("/ready")
        assert resp.status_code in (200, 503)

    def test_tool_catalog_returns_list(self):
        agent = _make_mock_agent()
        client = _inject_agent(agent)
        resp = client.get("/v1/tools")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        for tool in body:
            assert "name" in tool
            assert "description" in tool
