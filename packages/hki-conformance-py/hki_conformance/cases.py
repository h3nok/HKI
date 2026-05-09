"""All 28 HKI conformance cases — Python mirror of cases.ts.

Each case is a dict with keys matching HkiConformanceCaseResult plus a
``run(adapter, now)`` callable. The runner calls ``run`` and collects results.
"""

from __future__ import annotations

import typing

from .fixtures import (
    ACTIVE_GATEWAY_TARGET,
    BASE_ENVELOPE,
    CACHE_INPUT,
    CHANGED_OPERATION_CACHE_INPUT,
    CHANGED_POLICY_CACHE_INPUT,
    CONFORMANCE_NOW,
    CROSS_DOMAIN_ARTIFACT,
    CROSS_DOMAIN_CACHE_INPUT,
    CROSS_DOMAIN_GATEWAY_TARGET,
    CROSS_ORG_ARTIFACT,
    EXPIRED_ENVELOPE,
    GLOBAL_ARTIFACT,
    GLOBAL_AUTHORIZED_ENVELOPE,
    GLOBAL_ENVELOPE,
    GLOBAL_GATEWAY_TARGET,
    MISSING_ACTIVE_DOMAIN_ENVELOPE,
    PUBLISHED_GATEWAY_TARGET,
    UNSIGNED_ENVELOPE,
    UNAUTHORIZED_ENVELOPE,
    VISIBLE_ARTIFACT,
    WILDCARD_ARTIFACT,
    WILDCARD_AUTHORIZED_ENVELOPE,
    WILDCARD_ENVELOPE,
    WILDCARD_GATEWAY_TARGET,
    WILDCARD_PUBLISHED_GATEWAY_TARGET,
    WRONG_VERSION_ENVELOPE,
)
from .types import HkiConformanceAdapter, HkiConformanceCaseResult

CaseRunner = typing.Callable[
    ["HkiConformanceAdapter", int], "HkiConformanceCaseResult"
]


class HkiConformanceCase(typing.TypedDict):
    id: str
    level: int
    surface: str
    requirement: str
    severity: str
    expected: str
    run: CaseRunner


# ---------------------------------------------------------------------------
# Case builders
# ---------------------------------------------------------------------------


def _envelope_case(
    *,
    id: str,
    level: int,
    surface: str,
    requirement: str,
    severity: str,
    expected: str,
    envelope: dict,
    expect_ok: bool,
) -> HkiConformanceCase:
    def run(adapter: HkiConformanceAdapter, now: int) -> HkiConformanceCaseResult:
        result = adapter.validate_envelope(envelope)
        ok = getattr(result, "ok", False)
        actual = "accepted" if ok else "rejected"
        return HkiConformanceCaseResult(
            id=id, level=level, surface=surface,
            requirement=requirement, severity=severity,
            passed=(ok == expect_ok), expected=expected, actual=actual,
        )

    return HkiConformanceCase(
        id=id, level=level, surface=surface, requirement=requirement,
        severity=severity, expected=expected, run=run,
    )


def _artifact_case(
    *,
    id: str,
    level: int,
    surface: str,
    requirement: str,
    severity: str,
    expected: str,
    artifact: dict,
    expect_visible: bool,
) -> HkiConformanceCase:
    def run(adapter: HkiConformanceAdapter, now: int) -> HkiConformanceCaseResult:
        visible = adapter.can_read_artifact(BASE_ENVELOPE, artifact)
        actual = "visible" if visible else "blocked"
        return HkiConformanceCaseResult(
            id=id, level=level, surface=surface,
            requirement=requirement, severity=severity,
            passed=(visible == expect_visible), expected=expected, actual=actual,
        )

    return HkiConformanceCase(
        id=id, level=level, surface=surface, requirement=requirement,
        severity=severity, expected=expected, run=run,
    )


def _cache_difference_case(
    *,
    id: str,
    level: int,
    surface: str,
    requirement: str,
    severity: str,
    expected: str,
    candidate_input: dict,
) -> HkiConformanceCase:
    def run(adapter: HkiConformanceAdapter, now: int) -> HkiConformanceCaseResult:
        active_key = adapter.derive_cache_key(CACHE_INPUT)
        candidate_key = adapter.derive_cache_key(candidate_input)
        passed = bool(active_key) and active_key != candidate_key
        actual = "different cache keys" if passed else "same key"
        return HkiConformanceCaseResult(
            id=id, level=level, surface=surface,
            requirement=requirement, severity=severity,
            passed=passed, expected=expected, actual=actual,
        )

    return HkiConformanceCase(
        id=id, level=level, surface=surface, requirement=requirement,
        severity=severity, expected=expected, run=run,
    )


def _gateway_case(
    *,
    id: str,
    level: int,
    surface: str,
    requirement: str,
    severity: str,
    expected: str,
    target: dict,
    expect_allowed: bool,
) -> HkiConformanceCase:
    def run(adapter: HkiConformanceAdapter, now: int) -> HkiConformanceCaseResult:
        decision = adapter.evaluate_gateway_target(BASE_ENVELOPE, target)
        allowed = getattr(decision, "allowed", False)
        actual = "allowed" if allowed else "blocked"
        return HkiConformanceCaseResult(
            id=id, level=level, surface=surface,
            requirement=requirement, severity=severity,
            passed=(allowed == expect_allowed), expected=expected, actual=actual,
        )

    return HkiConformanceCase(
        id=id, level=level, surface=surface, requirement=requirement,
        severity=severity, expected=expected, run=run,
    )


def _scope_override_case(
    *,
    id: str,
    level: int,
    surface: str,
    requirement: str,
    severity: str,
    expected: str,
    args: dict,
    expect_rejected: bool,
) -> HkiConformanceCase:
    def run(adapter: HkiConformanceAdapter, now: int) -> HkiConformanceCaseResult:
        rejected = adapter.reject_scope_override(BASE_ENVELOPE, args)
        actual = "blocked" if rejected else "allowed"
        return HkiConformanceCaseResult(
            id=id, level=level, surface=surface,
            requirement=requirement, severity=severity,
            passed=(rejected == expect_rejected), expected=expected, actual=actual,
        )

    return HkiConformanceCase(
        id=id, level=level, surface=surface, requirement=requirement,
        severity=severity, expected=expected, run=run,
    )


# ---------------------------------------------------------------------------
# The 28 cases
# ---------------------------------------------------------------------------

HKI_CONFORMANCE_CASES: list[HkiConformanceCase] = [
    # ── Envelope ─────────────────────────────────────────────────────────────
    _envelope_case(
        id="HKI-C01-valid-envelope", level=2, surface="runtime-envelope",
        requirement="Accept a signed runtime envelope with one non-global active domain.",
        severity="must", expected="accepted",
        envelope=BASE_ENVELOPE, expect_ok=True,
    ),
    _envelope_case(
        id="HKI-C02-reject-global-envelope", level=2, surface="runtime-envelope",
        requirement="Reject a runtime envelope whose active domain is global.",
        severity="must", expected="rejected",
        envelope=GLOBAL_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C03-reject-unauthorized-envelope", level=2, surface="runtime-envelope",
        requirement="Reject an active domain that is not inside the authorized domain set.",
        severity="must", expected="rejected",
        envelope=UNAUTHORIZED_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C04-reject-missing-active-domain", level=2, surface="runtime-envelope",
        requirement="Reject runtime envelopes with a missing active domain.",
        severity="must", expected="rejected",
        envelope=MISSING_ACTIVE_DOMAIN_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C05-reject-expired-envelope", level=2, surface="runtime-envelope",
        requirement="Reject expired runtime envelopes.",
        severity="must", expected="rejected",
        envelope=EXPIRED_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C06-reject-unsigned-envelope", level=2, surface="runtime-envelope",
        requirement="Reject unsigned envelopes at a runtime boundary that requires signatures.",
        severity="must", expected="rejected",
        envelope=UNSIGNED_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C07-reject-global-authorized-domain", level=2, surface="runtime-envelope",
        requirement="Reject authorized domain sets that include global.",
        severity="must", expected="rejected",
        envelope=GLOBAL_AUTHORIZED_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C08-reject-unsupported-hki-version", level=2, surface="runtime-envelope",
        requirement="Reject envelopes that do not declare the supported HKI version.",
        severity="must", expected="rejected",
        envelope=WRONG_VERSION_ENVELOPE, expect_ok=False,
    ),
    # ── Artifact visibility ───────────────────────────────────────────────────
    _artifact_case(
        id="HKI-C09-allow-active-domain-artifact", level=3, surface="artifact-read",
        requirement="Allow artifact reads only when org and active domain labels match.",
        severity="must", expected="visible",
        artifact=VISIBLE_ARTIFACT, expect_visible=True,
    ),
    _artifact_case(
        id="HKI-C10-reject-cross-domain-artifact", level=3, surface="artifact-read",
        requirement="Reject artifact reads from an authorized but inactive domain.",
        severity="must", expected="blocked",
        artifact=CROSS_DOMAIN_ARTIFACT, expect_visible=False,
    ),
    _artifact_case(
        id="HKI-C11-reject-cross-org-artifact", level=3, surface="artifact-read",
        requirement="Reject artifact reads from another organization.",
        severity="must", expected="blocked",
        artifact=CROSS_ORG_ARTIFACT, expect_visible=False,
    ),
    _artifact_case(
        id="HKI-C12-reject-global-artifact", level=3, surface="artifact-read",
        requirement="Reject runtime artifacts labeled as global.",
        severity="must", expected="blocked",
        artifact=GLOBAL_ARTIFACT, expect_visible=False,
    ),
    # ── Cache keys ────────────────────────────────────────────────────────────
    _cache_difference_case(
        id="HKI-C13-cache-key-binds-active-domain", level=3, surface="cache",
        requirement="Cache keys change when the active domain changes.",
        severity="must", expected="different cache keys",
        candidate_input=CROSS_DOMAIN_CACHE_INPUT,
    ),
    _cache_difference_case(
        id="HKI-C14-cache-key-binds-policy-pack", level=3, surface="cache",
        requirement="Cache keys change when the policy pack changes.",
        severity="must", expected="different cache keys",
        candidate_input=CHANGED_POLICY_CACHE_INPUT,
    ),
    _cache_difference_case(
        id="HKI-C15-cache-key-binds-operation", level=3, surface="cache",
        requirement="Cache keys change when the runtime operation changes.",
        severity="must", expected="different cache keys",
        candidate_input=CHANGED_OPERATION_CACHE_INPUT,
    ),
    # ── Gateway targets ───────────────────────────────────────────────────────
    _gateway_case(
        id="HKI-C16-allow-active-domain-tool", level=3, surface="gateway",
        requirement="Allow tools published into the active domain.",
        severity="must", expected="allowed",
        target=ACTIVE_GATEWAY_TARGET, expect_allowed=True,
    ),
    _gateway_case(
        id="HKI-C17-allow-published-domain-target", level=3, surface="gateway",
        requirement="Allow targets explicitly published into the active domain.",
        severity="must", expected="allowed",
        target=PUBLISHED_GATEWAY_TARGET, expect_allowed=True,
    ),
    _gateway_case(
        id="HKI-C18-reject-cross-domain-tool", level=3, surface="gateway",
        requirement="Reject tools published only into a non-active domain.",
        severity="must", expected="blocked",
        target=CROSS_DOMAIN_GATEWAY_TARGET, expect_allowed=False,
    ),
    _gateway_case(
        id="HKI-C19-reject-global-gateway-target", level=3, surface="gateway",
        requirement="Reject gateway targets labeled as global.",
        severity="must", expected="blocked",
        target=GLOBAL_GATEWAY_TARGET, expect_allowed=False,
    ),
    # ── Scope override ────────────────────────────────────────────────────────
    _scope_override_case(
        id="HKI-C20-reject-scope-override", level=4, surface="gateway",
        requirement="Reject body or query arguments that attempt to override signed scope.",
        severity="must", expected="blocked",
        args={"scope": "fraud"}, expect_rejected=True,
    ),
    _scope_override_case(
        id="HKI-C21-reject-stream-id-override", level=4, surface="gateway",
        requirement="Reject stream_id arguments that attempt to override signed scope.",
        severity="must", expected="blocked",
        args={"stream_id": "fraud"}, expect_rejected=True,
    ),
    _scope_override_case(
        id="HKI-C22-allow-matching-scope-argument", level=4, surface="gateway",
        requirement="Allow explicit scope arguments only when they match signed scope.",
        severity="should", expected="allowed",
        args={"scope": "payments"}, expect_rejected=False,
    ),
    # ── Wildcard ──────────────────────────────────────────────────────────────
    _envelope_case(
        id="HKI-C23-reject-wildcard-envelope", level=2, surface="runtime-envelope",
        requirement="Reject wildcard runtime active domains.",
        severity="must", expected="rejected",
        envelope=WILDCARD_ENVELOPE, expect_ok=False,
    ),
    _envelope_case(
        id="HKI-C24-reject-wildcard-authorized-domain", level=2, surface="runtime-envelope",
        requirement="Reject authorized domain sets that include wildcard scope.",
        severity="must", expected="rejected",
        envelope=WILDCARD_AUTHORIZED_ENVELOPE, expect_ok=False,
    ),
    _artifact_case(
        id="HKI-C25-reject-wildcard-artifact", level=3, surface="artifact-read",
        requirement="Reject runtime artifacts labeled with wildcard scope.",
        severity="must", expected="blocked",
        artifact=WILDCARD_ARTIFACT, expect_visible=False,
    ),
    _gateway_case(
        id="HKI-C26-reject-wildcard-gateway-target", level=3, surface="gateway",
        requirement="Reject gateway targets labeled with wildcard scope.",
        severity="must", expected="blocked",
        target=WILDCARD_GATEWAY_TARGET, expect_allowed=False,
    ),
    _gateway_case(
        id="HKI-C27-reject-wildcard-gateway-publication", level=3, surface="gateway",
        requirement="Reject gateway targets published into wildcard scope.",
        severity="must", expected="blocked",
        target=WILDCARD_PUBLISHED_GATEWAY_TARGET, expect_allowed=False,
    ),
    _scope_override_case(
        id="HKI-C28-reject-array-scope-override", level=4, surface="gateway",
        requirement="Reject array-shaped scope arguments when any value widens signed scope.",
        severity="must", expected="blocked",
        args={"scope": ["payments", "fraud"]}, expect_rejected=True,
    ),
]
