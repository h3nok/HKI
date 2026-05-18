"""
Analytics Client — fire-and-forget event emission to analytics-service.

Emits structured events so the analytics service can compute knowledge-layer
metrics including:

    CMOS  — Context Memory Optimization Score
            avg(tokens_in_context) per kb.search — lower is better.
            Tracks how efficiently the KB feeds context to the agent.

    KB Retrieval Precision
            avg(top_score) per kb.search — signals chunk quality.

    Ingest Health
            chunk_count, entity_count, duration_ms per kb.ingest.

Design:
    - All methods are fire-and-forget: they schedule a background task and
      return immediately. Analytics MUST NOT block or fail the main request.
    - When ANALYTICS_SERVICE_URL is empty the client is a no-op.
    - Uses a single shared httpx.AsyncClient (connection pooling).
"""

from __future__ import annotations

import asyncio
import contextlib
import datetime
import hashlib
import json
import typing
import uuid

import hki_runtime
import httpx

import src.core.config
import src.core.logging

DEFAULT_ANALYTICS_SCOPE = "default"


class AnalyticsClient:
    """
    Thin async HTTP client for emitting events to the analytics service.

    Usage:
        # In lifespan
        client = AnalyticsClient()
        await client.start()
        app.state.analytics = client

        # In route handler
        client.fire("kb.search", org_id=identity.org_id, payload={...})

        # On shutdown
        await client.close()
    """

    SERVICE = "knowledge-api"

    def __init__(self) -> None:
        self._url: str = src.core.config.settings.ANALYTICS_SERVICE_URL.rstrip("/")
        self._client: httpx.AsyncClient | None = None
        self._enabled: bool = bool(self._url)

    async def start(self) -> None:
        """Open the shared HTTP connection pool."""
        if self._enabled:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=2.0, read=3.0, write=3.0, pool=2.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
            src.core.logging.logger.info("Analytics client started", extra={"url": self._url})

    async def close(self) -> None:
        """Close the HTTP connection pool."""
        if self._client:
            await self._client.aclose()
            self._client = None

    # ── Public API ────────────────────────────────────────────────────────

    def fire(
        self,
        event_type: str,
        *,
        org_id: str = "default",
        user_id: str = "",
        scope: str = DEFAULT_ANALYTICS_SCOPE,
        payload: dict[str, typing.Any] | None = None,
    ) -> None:
        """
        Schedule a background task to emit an analytics event.

        Never raises. Safe to call from any async context.
        """
        if not self._enabled or not self._client:
            return
        with contextlib.suppress(RuntimeError):
            asyncio.create_task(
                self._send(
                    event_type,
                    org_id=org_id,
                    user_id=user_id,
                    scope=scope,
                    payload=payload or {},
                )
            )

    def fire_audit_event(
        self,
        *,
        operation_type: str,
        org_id: str,
        subject_id: str,
        active_domain: str,
        authorized_domains: list[str],
        operation_name: str = "",
        target_domain: str | None = None,
        purpose: str = "",
        decision_outcome: str = "allow",
        decision_reason: str = "",
        actor_role: str = "",
        policy_pack_id: str = "",
        risk_tier: str = "",
        evidence: dict[str, typing.Any] | None = None,
    ) -> None:
        """Schedule a native HKI audit event for evidence-grade activity."""
        if not self._enabled or not self._client:
            return

        now: str = datetime.datetime.now(datetime.UTC).isoformat()
        audit_event: dict[str, typing.Any] = {
            "schema": hki_runtime.HKI_AUDIT_EVENT_SCHEMA,
            "event_id": f"evt_{uuid.uuid4().hex}",
            "occurred_at": now,
            "received_at": now,
            "source": {
                "platform": "hki-reference-platform",
                "service": self.SERVICE,
                "collector": "native",
            },
            "actor": {
                "subject_id": subject_id,
                "role": actor_role,
            },
            "boundary": {
                "org_id": org_id,
                "active_domain": active_domain,
                "authorized_domains": authorized_domains,
                "policy_pack_id": policy_pack_id,
                "risk_tier": risk_tier,
            },
            "operation": {
                "type": operation_type,
                "name": operation_name,
                "target_domain": target_domain or active_domain,
                "purpose": purpose,
            },
            "decision": {
                "outcome": decision_outcome,
                "reason": decision_reason,
            },
            "evidence": evidence or {},
        }

        validation: hki_runtime.HkiAuditEventValidationResult = hki_runtime.validate_audit_event(audit_event)
        if not validation.ok:
            src.core.logging.logger.debug(
                "HKI audit event emit skipped",
                extra={
                    "operation_type": operation_type,
                    "active_domain": active_domain,
                    "issues": [issue.field for issue: hki_runtime.HkiValidationIssue in validation.issues],
                },
            )
            return

        with contextlib.suppress(RuntimeError):
            asyncio.create_task(self._send_audit_event(audit_event))

    # ── Internal ──────────────────────────────────────────────────────────

    async def _send(
        self,
        event_type: str,
        *,
        org_id: str,
        user_id: str,
        scope: str,
        payload: dict[str, typing.Any],
    ) -> None:
        """POST a single event to the analytics service. Never raises."""
        try:
            await self._client.post(  # type: ignore[union-attr]
                f"{self._url}/v1/events",
                json={
                    "event_type": event_type,
                    "user_id": user_id,
                    "org_id": org_id,
                    "service": self.SERVICE,
                    "scope": scope,
                    "timestamp": datetime.datetime.now(datetime.UTC).timestamp(),
                    "payload": payload,
                },
            )
        except Exception as exc: Exception:
            # Degraded analytics must never surface to the caller
            src.core.logging.logger.debug(
                "Analytics emit skipped",
                extra={
                    "event_type": event_type,
                    "scope": scope,
                    "error": str(exc)[:120],
                },
            )

    async def _send_audit_event(self, event: dict[str, typing.Any]) -> None:
        """POST a native HKI audit event to analytics-service. Never raises."""
        try:
            await self._client.post(  # type: ignore[union-attr]
                f"{self._url}/v1/events/audit",
                json=event,
            )
        except Exception as exc: Exception:
            src.core.logging.logger.debug(
                "HKI audit emit skipped",
                extra={
                    "schema": event.get("schema", ""),
                    "event_id": event.get("event_id", ""),
                    "error": str(exc)[:120],
                },
            )


def audit_payload_hash(payload: dict[str, typing.Any]) -> str:
    encoded: bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()
