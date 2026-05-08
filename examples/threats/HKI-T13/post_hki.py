"""HKI-T13 — envelope version pinning (POST-HKI)."""
from __future__ import annotations

import time

import hki_runtime


def _envelope(version: str) -> dict:
    return {
        "hki_version": version,
        "envelope_id": "env",
        "org_id": "org",
        "subject_id": "sub",
        "active_domain": "iris",
        "authorized_domains": ["iris"],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "p",
        "issued_at": int(time.time()),
        "expires_at": int(time.time()) + 3600,
        "issuer": "edge",
        "signature": "sig",
    }


def accept_safe(envelope: dict) -> bool:
    result = hki_runtime.validate_envelope(envelope)
    if not result.ok:
        codes = {i.code for i in result.issues}
        if "invalid-version" in codes:
            raise ValueError(f"version downgrade: {envelope.get('hki_version')!r}")
        raise ValueError(f"invalid envelope: {sorted(codes)}")
    return True


def main() -> None:
    try:
        accept_safe(_envelope("0.9"))
    except ValueError as err:
        print(f"BLOCKED: {err}")
        return
    raise AssertionError("downgrade should have been rejected")


if __name__ == "__main__":
    main()
