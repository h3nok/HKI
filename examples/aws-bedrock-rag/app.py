"""
HKI + AWS Bedrock RAG — domain-scoped retrieval and chat.

Combines HkiMiddleware (envelope enforcement), Amazon Titan Embeddings (query
encoding), OpenSearch Serverless (domain-filtered kNN retrieval), and Claude
on Bedrock (generation).

Cross-domain reads are structurally impossible: every OpenSearch query includes
a mandatory `term` filter on `hki_domain` equal to `envelope.active_domain`.
That filter is load-bearing — removing it silently breaks isolation.

Run (stub — no AWS credentials needed):
    pip install "hki-runtime[fastapi]" fastapi uvicorn
    AWS_STUB=1 uvicorn app:app --reload

Run (real AWS):
    pip install "hki-runtime[fastapi]" fastapi uvicorn boto3 opensearch-py requests-aws4auth
    export AWS_REGION=us-east-1
    export OPENSEARCH_ENDPOINT=https://your-collection.us-east-1.aoss.amazonaws.com
    uvicorn app:app --reload

Try:
    TOKEN=$(python -c "
    import base64, json, time
    e={'hki_version':'1.0','envelope_id':'e1','org_id':'acme','subject_id':'u1',
       'active_domain':'payments','authorized_domains':['payments'],
       'purpose':'retrieve','risk_tier':'read-only','policy_pack_id':'p1',
       'issued_at':int(time.time()),'expires_at':int(time.time())+300,
       'issuer':'example','signature':'demo'}
    print(base64.urlsafe_b64encode(json.dumps(e).encode()).decode())")
    curl -s -X POST http://localhost:8000/chat \\
         -H "x-hki-envelope: $TOKEN" \\
         -H "content-type: application/json" \\
         -d '{"query":"What are the refund limits?"}'
"""

from __future__ import annotations

import json
import math
import os
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

import hki_runtime
from hki_runtime.fastapi import HkiMiddleware, get_envelope

REGION = os.environ.get("AWS_REGION", "us-east-1")
OPENSEARCH_ENDPOINT = os.environ.get("OPENSEARCH_ENDPOINT", "")
EMBED_MODEL = "amazon.titan-embed-text-v2:0"
CHAT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0"
STUB = os.environ.get("AWS_STUB", "").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Stub document store — replaces OpenSearch when AWS_STUB=1
# ---------------------------------------------------------------------------

_STUB_DOCS: dict[str, list[dict[str, str]]] = {
    "payments": [
        {"id": "pay-001", "text": "Refund limit is $500 per transaction for standard accounts."},
        {"id": "pay-002", "text": "Payment processing SLA is 2 business days."},
        {"id": "pay-003", "text": "Fraud holds release automatically after 72 hours."},
    ],
    "hr": [
        {"id": "hr-001", "text": "PTO accrual is 1.5 days per month for full-time employees."},
        {"id": "hr-002", "text": "Benefits enrollment opens annually each November."},
    ],
    "legal": [
        {"id": "leg-001", "text": "Contract review SLA is 5 business days for standard agreements."},
    ],
}

# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------


def embed(text: str) -> list[float]:
    """Embed text with Titan Embeddings v2, or return a deterministic stub vector."""
    if STUB:
        import hashlib
        digest = int(hashlib.sha256(text.encode()).hexdigest(), 16)
        raw = [((digest >> (i * 8) & 0xFF) / 127.5) - 1.0 for i in range(1536)]
        norm = math.sqrt(sum(v * v for v in raw)) or 1.0
        return [v / norm for v in raw]

    import boto3
    client = boto3.client("bedrock-runtime", region_name=REGION)
    resp = client.invoke_model(
        modelId=EMBED_MODEL,
        body=json.dumps({"inputText": text}),
        contentType="application/json",
        accept="application/json",
    )
    return json.loads(resp["body"].read())["embedding"]


# ---------------------------------------------------------------------------
# Retrieval — the domain filter is NOT optional
# ---------------------------------------------------------------------------


def retrieve(domain: str, query_vector: list[float], top_k: int = 3) -> list[dict[str, str]]:
    """
    kNN search scoped to `domain`. The `term` filter on `hki_domain` is the
    structural isolation guarantee — it is not a soft hint. A caller cannot
    retrieve documents from a different domain regardless of the query vector.
    """
    if STUB:
        return _STUB_DOCS.get(domain, [])[:top_k]

    from opensearchpy import OpenSearch, RequestsHttpConnection
    from requests_aws4auth import AWS4Auth
    import boto3

    creds = boto3.Session().get_credentials()
    auth = AWS4Auth(creds.access_key, creds.secret_key, REGION, "aoss", session_token=creds.token)
    host = OPENSEARCH_ENDPOINT.removeprefix("https://").removeprefix("http://").rstrip("/")
    client = OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
    )
    resp = client.search(
        index="hki-knowledge",
        body={
            "size": top_k,
            "query": {
                "bool": {
                    "filter": [{"term": {"hki_domain": domain}}],
                    "must": [{"knn": {"embedding": {"vector": query_vector, "k": top_k}}}],
                }
            },
        },
    )
    return [{"id": h["_id"], "text": h["_source"].get("text", "")} for h in resp["hits"]["hits"]]


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def bedrock_chat(envelope: hki_runtime.HkiEnvelope, context_docs: list[dict[str, str]], query: str) -> str:
    context = "\n".join(f"- {d['text']}" for d in context_docs) or "(no documents retrieved)"
    system = (
        f"You are a domain-scoped assistant. "
        f"active_domain={envelope.active_domain} org_id={envelope.org_id}\n\n"
        f"Knowledge context (domain: {envelope.active_domain}):\n{context}\n\n"
        f"Answer ONLY from the context above. Never reference other domains."
    )
    if STUB:
        snippet = context_docs[0]["text"] if context_docs else "no context available"
        return f"[stub] Based on {envelope.active_domain} knowledge: {snippet}"

    import boto3
    client = boto3.client("bedrock-runtime", region_name=REGION)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "system": system,
        "messages": [{"role": "user", "content": query}],
    }
    resp = client.invoke_model(
        modelId=CHAT_MODEL,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )
    return json.loads(resp["body"].read())["content"][0]["text"]


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="hki-aws-bedrock-rag-example")
app.add_middleware(HkiMiddleware, require_signature=False)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, Any]:
    return {"ok": True, "stub": STUB, "region": REGION}


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

    # P06: reject body fields that attempt to override active_domain
    scope_error = hki_runtime.reject_conflicting_scope_argument(envelope, body)
    if scope_error:
        return JSONResponse({"error": "scope-override", "message": scope_error}, status_code=403)

    cache_key = hki_runtime.derive_hki_cache_key(
        hki_runtime.HkiCacheKeyInput(envelope=envelope, operation="bedrock-rag", input=query)
    )

    query_vector = embed(query)
    docs = retrieve(envelope.active_domain, query_vector)
    response_text = bedrock_chat(envelope, docs, query)

    return JSONResponse({
        "domain": envelope.active_domain,
        "org_id": envelope.org_id,
        "envelope_id": envelope.envelope_id,
        "query": query,
        "context_docs": len(docs),
        "response": response_text,
        "cache_key": cache_key,
        "retrieved_at": int(time.time()),
    })


# ---------------------------------------------------------------------------
# Demo (AWS_STUB=1 python app.py)
# To serve: AWS_STUB=1 uvicorn app:app --port 8001 --reload
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import base64
    from hki_runtime.client import mint_envelope

    print("=== HKI + AWS Bedrock RAG example ===")
    print(f"stub={STUB}  region={REGION}\n")

    now = int(time.time())
    for domain, query in [
        ("payments", "What are the refund limits?"),
        ("hr", "What is the PTO accrual rate?"),
        ("payments", "What is the PTO accrual rate?"),  # off-domain — retrieval returns nothing
    ]:
        env = mint_envelope(
            org_id="acme", subject_id="user:demo", active_domain=domain,
            authorized_domains=[domain], purpose="retrieve", risk_tier="read-only",
            policy_pack_id=f"{domain}@2026", issuer="demo", signature="demo",
            ttl=300, issued_at=now,
        )
        vec = embed(query)
        docs = retrieve(domain, vec)
        response = bedrock_chat(env, docs, query)
        label = "✅" if docs else "⛔ (no context)"
        print(f"[{domain}] {query!r}")
        print(f"  {label} {len(docs)} docs → {response[:80]}")
        print()
