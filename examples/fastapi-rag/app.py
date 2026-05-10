"""
HKI + FastAPI RAG example — domain-scoped retrieval.

Every request must carry a signed HKI envelope (x-hki-envelope header).
The /chat endpoint retrieves documents ONLY from the active_domain's partition.
Cross-domain reads are impossible by construction — the cache key, retrieval
filter, and response are all bound to the single active domain.

Run:
    pip install "hki-runtime[fastapi]" fastapi uvicorn
    uvicorn app:app --reload

Try:
    TOKEN=$(python - <<'PY'
    import base64, json, time
    env = {"hki_version":"1.0","envelope_id":"ex01","org_id":"acme",
           "subject_id":"u1","active_domain":"payments",
           "authorized_domains":["payments"],"purpose":"retrieve",
           "risk_tier":"read-only","policy_pack_id":"p1",
           "issued_at":int(time.time()),"expires_at":int(time.time())+300,
           "issuer":"example","signature":"demo"}
    print(base64.urlsafe_b64encode(json.dumps(env).encode()).decode())
    PY)
    curl -s -X POST http://localhost:8000/chat \
         -H "x-hki-envelope: $TOKEN" \
         -H "content-type: application/json" \
         -d '{"query":"What are the refund limits?"}'
"""

from __future__ import annotations

import hashlib
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

import hki_runtime
from hki_runtime.fastapi import HkiMiddleware, get_envelope

# ---------------------------------------------------------------------------
# Simulated per-domain document store (replace with pgvector, Chroma, etc.)
# ---------------------------------------------------------------------------

_DOCS: dict[str, list[dict[str, str]]] = {
    "payments": [
        {"id": "pay-001", "text": "Refund limit is $500 per transaction for standard accounts."},
        {"id": "pay-002", "text": "Payment processing SLA is 2 business days."},
        {"id": "pay-003", "text": "Fraud holds are automatically released after 72 hours."},
    ],
    "hr": [
        {"id": "hr-001", "text": "PTO accrual is 1.5 days per month for full-time employees."},
        {"id": "hr-002", "text": "Benefits enrollment opens annually each November."},
    ],
    "legal": [
        {"id": "leg-001", "text": "Contract review SLA is 5 business days for standard agreements."},
    ],
}


def retrieve(domain: str, query: str, top_k: int = 2) -> list[dict[str, str]]:
    """Return documents from `domain`'s partition only. Simulates BM25/vector search."""
    docs = _DOCS.get(domain, [])
    query_words = set(query.lower().split())
    scored = [
        (sum(w in doc["text"].lower() for w in query_words), doc)
        for doc in docs
    ]
    scored.sort(key=lambda t: t[0], reverse=True)
    return [doc for _, doc in scored[:top_k]]


def domain_cache_key(envelope: hki_runtime.HkiEnvelope, query: str) -> str:
    """HKI-bound cache key — org_id + active_domain + query hash."""
    raw = hki_runtime.HkiCacheKeyInput(
        envelope=envelope,
        operation="rag-retrieve",
        input=query,
    )
    return hki_runtime.derive_hki_cache_key(raw)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="hki-fastapi-rag-example")

# require_signature=False for this local demo; set True in production.
app.add_middleware(HkiMiddleware, require_signature=False)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, Any]:
    return {"ok": True}


@app.post("/chat")
async def chat(request: Request) -> JSONResponse:
    envelope = get_envelope(request)

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid-body"}, status_code=400)

    query: str = str(body.get("query", "")).strip()
    if not query:
        return JSONResponse({"error": "query is required"}, status_code=422)

    # P06-style guard: reject body fields that try to override the active domain
    scope_error = hki_runtime.reject_conflicting_scope_argument(envelope, body)
    if scope_error:
        return JSONResponse({"error": "scope-override", "message": scope_error}, status_code=403)

    # Retrieve only from the envelope's active_domain partition
    docs = retrieve(envelope.active_domain, query)
    cache_key = domain_cache_key(envelope, query)

    return JSONResponse({
        "domain": envelope.active_domain,
        "query": query,
        "results": docs,
        "cache_key": cache_key,
        "retrieved_at": int(time.time()),
    })
