"""HKI-T01 — semantic cache cross-domain leak (POST-HKI).

Same workflow, but the cache key is derived through HKI so cross-domain
requests cannot collide. Run: ``python post_hki.py``.
"""
from __future__ import annotations

import hki_runtime

CACHE: dict[str, str] = {}


def _envelope(domain: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{domain}",
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": domain,
        "authorized_domains": [domain],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "p1",
        "issued_at": 0,
        "expires_at": 99999999999,
        "issuer": "edge",
        "signature": "sig",
    }


def domain_specific_answer(query: str, domain: str) -> str:
    return f"answer for {query!r} under {domain!r}"


def respond_safe(query: str, domain: str) -> str:
    envelope = _envelope(domain)
    key = hki_runtime.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "chat.completion",
            "input": {"query": query},
        }
    )
    if key in CACHE:
        return CACHE[key]
    answer: str = domain_specific_answer(query, domain)
    CACHE[key] = answer
    return answer


def main() -> None:
    iris_answer: str = respond_safe("what is our return policy", domain="iris")
    pulse_answer: str = respond_safe("what is our return policy", domain="pulse")
    print(f"iris  -> {iris_answer}")
    print(f"pulse -> {pulse_answer}")
    assert iris_answer != pulse_answer
    assert "iris" in iris_answer and "pulse" in pulse_answer
    print("BLOCKED: HKI cache key segregated tenants.")


if __name__ == "__main__":
    main()
