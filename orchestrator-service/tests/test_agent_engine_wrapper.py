"""
Tests for AgentEngineWrapper — the object deployed TO Vertex AI Agent Engine.

This is the server side of the Agent Engine integration.  It runs inside
Google's managed infrastructure and wraps AdkAgent.

What is tested:
  - set_up() pushes stored config into the settings singleton
  - query() collects all SSE events from AdkAgent and returns a dict
  - stream_query() yields events live (same order as AdkAgent)
  - _ensure_initialized() lazily creates Redis / cache / AdkAgent on first call
  - _ensure_initialized() is idempotent (only initialises once)
  - _build_stream_config() converts dict → StreamConfig / passes None through
  - from_settings() factory always uses empty llm_gateway_url (ADC direct)

All I/O is mocked — no Redis, no real AdkAgent LLM calls.
"""

from __future__ import annotations

import unittest.mock

import pytest

import src.adapters.agent_engine

# ── Async generator helper ────────────────────────────────────────────────


async def _agen(*items):
    """Return an async generator that yields the given items."""
    for item in items:
        yield item


async def _collect(gen) -> list:
    return [x async for x in gen]


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture()
def wrapper() -> src.adapters.agent_engine.AgentEngineWrapper:
    """A fresh AgentEngineWrapper with test config (no real connections)."""
    from src.adapters.agent_engine import AgentEngineWrapper

    return src.adapters.agent_engine.AgentEngineWrapper(
        redis_url="redis://localhost:9379/0",
        llm_gateway_url="",
        knowledge_api_url="http://localhost:9509",
    )


@pytest.fixture()
def initialised_wrapper(wrapper):
    """
    A wrapper with _agent already set to a controllable mock.

    Bypasses _ensure_initialized() so tests control exactly what the agent returns.
    """
    mock_agent = unittest.mock.MagicMock()
    wrapper._agent = mock_agent
    wrapper._initialized = True
    return wrapper, mock_agent


# ═══════════════════════════════════════════════════════════════════════════
# set_up()
# ═══════════════════════════════════════════════════════════════════════════


class TestSetUp:
    def test_applies_redis_url_to_settings(self, wrapper) -> None:
        """set_up() writes stored config into the settings singleton."""
        from src.core.config import settings

        wrapper.set_up()
        assert settings.REDIS_URL == "redis://localhost:9379/0"

    def test_applies_empty_llm_gateway_url(self, wrapper) -> None:
        """set_up() sets LLM_GATEWAY_URL to '' — activates vertex-direct mode."""
        from src.core.config import settings

        wrapper.set_up()
        assert settings.LLM_GATEWAY_URL == ""

    def test_applies_agent_model(self, wrapper) -> None:
        from src.core.config import settings

        wrapper.set_up()
        assert settings.AGENT_MODEL == "gemini-2.5-flash"

    def test_applies_knowledge_api_url(self, wrapper) -> None:
        from src.core.config import settings

        wrapper.set_up()
        assert settings.KNOWLEDGE_API_URL == "http://localhost:9509"

    def test_custom_model_is_applied(self) -> None:
        """Non-default model is written to settings by set_up()."""
        from src.adapters.agent_engine import AgentEngineWrapper
        from src.core.config import settings

        w = src.adapters.agent_engine.AgentEngineWrapper(agent_model="gemini-2.5-pro")
        w.set_up()
        assert settings.AGENT_MODEL == "gemini-2.5-pro"


# ═══════════════════════════════════════════════════════════════════════════
# query()
# ═══════════════════════════════════════════════════════════════════════════


class TestQuery:
    async def test_returns_events_and_final_response(self, initialised_wrapper) -> None:
        """query() collects all events into a dict with events + final_response."""
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(
            return_value=_agen(
                {"type": "thinking", "content": "Processing"},
                {"type": "final_response_chunk", "content": "Hello "},
                {"type": "final_response_chunk", "content": "world!"},
            )
        )

        result = await wrapper.query(message="Hi", session_id="s-1")

        assert result["final_response"] == "Hello world!"
        assert len(result["events"]) == 3

    async def test_final_response_assembled_from_chunks(self, initialised_wrapper) -> None:
        """final_response concatenates all final_response_chunk content values."""
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(
            return_value=_agen(
                {"type": "final_response_chunk", "content": "The "},
                {"type": "final_response_chunk", "content": "policy "},
                {"type": "final_response_chunk", "content": "is 30 days."},
            )
        )

        result = await wrapper.query(message="Return policy?", session_id="s-1")

        assert result["final_response"] == "The policy is 30 days."

    async def test_non_chunk_events_excluded_from_final_response(self, initialised_wrapper) -> None:
        """thinking / tool_call events don't pollute final_response."""
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(
            return_value=_agen(
                {"type": "thinking", "content": "Reasoning..."},
                {"type": "tool_call", "content": "Calling search"},
                {"type": "final_response_chunk", "content": "Answer."},
            )
        )

        result = await wrapper.query(message="Q", session_id="s-1")

        assert result["final_response"] == "Answer."

    async def test_all_events_present_in_events_list(self, initialised_wrapper) -> None:
        """Every event yielded by AdkAgent — including thinking — is in result['events']."""
        wrapper, mock_agent = initialised_wrapper
        events: list[dict[str, str]] = [
            {"type": "thinking", "content": "A"},
            {"type": "tool_call", "content": "B"},
            {"type": "tool_result", "content": "C"},
            {"type": "final_response_chunk", "content": "D"},
        ]
        mock_agent.chat_stream = unittest.mock.MagicMock(return_value=_agen(*events))

        result = await wrapper.query(message="Q", session_id="s-1")

        assert result["events"] == events

    async def test_empty_agent_response(self, initialised_wrapper) -> None:
        """No events → empty list and empty final_response — no crash."""
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(return_value=_agen())

        result = await wrapper.query(message="Q", session_id="s-1")

        assert result == {"final_response": "", "events": []}

    async def test_session_id_and_scope_forwarded_to_agent(self, initialised_wrapper) -> None:
        """session_id and scope are passed through to AdkAgent.chat_stream()."""
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(return_value=_agen())

        await wrapper.query(message="Q", session_id="user-99", scope="pharmacy")

        mock_agent.chat_stream.assert_called_once_with(
            session_id="user-99",
            message="Q",
            scope="pharmacy",
            stream_config=None,
        )


# ═══════════════════════════════════════════════════════════════════════════
# stream_query()
# ═══════════════════════════════════════════════════════════════════════════


class TestStreamQuery:
    async def test_yields_events_live(self, initialised_wrapper) -> None:
        """stream_query() yields chunks directly without collecting first."""
        wrapper, mock_agent = initialised_wrapper
        events: list[dict[str, str]] = [
            {"type": "thinking", "content": "Working"},
            {"type": "final_response_chunk", "content": "Done."},
        ]
        mock_agent.chat_stream = unittest.mock.MagicMock(return_value=_agen(*events))

        result = await _collect(wrapper.stream_query(message="Q", session_id="s-1"))

        assert result == events

    async def test_stream_query_forwards_scope(self, initialised_wrapper) -> None:
        wrapper, mock_agent = initialised_wrapper
        mock_agent.chat_stream = unittest.mock.MagicMock(return_value=_agen())

        await _collect(wrapper.stream_query(message="Q", session_id="s-1", scope="optical"))

        _, kwargs = mock_agent.chat_stream.call_args
        assert kwargs["scope"] == "optical"


# ═══════════════════════════════════════════════════════════════════════════
# Lazy initialisation
# ═══════════════════════════════════════════════════════════════════════════


class TestLazyInit:
    async def test_ensure_initialized_creates_agent(self, wrapper) -> None:
        """_ensure_initialized() creates AdkAgent on first call.

        _ensure_initialized() uses lazy 'from X import Y' inside the function,
        so the patch targets must be the source modules, not agent_engine.*.
        """
        mock_agent = unittest.mock.MagicMock()
        mock_memory = unittest.mock.AsyncMock()
        mock_cache = unittest.mock.AsyncMock()

        with (
            unittest.mock.patch(
                "src.adapters.redis_memory.create_redis_memory_stores",
                unittest.mock.AsyncMock(return_value=None),
            ),
            unittest.mock.patch("src.domain.memory.MemoryManager", return_value=mock_memory),
            unittest.mock.patch("src.adapters.cache.TieredCache", return_value=mock_cache),
            unittest.mock.patch("src.domain.agent.AdkAgent", return_value=mock_agent),
        ):
            await wrapper._ensure_initialized()

        assert wrapper._initialized is True
        assert wrapper._agent is mock_agent

    async def test_ensure_initialized_is_idempotent(self, wrapper) -> None:
        """_ensure_initialized() skips re-initialisation when already done.

        Set _initialized=True before calling to simulate an already-initialised
        wrapper, then verify the Redis store is never touched.
        """
        wrapper._initialized = True
        wrapper._agent = unittest.mock.MagicMock()

        with unittest.mock.patch(
            "src.adapters.redis_memory.create_redis_memory_stores",
            unittest.mock.AsyncMock(),
        ) as mock_redis:
            await wrapper._ensure_initialized()
            mock_redis.assert_not_called()

        # agent must remain the one we injected — not replaced
        assert isinstance(wrapper._agent, unittest.mock.MagicMock)


# ═══════════════════════════════════════════════════════════════════════════
# _build_stream_config()
# ═══════════════════════════════════════════════════════════════════════════


class TestBuildStreamConfig:
    def test_none_returns_none(self) -> None:
        from src.adapters.agent_engine import AgentEngineWrapper

        assert src.adapters.agent_engine.AgentEngineWrapper._build_stream_config(None) is None

    def test_dict_converted_to_stream_config(self) -> None:
        from src.adapters.agent_engine import AgentEngineWrapper
        from src.api.routes import StreamConfig

        result = src.adapters.agent_engine.AgentEngineWrapper._build_stream_config(
            {"system_prompt": "Be brief.", "retrieval_strategy": "hybrid"}
        )

        assert isinstance(result, StreamConfig)
        assert result.system_prompt == "Be brief."
        assert result.retrieval_strategy == "hybrid"

    def test_empty_dict_gives_default_stream_config(self) -> None:
        """An empty dict produces a StreamConfig with all-None fields."""
        from src.adapters.agent_engine import AgentEngineWrapper
        from src.api.routes import StreamConfig

        result = src.adapters.agent_engine.AgentEngineWrapper._build_stream_config({})

        assert isinstance(result, StreamConfig)
        assert result.system_prompt is None
        assert result.enabled_tools is None


# ═══════════════════════════════════════════════════════════════════════════
# from_settings() factory
# ═══════════════════════════════════════════════════════════════════════════


class TestFromSettings:
    def test_llm_gateway_url_always_empty(self) -> None:
        """
        from_settings() never forwards LLM_GATEWAY_URL to the wrapper.
        Agent Engine uses ADC directly — routing through Apigee from Agent
        Engine is unnecessary and adds latency.
        """
        from src.adapters.agent_engine import AgentEngineWrapper

        with unittest.mock.patch("src.adapters.agent_engine.settings") as mock_settings:
            mock_settings.REDIS_URL = "redis://prod:6379/0"
            mock_settings.LLM_GATEWAY_URL = "https://aigateway.example.com/v1"
            mock_settings.AGENT_MODEL = "gemini-2.5-pro"
            mock_settings.KNOWLEDGE_API_URL = "http://knowledge-api:9509"

            w: src.adapters.agent_engine.AgentEngineWrapper = src.adapters.agent_engine.AgentEngineWrapper.from_settings()

        assert w._llm_gateway_url == ""

    def test_redis_and_model_forwarded(self) -> None:
        from src.adapters.agent_engine import AgentEngineWrapper

        with unittest.mock.patch("src.adapters.agent_engine.settings") as mock_settings:
            mock_settings.REDIS_URL = "redis://prod:6379/0"
            mock_settings.LLM_GATEWAY_URL = "https://apigee.example.com/v1"
            mock_settings.AGENT_MODEL = "gemini-2.5-pro"
            mock_settings.KNOWLEDGE_API_URL = "http://knowledge:9509"

            w: src.adapters.agent_engine.AgentEngineWrapper = src.adapters.agent_engine.AgentEngineWrapper.from_settings()

        assert w._redis_url == "redis://prod:6379/0"
        assert w._agent_model == "gemini-2.5-pro"
        assert w._knowledge_api_url == "http://knowledge:9509"
