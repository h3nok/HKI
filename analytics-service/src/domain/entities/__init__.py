"""
Analytics Domain Entities — core data models.

These are pure Python data classes with no framework dependencies,
keeping the domain layer independent of FastAPI, Pydantic, or any
persistence adapter.
"""

from __future__ import annotations

import dataclasses
import datetime
import enum
import typing


class EventType(enum.StrEnum):
    """Known analytics event categories."""

    AUTH_REQUEST = "auth.request"
    CHAT_MESSAGE = "chat.message"
    CHAT_RESPONSE = "chat.response"
    TOOL_CALL = "tool.call"
    TOOL_RESULT = "tool.result"
    GUARDRAIL_BLOCK = "guardrail.block"
    KB_SEARCH = "kb.search"
    KB_INGEST = "kb.ingest"
    KB_FEEDBACK = "kb.feedback"
    ERROR = "error"
    CUSTOM = "custom"


@dataclasses.dataclass
class AgentEvent:
    """A single analytics event from any platform service."""

    event_type: str
    user_id: str = ""
    org_id: str = "default"
    service: str = ""
    scope: str = "global"
    payload: dict[str, typing.Any] = dataclasses.field(default_factory=dict)
    timestamp: float = 0.0
    ingested_at: float = 0.0

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.datetime.now(datetime.UTC).timestamp()
        if not self.ingested_at:
            self.ingested_at = datetime.datetime.now(datetime.UTC).timestamp()


@dataclasses.dataclass
class UsageSummary:
    """Aggregated usage metrics over a time window."""

    period_start: str
    period_end: str
    total_events: int = 0
    unique_users: int = 0
    events_by_type: dict[str, int] = dataclasses.field(default_factory=dict)
    events_by_service: dict[str, int] = dataclasses.field(default_factory=dict)
    avg_response_time_ms: float = 0.0
    error_rate: float = 0.0

    # ── Knowledge Layer Metrics ───────────────────────────────────────────
    # CMOS (Context Memory Optimization Score): avg tokens_in_context per
    # search. Lower is better — reflects how efficiently the KB feeds the
    # agent. Improves with better chunking, tagging, and retrieval tuning.
    cmos: float = 0.0

    # Retrieval quality signals
    avg_chunks_per_search: float = 0.0
    avg_top_score: float = 0.0  # avg relevance score of top result

    # Ingest health
    total_ingest_jobs: int = 0
    ingest_success_rate: float = 0.0  # completed / total
    avg_ingest_duration_ms: float = 0.0
    p95_ingest_duration_ms: float = 0.0
    total_chunks_indexed: int = 0

    # Standard RAGAS metrics (when emitted by kb.search payloads)
    ragas_sample_count: int = 0
    ragas_coverage_rate: float = 0.0
    avg_faithfulness: float = 0.0
    avg_answer_relevancy: float = 0.0
    avg_context_precision: float = 0.0
    avg_context_recall: float = 0.0
    avg_answer_correctness: float = 0.0


@dataclasses.dataclass
class UserActivity:
    """Per-user activity summary."""

    user_id: str
    org_id: str = "default"
    total_messages: int = 0
    total_tool_calls: int = 0
    total_kb_searches: int = 0
    last_active: str = ""
    top_scopes: list[str] = dataclasses.field(default_factory=list)
