"""HKI-T11 — envelope replay block (POST-HKI)."""
from __future__ import annotations


SEEN: set[str] = set()


class EnvelopeReplay(Exception):
    pass


def handle_safe(envelope: dict) -> str:
    eid = envelope.get("envelope_id")
    if not eid:
        raise EnvelopeReplay("envelope_id missing")
    if eid in SEEN:
        raise EnvelopeReplay(f"envelope_id {eid!r} already consumed")
    SEEN.add(eid)
    return f"served {eid}"


def main() -> None:
    env: dict[str, str] = {"envelope_id": "env_abc", "active_domain": "iris"}
    handle_safe(env)
    try:
        handle_safe(env)
    except EnvelopeReplay as err:
        print(f"BLOCKED: {err}")
        return
    raise AssertionError("replay should have been rejected")


if __name__ == "__main__":
    main()
