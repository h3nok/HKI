"""
Shared test fixtures for orchestrator-service.

Provides a pre-configured ``TestClient`` with auth disabled, as well as
mock settings and async helpers reusable across all test modules.
"""

from __future__ import annotations

import json
import os
import time
from unittest.mock import patch

import hki_runtime
import pytest
from fastapi.testclient import TestClient


def _hki_envelope_header(active_domain: str = "dev") -> str:
    now = int(time.time())
    envelope = {
        "hki_version": "1.0",
        "envelope_id": f"env-test-{active_domain}",
        "org_id": "default",
        "subject_id": "0",
        "active_domain": active_domain,
        "authorized_domains": [active_domain],
        "purpose": "chat",
        "risk_tier": "read-only",
        "policy_pack_id": "policy-test",
        "issued_at": now - 1,
        "expires_at": now + 300,
        "issuer": "agentic-bff",
    }
    envelope["signature"] = hki_runtime.sign_envelope(envelope, "unit-test-hki-secret")
    return json.dumps(envelope)


@pytest.fixture(autouse=True)
def _disable_auth():
    """Disable JWT auth for all tests unless explicitly overridden."""
    with patch.dict(
        os.environ,
        {"AUTH_ENABLED": "false", "HKI_SIGNING_SECRET": "unit-test-hki-secret"},
    ):
        yield


@pytest.fixture()
def client(_disable_auth):
    """TestClient with auth disabled."""
    from src.api.app import app

    with TestClient(app, headers={"X-HKI-Envelope": _hki_envelope_header()}) as c:
        yield c


@pytest.fixture()
def mock_settings():
    """Return a dict of commonly overridden settings for test isolation."""
    return {
        "REDIS_URL": "",
        "LLM_GATEWAY_URL": "http://test-llm:4000/v1",
        "LLM_API_KEY": "test-key",
        "ENVIRONMENT": "test",
        "AUTH_ENABLED": "false",
        "OTEL_ENABLED": "false",
    }
