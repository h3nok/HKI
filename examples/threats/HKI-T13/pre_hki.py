"""HKI-T13 — envelope version downgrade (PRE-HKI)."""
from __future__ import annotations


def accept_buggy(envelope: dict) -> bool:
    # BUG: only checks signature, ignores hki_version.
    return bool(envelope.get("signature"))


def main() -> None:
    env: dict[str, str] = {"hki_version": "0.9", "signature": "sig"}
    assert accept_buggy(env)
    print("LEAK: hki_version=0.9 accepted")


if __name__ == "__main__":
    main()
