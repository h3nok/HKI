"""HKI-T14 — graph traversal crosses domain edges (PRE-HKI)."""
from __future__ import annotations

NODES: dict[str, dict] = {
    "n1": {"domain": "iris", "content": "iris home"},
    "n2": {"domain": "pulse", "content": "pulse secret"},
}
EDGES: list[tuple[str, str]] = [("n1", "n2")]


def neighbors_buggy(start: str, domain: str) -> list[dict]:
    # BUG: filters root, but follows edges without re-checking domain.
    if NODES[start]["domain"] != domain:
        return []
    out: list[dict] = []
    for src, dst in EDGES:
        if src == start:
            out.append(NODES[dst])
    return out


def main() -> None:
    found = neighbors_buggy("n1", "iris")
    print(f"LEAK: iris traversal returns -> {found}")
    assert any(n["domain"] == "pulse" for n in found)


if __name__ == "__main__":
    main()
