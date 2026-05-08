from __future__ import annotations

import dataclasses
import json
import math
import time
import typing
import urllib.parse
from collections.abc import Mapping

HKI_VERSION = "1.0"
GLOBAL_DOMAIN = "global"
WILDCARD_DOMAIN = "*"

# Hard limits to prevent DoS via oversized inputs.
_MAX_FIELD_LENGTH = 512
_MAX_AUTHORIZED_DOMAINS = 64

HkiPurpose = typing.Literal[
    "chat",
    "retrieve",
    "ingest",
    "review",
    "publish",
    "tool-call",
    "memory",
    "cache",
    "eval",
    "admin",
]

HkiRiskTier = typing.Literal[
    "read-only",
    "write",
    "regulated",
    "destructive",
    "privileged",
]

HkiValidationCode = typing.Literal[
    "missing-field",
    "invalid-version",
    "invalid-domain",
    "unauthorized-domain",
    "expired-envelope",
    "future-envelope",
    "artifact-scope-mismatch",
]

HkiGatewayTargetType = typing.Literal[
    "tool",
    "agent",
    "resource",
    "model",
    "memory",
    "retrieval",
]


@dataclasses.dataclass(frozen=True)
class HkiEnvelope:
    hki_version: str
    envelope_id: str
    org_id: str
    subject_id: str
    active_domain: str
    authorized_domains: tuple[str, ...]
    purpose: HkiPurpose | str
    risk_tier: HkiRiskTier | str
    policy_pack_id: str
    issued_at: float
    expires_at: float
    issuer: str
    signature: str | None = None


@dataclasses.dataclass(frozen=True)
class HkiArtifactLabel:
    org_id: str
    domain: str
    artifact_type: str
    artifact_id: str
    provenance_id: str | None = None


@dataclasses.dataclass(frozen=True)
class HkiValidationIssue:
    code: HkiValidationCode
    field: str
    message: str


@dataclasses.dataclass(frozen=True)
class HkiValidationResult:
    ok: bool
    envelope: HkiEnvelope | None = None
    issues: tuple[HkiValidationIssue, ...] = ()


@dataclasses.dataclass(frozen=True)
class HkiCacheKeyInput:
    envelope: HkiEnvelope
    operation: str
    input: typing.Any
    model_route: str | None = None
    context_version: str | None = None
    extra: dict[str, str | int | float | bool | None] | None = None


@dataclasses.dataclass(frozen=True)
class HkiGatewayTarget:
    type: HkiGatewayTargetType
    id: str
    domain: str
    published_domains: tuple[str, ...] = ()


@dataclasses.dataclass(frozen=True)
class HkiGatewayDecision:
    allowed: bool
    reason: str
    target: HkiGatewayTarget


class HkiSpanLike(typing.Protocol):
    def set_attribute(self, key: str, value: str | int | float | bool) -> object: ...


Record = Mapping[str, typing.Any]

_REQUIRED_STRING_FIELDS = (
    "hki_version",
    "envelope_id",
    "org_id",
    "subject_id",
    "active_domain",
    "purpose",
    "risk_tier",
    "policy_pack_id",
    "issuer",
)


def normalize_domain(value: typing.Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def is_global_domain(value: typing.Any) -> bool:
    normalized = normalize_domain(value)
    return bool(normalized and normalized.lower() == GLOBAL_DOMAIN)


def is_wildcard_domain(value: typing.Any) -> bool:
    return normalize_domain(value) == WILDCARD_DOMAIN


def is_forbidden_runtime_domain(value: typing.Any) -> bool:
    return is_global_domain(value) or is_wildcard_domain(value)


def normalize_domain_list(values: typing.Any) -> list[str]:
    if not isinstance(values, list | tuple):
        return []

    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        domain = normalize_domain(value)
        if domain is None:
            continue
        key = domain.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(domain)
    return result


def same_domain(a: typing.Any, b: typing.Any) -> bool:
    left = normalize_domain(a)
    right = normalize_domain(b)
    return bool(left and right and left.lower() == right.lower())


def validate_envelope(
    envelope: HkiEnvelope | Record,
    *,
    now: float | None = None,
    max_future_skew_seconds: float = 60,
    require_signature: bool = False,
) -> HkiValidationResult:
    current_time = now if now is not None else math.floor(time.time())
    record = _record(envelope)
    issues: list[HkiValidationIssue] = []

    for field in _REQUIRED_STRING_FIELDS:
        val = record.get(field)
        if not normalize_domain(val):
            issues.append(
                HkiValidationIssue(
                    code="missing-field",
                    field=field,
                    message=f"{field} is required.",
                )
            )
        elif isinstance(val, str) and len(val) > _MAX_FIELD_LENGTH:
            issues.append(
                HkiValidationIssue(
                    code="missing-field",
                    field=field,
                    message=f"{field} exceeds maximum length of {_MAX_FIELD_LENGTH} characters.",
                )
            )

    hki_version = normalize_domain(record.get("hki_version"))
    if hki_version and hki_version != HKI_VERSION:
        issues.append(
            HkiValidationIssue(
                code="invalid-version",
                field="hki_version",
                message=f"hki_version must be {HKI_VERSION}.",
            )
        )

    # Signature presence check. NOTE: this library validates structural correctness
    # and claim consistency of the envelope. Cryptographic signature verification
    # (Ed25519/JWS) is the responsibility of the gateway that mints the envelope —
    # it must be performed before calling validate_envelope in downstream services.
    sig = record.get("signature")
    if require_signature and not (isinstance(sig, str) and sig.strip()):
        issues.append(
            HkiValidationIssue(
                code="missing-field",
                field="signature",
                message="signature is required.",
            )
        )

    active_domain = normalize_domain(record.get("active_domain"))
    if not active_domain or is_forbidden_runtime_domain(active_domain):
        issues.append(
            HkiValidationIssue(
                code="invalid-domain",
                field="active_domain",
                message="active_domain must be present, non-global, and non-wildcard.",
            )
        )

    authorized_domains = normalize_domain_list(record.get("authorized_domains"))
    if not authorized_domains:
        issues.append(
            HkiValidationIssue(
                code="missing-field",
                field="authorized_domains",
                message="authorized_domains must contain at least the active domain.",
            )
        )

    if len(authorized_domains) > _MAX_AUTHORIZED_DOMAINS:
        issues.append(
            HkiValidationIssue(
                code="missing-field",
                field="authorized_domains",
                message=f"authorized_domains must not exceed {_MAX_AUTHORIZED_DOMAINS} entries.",
            )
        )

    if any(is_forbidden_runtime_domain(domain) for domain in authorized_domains):
        issues.append(
            HkiValidationIssue(
                code="invalid-domain",
                field="authorized_domains",
                message="authorized_domains must not include global or wildcard domains.",
            )
        )

    if (
        active_domain
        and authorized_domains
        and not any(same_domain(domain, active_domain) for domain in authorized_domains)
    ):
        issues.append(
            HkiValidationIssue(
                code="unauthorized-domain",
                field="active_domain",
                message="active_domain must appear in authorized_domains.",
            )
        )

    issued_at, issued_ok = _coerce_epoch(record.get("issued_at"))
    expires_at, expires_ok = _coerce_epoch(record.get("expires_at"))
    if not issued_ok:
        issues.append(
            HkiValidationIssue(
                code="missing-field",
                field="issued_at",
                message="issued_at must be a numeric epoch timestamp.",
            )
        )
    if not expires_ok:
        issues.append(
            HkiValidationIssue(
                code="missing-field",
                field="expires_at",
                message="expires_at must be a numeric epoch timestamp.",
            )
        )
    if expires_ok and expires_at <= current_time:
        issues.append(
            HkiValidationIssue(
                code="expired-envelope",
                field="expires_at",
                message="envelope is expired.",
            )
        )
    if issued_ok and issued_at > current_time + max_future_skew_seconds:
        issues.append(
            HkiValidationIssue(
                code="future-envelope",
                field="issued_at",
                message="issued_at is too far in the future.",
            )
        )

    if issues:
        return HkiValidationResult(ok=False, issues=tuple(issues))

    return HkiValidationResult(
        ok=True,
        envelope=HkiEnvelope(
            hki_version=str(record.get("hki_version") or HKI_VERSION),
            envelope_id=str(record["envelope_id"]),
            org_id=str(record["org_id"]),
            subject_id=str(record["subject_id"]),
            active_domain=str(active_domain),
            authorized_domains=tuple(authorized_domains),
            purpose=str(record["purpose"]),
            risk_tier=str(record["risk_tier"]),
            policy_pack_id=str(record["policy_pack_id"]),
            issued_at=issued_at,
            expires_at=expires_at,
            issuer=str(record["issuer"]),
            signature=normalize_domain(record.get("signature")),
        ),
    )


def assert_artifact_visible(
    envelope: HkiEnvelope | Record,
    artifact: HkiArtifactLabel | Record,
) -> HkiValidationIssue | None:
    env = _coerce_envelope(envelope)
    label = _coerce_artifact_label(artifact)

    if not normalize_domain(label.domain) or is_forbidden_runtime_domain(label.domain):
        return HkiValidationIssue(
            code="invalid-domain",
            field="domain",
            message="artifact domain must be present, non-global, and non-wildcard.",
        )

    if not same_domain(env.org_id, label.org_id):
        return HkiValidationIssue(
            code="artifact-scope-mismatch",
            field="org_id",
            message="artifact org_id does not match envelope org_id.",
        )

    if not same_domain(env.active_domain, label.domain):
        return HkiValidationIssue(
            code="artifact-scope-mismatch",
            field="domain",
            message="artifact domain does not match envelope active_domain.",
        )

    return None


def derive_hki_cache_key(cache_input: HkiCacheKeyInput | Record) -> str:
    record = _record(cache_input)
    envelope = _coerce_envelope(record["envelope"])
    parts = [
        "hki",
        envelope.hki_version,
        envelope.org_id,
        envelope.active_domain,
        envelope.purpose,
        str(record["operation"]),
        envelope.policy_pack_id,
        record.get("model_route") or "model:any",
        record.get("context_version") or "context:any",
        stable_stringify(record.get("input")),
    ]

    if record.get("extra") is not None:
        parts.append(stable_stringify(record["extra"]))

    return ":".join(_encode_part(str(part)) for part in parts)


def assert_cache_key_bound_to_envelope(key: str, envelope: HkiEnvelope | Record) -> bool:
    env = _coerce_envelope(envelope)
    encoded_org = _encode_part(env.org_id)
    encoded_domain = _encode_part(env.active_domain)
    return f":{encoded_org}:" in key and f":{encoded_domain}:" in key


def evaluate_gateway_target(
    envelope: HkiEnvelope | Record,
    target: HkiGatewayTarget | Record,
) -> HkiGatewayDecision:
    env = _coerce_envelope(envelope)
    gateway_target = _coerce_gateway_target(target)

    if is_forbidden_runtime_domain(gateway_target.domain):
        return HkiGatewayDecision(
            allowed=False,
            reason="target domain is global or wildcard",
            target=gateway_target,
        )

    if any(is_forbidden_runtime_domain(domain) for domain in gateway_target.published_domains):
        return HkiGatewayDecision(
            allowed=False,
            reason="target published_domains include global or wildcard scope",
            target=gateway_target,
        )

    is_direct_domain_match = same_domain(env.active_domain, gateway_target.domain)
    is_published_into_domain = any(
        same_domain(domain, env.active_domain) for domain in gateway_target.published_domains
    )

    if not is_direct_domain_match and not is_published_into_domain:
        return HkiGatewayDecision(
            allowed=False,
            reason="target is not in active domain and is not published into active domain",
            target=gateway_target,
        )

    return HkiGatewayDecision(
        allowed=True,
        reason="target is bound to active domain",
        target=gateway_target,
    )


def reject_conflicting_scope_argument(
    envelope: HkiEnvelope | Record,
    args: Record,
) -> str | None:
    env = _coerce_envelope(envelope)
    candidates = ("scope", "domain", "active_domain", "activeDomain", "stream", "stream_id")

    for key in candidates:
        if key not in args:
            continue
        values = _normalize_scope_argument_values(args.get(key))
        if values is None:
            return f"{key} is ambiguous and cannot override signed HKI active_domain"
        if any(not same_domain(value, env.active_domain) for value in values):
            return f"{key} conflicts with signed HKI active_domain"
    return None


def _normalize_scope_argument_values(value: typing.Any) -> list[str] | None:
    if isinstance(value, str):
        normalized = value.strip()
        return [normalized] if normalized else None

    if value is None:
        return None

    if not isinstance(value, list | tuple):
        return None

    normalized_values: list[str] = []
    for item in value:
        if not isinstance(item, str):
            return None
        normalized = item.strip()
        if not normalized:
            return None
        normalized_values.append(normalized)

    return normalized_values or None


def hki_trace_attributes(envelope: HkiEnvelope | Record) -> dict[str, str | float]:
    env = _coerce_envelope(envelope)
    return {
        "hki.version": env.hki_version,
        "hki.envelope_id": env.envelope_id,
        "hki.org_id": env.org_id,
        "hki.active_domain": env.active_domain,
        "hki.subject_id": env.subject_id,
        "hki.purpose": str(env.purpose),
        "hki.risk_tier": str(env.risk_tier),
        "hki.policy_pack_id": env.policy_pack_id,
        "hki.issuer": env.issuer,
    }


def apply_hki_trace_attributes(span: HkiSpanLike, envelope: HkiEnvelope | Record) -> HkiSpanLike:
    for key, value in hki_trace_attributes(envelope).items():
        span.set_attribute(key, value)
    return span


def stable_stringify(value: typing.Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float) and not isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, list | tuple):
        return "[" + ",".join(stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        entries = [
            json.dumps(str(key), ensure_ascii=False, separators=(",", ":"))
            + ":"
            + stable_stringify(value[key])
            for key in sorted(value.keys(), key=str)
        ]
        return "{" + ",".join(entries) + "}"
    return json.dumps(str(value), ensure_ascii=False, separators=(",", ":"))


def _record(value: typing.Any) -> dict[str, typing.Any]:
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    if isinstance(value, Mapping):
        return dict(value)
    raise TypeError("expected dataclass or mapping")


def _coerce_epoch(value: typing.Any) -> tuple[float, bool]:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0, False
    if not math.isfinite(numeric):
        return 0.0, False
    return numeric, True


def _coerce_envelope(value: HkiEnvelope | Record) -> HkiEnvelope:
    if isinstance(value, HkiEnvelope):
        return value
    record = _record(value)
    issued_at, _ = _coerce_epoch(record.get("issued_at"))
    expires_at, _ = _coerce_epoch(record.get("expires_at"))
    return HkiEnvelope(
        hki_version=str(record.get("hki_version") or HKI_VERSION),
        envelope_id=str(record["envelope_id"]),
        org_id=str(record["org_id"]),
        subject_id=str(record["subject_id"]),
        active_domain=str(record["active_domain"]),
        authorized_domains=tuple(normalize_domain_list(record.get("authorized_domains"))),
        purpose=str(record["purpose"]),
        risk_tier=str(record["risk_tier"]),
        policy_pack_id=str(record["policy_pack_id"]),
        issued_at=issued_at,
        expires_at=expires_at,
        issuer=str(record["issuer"]),
        signature=normalize_domain(record.get("signature")),
    )


def _coerce_artifact_label(value: HkiArtifactLabel | Record) -> HkiArtifactLabel:
    if isinstance(value, HkiArtifactLabel):
        return value
    record = _record(value)
    return HkiArtifactLabel(
        org_id=str(record["org_id"]),
        domain=str(record["domain"]),
        artifact_type=str(record["artifact_type"]),
        artifact_id=str(record["artifact_id"]),
        provenance_id=typing.cast(str | None, record.get("provenance_id")),
    )


def _coerce_gateway_target(value: HkiGatewayTarget | Record) -> HkiGatewayTarget:
    if isinstance(value, HkiGatewayTarget):
        return value
    record = _record(value)
    return HkiGatewayTarget(
        type=typing.cast(HkiGatewayTargetType, str(record["type"])),
        id=str(record["id"]),
        domain=str(record["domain"]),
        published_domains=tuple(normalize_domain_list(record.get("published_domains"))),
    )


def _encode_part(value: str) -> str:
    return urllib.parse.quote(value.strip().lower(), safe="-_.!~*'()")


__all__ = [
    "GLOBAL_DOMAIN",
    "HKI_VERSION",
    "WILDCARD_DOMAIN",
    "HkiArtifactLabel",
    "HkiCacheKeyInput",
    "HkiEnvelope",
    "HkiGatewayDecision",
    "HkiGatewayTarget",
    "HkiPurpose",
    "HkiRiskTier",
    "HkiSpanLike",
    "HkiValidationCode",
    "HkiValidationIssue",
    "HkiValidationResult",
    "apply_hki_trace_attributes",
    "assert_artifact_visible",
    "assert_cache_key_bound_to_envelope",
    "derive_hki_cache_key",
    "evaluate_gateway_target",
    "hki_trace_attributes",
    "is_forbidden_runtime_domain",
    "is_global_domain",
    "is_wildcard_domain",
    "normalize_domain",
    "normalize_domain_list",
    "reject_conflicting_scope_argument",
    "same_domain",
    "stable_stringify",
    "validate_envelope",
]
