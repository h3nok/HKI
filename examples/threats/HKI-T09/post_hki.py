"""HKI-T09 — admin route reachable from runtime envelope (POST-HKI)."""
from __future__ import annotations

INDEX: dict[str, list[str]] = {"iris": ["doc-1", "doc-2"]}

ADMIN_PURPOSES: set[str] = {"admin"}
ADMIN_RISK_TIERS: set[str] = {"admin", "destructive"}


class AdminDenied(Exception):
    pass


def admin_delete_index_safe(envelope: dict, domain: str) -> str:
    purpose = envelope.get("purpose")
    risk_tier = envelope.get("risk_tier")
    if purpose not in ADMIN_PURPOSES or risk_tier not in ADMIN_RISK_TIERS:
        raise AdminDenied(
            f"runtime envelope (purpose={purpose!r}, risk_tier={risk_tier!r}) cannot reach admin route"
        )
    INDEX.pop(domain, None)
    return f"deleted index for {domain}"


def main() -> None:
    runtime_envelope: dict = {"purpose": "chat", "risk_tier": "read-only"}
    try:
        admin_delete_index_safe(runtime_envelope, "iris")
    except AdminDenied as err:
        print(f"BLOCKED: {err}")
        assert "iris" in INDEX
        return
    raise AssertionError("admin route should have rejected runtime envelope")


if __name__ == "__main__":
    main()
