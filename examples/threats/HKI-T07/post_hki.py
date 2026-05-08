"""HKI-T07 — A2A delegation drops envelope (POST-HKI)."""
from __future__ import annotations

import hki_runtime

DOC_STORE: dict[str, list[str]] = {
    "iris": ["iris-confidential"],
    "pulse": ["pulse-confidential"],
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


class DelegationError(Exception):
    pass


def agent_b_safe(task: str, envelope: dict) -> list[str]:
    result = hki_runtime.validate_envelope(envelope, require_signature=True)
    if not result.ok or result.envelope is None:
        raise DelegationError("delegation envelope failed validation")
    domain = result.envelope.active_domain
    if hki_runtime.is_forbidden_runtime_domain(domain):
        raise DelegationError("delegation envelope had forbidden domain")
    return DOC_STORE.get(domain, [])


def agent_a_delegate_safe(task: str, envelope: dict) -> list[str]:
    return agent_b_safe(task, envelope)


def main() -> None:
    safe: list[str] = agent_a_delegate_safe("find docs", _envelope("iris"))
    print(f"BLOCKED: agent B saw only iris docs -> {safe}")
    assert safe == ["iris-confidential"]

    try:
        agent_b_safe("x", {})  # type: ignore[arg-type]
    except DelegationError as e:
        print(f"BLOCKED: {e}")


if __name__ == "__main__":
    main()
