"""HKI end-to-end demo.

A single runnable script that walks an HKI envelope through every adapter
shipped in this repo. Demonstrates both the **happy path** (an authorized
operation succeeds) and the **denied path** (an unauthorized operation
fails closed with a structured denial code).

Run from repo root::

    uv run --project packages/hki-integration-tests \\
        python examples/end_to_end_demo.py

This script writes nothing and makes no network calls. Every adapter is
exercised on stub objects so the demo is hermetic.
"""

from __future__ import annotations

import types
import typing

import hki_runtime

import hki_adk
import hki_autogen
import hki_crewai
import hki_langchain
import hki_litellm
import hki_llamaindex


VALID_ENVELOPE: dict[str, typing.Any] = {
    "hki_version": "1.0",
    "envelope_id": "env_demo_1",
    "org_id": "org_acme",
    "subject_id": "user_demo",
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


def _ok(label: str, msg: str = "allowed") -> None:
    print(f"  \u2713 {label:<48s} {msg}")


def _denied(label: str, code: str, message: str) -> None:
    print(f"  \u2717 {label:<48s} denied [{code}] {message[:60]}")


def section(title: str) -> None:
    bar: str = "=" * len(title)
    print(f"\n{bar}\n{title}\n{bar}")


def demo_runtime() -> hki_runtime.HkiEnvelope:
    section("hki-runtime: validate the signed envelope")
    res = hki_runtime.validate_envelope(VALID_ENVELOPE, require_signature=True)
    assert res.envelope is not None
    env = res.envelope
    _ok("validate_envelope", f"active_domain={env.active_domain}")
    return env


def demo_litellm(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-litellm: gate every model call")
    kwargs: dict[str, typing.Any] = {
        "hki_envelope": VALID_ENVELOPE,
        "model": "openai/gpt-4o",
        "messages": [{"role": "user", "content": "hi"}],
    }
    hki_litellm.pre_call(kwargs)
    _ok("pre_call(model=openai/gpt-4o)", f"cache_key={kwargs['metadata']['hki_cache_key'][:24]}\u2026")


def demo_langchain(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-langchain: callback handler + retriever")
    cb = hki_langchain.HkiCallbackHandler()
    cb.on_chain_start({}, {"q": "hi"}, metadata={"hki_envelope": VALID_ENVELOPE})
    _ok("on_chain_start (clean inputs)")

    try:
        cb.on_chain_start(
            {}, {"scope": "pulse", "q": "hi"},
            metadata={"hki_envelope": VALID_ENVELOPE},
        )
    except hki_langchain.HkiLangChainDenied as e:
        _denied("on_chain_start (scope override)", e.code, e.message)


def demo_llamaindex(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-llamaindex: callback + retriever")
    cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID_ENVELOPE)
    cb.on_event_start("query", {"q": "hi"})
    _ok("on_event_start (clean payload)")

    try:
        cb.on_event_start("query", {"scope": "pulse", "q": "hi"})
    except hki_llamaindex.HkiLlamaIndexDenied as e:
        _denied("on_event_start (scope override)", e.code, e.message)


def demo_adk(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-adk: tool guard + before_agent_callback")

    def my_search(q: str) -> str:
        return f"[stub-result for {q!r}]"

    safe = hki_adk.HkiToolGuard(my_search)
    out = safe(
        "vendor onboarding",
        tool_context=types.SimpleNamespace(state={"hki_envelope": VALID_ENVELOPE}),
    )
    _ok("HkiToolGuard.call (authorized)", out)

    bound_to_fraud = hki_adk.HkiToolGuard(my_search, domain="fraud")
    try:
        bound_to_fraud(
            "vendor onboarding",
            tool_context=types.SimpleNamespace(state={"hki_envelope": VALID_ENVELOPE}),
        )
    except hki_adk.HkiAdkDenied as e:
        _denied("HkiToolGuard (tool bound to fraud)", e.code, e.message)


def demo_autogen(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-autogen: message guard + tool wrapper")
    g = hki_autogen.HkiMessageGuard()
    msg = types.SimpleNamespace(content="hi", metadata={"hki_envelope": VALID_ENVELOPE})
    g.assert_message_authorized(msg)
    _ok("assert_message_authorized")

    bad_msg = types.SimpleNamespace(
        content={"scope": "pulse", "q": "hi"},
        metadata={"hki_envelope": VALID_ENVELOPE},
    )
    try:
        g.assert_message_authorized(bad_msg)
    except hki_autogen.HkiAutoGenDenied as e:
        _denied("assert_message_authorized (scope override)", e.code, e.message)


def demo_crewai(env: hki_runtime.HkiEnvelope) -> None:
    section("hki-crewai: task guard + crew guard")
    g = hki_crewai.HkiTaskGuard()
    task = types.SimpleNamespace(
        inputs={"topic": "vendor onboarding"},
        context={"hki_envelope": VALID_ENVELOPE},
        metadata={},
    )
    g.assert_task_authorized(task)
    _ok("assert_task_authorized")

    crew = types.SimpleNamespace(
        tasks=[
            task,
            types.SimpleNamespace(
                inputs={},
                context={"hki_envelope": {**VALID_ENVELOPE, "envelope_id": "env_other"}},
                metadata={},
            ),
        ]
    )
    try:
        hki_crewai.HkiCrewGuard().assert_crew_authorized(crew)
    except hki_crewai.HkiCrewAIDenied as e:
        _denied("HkiCrewGuard (envelope swap mid-crew)", e.code, e.message)


def main() -> int:
    env = demo_runtime()
    demo_litellm(env)
    demo_langchain(env)
    demo_llamaindex(env)
    demo_adk(env)
    demo_autogen(env)
    demo_crewai(env)
    print("\nAll six adapters exercised end-to-end. Happy-path allowed, threats denied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
