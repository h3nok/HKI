"""HKI-T02 — body-parameter scope override (PRE-HKI)."""
from __future__ import annotations


DATA: dict[str, list[str]] = {
    "iris": ["iris-doc-1", "iris-doc-2"],
    "pulse": ["pulse-doc-1"],
}


def search_buggy(envelope: dict, body: dict) -> list[str]:
    # BUG: trusts body["scope"] over the signed envelope.
    domain = body.get("scope") or envelope["active_domain"]
    return DATA.get(domain, [])


def main() -> None:
    envelope: dict[str, str] = {"active_domain": "iris"}
    leaked: list[str] = search_buggy(envelope, {"scope": "pulse"})
    assert leaked == DATA["pulse"], "leak failed to reproduce"
    print(f"LEAK: iris-envelope read pulse data via body override -> {leaked}")


if __name__ == "__main__":
    main()
