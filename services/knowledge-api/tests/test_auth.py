from __future__ import annotations

import time

import fastapi
import jwt
import pytest
import starlette.requests

import src.core.auth

TEST_SECRET = "test-secret-key-for-knowledge-auth"


def _mint_token(
    *,
    scope: str | None = "pharmacy",
    scopes: list[str] | None = None,
    secret: str = TEST_SECRET,
) -> str:
    payload = {
        "sub": "user-99",
        "name": "Scoped User",
        "role": "manager",
        "org_id": "hki-labs",
        "groups": ["role:manager"],
        "iss": "agentic-bff",
        "aud": "internal-services",
        "exp": int(time.time()) + 3600,
    }
    if scope is not None:
        payload["scope"] = scope
    if scopes is not None:
        payload["scopes"] = scopes
    return jwt.encode(payload, secret, algorithm="HS256")


def _make_request(headers: dict[str, str] | None = None) -> starlette.requests.Request:
    header_items: list[tuple[bytes, bytes]] = [
        (key.lower().encode("latin-1"), value.encode("latin-1"))
        for key, value in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/v1/search",
        "headers": header_items,
    }
    return starlette.requests.Request(scope)


@pytest.mark.asyncio
async def test_dev_bypass_without_token_returns_dev_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")

    identity: src.core.auth.RequestIdentity = await src.core.auth.verify_request_jwt(
        _make_request()
    )

    assert identity.user_id == "0"
    assert identity.scope == "dev"
    assert identity.scopes == ["dev"]


@pytest.mark.asyncio
async def test_dev_bypass_honors_forwarded_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)

    payload = {
        "sub": "user-99",
        "name": "Scoped User",
        "role": "manager",
        "scope": "pharmacy",
        "scopes": ["pharmacy"],
        "org_id": "hki-labs",
        "groups": ["role:manager"],
        "iss": "agentic-bff",
        "aud": "internal-services",
        "exp": int(time.time()) + 3600,
    }
    token: str = jwt.encode(payload, TEST_SECRET, algorithm="HS256")

    identity: src.core.auth.RequestIdentity = await src.core.auth.verify_request_jwt(
        _make_request({"Authorization": f"Bearer {token}"})
    )

    assert identity.user_id == "user-99"
    assert identity.name == "Scoped User"
    assert identity.role == "manager"
    assert identity.scope == "pharmacy"
    assert identity.scopes == ["pharmacy"]
    assert identity.org_id == "hki-labs"


@pytest.mark.asyncio
async def test_dev_bypass_invalid_forwarded_token_falls_back_to_dev_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)

    payload = {
        "sub": "user-99",
        "name": "Scoped User",
        "role": "manager",
        "scope": "pharmacy",
        "scopes": ["pharmacy"],
        "org_id": "hki-labs",
        "groups": ["role:manager"],
        "iss": "agentic-bff",
        "aud": "internal-services",
        "exp": int(time.time()) + 3600,
    }
    token: str = jwt.encode(payload, "wrong-secret-for-dev", algorithm="HS256")

    identity: src.core.auth.RequestIdentity = await src.core.auth.verify_request_jwt(
        _make_request({"Authorization": f"Bearer {token}"})
    )

    assert identity.user_id == "0"
    assert identity.name == "dev-user"
    assert identity.role == "admin"
    assert identity.scope == "dev"
    assert identity.scopes == ["dev"]
    assert identity.org_id == "default"


@pytest.mark.asyncio
async def test_dev_bypass_missing_secret_falls_back_to_dev_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.delenv("SERVICE_AUTH_SECRET", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)

    payload = {
        "sub": "user-99",
        "name": "Scoped User",
        "role": "manager",
        "scope": "pharmacy",
        "scopes": ["pharmacy"],
        "org_id": "hki-labs",
        "groups": ["role:manager"],
        "iss": "agentic-bff",
        "aud": "internal-services",
        "exp": int(time.time()) + 3600,
    }
    token: str = jwt.encode(payload, TEST_SECRET, algorithm="HS256")

    identity: src.core.auth.RequestIdentity = await src.core.auth.verify_request_jwt(
        _make_request({"Authorization": f"Bearer {token}"})
    )

    assert identity.user_id == "0"
    assert identity.name == "dev-user"
    assert identity.role == "admin"
    assert identity.scope == "dev"
    assert identity.scopes == ["dev"]
    assert identity.org_id == "default"


@pytest.mark.asyncio
async def test_strict_hki_accepts_non_global_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)
    monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

    token: str = _mint_token(scope="pharmacy", scopes=["optical", "pharmacy"])

    identity: src.core.auth.RequestIdentity = await src.core.auth.verify_request_jwt(
        _make_request({"Authorization": f"Bearer {token}"})
    )

    assert identity.scope == "pharmacy"
    assert identity.scopes == ["pharmacy", "optical"]


@pytest.mark.asyncio
async def test_strict_hki_rejects_missing_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)
    monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

    token: str = _mint_token(scope=None, scopes=None)

    with pytest.raises(fastapi.HTTPException, match="non-global request scope") as exc_info:
        await src.core.auth.verify_request_jwt(_make_request({"Authorization": f"Bearer {token}"}))

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_strict_hki_rejects_global_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)
    monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

    token: str = _mint_token(scope="global", scopes=["global"])

    with pytest.raises(fastapi.HTTPException, match="non-global request scope") as exc_info:
        await src.core.auth.verify_request_jwt(_make_request({"Authorization": f"Bearer {token}"}))

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_strict_hki_rejects_global_in_scopes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)
    monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

    token: str = _mint_token(scope="pharmacy", scopes=["pharmacy", "global"])

    with pytest.raises(fastapi.HTTPException, match="non-global request scope") as exc_info:
        await src.core.auth.verify_request_jwt(_make_request({"Authorization": f"Bearer {token}"}))

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_strict_hki_blocks_dev_identity_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

    with pytest.raises(fastapi.HTTPException, match="non-global request scope") as exc_info:
        await src.core.auth.verify_request_jwt(_make_request())

    assert exc_info.value.status_code == 401
