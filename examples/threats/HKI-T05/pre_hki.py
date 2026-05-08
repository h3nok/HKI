"""HKI-T05 — vector index shared across tenants without filter (PRE-HKI)."""
from __future__ import annotations

# All tenants share one index. Each row carries a domain label, but the
# query path forgets to filter on it.
INDEX: list[dict[str, str]] = [
    {"id": "v1", "domain": "iris", "text": "iris-only secret"},
    {"id": "v2", "domain": "pulse", "text": "pulse-only secret"},
    {"id": "v3", "domain": "iris", "text": "iris-doc"},
]


def search_buggy(query: str, domain: str) -> list[dict]:
    # BUG: filter is silently dropped.
    return [row for row in INDEX if query in row["text"]]


def main() -> None:
    leaked = search_buggy("secret", domain="iris")
    print(f"LEAK: iris query returned -> {leaked}")
    assert any(r["domain"] == "pulse" for r in leaked)


if __name__ == "__main__":
    main()
