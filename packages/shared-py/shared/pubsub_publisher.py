"""
Cloud Pub/Sub Event Publisher — async audit and analytics event emission.

Publishes structured events to GCP Pub/Sub topics for downstream
consumption by the analytics-service, compliance dashboards, and
alerting pipelines.

In local dev (no GCP_PROJECT_ID or no google-cloud-pubsub), events
are logged to stdout instead of published.

Usage:
    from shared.pubsub_publisher import publish_event

    await publish_event("agent-events", {
        "event_type": "auth.request",
        "user_id": "42",
        "scope": "halpr",
        "method": "POST",
        "path": "/v1/chat",
    })
"""

from __future__ import annotations

import json
import logging
import os
import time
import typing

logger: logging.Logger = logging.getLogger("pubsub")

_publisher: typing.Any | None = None
_project_id: str = ""


def _get_publisher() -> typing.Any | None:
    """Lazily initialize the Pub/Sub publisher client."""
    global _publisher, _project_id
    if _publisher is not None:
        return _publisher

    _project_id = os.environ.get("GCP_PROJECT_ID", "")
    if not _project_id:
        logger.debug("No GCP_PROJECT_ID set, Pub/Sub events will be logged only")
        return None

    try:
        from google.cloud import pubsub_v1  # type: ignore[import-untyped]

        _publisher = pubsub_v1.PublisherClient()
        logger.info("Pub/Sub publisher initialized", extra={"project": _project_id})
        return _publisher
    except ImportError:
        logger.debug("google-cloud-pubsub not installed, events will be logged only")
        return None
    except Exception as exc:
        logger.warning("Failed to init Pub/Sub publisher: %s", exc)
        return None


def _get_topic_path(topic_suffix: str) -> str:
    """Build full topic path: projects/{project}/topics/{env}-{suffix}."""
    env: str = os.environ.get("ENVIRONMENT", "prod")
    return f"projects/{_project_id}/topics/{env}-{topic_suffix}"


async def publish_event(
    topic_suffix: str,
    data: dict[str, typing.Any],
    *,
    ordering_key: str = "",
) -> None:
    """
    Publish a structured event to a Pub/Sub topic.

    Args:
        topic_suffix: Topic name suffix (e.g. "agent-events").
                      Prefixed with environment automatically.
        data:         Event payload (JSON-serializable dict).
        ordering_key: Optional ordering key for ordered delivery.
    """
    # Enrich with standard fields
    event = {
        "timestamp": time.time(),
        "service": os.environ.get("SERVICE_NAME", "unknown"),
        **data,
    }

    publisher: typing.Any | None = _get_publisher()

    if publisher is None:
        # Local dev fallback — log the event
        logger.info(
            "PubSub event (local)",
            extra={"topic": topic_suffix, "event": event},
        )
        return

    topic_path: str = _get_topic_path(topic_suffix)
    message_bytes: bytes = json.dumps(event).encode("utf-8")

    try:
        future = publisher.publish(
            topic_path,
            data=message_bytes,
            ordering_key=ordering_key,
        )
        # Don't block — fire and forget for audit events
        future.add_done_callback(
            lambda f: logger.debug(
                "PubSub published",
                extra={"topic": topic_suffix, "message_id": f.result()},
            )
            if not f.exception()
            else logger.warning(
                "PubSub publish failed",
                extra={"topic": topic_suffix, "error": str(f.exception())},
            )
        )
    except Exception as exc:
        logger.warning(
            "PubSub publish error",
            extra={"topic": topic_suffix, "error": str(exc)},
        )
