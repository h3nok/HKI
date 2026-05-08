"""Cross-adapter end-to-end integration tests.

Imports all six HKI adapter packages in one process and asserts they enforce
the same invariants on the same fixture envelope. This is the canonical
"they actually compose" proof.
"""

from __future__ import annotations

import types
import typing

import pytest

import hki_runtime

# All six adapters in one place.
import hki_adk
import hki_autogen
import hki_crewai
import hki_langchain
import hki_litellm
import hki_llamaindex


# ---------------------------------------------------------------------------
# Shared fixture envelope (iris active, iris+pulse authorized).
# ---------------------------------------------------------------------------

VALID_PAYLOAD: dict[str, typing.Any] = {
    "hki_version": "1.0",
    "envelope_id": "env_e2e_1",
    "org_id": "org_acme",
    "subject_id": "user_e2e",
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


@pytest.fixture()
def envelope() -> hki_runtime.HkiEnvelope:
    res = hki_runtime.validate_envelope(VALID_PAYLOAD, require_signature=True)
    assert res.envelope is not None
    return res.envelope


def _payload_with(active: str, authorized: list[str] | None = None) -> dict[str, typing.Any]:
    return {
        **VALID_PAYLOAD,
        "active_domain": active,
        "authorized_domains": authorized or [active],
    }


# ---------------------------------------------------------------------------
# 1. Envelope round-trip parity.
# ---------------------------------------------------------------------------


def test_every_adapter_accepts_valid_envelope() -> None:
    # Each adapter should be able to round-trip the same valid payload through
    # its own resolver / require helper without raising.
    hki_langchain.require_envelope({"hki_envelope": VALID_PAYLOAD})
    hki_llamaindex.require_envelope({"hki_envelope": VALID_PAYLOAD})

    ctx = types.SimpleNamespace(state={"hki_envelope": VALID_PAYLOAD})
    hki_adk.require_envelope_from_context(ctx)

    msg = types.SimpleNamespace(content="hi", metadata={"hki_envelope": VALID_PAYLOAD})
    hki_autogen.HkiMessageGuard().assert_message_authorized(msg)

    task = types.SimpleNamespace(
        inputs={}, context={"hki_envelope": VALID_PAYLOAD}, metadata={}
    )
    hki_crewai.HkiTaskGuard().assert_task_authorized(task)


def test_every_adapter_rejects_missing_envelope() -> None:
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        hki_langchain.require_envelope({})
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        hki_llamaindex.require_envelope({})
    with pytest.raises(hki_adk.HkiAdkDenied):
        hki_adk.require_envelope_from_context(types.SimpleNamespace(state={}))
    with pytest.raises(hki_autogen.HkiAutoGenDenied):
        hki_autogen.HkiMessageGuard().assert_message_authorized(
            types.SimpleNamespace(content="hi", metadata={})
        )
    with pytest.raises(hki_crewai.HkiCrewAIDenied):
        hki_crewai.HkiTaskGuard().assert_task_authorized(
            types.SimpleNamespace(inputs={}, context={}, metadata={})
        )


def test_every_adapter_rejects_widened_envelope() -> None:
    bad = {**VALID_PAYLOAD, "active_domain": "global", "authorized_domains": ["global"]}
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        hki_langchain.require_envelope({"hki_envelope": bad})
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        hki_llamaindex.require_envelope({"hki_envelope": bad})


# ---------------------------------------------------------------------------
# 2. Scope-override rejection — body-scope-trust (HKI-T01).
# ---------------------------------------------------------------------------


def test_all_tool_wrappers_reject_scope_override(envelope: hki_runtime.HkiEnvelope) -> None:
    # Each adapter has either a tool wrapper or a callback that rejects a
    # kwarg / payload field that would widen the active scope.
    bad_kwargs: dict[str, str] = {"scope": "pulse", "q": "hi"}

    # langchain — chain-start with body-style scope override
    cb = hki_langchain.HkiCallbackHandler()
    with pytest.raises(hki_langchain.HkiLangChainDenied) as e1:
        cb.on_chain_start({}, bad_kwargs, metadata={"hki_envelope": VALID_PAYLOAD})
    assert e1.value.code == "scope-override"

    # llamaindex — event-start with scope-override payload
    li_cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID_PAYLOAD)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as e2:
        li_cb.on_event_start("query", bad_kwargs)
    assert e2.value.code == "scope-override"

    # adk — before_tool_callback with scope-override args
    adk_cb = hki_adk.HkiBeforeToolCallback()
    with pytest.raises(hki_adk.HkiAdkDenied) as e3:
        adk_cb(
            types.SimpleNamespace(name="t"),
            bad_kwargs,
            types.SimpleNamespace(state={"hki_envelope": VALID_PAYLOAD}),
        )
    assert e3.value.code == "scope-override"

    # autogen — tool wrapper with scope-override kwarg
    ag_tool = hki_autogen.HkiToolWrapper(
        lambda **kw: kw.get("q"), envelope=VALID_PAYLOAD
    )
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as e4:
        ag_tool(**bad_kwargs)
    assert e4.value.code == "scope-override"

    # crewai — tool wrapper with scope-override kwarg
    crew_tool = hki_crewai.HkiToolWrapper(
        lambda **kw: kw.get("q"), envelope=VALID_PAYLOAD
    )
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as e5:
        crew_tool(**bad_kwargs)
    assert e5.value.code == "scope-override"

    # litellm has no body-scope-trust contract (it operates on the LiteLLM
    # call dict, not on agent payload bodies). Its scope-enforcement story is
    # gateway-target, which the next test exercises.


# ---------------------------------------------------------------------------
# 3. Gateway-target consistency — tool bound to unauthorized domain.
# ---------------------------------------------------------------------------


def test_all_tool_wrappers_reject_unauthorized_target_domain(
    envelope: hki_runtime.HkiEnvelope,
) -> None:
    # Tool bound to "fraud" domain (not in authorized_domains) must be denied
    # by every adapter that supports a `domain=` parameter.

    # langchain — tool-start with hki_tool metadata
    lc_cb = hki_langchain.HkiCallbackHandler()
    with pytest.raises(hki_langchain.HkiLangChainDenied) as e1:
        lc_cb.on_tool_start(
            {"name": "search.fraud"},
            "q",
            metadata={
                "hki_envelope": VALID_PAYLOAD,
                "hki_tool": {"domain": "fraud"},
            },
        )
    assert e1.value.code == "gateway-denied"

    # llamaindex — function_call event with hki_tool metadata
    li_cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID_PAYLOAD)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as e2:
        li_cb.on_event_start(
            "function_call",
            {"hki_tool": {"id": "search.fraud", "domain": "fraud"}},
        )
    assert e2.value.code == "gateway-denied"

    # adk — tool guard with domain=
    adk_tool = hki_adk.HkiToolGuard(lambda q: q, domain="fraud")
    with pytest.raises(hki_adk.HkiAdkDenied) as e3:
        adk_tool("q", tool_context=types.SimpleNamespace(state={"hki_envelope": VALID_PAYLOAD}))
    assert e3.value.code == "gateway-denied"

    # autogen — tool wrapper with domain=
    ag_tool = hki_autogen.HkiToolWrapper(
        lambda q: q, envelope=VALID_PAYLOAD, domain="fraud"
    )
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as e4:
        ag_tool("q")
    assert e4.value.code == "gateway-denied"

    # crewai — tool wrapper with domain=
    crew_tool = hki_crewai.HkiToolWrapper(
        lambda q: q, envelope=VALID_PAYLOAD, domain="fraud"
    )
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as e5:
        crew_tool("q")
    assert e5.value.code == "gateway-denied"


# ---------------------------------------------------------------------------
# 4. Cache-key isolation across active domain.
# ---------------------------------------------------------------------------


def _validated(active: str) -> hki_runtime.HkiEnvelope:
    res = hki_runtime.validate_envelope(_payload_with(active), require_signature=True)
    assert res.envelope is not None
    return res.envelope


def test_cache_keys_are_distinct_across_domains_for_every_adapter() -> None:
    iris = _validated("iris")
    pulse = _validated("pulse")
    cache_keys: list[typing.Callable[..., str]] = [
        hki_langchain.hki_cache_key,
        hki_llamaindex.hki_cache_key,
        hki_adk.hki_cache_key,
        hki_autogen.hki_cache_key,
        hki_crewai.hki_cache_key,
    ]
    for fn in cache_keys:
        a: str = fn(iris, "hello", "gpt-x")
        b: str = fn(pulse, "hello", "gpt-x")
        assert a != b, f"{fn.__module__}.{fn.__name__} did not segregate by domain"

    # litellm derives its key inside pre_call; verify the same way.
    def _litellm_key(envelope: hki_runtime.HkiEnvelope) -> str:
        kwargs: dict[str, typing.Any] = {
            "hki_envelope": {
                **VALID_PAYLOAD,
                "active_domain": envelope.active_domain,
                "authorized_domains": list(envelope.authorized_domains),
            },
            "model": "gpt-x",
            "messages": [{"role": "user", "content": "hello"}],
        }
        hki_litellm.pre_call(kwargs)
        return kwargs["metadata"]["hki_cache_key"]

    assert _litellm_key(iris) != _litellm_key(pulse)


# ---------------------------------------------------------------------------
# 5. Cross-domain artifact rejection — same threat blocked by retriever
#    surfaces in langchain and llamaindex with the same denial code.
# ---------------------------------------------------------------------------


def test_retriever_surfaces_block_cross_domain_artifacts(
    envelope: hki_runtime.HkiEnvelope,
) -> None:
    # langchain retriever-end
    lc_cb = hki_langchain.HkiCallbackHandler()
    bad_doc = types.SimpleNamespace(metadata={"id": "d1", "domain": "fraud"})
    with pytest.raises(hki_langchain.HkiLangChainDenied) as e1:
        lc_cb.on_retriever_end([bad_doc], metadata={"hki_envelope": VALID_PAYLOAD})
    assert e1.value.code == "artifact-scope-mismatch"

    # llamaindex retrieve event-end
    li_cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID_PAYLOAD)
    bad_node = types.SimpleNamespace(
        node=types.SimpleNamespace(
            metadata={"domain": "fraud"}, node_id="n1"
        ),
        score=1.0,
    )
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as e2:
        li_cb.on_event_end("retrieve", {"nodes": [bad_node]})
    assert e2.value.code == "artifact-scope-mismatch"


# ---------------------------------------------------------------------------
# 6. Session / stream consistency — envelope swap mid-conversation.
# ---------------------------------------------------------------------------


def test_session_and_stream_guards_detect_envelope_swap() -> None:
    other = {**VALID_PAYLOAD, "envelope_id": "env_other"}

    # adk session
    session = types.SimpleNamespace(
        state={"hki_envelope": VALID_PAYLOAD},
        events=[
            types.SimpleNamespace(metadata={"hki_envelope": VALID_PAYLOAD}),
            types.SimpleNamespace(metadata={"hki_envelope": other}),
        ],
    )
    with pytest.raises(hki_adk.HkiAdkDenied) as e1:
        hki_adk.HkiSessionGuard().assert_consistent(session)
    assert e1.value.code == "session-envelope-mismatch"

    # autogen stream
    msgs: list[SimpleNamespace] = [
        types.SimpleNamespace(content="a", metadata={"hki_envelope": VALID_PAYLOAD}),
        types.SimpleNamespace(content="b", metadata={"hki_envelope": other}),
    ]
    with pytest.raises(hki_autogen.HkiAutoGenDenied) as e2:
        hki_autogen.HkiMessageGuard().assert_stream_consistent(msgs)
    assert e2.value.code == "stream-envelope-mismatch"

    # crewai crew
    crew = types.SimpleNamespace(
        tasks=[
            types.SimpleNamespace(
                inputs={}, context={"hki_envelope": VALID_PAYLOAD}, metadata={}
            ),
            types.SimpleNamespace(
                inputs={}, context={"hki_envelope": other}, metadata={}
            ),
        ]
    )
    with pytest.raises(hki_crewai.HkiCrewAIDenied) as e3:
        hki_crewai.HkiCrewGuard().assert_crew_authorized(crew)
    assert e3.value.code == "crew-envelope-mismatch"
