"""HKI-T01 — semantic cache cross-domain leak (PRE-HKI).

Demonstrates the bug. Run: ``python pre_hki.py``.
"""
from __future__ import annotations

CACHE: dict[str, str] = {}


def domain_specific_answer(query: str, domain: str) -> str:
    """Pretend this calls retrieval+LLM scoped by ``domain``."""
    return f"answer for {query!r} under {domain!r}"


def respond_buggy(query: str, domain: str) -> str:
    # BUG: cache key is the query string only — domain is missing.
    if query in CACHE:
        return CACHE[query]
    answer: str = domain_specific_answer(query, domain)
    CACHE[query] = answer
    return answer


def main() -> None:
    iris_answer: str = respond_buggy("what is our return policy", domain="iris")
    pulse_answer: str = respond_buggy("what is our return policy", domain="pulse")
    print(f"iris  -> {iris_answer}")
    print(f"pulse -> {pulse_answer}")
    assert pulse_answer == iris_answer, "leak missed (test would have caught regression)"
    print("LEAK: pulse received iris's answer from cache.")


if __name__ == "__main__":
    main()
