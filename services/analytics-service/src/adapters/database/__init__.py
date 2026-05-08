"""
Analytics Event Store — abstract interface + factory.

All storage backends implement :class:`EventStoreProtocol` so the domain
layer stays decoupled from any particular database.
"""

from __future__ import annotations

import abc
import logging
import typing

import src.core.logging

if typing.TYPE_CHECKING:
    from src.domain.entities import AgentEvent, UsageSummary, UserActivity

logger: logging.Logger = src.core.logging.logger.getChild("database")


class EventStoreProtocol(abc.ABC):
    """Contract that every event-store backend must satisfy."""

    @abc.abstractmethod
    async def append(self, event: AgentEvent) -> None:
        """Persist a single event."""

    @abc.abstractmethod
    async def query(
        self,
        *,
        limit: int = 50,
        event_type: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
    ) -> list[AgentEvent]:
        """Return the most recent events matching the given filters."""

    @abc.abstractmethod
    async def summarize(
        self,
        *,
        period_start: str = "",
        period_end: str = "",
        org_id: str | None = None,
        stream_id: str | None = None,
    ) -> UsageSummary:
        """Compute aggregated usage metrics over a time window."""

    @abc.abstractmethod
    async def user_activity(self, user_id: str) -> UserActivity:
        """Compute per-user activity summary."""

    @abc.abstractmethod
    async def health_check(self) -> str:
        """Return 'ok' if the backend is reachable, else raise."""

    async def close(self) -> None:
        """Release any resources held by the store (connections, clients)."""
        return None


# ─── Factory ──────────────────────────────────────────────────────────────


def create_event_store(backend: str = "memory", **kwargs) -> EventStoreProtocol:
    """
    Instantiate the correct event-store backend.

    Args:
        backend: One of ``"memory"``, ``"bigquery"``.
        **kwargs: Passed to the backend constructor.

    Returns:
        An :class:`EventStoreProtocol` implementation.
    """
    if backend == "bigquery":
        from src.adapters.database.bigquery_store import BigQueryEventStore

        return BigQueryEventStore(**kwargs)

    # Default — in-memory (dev / tests)
    from src.adapters.database.memory_store import InMemoryEventStore

    return InMemoryEventStore(**kwargs)
