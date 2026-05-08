"""HKI ↔ LiteLLM integration.

This module turns LiteLLM (https://github.com/BerriAI/litellm) into an
HKI-conformant LLM gateway by:

1. Reading the active envelope from the request metadata (or a context var)
   and **rejecting** any call without a valid envelope.
2. Stamping cache keys derived through :func:`hki_runtime.derive_hki_cache_key`
   so semantic / response caches cannot bleed across domains.
3. Tagging every spend / observability record with the HKI envelope
   attributes so Langfuse, Helicone, Arize, etc. all see the domain.
4. Refusing models that are not authorised for the active domain via
   :func:`hki_runtime.evaluate_gateway_target`.

Two entry-points are provided so adopters can pick whichever LiteLLM hook
their version exposes:

* :class:`HkiLiteLLMCallback` — implements the modern ``CustomLogger`` API.
* :func:`build_pre_call_hook` and :func:`build_post_call_hook` — for older
  ``litellm.success_callback`` / ``litellm.failure_callback`` lists.

Neither path imports LiteLLM at module load time; the package is optional.
"""

from __future__ import annotations

import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.litellm")

ENVELOPE_KEY = "hki_envelope"
"""Key under which the envelope is read from LiteLLM kwargs/metadata."""


class HkiGatewayDenied(Exception):
    """Raised when a LiteLLM call is denied by HKI policy."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _extract_envelope(kwargs: typing.Mapping[str, typing.Any]) -> dict | None:
    """Find the envelope on a LiteLLM call.

    LiteLLM threads custom data through ``metadata`` or top-level kwargs.
    """
    metadata = kwargs.get("metadata") or {}
    if isinstance(metadata, dict) and ENVELOPE_KEY in metadata:
        return metadata[ENVELOPE_KEY]
    if ENVELOPE_KEY in kwargs:
        return kwargs[ENVELOPE_KEY]  # type: ignore[return-value]
    return None


def _required_envelope(kwargs: typing.Mapping[str, typing.Any]) -> hki_runtime.HkiEnvelope:
    payload = _extract_envelope(kwargs)
    if payload is None:
        raise HkiGatewayDenied(
            "missing-envelope",
            "LiteLLM call missing HKI envelope in metadata.hki_envelope",
        )
    result: hki_runtime.HkiValidationResult = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiGatewayDenied(
            "envelope-invalid",
            f"HKI envelope failed validation: {codes}",
        )
    return result.envelope


def _model_target(envelope: hki_runtime.HkiEnvelope, kwargs: typing.Mapping[str, typing.Any]) -> hki_runtime.HkiGatewayTarget:
    """Derive the HKI gateway target for the model being invoked.

    By default a model is considered to be in the active domain (the gateway
    enforces tenant-scoped routing). Adopters can override this by setting
    ``metadata['hki_model_domain']`` and ``metadata['hki_model_publishes']``.
    """
    meta = kwargs.get("metadata") or {}
    model_domain = meta.get("hki_model_domain") if isinstance(meta, dict) else None
    published = meta.get("hki_model_publishes") if isinstance(meta, dict) else None
    return hki_runtime.HkiGatewayTarget(
        type="model",
        id=str(kwargs.get("model") or "unknown"),
        domain=str(model_domain or envelope.active_domain),
        published_domains=tuple(published or ()),
    )


# ---------------------------------------------------------------------------
# pre / post hooks
# ---------------------------------------------------------------------------


def pre_call(kwargs: typing.MutableMapping[str, typing.Any]) -> hki_runtime.HkiEnvelope:
    """Run HKI policy before LiteLLM dispatches the call.

    Mutates ``kwargs`` in place: stamps an HKI cache key and attaches
    envelope attributes to ``metadata``. Raises :class:`HkiGatewayDenied`
    when the call is not allowed.
    """
    envelope = _required_envelope(kwargs)

    target = _model_target(envelope, kwargs)
    decision = hki_runtime.evaluate_gateway_target(envelope, target)
    if not decision.allowed:
        raise HkiGatewayDenied("gateway-denied", decision.reason)

    cache_key = hki_runtime.derive_hki_cache_key(
        {
            "envelope": envelope,
            "operation": "llm.completion",
            "input": {
                "messages": kwargs.get("messages"),
                "tools": kwargs.get("tools"),
            },
            "model_route": kwargs.get("model"),
        }
    )

    metadata = kwargs.setdefault("metadata", {})
    if isinstance(metadata, dict):
        metadata.setdefault("hki_attributes", hki_runtime.hki_trace_attributes(envelope))
        metadata["hki_cache_key"] = cache_key

    # LiteLLM's response cache reads `kwargs["cache"]["s3_path"]` or the
    # caching layer's key directly; surface the HKI key there too.
    cache_block: typing.Any | None = kwargs.get("cache")
    if isinstance(cache_block, dict):
        cache_block["hki_key"] = cache_key
    else:
        kwargs["cache"] = {"hki_key": cache_key}

    return envelope


def post_call(
    kwargs: typing.Mapping[str, typing.Any],
    response: typing.Any,
    *,
    span: typing.Any | None = None,
) -> None:
    """Stamp HKI envelope attributes onto a span after a successful call."""
    envelope = _extract_envelope(kwargs)
    if envelope is None:
        return
    result = hki_runtime.validate_envelope(envelope, require_signature=True)
    if not result.ok or result.envelope is None:
        return
    if span is not None:
        try:
            hki_runtime.apply_hki_trace_attributes(span, result.envelope)
        except Exception:  # pragma: no cover - never fail the request
            _log.debug("could not apply HKI attributes to span", exc_info=True)


# ---------------------------------------------------------------------------
# CustomLogger adapter (modern LiteLLM API)
# ---------------------------------------------------------------------------


class HkiLiteLLMCallback:
    """LiteLLM ``CustomLogger`` that enforces HKI on every call.

    Register at app startup::

        import litellm
        from hki_litellm import HkiLiteLLMCallback

        litellm.callbacks = [HkiLiteLLMCallback()]

    Then make calls with the envelope in metadata::

        litellm.completion(
            model="vertex_ai/gemini-2.5-flash",
            messages=[...],
            metadata={"hki_envelope": signed_envelope_dict},
        )
    """

    def log_pre_api_call(self, model: str, messages: list, kwargs: dict) -> None:
        try:
            pre_call(kwargs)
        except HkiGatewayDenied:
            # Re-raise so LiteLLM aborts the call.
            raise

    def log_success_event(
        self,
        kwargs: dict,
        response_obj: typing.Any,
        start_time: typing.Any,
        end_time: typing.Any,
    ) -> None:
        post_call(kwargs, response_obj)

    def log_failure_event(
        self,
        kwargs: dict,
        response_obj: typing.Any,
        start_time: typing.Any,
        end_time: typing.Any,
    ) -> None:
        post_call(kwargs, response_obj)

    # Async variants delegate to sync; LiteLLM accepts both signatures.

    async def async_log_pre_api_call(self, model: str, messages: list, kwargs: dict) -> None:
        self.log_pre_api_call(model, messages, kwargs)

    async def async_log_success_event(
        self,
        kwargs: dict,
        response_obj: typing.Any,
        start_time: typing.Any,
        end_time: typing.Any,
    ) -> None:
        self.log_success_event(kwargs, response_obj, start_time, end_time)

    async def async_log_failure_event(
        self,
        kwargs: dict,
        response_obj: typing.Any,
        start_time: typing.Any,
        end_time: typing.Any,
    ) -> None:
        self.log_failure_event(kwargs, response_obj, start_time, end_time)


def build_pre_call_hook() -> typing.Callable[[dict], None]:
    """Adapter for older ``litellm.input_callback`` lists (sync)."""

    def _hook(kwargs: dict) -> None:
        pre_call(kwargs)

    return _hook


def build_post_call_hook() -> typing.Callable[[dict, typing.Any], None]:
    """Adapter for older ``litellm.success_callback`` lists (sync)."""

    def _hook(kwargs: dict, response: typing.Any) -> None:
        post_call(kwargs, response)

    return _hook


__all__: list[str] = [
    "ENVELOPE_KEY",
    "HkiGatewayDenied",
    "HkiLiteLLMCallback",
    "build_post_call_hook",
    "build_pre_call_hook",
    "post_call",
    "pre_call",
]
