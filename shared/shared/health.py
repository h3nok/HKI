"""
Shared Health Check Utilities — consistent /health and /ready patterns.

Each service can use ``create_health_router()`` for standard health/readiness
endpoints, or just register a simple health route via ``health_response()``.

For readiness probes, callers define check functions:

    from shared.health import create_health_router

    async def check_redis():
        ...
        return "ok"

    health_router = create_health_router(
        service_name="orchestrator-service",
        version="0.1.0",
        readiness_checks={"redis": check_redis, "llm_gateway": check_gateway},
    )
    app.include_router(health_router)
"""

from __future__ import annotations

import logging
import collections.abc
import typing

import fastapi

logger: logging.Logger = logging.getLogger("health")

ReadinessCheck = collections.abc.Callable[[], collections.abc.Awaitable[str]]
"""A readiness check returns 'ok' on success, or 'error:...' / 'degraded:...'."""


def health_response(service_name: str, version: str = "0.1.0") -> dict[str, str]:
    """Simple liveness payload."""
    return {"status": "healthy", "service": service_name, "version": version}


def create_health_router(
    service_name: str,
    version: str = "0.1.0",
    readiness_checks: dict[str, ReadinessCheck] | None = None,
    tags: list[str] | None = None,
) -> fastapi.APIRouter:
    """
    Build a router with ``/health``, ``/ready``, and ``/health/ready`` endpoints.

    Args:
        service_name:     Service identifier in health payloads.
        version:          Service version string.
        readiness_checks: Map of dependency name → async callable returning status.
        tags:             OpenAPI tags (defaults to ``["health"]``).
    """
    router = fastapi.APIRouter(tags=tags or ["health"])
    checks: dict[str, Callable[[], Awaitable[str]]] = readiness_checks or {}

    @router.get("/health")
    async def liveness() -> dict[str, str]:
        return health_response(service_name, version)

    @router.get("/ready")
    @router.get("/health/ready")
    async def readiness() -> dict[str, typing.Any]:
        results: dict[str, str] = {}
        for name, fn in checks.items():
            try:
                results[name] = await fn()
            except Exception as exc:
                results[name] = f"error:{exc}"
        all_ok: bool = all(v == "ok" for v in results.values())
        return {
            "status": "ready" if all_ok else "degraded",
            "service": service_name,
            "version": version,
            "checks": results,
        }

    return router
