from __future__ import annotations

import types
import typing

import pytest

import hki_autogen


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


def _msg(content: typing.Any = "hi", metadata: dict | None = None) -> types.SimpleNamespace:
    return types.SimpleNamespace(content=content, metadata=metadata or {})


def test_find_envelope_on_message_locations() -> None:
    assert (
        hki_autogen.find_envelope_on_message(_msg(metadata={"hki_envelope": VALID}))
        is VALID
    )
    assert (
        hki_autogen.find_envelope_on_message({"metadata": {"hki_envelope": VALID}})
        is VALID
    )
    assert hki_autogen.find_envelope_on_message(_msg()) is None


def test_message_guard_requires_envelope() -> None:
    g = hki_autogen.HkiMessageGuard()
    g.assert_message_authorized(_msg(metadata={"hki_envelope": VALID}))
    with pytest.raises(hki_autogen.HkiAutoGenDenied):
        g.assert_message_authorized(_msg())


def test_message_guard_rejects_scope_override_in_content() -> None:
    g = hki_autogen.HkiMessageGuard()
    msg: types.SimpleNamespace = _msg(content={"scope": "pulse", "q": "hi"}, metadata={"hki_envelope": VALID})
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as exc:
        g.assert_message_authorized(msg)
    assert exc.value.code == "scope-override"


def test_message_guard_stream_consistent_detects_envelope_swap() -> None:
    g = hki_autogen.HkiMessageGuard()
    other = {**VALID, "envelope_id": "env_other"}
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as exc:
        g.assert_stream_consistent(
            [
                _msg(metadata={"hki_envelope": VALID}),
                _msg(metadata={"hki_envelope": other}),
            ]
        )
    assert exc.value.code == "stream-envelope-mismatch"


def test_message_guard_stream_rejects_empty() -> None:
    g = hki_autogen.HkiMessageGuard()
    with pytest.raises(hki_autogen.HkiAutoGenDenied):
        g.assert_stream_consistent([])


def test_tool_wrapper_calls_inner() -> None:
    wrapped = hki_autogen.HkiToolWrapper(lambda q: f"ok:{q}", envelope=VALID)
    assert wrapped("hi") == "ok:hi"


def test_tool_wrapper_requires_envelope() -> None:
    wrapped = hki_autogen.HkiToolWrapper(lambda q: q)
    with pytest.raises(hki_autogen.HkiAutoGenDenied):
        wrapped("hi")


def test_tool_wrapper_rejects_scope_override_kwarg() -> None:
    def tool(*, scope: str = "x", q: str = "") -> str:
        return q

    wrapped = hki_autogen.HkiToolWrapper(tool, envelope=VALID)
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as exc:
        wrapped(scope="pulse", q="hi")
    assert exc.value.code == "scope-override"


def test_tool_wrapper_blocks_disallowed_target_domain() -> None:
    wrapped = hki_autogen.HkiToolWrapper(lambda q: q, envelope=VALID, domain="fraud")
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as exc:
        wrapped("hi")
    assert exc.value.code == "gateway-denied"


def test_tool_wrapper_per_call_envelope_overrides_default() -> None:
    other = {**VALID, "active_domain": "pulse", "authorized_domains": ["pulse"]}
    wrapped = hki_autogen.HkiToolWrapper(lambda q: q, envelope=VALID)
    # other envelope is valid; should accept and run.
    assert wrapped("hi", hki_envelope=other) == "hi"


def test_agent_mixin_guards_message_stream() -> None:
    class MyAgent(hki_autogen.HkiAgentMixin):
        pass

    a = MyAgent()
    env = a._hki_guard_messages(
        [_msg(metadata={"hki_envelope": VALID})]
    )
    assert env.envelope_id == "env_1"


def test_cache_key_segregates_by_domain() -> None:
    a: str = hki_autogen.hki_cache_key(_validated("iris"), "hi", "gpt-x")
    b: str = hki_autogen.hki_cache_key(_validated("pulse"), "hi", "gpt-x")
    assert a != b


def _validated(domain: str):
    from hki_runtime import validate_envelope

    payload = {**VALID, "active_domain": domain, "authorized_domains": [domain]}
    res = validate_envelope(payload, require_signature=True)
    assert res.envelope is not None
    return res.envelope
