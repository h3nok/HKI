"""
Shared ASGI middleware for all platform services.

RequestIdMiddleware
    Ensures every request has an ``X-Request-Id`` header.  If the caller
    provides one it is reused; otherwise a new UUID4 is generated.  The
    value is:

    * set on a ``contextvars.ContextVar`` so structured loggers can
      include it automatically,
    * echoed back on the response ``X-Request-Id`` header for client
      correlation.

Usage in a FastAPI app::

    from shared.middleware import RequestIdMiddleware

    app.add_middleware(RequestIdMiddleware)
"""

from __future__ import annotations

import contextvars
import uuid
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware

if TYPE_CHECKING:
    from collections.abc import Callable

    from starlette.requests import Request
    from starlette.responses import Response

# ── Context variable accessible from any async code in the same task ──
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)

_REQUEST_ID_HEADER = "X-Request-Id"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Inject / propagate ``X-Request-Id`` on every request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get(_REQUEST_ID_HEADER) or str(uuid.uuid4())
        token = request_id_var.set(rid)
        try:
            response: Response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[_REQUEST_ID_HEADER] = rid
        return response
