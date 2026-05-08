from __future__ import annotations

import pytest

import hki_litellm


VALID_ENVELOPE = {
    "hki_version": "1.0",
    "envelope_id": "env_1",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "iris",
    "authorized_domains": ["iris", "pulse"],
    "purpose": "chat",
    "risk_tier": "read-only",
    "policy_pack_id": "p1",
    "issued_at": 0,
    "expires_at": 99999999999,
    "issuer": "edge",
    "signature": "sig",
}


def _kwargs(**overrides) -> dict:
    base = {
        "model": "vertex_ai/gemini-2.5-flash",
        "messages": [{"role": "user", "content": "hi"}],
        "metadata": {"hki_envelope": VALID_ENVELOPE},
    }
    base.update(overrides)
    return base


def test_pre_call_attaches_cache_key_and_attrs() -> None:
    kwargs = _kwargs()
    envelope = hki_litellm.pre_call(kwargs)
    assert envelope.active_domain == "iris"
    assert "hki_cache_key" in kwargs["metadata"]
    assert ":org_acme:" in kwargs["metadata"]["hki_cache_key"]
    assert ":iris:" in kwargs["metadata"]["hki_cache_key"]
    assert kwargs["metadata"]["hki_attributes"]["hki.active_domain"] == "iris"
    assert kwargs["cache"]["hki_key"] == kwargs["metadata"]["hki_cache_key"]


def test_pre_call_rejects_missing_envelope() -> None:
    kwargs = {"model": "x", "messages": []}
    with pytest.raises(hki_litellm.HkiGatewayDenied) as exc:
        hki_litellm.pre_call(kwargs)
    assert exc.value.code == "missing-envelope"


def test_pre_call_rejects_global_active_domain() -> None:
    bad = {**VALID_ENVELOPE, "active_domain": "global", "authorized_domains": ["global"]}
    kwargs = _kwargs(metadata={"hki_envelope": bad})
    with pytest.raises(hki_litellm.HkiGatewayDenied) as exc:
        hki_litellm.pre_call(kwargs)
    assert exc.value.code == "envelope-invalid"


def test_pre_call_rejects_unbound_model_domain() -> None:
    kwargs = _kwargs(
        metadata={
            "hki_envelope": VALID_ENVELOPE,
            "hki_model_domain": "fraud",  # different from active domain, not published
        }
    )
    with pytest.raises(hki_litellm.HkiGatewayDenied) as exc:
        hki_litellm.pre_call(kwargs)
    assert exc.value.code == "gateway-denied"


def test_pre_call_allows_published_model() -> None:
    kwargs = _kwargs(
        metadata={
            "hki_envelope": VALID_ENVELOPE,
            "hki_model_domain": "shared",
            "hki_model_publishes": ["iris"],
        }
    )
    hki_litellm.pre_call(kwargs)  # must not raise


def test_pre_call_distinct_cache_keys_per_domain() -> None:
    iris = _kwargs()
    pulse_env = {**VALID_ENVELOPE, "active_domain": "pulse"}
    pulse = _kwargs(metadata={"hki_envelope": pulse_env})
    hki_litellm.pre_call(iris)
    hki_litellm.pre_call(pulse)
    assert iris["metadata"]["hki_cache_key"] != pulse["metadata"]["hki_cache_key"]


def test_callback_log_pre_raises_on_missing_envelope() -> None:
    cb = hki_litellm.HkiLiteLLMCallback()
    with pytest.raises(hki_litellm.HkiGatewayDenied):
        cb.log_pre_api_call("m", [], {"model": "m"})
