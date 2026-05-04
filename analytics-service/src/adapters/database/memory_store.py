"""
In-memory event store — development / test fallback.

Wraps the existing domain ``EventStore`` behind the
:class:`~src.adapters.database.EventStoreProtocol` interface so it can
be used interchangeably with persistent backends.
"""

from __future__ import annotations

import src.adapters.database
import src.domain.entities
import src.domain.use_cases


class InMemoryEventStore(src.adapters.database.EventStoreProtocol):
    """Thin adapter over the domain-layer in-memory EventStore."""

    def __init__(self, *, max_buffer: int = 10_000) -> None:
        self._store = src.domain.use_cases.EventStore(max_buffer=max_buffer)

    async def append(self, event: src.domain.entities.AgentEvent) -> None:
        self._store.append(event)

    async def query(
        self,
        *,
        limit: int = 50,
        event_type: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
    ) -> list[src.domain.entities.AgentEvent]:
        return self._store.query(
            limit=limit,
            event_type=event_type,
            user_id=user_id,
            org_id=org_id,
        )

    async def summarize(
        self,
        *,
        period_start: str = "",
        period_end: str = "",
        org_id: str | None = None,
        stream_id: str | None = None,
    ) -> src.domain.entities.UsageSummary:
        return self._store.summarize(
            period_start=period_start,
            period_end=period_end,
            org_id=org_id,
            stream_id=stream_id,
        )

    async def user_activity(self, user_id: str) -> src.domain.entities.UserActivity:
        return self._store.user_activity(user_id)

    async def health_check(self) -> str:
        return "ok"
