"""HKI-T03 — implicit `or 'global'` fallback (PRE-HKI)."""
from __future__ import annotations


DATA = {"iris": ["iris-1"], "pulse": ["pulse-1"], "global": []}


def query_buggy(ctx: dict) -> list[str]:
    # BUG: when ctx has no active_domain, this falls back to "global"
    # which most repositories interpret as "no filter" / read everything.
    domain = ctx.get("active_domain") or "global"
    if domain == "global":
        # cross-domain leak — returns every row
        return [doc for rows in DATA.values() for doc in rows]
    return DATA.get(domain, [])


def main() -> None:
    leaked: list[str] = query_buggy({})
    print(f"LEAK: empty-context query returned all rows -> {leaked}")
    assert "iris-1" in leaked and "pulse-1" in leaked


if __name__ == "__main__":
    main()
