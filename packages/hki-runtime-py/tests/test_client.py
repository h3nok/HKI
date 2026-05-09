"""Tests for hki_runtime.client — mint_envelope, verify_envelope, with_domain."""

from __future__ import annotations

import json
import time

import pytest

import hki_runtime
from hki_runtime.client import (
    HKI_ENVELOPE_HEADER,
    envelope_headers,
    mint_envelope,
    verify_envelope,
    with_domain,
)

NOW = int(time.time())


def _base_opts(**overrides) -> dict:
    return {
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": "payments",
        "purpose": "retrieve",
        "risk_tier": "read-only",
        "policy_pack_id": "pp_v1",
        "issuer": "urn:hki:gateway",
        "signature": "sig_test",
        "issued_at": NOW,
        "ttl": 300,
        **overrides,
    }


class TestMintEnvelope:
    def test_returns_valid_envelope(self):
        env = mint_envelope(**_base_opts())
        assert env.hki_version == "1.0"
        assert env.active_domain == "payments"

    def test_defaults_authorized_to_active(self):
        env = mint_envelope(**_base_opts())
        assert "payments" in env.authorized_domains

    def test_accepts_explicit_authorized_domains(self):
        env = mint_envelope(**_base_opts(authorized_domains=["payments", "fraud"]))
        assert "fraud" in env.authorized_domains

    def test_raises_on_global_domain(self):
        with pytest.raises(ValueError, match="mint_envelope"):
            mint_envelope(**_base_opts(active_domain="global", authorized_domains=["global"]))

    def test_generates_unique_ids(self):
        e1 = mint_envelope(**_base_opts())
        e2 = mint_envelope(**_base_opts())
        assert e1.envelope_id != e2.envelope_id


class TestVerifyEnvelope:
    def _raw(self, **overrides) -> dict:
        env = mint_envelope(**_base_opts())
        import dataclasses
        d = dataclasses.asdict(env)
        d.update(overrides)
        return d

    def test_returns_envelope_on_valid_input(self):
        env = verify_envelope(self._raw(), require_signature=True, now=NOW + 1)
        assert env.active_domain == "payments"

    def test_raises_on_empty_dict(self):
        with pytest.raises(ValueError, match="verify_envelope"):
            verify_envelope({}, require_signature=True)

    def test_raises_on_expired(self):
        raw = self._raw()
        raw["expires_at"] = NOW - 1
        with pytest.raises(ValueError, match="verify_envelope"):
            verify_envelope(raw, require_signature=True, now=NOW + 1)

    def test_raises_on_missing_signature(self):
        raw = self._raw()
        raw["signature"] = None
        with pytest.raises(ValueError, match="verify_envelope"):
            verify_envelope(raw, require_signature=True, now=NOW + 1)


class TestEnvelopeHeaders:
    def test_returns_header_dict(self):
        env = mint_envelope(**_base_opts())
        headers = envelope_headers(env)
        assert HKI_ENVELOPE_HEADER in headers
        payload = json.loads(headers[HKI_ENVELOPE_HEADER])
        assert payload["active_domain"] == "payments"


class TestWithDomain:
    def _make_envelope(self, domain: str) -> hki_runtime.HkiEnvelope:
        return mint_envelope(**_base_opts(active_domain=domain, authorized_domains=[domain]))

    def test_calls_handler_on_matching_domain(self):
        @with_domain("payments")
        def handler(envelope: hki_runtime.HkiEnvelope, amount: float) -> str:
            return f"ok {amount}"

        env = self._make_envelope("payments")
        assert handler(env, 99.0) == "ok 99.0"

    def test_raises_on_wrong_domain(self):
        @with_domain("payments")
        def handler(envelope: hki_runtime.HkiEnvelope) -> str:
            return "ok"

        hr_env = self._make_envelope("hr")
        with pytest.raises(PermissionError, match="payments"):
            handler(hr_env)

    def test_is_case_insensitive(self):
        @with_domain("payments")
        def handler(envelope: hki_runtime.HkiEnvelope) -> str:
            return "ok"

        env = mint_envelope(**_base_opts(active_domain="Payments", authorized_domains=["Payments"]))
        assert handler(env) == "ok"

    def test_raises_on_global_domain(self):
        with pytest.raises(ValueError, match="with_domain"):
            with_domain("global")

    def test_raises_on_wildcard_domain(self):
        with pytest.raises(ValueError, match="with_domain"):
            with_domain("*")

    def test_preserves_function_name(self):
        @with_domain("payments")
        def process_refund(envelope: hki_runtime.HkiEnvelope) -> str:
            return "ok"

        assert process_refund.__name__ == "process_refund"
