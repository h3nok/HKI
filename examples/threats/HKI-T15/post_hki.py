"""HKI-T15 — prompt-injected scope override (POST-HKI)."""
from __future__ import annotations

import time

import hki_runtime

DATA: dict[str, str] = {"iris": "iris-public", "pulse": "pulse-secret"}


class ScopeOverrideDenied(Exception):
    pass


def _envelope(active: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{active}",
        "org_id": "org",
        "subject_id": "sub",
        "active_domain": active,
        "authorized_domains": [active],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "p",
        "issued_at": int(time.time()),
        "expires_at": int(time.time()) + 3600,
        "issuer": "edge",
        "signature": "sig",
    }


def search_tool_safe(query: str, domain: str | None, envelope: dict) -> str:
    args: dict[str, str] = {"domain": domain} if domain else {}
    err = hki_runtime.reject_conflicting_scope_argument(envelope, args)
    if err:
        raise ScopeOverrideDenied(err)
    active = envelope["active_domain"]
    return DATA.get(active, "")


def main() -> None:
    env = _envelope("iris")
    try:
        search_tool_safe("anything", domain="pulse", envelope=env)
    except ScopeOverrideDenied as err:
        print(f"BLOCKED: {err}")
        return
    raise AssertionError("scope override should have been rejected")


if __name__ == "__main__":
    main()
