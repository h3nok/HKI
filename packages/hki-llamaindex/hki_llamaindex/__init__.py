"""HKI ↔ LlamaIndex integration.

Three integration points:

* :class:`HkiCallbackHandler` — duck-typed LlamaIndex
  ``BaseCallbackHandler`` that enforces an HKI envelope on every event
  and rejects scope-override payloads.
* :class:`HkiRetriever` — wraps any retriever; drops nodes not labelled
  for the active domain.
* :class:`HkiQueryEngine` — wraps any query engine; asserts response
  source nodes are visible.

LlamaIndex is an optional dependency — this module never imports it.
"""

from __future__ import annotations

import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.llamaindex")

ENVELOPE_KEY = "hki_envelope"


class HkiLlamaIndexDenied(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


def _coerce_envelope(payload: typing.Any) -> hki_runtime.HkiEnvelope:
    if isinstance(payload, hki_runtime.HkiEnvelope):
        return payload
    if payload is None:
        raise HkiLlamaIndexDenied(
            "missing-envelope", "LlamaIndex run is missing HKI envelope"
        )
    result = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiLlamaIndexDenied(
            "envelope-invalid", f"HKI envelope failed validation: {codes}"
        )
    return result.envelope


def find_envelope(
    *sources: typing.Mapping[str, typing.Any] | None,
) -> typing.Any | None:
    """Search LlamaIndex's many event-payload locations for an envelope."""
    for source in sources:
        if not isinstance(source, typing.Mapping):
            continue
        if ENVELOPE_KEY in source:
            return source[ENVELOPE_KEY]
        for nested_key in ("metadata", "extra_info", "kwargs", "additional_kwargs"):
            nested: typing.Any | None = source.get(nested_key)
            if isinstance(nested, typing.Mapping) and ENVELOPE_KEY in nested:
                return nested[ENVELOPE_KEY]
    return None


def require_envelope(
    *sources: typing.Mapping[str, typing.Any] | None,
) -> hki_runtime.HkiEnvelope:
    return _coerce_envelope(find_envelope(*sources))


# ---------------------------------------------------------------------------
# Callback handler
# ---------------------------------------------------------------------------


class HkiCallbackHandler:
    """Duck-typed LlamaIndex ``BaseCallbackHandler``.

    May be constructed with a default envelope; otherwise the envelope must
    appear in ``payload["hki_envelope"]`` (or under ``metadata`` /
    ``extra_info``) on every event.
    """

    def __init__(
        self,
        envelope: typing.Any | None = None,
        event_starts_to_ignore: typing.Sequence[str] = (),
        event_ends_to_ignore: typing.Sequence[str] = (),
    ) -> None:
        self._default_envelope: hki_runtime.HkiEnvelope | None = (
            _coerce_envelope(envelope) if envelope is not None else None
        )
        self.event_starts_to_ignore: tuple[str, ...] = tuple(event_starts_to_ignore)
        self.event_ends_to_ignore: tuple[str, ...] = tuple(event_ends_to_ignore)

    def _resolve_envelope(
        self, payload: typing.Mapping[str, typing.Any] | None
    ) -> hki_runtime.HkiEnvelope:
        candidate: typing.Any | None = find_envelope(payload)
        if candidate is None:
            if self._default_envelope is not None:
                return self._default_envelope
            raise HkiLlamaIndexDenied(
                "missing-envelope",
                "LlamaIndex event is missing HKI envelope on payload",
            )
        return _coerce_envelope(candidate)

    # LlamaIndex BaseCallbackHandler interface
    def on_event_start(
        self,
        event_type: str,
        payload: typing.Mapping[str, typing.Any] | None = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: typing.Any,
    ) -> str:
        envelope = self._resolve_envelope(payload)

        # Reject body-style scope override on event payload.
        if isinstance(payload, typing.Mapping):
            err = hki_runtime.reject_conflicting_scope_argument(envelope, payload)
            if err is not None:
                raise HkiLlamaIndexDenied("scope-override", err)

        # If a tool/function event names a target domain, enforce gateway.
        target_meta: typing.Any | None = (payload or {}).get("hki_tool") if isinstance(payload, typing.Mapping) else None
        if isinstance(target_meta, typing.Mapping) and target_meta.get("domain"):
            target = hki_runtime.HkiGatewayTarget(
                type="tool",
                id=str(target_meta.get("id") or event_type),
                domain=str(target_meta["domain"]),
                published_domains=tuple(target_meta.get("published_domains") or ()),
            )
            decision = hki_runtime.evaluate_gateway_target(envelope, target)
            if not decision.allowed:
                raise HkiLlamaIndexDenied("gateway-denied", decision.reason)

        return event_id or ""

    def on_event_end(
        self,
        event_type: str,
        payload: typing.Mapping[str, typing.Any] | None = None,
        event_id: str = "",
        **kwargs: typing.Any,
    ) -> None:
        if not isinstance(payload, typing.Mapping):
            return
        nodes: typing.Any | None = payload.get("nodes")
        if not nodes:
            return
        envelope = self._resolve_envelope(payload)
        for node_with_score in nodes:
            node = getattr(node_with_score, "node", node_with_score)
            metadata = getattr(node, "metadata", None) or {}
            domain = metadata.get("domain") or metadata.get("active_domain")
            if not domain:
                raise HkiLlamaIndexDenied(
                    "missing-domain",
                    "retriever returned a node with no domain label",
                )
            label = hki_runtime.HkiArtifactLabel(
                org_id=str(metadata.get("org_id") or envelope.org_id),
                domain=str(domain),
                artifact_type=str(metadata.get("artifact_type") or "node"),
                artifact_id=str(
                    metadata.get("id")
                    or metadata.get("node_id")
                    or getattr(node, "node_id", "?")
                ),
            )
            issue = hki_runtime.assert_artifact_visible(envelope, label)
            if issue is not None:
                raise HkiLlamaIndexDenied(
                    "artifact-scope-mismatch", issue.message
                )

    def start_trace(self, trace_id: str | None = None) -> None:
        return None

    def end_trace(
        self,
        trace_id: str | None = None,
        trace_map: typing.Any | None = None,
    ) -> None:
        return None


# ---------------------------------------------------------------------------
# Retriever wrapper
# ---------------------------------------------------------------------------


class HkiRetriever:
    """Wrap any LlamaIndex retriever and enforce HKI on its outputs."""

    def __init__(self, inner: typing.Any, envelope: typing.Any | None = None) -> None:
        self.inner = inner
        self._default_envelope: hki_runtime.HkiEnvelope | None = (
            _coerce_envelope(envelope) if envelope is not None else None
        )

    def _resolve(self, override: typing.Any | None) -> hki_runtime.HkiEnvelope:
        if override is not None:
            return _coerce_envelope(override)
        if self._default_envelope is not None:
            return self._default_envelope
        raise HkiLlamaIndexDenied(
            "missing-envelope", "HkiRetriever requires an HKI envelope"
        )

    def _filter(
        self, envelope: hki_runtime.HkiEnvelope, items: typing.Iterable[typing.Any]
    ) -> list[typing.Any]:
        out: list[typing.Any] = []
        for item in items:
            node = getattr(item, "node", item)
            metadata = getattr(node, "metadata", None) or {}
            domain = metadata.get("domain") or metadata.get("active_domain")
            if not domain:
                continue
            label = hki_runtime.HkiArtifactLabel(
                org_id=str(metadata.get("org_id") or envelope.org_id),
                domain=str(domain),
                artifact_type="node",
                artifact_id=str(
                    metadata.get("id")
                    or metadata.get("node_id")
                    or getattr(node, "node_id", "?")
                ),
            )
            if hki_runtime.assert_artifact_visible(envelope, label) is None:
                out.append(item)
        return out

    def retrieve(
        self, query: typing.Any, envelope: typing.Any | None = None
    ) -> list[typing.Any]:
        env = self._resolve(envelope)
        result = self.inner.retrieve(query)
        return self._filter(env, result)

    async def aretrieve(
        self, query: typing.Any, envelope: typing.Any | None = None
    ) -> list[typing.Any]:
        env = self._resolve(envelope)
        result = await self.inner.aretrieve(query)
        return self._filter(env, result)


# ---------------------------------------------------------------------------
# Query-engine wrapper
# ---------------------------------------------------------------------------


class HkiQueryEngine:
    """Duck-typed query-engine wrapper that enforces source-node visibility."""

    def __init__(self, inner: typing.Any, envelope: typing.Any | None = None) -> None:
        self.inner = inner
        self._default_envelope: hki_runtime.HkiEnvelope | None = (
            _coerce_envelope(envelope) if envelope is not None else None
        )

    def _resolve(self, override: typing.Any | None) -> hki_runtime.HkiEnvelope:
        if override is not None:
            return _coerce_envelope(override)
        if self._default_envelope is not None:
            return self._default_envelope
        raise HkiLlamaIndexDenied(
            "missing-envelope", "HkiQueryEngine requires an HKI envelope"
        )

    def query(
        self, query: typing.Any, envelope: typing.Any | None = None
    ) -> typing.Any:
        env = self._resolve(envelope)
        response = self.inner.query(query)
        for src in getattr(response, "source_nodes", None) or []:
            node = getattr(src, "node", src)
            metadata = getattr(node, "metadata", None) or {}
            domain = metadata.get("domain") or metadata.get("active_domain")
            if not domain:
                raise HkiLlamaIndexDenied(
                    "missing-domain",
                    "query returned a source node with no domain label",
                )
            label = hki_runtime.HkiArtifactLabel(
                org_id=str(metadata.get("org_id") or env.org_id),
                domain=str(domain),
                artifact_type="node",
                artifact_id=str(metadata.get("id") or "?"),
            )
            issue = hki_runtime.assert_artifact_visible(env, label)
            if issue is not None:
                raise HkiLlamaIndexDenied(
                    "artifact-scope-mismatch", issue.message
                )
        return response


# ---------------------------------------------------------------------------
# Cache key helper
# ---------------------------------------------------------------------------


def hki_cache_key(
    envelope: hki_runtime.HkiEnvelope,
    prompt: typing.Any,
    model: str | None = None,
) -> str:
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
    "HkiLlamaIndexDenied",
    "HkiQueryEngine",
    "HkiRetriever",
    "find_envelope",
    "hki_cache_key",
    "require_envelope",
]
