"""HKI-T02 — body-parameter scope override (POST-HKI)."""
from __future__ import annotations

import hki_runtime


DATA: dict[str, list[str]] = {
    "iris": ["iris-doc-1", "iris-doc-2"],
    "pulse": ["pulse-doc-1"],
}


def _envelope(domain: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{domain}",
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": domain,
        "authorized_domains": [domain],
        "purpose": "retrieve",
        "risk_tier": "read-only",
        "policy_pack_id": "p1",
        "issued_at": 0,
        "expires_at": 99999999999,
        "issuer": "edge",
        "signature": "sig",
    }


class ScopeOverrideError(Exception):
    pass


def search_safe(envelope: dict, body: dict) -> list[str]:
    err = hki_runtime.reject_conflicting_scope_argument(envelope, body)
    if err is not None:
        raise ScopeOverrideError(err)
    return DATA.get(envelope["active_domain"], [])


def main() -> None:
    envelope = _envelope("iris")
    try:
        search_safe(envelope, {"scope": "pulse"})
    except ScopeOverrideError as e:
        print(f"BLOCKED: {e}")
        return
    raise AssertionError("post-HKI must block scope override")


if __name__ == "__main__":
    main()
