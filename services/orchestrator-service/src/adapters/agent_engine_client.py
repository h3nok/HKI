"""
Agent Engine Client — thin SDK caller that runs INSIDE the Orchestrator Service.

This is the client side of the Agent Engine integration.  It calls a deployed
AgentEngineWrapper (the server side) and re-emits its events as an async
generator so it is a drop-in replacement for AdkAgent.chat_stream().

The Orchestrator Service uses this when AGENT_ENGINE_ENABLED=True:

    # app.py lifespan (simplified):
    if settings.AGENT_ENGINE_ENABLED:
        agent = AgentEngineClient(settings.AGENT_ENGINE_RESOURCE_NAME)
    else:
        agent = AdkAgent(memory_manager=memory_manager, cache=cache)

    app.state.agent = agent   # routes call agent.chat_stream() — same interface

The remote AgentEngineWrapper handles all heavy lifting (LLM calls, memory,
tools, corrective RAG).  The Orchestrator Service becomes a thin auth +
routing layer.

Prerequisites (install with the agent-engine extra):
    pip install 'google-cloud-aiplatform[agent_engines]>=1.112'
"""

from __future__ import annotations

import collections.abc
import dataclasses
import typing

import hki_runtime

import src.core.config
import src.core.logging

logger = src.core.logging.logger.getChild("agent_engine_client")
DEFAULT_RUNTIME_SCOPE = "default"

try:
    import vertexai
    from vertexai.preview import reasoning_engines as _re

    _VERTEXAI_AVAILABLE = True
except ImportError:
    _VERTEXAI_AVAILABLE = False


class AgentEngineClient:
    """
    Drop-in replacement for AdkAgent that delegates to a remote Agent Engine.

    Implements the same chat_stream() interface so routes.py never needs to
    know which compute backend is active.

    Thread-safety: the underlying SDK client is stateless per call; this
    class can be shared across concurrent requests safely.
    """

    def __init__(
        self,
        resource_name: str,
        project: str | None = None,
        location: str | None = None,
    ) -> None:
        if not _VERTEXAI_AVAILABLE:
            raise RuntimeError(
                "google-cloud-aiplatform[agent_engines] is not installed. "
                "Run: pip install 'orchestrator-service[agent-engine]'"
            )

        project = project or src.core.config.settings.GCP_PROJECT_ID
        location = location or src.core.config.settings.GCP_LOCATION

        vertexai.init(project=project, location=location)
        self._remote = _re.ReasoningEngine(resource_name)
        self._resource_name: str = resource_name

        logger.info(
            "AgentEngineClient initialized",
            extra={"resource_name": resource_name, "project": project, "location": location},
        )

    # ── AdkAgent-compatible interface ─────────────────────────────────────

    async def chat_stream(
        self,
        session_id: str,
        message: str,
        scope: str = DEFAULT_RUNTIME_SCOPE,
        stream_config: typing.Any | None = None,
        *,
        user_id: str | None = None,
        org_id: str = "default",
        scopes: list[str] | None = None,
        hki_envelope: hki_runtime.HkiEnvelope | None = None,
    ) -> collections.abc.AsyncIterator[dict[str, typing.Any]]:
        """
        Delegate a chat turn to the remote Agent Engine and yield SSE events.

        Converts the stream_config Pydantic model to a plain dict for JSON
        transport and forwards the signed HKI envelope as the runtime scope
        source. The remote wrapper validates the envelope again before it calls
        AdkAgent.
        """
        if hki_envelope is None:
            raise PermissionError("HKI envelope is required for Agent Engine runtime calls")
        _validate_envelope_arguments(
            hki_envelope=hki_envelope,
            user_id=user_id,
            org_id=org_id,
            scope=scope,
            scopes=scopes,
        )

        sc_dict: dict[str, typing.Any] | None = _to_transport_dict(stream_config)
        envelope_dict: dict[str, typing.Any] = _envelope_to_transport_dict(hki_envelope)
        effective_scopes: list[str] = scopes or list(hki_envelope.authorized_domains)

        logger.info(
            "Delegating chat to Agent Engine",
            extra={
                "session_id": session_id,
                "user_id": user_id,
                "org_id": org_id,
                "scope": scope,
                "resource_name": self._resource_name,
            },
        )

        # Agent Engine's query() collects all events then returns them.
        # We unpack them here and yield one-by-one so the SSE handler
        # streams to the client progressively as normal.
        result: dict[str, typing.Any] = self._remote.query(
            message=message,
            session_id=session_id,
            user_id=user_id,
            org_id=org_id,
            scope=scope,
            scopes=effective_scopes,
            hki_envelope=envelope_dict,
            stream_config=sc_dict,
        )

        provider_evidence: dict[str, typing.Any] = {
            "provider": "gemini-agent-platform",
            "agent_engine_resource": self._resource_name,
            "session_id": session_id,
            **(result.get("provider_evidence") or {}),
        }
        events: list[dict[str, typing.Any]] = result.get("events", [])
        for event in events:
            if event.get("type") == "response_metadata" and isinstance(
                event.get("metadata"), dict
            ):
                metadata = dict(event["metadata"])
                metadata["provider_evidence"] = provider_evidence
                yield {**event, "metadata": metadata}
            else:
                yield event

    # ── Passthrough attributes expected by routes.py ──────────────────────

    @property
    def tools(self) -> list:
        """
        The /v1/tools listing endpoint reads agent.tools.
        Return an empty list — tool discovery isn't available for remote agents.
        """
        return []


def _to_transport_dict(value: typing.Any | None) -> dict[str, typing.Any] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return {key: item for key, item in value.items() if item is not None}
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    raise TypeError("stream_config must be a dict or Pydantic model")


def _envelope_to_transport_dict(envelope: hki_runtime.HkiEnvelope) -> dict[str, typing.Any]:
    if dataclasses.is_dataclass(envelope):
        record = dataclasses.asdict(envelope)
        record["authorized_domains"] = list(record.get("authorized_domains") or [])
        record["issued_at"] = _json_epoch(record.get("issued_at"))
        record["expires_at"] = _json_epoch(record.get("expires_at"))
        return record
    raise TypeError("hki_envelope must be an HkiEnvelope")


def _json_epoch(value: typing.Any) -> typing.Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _validate_envelope_arguments(
    *,
    hki_envelope: hki_runtime.HkiEnvelope,
    user_id: str | None,
    org_id: str,
    scope: str,
    scopes: list[str] | None,
) -> None:
    if user_id is not None and hki_envelope.subject_id != user_id:
        raise PermissionError("HKI envelope subject does not match runtime user_id")
    if org_id and hki_envelope.org_id != org_id:
        raise PermissionError("HKI envelope org does not match runtime org_id")
    if not hki_runtime.same_domain(hki_envelope.active_domain, scope):
        raise PermissionError("HKI envelope active_domain does not match runtime scope")
    if scopes is not None and not _same_domain_set(scopes, hki_envelope.authorized_domains):
        raise PermissionError("HKI envelope authorized_domains do not match runtime scopes")


def _same_domain_set(
    left: list[str] | tuple[str, ...],
    right: list[str] | tuple[str, ...],
) -> bool:
    if len(left) != len(right):
        return False
    unmatched = list(right)
    for candidate in left:
        for idx, expected in enumerate(unmatched):
            if hki_runtime.same_domain(candidate, expected):
                unmatched.pop(idx)
                break
        else:
            return False
    return not unmatched
