"""FastAPI / Starlette integration for the HKI runtime.

This module is optional: it imports Starlette types lazily so the core
``hki_runtime`` package has zero hard runtime dependencies. Install with::

    pip install "hki-runtime[fastapi]"

The middleware enforces the HKI runtime contract on every inbound request:

* An ``X-HKI-Envelope`` header (base64url-encoded JSON) MUST be present.
* The envelope MUST validate per :func:`hki_runtime.validate_envelope`.
* ``active_domain`` MUST NOT be ``global`` or ``*``.
* ``expires_at`` MUST be in the future.
* The validated envelope is attached to ``request.state.hki`` for downstream
  handlers and exporters.
* The middleware emits a structured ``hki.reject`` event on failure with the
  validation issue codes; integrators can plug a SIEM exporter.

It deliberately does **not** mint envelopes. Envelope minting is a privileged
operation that lives at the BFF / identity edge and is out of scope for the
runtime library.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import typing

from . import HkiValidationIssue

from . import HkiValidationIssue



from . import (
    HkiEnvelope,
    HkiValidationResult,
    apply_hki_trace_attributes,
    validate_envelope,
)

if typing.TYPE_CHECKING:  # pragma: no cover - import only for type checkers
    from starlette.requests import Request
    from starlette.types import ASGIApp, Receive, Scope, Send

_log: logging.Logger = logging.getLogger("hki.runtime.fastapi")

DEFAULT_HEADER = "x-hki-envelope"
"""HTTP header that carries the signed envelope (base64url JSON)."""

DEFAULT_REJECT_STATUS = 401
DEFAULT_FORBIDDEN_STATUS = 403


class HkiEnvelopeError(Exception):
    """Raised when the envelope header is missing or malformed."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code: str = code
        self.message: str = message


def decode_envelope_header(value: str | None) -> dict[str, typing.Any]:
    """Decode a base64url-JSON HKI envelope header.

    Accepts either a raw JSON string (for dev) or a base64url-encoded JSON
    payload (recommended in production). Raises :class:`HkiEnvelopeError`
    on any decoding failure.
    """
    if not value:
        raise HkiEnvelopeError("missing-envelope", "X-HKI-Envelope header is required")

    raw: str = value.strip()
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise HkiEnvelopeError("invalid-envelope", f"envelope JSON invalid: {exc}") from exc

    # base64url decode
    padded: str = raw + "=" * (-len(raw) % 4)
    try:
        decoded: bytes = base64.urlsafe_b64decode(padded.encode("ascii"))
    except (binascii.Error, ValueError) as exc:
        raise HkiEnvelopeError(
            "invalid-envelope", f"envelope base64url invalid: {exc}"
        ) from exc

    try:
        return json.loads(decoded)
    except json.JSONDecodeError as exc:
        raise HkiEnvelopeError("invalid-envelope", f"envelope JSON invalid: {exc}") from exc


class HkiMiddleware:
    """ASGI middleware that enforces HKI envelope presence and validity.

    Usage with FastAPI::

        from fastapi import FastAPI
        from hki_runtime.fastapi import HkiMiddleware

        app = FastAPI()
        app.add_middleware(HkiMiddleware, require_signature=True)

    Args:
        app: The downstream ASGI app.
        header_name: Header to read the envelope from. Defaults to
            ``X-HKI-Envelope`` (case-insensitive).
        require_signature: When True, envelopes without a ``signature`` are
            rejected. Defaults to True. Disable only for local development.
        max_future_skew_seconds: Tolerance for clock skew. Defaults to 60s.
        exempt_paths: Iterable of path prefixes that bypass the middleware
            (e.g. ``("/healthz", "/metrics")``). HKI does not apply to these.
        on_reject: Optional callback invoked with
            ``(scope, validation_result, error)`` for SIEM/observability hooks.
    """

    def __init__(
        self,
        app: "ASGIApp",
        *,
        header_name: str = DEFAULT_HEADER,
        require_signature: bool = True,
        max_future_skew_seconds: float = 60,
        exempt_paths: typing.Iterable[str] = ("/healthz", "/livez", "/readyz", "/metrics"),
        on_reject: typing.Callable[
            ["Scope", HkiValidationResult | None, HkiEnvelopeError | None], None
        ]
        | None = None,
    ) -> None:
        self.app = app
        self.header_name: bytes = header_name.lower().encode("latin-1")
        self.require_signature: bool = require_signature
        self.max_future_skew_seconds: float = max_future_skew_seconds
        self.exempt_paths: tuple[str, ...] = tuple(exempt_paths)
        self.on_reject = on_reject

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if any(path == p or path.startswith(p + "/") for p in self.exempt_paths):
            await self.app(scope, receive, send)
            return

        # Extract envelope header
        header_value: str | None = None
        for k, v in scope.get("headers", []):
            if k == self.header_name:
                header_value = v.decode("latin-1")
                break

        try:
            payload: dict[str, Any] = decode_envelope_header(header_value)
        except HkiEnvelopeError as err:
            await self._emit_reject(scope, send, err.code, err.message, status=DEFAULT_REJECT_STATUS)
            if self.on_reject:
                self.on_reject(scope, None, err)
            return

        result: HkiValidationResult = validate_envelope(
            payload,
            require_signature=self.require_signature,
            max_future_skew_seconds=self.max_future_skew_seconds,
        )
        if not result.ok or result.envelope is None:
            issues: list[dict[str, str]] = [{"code": i.code, "field": i.field, "message": i.message} for i in result.issues]
            status: int = (
                DEFAULT_FORBIDDEN_STATUS
                if any(i.code in {"invalid-domain", "unauthorized-domain"} for i in result.issues)
                else DEFAULT_REJECT_STATUS
            )
            await self._emit_reject(scope, send, "envelope-invalid", "HKI envelope failed validation", status=status, issues=issues)
            if self.on_reject:
                self.on_reject(scope, result, None)
            return

        # Attach envelope to scope so handlers can read request.state.hki
        scope.setdefault("state", {})
        if isinstance(scope["state"], dict):
            scope["state"]["hki"] = result.envelope
        else:  # Starlette uses a State object; set attribute
            try:
                setattr(scope["state"], "hki", result.envelope)
            except Exception:  # pragma: no cover - very defensive
                _log.debug("could not attach hki envelope to scope.state")

        await self.app(scope, receive, send)

    @staticmethod
    async def _emit_reject(
        scope: "Scope",
        send: "Send",
        code: str,
        message: str,
        *,
        status: int,
        issues: list[dict[str, str]] | None = None,
    ) -> None:
        body: dict[str, str] = {"error": code, "message": message}
        if issues is not None:
            body["issues"] = issues  # type: ignore[assignment]
        encoded: bytes = json.dumps(body).encode("utf-8")
        _log.warning(
            "hki.reject path=%s code=%s issues=%s",
            scope.get("path"),
            code,
            issues,
        )
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(encoded)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": encoded, "more_body": False})


def get_envelope(request: "Request") -> HkiEnvelope:
    """FastAPI dependency / helper to read the validated envelope from request state.

    Raises ``RuntimeError`` if the middleware has not run.
    """
    envelope: typing.Any | None = getattr(request.state, "hki", None)
    if not isinstance(envelope, HkiEnvelope):
        raise RuntimeError(
            "HKI envelope not present on request.state.hki; "
            "did you install HkiMiddleware before this handler?"
        )
    return envelope


def attach_hki_span(span: typing.Any, request: "Request") -> typing.Any:
    """Convenience: copy HKI envelope attributes onto an OpenTelemetry span."""
    return apply_hki_trace_attributes(span, get_envelope(request))


__all__: list[str] = [
    "DEFAULT_HEADER",
    "HkiEnvelopeError",
    "HkiMiddleware",
    "attach_hki_span",
    "decode_envelope_header",
    "get_envelope",
]
