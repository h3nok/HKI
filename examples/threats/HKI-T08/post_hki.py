"""HKI-T08 — embedding cache key omits domain (POST-HKI)."""
from __future__ import annotations

import hki_runtime

CACHE: dict[str, list[float]] = {}


def _envelope(domain: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{domain}",
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": domain,
        "authorized_domains": [domain],
        "purpose": "cache",
        "risk_tier": "read-only",
        "policy_pack_id": "p1",
        "issued_at": 0,
        "expires_at": 99999999999,
        "issuer": "edge",
        "signature": "sig",
    }


def embed_safe(text: str, model: str, envelope: dict) -> list[float]:
    key = hki_runtime.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "embedding.compute",
            "input": {"text": text},
            "model_route": model,
        }
    )
    if key in CACHE:
        return CACHE[key]
    vec: list[float] = [float(len(text)), float(sum(ord(c) for c in envelope["active_domain"]))]
    CACHE[key] = vec
    return vec


def main() -> None:
    iris_vec: list[float] = embed_safe("hello", "ada-002", _envelope("iris"))
    pulse_vec: list[float] = embed_safe("hello", "ada-002", _envelope("pulse"))
    print(f"iris  -> {iris_vec}")
    print(f"pulse -> {pulse_vec}")
    assert iris_vec != pulse_vec
    print("BLOCKED: HKI cache key segregated embedding cache by domain.")


if __name__ == "__main__":
    main()
