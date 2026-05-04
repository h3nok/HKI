"""
Tests for AgentEngineClient — the thin proxy inside the Orchestrator Service
that delegates chat_stream() calls to a deployed Vertex AI Agent Engine.

The Vertex AI SDK (google-cloud-aiplatform) is NOT required to be installed —
all external SDK calls are mocked at the module level.

Proxy flow under test:
    routes.py
      └── AgentEngineClient.chat_stream(session_id, message, scope, stream_config)
            ├── serialises stream_config Pydantic model → plain dict
            ├── calls self._remote.query(message=..., session_id=..., ...)
            └── unpacks result["events"] and yields each chunk

The remote.query() represents the Vertex AI SDK call that reaches the
deployed AgentEngineWrapper on Agent Engine.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────


def _make_remote(events: list[dict[str, Any]], final_response: str = "") -> MagicMock:
    """Fake ReasoningEngine SDK object whose .query() returns an events payload."""
    remote = MagicMock()
    remote.query.return_value = {"events": events, "final_response": final_response}
    return remote


def _make_stream_config(**kwargs) -> Any:
    """Build a real StreamConfig Pydantic model (avoids import at module level)."""
    from src.api.routes import StreamConfig

    return StreamConfig(**kwargs)


async def _collect(gen) -> list[dict[str, Any]]:
    """Drain an async generator into a list."""
    return [chunk async for chunk in gen]


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture()
def patched_client():
    """
    Return an AgentEngineClient with the Vertex AI SDK mocked out.

    When the SDK is not installed, _VERTEXAI_AVAILABLE=False and neither
    'vertexai' nor '_re' are bound in the module.  Use create=True so
    patch() can inject them even when absent.
    """
    fake_re_module = MagicMock()
    fake_vertexai = MagicMock()

    with (
        patch("src.adapters.agent_engine_client._VERTEXAI_AVAILABLE", True),
        patch("src.adapters.agent_engine_client.vertexai", fake_vertexai, create=True),
        patch("src.adapters.agent_engine_client._re", fake_re_module, create=True),
    ):
        from src.adapters.agent_engine_client import AgentEngineClient

        # Bypass __init__ (which calls vertexai.init + _re.ReasoningEngine)
        # and set _remote directly so each test controls the remote object.
        client = AgentEngineClient.__new__(AgentEngineClient)
        client._resource_name = "projects/test/locations/us-central1/reasoningEngines/123"
        yield client, fake_re_module


# ═══════════════════════════════════════════════════════════════════════════
# Proxy flow
# ═══════════════════════════════════════════════════════════════════════════


class TestProxyFlow:
    async def test_events_are_re_yielded_in_order(self, patched_client):
        """Events returned by Agent Engine are yielded in the same order."""
        client, _ = patched_client
        events = [
            {"type": "thinking", "content": "Analysing"},
            {"type": "tool_call", "content": "Calling search_knowledge"},
            {"type": "final_response_chunk", "content": "The answer is 42."},
        ]
        client._remote = _make_remote(events)

        result = await _collect(
            client.chat_stream(session_id="s-1", message="What is the answer?")
        )

        assert result == events

    async def test_remote_query_receives_correct_params(self, patched_client):
        """query() is called with message, session_id, scope, and stream_config."""
        client, _ = patched_client
        client._remote = _make_remote([])

        await _collect(
            client.chat_stream(
                session_id="sess-42",
                message="Hello Agent Engine",
                scope="pharmacy",
            )
        )

        client._remote.query.assert_called_once_with(
            message="Hello Agent Engine",
            session_id="sess-42",
            scope="pharmacy",
            stream_config=None,
        )

    async def test_empty_events_list_yields_nothing(self, patched_client):
        """An empty events list results in zero yielded chunks — no crash."""
        client, _ = patched_client
        client._remote = _make_remote([])

        result = await _collect(
            client.chat_stream(session_id="s-1", message="Hello")
        )

        assert result == []

    async def test_default_scope_is_global(self, patched_client):
        """scope defaults to 'global' when not supplied."""
        client, _ = patched_client
        client._remote = _make_remote([])

        await _collect(client.chat_stream(session_id="s-1", message="Hi"))

        _, kwargs = client._remote.query.call_args
        assert kwargs["scope"] == "global"


# ═══════════════════════════════════════════════════════════════════════════
# stream_config serialisation
# ═══════════════════════════════════════════════════════════════════════════


class TestStreamConfigSerialisation:
    async def test_pydantic_model_is_converted_to_dict(self, patched_client):
        """StreamConfig Pydantic model → plain dict before reaching Agent Engine."""
        client, _ = patched_client
        client._remote = _make_remote([])
        sc = _make_stream_config(system_prompt="Be concise.", retrieval_strategy="hybrid")

        await _collect(
            client.chat_stream(session_id="s-1", message="Hi", stream_config=sc)
        )

        _, kwargs = client._remote.query.call_args
        assert isinstance(kwargs["stream_config"], dict)
        assert kwargs["stream_config"]["system_prompt"] == "Be concise."
        assert kwargs["stream_config"]["retrieval_strategy"] == "hybrid"

    async def test_none_fields_excluded_from_dict(self, patched_client):
        """Unset (None) StreamConfig fields are excluded — Agent Engine gets only what was set."""
        client, _ = patched_client
        client._remote = _make_remote([])
        sc = _make_stream_config(system_prompt="Short answers only.")

        await _collect(
            client.chat_stream(session_id="s-1", message="Hi", stream_config=sc)
        )

        _, kwargs = client._remote.query.call_args
        sc_dict = kwargs["stream_config"]
        assert "enabled_tools" not in sc_dict
        assert "guardrail_config" not in sc_dict

    async def test_none_stream_config_passes_none(self, patched_client):
        """None stream_config is forwarded as None (not an empty dict)."""
        client, _ = patched_client
        client._remote = _make_remote([])

        await _collect(
            client.chat_stream(session_id="s-1", message="Hi", stream_config=None)
        )

        _, kwargs = client._remote.query.call_args
        assert kwargs["stream_config"] is None

    async def test_enabled_tools_list_is_serialised(self, patched_client):
        """list fields inside StreamConfig survive the Pydantic → dict conversion."""
        client, _ = patched_client
        client._remote = _make_remote([])
        sc = _make_stream_config(enabled_tools=["search_knowledge", "check_inventory"])

        await _collect(
            client.chat_stream(session_id="s-1", message="Hi", stream_config=sc)
        )

        _, kwargs = client._remote.query.call_args
        assert kwargs["stream_config"]["enabled_tools"] == [
            "search_knowledge",
            "check_inventory",
        ]


# ═══════════════════════════════════════════════════════════════════════════
# SDK unavailable
# ═══════════════════════════════════════════════════════════════════════════


class TestSDKUnavailable:
    def test_raises_runtime_error_when_sdk_not_installed(self):
        """
        If google-cloud-aiplatform is not installed, AgentEngineClient raises
        RuntimeError immediately on construction — not silently at query time.
        """
        with patch("src.adapters.agent_engine_client._VERTEXAI_AVAILABLE", False):
            from src.adapters.agent_engine_client import AgentEngineClient

            with pytest.raises(RuntimeError, match="google-cloud-aiplatform"):
                AgentEngineClient(resource_name="projects/x/locations/y/reasoningEngines/z")


# ═══════════════════════════════════════════════════════════════════════════
# tools property
# ═══════════════════════════════════════════════════════════════════════════


class TestToolsProperty:
    def test_tools_returns_empty_list(self, patched_client):
        """
        The /v1/tools route reads agent.tools.  Remote agents don't expose
        tool discovery, so AgentEngineClient always returns an empty list.
        """
        client, _ = patched_client
        assert client.tools == []
