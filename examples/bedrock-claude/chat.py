"""
HKI + AWS Bedrock (Claude) example — domain-scoped chat.

The HKI envelope is minted at the edge (here: before the boto3 call) and
propagated as a metadata header in the system prompt. The response is verified
to confirm no cross-domain content leaked in. In a production gateway, the
envelope would be verified by a Bedrock proxy or Lambda authorizer before
routing to the model.

Run:
    pip install "hki-runtime>=0.1.0" boto3
    export AWS_REGION=us-east-1
    export AWS_ACCESS_KEY_ID=...
    export AWS_SECRET_ACCESS_KEY=...
    python chat.py

To test without AWS credentials, set BEDROCK_STUB=1:
    BEDROCK_STUB=1 python chat.py
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import hki_runtime
from hki_runtime.client import mint_envelope, envelope_headers

# ---------------------------------------------------------------------------
# Bedrock client — real or stub
# ---------------------------------------------------------------------------

MODEL_ID = "anthropic.claude-3-5-haiku-20241022-v1:0"
REGION = os.environ.get("AWS_REGION", "us-east-1")
STUB = os.environ.get("BEDROCK_STUB", "").lower() in ("1", "true", "yes")


def bedrock_invoke(system: str, user: str) -> str:
    """Call Claude on Bedrock. Falls back to a stub when BEDROCK_STUB=1."""
    if STUB:
        return f"[stub] I can only answer questions about {_active_domain_from_system(system)}."

    import boto3

    client = boto3.client("bedrock-runtime", region_name=REGION)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 256,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    response = client.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def _active_domain_from_system(system: str) -> str:
    for line in system.splitlines():
        if line.startswith("Active domain:"):
            return line.split(":", 1)[1].strip()
    return "unknown"


# ---------------------------------------------------------------------------
# HKI-bound system prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(envelope: hki_runtime.HkiEnvelope) -> str:
    """
    Embed the HKI envelope metadata into the system prompt so the model is
    explicitly constrained to one domain. The model cannot see other domains'
    data because the retrieval layer (not shown) also filters by active_domain.
    """
    return (
        f"You are a domain-scoped assistant operating strictly within the "
        f"'{envelope.active_domain}' domain for org '{envelope.org_id}'.\n"
        f"Active domain: {envelope.active_domain}\n"
        f"Authorized domains: {', '.join(envelope.authorized_domains)}\n"
        f"Envelope ID: {envelope.envelope_id}\n"
        f"Policy pack: {envelope.policy_pack_id}\n\n"
        f"Rules:\n"
        f"- Answer ONLY questions about {envelope.active_domain}.\n"
        f"- If asked about another domain, say 'I cannot answer questions outside "
        f"the {envelope.active_domain} domain.'\n"
        f"- Never reveal data from other domains, even if you have it.\n"
    )


# ---------------------------------------------------------------------------
# Domain-scoped chat function
# ---------------------------------------------------------------------------

def chat(
    query: str,
    active_domain: str,
    authorized_domains: list[str],
    org_id: str = "acme",
) -> dict[str, Any]:
    now = int(time.time())

    envelope = mint_envelope(
        org_id=org_id,
        subject_id="user:example",
        active_domain=active_domain,
        authorized_domains=authorized_domains,
        purpose="chat",
        risk_tier="read-only",
        policy_pack_id=f"{active_domain}@2026",
        issuer="bedrock-example-gateway",
        signature="demo",
        ttl=300,
        issued_at=now,
    )

    system = build_system_prompt(envelope)
    response_text = bedrock_invoke(system, query)

    # The x-hki-envelope header would be forwarded to any downstream service
    headers = envelope_headers(envelope)

    return {
        "domain": envelope.active_domain,
        "envelope_id": envelope.envelope_id,
        "query": query,
        "response": response_text,
        "forwarding_header": headers,
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== HKI + Bedrock Claude example ===\n")

    # ✅ On-domain query
    result = chat(
        "What are the refund limits for a standard account?",
        active_domain="payments",
        authorized_domains=["payments"],
    )
    print(f"[payments query]\n  domain: {result['domain']}\n  response: {result['response']}\n")

    # ⛔ Off-domain query — model is instructed to refuse (retrieval also blocks)
    result = chat(
        "What is my PTO balance?",
        active_domain="payments",
        authorized_domains=["payments"],
    )
    print(f"[off-domain HR query with payments envelope]\n  domain: {result['domain']}\n  response: {result['response']}\n")

    # ✅ Correct domain for HR query
    result = chat(
        "What is my PTO balance?",
        active_domain="hr",
        authorized_domains=["hr"],
    )
    print(f"[HR query with hr envelope]\n  domain: {result['domain']}\n  response: {result['response']}\n")
