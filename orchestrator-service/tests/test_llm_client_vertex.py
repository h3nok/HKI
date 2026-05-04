"""
Tests for LLMClient vertex-direct mode.

When LLM_GATEWAY_URL is empty, LLMClient skips the httpx gateway and calls
litellm.acompletion() directly using Application Default Credentials (ADC).
This is the correct path when running inside Vertex AI Agent Engine.

  LLM_GATEWAY_URL set   → httpx POST to gateway (Apigee / LiteLLM proxy)
  LLM_GATEWAY_URL empty → litellm.acompletion() via ADC

Sections:
  1. Mode detection     — _vertex_direct flag set correctly
  2. httpx pool         — not created in vertex-direct mode (no wasted connections)
  3. Model prefix       — "gemini-x" → "vertex_ai/gemini-x"; already-prefixed unchanged
  4. litellm call       — correct kwargs forwarded; LLMResponse built from response
  5. Tool calls         — tool definitions and tool_choice forwarded; parsed back out
  6. Error handling     — litellm exception → LLMError
  7. Gateway mode       — non-empty URL still uses httpx (no regression)
"""

from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── litellm response builder ──────────────────────────────────────────────


def _make_litellm_response(
    content: str = "Hello",
    tool_calls: list | None = None,
    model: str = "vertex_ai/gemini-2.0-flash",
    prompt_tokens: int = 100,
    completion_tokens: int = 50,
) -> MagicMock:
    """
    Build a fake litellm ModelResponse that matches the shape
    _chat_via_litellm() expects.
    """
    resp = MagicMock()
    resp.model = model

    choice = MagicMock()
    choice.finish_reason = "stop"
    msg = MagicMock()
    msg.content = content
    msg.tool_calls = tool_calls or []
    choice.message = msg
    resp.choices = [choice]

    usage = MagicMock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    usage.total_tokens = prompt_tokens + completion_tokens
    resp.usage = usage

    return resp


def _make_litellm_tool_call(tc_id: str, name: str, arguments: str) -> MagicMock:
    """Fake litellm tool call with function.name / function.arguments."""
    tc = MagicMock()
    tc.id = tc_id
    func = MagicMock()
    func.name = name
    func.arguments = arguments
    tc.function = func
    return tc


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_litellm():
    """Inject a mock litellm module into sys.modules so the lazy import in
    ``_chat_via_litellm`` picks it up.  Cleaned up after each test."""
    mod = ModuleType("litellm")
    mod.acompletion = AsyncMock()  # type: ignore[attr-defined]
    old = sys.modules.get("litellm")
    sys.modules["litellm"] = mod
    yield mod
    if old is None:
        sys.modules.pop("litellm", None)
    else:
        sys.modules["litellm"] = old


@pytest.fixture()
def vertex_client():
    """LLMClient constructed with empty LLM_GATEWAY_URL → vertex-direct mode."""
    with patch.dict("os.environ", {"LLM_GATEWAY_URL": ""}):
        with patch("src.adapters.llm_client.create_service_client", MagicMock()):
            from src.adapters.llm_client import LLMClient

            return LLMClient(base_url="")


@pytest.fixture()
def gateway_client():
    """LLMClient constructed with a real gateway URL → httpx mode."""
    with patch("src.adapters.llm_client.create_service_client", MagicMock()):
        from src.adapters.llm_client import LLMClient

        return LLMClient(base_url="http://gateway:4000/v1", api_key="sk-test")


# ═══════════════════════════════════════════════════════════════════════════
# 1. Mode detection
# ═══════════════════════════════════════════════════════════════════════════


class TestModeDetection:
    def test_vertex_direct_true_when_base_url_empty(self, vertex_client):
        assert vertex_client._vertex_direct is True

    def test_vertex_direct_false_when_base_url_set(self, gateway_client):
        assert gateway_client._vertex_direct is False

    def test_vertex_direct_true_when_settings_gateway_url_empty(self):
        with (
            patch("src.adapters.llm_client.settings") as mock_settings,
            patch("src.adapters.llm_client.create_service_client", MagicMock()),
        ):
            mock_settings.LLM_GATEWAY_URL = ""
            mock_settings.LLM_API_KEY = "key"
            mock_settings.LLM_MODEL_DEFAULT = "gemini-2.0-flash"
            mock_settings.LLM_REQUEST_TIMEOUT = 60.0

            from src.adapters.llm_client import LLMClient

            client = LLMClient()
        assert client._vertex_direct is True


# ═══════════════════════════════════════════════════════════════════════════
# 2. httpx pool not created in vertex-direct mode
# ═══════════════════════════════════════════════════════════════════════════


class TestHttpxPool:
    def test_client_is_none_in_vertex_direct_mode(self, vertex_client):
        """No httpx connection pool is allocated — 200 idle connections not wasted."""
        assert vertex_client._client is None

    def test_client_is_not_none_in_gateway_mode(self, gateway_client):
        """httpx client exists when a gateway URL is provided."""
        assert gateway_client._client is not None

    async def test_close_is_noop_in_vertex_direct_mode(self, vertex_client):
        """close() doesn't crash when _client is None."""
        await vertex_client.close()  # must not raise


# ═══════════════════════════════════════════════════════════════════════════
# 3. Model prefix
# ═══════════════════════════════════════════════════════════════════════════


class TestModelPrefix:
    async def test_bare_model_name_gets_vertex_prefix(self, vertex_client, mock_litellm):
        """'gemini-2.0-flash' → 'vertex_ai/gemini-2.0-flash' before litellm call."""
        mock_litellm.acompletion = AsyncMock(return_value=_make_litellm_response())
        await vertex_client.chat(
            messages=[{"role": "user", "content": "Hi"}],
            model="gemini-2.0-flash",
        )
        _, kwargs = mock_litellm.acompletion.call_args
        assert kwargs["model"] == "vertex_ai/gemini-2.0-flash"

    async def test_already_prefixed_model_unchanged(self, vertex_client, mock_litellm):
        """'vertex_ai/gemini-2.5-pro' is not double-prefixed."""
        mock_litellm.acompletion = AsyncMock(
            return_value=_make_litellm_response(model="vertex_ai/gemini-2.5-pro")
        )
        await vertex_client.chat(
            messages=[{"role": "user", "content": "Hi"}],
            model="vertex_ai/gemini-2.5-pro",
        )
        _, kwargs = mock_litellm.acompletion.call_args
        assert kwargs["model"] == "vertex_ai/gemini-2.5-pro"


# ═══════════════════════════════════════════════════════════════════════════
# 4. litellm call and LLMResponse
# ═══════════════════════════════════════════════════════════════════════════


class TestLitellmCall:
    async def test_returns_llm_response_with_content(self, vertex_client, mock_litellm):
        """chat() returns an LLMResponse with the model's text content."""
        mock_litellm.acompletion = AsyncMock(
            return_value=_make_litellm_response(content="The return policy is 30 days.")
        )
        result = await vertex_client.chat(
            messages=[{"role": "user", "content": "Return policy?"}]
        )
        assert result.content == "The return policy is 30 days."
        assert result.thinking == ""

    async def test_gcp_project_and_location_forwarded(self, vertex_client, mock_litellm):
        """vertex_project and vertex_location are passed to litellm.acompletion."""
        mock_litellm.acompletion = AsyncMock(return_value=_make_litellm_response())

        with patch("src.adapters.llm_client.settings") as mock_settings:
            mock_settings.GCP_PROJECT_ID = "demo-retail-genai-324"
            mock_settings.GCP_LOCATION = "us-central1"
            mock_settings.VERTEX_AI_LOCATION = None
            mock_settings.LLM_TEMPERATURE = 0.3
            mock_settings.LLM_MAX_TOKENS = 4096
            mock_settings.LLM_MODEL_SMART = "gemini-2.5-pro"
            mock_settings.LLM_MODEL_FAST = "gemini-2.0-flash"
            await vertex_client.chat(
                messages=[{"role": "user", "content": "Hi"}]
            )

        _, kwargs = mock_litellm.acompletion.call_args
        assert kwargs["vertex_project"] == "demo-retail-genai-324"
        assert kwargs["vertex_location"] == "us-central1"

    async def test_usage_populated(self, vertex_client, mock_litellm):
        """Token usage from the litellm response is preserved in LLMResponse."""
        mock_litellm.acompletion = AsyncMock(
            return_value=_make_litellm_response(prompt_tokens=200, completion_tokens=80)
        )
        result = await vertex_client.chat(
            messages=[{"role": "user", "content": "Hi"}]
        )
        assert result.usage == {
            "prompt_tokens": 200,
            "completion_tokens": 80,
            "total_tokens": 280,
        }

    async def test_finish_reason_preserved(self, vertex_client, mock_litellm):
        fake_resp = _make_litellm_response()
        fake_resp.choices[0].finish_reason = "stop"
        mock_litellm.acompletion = AsyncMock(return_value=fake_resp)
        result = await vertex_client.chat(
            messages=[{"role": "user", "content": "Hi"}]
        )
        assert result.finish_reason == "stop"


# ═══════════════════════════════════════════════════════════════════════════
# 5. Tool calls
# ═══════════════════════════════════════════════════════════════════════════


class TestToolCalls:
    async def test_tool_definitions_forwarded_to_litellm(self, vertex_client, mock_litellm):
        """tools list is passed through to litellm.acompletion."""
        mock_litellm.acompletion = AsyncMock(return_value=_make_litellm_response())
        tools = [{"type": "function", "function": {"name": "search_knowledge"}}]
        await vertex_client.chat(
            messages=[{"role": "user", "content": "Q"}],
            tools=tools,
        )
        _, kwargs = mock_litellm.acompletion.call_args
        assert kwargs["tools"] == tools
        assert kwargs["tool_choice"] == "auto"

    async def test_tool_calls_parsed_from_response(self, vertex_client, mock_litellm):
        """Tool calls returned by litellm are parsed into ToolCallRequest objects."""
        import json

        tc = _make_litellm_tool_call(
            "call-1", "search_knowledge", json.dumps({"query": "return policy"})
        )
        mock_litellm.acompletion = AsyncMock(
            return_value=_make_litellm_response(tool_calls=[tc])
        )
        result = await vertex_client.chat(
            messages=[{"role": "user", "content": "Q"}],
            tools=[{"type": "function", "function": {"name": "search_knowledge"}}],
        )
        assert result.has_tool_calls
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].name == "search_knowledge"
        assert result.tool_calls[0].arguments == {"query": "return policy"}

    async def test_no_tools_means_no_tool_choice(self, vertex_client, mock_litellm):
        """When tools=None, tool_choice is not forwarded."""
        mock_litellm.acompletion = AsyncMock(return_value=_make_litellm_response())
        await vertex_client.chat(messages=[{"role": "user", "content": "Q"}])
        _, kwargs = mock_litellm.acompletion.call_args
        assert "tools" not in kwargs
        assert "tool_choice" not in kwargs


# ═══════════════════════════════════════════════════════════════════════════
# 6. Error handling
# ═══════════════════════════════════════════════════════════════════════════


class TestErrorHandling:
    async def test_litellm_exception_raises_llm_error(self, vertex_client, mock_litellm):
        """Any exception from litellm.acompletion is wrapped in LLMError."""
        from src.adapters.llm_client import LLMError

        mock_litellm.acompletion = AsyncMock(
            side_effect=Exception("Vertex AI quota exceeded")
        )
        with pytest.raises(LLMError, match="Vertex AI direct call failed"):
            await vertex_client.chat(
                messages=[{"role": "user", "content": "Q"}]
            )


# ═══════════════════════════════════════════════════════════════════════════
# 7. Gateway mode — no regression
# ═══════════════════════════════════════════════════════════════════════════


class TestGatewayModeNoRegression:
    async def test_gateway_mode_uses_httpx_not_litellm(self, gateway_client, mock_litellm):
        """
        When LLM_GATEWAY_URL is set, litellm.acompletion is NOT called.
        The existing httpx POST path is used instead.
        """
        fake_http_resp = MagicMock()
        fake_http_resp.json.return_value = {
            "choices": [
                {
                    "message": {"content": "Gateway response", "tool_calls": None},
                    "finish_reason": "stop",
                }
            ],
            "model": "gemini-2.0-flash",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }
        fake_http_resp.raise_for_status = MagicMock()
        fake_http_resp.is_success = True
        fake_http_resp.status_code = 200

        gateway_client._client = MagicMock()
        gateway_client._client.post = AsyncMock(return_value=fake_http_resp)

        result = await gateway_client.chat(
            messages=[{"role": "user", "content": "Hi"}]
        )
        mock_litellm.acompletion.assert_not_called()
        assert result.content == "Gateway response"
