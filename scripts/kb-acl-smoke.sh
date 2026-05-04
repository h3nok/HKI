#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_STACK_SCRIPT="${ROOT_DIR}/scripts/dev-stack.sh"
PYTHON_BIN="${KB_ACL_PYTHON:-${ROOT_DIR}/ingestion-pipeline-service/.venv/bin/python}"
INGEST_URL="${KB_ACL_INGEST_URL:-http://127.0.0.1:9608}"
KNOWLEDGE_URL="${KB_ACL_KNOWLEDGE_URL:-http://127.0.0.1:9609}"
AUTH_SECRET="${KB_AUTH_SECRET:-kb-auth-local-dev-secret-1234567890}"
KEEP_STACK="${KB_ACL_KEEP_STACK:-false}"
STARTED_STACK=false

timestamp() {
  date +"%H:%M:%S"
}

info() {
  printf "[%s] %s\n" "$(timestamp)" "$*"
}

error() {
  printf "[%s] ERROR: %s\n" "$(timestamp)" "$*" >&2
}

health_ready() {
  local url="$1"
  curl -fsS "${url}/health" >/dev/null 2>&1
}

cleanup() {
  if [[ "${STARTED_STACK}" == "true" && "${KEEP_STACK}" != "true" ]]; then
    info "Stopping isolated auth-enabled KB stack"
    bash "${DEV_STACK_SCRIPT}" stop-kb-auth >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if [[ ! -x "${PYTHON_BIN}" ]]; then
  error "Python runtime not found: ${PYTHON_BIN}"
  error "Run 'make bootstrap' first or set KB_ACL_PYTHON"
  exit 1
fi

if health_ready "${INGEST_URL}" && health_ready "${KNOWLEDGE_URL}"; then
  info "Using existing auth-enabled KB stack at ${INGEST_URL} and ${KNOWLEDGE_URL}"
else
  info "Starting isolated auth-enabled KB stack"
  bash "${DEV_STACK_SCRIPT}" start-kb-auth >/dev/null
  STARTED_STACK=true
fi

info "Running legal ACL smoke test"
KB_ACL_INGEST_URL="${INGEST_URL}" \
KB_ACL_KNOWLEDGE_URL="${KNOWLEDGE_URL}" \
KB_AUTH_SECRET="${AUTH_SECRET}" \
"${PYTHON_BIN}" - <<'PY'
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt

INGEST_URL = os.environ["KB_ACL_INGEST_URL"].rstrip("/")
KNOWLEDGE_URL = os.environ["KB_ACL_KNOWLEDGE_URL"].rstrip("/")
AUTH_SECRET = os.environ["KB_AUTH_SECRET"]


def make_token(email: str, groups: list[str], scopes: list[str]) -> str:
    now = int(time.time())
    payload = {
        "iss": "agentic-bff",
        "aud": "internal-services",
        "sub": email,
        "name": email,
        "role": "knowledge_manager",
        "scope": scopes[0] if scopes else "global",
        "scopes": scopes,
        "org_id": "hki",
        "groups": groups,
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm="HS256")


def request(
    method: str,
    url: str,
    token: str,
    body: dict | None = None,
) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return exc.code, parsed


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


legal_token = make_token(
    "legal.user@hki.com",
    ["group:legal", "role:knowledge_manager"],
    ["legal"],
)
denied_token = make_token(
    "general.user@hki.com",
    ["group:retail", "role:knowledge_manager"],
    ["legal"],
)
wrong_stream_token = make_token(
    "other.user@hki.com",
    ["group:legal", "role:knowledge_manager"],
    ["pharmacy"],
)

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
unique = f"legal-acl-smoke-{stamp}"
doc_id: str | None = None

summary: dict[str, object] = {
    "unique_marker": unique,
    "ingest_url": INGEST_URL,
    "knowledge_url": KNOWLEDGE_URL,
}

try:
    ingest_body = {
        "content": (
            "Attorney client privileged litigation hold guidance. "
            "Project Falcon merger memo. "
            f"Unique marker: {unique}. "
            "Only the legal response team may access this document."
        ),
        "title": f"Legal ACL Smoke {stamp}",
        "department": "Legal",
        "document_type": "policy",
        "tags": ["acl-smoke", unique],
        "classification": "privileged",
        "access_control": {
            "allowed_groups": ["group:legal"],
            "denied_groups": ["group:retail"],
        },
        "stream_id": "legal",
        "chunk_size": 256,
        "chunk_overlap": 32,
        "chunk_strategy": "sentence",
    }

    status, ingest_resp = request("POST", f"{INGEST_URL}/v1/ingest/text", legal_token, ingest_body)
    summary["ingest"] = {"status": status, "body": ingest_resp}
    require(status == 200, f"ingest failed: {status} {ingest_resp}")
    job_id = str(ingest_resp.get("job_id", ""))
    require(job_id, f"missing job_id in ingest response: {ingest_resp}")

    job_status = None
    job_resp: dict = {}
    for _ in range(30):
        status, job_resp = request("GET", f"{INGEST_URL}/v1/jobs/{job_id}", legal_token)
        summary["job"] = {"status": status, "body": job_resp}
        require(status == 200, f"job lookup failed: {status} {job_resp}")
        job = job_resp.get("job", {})
        job_status = job.get("status")
        doc_id = job.get("document_id") or doc_id
        if job_status == "completed" and doc_id:
            break
        time.sleep(0.25)

    require(job_status == "completed", f"job did not complete: {job_resp}")
    require(doc_id is not None, f"job missing document_id: {job_resp}")
    require(job_resp["job"]["org_id"] == "hki", f"unexpected org_id: {job_resp}")
    require(job_resp["job"]["stream_id"] == "legal", f"unexpected stream_id: {job_resp}")

    search_body = {
        "query": unique,
        "mode": "keyword",
        "top_k": 5,
        "include_pending": True,
        "include_content": True,
        "include_citations": True,
    }

    legal_status, legal_search = request(
        "POST", f"{KNOWLEDGE_URL}/v1/search", legal_token, search_body
    )
    denied_status, denied_search = request(
        "POST", f"{KNOWLEDGE_URL}/v1/search", denied_token, search_body
    )
    stream_status, stream_search = request(
        "POST", f"{KNOWLEDGE_URL}/v1/search", wrong_stream_token, search_body
    )
    summary["search_legal"] = {"status": legal_status, "body": legal_search}
    summary["search_denied"] = {"status": denied_status, "body": denied_search}
    summary["search_wrong_stream"] = {"status": stream_status, "body": stream_search}

    require(legal_status == 200, f"legal search failed: {legal_status} {legal_search}")
    require(denied_status == 200, f"denied search failed: {denied_status} {denied_search}")
    require(stream_status == 200, f"wrong-stream search failed: {stream_status} {stream_search}")
    require(legal_search.get("total_results", 0) >= 1, f"legal user saw no results: {legal_search}")
    require(denied_search.get("total_results", 0) == 0, f"denied user saw restricted doc: {denied_search}")
    require(
        stream_search.get("total_results", 0) == 0,
        f"wrong-stream user saw restricted doc: {stream_search}",
    )

    legal_doc_status, legal_doc = request(
        "GET", f"{KNOWLEDGE_URL}/v1/documents/{doc_id}", legal_token
    )
    denied_doc_status, denied_doc = request(
        "GET", f"{KNOWLEDGE_URL}/v1/documents/{doc_id}", denied_token
    )
    stream_doc_status, stream_doc = request(
        "GET", f"{KNOWLEDGE_URL}/v1/documents/{doc_id}", wrong_stream_token
    )
    summary["get_document_legal"] = {"status": legal_doc_status, "body": legal_doc}
    summary["get_document_denied"] = {"status": denied_doc_status, "body": denied_doc}
    summary["get_document_wrong_stream"] = {"status": stream_doc_status, "body": stream_doc}

    require(legal_doc_status == 200, f"legal document fetch failed: {legal_doc_status} {legal_doc}")
    require(denied_doc_status == 404, f"denied document fetch should 404: {denied_doc_status} {denied_doc}")
    require(stream_doc_status == 404, f"wrong-stream document fetch should 404: {stream_doc_status} {stream_doc}")

    delete_status, delete_resp = request(
        "DELETE", f"{KNOWLEDGE_URL}/v1/documents/{doc_id}", legal_token
    )
    summary["delete_document_legal"] = {"status": delete_status, "body": delete_resp}
    require(delete_status == 200, f"cleanup delete failed: {delete_status} {delete_resp}")
    doc_id = None

    print(json.dumps({"status": "pass", "summary": summary}, indent=2))
except AssertionError as exc:
    print(json.dumps({"status": "fail", "summary": summary, "error": str(exc)}, indent=2))
    sys.exit(1)
finally:
    if doc_id:
        request("DELETE", f"{KNOWLEDGE_URL}/v1/documents/{doc_id}", legal_token)
PY

info "ACL smoke passed"
