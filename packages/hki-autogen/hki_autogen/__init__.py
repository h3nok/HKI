"""HKI ↔ Microsoft AutoGen integration.

Three integration points:

* :class:`HkiMessageGuard` — duck-typed message validator that requires a
  signed envelope on ``message.metadata`` and rejects scope-override
  fields on the message body.
* :class:`HkiToolWrapper` — wraps any callable tool used by an
  ``AssistantAgent``; enforces the envelope on every invocation.
* :class:`HkiAgentMixin` — mixin for custom ``BaseChatAgent`` subclasses
  that fail-closes on missing envelopes in the inbound message stream.

AutoGen is an optional dependency; this module never imports it.
"""

from __future__ import annotations

from inspect import Signature
import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.autogen")

ENVELOPE_KEY = "hki_envelope"


class HkiAutoGenDenied(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


def _coerce(payload: typing.Any) -> hki_runtime.HkiEnvelope:
    if isinstance(payload, hki_runtime.HkiEnvelope):
        return payload
    if payload is None:
        raise HkiAutoGenDenied(
            "missing-envelope", "AutoGen message is missing HKI envelope"
        )
    result = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiAutoGenDenied(
            "envelope-invalid", f"HKI envelope failed validation: {codes}"
        )
    return result.envelope


def find_envelope_on_message(message: typing.Any) -> typing.Any | None:
    """Look for an envelope on a message-like object.

    Searches: ``message.metadata[ENVELOPE_KEY]``,
    ``message.metadata.get("hki_envelope")``, ``message.extra[ENVELOPE_KEY]``.
    """
    if message is None:
        return None
    metadata: typing.Any | None = getattr(message, "metadata", None)
    if isinstance(metadata, typing.Mapping) and ENVELOPE_KEY in metadata:
        return metadata[ENVELOPE_KEY]
    extra: typing.Any | None = getattr(message, "extra", None)
    if isinstance(extra, typing.Mapping) and ENVELOPE_KEY in extra:
        return extra[ENVELOPE_KEY]
    if isinstance(message, typing.Mapping):
        if ENVELOPE_KEY in message:
            return message[ENVELOPE_KEY]
        meta = message.get("metadata")
        if isinstance(meta, typing.Mapping) and ENVELOPE_KEY in meta:
            return meta[ENVELOPE_KEY]
    return None


# ---------------------------------------------------------------------------
# Message guard
# ---------------------------------------------------------------------------


class HkiMessageGuard:
    """Duck-typed message validator for AutoGen ChatMessage / TextMessage."""

    def assert_message_authorized(self, message: typing.Any) -> hki_runtime.HkiEnvelope:
        envelope = _coerce(find_envelope_on_message(message))

        # Reject body-style scope override on the message content.
        body: typing.Any = None
        for attr in ("content", "body", "data"):
            value: typing.Any | None = getattr(message, attr, None)
            if isinstance(value, typing.Mapping):
                body = value
                break
        if isinstance(message, typing.Mapping) and body is None:
            for key in ("content", "body", "data"):
                value = message.get(key)
                if isinstance(value, typing.Mapping):
                    body = value
                    break

        if isinstance(body, typing.Mapping):
            err = hki_runtime.reject_conflicting_scope_argument(envelope, body)
            if err is not None:
                raise HkiAutoGenDenied("scope-override", err)
        return envelope

    def assert_stream_consistent(
        self, messages: typing.Iterable[typing.Any]
    ) -> hki_runtime.HkiEnvelope:
        first: hki_runtime.HkiEnvelope | None = None
        for msg in messages:
            envelope = self.assert_message_authorized(msg)
            if first is None:
                first = envelope
            elif envelope.envelope_id != first.envelope_id:
                raise HkiAutoGenDenied(
                    "stream-envelope-mismatch",
                    "AutoGen message stream contains mismatched HKI envelopes",
                )
        if first is None:
            raise HkiAutoGenDenied(
                "missing-envelope", "AutoGen message stream is empty"
            )
        return first


# ---------------------------------------------------------------------------
# Tool wrapper
# ---------------------------------------------------------------------------


class HkiToolWrapper:
    """Wrap any AutoGen tool callable and enforce HKI on every invocation.

    The envelope is supplied either at construction (``envelope=``) or via
    a per-call ``hki_envelope=`` kwarg. Outbound scope-override fields on
    keyword arguments are rejected.
    """

    def __init__(
        self,
        inner: typing.Callable[..., typing.Any],
        *,
        envelope: typing.Any | None = None,
        domain: str | None = None,
        published_domains: typing.Sequence[str] = (),
    ) -> None:
        self.inner: Callable[..., Any] = inner
        self._default_envelope: hki_runtime.HkiEnvelope | None = (
            _coerce(envelope) if envelope is not None else None
        )
        self.domain: str | None = domain
        self.published_domains: tuple[str, ...] = tuple(published_domains)
        self.__name__: typing.Any | str = getattr(inner, "__name__", "hki_tool")
        self.__doc__ = getattr(inner, "__doc__", None)
        try:
            import inspect

            self.__signature__: Signature = inspect.signature(inner)
        except (TypeError, ValueError):
            pass

    def _resolve(self, override: typing.Any | None) -> hki_runtime.HkiEnvelope:
        if override is not None:
            return _coerce(override)
        if self._default_envelope is not None:
            return self._default_envelope
        raise HkiAutoGenDenied(
            "missing-envelope", "HkiToolWrapper requires an HKI envelope"
        )

    def _enforce(self, envelope: hki_runtime.HkiEnvelope, kwargs: dict) -> None:
        err = hki_runtime.reject_conflicting_scope_argument(envelope, kwargs)
        if err is not None:
            raise HkiAutoGenDenied("scope-override", err)
        if self.domain is not None:
            target = hki_runtime.HkiGatewayTarget(
                type="tool",
                id=self.__name__,
                domain=self.domain,
                published_domains=self.published_domains,
            )
            decision = hki_runtime.evaluate_gateway_target(envelope, target)
            if not decision.allowed:
                raise HkiAutoGenDenied("gateway-denied", decision.reason)

    def __call__(
        self,
        *args: typing.Any,
        hki_envelope: typing.Any | None = None,
        **kwargs: typing.Any,
    ) -> typing.Any:
        env = self._resolve(hki_envelope)
        self._enforce(env, kwargs)
        return self.inner(*args, **kwargs)

    async def acall(
        self,
        *args: typing.Any,
        hki_envelope: typing.Any | None = None,
        **kwargs: typing.Any,
    ) -> typing.Any:
        env = self._resolve(hki_envelope)
        self._enforce(env, kwargs)
        result = self.inner(*args, **kwargs)
        if hasattr(result, "__await__"):
            return await result
        return result


# ---------------------------------------------------------------------------
# Agent mixin
# ---------------------------------------------------------------------------


class HkiAgentMixin:
    """Mixin for custom ``BaseChatAgent`` subclasses.

    Call ``self._hki_guard_messages(messages)`` from inside ``on_messages`` /
    ``on_messages_stream`` to fail-close on missing envelopes.
    """

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self._hki_message_guard = HkiMessageGuard()

    def _hki_guard_messages(
        self, messages: typing.Iterable[typing.Any]
    ) -> hki_runtime.HkiEnvelope:
        return self._hki_message_guard.assert_stream_consistent(messages)


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
    "HkiAgentMixin",
    "HkiAutoGenDenied",
    "HkiMessageGuard",
    "HkiToolWrapper",
    "find_envelope_on_message",
    "hki_cache_key",
]
