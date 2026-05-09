"""M4 schema freeze tests — Pydantic v2 models and backward-compatibility.

Any change that makes a previously-valid envelope invalid, or a previously-invalid
envelope valid, is a breaking change requiring a new version identifier.
"""

from __future__ import annotations

import pytest

pytest.importorskip("pydantic", reason="pydantic not installed")

from pydantic import ValidationError  # noqa: E402

from hki_runtime.pydantic import (  # noqa: E402
    HkiArtifactLabelModel,
    HkiEnvelopeModel,
    HkiGatewayTargetModel,
)

NOW = 1_777_900_000

VALID_ENVELOPE = {
    "hki_version": "1.0",
    "envelope_id": "env_compat_01",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "payments",
    "authorized_domains": ["payments", "fraud"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "policy_2026_05",
    "issued_at": NOW,
    "expires_at": NOW + 300,
    "issuer": "urn:hki:gateway",
    "signature": "sig_conformance",
}


# ---------------------------------------------------------------------------
# HkiEnvelopeModel — backward-compat
# ---------------------------------------------------------------------------

class TestHkiEnvelopeModel:
    def test_accepts_canonical_fixture(self):
        env = HkiEnvelopeModel.model_validate(VALID_ENVELOPE)
        assert env.hki_version == "1.0"
        assert env.active_domain == "payments"
        assert "payments" in env.authorized_domains

    def test_accepts_without_signature(self):
        data = {k: v for k, v in VALID_ENVELOPE.items() if k != "signature"}
        env = HkiEnvelopeModel.model_validate(data)
        assert env.signature is None

    def test_rejects_wrong_version(self):
        with pytest.raises(ValidationError, match="hki_version"):
            HkiEnvelopeModel.model_validate({**VALID_ENVELOPE, "hki_version": "0.9"})

    def test_rejects_global_active_domain(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "active_domain": "global",
                "authorized_domains": ["global"],
            })

    def test_rejects_wildcard_active_domain(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "active_domain": "*",
                "authorized_domains": ["*"],
            })

    def test_rejects_global_in_authorized_domains(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "authorized_domains": ["payments", "global"],
            })

    def test_rejects_empty_authorized_domains(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "authorized_domains": [],
            })

    def test_rejects_duplicate_authorized_domains(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "authorized_domains": ["payments", "payments"],
            })

    def test_rejects_active_domain_not_in_authorized(self):
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate({
                **VALID_ENVELOPE,
                "active_domain": "legal",
                "authorized_domains": ["payments"],
            })

    def test_rejects_missing_required_field(self):
        data = {k: v for k, v in VALID_ENVELOPE.items() if k != "org_id"}
        with pytest.raises(ValidationError):
            HkiEnvelopeModel.model_validate(data)

    def test_envelope_is_frozen(self):
        env = HkiEnvelopeModel.model_validate(VALID_ENVELOPE)
        with pytest.raises(Exception):  # ValidationError or AttributeError
            env.active_domain = "hr"  # type: ignore[misc]

    def test_model_dump_round_trips(self):
        env = HkiEnvelopeModel.model_validate(VALID_ENVELOPE)
        dumped = env.model_dump()
        env2 = HkiEnvelopeModel.model_validate(dumped)
        assert env2.envelope_id == env.envelope_id


# ---------------------------------------------------------------------------
# HkiArtifactLabelModel
# ---------------------------------------------------------------------------

class TestHkiArtifactLabelModel:
    VALID = {
        "org_id": "org_acme",
        "domain": "payments",
        "artifact_type": "document",
        "artifact_id": "doc_policy_001",
    }

    def test_accepts_valid_label(self):
        label = HkiArtifactLabelModel.model_validate(self.VALID)
        assert label.domain == "payments"

    def test_accepts_optional_provenance(self):
        label = HkiArtifactLabelModel.model_validate({
            **self.VALID, "provenance_id": "prov_abc"
        })
        assert label.provenance_id == "prov_abc"

    def test_rejects_global_domain(self):
        with pytest.raises(ValidationError):
            HkiArtifactLabelModel.model_validate({**self.VALID, "domain": "global"})

    def test_rejects_wildcard_domain(self):
        with pytest.raises(ValidationError):
            HkiArtifactLabelModel.model_validate({**self.VALID, "domain": "*"})


# ---------------------------------------------------------------------------
# HkiGatewayTargetModel
# ---------------------------------------------------------------------------

class TestHkiGatewayTargetModel:
    VALID = {
        "type": "tool",
        "id": "retrieval.search",
        "domain": "payments",
    }

    def test_accepts_valid_target(self):
        target = HkiGatewayTargetModel.model_validate(self.VALID)
        assert target.type == "tool"

    def test_accepts_published_domains(self):
        target = HkiGatewayTargetModel.model_validate({
            **self.VALID, "published_domains": ["finance", "audit"]
        })
        assert "finance" in target.published_domains

    def test_defaults_published_domains_to_empty(self):
        target = HkiGatewayTargetModel.model_validate(self.VALID)
        assert target.published_domains == ()
