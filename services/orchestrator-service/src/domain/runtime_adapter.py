"""Runtime adapter contract for orchestrator chat backends."""

from __future__ import annotations

import collections.abc
import typing

import hki_runtime

import src.domain.models

DEFAULT_RUNTIME_SCOPE = "default"


class AgentRuntimeAdapter(typing.Protocol):
    """Common interface for local and managed agent runtimes."""

    async def chat_stream(
        self,
        session_id: str,
        message: str,
        scope: str = DEFAULT_RUNTIME_SCOPE,
        stream_config: src.domain.models.StreamConfig | None = None,
        *,
        user_id: str | None = None,
        org_id: str = "default",
        scopes: list[str] | None = None,
        hki_envelope: hki_runtime.HkiEnvelope | None = None,
    ) -> collections.abc.AsyncIterator[dict[str, typing.Any]]:
        """Execute one chat turn and yield SSE-compatible events."""
        ...

    @property
    def tools(self) -> list[typing.Any]:
        """Return tools discoverable by the API layer."""
        ...
