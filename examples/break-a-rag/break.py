"""
Break a RAG in 60 seconds — three HKI failures in a vanilla RAG.

Each failure is a real threat from the HKI catalog (T05, T01, T02).
This script deliberately leaks data and ASSERTS that the leaks happen,
so the output is unambiguous proof of the bug.

Run:
    python break.py

No API keys or services needed — the doc store and LLM are mocked.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Shared document store (simulates a vector index with mixed domains)
# ---------------------------------------------------------------------------

DOCS: list[dict] = [
    {"id": "d1", "domain": "payments", "text": "Refund limit is $500 for standard accounts."},
    {"id": "d2", "domain": "payments", "text": "Chargebacks expire after 90 days."},
    {"id": "d3", "domain": "hr",       "text": "PTO accrual rate: 1.5 days per month."},
    {"id": "d4", "domain": "hr",       "text": "Parental leave: 12 weeks fully paid."},
    {"id": "d5", "domain": "legal",    "text": "NDA template version: 4.2 (2026-01-15)."},
]

CACHE: dict[str, str] = {}


def mock_llm(context: list[str], query: str, domain: str) -> str:
    return f"[{domain}] Based on {len(context)} doc(s): {context[0]!r}"


# ---------------------------------------------------------------------------
# FAILURE 1 — T05: shared vector index, no domain filter
# ---------------------------------------------------------------------------

def retrieve_buggy(query: str, domain: str) -> list[str]:
    """BUG (T05): retrieves from the entire index — domain is ignored."""
    return [d["text"] for d in DOCS]


# ---------------------------------------------------------------------------
# FAILURE 2 — T01: response cache keyed only by query text
# ---------------------------------------------------------------------------

def answer_buggy(query: str, domain: str) -> str:
    """BUG (T01): cache key = query alone, so domains share cached answers."""
    if query in CACHE:
        return CACHE[query]
    docs = retrieve_buggy(query, domain)
    answer = mock_llm(docs, query, domain)
    CACHE[query] = answer
    return answer


# ---------------------------------------------------------------------------
# FAILURE 3 — T02: request body can override active_domain
# ---------------------------------------------------------------------------

def handle_request_buggy(body: dict) -> dict:
    """BUG (T02): body.scope silently replaces the caller-declared domain."""
    domain = body.get("scope", body.get("domain", "global"))
    docs = retrieve_buggy(body["query"], domain)
    return {"domain": domain, "answer": mock_llm(docs, body["query"], domain)}


# ---------------------------------------------------------------------------
# Demo — prove each failure
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("BREAKING A VANILLA RAG — 3 HKI failures")
    print("=" * 60)

    # --- T05: retrieval leak ---
    print("\n[T05] Retrieval — no domain filter")
    payments_docs = retrieve_buggy("refund policy", domain="payments")
    hr_docs       = retrieve_buggy("PTO balance", domain="hr")
    has_hr_in_payments = any("PTO" in d for d in payments_docs)
    has_legal_in_hr    = any("NDA" in d for d in hr_docs)
    print(f"  payments query returned {len(payments_docs)} docs (should be 2)")
    print(f"  HR text visible in payments context: {has_hr_in_payments}")    # True  ← LEAK
    print(f"  Legal text visible in HR context:    {has_legal_in_hr}")       # True  ← LEAK
    assert has_hr_in_payments, "T05 regression — leak should be present in pre-HKI code"
    assert has_legal_in_hr,    "T05 regression — leak should be present in pre-HKI code"
    print("  ✗ LEAK confirmed")

    # --- T01: cache cross-domain collision ---
    print("\n[T01] Cache — cross-domain collision")
    CACHE.clear()
    payments_answer = answer_buggy("tell me about our policy", domain="payments")
    hr_answer       = answer_buggy("tell me about our policy", domain="hr")
    print(f"  payments answer: {payments_answer!r}")
    print(f"  hr answer:       {hr_answer!r}")
    assert payments_answer == hr_answer, "T01 regression — cache should collide"
    print("  ✗ LEAK: hr received payments' cached answer")

    # --- T02: body-parameter scope override ---
    print("\n[T02] Scope override — body.scope bypasses envelope domain")
    legitimate  = handle_request_buggy({"query": "refund limit", "domain": "payments"})
    escalated   = handle_request_buggy({"query": "refund limit", "domain": "payments",
                                        "scope": "legal"})
    print(f"  legitimate request domain: {legitimate['domain']!r}")
    print(f"  escalated  request domain: {escalated['domain']!r}")
    assert escalated["domain"] == "legal", "T02 regression — override should succeed"
    print("  ✗ LEAK: caller escalated from payments to legal via body.scope")

    print("\n" + "=" * 60)
    print("3/3 failures demonstrated.  Run fix.py to see HKI close them.")
    print("=" * 60)


if __name__ == "__main__":
    main()
