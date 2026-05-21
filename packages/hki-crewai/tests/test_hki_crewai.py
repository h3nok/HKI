from __future__ import annotations

import types

import hki_runtime



import pytest

import hki_crewai


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


def _task(
    inputs: dict | None = None,
    context: dict | None = None,
    metadata: dict | None = None,
) -> types.SimpleNamespace:
    return types.SimpleNamespace(
        inputs=inputs or {},
        context=context or {},
        metadata=metadata or {},
    )


def test_find_envelope_on_task_locations() -> None:
    assert (
        hki_crewai.find_envelope_on_task(_task(context={"hki_envelope": VALID}))
        is VALID
    )
    assert (
        hki_crewai.find_envelope_on_task(_task(inputs={"hki_envelope": VALID}))
        is VALID
    )
    assert (
        hki_crewai.find_envelope_on_task(_task(metadata={"hki_envelope": VALID}))
        is VALID
    )
    assert hki_crewai.find_envelope_on_task(_task()) is None


def test_task_guard_requires_envelope() -> None:
    g = hki_crewai.HkiTaskGuard()
    g.assert_task_authorized(_task(context={"hki_envelope": VALID}))
    with pytest.raises(hki_crewai.HkiCrewAIDenied):
        g.assert_task_authorized(_task())


def test_task_guard_rejects_scope_override_on_inputs() -> None:
    g = hki_crewai.HkiTaskGuard()
    task: types.SimpleNamespace = _task(inputs={"scope": "pulse", "q": "hi"}, context={"hki_envelope": VALID})
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as exc:
        g.assert_task_authorized(task)
    assert exc.value.code == "scope-override"


def test_tool_wrapper_calls_inner() -> None:
    wrapped = hki_crewai.HkiToolWrapper(lambda q: f"ok:{q}", envelope=VALID)
    assert wrapped("hi") == "ok:hi"


def test_tool_wrapper_requires_envelope() -> None:
    wrapped = hki_crewai.HkiToolWrapper(lambda q: q)
    with pytest.raises(hki_crewai.HkiCrewAIDenied):
        wrapped("hi")


def test_tool_wrapper_rejects_scope_override_kwarg() -> None:
    wrapped = hki_crewai.HkiToolWrapper(lambda **kw: kw.get("q"), envelope=VALID)
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as exc:
        wrapped(scope="pulse", q="hi")
    assert exc.value.code == "scope-override"


def test_tool_wrapper_blocks_disallowed_target_domain() -> None:
    wrapped = hki_crewai.HkiToolWrapper(lambda q: q, envelope=VALID, domain="fraud")
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as exc:
        wrapped("hi")
    assert exc.value.code == "gateway-denied"


def test_tool_wrapper_wraps_basetool_like_object() -> None:
    class MyTool:
        name: str = "my_search"
        description: str = "search the index"

        def _run(self, q: str) -> str:
            return f"hit:{q}"

    wrapped = hki_crewai.HkiToolWrapper(MyTool(), envelope=VALID)
    assert wrapped.name == "my_search"
    assert wrapped.description == "search the index"
    assert wrapped._run("hi") == "hit:hi"


def test_crew_guard_detects_envelope_swap_across_tasks() -> None:
    other = {**VALID, "envelope_id": "env_other"}
    crew = types.SimpleNamespace(
        tasks=[
            _task(context={"hki_envelope": VALID}),
            _task(context={"hki_envelope": other}),
        ]
    )
    g = hki_crewai.HkiCrewGuard()
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as exc:
        g.assert_crew_authorized(crew)
    assert exc.value.code == "crew-envelope-mismatch"


def test_crew_guard_passes_when_consistent() -> None:
    crew = types.SimpleNamespace(
        tasks=[
            _task(context={"hki_envelope": VALID}),
            _task(context={"hki_envelope": VALID}),
        ]
    )
    env: hki_runtime.HkiEnvelope = hki_crewai.HkiCrewGuard().assert_crew_authorized(crew)
    assert env.envelope_id == "env_1"


def test_crew_guard_rejects_empty_crew() -> None:
    crew = types.SimpleNamespace(tasks=[])
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as exc:
        hki_crewai.HkiCrewGuard().assert_crew_authorized(crew)
    assert exc.value.code == "missing-tasks"


def test_cache_key_segregates_by_domain() -> None:
    a: str = hki_crewai.hki_cache_key(_validated("iris"), "hi", "gpt-x")
    b: str = hki_crewai.hki_cache_key(_validated("pulse"), "hi", "gpt-x")
    assert a != b


def _validated(domain: str) -> hki_runtime.HkiEnvelope:
    from hki_runtime import validate_envelope

    payload = {**VALID, "active_domain": domain, "authorized_domains": [domain]}
    res: hki_runtime.HkiValidationResult = validate_envelope(payload, require_signature=True)
    assert res.envelope is not None
    return res.envelope
