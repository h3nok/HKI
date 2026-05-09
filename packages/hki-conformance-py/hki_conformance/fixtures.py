"""Conformance fixtures — exact Python mirror of fixtures.ts.

Timestamps use CONFORMANCE_NOW so expiry checks are deterministic regardless
of when the suite runs. ``now`` is passed explicitly to ``validate_envelope``.
"""

from __future__ import annotations

# Fixed "now" used by the runner so expiry tests are deterministic.
# Matches the value in the TypeScript fixtures.
CONFORMANCE_NOW: int = 1_777_900_100

_BASE: dict = {
    "hki_version": "1.0",
    "envelope_id": "env_hki_conformance",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "payments",
    "authorized_domains": ["payments", "fraud"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "policy_2026_05",
    "issued_at": 1_777_900_000,
    "expires_at": 1_777_900_300,
    "issuer": "hki-conformance",
    "signature": "sig_conformance",
}

# ── Envelope fixtures ──────────────────────────────────────────────────────

BASE_ENVELOPE: dict = _BASE

GLOBAL_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_global",
    "active_domain": "global",
    "authorized_domains": ["global"],
}

WILDCARD_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_wildcard",
    "active_domain": "*",
    "authorized_domains": ["*"],
}

MISSING_ACTIVE_DOMAIN_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_missing_domain",
    "active_domain": "",
}

UNAUTHORIZED_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_unauthorized",
    "active_domain": "legal",
    "authorized_domains": ["payments"],
}

EXPIRED_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_expired",
    "expires_at": CONFORMANCE_NOW - 1,
}

UNSIGNED_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_unsigned",
    "signature": None,
}

GLOBAL_AUTHORIZED_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_global_authorized",
    "authorized_domains": ["payments", "global"],
}

WILDCARD_AUTHORIZED_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_wildcard_authorized",
    "authorized_domains": ["payments", "*"],
}

WRONG_VERSION_ENVELOPE: dict = {
    **_BASE,
    "envelope_id": "env_hki_wrong_version",
    "hki_version": "0.9",
}

# ── Artifact fixtures ──────────────────────────────────────────────────────

VISIBLE_ARTIFACT: dict = {
    "org_id": "org_acme",
    "domain": "payments",
    "artifact_type": "document",
    "artifact_id": "doc_payment_policy",
}

GLOBAL_ARTIFACT: dict = {
    "org_id": "org_acme",
    "domain": "global",
    "artifact_type": "document",
    "artifact_id": "doc_global_policy",
}

WILDCARD_ARTIFACT: dict = {
    "org_id": "org_acme",
    "domain": "*",
    "artifact_type": "document",
    "artifact_id": "doc_wildcard_policy",
}

CROSS_DOMAIN_ARTIFACT: dict = {
    "org_id": "org_acme",
    "domain": "fraud",
    "artifact_type": "document",
    "artifact_id": "doc_fraud_model",
}

CROSS_ORG_ARTIFACT: dict = {
    "org_id": "org_other",
    "domain": "payments",
    "artifact_type": "document",
    "artifact_id": "doc_other_org",
}

# ── Gateway target fixtures ────────────────────────────────────────────────

ACTIVE_GATEWAY_TARGET: dict = {
    "type": "tool",
    "id": "retrieval.search",
    "domain": "payments",
    "published_domains": [],
}

PUBLISHED_GATEWAY_TARGET: dict = {
    "type": "resource",
    "id": "published.policy.release",
    "domain": "policy-authoring",
    "published_domains": ["payments"],
}

GLOBAL_GATEWAY_TARGET: dict = {
    "type": "tool",
    "id": "global.search",
    "domain": "global",
    "published_domains": [],
}

WILDCARD_GATEWAY_TARGET: dict = {
    "type": "tool",
    "id": "wildcard.search",
    "domain": "*",
    "published_domains": [],
}

WILDCARD_PUBLISHED_GATEWAY_TARGET: dict = {
    "type": "tool",
    "id": "wildcard.published_search",
    "domain": "search",
    "published_domains": ["*"],
}

CROSS_DOMAIN_GATEWAY_TARGET: dict = {
    "type": "tool",
    "id": "fraud.case_lookup",
    "domain": "fraud",
    "published_domains": [],
}

# ── Cache key input fixtures ───────────────────────────────────────────────

CACHE_INPUT: dict = {
    "envelope": BASE_ENVELOPE,
    "operation": "retrieval.search",
    "input": {"query": "refund window"},
    "model_route": "gpt-5.4",
    "context_version": "kb-v1",
}

CROSS_DOMAIN_CACHE_INPUT: dict = {
    **CACHE_INPUT,
    "envelope": {
        **_BASE,
        "envelope_id": "env_hki_fraud",
        "active_domain": "fraud",
    },
}

CHANGED_POLICY_CACHE_INPUT: dict = {
    **CACHE_INPUT,
    "envelope": {
        **_BASE,
        "envelope_id": "env_hki_policy",
        "policy_pack_id": "policy_2026_06",
    },
}

CHANGED_OPERATION_CACHE_INPUT: dict = {
    **CACHE_INPUT,
    "operation": "memory.read",
}
