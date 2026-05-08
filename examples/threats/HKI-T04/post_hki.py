"""HKI-T04 — async job loses domain on resume (POST-HKI)."""
from __future__ import annotations

import hki_runtime

QUEUE: list[dict] = []
ARTIFACTS: list[dict] = []


def _envelope(domain: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{domain}",
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": domain,
        "authorized_domains": [domain],
        "purpose": "ingest",
        "risk_tier": "write",
        "policy_pack_id": "p1",
        "issued_at": 0,
        "expires_at": 99999999999,
        "issuer": "edge",
        "signature": "sig",
    }


class JobEnvelopeError(Exception):
    pass


def enqueue_safe(payload: dict, envelope: dict) -> None:
    # Bind the envelope to the message body. Workers re-validate it.
    QUEUE.append({"payload": payload, "envelope": envelope})


def worker_safe() -> None:
    while QUEUE:
        msg = QUEUE.pop(0)
        env = msg.get("envelope")
        if env is None:
            raise JobEnvelopeError("job missing HKI envelope")
        result = hki_runtime.validate_envelope(env, require_signature=True)
        if not result.ok or result.envelope is None:
            raise JobEnvelopeError("job envelope failed validation")
        domain = result.envelope.active_domain
        if hki_runtime.is_forbidden_runtime_domain(domain):
            raise JobEnvelopeError("job envelope had forbidden domain")
        ARTIFACTS.append({"domain": domain, "data": msg["payload"]})


def main() -> None:
    enqueue_safe({"text": "iris doc"}, _envelope("iris"))
    worker_safe()
    print(f"BLOCKED: artifact stored under signed domain -> {ARTIFACTS[-1]}")
    assert ARTIFACTS[-1]["domain"] == "iris"

    # And: missing envelope is rejected.
    QUEUE.append({"payload": {"text": "anon"}})
    try:
        worker_safe()
    except JobEnvelopeError as e:
        print(f"BLOCKED: {e}")


if __name__ == "__main__":
    main()
