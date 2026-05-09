"""Conformance runner — collects results and produces a HkiConformanceReport."""

from __future__ import annotations

import datetime

from .cases import HKI_CONFORMANCE_CASES, HkiConformanceCase
from .fixtures import CONFORMANCE_NOW
from .types import (
    HkiConformanceAdapter,
    HkiConformanceCaseResult,
    HkiConformanceReport,
)


def run_conformance(
    adapter: HkiConformanceAdapter,
    *,
    cases: list[HkiConformanceCase] | None = None,
    now: int = CONFORMANCE_NOW,
) -> HkiConformanceReport:
    """Run all (or a subset of) conformance cases against the given adapter.

    Returns a :class:`HkiConformanceReport` dict that can be serialised with
    ``json.dumps``.
    """
    active_cases = cases if cases is not None else HKI_CONFORMANCE_CASES
    results: list[HkiConformanceCaseResult] = []

    for case in active_cases:
        result = case["run"](adapter, now)
        results.append(result)

    passed_count = sum(1 for r in results if r["passed"])
    failed_count = len(results) - passed_count
    must_failed = sum(
        1 for r in results if not r["passed"] and r["severity"] == "must"
    )
    should_failed = sum(
        1 for r in results if not r["passed"] and r["severity"] == "should"
    )

    overall_passed = must_failed == 0

    return HkiConformanceReport(
        hki_version="1.0",
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        adapter={
            "name": getattr(adapter, "name", "unknown"),
            "version": getattr(adapter, "version", None),
        },
        passed=overall_passed,
        totals=dict(
            passed=passed_count,
            failed=failed_count,
            must_failed=must_failed,
            should_failed=should_failed,
        ),
        results=results,
    )


def conformance_level(report: HkiConformanceReport) -> int:
    """Compute the highest conformance level fully passed (L0–L4).

    A level is passed only if every ``must`` case at or below that level passes.
    Matches the TypeScript runner's level computation.
    """
    if not report["passed"]:
        return 0

    max_level = 0
    for level in (1, 2, 3, 4):
        level_cases = [r for r in report["results"] if r["level"] == level]
        must_cases = [r for r in level_cases if r["severity"] == "must"]
        if must_cases and all(r["passed"] for r in must_cases):
            max_level = level
        elif must_cases:
            break

    return max_level
