"""
Service-to-Service Authentication

FastAPI dependency for the /v1/internal/* routes. These endpoints are only
callable by trusted internal services (knowledge-pipeline-service), not by
end-users via the BFF.

Protection mechanism: the pipeline service presents a shared secret in the
X-Pipeline-Secret header. The value must match PIPELINE_SERVICE_SECRET in
this service's config. When PIPELINE_SERVICE_SECRET is empty (local dev),
the check is skipped entirely — no header is required.

Usage:
    from src.core.service_auth import verify_service_token, ServiceIdentity

    @internal_router.post("/store")
    async def store(body: ..., identity: ServiceIdentity = Depends(verify_service_token)):
        org_id = identity.org_id  # from request body, not JWT
"""

from __future__ import annotations

import dataclasses
import hmac

import fastapi

import src.core.config
import src.core.logging


@dataclasses.dataclass(frozen=True)
class ServiceIdentity:
    """Resolved identity for a verified service-to-service call."""

    service: str
    org_id: str = "default"


def _allow_local_secret_bypass() -> bool:
    return (
        str(src.core.config.settings.ENVIRONMENT).lower()
        in {"local", "dev", "development", "test"}
        or str(src.core.config.settings.AUTH_ENABLED).lower() in {"false", "0", "no"}
    )


async def verify_service_token(request: fastapi.Request) -> ServiceIdentity:
    """
    FastAPI dependency — validates the X-Internal-Token header.

    Returns ServiceIdentity on success.
    Raises HTTP 401 when header is missing (token check enabled).
    Raises HTTP 403 when header value does not match the configured secret.
    Bypassed when INTERNAL_SERVICE_TOKEN is empty (local dev).
    """
    if not src.core.config.settings.PIPELINE_SERVICE_SECRET:
        if not _allow_local_secret_bypass():
            raise fastapi.HTTPException(
                status_code=fastapi.status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Pipeline service secret is not configured",
            )

        service: str = request.headers.get("X-Service-Name", "dev")
        src.core.logging.logger.debug(
            "Pipeline secret check skipped (PIPELINE_SERVICE_SECRET not set)",
            extra={"service": service},
        )
        return ServiceIdentity(service=service)

    token: str = request.headers.get("X-Pipeline-Secret", "")
    if not token:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Pipeline-Secret header",
        )

    if not hmac.compare_digest(token, src.core.config.settings.PIPELINE_SERVICE_SECRET):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_403_FORBIDDEN,
            detail="Invalid service token",
        )

    service: str = request.headers.get("X-Service-Name", "unknown")
    src.core.logging.logger.debug("Service token verified", extra={"service": service})
    return ServiceIdentity(service=service)
