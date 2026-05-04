"""
Shared Error Handling — standardised exceptions and FastAPI error middleware.

Provides:
    1.  ``ServiceError`` exception hierarchy — structured errors with codes.
    2.  ``install_error_handlers(app)`` — registers global handlers on a
        FastAPI app so that unhandled exceptions, validation errors, and
        ``ServiceError``s all return a consistent JSON envelope:

            {"error": {"code": "...", "message": "...", "detail": ...}}

Usage in each service's app.py:

    from shared.errors import install_error_handlers
    app = FastAPI(...)
    install_error_handlers(app)

Custom exception classes can be raised from any route:

    from shared.errors import NotFoundError, BadRequestError
    raise NotFoundError("Document abc not found")
"""

from __future__ import annotations

import logging
import traceback
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("errors")


# ─── Exception Hierarchy ─────────────────────────────────────────────────────


class ServiceError(Exception):
    """Base exception for all service-level errors."""

    def __init__(
        self,
        message: str = "An unexpected error occurred",
        *,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        detail: Any = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail


class BadRequestError(ServiceError):
    """Client sent malformed or invalid input."""

    def __init__(self, message: str = "Bad request", *, detail: Any = None):
        super().__init__(
            message,
            code="BAD_REQUEST",
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class NotFoundError(ServiceError):
    """Requested resource does not exist."""

    def __init__(self, message: str = "Not found", *, detail: Any = None):
        super().__init__(
            message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class ConflictError(ServiceError):
    """Conflicting operation (e.g., duplicate create)."""

    def __init__(self, message: str = "Conflict", *, detail: Any = None):
        super().__init__(
            message,
            code="CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )


class RateLimitError(ServiceError):
    """Caller exceeded rate limit."""

    def __init__(self, message: str = "Rate limit exceeded", *, detail: Any = None):
        super().__init__(
            message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )


class UpstreamError(ServiceError):
    """A downstream / upstream dependency failed."""

    def __init__(self, message: str = "Upstream service error", *, detail: Any = None):
        super().__init__(
            message,
            code="UPSTREAM_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )


class ServiceUnavailableError(ServiceError):
    """Service temporarily unavailable (circuit open, overloaded)."""

    def __init__(self, message: str = "Service unavailable", *, detail: Any = None):
        super().__init__(
            message,
            code="SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


# ─── Error Response Schema ───────────────────────────────────────────────────


class ErrorBody(BaseModel):
    """Consistent error payload returned to clients."""

    code: str
    message: str
    detail: Any = None


class ErrorResponse(BaseModel):
    """Top-level wrapper — ``{"error": {...}}``."""

    error: ErrorBody


# ─── FastAPI Exception Handlers ──────────────────────────────────────────────


def _error_json(
    status_code: int,
    code: str,
    message: str,
    detail: Any = None,
) -> JSONResponse:
    body = {"error": {"code": code, "message": message}}
    if detail is not None:
        body["error"]["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)


def install_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers on a FastAPI application."""

    @app.exception_handler(ServiceError)
    async def _service_error(request: Request, exc: ServiceError) -> JSONResponse:
        logger.warning(
            "ServiceError: %s",
            exc.message,
            extra={"code": exc.code, "path": request.url.path},
        )
        return _error_json(exc.status_code, exc.code, exc.message, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        logger.warning(
            "Validation error",
            extra={"path": request.url.path, "errors": str(exc.errors()[:3])},
        )
        return _error_json(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "Request validation failed",
            detail=exc.errors(),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled exception: %s",
            exc,
            extra={
                "path": request.url.path,
                "traceback": traceback.format_exc(limit=5),
            },
        )
        return _error_json(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "An unexpected error occurred",
        )
