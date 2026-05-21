from __future__ import annotations

import types
import typing

from hki_runtime import HkiEnvelope

from hki_runtime import HkiValidationResult

import pytest

import hki_langchain


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


def _doc(metadata: dict, content: str = "x") -> types.SimpleNamespace:
    return types.SimpleNamespace(page_content=content, metadata=metadata)


def test_find_envelope_locates_in_metadata_or_configurable() -> None:
    assert hki_langchain.find_envelope({"metadata": {"hki_envelope": VALID}}) is VALID
    assert hki_langchain.find_envelope({"configurable": {"hki_envelope": VALID}}) is VALID
    assert hki_langchain.find_envelope({"hki_envelope": VALID}) is VALID
    assert hki_langchain.find_envelope({}) is None


def test_require_envelope_rejects_invalid() -> None:
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        hki_langchain.require_envelope({})
    bad = {**VALID, "active_domain": "global", "authorized_domains": ["global"]}
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        hki_langchain.require_envelope({"hki_envelope": bad})


def test_callback_chain_start_enforces_envelope() -> None:
    cb = hki_langchain.HkiCallbackHandler()
    cb.on_chain_start({}, {"q": "hi"}, metadata={"hki_envelope": VALID})

    with pytest.raises(hki_langchain.HkiLangChainDenied):
        cb.on_chain_start({}, {"q": "hi"})


def test_callback_chain_start_rejects_scope_override() -> None:
    cb = hki_langchain.HkiCallbackHandler()
    with pytest.raises(hki_langchain.HkiLangChainDenied) as exc:
        cb.on_chain_start({}, {"scope": "pulse", "q": "hi"}, metadata={"hki_envelope": VALID})
    assert exc.value.code == "scope-override"


def test_callback_tool_start_enforces_target_domain() -> None:
    cb = hki_langchain.HkiCallbackHandler()
    # Tool bound to a different domain that isn't published into iris.
    with pytest.raises(hki_langchain.HkiLangChainDenied) as exc:
        cb.on_tool_start(
            {"name": "search.fraud"},
            "query",
            metadata={
                "hki_envelope": VALID,
                "hki_tool": {"domain": "fraud"},
            },
        )
    assert exc.value.code == "gateway-denied"


def test_callback_retriever_end_blocks_unlabeled_and_cross_domain() -> None:
    cb = hki_langchain.HkiCallbackHandler()

    # Wrong domain -> rejected.
    with pytest.raises(hki_langchain.HkiLangChainDenied) as exc:
        cb.on_retriever_end(
            [_doc({"id": "d1", "domain": "pulse"})],
            metadata={"hki_envelope": VALID},
        )
    assert exc.value.code == "artifact-scope-mismatch"

    # Missing domain -> rejected.
    with pytest.raises(hki_langchain.HkiLangChainDenied) as exc:
        cb.on_retriever_end([_doc({"id": "d1"})], metadata={"hki_envelope": VALID})
    assert exc.value.code == "missing-domain"

    # Correct domain -> ok.
    cb.on_retriever_end(
        [_doc({"id": "d1", "domain": "iris"})],
        metadata={"hki_envelope": VALID},
    )


class _FakeRetriever:
    def __init__(self, docs) -> None:
        self._docs: typing.Any = docs

    def invoke(self, query, config=None) -> typing.Any:
        return self._docs

    async def ainvoke(self, query, config=None) -> typing.Any:
        return self._docs


def test_hki_retriever_filters_to_active_domain() -> None:
    docs: list[SimpleNamespace] = [
        _doc({"id": "i1", "domain": "iris"}, "iris"),
        _doc({"id": "p1", "domain": "pulse"}, "pulse"),
        _doc({"id": "x"}, "unlabeled"),
    ]
    retriever = hki_langchain.HkiRetriever(_FakeRetriever(docs))
    out: list[typing.Any] = retriever.invoke("q", config={"metadata": {"hki_envelope": VALID}})
    assert [d.metadata["id"] for d in out] == ["i1"]


def test_hki_retriever_rejects_call_without_envelope() -> None:
    retriever = hki_langchain.HkiRetriever(_FakeRetriever([]))
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        retriever.invoke("q")
    with pytest.raises(hki_langchain.HkiLangChainDenied):
        retriever.invoke("q", config={})


def test_cache_key_segregates_by_domain() -> None:
    a: str = hki_langchain.hki_cache_key(_validated("iris"), "hi", "gpt-x")
    b: str = hki_langchain.hki_cache_key(_validated("pulse"), "hi", "gpt-x")
    assert a != b


def _validated(domain: str) -> HkiEnvelope:
    from hki_runtime import validate_envelope

    payload = {**VALID, "active_domain": domain, "authorized_domains": [domain]}
    res: HkiValidationResult = validate_envelope(payload, require_signature=True)
    assert res.envelope is not None
    return res.envelope
