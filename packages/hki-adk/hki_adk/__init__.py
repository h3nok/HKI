"""HKI ↔ Google Agent Development Kit (ADK) integration.

Three integration points:

* :class:`HkiToolGuard` — wraps any ADK tool callable, enforces a signed
  envelope from ``ToolContext.state`` (or ``session.state``), and rejects
  scope-override arguments.
* :class:`HkiBeforeAgentCallback` / :class:`HkiBeforeToolCallback` —
  drop-in ADK callbacks that fail-closed on missing/invalid envelopes.
* :class:`HkiSessionGuard` — duck-typed session validator that asserts
  every message in a session carries the same envelope.

ADK is an optional dependency; this module never imports it.
"""

from __future__ import annotations

from inspect import Signature
import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.adk")

ENVELOPE_KEY = "hki_envelope"


class HkiAdkDenied(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


def _coerce(payload: typing.Any) -> hki_runtime.HkiEnvelope:
    if isinstance(payload, hki_runtime.HkiEnvelope):
        return payload
    if payload is None:
        raise HkiAdkDenied("missing-envelope", "ADK call is missing HKI envelope")
    result = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiAdkDenied("envelope-invalid", f"HKI envelope failed validation: {codes}")
    return result.envelope


def find_envelope_in_context(ctx: typing.Any) -> typing.Any | None:
    """Look for an envelope on a ToolContext / CallbackContext.

    Searches (in order): ``ctx.state[ENVELOPE_KEY]``,
    ``ctx.session.state[ENVELOPE_KEY]``, ``ctx.metadata[ENVELOPE_KEY]``.
    """
    if ctx is None:
        return None
    state: typing.Any | None = getattr(ctx, "state", None)
    if isinstance(state, typing.Mapping) and ENVELOPE_KEY in state:
        return state[ENVELOPE_KEY]
    session: typing.Any | None = getattr(ctx, "session", None)
    if session is not None:
        sstate: typing.Any | None = getattr(session, "state", None)
        if isinstance(sstate, typing.Mapping) and ENVELOPE_KEY in sstate:
            return sstate[ENVELOPE_KEY]
    metadata: typing.Any | None = getattr(ctx, "metadata", None)
    if isinstance(metadata, typing.Mapping) and ENVELOPE_KEY in metadata:
        return metadata[ENVELOPE_KEY]
    return None


def require_envelope_from_context(ctx: typing.Any) -> hki_runtime.HkiEnvelope:
    return _coerce(find_envelope_in_context(ctx))


# ---------------------------------------------------------------------------
# Tool guard
# ---------------------------------------------------------------------------


class HkiToolGuard:
    """Wrap an ADK tool callable and enforce HKI on every invocation.

    The wrapped object is callable with the same signature ADK expects:
    ``(*args, tool_context=..., **kwargs)`` — ADK's ``FunctionTool``
    inspects the signature to infer arguments. We forward attributes
    (``__name__``, ``__doc__``, ``__signature__``) for that reason.
    """

    def __init__(
        self,
        inner: typing.Callable[..., typing.Any],
        *,
        domain: str | None = None,
        published_domains: typing.Sequence[str] = (),
    ) -> None:
        self.inner: Callable[..., Any] = inner
        self.domain: str | None = domain
        self.published_domains: tuple[str, ...] = tuple(published_domains)
        self.__name__: typing.Any | str = getattr(inner, "__name__", "hki_tool")
        self.__doc__ = getattr(inner, "__doc__", None)
        try:
            import inspect

            self.__signature__: Signature = inspect.signature(inner)
        except (TypeError, ValueError):
            pass

    def _enforce(self, ctx: typing.Any, args: tuple, kwargs: dict) -> hki_runtime.HkiEnvelope:
        envelope = require_envelope_from_context(ctx)

        # Reject body-style scope override on kwargs.
        err = hki_runtime.reject_conflicting_scope_argument(envelope, kwargs)
        if err is not None:
            raise HkiAdkDenied("scope-override", err)

        if self.domain is not None:
            target = hki_runtime.HkiGatewayTarget(
                type="tool",
                id=self.__name__,
                domain=self.domain,
                published_domains=self.published_domains,
            )
            decision = hki_runtime.evaluate_gateway_target(envelope, target)
            if not decision.allowed:
                raise HkiAdkDenied("gateway-denied", decision.reason)
        return envelope

    def __call__(
        self, *args: typing.Any, tool_context: typing.Any = None, **kwargs: typing.Any
    ) -> typing.Any:
        self._enforce(tool_context, args, kwargs)
        if "tool_context" in _accepts(self.inner):
            return self.inner(*args, tool_context=tool_context, **kwargs)
        return self.inner(*args, **kwargs)


def _accepts(fn: typing.Callable[..., typing.Any]) -> set[str]:
    try:
        import inspect

        return set(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        return set()


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------


class HkiBeforeAgentCallback:
    """ADK ``before_agent_callback`` that requires a valid HKI envelope.

    Returning ``None`` lets the agent continue. Raising fail-closes the run.
    """

    def __call__(self, callback_context: typing.Any) -> None:
        require_envelope_from_context(callback_context)
        return None


class HkiBeforeToolCallback:
    """ADK ``before_tool_callback`` that enforces HKI on every tool invocation."""

    def __call__(
        self,
        tool: typing.Any,
        args: typing.Mapping[str, typing.Any] | None,
        tool_context: typing.Any,
    ) -> typing.Any | None:
        envelope = require_envelope_from_context(tool_context)
        if isinstance(args, typing.Mapping):
            err = hki_runtime.reject_conflicting_scope_argument(envelope, args)
            if err is not None:
                raise HkiAdkDenied("scope-override", err)
        return None


# ---------------------------------------------------------------------------
# Session guard
# ---------------------------------------------------------------------------


class HkiSessionGuard:
    """Duck-typed session validator.

    Asserts that every event/message in a session carries the same HKI
    envelope (by ``envelope_id``). Catches accidental envelope swaps mid
    conversation.
    """

    def assert_consistent(self, session: typing.Any) -> hki_runtime.HkiEnvelope:
        state = getattr(session, "state", None) or {}
        envelope = _coerce(state.get(ENVELOPE_KEY))
        events: typing.Any | tuple[()] = getattr(session, "events", None) or ()
        for event in events:
            ev_meta = (
                getattr(event, "metadata", None)
                or getattr(event, "custom_metadata", None)
                or {}
            )
            if not isinstance(ev_meta, typing.Mapping):
                continue
            ev_env = ev_meta.get(ENVELOPE_KEY)
            if ev_env is None:
                continue
            try:
                ev_envelope = _coerce(ev_env)
            except HkiAdkDenied as exc:
                raise HkiAdkDenied(
                    "session-envelope-invalid",
                    f"event in session has invalid envelope: {exc.message}",
                ) from None
            if ev_envelope.envelope_id != envelope.envelope_id:
                raise HkiAdkDenied(
                    "session-envelope-mismatch",
                    "session contains events with mismatched HKI envelopes",
                )
        return envelope


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
    "HkiAdkDenied",
    "HkiBeforeAgentCallback",
    "HkiBeforeToolCallback",
    "HkiSessionGuard",
    "HkiToolGuard",
    "find_envelope_in_context",
    "hki_cache_key",
    "require_envelope_from_context",
]
