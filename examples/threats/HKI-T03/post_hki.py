"""HKI-T03 — implicit `or 'global'` fallback (POST-HKI)."""
from __future__ import annotations

import hki_runtime


DATA: dict[str, list[str]] = {"iris": ["iris-1"], "pulse": ["pulse-1"]}


class MissingDomainError(Exception):
    pass


def query_safe(ctx: dict) -> list[str]:
    domain = ctx.get("active_domain")
    if not domain or hki_runtime.is_forbidden_runtime_domain(domain):
        raise MissingDomainError(
            "active_domain is required and must not be global/wildcard"
        )
    return DATA.get(domain, [])


def main() -> None:
    try:
        query_safe({})
    except MissingDomainError as e:
        print(f"BLOCKED: {e}")
        return
    raise AssertionError("post-HKI must reject empty-context queries")


if __name__ == "__main__":
    main()
