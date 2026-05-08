from __future__ import annotations

import base64
import json

import pytest

pytest.importorskip("starlette")

import starlette.applications
import starlette.requests
import starlette.responses
import starlette.routing
import starlette.testclient

import hki_runtime.fastapi


VALID_ENVELOPE = {
    "hki_version": "1.0",
    "envelope_id": "env_1",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "payments",
    "authorized_domains": ["payments", "fraud"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "p1",
    "issued_at": 0,
    "expires_at": 99999999999,
    "issuer": "edge",
    "signature": "sig",
}


def _b64(payload: dict) -> str:
    raw: bytes = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


async def _echo(request: starlette.requests.Request) -> starlette.responses.JSONResponse:
    env: hki_runtime.fastapi.HkiEnvelope = hki_runtime.fastapi.get_envelope(request)
    return starlette.responses.JSONResponse({"active_domain": env.active_domain})


def _make_app() -> starlette.applications.Starlette:
    app = starlette.applications.Starlette(routes=[starlette.routing.Route("/echo", _echo), starlette.routing.Route("/healthz", lambda r: starlette.responses.JSONResponse({"ok": True}))])
    app.add_middleware(hki_runtime.fastapi.HkiMiddleware, require_signature=True)
    return app


def test_decode_envelope_accepts_json_and_b64() -> None:
    raw_json: str = json.dumps(VALID_ENVELOPE)
    assert hki_runtime.fastapi.decode_envelope_header(raw_json)["org_id"] == "org_acme"
    assert hki_runtime.fastapi.decode_envelope_header(_b64(VALID_ENVELOPE))["org_id"] == "org_acme"


def test_middleware_attaches_envelope_when_valid() -> None:
    client = starlette.testclient.TestClient(_make_app())
    resp = client.get("/echo", headers={"X-HKI-Envelope": _b64(VALID_ENVELOPE)})
    assert resp.status_code == 200
    assert resp.json() == {"active_domain": "payments"}


def test_middleware_rejects_missing_envelope() -> None:
    client = starlette.testclient.TestClient(_make_app())
    resp = client.get("/echo")
    assert resp.status_code == 401
    assert resp.json()["error"] == "missing-envelope"


def test_middleware_rejects_global_active_domain() -> None:
    bad = {**VALID_ENVELOPE, "active_domain": "global", "authorized_domains": ["global"]}
    client = starlette.testclient.TestClient(_make_app())
    resp = client.get("/echo", headers={"X-HKI-Envelope": _b64(bad)})
    assert resp.status_code == 403
    body = resp.json()
    assert body["error"] == "envelope-invalid"
    assert any(i["code"] == "invalid-domain" for i in body["issues"])


def test_middleware_rejects_expired_envelope() -> None:
    bad = {**VALID_ENVELOPE, "expires_at": 1}
    client = starlette.testclient.TestClient(_make_app())
    resp = client.get("/echo", headers={"X-HKI-Envelope": _b64(bad)})
    assert resp.status_code == 401
    assert any(i["code"] == "expired-envelope" for i in resp.json()["issues"])


def test_middleware_exempts_health_paths() -> None:
    client = starlette.testclient.TestClient(_make_app())
    resp = client.get("/healthz")
    assert resp.status_code == 200
