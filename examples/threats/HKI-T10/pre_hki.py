"""HKI-T10 — wildcard publication into runtime domain (PRE-HKI)."""
from __future__ import annotations

ARTIFACTS: list[dict] = []


def publish_buggy(content: str, domain: str) -> None:
    # BUG: caller can publish with domain="*" or "global".
    ARTIFACTS.append({"domain": domain, "content": content})


def read_runtime(domain: str) -> list[dict]:
    return [a for a in ARTIFACTS if a["domain"] == domain or a["domain"] in {"*", "global"}]


def main() -> None:
    publish_buggy("backdoor doc", domain="*")
    visible = read_runtime("iris")
    print(f"LEAK: iris sees -> {visible}")
    assert visible


if __name__ == "__main__":
    main()
