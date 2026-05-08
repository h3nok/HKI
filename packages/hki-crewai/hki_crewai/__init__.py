"""HKI ↔ CrewAI integration.

Three integration points:

* :class:`HkiTaskGuard` — validates that a CrewAI ``Task`` carries a
  signed envelope on its ``context`` / ``inputs`` and that the task
  description / inputs do not contain scope-override fields.
* :class:`HkiToolWrapper` — wraps any CrewAI ``BaseTool`` (or plain
  callable); enforces the envelope on every ``_run`` invocation.
* :class:`HkiCrewGuard` — validates that every task in a ``Crew``
  carries the same envelope.

CrewAI is an optional dependency; this module never imports it.
"""

from __future__ import annotations

import logging
import typing

import hki_runtime

_log: logging.Logger = logging.getLogger("hki.crewai")

ENVELOPE_KEY = "hki_envelope"


class HkiCrewAIDenied(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


def _coerce(payload: typing.Any) -> hki_runtime.HkiEnvelope:
    if isinstance(payload, hki_runtime.HkiEnvelope):
        return payload
    if payload is None:
        raise HkiCrewAIDenied("missing-envelope", "CrewAI call is missing HKI envelope")
    result = hki_runtime.validate_envelope(payload, require_signature=True)
    if not result.ok or result.envelope is None:
        codes = sorted({i.code for i in result.issues})
        raise HkiCrewAIDenied(
            "envelope-invalid", f"HKI envelope failed validation: {codes}"
        )
    return result.envelope


def find_envelope_on_task(task: typing.Any) -> typing.Any | None:
    """Look for an envelope on a CrewAI task-like object.

    Searches: ``task.context[ENVELOPE_KEY]``, ``task.inputs[ENVELOPE_KEY]``,
    ``task.metadata[ENVELOPE_KEY]``.
    """
    if task is None:
        return None
    for attr in ("context", "inputs", "metadata", "extra"):
        bag: typing.Any | None = getattr(task, attr, None)
        if isinstance(bag, typing.Mapping) and ENVELOPE_KEY in bag:
            return bag[ENVELOPE_KEY]
        if isinstance(bag, list):
            for item in bag:
                if isinstance(item, typing.Mapping) and ENVELOPE_KEY in item:
                    return item[ENVELOPE_KEY]
    if isinstance(task, typing.Mapping):
        if ENVELOPE_KEY in task:
            return task[ENVELOPE_KEY]
        for nested in ("context", "inputs", "metadata"):
            bag = task.get(nested)
            if isinstance(bag, typing.Mapping) and ENVELOPE_KEY in bag:
                return bag[ENVELOPE_KEY]
    return None


# ---------------------------------------------------------------------------
# Task guard
# ---------------------------------------------------------------------------


class HkiTaskGuard:
    """Validate a CrewAI Task carries a signed envelope and clean inputs."""

    def assert_task_authorized(self, task: typing.Any) -> hki_runtime.HkiEnvelope:
        envelope = _coerce(find_envelope_on_task(task))

        # Reject body-style scope override on task inputs / context.
        for attr in ("inputs", "context"):
            bag: typing.Any | None = getattr(task, attr, None)
            if isinstance(task, typing.Mapping) and bag is None:
                bag = task.get(attr)
            if isinstance(bag, typing.Mapping):
                err = hki_runtime.reject_conflicting_scope_argument(envelope, bag)
                if err is not None:
                    raise HkiCrewAIDenied("scope-override", err)
        return envelope


# ---------------------------------------------------------------------------
# Tool wrapper
# ---------------------------------------------------------------------------


class HkiToolWrapper:
    """Wrap any CrewAI tool (BaseTool subclass or plain callable).

    Exposes ``name``, ``description``, and a ``_run`` / ``run`` /
    ``__call__`` method that enforces HKI before delegating to the inner
    tool. Tools authored as ``BaseTool`` subclasses can be wrapped by
    passing the instance itself; CrewAI will call ``_run`` (which we
    override) instead of the original.
    """

    def __init__(
        self,
        inner: typing.Any,
        *,
        envelope: typing.Any | None = None,
        domain: str | None = None,
        published_domains: typing.Sequence[str] = (),
    ) -> None:
        self.inner = inner
        self._default_envelope: hki_runtime.HkiEnvelope | None = (
            _coerce(envelope) if envelope is not None else None
        )
        self.domain: str | None = domain
        self.published_domains: tuple[str, ...] = tuple(published_domains)
        # Mirror BaseTool surface.
        self.name: str = (
            getattr(inner, "name", None)
            or getattr(inner, "__name__", None)
            or "hki_tool"
        )
        self.description: str = (
            getattr(inner, "description", None)
            or getattr(inner, "__doc__", None)
            or ""
        )

    def _resolve(self, override: typing.Any | None) -> hki_runtime.HkiEnvelope:
        if override is not None:
            return _coerce(override)
        if self._default_envelope is not None:
            return self._default_envelope
        raise HkiCrewAIDenied(
            "missing-envelope", "HkiToolWrapper requires an HKI envelope"
        )

    def _enforce(self, envelope: hki_runtime.HkiEnvelope, kwargs: dict) -> None:
        err = hki_runtime.reject_conflicting_scope_argument(envelope, kwargs)
        if err is not None:
            raise HkiCrewAIDenied("scope-override", err)
        if self.domain is not None:
            target = hki_runtime.HkiGatewayTarget(
                type="tool",
                id=self.name,
                domain=self.domain,
                published_domains=self.published_domains,
            )
            decision = hki_runtime.evaluate_gateway_target(envelope, target)
            if not decision.allowed:
                raise HkiCrewAIDenied("gateway-denied", decision.reason)

    def _invoke(
        self,
        args: tuple,
        kwargs: dict,
        envelope: hki_runtime.HkiEnvelope,
    ) -> typing.Any:
        # Prefer BaseTool's _run, then run, then plain __call__.
        for fname in ("_run", "run", "__call__"):
            fn: typing.Any | None = getattr(self.inner, fname, None)
            if callable(fn) and fn is not self.__call__:
                return fn(*args, **kwargs)
        if callable(self.inner):
            return self.inner(*args, **kwargs)
        raise HkiCrewAIDenied(
            "not-callable", f"inner tool {self.name!r} is not callable"
        )

    def _run(
        self,
        *args: typing.Any,
        hki_envelope: typing.Any | None = None,
        **kwargs: typing.Any,
    ) -> typing.Any:
        env = self._resolve(hki_envelope)
        self._enforce(env, kwargs)
        return self._invoke(args, kwargs, env)

    def run(self, *args: typing.Any, **kwargs: typing.Any) -> typing.Any:
        return self._run(*args, **kwargs)

    def __call__(self, *args: typing.Any, **kwargs: typing.Any) -> typing.Any:
        return self._run(*args, **kwargs)


# ---------------------------------------------------------------------------
# Crew guard
# ---------------------------------------------------------------------------


class HkiCrewGuard:
    """Validate that every task in a CrewAI Crew carries the same envelope."""

    def assert_crew_authorized(self, crew: typing.Any) -> hki_runtime.HkiEnvelope:
        tasks: typing.Any | tuple[()] = getattr(crew, "tasks", None) or ()
        if isinstance(crew, typing.Mapping):
            tasks = crew.get("tasks") or ()
        if not tasks:
            raise HkiCrewAIDenied(
                "missing-tasks", "Crew has no tasks to authorize"
            )

        task_guard = HkiTaskGuard()
        first: hki_runtime.HkiEnvelope | None = None
        for task in tasks:
            envelope = task_guard.assert_task_authorized(task)
            if first is None:
                first = envelope
            elif envelope.envelope_id != first.envelope_id:
                raise HkiCrewAIDenied(
                    "crew-envelope-mismatch",
                    "Crew contains tasks with mismatched HKI envelopes",
                )
        assert first is not None
        return first


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
    "HkiCrewAIDenied",
    "HkiCrewGuard",
    "HkiTaskGuard",
    "HkiToolWrapper",
    "find_envelope_on_task",
    "hki_cache_key",
]
