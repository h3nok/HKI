"""Types for the HKI conformance kit — mirrors packages/hki-conformance/src/types.ts."""

from __future__ import annotations

import typing
from typing import Literal, Protocol, runtime_checkable


# ---------------------------------------------------------------------------
# Adapter protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class HkiConformanceAdapter(Protocol):
    """Interface any HKI implementation must satisfy to run the conformance suite.

    All methods may be sync or async; the runner calls them with ``await``
    via :func:`_run`. Implement as plain methods in a sync adapter — Python's
    ``await`` on a non-coroutine returns the value unchanged.
    """

    name: str
    version: str | None

    def validate_envelope(self, envelope: dict) -> typing.Any:
        """Return an object with ``ok: bool`` and ``issues: list``."""
        ...

    def can_read_artifact(self, envelope: dict, artifact: dict) -> bool:
        """Return True if the artifact is visible under the envelope."""
        ...

    def derive_cache_key(self, cache_input: dict) -> str:
        """Return a non-empty string cache key for the given input."""
        ...

    def evaluate_gateway_target(self, envelope: dict, target: dict) -> typing.Any:
        """Return an object with ``allowed: bool`` and ``reason: str``."""
        ...

    def reject_scope_override(self, envelope: dict, args: dict) -> bool:
        """Return True when args contain a conflicting scope argument."""
        ...


# ---------------------------------------------------------------------------
# Result / report types
# ---------------------------------------------------------------------------

HkiConformanceSeverity = Literal["must", "should"]
HkiConformanceSurface = Literal["runtime-envelope", "artifact-read", "cache", "gateway"]
HkiConformanceLevel = Literal[1, 2, 3, 4]


class HkiConformanceCaseResult(typing.TypedDict):
    id: str
    level: HkiConformanceLevel
    surface: HkiConformanceSurface
    requirement: str
    severity: HkiConformanceSeverity
    passed: bool
    expected: str
    actual: str


class HkiConformanceReportTotals(typing.TypedDict):
    passed: int
    failed: int
    must_failed: int
    should_failed: int


class HkiConformanceReport(typing.TypedDict):
    hki_version: Literal["1.0"]
    generated_at: str
    adapter: dict  # {name, version}
    passed: bool
    totals: HkiConformanceReportTotals
    results: list[HkiConformanceCaseResult]
