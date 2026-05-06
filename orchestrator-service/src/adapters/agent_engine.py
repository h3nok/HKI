"""
Agent Engine Adapter — Vertex AI Agent Engine (Reasoning Engine) wrapper.

Deploys the existing AdkAgent to Vertex AI Agent Engine without changing
the core agent logic. Agent Engine is the *hosting layer*; AdkAgent is the
*implementation*.

Architecture:
  - AgentEngineWrapper implements the ReasoningEngine interface:
      set_up(**kwargs)           → called once after deserialization
      query(**kwargs)            → collect all SSE events, return dict
      stream_query(**kwargs)     → async generator, yield chunks live
  - AdkAgent, MemoryManager, TieredCache are initialized lazily on first
    request (Agent Engine serializes the object before deploying, so no
    async connections are opened in __init__ or set_up).

Usage (see scripts/deploy_agent_engine.py for full workflow):
    wrapper = AgentEngineWrapper.from_settings()
    remote = reasoning_engines.ReasoningEngine.create(
        wrapper,
        requirements=[...],
        display_name="orchestrator-adk-agent",
    )
    result = await remote.query(message="Hello", session_id="u-123")
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from src.core.config import settings
from src.core.logging import logger as _root_logger

logger = _root_logger.getChild("agent_engine")
DEFAULT_RUNTIME_SCOPE = "default"


class AgentEngineWrapper:
    """
    Vertex AI Agent Engine wrapper around AdkAgent.

    Only plain Python values are stored in __init__ — Agent Engine pickles
    this object during deployment, so no sockets, async loops, or SDK clients
    can be open at construction time.

    The AdkAgent, MemoryManager, and TieredCache are created lazily on the
    first call to query() or stream_query() via _ensure_initialized().
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:9379/0",
        llm_gateway_url: str = "",  # empty → litellm ADC direct; no Apigee needed on Agent Engine
        agent_model: str = "gemini-2.5-flash",
        knowledge_api_url: str = "http://localhost:9509",
    ) -> None:
        # Serializable config only — no open connections here.
        self._redis_url = redis_url
        self._llm_gateway_url = llm_gateway_url
        self._agent_model = agent_model
        self._knowledge_api_url = knowledge_api_url

        # Runtime state — populated by _ensure_initialized()
        self._agent: Any = None
        self._cache: Any = None
        self._memory_manager: Any = None
        self._initialized: bool = False

    # ── Agent Engine interface ────────────────────────────────────────────

    def set_up(self) -> None:
        """
        Called by Agent Engine after deserialization (deploy time).

        Applies stored config to the settings singleton so the agent picks
        them up at init time. Actual async resource creation (Redis, cache,
        AdkAgent) is deferred to the first query() call.
        """
        settings.REDIS_URL = self._redis_url
        settings.LLM_GATEWAY_URL = self._llm_gateway_url
        settings.AGENT_MODEL = self._agent_model
        settings.KNOWLEDGE_API_URL = self._knowledge_api_url
        logger.info(
            "AgentEngineWrapper.set_up() complete",
            extra={
                "llm_gateway": self._llm_gateway_url,
                "model": self._agent_model,
            },
        )

    async def query(
        self,
        *,
        message: str,
        session_id: str = "default",
        scope: str = DEFAULT_RUNTIME_SCOPE,
        stream_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Handle a single chat turn, collecting all SSE events into a response.

        Returns:
            {
                "final_response": "<assembled text>",
                "events": [<all SSE chunks in order>],
            }

        Agent Engine calls this synchronously in some runtimes, so the method
        detects whether it's already inside a running event loop and adapts.
        """
        return await self._run_query(
            message=message,
            session_id=session_id,
            scope=scope,
            stream_config=stream_config,
        )

    async def stream_query(
        self,
        *,
        message: str,
        session_id: str = "default",
        scope: str = DEFAULT_RUNTIME_SCOPE,
        stream_config: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Streaming version — yields SSE chunks directly from AdkAgent.

        Used when the caller supports server-sent events from Agent Engine.
        """
        await self._ensure_initialized()
        sc = self._build_stream_config(stream_config)
        async for chunk in self._agent.chat_stream(
            session_id=session_id,
            message=message,
            scope=scope,
            stream_config=sc,
        ):
            yield chunk

    # ── Factory ───────────────────────────────────────────────────────────

    @classmethod
    def from_settings(cls) -> AgentEngineWrapper:
        """
        Create a wrapper pre-populated from the current settings singleton.

        LLM_GATEWAY_URL is intentionally NOT forwarded — the wrapper always
        calls Vertex AI directly via ADC when running on Agent Engine.
        Passing an Apigee URL would require VPC routing from Agent Engine
        back out to the gateway, which adds latency and complexity for no gain.
        """
        return cls(
            redis_url=settings.REDIS_URL,
            llm_gateway_url="",  # always use ADC direct on Agent Engine
            agent_model=settings.AGENT_MODEL,
            knowledge_api_url=settings.KNOWLEDGE_API_URL,
        )

    # ── Internal helpers ──────────────────────────────────────────────────

    async def _run_query(
        self,
        *,
        message: str,
        session_id: str,
        scope: str,
        stream_config: dict[str, Any] | None,
    ) -> dict[str, Any]:
        await self._ensure_initialized()
        sc = self._build_stream_config(stream_config)

        events: list[dict[str, Any]] = []
        final_response = ""

        async for chunk in self._agent.chat_stream(
            session_id=session_id,
            message=message,
            scope=scope,
            stream_config=sc,
        ):
            events.append(chunk)
            if chunk.get("type") == "final_response_chunk":
                final_response += chunk.get("content", "")

        logger.info(
            "AgentEngine query complete",
            extra={
                "session_id": session_id,
                "events": len(events),
                "response_len": len(final_response),
            },
        )
        return {"final_response": final_response, "events": events}

    async def _ensure_initialized(self) -> None:
        """Lazily create async resources (Redis, cache, AdkAgent) on first use."""
        if self._initialized:
            return

        from src.adapters.cache import TieredCache
        from src.adapters.redis_memory import create_redis_memory_stores
        from src.domain.agent import AdkAgent
        from src.domain.memory import MemoryManager

        redis_stores = await create_redis_memory_stores(self._redis_url)
        if redis_stores:
            sem, epi, proc, decl = redis_stores
            self._memory_manager = MemoryManager(
                semantic=sem,
                episodic=epi,
                procedural=proc,
                declarative=decl,
            )
            logger.info("AgentEngineWrapper: memory initialized (Redis-backed)")
        else:
            self._memory_manager = MemoryManager()
            logger.info("AgentEngineWrapper: memory initialized (in-process)")

        await self._memory_manager.initialize()

        self._cache = TieredCache(redis_url=self._redis_url)
        await self._cache.connect()

        self._agent = AdkAgent(
            memory_manager=self._memory_manager,
            cache=self._cache,
        )
        self._initialized = True
        logger.info("AgentEngineWrapper: AdkAgent initialized")

    @staticmethod
    def _build_stream_config(raw: dict[str, Any] | None) -> Any:
        """
        Convert a plain dict (from Agent Engine JSON transport) to StreamConfig.
        Returns None if raw is None to match AdkAgent.chat_stream() signature.
        """
        if raw is None:
            return None
        from src.api.routes import StreamConfig

        return StreamConfig(**raw)

    # ── Sync shim (for Agent Engine runtimes that call query() sync) ──────

    def query_sync(
        self,
        *,
        message: str,
        session_id: str = "default",
        scope: str = DEFAULT_RUNTIME_SCOPE,
        stream_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Synchronous wrapper around query() for callers that cannot await.

        Agent Engine may invoke handlers in a sync context in some SDK versions.
        This helper creates an event loop if none is running, or schedules on
        the existing one.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Already inside an async context — use a new thread's loop
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        asyncio.run,
                        self._run_query(
                            message=message,
                            session_id=session_id,
                            scope=scope,
                            stream_config=stream_config,
                        ),
                    )
                    return future.result()
            return loop.run_until_complete(
                self._run_query(
                    message=message,
                    session_id=session_id,
                    scope=scope,
                    stream_config=stream_config,
                )
            )
        except RuntimeError:
            return asyncio.run(
                self._run_query(
                    message=message,
                    session_id=session_id,
                    scope=scope,
                    stream_config=stream_config,
                )
            )
