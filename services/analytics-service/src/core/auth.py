"""Auth — thin re-export from canonical shared module."""

from shared.auth_middleware import (  # noqa: F401 – re-export
    RequestIdentity,
    verify_request_jwt,
)

__all__ = ["RequestIdentity", "verify_request_jwt"]
