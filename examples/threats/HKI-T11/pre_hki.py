"""HKI-T11 — envelope replay (PRE-HKI)."""
from __future__ import annotations


def handle_buggy(envelope: dict) -> str:
    # BUG: no nonce store. Same envelope_id accepted forever.
    return f"served {envelope['envelope_id']}"


def main() -> None:
    env: dict[str, str] = {"envelope_id": "env_abc", "active_domain": "iris"}
    a: str = handle_buggy(env)
    b: str = handle_buggy(env)
    print(f"LEAK: replay accepted twice -> {a!r}, {b!r}")
    assert a == b


if __name__ == "__main__":
    main()
