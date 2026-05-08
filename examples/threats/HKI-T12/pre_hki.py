"""HKI-T12 — expired envelope accepted (PRE-HKI)."""
from __future__ import annotations

import time


def accept_buggy(envelope: dict) -> bool:
    # BUG: no clock comparison.
    return bool(envelope.get("signature"))


def main() -> None:
    env = {
        "envelope_id": "e",
        "expires_at": int(time.time()) - 86400,
        "signature": "sig",
    }
    assert accept_buggy(env)
    print("LEAK: expired envelope accepted")


if __name__ == "__main__":
    main()
