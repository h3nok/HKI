"""HKI-T14 — graph traversal domain check on every edge (POST-HKI)."""
from __future__ import annotations

import hki_runtime

NODES: dict[str, dict] = {
    "n1": {"domain": "iris", "content": "iris home"},
    "n2": {"domain": "pulse", "content": "pulse secret"},
}
EDGES: list[tuple[str, str]] = [("n1", "n2")]


def neighbors_safe(start: str, domain: str) -> list[dict]:
    if NODES[start]["domain"] != domain:
        return []
    out: list[dict] = []
    for src, dst in EDGES:
        if src != start:
            continue
        node = NODES[dst]
        if hki_runtime.same_domain(node["domain"], domain):
            out.append(node)
    return out


def main() -> None:
    found = neighbors_safe("n1", "iris")
    print(f"BLOCKED: iris traversal returns -> {found}")
    assert all(n["domain"] == "iris" for n in found)


if __name__ == "__main__":
    main()
