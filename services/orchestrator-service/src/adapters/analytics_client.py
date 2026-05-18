"""Analytics client for native HKI audit emission."""

from __future__ import annotations

import asyncio
import contextlib
import datetime
import typing
import uuid

import hki_runtime
import httpx

import src.core.config
import src.core.logging


class AnalyticsClient:
    """Fire-and-forget client for analytics-service audit ingestion."""

    SERVICE = "orchestrator-service"

    def __init__(self) -> None:
        self._url: str = src.core.config.settings.ANALYTICS_SERVICE_URL.rstrip("/")
        self._client: httpx.AsyncClient | None = None
        self._enabled: bool = bool(self._url)

    async def start(self) -> None:
        if self._enabled:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=2.0, read=3.0, write=3.0, pool=2.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
            src.core.logging.logger.info("Analytics client started", extra={"url": self._url})

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

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
                    "issues": [issue.field for issue in validation.issues],
                },
            )
            return

        with contextlib.suppress(RuntimeError):
            asyncio.create_task(self._send_audit_event(audit_event))

    async def _send_audit_event(self, event: dict[str, typing.Any]) -> None:
        try:
            await self._client.post(  # type: ignore[union-attr]
                f"{self._url}/v1/events/audit",
                json=event,
            )
        except Exception as exc:
            src.core.logging.logger.debug(
                "HKI audit emit skipped",
                extra={
                    "schema": event.get("schema", ""),
                    "event_id": event.get("event_id", ""),
                    "error": str(exc)[:120],
                },
            )
