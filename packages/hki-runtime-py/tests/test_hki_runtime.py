from __future__ import annotations

import hki_runtime as hki


BASE_ENVELOPE = {
    "hki_version": "1.0",
    "envelope_id": "env_test",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "payments",
    "authorized_domains": ["payments", "fraud"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "policy_current",
    "issued_at": 1000,
    "expires_at": 1300,
    "issuer": "gateway",
    "signature": "sig",
}


def _validated_envelope() -> hki.HkiEnvelope:
    result = hki.validate_envelope(BASE_ENVELOPE, now=1100, require_signature=True)
    assert result.ok
    assert result.envelope is not None
    return result.envelope


def test_validate_envelope_accepts_non_global_active_domain() -> None:
    result = hki.validate_envelope(BASE_ENVELOPE, now=1100, require_signature=True)

    assert result.ok
    assert result.envelope is not None
    assert result.envelope.active_domain == "payments"
    assert result.envelope.authorized_domains == ("payments", "fraud")


def test_validate_envelope_rejects_required_failures() -> None:
    cases = [
        (
            {**BASE_ENVELOPE, "active_domain": "global", "authorized_domains": ["global"]},
            "invalid-domain",
        ),
        ({**BASE_ENVELOPE, "active_domain": "*", "authorized_domains": ["*"]}, "invalid-domain"),
        ({**BASE_ENVELOPE, "active_domain": ""}, "missing-field"),
        ({**BASE_ENVELOPE, "active_domain": "legal"}, "unauthorized-domain"),
        ({**BASE_ENVELOPE, "expires_at": 1099}, "expired-envelope"),
        ({**BASE_ENVELOPE, "signature": ""}, "missing-field"),
        ({**BASE_ENVELOPE, "authorized_domains": ["payments", "global"]}, "invalid-domain"),
        ({**BASE_ENVELOPE, "authorized_domains": ["payments", "*"]}, "invalid-domain"),
        ({**BASE_ENVELOPE, "hki_version": "0.9"}, "invalid-version"),
    ]

    for payload, expected_code in cases:
        result = hki.validate_envelope(payload, now=1100, require_signature=True)
        assert not result.ok
        assert expected_code in {issue.code for issue in result.issues}


def test_artifact_visibility_is_exact_org_and_domain() -> None:
    envelope = _validated_envelope()

    assert (
        hki.assert_artifact_visible(
            envelope,
            {
                "org_id": "org_acme",
                "domain": "payments",
                "artifact_type": "document",
                "artifact_id": "doc_1",
            },
        )
        is None
    )
    assert (
        hki.assert_artifact_visible(
            envelope,
            {
                "org_id": "org_acme",
                "domain": "fraud",
                "artifact_type": "document",
                "artifact_id": "doc_2",
            },
        ).code
        == "artifact-scope-mismatch"
    )
    assert (
        hki.assert_artifact_visible(
            envelope,
            {
                "org_id": "org_acme",
                "domain": "*",
                "artifact_type": "document",
                "artifact_id": "doc_wildcard",
            },
        ).code
        == "invalid-domain"
    )
    assert (
        hki.assert_artifact_visible(
            envelope,
            {
                "org_id": "org_acme",
                "domain": "global",
                "artifact_type": "document",
                "artifact_id": "doc_global",
            },
        ).code
        == "invalid-domain"
    )


def test_cache_keys_bind_runtime_dimensions() -> None:
    envelope = _validated_envelope()
    active_key = hki.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "retrieval.search",
            "input": {"query": "refund window"},
            "model_route": "gpt-5.4",
            "context_version": "kb-v1",
        }
    )
    cross_domain_key = hki.derive_hki_cache_key(
        {
            "envelope": {**BASE_ENVELOPE, "active_domain": "fraud"},
            "operation": "retrieval.search",
            "input": {"query": "refund window"},
            "model_route": "gpt-5.4",
            "context_version": "kb-v1",
        }
    )
    changed_policy_key = hki.derive_hki_cache_key(
        {
            "envelope": {**BASE_ENVELOPE, "policy_pack_id": "policy_next"},
            "operation": "retrieval.search",
            "input": {"query": "refund window"},
            "model_route": "gpt-5.4",
            "context_version": "kb-v1",
        }
    )
    changed_operation_key = hki.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "memory.read",
            "input": {"query": "refund window"},
            "model_route": "gpt-5.4",
            "context_version": "kb-v1",
        }
    )

    assert hki.assert_cache_key_bound_to_envelope(active_key, envelope)
    assert active_key != cross_domain_key
    assert active_key != changed_policy_key
    assert active_key != changed_operation_key


def test_gateway_target_decisions_cover_publication_and_blocks() -> None:
    envelope = _validated_envelope()

    assert hki.evaluate_gateway_target(
        envelope,
        {"type": "tool", "id": "retrieval.search", "domain": "payments"},
    ).allowed
    assert hki.evaluate_gateway_target(
        envelope,
        {
            "type": "resource",
            "id": "published.policy",
            "domain": "authoring",
            "published_domains": ["payments"],
        },
    ).allowed
    assert not hki.evaluate_gateway_target(
        envelope,
        {"type": "tool", "id": "fraud.case_lookup", "domain": "fraud"},
    ).allowed
    assert not hki.evaluate_gateway_target(
        envelope,
        {"type": "tool", "id": "global.search", "domain": "global"},
    ).allowed
    assert not hki.evaluate_gateway_target(
        envelope,
        {
            "type": "tool",
            "id": "wildcard.search",
            "domain": "search",
            "published_domains": ["*"],
        },
    ).allowed


def test_scope_override_detection_accepts_only_matching_scope() -> None:
    envelope = _validated_envelope()

    assert hki.reject_conflicting_scope_argument(envelope, {"scope": "fraud"})
    assert hki.reject_conflicting_scope_argument(envelope, {"stream_id": "fraud"})
    assert hki.reject_conflicting_scope_argument(envelope, {"scope": ["payments", "fraud"]})
    assert hki.reject_conflicting_scope_argument(envelope, {"scope": "payments"}) is None


def test_trace_attributes_and_stable_stringify() -> None:
    envelope = _validated_envelope()
    attrs = hki.hki_trace_attributes(envelope)

    assert attrs["hki.active_domain"] == "payments"
    assert hki.stable_stringify({"b": 1, "a": [True, None, "x"]}) == '{"a":[true,null,"x"],"b":1}'
