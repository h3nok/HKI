"""HKI-T06 — MCP tool without domain binding (PRE-HKI)."""
from __future__ import annotations

# Tool registry as MCP gateways often look in the wild.
TOOLS: list[dict[str, str]] = [
    {"id": "search.iris", "domain": "iris"},
    {"id": "global.search", "domain": "*"},      # bad: wildcard
    {"id": "shared.lookup"},                     # bad: missing domain
]


def can_invoke_buggy(tool_id: str, active_domain: str) -> bool:
    for t in TOOLS:
        if t["id"] == tool_id:
            # BUG: missing/wildcard treated as "available everywhere".
            domain: str = t.get("domain", "*")
            return domain in ("*", active_domain)
    return False


def main() -> None:
    assert can_invoke_buggy("global.search", "iris")
    assert can_invoke_buggy("shared.lookup", "iris")
    print("LEAK: wildcard and missing-domain tools invokable from every domain")


if __name__ == "__main__":
    main()
