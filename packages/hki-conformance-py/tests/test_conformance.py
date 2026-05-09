"""Conformance pytest suite — all 28 cases against the reference adapter.

Each case becomes an individual parametrized test so failures are reported
at the case level, not as a single bloc.
"""

from __future__ import annotations

import json

import pytest

from hki_conformance import (
    HKI_CONFORMANCE_CASES,
    HkiRuntimeAdapter,
    conformance_level,
    run_conformance,
)
from hki_conformance.fixtures import CONFORMANCE_NOW


@pytest.fixture(scope="session")
def adapter() -> HkiRuntimeAdapter:
    return HkiRuntimeAdapter()


@pytest.fixture(scope="session")
def report(adapter):
    return run_conformance(adapter, now=CONFORMANCE_NOW)


# ---------------------------------------------------------------------------
# Parametrized: one test per conformance case
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "case",
    HKI_CONFORMANCE_CASES,
    ids=[c["id"] for c in HKI_CONFORMANCE_CASES],
)
def test_conformance_case(adapter, case):
    result = case["run"](adapter, CONFORMANCE_NOW)
    assert result["passed"], (
        f"[{result['id']}] FAILED\n"
        f"  requirement : {result['requirement']}\n"
        f"  expected    : {result['expected']}\n"
        f"  actual      : {result['actual']}"
    )


# ---------------------------------------------------------------------------
# Overall report checks
# ---------------------------------------------------------------------------

def test_all_must_cases_pass(report):
    must_failures = [
        r for r in report["results"]
        if r["severity"] == "must" and not r["passed"]
    ]
    assert must_failures == [], (
        f"{len(must_failures)} must-case(s) failed:\n"
        + "\n".join(f"  {r['id']}: {r['actual']}" for r in must_failures)
    )


def test_report_overall_passed(report):
    assert report["passed"], (
        f"Conformance failed: {report['totals']['must_failed']} must-failures"
    )


def test_conformance_level_at_least_3(report):
    level = conformance_level(report)
    assert level >= 3, f"Expected level >= 3, got L{level}"


def test_all_28_cases_run(report):
    assert len(report["results"]) == 28, (
        f"Expected 28 cases, got {len(report['results'])}"
    )


def test_report_is_serialisable(report):
    serialised = json.dumps(report)
    assert len(serialised) > 0


def test_report_schema(report):
    assert report["hki_version"] == "1.0"
    assert "generated_at" in report
    assert report["adapter"]["name"] == "hki-runtime"
    totals = report["totals"]
    assert totals["passed"] + totals["failed"] == 28
