#!/usr/bin/env python3

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import dataclasses
import typing

TRPC_NULL_INPUT = (
    "%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A"
    "%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D%7D"
)
HTTP_TIMEOUT = float(os.environ.get("PROD_E2E_HTTP_TIMEOUT_SEC", "30"))
CHAT_TIMEOUT = float(os.environ.get("PROD_E2E_CHAT_TIMEOUT_SEC", "90"))
JOB_TIMEOUT = float(os.environ.get("PROD_E2E_JOB_TIMEOUT_SEC", "150"))
SEARCH_TIMEOUT = float(os.environ.get("PROD_E2E_SEARCH_TIMEOUT_SEC", "60"))
POLL_INTERVAL = float(os.environ.get("PROD_E2E_POLL_INTERVAL_SEC", "2"))
ORG_ID: str = os.environ.get("PROD_E2E_ORG_ID", "hki")
KB_STREAM_ID: str = os.environ.get("PROD_E2E_KB_STREAM_ID", "global").strip() or "global"
IAP_TEST_EMAIL: str = (
    os.environ.get("PROD_E2E_ADMIN_EMAIL", "hghebrechristos@hki.com").strip().lower()
)

if os.environ.get("ALLOW_LEGACY_CLOUD_RUN", "false").lower() != "true":
    raise SystemExit(
        "Cloud Run production E2E is retired. Use scripts/test-k8s-e2e.sh or 'make test-prod'. "
        "Set ALLOW_LEGACY_CLOUD_RUN=true only for break-glass legacy work."
    )


def build_ssl_context() -> ssl.SSLContext:
    if os.environ.get("PROD_E2E_INSECURE_TLS", "").lower() in ("1", "true", "yes"):
        return ssl._create_unverified_context()

    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


SSL_CONTEXT: ssl.SSLContext = build_ssl_context()


class CheckFailed(Exception):
    pass


@dataclasses.dataclass
class HttpResponse:
    status: int
    text: str
    data: typing.Any
    headers: typing.Dict[str, str]


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl) -> None:
        return None


class Harness:
    def __init__(self) -> None:
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.skipped = 0

    def section(self, title: str) -> None:
        print("")
        print(title)
        print("-" * len(title))

    def info(self, label: str, detail: str) -> None:
        print(f"  INFO  {label:<42} {detail}")

    def skip(self, label: str, detail: str) -> None:
        self.total += 1
        self.skipped += 1
        print(f"  SKIP  {label:<42} {detail}")

    def check(self, label: str, ok: bool, detail: str) -> bool:
        self.total += 1
        if ok:
            self.passed += 1
            print(f"  PASS  {label:<42} {detail}")
        else:
            self.failed += 1
            print(f"  FAIL  {label:<42} {detail}")
        return ok

    def require(self, label: str, ok: bool, detail: str) -> None:
        if not self.check(label, ok, detail):
            raise CheckFailed(detail)

    def finish(self) -> int:
        print("")
        print("=" * 72)
        if self.failed == 0:
            print(f"ALL {self.total} CHECKS PASSED")
        else:
            print(
                f"{self.passed}/{self.total} passed, {self.failed} failed, {self.skipped} skipped"
            )
        print("=" * 72)
        return 1 if self.failed else 0


def env_required(name: str) -> str:
    value: str = os.environ.get(name, "").strip()
    if not value:
        raise CheckFailed(f"Missing required environment variable: {name}")
    return value


def parse_json(raw: str) -> typing.Any:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def http_request(
    method: str,
    url: str,
    headers: typing.Optional[typing.Dict[str, str]] = None,
    json_body: typing.Optional[typing.Dict[str, typing.Any]] = None,
    timeout: float = HTTP_TIMEOUT,
    follow_redirects: bool = True,
) -> HttpResponse:
    request_headers: dict[str, str] = {"User-Agent": "hki-ai-platform-prod-e2e/1.0"}
    if headers:
        request_headers.update(headers)

    data = None
    if json_body is not None:
        data: bytes = json.dumps(json_body).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    opener: urllib.request.OpenerDirector = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=SSL_CONTEXT),
        *([] if follow_redirects else [NoRedirectHandler()]),
    )

    try:
        with opener.open(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return HttpResponse(
                status=response.status,
                text=raw,
                data=parse_json(raw),
                headers=dict(response.headers.items()),
            )
    except urllib.error.HTTPError as exc:
        raw: str = exc.read().decode("utf-8", errors="replace")
        return HttpResponse(
            status=exc.code,
            text=raw,
            data=parse_json(raw),
            headers=dict(exc.headers.items()),
        )
    except urllib.error.URLError as exc:
        return HttpResponse(
            status=0,
            text=str(exc.reason or exc),
            data=None,
            headers={},
        )


def b64url_json(payload: typing.Dict[str, typing.Any]) -> str:
    encoded: bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(encoded).rstrip(b"=").decode("ascii")


def sign_hs256(payload: typing.Dict[str, typing.Any], secret: str) -> str:
    header: dict[str, str] = {"alg": "HS256", "typ": "JWT"}
    signing_input: str = f"{b64url_json(header)}.{b64url_json(payload)}"
    signature: bytes = hmac.new(
        secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    token_suffix: str = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{signing_input}.{token_suffix}"


def make_service_token(
    secret: str,
    user_id: str,
    name: str,
    role: str = "admin",
    scope: str = "global",
    scopes: typing.Optional[typing.List[str]] = None,
    org_id: str = ORG_ID,
    groups: typing.Optional[typing.List[str]] = None,
    ttl_seconds: int = 600,
) -> str:
    issued_at = int(time.time())
    payload = {
        "iss": "agentic-bff",
        "aud": "internal-services",
        "sub": user_id,
        "name": name,
        "role": role,
        "scope": scope,
        "scopes": scopes or [scope],
        "org_id": org_id,
        "groups": groups or [f"role:{role}"],
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
    }
    return sign_hs256(payload, secret)


def make_session_cookie(
    secret: str, open_id: str, name: str, ttl_seconds: int = 600
) -> str:
    issued_at = int(time.time())
    payload = {
        "openId": open_id,
        "appId": "agentic-prod-e2e",
        "name": name,
        "sub": open_id,
        "iss": "agentic-bff",
        "aud": "agentic-client",
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
    }
    return sign_hs256(payload, secret)


def login_via_iap(base_url: str, email: str, open_id: str) -> str:
    response: HttpResponse = http_request(
        "GET",
        f"{base_url}/api/auth/google/login",
        headers={
            "x-goog-authenticated-user-email": f"accounts.google.com:{email}",
            "x-goog-authenticated-user-id": f"accounts.google.com:{open_id}",
        },
        follow_redirects=False,
    )
    set_cookie: str | None = response.headers.get("Set-Cookie") or response.headers.get(
        "set-cookie"
    )
    if response.status not in (301, 302, 303, 307, 308) or not set_cookie:
        raise CheckFailed(
            f"IAP login failed: HTTP {response.status}: {response.text[:200]}"
        )
    return set_cookie.split(";", 1)[0]


def cookie_header(cookie: str) -> str:
    return cookie if "=" in cookie else f"app_session_id={cookie}"


def trpc_query(
    base_url: str, procedure: str, cookie: typing.Optional[str] = None
) -> HttpResponse:
    headers: typing.Dict[str, str] = {}
    if cookie:
        headers["Cookie"] = cookie_header(cookie)
    return http_request(
        "GET",
        f"{base_url}/api/trpc/{procedure}?batch=1&input={TRPC_NULL_INPUT}",
        headers=headers,
    )


def trpc_mutation(
    base_url: str,
    procedure: str,
    payload: typing.Dict[str, typing.Any],
    cookie: typing.Optional[str] = None,
    timeout: float = HTTP_TIMEOUT,
) -> HttpResponse:
    headers: typing.Dict[str, str] = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie_header(cookie)
    return http_request(
        "POST",
        f"{base_url}/api/trpc/{procedure}?batch=1",
        headers=headers,
        json_body={"0": {"json": payload}},
        timeout=timeout,
    )


def trpc_extract(response: HttpResponse) -> tuple[typing.Any, typing.Any]:
    if not isinstance(response.data, list) or not response.data:
        return None, {"message": f"Unexpected tRPC payload: {response.text[:200]}"}

    item = response.data[0]
    if not isinstance(item, dict):
        return None, {"message": f"Unexpected tRPC item: {item!r}"}

    if "error" in item:
        error_json = item.get("error", {})
        return None, error_json.get("json", error_json)

    result = item.get("result", {})
    data = result.get("data", {}) if isinstance(result, dict) else {}
    return data.get("json"), None


def bearer_header(token: str) -> typing.Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def summarize_json(value: typing.Any, limit: int = 120) -> str:
    try:
        raw: str = json.dumps(value, separators=(",", ":"), sort_keys=True)
    except TypeError:
        raw = str(value)
    return raw if len(raw) <= limit else f"{raw[: limit - 3]}..."


def run_bff_public_checks(
    harness: Harness, agentic_url: str, iap_url: typing.Optional[str]
) -> None:
    harness.section("Agentic BFF")

    for label, path in [
        ("Health check", "/health"),
        ("Frontend served", "/"),
        ("Login page", "/login"),
        ("Chat SPA route", "/chat"),
        ("Admin SPA route", "/admin"),
    ]:
        response: HttpResponse = http_request("GET", f"{agentic_url}{path}")
        harness.check(label, response.status == 200, f"HTTP {response.status}")

    auth_response: HttpResponse = trpc_query(agentic_url, "auth.me")
    auth_data, auth_error = trpc_extract(auth_response)
    harness.check(
        "Public auth.me returns null",
        auth_response.status == 200 and auth_error is None and auth_data is None,
        f"HTTP {auth_response.status}",
    )

    unauth_response: HttpResponse = trpc_mutation(
        agentic_url,
        "chat.createTask",
        {"title": "prod-e2e-unauth", "scope": "global"},
    )
    _, unauth_error = trpc_extract(unauth_response)
    unauth_status = None
    if isinstance(unauth_error, dict):
        unauth_data = unauth_error.get("data")
        if isinstance(unauth_data, dict):
            unauth_status = unauth_data.get("httpStatus")
    harness.check(
        "Unauthenticated mutation blocked",
        unauth_status == 401,
        f"HTTP {unauth_response.status}",
    )

    if iap_url:
        iap_response: HttpResponse = http_request("GET", iap_url)
        harness.check(
            "IAP redirects unauthenticated",
            iap_response.status in (301, 302, 303, 307, 308),
            f"HTTP {iap_response.status}",
        )
    else:
        harness.skip("IAP redirect check", "set AGENTIC_IAP_URL or IAP_URL to enable")


def run_bff_authenticated_checks(
    harness: Harness, agentic_url: str, secret: str
) -> None:
    harness.section("Agentic Authenticated Flow")

    open_id: str = f"prod-e2e-{uuid.uuid4().hex[:10]}"
    cookie: str = login_via_iap(agentic_url, IAP_TEST_EMAIL, open_id)
    user_id: typing.Optional[int] = None

    auth_response: HttpResponse = trpc_query(agentic_url, "auth.me", cookie=cookie)
    auth_data, auth_error = trpc_extract(auth_response)
    if isinstance(auth_data, dict) and auth_data.get("role") == "admin":
        user_id = auth_data.get("id") if isinstance(auth_data.get("id"), int) else None
    harness.require(
        "Authenticated auth.me",
        auth_response.status == 200
        and auth_error is None
        and isinstance(auth_data, dict)
        and auth_data.get("email") == IAP_TEST_EMAIL
        and auth_data.get("role") in {"admin", "manager"},
        f"HTTP {auth_response.status}: {summarize_json(auth_data or auth_error)}",
    )

    service_health_response: HttpResponse = trpc_query(
        agentic_url, "knowledge.serviceHealth", cookie=cookie
    )
    service_health_data, service_health_error = trpc_extract(service_health_response)
    services = (
        service_health_data.get("services", [])
        if isinstance(service_health_data, dict)
        else []
    )
    service_health_ok: bool = bool(services) and all(
        service.get("ok") for service in services
    )
    service_health_detail: str = ", ".join(
        f"{service.get('name')}={'ok' if service.get('ok') else 'down'}"
        for service in services
    ) or summarize_json(service_health_error)
    harness.check(
        "Manager serviceHealth",
        service_health_response.status == 200 and service_health_ok,
        service_health_detail or f"HTTP {service_health_response.status}",
    )

    conversation_id = None
    try:
        create_response: HttpResponse = trpc_mutation(
            agentic_url,
            "chat.createTask",
            {"title": f"prod-e2e-{uuid.uuid4().hex[:8]}", "scope": "global"},
            cookie=cookie,
        )
        create_data, create_error = trpc_extract(create_response)
        conversation_id = (
            create_data.get("id") if isinstance(create_data, dict) else None
        )
        harness.require(
            "Create task",
            create_response.status == 200
            and create_error is None
            and bool(conversation_id),
            f"HTTP {create_response.status}: {summarize_json(create_data or create_error)}",
        )

        send_response: HttpResponse = trpc_mutation(
            agentic_url,
            "chat.sendMessage",
            {
                "conversationId": conversation_id,
                "content": "Say hello in one sentence.",
                "scope": "global",
            },
            cookie=cookie,
            timeout=CHAT_TIMEOUT,
        )
        send_data, send_error = trpc_extract(send_response)
        content = send_data.get("content", "") if isinstance(send_data, dict) else ""
        harness.check(
            "Authenticated BFF chat",
            send_response.status == 200
            and send_error is None
            and bool(content.strip()),
            content[:80] or summarize_json(send_error),
        )
    finally:
        if conversation_id:
            delete_response: HttpResponse = trpc_mutation(
                agentic_url,
                "chat.deleteTask",
                {"conversationId": conversation_id},
                cookie=cookie,
            )
            delete_data, delete_error = trpc_extract(delete_response)
            harness.check(
                "Delete task cleanup",
                delete_response.status == 200
                and delete_error is None
                and isinstance(delete_data, dict)
                and delete_data.get("success") is True,
                summarize_json(delete_data or delete_error),
            )

        if user_id is not None:
            delete_user_response: HttpResponse = trpc_mutation(
                agentic_url,
                "admin.deleteSyntheticUser",
                {"userId": user_id},
                cookie=cookie,
            )
            delete_user_data, delete_user_error = trpc_extract(delete_user_response)
            harness.check(
                "Delete synthetic user cleanup",
                delete_user_response.status == 200
                and delete_user_error is None
                and isinstance(delete_user_data, dict)
                and delete_user_data.get("success") is True,
                summarize_json(delete_user_data or delete_user_error),
            )


def check_health_pair(harness: Harness, label: str, base_url: str) -> None:
    live: HttpResponse = http_request("GET", f"{base_url}/health")
    harness.check(f"{label} /health", live.status == 200, f"HTTP {live.status}")

    ready: HttpResponse = http_request("GET", f"{base_url}/health/ready")
    harness.check(f"{label} /health/ready", ready.status == 200, f"HTTP {ready.status}")


def run_orchestrator_checks(
    harness: Harness, orchestrator_url: str, secret: str
) -> None:
    harness.section("Orchestrator Service")
    check_health_pair(harness, "Orchestrator", orchestrator_url)

    invalid_response: HttpResponse = http_request(
        "POST",
        f"{orchestrator_url}/v1/chat",
        headers={
            "Content-Type": "application/json",
            "X-Service-Auth": "Bearer invalid",
        },
        json_body={
            "conversation_id": f"prod-e2e-invalid-{uuid.uuid4().hex[:8]}",
            "message": "Hello",
            "user_id": "prod-e2e-invalid",
        },
    )
    harness.check(
        "Rejects invalid service JWT",
        invalid_response.status == 401,
        f"HTTP {invalid_response.status}",
    )

    token: str = make_service_token(
        secret,
        user_id="prod-e2e-orchestrator",
        name="Prod E2E Orchestrator",
        role="admin",
        scope="global",
        scopes=["global"],
    )
    chat_response: HttpResponse = http_request(
        "POST",
        f"{orchestrator_url}/v1/chat",
        headers={
            "Content-Type": "application/json",
            "X-Service-Auth": f"Bearer {token}",
        },
        json_body={
            "conversation_id": f"prod-e2e-orch-{uuid.uuid4().hex[:8]}",
            "message": "Say hello in one sentence.",
            "user_id": "prod-e2e-orchestrator",
            "history": [],
            "scope": "global",
            "scopes": ["global"],
        },
        timeout=CHAT_TIMEOUT,
    )
    chat_data = chat_response.data if isinstance(chat_response.data, dict) else {}
    content = chat_data.get("content", "") if isinstance(chat_data, dict) else ""
    harness.check(
        "Direct chat response",
        chat_response.status == 200
        and bool(content.strip())
        and isinstance(chat_data.get("trace"), list)
        and isinstance(chat_data.get("guardrails"), dict),
        content[:80] or summarize_json(chat_data),
    )


def poll_job_completion(pipeline_url: str, token: str, job_id: str) -> typing.Dict[str, typing.Any]:
    deadline: float = time.monotonic() + JOB_TIMEOUT
    last_job: typing.Dict[str, typing.Any] = {}

    while time.monotonic() < deadline:
        response: HttpResponse = http_request(
            "GET",
            f"{pipeline_url}/v1/jobs/{job_id}",
            headers=bearer_header(token),
            timeout=HTTP_TIMEOUT,
        )
        if response.status == 200 and isinstance(response.data, dict):
            job = response.data.get("job", {})
            if isinstance(job, dict):
                last_job = response.data
                status = str(job.get("status", ""))
                if status == "completed" and job.get("document_id"):
                    return response.data
                if status == "failed":
                    return response.data
            else:
                last_job = {
                    "status": response.status,
                    "body": response.data
                    if response.data is not None
                    else response.text,
                }
        time.sleep(POLL_INTERVAL)

    return last_job


def poll_search_result(
    knowledge_url: str,
    token: str,
    unique_marker: str,
    document_id: str,
) -> typing.Dict[str, typing.Any]:
    deadline: float = time.monotonic() + SEARCH_TIMEOUT
    last_result: typing.Dict[str, typing.Any] = {}

    body = {
        "query": unique_marker,
        "mode": "keyword",
        "top_k": 5,
        "include_pending": True,
        "include_content": True,
        "include_citations": True,
    }

    while time.monotonic() < deadline:
        response: HttpResponse = http_request(
            "POST",
            f"{knowledge_url}/v1/search",
            headers=bearer_header(token),
            json_body=body,
            timeout=HTTP_TIMEOUT,
        )
        if response.status == 200 and isinstance(response.data, dict):
            last_result = response.data
            results = response.data.get("results", [])
            if isinstance(results, list):
                for item in results:
                    if not isinstance(item, dict):
                        continue
                    if item.get("document_id") == document_id or unique_marker in str(
                        item.get("content", "")
                    ):
                        return response.data
            else:
                last_result = {
                    "status": response.status,
                    "body": response.data
                    if response.data is not None
                    else response.text,
                }
        time.sleep(POLL_INTERVAL)

    return last_result


def run_knowledge_pipeline_checks(
    harness: Harness,
    pipeline_url: str,
    knowledge_url: str,
    pipeline_secret: str,
    knowledge_secret: str,
) -> None:
    harness.section("Knowledge Ingestion And Retrieval")
    check_health_pair(harness, "Pipeline", pipeline_url)
    check_health_pair(harness, "Knowledge API", knowledge_url)

    unique_marker: str = f"prod-e2e-{uuid.uuid4().hex[:12]}"
    pipeline_token: str = make_service_token(
        pipeline_secret,
        user_id="prod-e2e-kb",
        name="Prod E2E KB",
        role="knowledge_manager",
        scope=KB_STREAM_ID,
        scopes=[KB_STREAM_ID],
        groups=["role:knowledge_manager", "group:innovation"],
    )
    knowledge_token: str = make_service_token(
        knowledge_secret,
        user_id="prod-e2e-kb",
        name="Prod E2E KB",
        role="knowledge_manager",
        scope=KB_STREAM_ID,
        scopes=[KB_STREAM_ID],
        groups=["role:knowledge_manager", "group:innovation"],
    )

    document_id = None
    try:
        ingest_response: HttpResponse = http_request(
            "POST",
            f"{pipeline_url}/v1/ingest/text",
            headers=bearer_header(pipeline_token),
            json_body={
                "title": f"Prod E2E {unique_marker}",
                "stream_id": KB_STREAM_ID,
                "department": "Innovation",
                "document_type": "policy",
                "tags": ["prod-e2e", unique_marker],
                "content": (
                    "Production end-to-end validation document for the HKI AI Platform. "
                    f"Unique marker: {unique_marker}. "
                    "This record is created by the deployed integration suite and should be deleted after verification."
                ),
            },
            timeout=HTTP_TIMEOUT,
        )
        ingest_data = (
            ingest_response.data if isinstance(ingest_response.data, dict) else {}
        )
        job_id = ingest_data.get("job_id", "") if isinstance(ingest_data, dict) else ""
        harness.require(
            "Submit text ingestion job",
            ingest_response.status == 200 and bool(job_id),
            summarize_json(ingest_data),
        )

        job_data: typing.Dict[str, typing.Any] = poll_job_completion(pipeline_url, pipeline_token, str(job_id))
        job = job_data.get("job", {}) if isinstance(job_data, dict) else {}
        document_id = job.get("document_id") if isinstance(job, dict) else None
        harness.require(
            "Ingestion job completed",
            isinstance(job, dict)
            and job.get("status") == "completed"
            and bool(document_id),
            summarize_json(job_data),
        )

        search_data: typing.Dict[str, typing.Any] = poll_search_result(
            knowledge_url, knowledge_token, unique_marker, str(document_id)
        )
        results = (
            search_data.get("results", []) if isinstance(search_data, dict) else []
        )
        found = False
        if isinstance(results, list):
            for item in results:
                if not isinstance(item, dict):
                    continue
                if item.get("document_id") == document_id or unique_marker in str(
                    item.get("content", "")
                ):
                    found = True
                    break
        harness.require(
            "Search returns ingested document",
            found,
            summarize_json(search_data),
        )

        document_response: HttpResponse = http_request(
            "GET",
            f"{knowledge_url}/v1/documents/{document_id}",
            headers=bearer_header(knowledge_token),
            timeout=HTTP_TIMEOUT,
        )
        harness.check(
            "Get document metadata",
            document_response.status == 200
            and isinstance(document_response.data, dict),
            summarize_json(document_response.data),
        )

        content_response: HttpResponse = http_request(
            "GET",
            f"{knowledge_url}/v1/documents/{document_id}/content",
            headers=bearer_header(knowledge_token),
            timeout=HTTP_TIMEOUT,
        )
        content_data = (
            content_response.data if isinstance(content_response.data, dict) else {}
        )
        content_text = (
            content_data.get("content", "") if isinstance(content_data, dict) else ""
        )
        harness.check(
            "Get document content",
            content_response.status == 200 and unique_marker in content_text,
            content_text[:80] or summarize_json(content_data),
        )
    finally:
        if document_id:
            delete_response: HttpResponse = http_request(
                "DELETE",
                f"{knowledge_url}/v1/documents/{document_id}",
                headers=bearer_header(knowledge_token),
                timeout=HTTP_TIMEOUT,
            )
            harness.check(
                "Delete document cleanup",
                delete_response.status == 200,
                f"HTTP {delete_response.status}",
            )


def poll_recent_event(
    analytics_url: str, event_type: str, user_id: str
) -> typing.Dict[str, typing.Any]:
    deadline: float = time.monotonic() + SEARCH_TIMEOUT
    last_result: typing.Dict[str, typing.Any] = {}

    query: str = urllib.parse.urlencode(
        {"limit": 20, "event_type": event_type, "user_id": user_id}
    )
    url: str = f"{analytics_url}/v1/events/recent?{query}"

    while time.monotonic() < deadline:
        response: HttpResponse = http_request("GET", url, timeout=HTTP_TIMEOUT)
        if response.status == 200 and isinstance(response.data, dict):
            last_result = response.data
            events = response.data.get("events", [])
            if isinstance(events, list) and events:
                return response.data
        time.sleep(POLL_INTERVAL)

    return last_result


def run_analytics_checks(harness: Harness, analytics_url: str) -> None:
    harness.section("Analytics Service")
    check_health_pair(harness, "Analytics", analytics_url)

    event_type = "prod.e2e"
    user_id: str = f"prod-e2e-{uuid.uuid4().hex[:10]}"
    marker: str = uuid.uuid4().hex[:12]

    ingest_response: HttpResponse = http_request(
        "POST",
        f"{analytics_url}/v1/events",
        json_body={
            "event_type": event_type,
            "user_id": user_id,
            "org_id": ORG_ID,
            "service": "prod-e2e",
            "scope": "global",
            "timestamp": time.time(),
            "payload": {"marker": marker},
        },
        timeout=HTTP_TIMEOUT,
    )
    harness.require(
        "Direct event ingest",
        ingest_response.status == 200
        and isinstance(ingest_response.data, dict)
        and ingest_response.data.get("status") == "ok",
        summarize_json(ingest_response.data),
    )

    recent_data: typing.Dict[str, typing.Any] = poll_recent_event(analytics_url, event_type, user_id)
    events = recent_data.get("events", []) if isinstance(recent_data, dict) else []
    seen = False
    if isinstance(events, list):
        for event in events:
            if not isinstance(event, dict):
                continue
            payload = event.get("payload", {})
            if (
                event.get("user_id") == user_id
                and isinstance(payload, dict)
                and payload.get("marker") == marker
            ):
                seen = True
                break
    harness.check(
        "Recent events includes test event",
        seen,
        summarize_json(recent_data),
    )

    summary_response: HttpResponse = http_request(
        "GET",
        f"{analytics_url}/v1/events/summary",
        timeout=HTTP_TIMEOUT,
    )
    summary_data = (
        summary_response.data if isinstance(summary_response.data, dict) else {}
    )
    service_counts = (
        summary_data.get("events_by_service", {})
        if isinstance(summary_data, dict)
        else {}
    )
    harness.check(
        "Summary reflects prod-e2e service",
        summary_response.status == 200
        and isinstance(service_counts, dict)
        and int(service_counts.get("prod-e2e", 0)) >= 1,
        summarize_json(service_counts),
    )


def run_section(harness: Harness, title: str, callback, *args: typing.Any) -> None:
    try:
        callback(harness, *args)
    except CheckFailed as exc:
        harness.info(f"{title} halted", str(exc))


def main() -> int:
    harness = Harness()

    print("")
    print("=" * 72)
    print("HKI AI PLATFORM - DEPLOYED E2E TEST SUITE")
    print(time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()))
    print("=" * 72)

    agentic_url: str = env_required("AGENTIC_URL")
    orchestrator_url: str = env_required("ORCHESTRATOR_URL")
    knowledge_url: str = env_required("KNOWLEDGE_API_URL")
    pipeline_url: str = env_required("INGESTION_PIPELINE_URL")
    analytics_url: str = env_required("ANALYTICS_URL")
    iap_url: str | None = os.environ.get("AGENTIC_IAP_URL", "").strip() or None

    harness.info("Agentic URL", agentic_url)
    harness.info("Orchestrator URL", orchestrator_url)
    harness.info("Knowledge API URL", knowledge_url)
    harness.info("Pipeline URL", pipeline_url)
    harness.info("Analytics URL", analytics_url)
    if iap_url:
        harness.info("IAP URL", iap_url)

    run_section(harness, "Agentic BFF", run_bff_public_checks, agentic_url, iap_url)
    run_section(
        harness,
        "Agentic Authenticated Flow",
        run_bff_authenticated_checks,
        agentic_url,
        env_required("AGENTIC_JWT_SECRET"),
    )
    run_section(
        harness,
        "Orchestrator Service",
        run_orchestrator_checks,
        orchestrator_url,
        env_required("ORCHESTRATOR_AUTH_SECRET"),
    )
    run_section(
        harness,
        "Knowledge Ingestion And Retrieval",
        run_knowledge_pipeline_checks,
        pipeline_url,
        knowledge_url,
        env_required("PIPELINE_AUTH_SECRET"),
        env_required("KNOWLEDGE_AUTH_SECRET"),
    )
    run_section(harness, "Analytics Service", run_analytics_checks, analytics_url)

    return harness.finish()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted", file=sys.stderr)
        sys.exit(130)
