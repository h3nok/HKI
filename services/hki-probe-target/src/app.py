"""hki-probe-target: minimal FastAPI service enforcing HkiMiddleware.

Handles all 10 L4 HTTP probe scenarios:
  P01–P05, P07, P10  — rejected by HkiMiddleware before reaching routes
  P06  — route rejects body scope-override via reject_conflicting_scope_argument
  P08  — route echoes active_domain so cross-domain requests return distinct bodies
  P09  — route rejects cross-domain artifact_domain via assert_artifact_visible
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

import hki_runtime
from hki_runtime.fastapi import HkiMiddleware, get_envelope

app = FastAPI(title="hki-probe-target", version="1.0.0")

# require_signature=False because the probe sends a demo signature string, not
# a real cryptographic signature. In a production gateway, set this to True.
app.add_middleware(HkiMiddleware, require_signature=False)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"ok": True}


@app.post("/v1/chat")
async def chat(request: Request) -> JSONResponse:
    envelope = get_envelope(request)

    try:
        body: dict = await request.json()
    except Exception:
        body = {}

    # P06: reject body fields that attempt to override envelope scope
    scope_error = hki_runtime.reject_conflicting_scope_argument(envelope, body)
    if scope_error:
        return JSONResponse(
            {"error": "scope-override", "message": scope_error},
            status_code=403,
        )

    # P09: reject cross-domain artifact references
    artifact_domain = body.get("artifact_domain")
    if artifact_domain:
        label = hki_runtime.HkiArtifactLabel(
            org_id=envelope.org_id,
            domain=str(artifact_domain),
            artifact_type="document",
            artifact_id="probe-artifact",
        )
        issue = hki_runtime.assert_artifact_visible(envelope, label)
        if issue:
            return JSONResponse(
                {"error": issue.code, "message": issue.message},
                status_code=403,
            )

    # P08: echo active_domain so same query under different domains returns distinct bodies
    return JSONResponse({"ok": True, "domain": envelope.active_domain})
