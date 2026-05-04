"""
Guardrails — Input/output validation, PII detection, injection defense.

Runs in-process within the orchestration loop. Input guardrails are blocking
(reject bad input before it reaches the LLM). Output guardrails are
configurable via GUARDRAILS_BLOCK_ON_OUTPUT_FAIL.
"""

from __future__ import annotations

import re
import time
import typing

import src.core.config
import src.core.logging
import src.domain.models

# ── Distributed rate limiter (Redis-backed, shared across pods) ───────────
# Falls back to in-memory when Redis is unavailable.

_rate_limits: dict[str, tuple[int, float]] = {}  # fallback in-memory
_redis_client: typing.Any = None  # Set by init_rate_limiter()


def init_rate_limiter(redis_url: str) -> None:
    """Initialize Redis-backed rate limiter. Called at app startup."""
    global _redis_client  # noqa: PLW0603
    if not redis_url:
        return
    try:
        import redis as _redis
        _redis_client = _redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=1.0,
            socket_connect_timeout=2.0,
        )
        _redis_client.ping()
        src.core.logging.logger.info("Rate limiter: Redis-backed (distributed)")
    except Exception as exc:
        src.core.logging.logger.warning(f"Rate limiter: in-memory fallback ({exc})")
        _redis_client = None


def _check_rate_limit(user_id: str) -> src.domain.models.GuardrailViolation | None:
    """
    Distributed sliding window rate limiter.

    Uses Redis INCR + EXPIRE for cross-pod consistency.
    Falls back to per-process dict when Redis is unavailable.
    """
    max_rpm = src.core.config.settings.GUARDRAILS_RATE_LIMIT_RPM

    # ── Redis path (distributed) ──────────────────────────────────
    if _redis_client is not None:
        try:
            key: str = f"rl:{user_id}"
            count = _redis_client.incr(key)
            if count == 1:
                _redis_client.expire(key, 60)
            if count > max_rpm:
                return src.domain.models.GuardrailViolation(
                    rule="rate_limit",
                    message=f"Rate limit exceeded: {max_rpm} requests/min",
                    severity="error",
                )
            return None
        except Exception:
            pass  # Fall through to in-memory

    # ── In-memory fallback (single-pod only) ──────────────────────
    now: float = time.time()
    window_s = 60.0

    entry: tuple[int, float] | None = _rate_limits.get(user_id)
    if entry is None or now - entry[1] > window_s:
        _rate_limits[user_id] = (1, now)
        return None

    count, window_start = entry
    if count >= max_rpm:
        return src.domain.models.GuardrailViolation(
            rule="rate_limit",
            message=f"Rate limit exceeded: {max_rpm} requests/min",
            severity="error",
        )

    _rate_limits[user_id] = (count + 1, window_start)
    return None


# ── PII Detection ────────────────────────────────────────────────────────

_PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    # Credit card: 13-19 digit sequences starting with major issuer prefixes
    ("Credit Card", re.compile(
        r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
        r"[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b"
    )),
    ("Email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("Phone", re.compile(r"\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")),
    # US ITIN (Individual Taxpayer Identification Number)
    ("ITIN", re.compile(r"\b9\d{2}-[7-9]\d-\d{4}\b")),
    # US Passport (9 digits)
    ("Passport", re.compile(r"\b[A-Z]?\d{8,9}\b")),
    # HKI membership number (12-digit)
    ("Membership Number", re.compile(r"\b(?:1\d{11})\b")),
    # US Bank routing number (9 digits)
    ("Bank Account", re.compile(r"\b\d{9}\b(?=\s*(?:routing|account|aba))", re.I)),
    # Date of Birth patterns
    ("Date of Birth", re.compile(
        r"\b(?:DOB|date\s+of\s+birth|born\s+on|birthday)\s*[:\-]?\s*"
        r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b",
        re.I,
    )),
]


def _check_pii(text: str) -> list[src.domain.models.GuardrailViolation]:
    violations: list[src.domain.models.GuardrailViolation] = []
    for name, pattern in _PII_PATTERNS:
        if pattern.search(text):
            violations.append(
                src.domain.models.GuardrailViolation(
                    rule="pii_detection",
                    message=f"Potential {name} detected in input",
                    severity="error",
                )
            )
    return violations


# ── Prompt Injection Detection ────────────────────────────────────────────

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(previous|above|all)\s+instructions", re.I),
    re.compile(r"you\s+are\s+now", re.I),
    re.compile(r"system\s+prompt", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"DAN\s+mode", re.I),
    re.compile(r"pretend\s+you", re.I),
    re.compile(r"act\s+as\s+if", re.I),
    re.compile(r"reveal\s+your\s+(instructions|system)", re.I),
    re.compile(r"disregard\s+(all|any|your)\s+(prior|previous)", re.I),
    re.compile(r"override\s+(safety|content|policy|instructions)", re.I),
    re.compile(r"new\s+instructions?\s*:", re.I),
    re.compile(r"forget\s+(everything|all|your)", re.I),
    re.compile(r"output\s+your\s+(initial|original|full)\s+prompt", re.I),
]


def _check_injection(text: str) -> src.domain.models.GuardrailViolation | None:
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return src.domain.models.GuardrailViolation(
                rule="prompt_injection",
                message="Potential prompt injection detected",
                severity="error",
            )
    return None


# ── Toxicity (basic keyword — swap for Perspective API in production) ─────

_TOXIC_KEYWORDS: set[str] = {"hate", "kill", "violence", "threat", "abuse", "terrorist", "bomb"}


def _check_toxicity(text: str) -> src.domain.models.GuardrailViolation | None:
    lower: str = text.lower()
    for kw in _TOXIC_KEYWORDS:
        if kw in lower:
            return src.domain.models.GuardrailViolation(
                rule="toxicity",
                message="Potentially toxic content detected",
                severity="error",
            )
    return None


# ── Output Quality ────────────────────────────────────────────────────────

def _check_output_quality(
    output: str,
    user_query: str,
) -> list[src.domain.models.GuardrailViolation]:
    violations: list[src.domain.models.GuardrailViolation] = []

    if len(output) < 10:
        violations.append(
            src.domain.models.GuardrailViolation(
                rule="quality",
                message="Output too short",
                severity="warning",
            )
        )

    # Relevance: keyword overlap
    query_words: set[str] = {w.lower() for w in user_query.split() if len(w) > 3}
    output_lower: str = output.lower()
    if query_words:
        matched: int = sum(1 for w in query_words if w in output_lower)
        if matched / len(query_words) < 0.15:
            violations.append(
                src.domain.models.GuardrailViolation(
                    rule="relevance",
                    message="Output may not be relevant",
                    severity="warning",
                )
            )

    # Repetition
    words: list[str] = output.lower().split()
    if words:
        ratio: float = len(set(words)) / len(words)
        if ratio < 0.35:
            violations.append(
                src.domain.models.GuardrailViolation(
                    rule="repetition",
                    message="Excessive repetition",
                    severity="warning",
                )
            )

    return violations


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


def check_input(text: str, user_id: str) -> src.domain.models.GuardrailsReport:
    """
    Run all input guardrails. Returns a report; caller should reject if
    ``report.passed`` is False.
    """
    violations: list[src.domain.models.GuardrailViolation] = []

    # Rate limit
    rl = _check_rate_limit(user_id)
    if rl:
        violations.append(rl)

    # Length
    if len(text) > src.core.config.settings.GUARDRAILS_MAX_INPUT_LENGTH:
        violations.append(
            src.domain.models.GuardrailViolation(
                rule="length",
                message=(
                    "Input exceeds "
                    f"{src.core.config.settings.GUARDRAILS_MAX_INPUT_LENGTH} "
                    "characters"
                ),
                severity="error",
            )
        )
    if len(text.strip()) == 0:
        violations.append(
            src.domain.models.GuardrailViolation(
                rule="length",
                message="Input is empty",
                severity="error",
            )
        )

    # PII
    violations.extend(_check_pii(text))

    # Injection
    inj = _check_injection(text)
    if inj:
        violations.append(inj)

    # Toxicity
    tox = _check_toxicity(text)
    if tox:
        violations.append(tox)

    passed: bool = all(v.severity != "error" for v in violations)
    score: float = max(0.0, 100.0 - len(violations) * 20.0)

    if not passed:
        src.core.logging.logger.warning(
            "Input guardrails failed",
            extra={"user_id": user_id, "violations": [v.message for v in violations]},
        )

    return src.domain.models.GuardrailsReport(
        passed=passed,
        input_violations=violations,
        score=score,
    )


def check_output(output: str, user_query: str) -> src.domain.models.GuardrailsReport:
    """
    Run output guardrails. Behavior controlled by GUARDRAILS_BLOCK_ON_OUTPUT_FAIL.
    """
    violations = _check_output_quality(output, user_query)

    # Also check PII in output (agent should never leak PII)
    pii = _check_pii(output)
    violations.extend(pii)

    has_errors: bool = any(v.severity == "error" for v in violations)
    passed: bool = (
        not has_errors
        if src.core.config.settings.GUARDRAILS_BLOCK_ON_OUTPUT_FAIL
        else True
    )
    score: float = max(0.0, 100.0 - len(violations) * 15.0)

    if violations:
        src.core.logging.logger.warning(
            "Output guardrails flagged",
            extra={"violations": [v.message for v in violations]},
        )

    return src.domain.models.GuardrailsReport(
        passed=passed,
        output_violations=violations,
        score=score,
    )
