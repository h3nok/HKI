"""
GCP Secret Manager Client — reads secrets with env-var fallback.

In production (GKE with Workload Identity), reads from Secret Manager.
In local dev, falls back to environment variables.

Usage:
    from shared.gcp_secrets import get_secret

    secret = get_secret("service-auth-secret", env_fallback="SERVICE_AUTH_SECRET")

Requirements:
    pip install google-cloud-secret-manager

The GKE workload SA must have roles/secretmanager.secretAccessor.
"""

from __future__ import annotations

import logging
import os
import functools

from google.cloud.secretmanager_v1.services.secret_manager_service.client import SecretManagerServiceClient

from google.cloud.secretmanager_v1.services.secret_manager_service.client import SecretManagerServiceClient

from google.cloud.secretmanager_v1.types.service import AccessSecretVersionResponse

logger: logging.Logger = logging.getLogger("gcp_secrets")

# Cache the client to avoid repeated imports / init
_sm_client = None


def _get_client() -> SecretManagerServiceClient | None:
    """Lazily import and cache the Secret Manager client."""
    global _sm_client
    if _sm_client is not None:
        return _sm_client
    try:
        from google.cloud import secretmanager  # type: ignore[import-untyped]

        _sm_client = secretmanager.SecretManagerServiceClient()
        return _sm_client
    except ImportError:
        logger.debug(
            "google-cloud-secret-manager not installed, falling back to env vars"
        )
        return None
    except Exception as exc:
        logger.warning("Failed to init Secret Manager client: %s", exc)
        return None


@functools.lru_cache(maxsize=32)
def get_secret(
    secret_id: str,
    *,
    env_fallback: str = "",
    project_id: str = "",
    version: str = "latest",
    default: str = "",
) -> str:
    """
    Read a secret value from GCP Secret Manager.

    Resolution order:
        1. Environment variable ``env_fallback`` (if set and non-empty)
        2. Secret Manager ``projects/{project}/secrets/{secret_id}/versions/{version}``
        3. ``default``

    This means env vars always win — useful for local dev and CI.

    Args:
        secret_id:    Secret Manager secret ID (e.g. "prod-service-auth-secret").
        env_fallback: Env var name to check first (e.g. "SERVICE_AUTH_SECRET").
        project_id:   GCP project. Falls back to GCP_PROJECT_ID env var.
        version:      Secret version (default: "latest").
        default:      Value if neither env nor Secret Manager has it.
    """
    # 1. Env var takes priority (local dev, CI)
    if env_fallback:
        env_val: str = os.environ.get(env_fallback, "")
        if env_val:
            return env_val

    # 2. Try Secret Manager
    project: str = project_id or os.environ.get("GCP_PROJECT_ID", "")
    if not project:
        logger.debug("No GCP_PROJECT_ID set, skipping Secret Manager")
        return default

    client: SecretManagerServiceClient | None = _get_client()
    if client is None:
        return default

    name: str = f"projects/{project}/secrets/{secret_id}/versions/{version}"
    try:
        response: AccessSecretVersionResponse = client.access_secret_version(request={"name": name})
        payload: str = response.payload.data.decode("UTF-8")
        logger.debug("Loaded secret from Secret Manager")
        return payload
    except Exception as exc:
        logger.warning(
            "Secret Manager read failed, using default",
            extra={"error_type": type(exc).__name__},
        )
        return default
