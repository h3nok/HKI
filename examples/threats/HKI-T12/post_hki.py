"""HKI-T12 — expired envelope rejected (POST-HKI)."""
from __future__ import annotations

import time

import hki_runtime


def _envelope(expires_at: int) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": "env",
        "org_id": "org",
        "subject_id": "sub",
        "active_domain": "iris",
        "authorized_domains": ["iris"],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "p",
        "issued_at": expires_at - 3600,
        "expires_at": expires_at,
        "issuer": "edge",
        "signature": "sig",
    }


def accept_safe(envelope: dict) -> bool:
    result = hki_runtime.validate_envelope(envelope)
    if not result.ok:
        codes = {i.code for i in result.issues}
        if "expired-envelope" in codes:
            raise ValueError("expired envelope")
        raise ValueError(f"invalid envelope: {sorted(codes)}")
    return True


def main() -> None:
    expired = _envelope(int(time.time()) - 86400)
    try:
        accept_safe(expired)
    except ValueError as err:
        print(f"BLOCKED: {err}")
        return
    raise AssertionError("expired envelope should be rejected")


if __name__ == "__main__":
    main()
