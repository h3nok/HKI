"""HKI ↔ LangChain / LangGraph integration.

Two integration points are provided:

* :class:`HkiCallbackHandler` — a LangChain ``BaseCallbackHandler`` that
  enforces an HKI envelope on every chain / LLM / tool / retriever start
  event and stamps envelope attributes onto the trace.
* :class:`HkiRetriever` — a wrapper around any
  ``langchain_core.retrievers.BaseRetriever`` that asserts every returned
  document is labelled for the active domain.

Both look for the envelope on either ``run_manager`` ``metadata``,
``config["configurable"]["hki_envelope"]``, or ``config["metadata"]
["hki_envelope"]`` — wherever LangChain happens to thread metadata in the
caller's version.

LangChain is an optional dependency. Import-time has no LangChain
requirement; the heavy classes only import LangChain inside their methods.
"""

from __future__ import annotations

import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.langchain")

ENVELOPE_KEY = "hki_envelope"


class HkiLangChainDenied(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


# ---------------------------------------------------------------------------
# envelope plumbing
# ---------------------------------------------------------------------------


def find_envelope(
    *sources: typing.Mapping[str, typing.Any] | None,
) -> dict | None:
    """Look for ``hki_envelope`` across LangChain's many config locations.

    Accepts any number of mappings; returns the first envelope found.
    """
    for source in sources:
        if not isinstance(source, typing.Mapping):
            continue
        if ENVELOPE_KEY in source:
            return source[ENVELOPE_KEY]  # type: ignore[return-value]
        # LangChain usually nests under "metadata" or "configurable"
        for nested_key in ("metadata", "configurable", "tags"):
            nested: typing.Any | None = source.get(nested_key)
            if isinstance(nested, typing.Mapping) and ENVELOPE_KEY in nested:
                return nested[ENVELOPE_KEY]  # type: ignore[return-value]
    return None


def require_envelope(
    *sources: typing.Mapping[str, typing.Any] | None,
) -> hki_runtime.HkiEnvelope:
    payload = find_envelope(*sources)
    if payload is None:
        raise HkiLangChainDenied(
            "missing-envelope",
            "LangChain run is missing HKI envelope; expected metadata.hki_envelope",
        )
    result: hki_runtime.HkiValidationResult = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiLangChainDenied("envelope-invalid", f"HKI envelope failed validation: {codes}")
    return result.envelope


# ---------------------------------------------------------------------------
# Callback handler
# ---------------------------------------------------------------------------


class HkiCallbackHandler:
    """LangChain ``BaseCallbackHandler`` that enforces HKI on every event.

    This class does not import ``langchain_core`` at module load. It quacks
    like a ``BaseCallbackHandler`` and the public LangChain API will accept
    any object with the right method names.

    Usage::

        from hki_langchain import HkiCallbackHandler

        chain.invoke(
            {"question": "..."},
            config={"callbacks": [HkiCallbackHandler()],
                    "metadata": {"hki_envelope": signed_envelope}},
        )
    """

    def _on_event(self, kwargs: dict, *, where: str) -> hki_runtime.HkiEnvelope:
        envelope = require_envelope(kwargs.get("metadata"), kwargs)

        # Reject body-style scope override on inputs.
        inputs = kwargs.get("inputs") or {}
        if isinstance(inputs, dict):
            err = hki_runtime.reject_conflicting_scope_argument(envelope, inputs)
            if err is not None:
                raise HkiLangChainDenied("scope-override", err)

        # Stamp HKI attributes onto kwargs for downstream tracers.
        attrs = hki_runtime.hki_trace_attributes(envelope)
        meta = kwargs.setdefault("metadata", {})
        if isinstance(meta, dict):
            meta.setdefault("hki_attributes", attrs)
            meta["hki_event"] = where
        return envelope

    # Chain
    def on_chain_start(self, serialized, inputs, **kwargs) -> None:
        self._on_event({"inputs": inputs, **kwargs}, where="chain")

    def on_chain_end(self, outputs, **kwargs) -> None:
        return None

    def on_chain_error(self, error, **kwargs) -> None:
        return None

    # LLM
    def on_llm_start(self, serialized, prompts, **kwargs) -> None:
        self._on_event({"inputs": {"prompts": prompts}, **kwargs}, where="llm")

    def on_llm_end(self, response, **kwargs) -> None:
        return None

    def on_llm_error(self, error, **kwargs) -> None:
        return None

    # Chat model (newer LangChain)
    def on_chat_model_start(self, serialized, messages, **kwargs) -> None:
        self._on_event({"inputs": {"messages": messages}, **kwargs}, where="chat-model")

    # Tool
    def on_tool_start(self, serialized, input_str, **kwargs) -> None:
        envelope = self._on_event({"inputs": {"input": input_str}, **kwargs}, where="tool")
        # If the tool registry told us a domain, enforce it.
        tool_meta = (kwargs.get("metadata") or {}).get("hki_tool") or {}
        if isinstance(tool_meta, dict) and tool_meta.get("domain"):
            target = hki_runtime.HkiGatewayTarget(
                type="tool",
                id=str(serialized.get("name") or "tool"),
                domain=str(tool_meta["domain"]),
                published_domains=tuple(tool_meta.get("published_domains") or ()),
            )
            decision = hki_runtime.evaluate_gateway_target(envelope, target)
            if not decision.allowed:
                raise HkiLangChainDenied("gateway-denied", decision.reason)

    def on_tool_end(self, output, **kwargs) -> None:
        return None

    def on_tool_error(self, error, **kwargs) -> None:
        return None

    # Retriever
    def on_retriever_start(self, serialized, query, **kwargs) -> None:
        self._on_event({"inputs": {"query": query}, **kwargs}, where="retriever")

    def on_retriever_end(self, documents, **kwargs) -> None:
        envelope = require_envelope(kwargs.get("metadata"), kwargs)
        for doc in documents or []:
            metadata = getattr(doc, "metadata", None) or {}
            domain = metadata.get("domain") or metadata.get("active_domain")
            if not domain:
                raise HkiLangChainDenied(
                    "missing-domain",
                    "retriever returned a document with no domain label",
                )
            label = hki_runtime.HkiArtifactLabel(
                org_id=str(metadata.get("org_id") or envelope.org_id),
                domain=str(domain),
                artifact_type=str(metadata.get("artifact_type") or "document"),
                artifact_id=str(metadata.get("id") or metadata.get("artifact_id") or "?"),
            )
            issue = hki_runtime.assert_artifact_visible(envelope, label)
            if issue is not None:
                raise HkiLangChainDenied("artifact-scope-mismatch", issue.message)

    def on_retriever_error(self, error, **kwargs) -> None:
        return None

    # Span helpers (LangSmith / OTel adopters can call this directly)
    def stamp_span(self, span: typing.Any, envelope: hki_runtime.HkiEnvelope) -> typing.Any:
        return hki_runtime.apply_hki_trace_attributes(span, envelope)


# ---------------------------------------------------------------------------
# Retriever wrapper
# ---------------------------------------------------------------------------


class HkiRetriever:
    """Wrap any LangChain retriever and enforce HKI on its outputs.

    This class is intentionally duck-typed: it does not subclass
    ``BaseRetriever`` (which would force an import of ``langchain_core``).
    Pass it where LangChain expects a retriever-like object that exposes
    ``invoke`` and ``ainvoke``.
    """

    def __init__(self, inner: typing.Any) -> None:
        self.inner = inner

    def _check(self, envelope: hki_runtime.HkiEnvelope, docs: typing.Iterable[typing.Any]) -> list[typing.Any]:
        out: list[typing.Any] = []
        for doc in docs:
            metadata = getattr(doc, "metadata", None) or {}
            domain = metadata.get("domain") or metadata.get("active_domain")
            if not domain:
                continue  # drop unlabeled rows; defence in depth
            label = hki_runtime.HkiArtifactLabel(
                org_id=str(metadata.get("org_id") or envelope.org_id),
                domain=str(domain),
                artifact_type="document",
                artifact_id=str(metadata.get("id") or "?"),
            )
            if hki_runtime.assert_artifact_visible(envelope, label) is None:
                out.append(doc)
        return out

    def invoke(self, query: str, config: typing.Mapping[str, typing.Any] | None = None) -> list[typing.Any]:
        envelope = require_envelope(config, (config or {}).get("metadata") if config else None)
        docs = self.inner.invoke(query, config=config) if config else self.inner.invoke(query)
        return self._check(envelope, docs)

    async def ainvoke(
        self, query: str, config: typing.Mapping[str, typing.Any] | None = None
    ) -> list[typing.Any]:
        envelope = require_envelope(config, (config or {}).get("metadata") if config else None)
        docs = (
            await self.inner.ainvoke(query, config=config) if config else await self.inner.ainvoke(query)
        )
        return self._check(envelope, docs)


# ---------------------------------------------------------------------------
# Cache key helper
# ---------------------------------------------------------------------------


def hki_cache_key(envelope: hki_runtime.HkiEnvelope, prompt: str | typing.Any, model: str | None = None) -> str:
    """Cache-key helper for LangChain ``BaseCache`` implementations."""
    return hki_runtime.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "llm.completion",
            "input": {"prompt": prompt},
            "model_route": model,
        }
    )


__all__: list[str] = [
    "ENVELOPE_KEY",
    "HkiCallbackHandler",
    "HkiLangChainDenied",
    "HkiRetriever",
    "find_envelope",
    "hki_cache_key",
    "require_envelope",
]
