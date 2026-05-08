"""Tests for shared.auth_middleware — JWT verification."""

from __future__ import annotations

import time

import fastapi
import fastapi.testclient
import jwt
import pytest
from httpx import Response

import shared.auth_middleware

TEST_SECRET = "test-secret-key-for-unit-tests"
ISSUER = "agentic-bff"
AUDIENCE = "internal-services"


def _mint_token(
    *,
    scope: str | None = "pharmacy",
    scopes: list[str] | None = None,
) -> str:
    payload = {
        "sub": "user-42",
        "name": "Test User",
        "role": "admin",
        "org_id": "hki-labs",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "exp": int(time.time()) + 3600,
    }
    if scope is not None:
        payload["scope"] = scope
    if scopes is not None:
        payload["scopes"] = scopes
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


def _make_app() -> fastapi.FastAPI:
    """Create a minimal FastAPI app with a protected route."""
    app = fastapi.FastAPI()

    @app.get("/protected")
    async def protected(
        identity: shared.auth_middleware.RequestIdentity = pytest.importorskip(
            "fastapi"
        ).Depends(shared.auth_middleware.verify_request_jwt),
    ):
        return {
            "user_id": identity.user_id,
            "name": identity.name,
            "role": identity.role,
            "org_id": identity.org_id,
            "scope": identity.scope,
            "scopes": identity.scopes,
        }

    return app


@pytest.mark.usefixtures("_auth_env")
class TestAuthEnabled:
    """Tests with AUTH_ENABLED=true."""

    def test_missing_header_returns_401(self) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get("/protected")
        assert resp.status_code == 401
        assert "Missing Authorization" in resp.json()["detail"]

    def test_valid_token_succeeds(self, valid_token: str) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {valid_token}"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "user-42"
        assert body["name"] == "Test User"
        assert body["role"] == "admin"
        assert body["org_id"] == "hki-labs"

    def test_expired_token_returns_401(self, expired_token: str) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()

    def test_wrong_audience_returns_401(self, wrong_audience_token: str) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {wrong_audience_token}"}
        )
        assert resp.status_code == 401

    def test_malformed_token_returns_401(self) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert resp.status_code == 401

    def test_wrong_prefix_returns_401(self, valid_token: str) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Token {valid_token}"}
        )
        assert resp.status_code == 401


@pytest.mark.usefixtures("_auth_disabled")
class TestAuthDisabled:
    """Tests with AUTH_ENABLED=false — dev identity bypass."""

    def test_dev_identity_bypass(self) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get("/protected")
        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "0"
        assert body["name"] == "dev-user"
        assert body["role"] == "admin"

    def test_valid_token_uses_claims_when_auth_disabled(self, valid_token: str) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {valid_token}"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "user-42"
        assert body["name"] == "Test User"
        assert body["role"] == "admin"
        assert body["org_id"] == "hki-labs"

    def test_invalid_token_falls_back_to_dev_identity_when_auth_disabled(self) -> None:
        client = fastapi.testclient.TestClient(_make_app())
        bad_token: str = jwt.encode(
            {
                "sub": "user-42",
                "name": "Bad Secret User",
                "role": "admin",
                "scope": "pharmacy",
                "scopes": ["pharmacy"],
                "org_id": "hki-labs",
                "iss": "agentic-bff",
                "aud": "internal-services",
                "exp": int(time.time()) + 3600,
            },
            "wrong-secret-for-dev",
            algorithm="HS256",
        )

        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {bad_token}"}
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "0"
        assert body["name"] == "dev-user"
        assert body["role"] == "admin"
        assert body["org_id"] == "default"

    def test_missing_secret_falls_back_to_dev_identity_when_auth_disabled(
        self,
        monkeypatch: pytest.MonkeyPatch,
        valid_token: str,
    ) -> None:
        monkeypatch.delenv("SERVICE_AUTH_SECRET", raising=False)
        monkeypatch.delenv("JWT_SECRET", raising=False)

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {valid_token}"}
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "0"
        assert body["name"] == "dev-user"
        assert body["role"] == "admin"
        assert body["org_id"] == "default"


class TestOnAuthenticatedHook:
    """Test the post-auth callback hook."""

    @pytest.mark.usefixtures("_auth_env")
    def test_hook_called_with_token(self, valid_token: str) -> None:
        from shared.auth_middleware import set_on_authenticated_hook

        captured: list[str] = []
        set_on_authenticated_hook(captured.append)
        try:
            client = fastapi.testclient.TestClient(_make_app())
            client.get("/protected", headers={"Authorization": f"Bearer {valid_token}"})
            assert len(captured) == 1
            assert captured[0] == valid_token
        finally:
            set_on_authenticated_hook(None)  # type: ignore[arg-type]


@pytest.mark.usefixtures("_auth_env")
class TestHermeticScopeEnforcement:
    """Tests with KB_HERMETIC_ISOLATION=true."""

    def test_non_global_scope_succeeds(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")
        token: str = _mint_token(scope="pharmacy", scopes=["optical", "pharmacy"])

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {token}"}
        )

        assert resp.status_code == 200
        assert resp.json()["scope"] == "pharmacy"
        assert resp.json()["scopes"] == ["pharmacy", "optical"]

    def test_missing_scope_claims_are_rejected(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")
        token: str = _mint_token(scope=None, scopes=None)

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {token}"}
        )

        assert resp.status_code == 401
        assert "non-global request scope" in resp.json()["detail"]

    def test_global_scope_is_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")
        token: str = _mint_token(scope="global", scopes=["global"])

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {token}"}
        )

        assert resp.status_code == 401
        assert "non-global request scope" in resp.json()["detail"]

    def test_global_in_scopes_is_rejected(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")
        token: str = _mint_token(scope="pharmacy", scopes=["pharmacy", "global"])

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get(
            "/protected", headers={"Authorization": f"Bearer {token}"}
        )

        assert resp.status_code == 401
        assert "non-global request scope" in resp.json()["detail"]


@pytest.mark.usefixtures("_auth_disabled")
class TestHermeticScopeWithAuthDisabled:
    def test_dev_identity_does_not_bypass_strict_scope(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("KB_HERMETIC_ISOLATION", "true")

        client = fastapi.testclient.TestClient(_make_app())
        resp: Response = client.get("/protected")

        assert resp.status_code == 401
        assert "non-global request scope" in resp.json()["detail"]
