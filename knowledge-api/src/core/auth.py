"""
Request JWT Verification — FastAPI dependency for authenticating BFF requests.

Verifies short-lived HS256 JWTs signed by the Steel BFF. Every protected
route should use ``Depends(verify_request_jwt)`` to extract the caller's
identity and scope claims.

Canonical source: apps/ai-platform/shared/shared/auth_middleware.py
This file mirrors that module for direct import within the orchestrator.
When extending auth to other services, install the shared package instead.

Configuration env vars:
    SERVICE_AUTH_SECRET — shared HS256 secret (K8s Secret / .env)
    AUTH_ENABLED        — set to "false" to skip verification in local dev
    KB_HERMETIC_ISOLATION — reject missing/global runtime scope when true
"""

from __future__ import annotations

import dataclasses
import logging
import os
import typing

import fastapi
import jwt

logger: logging.Logger = logging.getLogger("auth")

EXPECTED_ISSUERS: set[str] = {"agentic-bff"}
EXPECTED_AUDIENCE = "internal-services"
ALGORITHM = "HS256"
GLOBAL_SCOPE = "global"
HKI_RUNTIME_SCOPE_ERROR = (
    "KB_HERMETIC_ISOLATION requires an explicit non-global request scope"
)


def _get_secret() -> str:
    """Resolve the HS256 signing secret.

    Resolution order:
        1. SERVICE_AUTH_SECRET env var
        2. GCP Secret Manager (if google-cloud-secret-manager installed)
        3. JWT_SECRET env var (legacy fallback)
    """
    secret: str = os.environ.get("SERVICE_AUTH_SECRET", "")
    if secret:
        return secret

    # Try GCP Secret Manager (production on GKE with Workload Identity)
    try:
        from shared.gcp_secrets import get_secret as sm_get  # type: ignore[import-untyped]

        env: str = os.environ.get("ENVIRONMENT", "prod")
        secret: str = sm_get(
            f"{env}-service-auth-secret",
            env_fallback="SERVICE_AUTH_SECRET",
        )
        if secret:
            return secret
    except ImportError:
        pass  # google-cloud-secret-manager not installed — local dev

    secret: str = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise RuntimeError(
            "Neither SERVICE_AUTH_SECRET nor JWT_SECRET is set, "
            "and Secret Manager is not available. Cannot verify request JWTs."
        )
    return secret


def _auth_enabled() -> bool:
    return os.environ.get("AUTH_ENABLED", "true").lower() not in ("false", "0", "no")


def _kb_hermetic_isolation_enabled() -> bool:
    return os.environ.get("KB_HERMETIC_ISOLATION", "false").lower() in (
        "true",
        "1",
        "yes",
        "on",
    )


def _normalize_scope(value: object) -> str | None:
    normalized: str = str(value).strip() if value is not None else ""
    return normalized or None


def _is_global_scope(value: object) -> bool:
    normalized: str | None = _normalize_scope(value)
    return normalized.lower() == GLOBAL_SCOPE if normalized else False


@dataclasses.dataclass(frozen=True)
class RequestIdentity:
    """Verified identity extracted from the request JWT."""

    user_id: str
    name: str
    role: str
    scope: str
    scopes: list[str]
    org_id: str = "default"  # Organization ID for multi-tenant isolation
    groups: list[str] | None = None


_DEV_IDENTITY = RequestIdentity(
    user_id="0",
    name="dev-user",
    role="admin",
    scope="global",
    scopes=["global"],
    org_id="default",
    groups=["role:admin"],
)


def _extract_bearer_token(request: fastapi.Request) -> str:
    auth_header: str = request.headers.get("X-Service-Auth", "") or request.headers.get(
        "Authorization", ""
    )
    if not auth_header.startswith("Bearer "):
        return ""
    return auth_header[7:]


def _decode_request_identity(token: str) -> RequestIdentity:
    try:
        payload: dict[str, typing.Any] = jwt.decode(
            token,
            _get_secret(),
            algorithms=[ALGORITHM],
            audience=EXPECTED_AUDIENCE,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        if payload.get("iss") not in EXPECTED_ISSUERS:
            raise jwt.InvalidIssuerError(f"Unexpected issuer: {payload.get('iss')}")
    except jwt.ExpiredSignatureError:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Request token expired",
        ) from None
    except jwt.InvalidTokenError as exc:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid request token: {exc}",
        ) from None

    scope, scopes = _normalize_scope_claims(payload)
    _enforce_hki_runtime_scope(scope, scopes)

    return RequestIdentity(
        user_id=str(payload.get("sub", "")),
        name=str(payload.get("name", "")),
        role=str(payload.get("role", "viewer")),
        scope=scope,
        scopes=scopes,
        org_id=str(payload.get("org_id", "default")),
        groups=[
            str(group).strip().lower() for group in payload.get("groups", []) if str(group).strip()
        ],
    )


def _emit_authenticated_log(request: fastapi.Request, identity: RequestIdentity) -> None:
    logger.info(
        "Authenticated request",
        extra={
            "user_id": identity.user_id,
            "role": identity.role,
            "scope": identity.scope,
            "method": request.method,
            "path": request.url.path,
        },
    )


def _emit_auth_audit(request: fastapi.Request, identity: RequestIdentity) -> None:
    # Fire-and-forget audit event to Pub/Sub (non-blocking)
    try:
        import asyncio

        from shared.pubsub_publisher import publish_event

        asyncio.ensure_future(
            publish_event(
                "agent-events",
                {
                    "event_type": "auth.request",
                    "user_id": identity.user_id,
                    "name": identity.name,
                    "role": identity.role,
                    "scope": identity.scope,
                    "method": request.method,
                    "path": request.url.path,
                },
            )
        )
    except Exception:
        logger.debug("Auth audit event skipped", exc_info=True)


def _normalize_scope_claims(payload: dict) -> tuple[str, list[str]]:
    raw_scope: str | None = _normalize_scope(payload.get("scope"))
    raw_scopes = payload.get("scopes", [])

    if isinstance(raw_scopes, str):
        scope_values: typing.Iterable[object] = [raw_scopes]
    elif isinstance(raw_scopes, list | tuple | set):
        scope_values = raw_scopes
    else:
        scope_values = []

    scopes: list[str] = []
    seen: set[str] = set()
    for candidate in scope_values:
        normalized_scope: str | None = _normalize_scope(candidate)
        if not normalized_scope:
            continue
        scope_key: str = normalized_scope.lower()
        if scope_key in seen:
            continue
        seen.add(scope_key)
        scopes.append(normalized_scope)

    if not scopes and raw_scope:
        scopes = [raw_scope]

    scope: str = raw_scope or (scopes[0] if scopes else GLOBAL_SCOPE)
    scope_key: str = scope.lower()
    scopes = [scope, *[candidate for candidate in scopes if candidate.lower() != scope_key]]

    return scope, scopes


def _enforce_hki_runtime_scope(scope: str, scopes: list[str]) -> None:
    if not _kb_hermetic_isolation_enabled():
        return

    if (
        not scope
        or _is_global_scope(scope)
        or any(_is_global_scope(candidate) for candidate in scopes)
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail=HKI_RUNTIME_SCOPE_ERROR,
        )


def _dev_identity() -> RequestIdentity:
    _enforce_hki_runtime_scope(_DEV_IDENTITY.scope, _DEV_IDENTITY.scopes)
    return _DEV_IDENTITY


async def verify_request_jwt(request: fastapi.Request) -> RequestIdentity:
    """
    FastAPI dependency — extracts and verifies the BFF request JWT.

    Returns RequestIdentity on success.
    Raises HTTPException(401) on missing/invalid/expired tokens.
    Bypassed when AUTH_ENABLED=false (local dev).
    """
    token: str = _extract_bearer_token(request)

    if not _auth_enabled():
        if not token:
            return _dev_identity()
        try:
            identity: RequestIdentity = _decode_request_identity(token)
        except Exception as exc:
            if _kb_hermetic_isolation_enabled():
                if isinstance(exc, fastapi.HTTPException):
                    raise
                raise fastapi.HTTPException(
                    status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                    detail=HKI_RUNTIME_SCOPE_ERROR,
                ) from exc

            reason: str = exc.detail if isinstance(exc, fastapi.HTTPException) else str(exc)
            logger.warning(
                "Auth disabled; falling back to dev identity",
                extra={
                    "path": request.url.path,
                    "reason": reason,
                },
            )
            return _dev_identity()
    elif not token:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization/X-Service-Auth header",
        )
    else:
        identity: RequestIdentity = _decode_request_identity(token)
    _emit_authenticated_log(request, identity)
    _emit_auth_audit(request, identity)

    return identity
