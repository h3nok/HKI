"""hki_runtime.client — high-level helpers mirroring @hki/sdk/client.

Four entry points:

- ``mint_envelope``          — build a complete envelope from minimal options
- ``verify_envelope``        — parse + validate, raise on failure
- ``envelope_headers``       — return {x-hki-envelope: ...} for HTTP calls
- ``with_domain``            — scope a callable to one active domain
"""

from __future__ import annotations

import time
import typing
import uuid

import hki_runtime

HKI_ENVELOPE_HEADER = "x-hki-envelope"


def mint_envelope(
    *,
    org_id: str,
    subject_id: str,
    active_domain: str,
    purpose: hki_runtime.HkiPurpose,
    risk_tier: hki_runtime.HkiRiskTier,
    policy_pack_id: str,
    issuer: str,
    signature: str | None = None,
    authorized_domains: list[str] | None = None,
    ttl: int = 300,
    issued_at: int | None = None,
    envelope_id: str | None = None,
) -> hki_runtime.HkiEnvelope:
    """Build and validate an :class:`HkiEnvelope` from minimal options.

    Raises :class:`ValueError` if the resulting envelope is structurally invalid.
    Gateways must attach a real cryptographic signature before handing the
    envelope to downstream services.
    """
    now = issued_at if issued_at is not None else int(time.time())
    raw: dict = {
        "hki_version": hki_runtime.HKI_VERSION,
        "envelope_id": envelope_id or str(uuid.uuid4()),
        "org_id": org_id,
        "subject_id": subject_id,
        "active_domain": active_domain,
        "authorized_domains": authorized_domains or [active_domain],
        "purpose": purpose,
        "risk_tier": risk_tier,
        "policy_pack_id": policy_pack_id,
        "issued_at": now,
        "expires_at": now + ttl,
        "issuer": issuer,
        "signature": signature,
    }
    result = hki_runtime.validate_envelope(raw, now=now)
    if not result.ok:
        msgs = "; ".join(i.message for i in result.issues)
        raise ValueError(f"mint_envelope: invalid options — {msgs}")
    return result.envelope


def verify_envelope(
    raw: dict,
    *,
    require_signature: bool = True,
    now: float | None = None,
) -> hki_runtime.HkiEnvelope:
    """Parse and validate a raw dict as an :class:`HkiEnvelope`. Raises on failure.

    Use at service entry points where you want to fail fast rather than
    inspect the result object.
    """
    result = hki_runtime.validate_envelope(
        raw,
        require_signature=require_signature,
        now=now,
    )
    if not result.ok:
        msgs = "; ".join(i.message for i in result.issues)
        raise ValueError(f"verify_envelope: {msgs}")
    return result.envelope


def envelope_headers(envelope: hki_runtime.HkiEnvelope) -> dict[str, str]:
    """Return a headers dict carrying the serialized HKI envelope.

    Compatible with ``httpx``, ``requests``, ``aiohttp``, and any other
    library that accepts a ``dict[str, str]`` for headers.

    Example::

        import httpx
        r = httpx.get(url, headers=envelope_headers(envelope))
    """
    import json
    import dataclasses

    payload = dataclasses.asdict(envelope)
    payload = {k: v for k, v in payload.items() if v is not None}
    return {HKI_ENVELOPE_HEADER: json.dumps(payload)}


_F = typing.TypeVar("_F", bound=typing.Callable[..., typing.Any])


def with_domain(domain: str) -> typing.Callable[[_F], _F]:
    """Decorator that restricts a function to one active domain.

    The decorated function must accept an :class:`HkiEnvelope` as its first
    argument. Calls where ``envelope.active_domain`` does not match ``domain``
    raise :class:`PermissionError` before the function body runs.

    Example::

        @with_domain("payments")
        def process_refund(envelope: HkiEnvelope, order_id: str) -> str:
            ...
    """
    if not domain or domain.lower() in ("global", "*"):
        raise ValueError(
            f"with_domain: domain must be non-global and non-wildcard, got {domain!r}"
        )

    def decorator(fn: _F) -> _F:
        import functools

        @functools.wraps(fn)
        def wrapper(envelope: hki_runtime.HkiEnvelope, *args: typing.Any, **kwargs: typing.Any) -> typing.Any:
            if envelope.active_domain.lower() != domain.lower():
                raise PermissionError(
                    f"with_domain: envelope active_domain {envelope.active_domain!r} "
                    f"does not match required domain {domain!r}"
                )
            return fn(envelope, *args, **kwargs)

        return typing.cast(_F, wrapper)

    return decorator


__all__ = [
    "HKI_ENVELOPE_HEADER",
    "envelope_headers",
    "mint_envelope",
    "verify_envelope",
    "with_domain",
]
