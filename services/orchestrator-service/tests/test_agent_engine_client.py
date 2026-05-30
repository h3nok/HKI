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

import time
from typing import Any
from unittest.mock import MagicMock, patch

import hki_runtime
import pytest

# ── Helpers ───────────────────────────────────────────────────────────────


def _make_remote(events: list[dict[str, Any]], final_response: str = "") -> MagicMock:
    """Fake ReasoningEngine SDK object whose .query() returns an events payload."""
    remote = MagicMock()
    remote.query.return_value = {"events": events, "final_response": final_response}
    return remote


def _make_stream_config(**kwargs) -> Any:
    """Build a real StreamConfig Pydantic model (avoids import at module level)."""
    from src.domain.models import StreamConfig

    return StreamConfig(**kwargs)


def _hki_envelope(
    active_domain: str = "pharmacy",
    *,
    subject_id: str = "user-1",
    org_id: str = "default",
) -> hki_runtime.HkiEnvelope:
    now = int(time.time())
    payload = {
        "hki_version": "1.0",
        "envelope_id": f"env-test-{active_domain}",
        "org_id": org_id,
        "subject_id": subject_id,
        "active_domain": active_domain,
        "authorized_domains": [active_domain],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "policy-test",
        "issued_at": now - 1,
        "expires_at": now + 300,
        "issuer": "agentic-bff",
    }
    payload["signature"] = hki_runtime.sign_envelope(payload, "unit-test-hki-secret")
    validation = hki_runtime.validate_envelope(
        payload,
        require_signature=True,
        signing_secret="unit-test-hki-secret",
    )
    assert validation.envelope is not None
    return validation.envelope


def _runtime_kwargs(envelope: hki_runtime.HkiEnvelope | None = None) -> dict[str, Any]:
    env = envelope or _hki_envelope()
    return {
        "user_id": env.subject_id,
        "org_id": env.org_id,
        "scope": env.active_domain,
        "scopes": list(env.authorized_domains),
        "hki_envelope": env,
    }


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
            client.chat_stream(
                session_id="s-1",
                message="What is the answer?",
                **_runtime_kwargs(),
            )
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
                **_runtime_kwargs(),
            )
        )

        _, kwargs = client._remote.query.call_args
        assert kwargs["message"] == "Hello Agent Engine"
        assert kwargs["session_id"] == "sess-42"
        assert kwargs["user_id"] == "user-1"
        assert kwargs["org_id"] == "default"
        assert kwargs["scope"] == "pharmacy"
        assert kwargs["scopes"] == ["pharmacy"]
        assert kwargs["hki_envelope"]["active_domain"] == "pharmacy"
        assert kwargs["stream_config"] is None

    async def test_empty_events_list_yields_nothing(self, patched_client):
        """An empty events list results in zero yielded chunks — no crash."""
        client, _ = patched_client
        client._remote = _make_remote([])

        result = await _collect(
            client.chat_stream(session_id="s-1", message="Hello", **_runtime_kwargs())
        )

        assert result == []

    async def test_missing_hki_envelope_fails_closed(self, patched_client):
        """Remote runtime calls cannot drop the signed HKI envelope."""
        client, _ = patched_client
        client._remote = _make_remote([])

        with pytest.raises(PermissionError, match="HKI envelope is required"):
            await _collect(client.chat_stream(session_id="s-1", message="Hi"))

        client._remote.query.assert_not_called()

    async def test_scope_mismatch_fails_before_remote_call(self, patched_client):
        """Body/runtime scope cannot override the signed envelope."""
        client, _ = patched_client
        client._remote = _make_remote([])

        with pytest.raises(PermissionError, match="active_domain"):
            await _collect(
                client.chat_stream(
                    session_id="s-1",
                    message="Hi",
                    **{
                        **_runtime_kwargs(),
                        "scope": "optical",
                    },
                )
            )

        client._remote.query.assert_not_called()


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
            client.chat_stream(
                session_id="s-1",
                message="Hi",
                stream_config=sc,
                **_runtime_kwargs(),
            )
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
            client.chat_stream(
                session_id="s-1",
                message="Hi",
                stream_config=sc,
                **_runtime_kwargs(),
            )
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
            client.chat_stream(
                session_id="s-1",
                message="Hi",
                stream_config=None,
                **_runtime_kwargs(),
            )
        )

        _, kwargs = client._remote.query.call_args
        assert kwargs["stream_config"] is None

    async def test_enabled_tools_list_is_serialised(self, patched_client):
        """list fields inside StreamConfig survive the Pydantic → dict conversion."""
        client, _ = patched_client
        client._remote = _make_remote([])
        sc = _make_stream_config(enabled_tools=["search_knowledge", "check_inventory"])

        await _collect(
            client.chat_stream(
                session_id="s-1",
                message="Hi",
                stream_config=sc,
                **_runtime_kwargs(),
            )
        )

        _, kwargs = client._remote.query.call_args
        assert kwargs["stream_config"]["enabled_tools"] == [
            "search_knowledge",
            "check_inventory",
        ]

    async def test_response_metadata_gets_provider_evidence(self, patched_client):
        """Provider evidence is attached without changing non-metadata events."""
        client, _ = patched_client
        client._remote = _make_remote(
            [
                {"type": "thinking", "content": "Working"},
                {"type": "response_metadata", "metadata": {"model": "gemini"}},
            ],
            final_response="",
        )

        result = await _collect(
            client.chat_stream(session_id="s-1", message="Hi", **_runtime_kwargs())
        )

        assert result[0] == {"type": "thinking", "content": "Working"}
        provider = result[1]["metadata"]["provider_evidence"]
        assert provider["provider"] == "gemini-agent-platform"
        assert provider["agent_engine_resource"].endswith("/123")


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
