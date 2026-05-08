"""HKI-T15 — prompt-injected scope override (PRE-HKI)."""
from __future__ import annotations

DATA: dict[str, str] = {"iris": "iris-public", "pulse": "pulse-secret"}


def search_tool_buggy(query: str, domain: str, envelope: dict) -> str:
    # BUG: trusts LLM-supplied domain over envelope's active_domain.
    return DATA.get(domain, "")


def main() -> None:
    env = {"active_domain": "iris", "authorized_domains": ["iris"]}
    # LLM hallucinates / is injected to call with domain="pulse"
    out: str = search_tool_buggy("anything", domain="pulse", envelope=env)
    print(f"LEAK: tool returned -> {out!r}")
    assert out == "pulse-secret"


if __name__ == "__main__":
    main()
