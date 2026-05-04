"""
Tests for the auth middleware — JWT verification, dev bypass, Secret Manager fallback.
"""

from __future__ import annotations

import os
import time
from unittest.mock import patch

import jwt as pyjwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from shared.auth_middleware import (
    _DEV_IDENTITY,
    ALGORITHM,
    EXPECTED_AUDIENCE,
    EXPECTED_ISSUER,
    _auth_enabled,
    _get_secret,
)

from src.core.auth import RequestIdentity, verify_request_jwt

# ── Fixtures ──────────────────────────────────────────────────────────────

TEST_SECRET = "test-secret-for-jwt-verification-1234567890"


def _mint_token(
    sub: str = "42",
    name: str = "Test User",
    role: str = "viewer",
    scope: str = "global",
    scopes: list[str] | None = None,
    secret: str = TEST_SECRET,
    exp_offset: int = 30,
    iss: str = EXPECTED_ISSUER,
    aud: str = EXPECTED_AUDIENCE,
) -> str:
    """Mint a valid test JWT."""
    payload = {
        "sub": sub,
        "name": name,
        "role": role,
        "scope": scope,
        "scopes": scopes or ["global"],
        "iss": iss,
        "aud": aud,
        "exp": int(time.time()) + exp_offset,
    }
    return pyjwt.encode(payload, secret, algorithm=ALGORITHM)


@pytest.fixture
def app_with_auth():
    """FastAPI app with a single route protected by verify_request_jwt."""
    app = FastAPI()

    @app.get("/protected")
    async def protected(identity: RequestIdentity = Depends(verify_request_jwt)):
        return {
            "user_id": identity.user_id,
            "name": identity.name,
            "role": identity.role,
            "scope": identity.scope,
            "scopes": identity.scopes,
        }

    return app


@pytest.fixture
def client(app_with_auth):
    """TestClient with AUTH_ENABLED=true and a known secret."""
    with (
        patch.dict(
            os.environ,
            {
                "AUTH_ENABLED": "true",
                "SERVICE_AUTH_SECRET": TEST_SECRET,
            },
        ),
        TestClient(app_with_auth) as c,
    ):
        yield c


@pytest.fixture
def dev_client(app_with_auth):
    """TestClient with AUTH_ENABLED=false (dev bypass)."""
    with patch.dict(os.environ, {"AUTH_ENABLED": "false"}), TestClient(app_with_auth) as c:
        yield c


# ── Dev Bypass ────────────────────────────────────────────────────────────


class TestDevBypass:
    def test_dev_bypass_returns_dev_identity(self, dev_client):
        resp = dev_client.get("/protected")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == _DEV_IDENTITY.user_id
        assert data["role"] == "admin"

    def test_dev_bypass_no_auth_header_needed(self, dev_client):
        resp = dev_client.get("/protected")
        assert resp.status_code == 200


# ── Valid Token ───────────────────────────────────────────────────────────


class TestValidToken:
    def test_valid_token_extracts_identity(self, client):
        token = _mint_token(sub="99", name="Alice", role="admin", scope="halpr")
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "99"
        assert data["name"] == "Alice"
        assert data["role"] == "admin"
        assert data["scope"] == "halpr"

    def test_scopes_array_preserved(self, client):
        token = _mint_token(scopes=["global", "halpr", "pharmacy"])
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["scopes"] == ["global", "halpr", "pharmacy"]


# ── Rejection Cases ───────────────────────────────────────────────────────


class TestRejection:
    def test_missing_header_returns_401(self, client):
        resp = client.get("/protected")
        assert resp.status_code == 401
        assert "Missing Authorization" in resp.json()["detail"]

    def test_malformed_header_returns_401(self, client):
        resp = client.get("/protected", headers={"Authorization": "Basic abc123"})
        assert resp.status_code == 401

    def test_expired_token_returns_401(self, client):
        token = _mint_token(exp_offset=-10)  # already expired
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()

    def test_wrong_secret_returns_401(self, client):
        token = _mint_token(secret="wrong-secret-entirely")
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_wrong_issuer_returns_401(self, client):
        token = _mint_token(iss="evil-service")
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_wrong_audience_returns_401(self, client):
        token = _mint_token(aud="wrong-audience")
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    def test_garbage_token_returns_401(self, client):
        resp = client.get("/protected", headers={"Authorization": "Bearer not.a.jwt"})
        assert resp.status_code == 401


# ── _get_secret Resolution ────────────────────────────────────────────────


class TestGetSecret:
    def test_env_var_takes_priority(self):
        with patch.dict(os.environ, {"SERVICE_AUTH_SECRET": "env-secret"}):
            assert _get_secret() == "env-secret"

    def test_jwt_secret_fallback(self):
        with patch.dict(
            os.environ,
            {
                "SERVICE_AUTH_SECRET": "",
                "JWT_SECRET": "fallback-secret",
            },
            clear=False,
        ):
            # Patch out Secret Manager import to simulate local dev
            with patch.dict("sys.modules", {"shared": None, "shared.gcp_secrets": None}):
                assert _get_secret() == "fallback-secret"

    def test_no_secret_raises(self):
        with (
            patch.dict(
                os.environ,
                {
                    "SERVICE_AUTH_SECRET": "",
                    "JWT_SECRET": "",
                },
                clear=False,
            ),
            patch.dict("sys.modules", {"shared": None, "shared.gcp_secrets": None}),
        ):
            with pytest.raises(RuntimeError, match="SECRET"):
                _get_secret()


# ── _auth_enabled ─────────────────────────────────────────────────────────


class TestAuthEnabled:
    @pytest.mark.parametrize(
        "val,expected",
        [
            ("true", True),
            ("True", True),
            ("1", True),
            ("yes", True),
            ("false", False),
            ("False", False),
            ("0", False),
            ("no", False),
        ],
    )
    def test_auth_enabled_parsing(self, val, expected):
        with patch.dict(os.environ, {"AUTH_ENABLED": val}):
            assert _auth_enabled() == expected
