"""Shared test fixtures for hki-shared package."""

from __future__ import annotations

import time

import jwt
import pytest

ALGORITHM = "HS256"
TEST_SECRET = "test-secret-key-for-unit-tests"
ISSUER = "agentic-bff"
AUDIENCE = "internal-services"


@pytest.fixture()
def _auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set required env vars for auth middleware."""
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)
    monkeypatch.setenv("AUTH_ENABLED", "true")


@pytest.fixture()
def _auth_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Disable auth for tests that don't need it."""
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.setenv("SERVICE_AUTH_SECRET", TEST_SECRET)


@pytest.fixture()
def valid_token() -> str:
    """Return a valid JWT token for testing."""
    payload = {
        "sub": "user-42",
        "name": "Test User",
        "role": "admin",
        "scope": "global",
        "scopes": ["global"],
        "org_id": "hki-labs",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=ALGORITHM)


@pytest.fixture()
def expired_token() -> str:
    """Return an expired JWT token for testing."""
    payload = {
        "sub": "user-42",
        "name": "Test User",
        "role": "viewer",
        "scope": "global",
        "scopes": ["global"],
        "org_id": "default",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "exp": int(time.time()) - 3600,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=ALGORITHM)


@pytest.fixture()
def wrong_audience_token() -> str:
    """Return a JWT with incorrect audience."""
    payload = {
        "sub": "user-42",
        "name": "Test User",
        "role": "viewer",
        "scope": "global",
        "scopes": ["global"],
        "iss": ISSUER,
        "aud": "wrong-audience",
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=ALGORITHM)
