"""HKI-T09 — admin route reachable from runtime envelope (PRE-HKI)."""
from __future__ import annotations

INDEX: dict[str, list[str]] = {"iris": ["doc-1", "doc-2"]}


def admin_delete_index_buggy(envelope: dict, domain: str) -> str:
    # BUG: no purpose / risk_tier check.
    INDEX.pop(domain, None)
    return f"deleted index for {domain}"


def main() -> None:
    runtime_envelope: dict = {"purpose": "chat", "risk_tier": "read-only"}
    print(admin_delete_index_buggy(runtime_envelope, "iris"))
    assert "iris" not in INDEX
    print("LEAK: chat envelope deleted an index.")


if __name__ == "__main__":
    main()
