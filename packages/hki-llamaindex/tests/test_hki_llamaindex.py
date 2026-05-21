from __future__ import annotations

import types
import typing

from hki_runtime import HkiEnvelope

from hki_runtime import HkiValidationResult

import pytest

import hki_llamaindex


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


def _node(metadata: dict, node_id: str = "n") -> types.SimpleNamespace:
    node = types.SimpleNamespace(metadata=metadata, node_id=node_id)
    return types.SimpleNamespace(node=node, score=1.0)


def test_find_envelope_locates_in_payload_and_metadata() -> None:
    assert hki_llamaindex.find_envelope({"hki_envelope": VALID}) is VALID
    assert hki_llamaindex.find_envelope({"metadata": {"hki_envelope": VALID}}) is VALID
    assert hki_llamaindex.find_envelope({"extra_info": {"hki_envelope": VALID}}) is VALID
    assert hki_llamaindex.find_envelope({}) is None


def test_require_envelope_rejects_invalid() -> None:
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        hki_llamaindex.require_envelope({})
    bad = {**VALID, "active_domain": "global", "authorized_domains": ["global"]}
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        hki_llamaindex.require_envelope({"hki_envelope": bad})


def test_callback_event_start_enforces_envelope() -> None:
    cb = hki_llamaindex.HkiCallbackHandler()
    cb.on_event_start("llm", {"hki_envelope": VALID})
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        cb.on_event_start("llm", {})


def test_callback_uses_default_envelope_when_set() -> None:
    cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID)
    # No envelope on payload — falls back to constructor envelope.
    cb.on_event_start("llm", {})


def test_callback_rejects_scope_override() -> None:
    cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as exc:
        cb.on_event_start("query", {"scope": "pulse", "q": "hi"})
    assert exc.value.code == "scope-override"


def test_callback_event_end_blocks_unlabeled_and_cross_domain_nodes() -> None:
    cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as exc:
        cb.on_event_end("retrieve", {"nodes": [_node({"domain": "pulse"}, "p1")]})
    assert exc.value.code == "artifact-scope-mismatch"

    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as exc:
        cb.on_event_end("retrieve", {"nodes": [_node({}, "x")]})
    assert exc.value.code == "missing-domain"

    cb.on_event_end("retrieve", {"nodes": [_node({"domain": "iris"}, "i1")]})


def test_callback_tool_event_enforces_target_domain() -> None:
    cb = hki_llamaindex.HkiCallbackHandler(envelope=VALID)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as exc:
        cb.on_event_start(
            "function_call",
            {"hki_tool": {"id": "search.fraud", "domain": "fraud"}},
        )
    assert exc.value.code == "gateway-denied"


class _FakeRetriever:
    def __init__(self, items: list[typing.Any]) -> None:
        self._items: list[Any] = items

    def retrieve(self, query: typing.Any) -> list[typing.Any]:
        return self._items

    async def aretrieve(self, query: typing.Any) -> list[typing.Any]:
        return self._items


def test_hki_retriever_filters_to_active_domain() -> None:
    items: list[SimpleNamespace] = [
        _node({"domain": "iris"}, "i1"),
        _node({"domain": "pulse"}, "p1"),
        _node({}, "x"),
    ]
    retriever = hki_llamaindex.HkiRetriever(_FakeRetriever(items), envelope=VALID)
    out: list[Any] = retriever.retrieve("q")
    assert [item.node.node_id for item in out] == ["i1"]


def test_hki_retriever_requires_envelope() -> None:
    retriever = hki_llamaindex.HkiRetriever(_FakeRetriever([]))
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied):
        retriever.retrieve("q")


def test_hki_query_engine_blocks_cross_domain_source_nodes() -> None:
    response = types.SimpleNamespace(
        source_nodes=[_node({"domain": "pulse"}, "p1")],
    )

    class _QE:
        def query(self, q: typing.Any) -> typing.Any:
            return response

    qe = hki_llamaindex.HkiQueryEngine(_QE(), envelope=VALID)
    with pytest.raises(hki_llamaindex.HkiLlamaIndexDenied) as exc:
        qe.query("q")
    assert exc.value.code == "artifact-scope-mismatch"


def test_cache_key_segregates_by_domain() -> None:
    a: str = hki_llamaindex.hki_cache_key(_validated("iris"), "hi", "gpt-x")
    b: str = hki_llamaindex.hki_cache_key(_validated("pulse"), "hi", "gpt-x")
    assert a != b


def _validated(domain: str) -> HkiEnvelope:
    from hki_runtime import validate_envelope

    payload = {**VALID, "active_domain": domain, "authorized_domains": [domain]}
    res: HkiValidationResult = validate_envelope(payload, require_signature=True)
    assert res.envelope is not None
    return res.envelope
