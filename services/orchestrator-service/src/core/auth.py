"""Auth — thin re-export from canonical shared module.

The orchestrator additionally registers *set_request_token* so the
incoming bearer JWT is stored in a context-var for downstream S2S calls.
"""

from shared.auth_middleware import (  # noqa: F401 – re-export
    RequestIdentity,
    set_on_authenticated_hook,
    verify_request_jwt,
)

from src.core.service_client import set_request_token

# Wire up the token-forwarding hook once at import time.
set_on_authenticated_hook(set_request_token)

__all__ = ["RequestIdentity", "verify_request_jwt"]
