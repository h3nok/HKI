"""HKI-T05 — vector index shared across tenants without filter (POST-HKI)."""
from __future__ import annotations

import hki_runtime

INDEX: list[dict[str, str]] = [
    {"id": "v1", "domain": "iris", "text": "iris-only secret"},
    {"id": "v2", "domain": "pulse", "text": "pulse-only secret"},
    {"id": "v3", "domain": "iris", "text": "iris-doc"},
]


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


def search_safe(query: str, envelope: dict) -> list[dict]:
    candidates: list[dict[str, str]] = [row for row in INDEX if query in row["text"]]
    out: list[dict] = []
    for row in candidates:
        label = hki_runtime.HkiArtifactLabel(
            org_id="org_acme",
            domain=row["domain"],
            artifact_type="vector",
            artifact_id=row["id"],
        )
        # Defence in depth: every row is verified, not just filtered.
        if hki_runtime.assert_artifact_visible(envelope, label) is None:
            out.append(row)
    return out


def main() -> None:
    safe = search_safe("secret", _envelope("iris"))
    print(f"BLOCKED: iris-envelope sees only -> {safe}")
    assert all(r["domain"] == "iris" for r in safe)
    assert not any("pulse" in r["text"] for r in safe)


if __name__ == "__main__":
    main()
