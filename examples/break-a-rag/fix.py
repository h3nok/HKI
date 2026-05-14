"""
Break a RAG in 60 seconds — HKI fixes for all three failures.

Adds hki-runtime to the vanilla RAG from break.py and closes:
  T05: domain-scoped retrieval via same_domain()
  T01: domain-isolated cache via derive_hki_cache_key()
  T02: body scope override blocked via reject_conflicting_scope_argument()

Run:
    pip install "hki-runtime>=0.1.0"
    python fix.py
"""
from __future__ import annotations

import time
import hki_runtime
from hki_runtime.client import mint_envelope

# ---------------------------------------------------------------------------
# Same document store as break.py
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


def _mint(domain: str) -> hki_runtime.HkiEnvelope:
    now = int(time.time())
    return mint_envelope(
        org_id="acme",
        subject_id="user:example",
        active_domain=domain,
        authorized_domains=[domain],
        purpose="chat",
        risk_tier="read-only",
        policy_pack_id=f"{domain}@2026",
        issuer="break-a-rag-demo",
        signature="demo",
        ttl=300,
        issued_at=now,
    )


# ---------------------------------------------------------------------------
# FIX 1 — T05: filter retrieval by envelope.active_domain
# ---------------------------------------------------------------------------

def retrieve_safe(query: str, envelope: hki_runtime.HkiEnvelope) -> list[str]:
    """FIX (T05): only return docs whose domain matches the active envelope."""
    return [
        d["text"] for d in DOCS
        if hki_runtime.same_domain(d["domain"], envelope.active_domain)
    ]


# ---------------------------------------------------------------------------
# FIX 2 — T01: derive cache key that includes domain via HKI
# ---------------------------------------------------------------------------

def answer_safe(query: str, envelope: hki_runtime.HkiEnvelope) -> str:
    """FIX (T01): cache key encodes envelope domain so domains cannot collide."""
    key = hki_runtime.derive_hki_cache_key(
        {
            "envelope": {
                "hki_version": "1.0",
                "envelope_id": envelope.envelope_id,
                "org_id": envelope.org_id,
                "subject_id": envelope.subject_id,
                "active_domain": envelope.active_domain,
                "authorized_domains": envelope.authorized_domains,
                "purpose": envelope.purpose,
                "risk_tier": envelope.risk_tier,
                "policy_pack_id": envelope.policy_pack_id,
                "issued_at": envelope.issued_at,
                "expires_at": envelope.expires_at,
                "issuer": envelope.issuer,
                "signature": envelope.signature,
            },
            "operation": "chat.completion",
            "input": {"query": query},
        }
    )
    if key in CACHE:
        return CACHE[key]
    docs = retrieve_safe(query, envelope)
    answer = mock_llm(docs, query, envelope.active_domain)
    CACHE[key] = answer
    return answer


# ---------------------------------------------------------------------------
# FIX 3 — T02: reject body.scope that conflicts with the envelope
# ---------------------------------------------------------------------------

def handle_request_safe(body: dict, envelope: hki_runtime.HkiEnvelope) -> dict:
    """FIX (T02): body.scope that differs from active_domain is rejected."""
    scope_error = hki_runtime.reject_conflicting_scope_argument(envelope, body)
    if scope_error:
        return {"error": "scope-override-blocked", "message": scope_error}
    docs = retrieve_safe(body["query"], envelope)
    return {
        "domain": envelope.active_domain,
        "answer": mock_llm(docs, body["query"], envelope.active_domain),
    }


# ---------------------------------------------------------------------------
# Demo — prove each fix
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("FIXING THE RAG WITH HKI — 3 failures closed")
    print("=" * 60)

    # --- T05 fix: domain-filtered retrieval ---
    print("\n[T05] Retrieval — domain-scoped filter")
    env_payments = _mint("payments")
    env_hr = _mint("hr")
    payments_docs = retrieve_safe("refund policy", env_payments)
    hr_docs       = retrieve_safe("PTO balance",   env_hr)
    has_hr_in_payments = any("PTO" in d for d in payments_docs)
    has_legal_in_hr    = any("NDA" in d for d in hr_docs)
    print(f"  payments query returned {len(payments_docs)} docs (should be 2)")
    print(f"  HR text visible in payments context: {has_hr_in_payments}")   # False ← BLOCKED
    print(f"  Legal text visible in HR context:    {has_legal_in_hr}")      # False ← BLOCKED
    assert not has_hr_in_payments
    assert not has_legal_in_hr
    print("  ✓ BLOCKED: retrieval stays within active_domain")

    # --- T01 fix: domain-isolated cache ---
    print("\n[T01] Cache — domain-isolated keys")
    CACHE.clear()
    payments_answer = answer_safe("tell me about our policy", env_payments)
    hr_answer       = answer_safe("tell me about our policy", env_hr)
    print(f"  payments answer: {payments_answer!r}")
    print(f"  hr answer:       {hr_answer!r}")
    assert payments_answer != hr_answer
    assert "payments" in payments_answer and "hr" in hr_answer
    print("  ✓ BLOCKED: domain-scoped cache keys prevent cross-domain collision")

    # --- T02 fix: body scope override rejected ---
    print("\n[T02] Scope override — body.scope rejected by HKI")
    legitimate = handle_request_safe(
        {"query": "refund limit", "domain": "payments"},
        env_payments,
    )
    escalation_attempt = handle_request_safe(
        {"query": "refund limit", "domain": "payments", "scope": "legal"},
        env_payments,
    )
    print(f"  legitimate response:  {legitimate.get('domain')!r}")
    print(f"  escalation response:  {escalation_attempt.get('error')!r}")
    assert "answer" in legitimate
    assert escalation_attempt.get("error") == "scope-override-blocked"
    print("  ✓ BLOCKED: body.scope override rejected, caller stays in 'payments'")

    print("\n" + "=" * 60)
    print("3/3 failures closed.  Zero external services needed.")
    print("=" * 60)


if __name__ == "__main__":
    main()
