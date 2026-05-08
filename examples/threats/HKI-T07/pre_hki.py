"""HKI-T07 — A2A delegation drops envelope (PRE-HKI)."""
from __future__ import annotations

DOC_STORE: dict[str, list[str]] = {
    "iris": ["iris-confidential"],
    "pulse": ["pulse-confidential"],
}


def agent_b_buggy(task: str) -> list[str]:
    # No envelope -> agent B operates as a service identity with broad scope.
    return [doc for rows in DOC_STORE.values() for doc in rows]


def agent_a_delegate_buggy(task: str, caller_domain: str) -> list[str]:
    # BUG: caller_domain is recorded for telemetry but not threaded.
    return agent_b_buggy(task)


def main() -> None:
    leaked: list[str] = agent_a_delegate_buggy("find docs", caller_domain="iris")
    print(f"LEAK: agent A under iris received cross-domain docs -> {leaked}")
    assert "pulse-confidential" in leaked


if __name__ == "__main__":
    main()
