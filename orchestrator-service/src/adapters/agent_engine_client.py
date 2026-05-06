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
import typing

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
    ) -> collections.abc.AsyncIterator[dict[str, typing.Any]]:
        """
        Delegate a chat turn to the remote Agent Engine and yield SSE events.

        Converts the stream_config Pydantic model to a plain dict for JSON
        transport, then re-emits each event chunk so the SSE route handler
        sees exactly the same shape it would from AdkAgent.
        """
        sc_dict: dict[str, typing.Any] | None = None
        if stream_config is not None:
            # Pydantic v2 → plain dict, exclude unset so Agent Engine receives
            # only what was explicitly configured
            sc_dict = stream_config.model_dump(exclude_none=True)

        logger.info(
            "Delegating chat to Agent Engine",
            extra={
                "session_id": session_id,
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
            scope=scope,
            stream_config=sc_dict,
        )

        events: list[dict[str, typing.Any]] = result.get("events", [])
        for event in events:
            yield event

    # ── Passthrough attributes expected by routes.py ──────────────────────

    @property
    def tools(self) -> list:
        """
        The /v1/tools listing endpoint reads agent.tools.
        Return an empty list — tool discovery isn't available for remote agents.
        """
        return []
