from __future__ import annotations

import types

from hki_runtime import HkiEnvelope

from hki_runtime import HkiValidationResult

import pytest

import hki_adk


VALID = {
    "hki_version": "1.0",
    "envelope_id": "env_1",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "iris",
    "authorized_domains": ["iris", "pulse"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "p1",
    "issued_at": 0,
    "expires_at": 99999999999,
    "issuer": "edge",
    "signature": "sig",
}


def _ctx(state: dict | None = None) -> types.SimpleNamespace:
    return types.SimpleNamespace(state=state or {})


def _ctx_with_session(state: dict) -> types.SimpleNamespace:
    return types.SimpleNamespace(
        state={}, session=types.SimpleNamespace(state=state)
    )


def test_find_envelope_in_context_locations() -> None:
    assert hki_adk.find_envelope_in_context(_ctx({"hki_envelope": VALID})) is VALID
    assert (
        hki_adk.find_envelope_in_context(_ctx_with_session({"hki_envelope": VALID}))
        is VALID
    )
    assert hki_adk.find_envelope_in_context(_ctx()) is None


def test_require_envelope_rejects_invalid() -> None:
    with pytest.raises(hki_adk.HkiAdkDenied):
        hki_adk.require_envelope_from_context(_ctx())
    bad = {**VALID, "active_domain": "global", "authorized_domains": ["global"]}
    with pytest.raises(hki_adk.HkiAdkDenied):
        hki_adk.require_envelope_from_context(_ctx({"hki_envelope": bad}))


def test_tool_guard_calls_inner_and_returns_value() -> None:
    def my_tool(query: str) -> str:
        return f"ok:{query}"

    guard = hki_adk.HkiToolGuard(my_tool)
    out = guard("hello", tool_context=_ctx({"hki_envelope": VALID}))
    assert out == "ok:hello"


def test_tool_guard_requires_envelope() -> None:
    guard = hki_adk.HkiToolGuard(lambda q: q)
    with pytest.raises(hki_adk.HkiAdkDenied):
        guard("hi", tool_context=_ctx())


def test_tool_guard_rejects_scope_override_kwarg() -> None:
    def tool(*, scope: str = "x", q: str = "") -> str:
        return q

    guard = hki_adk.HkiToolGuard(tool)
    with pytest.raises(hki_adk.HkiAdkDenied) as exc:
        guard(scope="pulse", q="hi", tool_context=_ctx({"hki_envelope": VALID}))
    assert exc.value.code == "scope-override"


def test_tool_guard_blocks_disallowed_target_domain() -> None:
    guard = hki_adk.HkiToolGuard(lambda q: q, domain="fraud")
    with pytest.raises(hki_adk.HkiAdkDenied) as exc:
        guard("hi", tool_context=_ctx({"hki_envelope": VALID}))
    assert exc.value.code == "gateway-denied"


def test_tool_guard_preserves_name_and_doc() -> None:
    def my_tool(q: str) -> str:
        """do a thing"""
        return q

    guard = hki_adk.HkiToolGuard(my_tool)
    assert guard.__name__ == "my_tool"
    assert guard.__doc__ == "do a thing"
    assert "q" in str(guard.__signature__)


def test_before_agent_callback_requires_envelope() -> None:
    cb = hki_adk.HkiBeforeAgentCallback()
    cb(_ctx({"hki_envelope": VALID}))
    with pytest.raises(hki_adk.HkiAdkDenied):
        cb(_ctx())


def test_before_tool_callback_rejects_scope_override_in_args() -> None:
    cb = hki_adk.HkiBeforeToolCallback()
    cb(types.SimpleNamespace(name="t"), {"q": "hi"}, _ctx({"hki_envelope": VALID}))
    with pytest.raises(hki_adk.HkiAdkDenied) as exc:
        cb(
            types.SimpleNamespace(name="t"),
            {"scope": "pulse"},
            _ctx({"hki_envelope": VALID}),
        )
    assert exc.value.code == "scope-override"


def test_session_guard_detects_mismatched_envelope() -> None:
    other = {**VALID, "envelope_id": "env_other"}
    session = types.SimpleNamespace(
        state={"hki_envelope": VALID},
        events=[
            types.SimpleNamespace(metadata={"hki_envelope": VALID}),
            types.SimpleNamespace(metadata={"hki_envelope": other}),
        ],
    )
    guard = hki_adk.HkiSessionGuard()
    with pytest.raises(hki_adk.HkiAdkDenied) as exc:
        guard.assert_consistent(session)
    assert exc.value.code == "session-envelope-mismatch"


def test_cache_key_segregates_by_domain() -> None:
    a: str = hki_adk.hki_cache_key(_validated("iris"), "hi", "gemini-x")
    b: str = hki_adk.hki_cache_key(_validated("pulse"), "hi", "gemini-x")
    assert a != b


def _validated(domain: str) -> HkiEnvelope:
    from hki_runtime import validate_envelope

    payload = {**VALID, "active_domain": domain, "authorized_domains": [domain]}
    res: HkiValidationResult = validate_envelope(payload, require_signature=True)
    assert res.envelope is not None
    return res.envelope
