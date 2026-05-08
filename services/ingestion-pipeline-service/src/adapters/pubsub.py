"""
Cloud Pub/Sub Adapter — durable message queue for ingestion jobs.

Provides publisher (API side) and subscriber (worker side) abstractions
over Google Cloud Pub/Sub with automatic fallback to an in-memory
asyncio.Queue for local development.

Architecture:
    API Pod:    publish(IngestionMessage) → Pub/Sub topic
    Worker Pod: subscribe(callback) ← Pub/Sub pull subscription

    Messages are JSON-serialized IngestionMessage payloads.
    The subscription has a dead-letter topic for messages that
    exceed max delivery attempts.

Local Dev:
    When PUBSUB_ENABLED=False or PUBSUB_EMULATOR_HOST is empty and
    no project is set, falls back to InMemoryQueue — an asyncio.Queue
    that lets the API and worker run in the same process.

GCP:
    Uses google-cloud-pubsub with:
    - Automatic topic/subscription creation (idempotent)
    - Flow control (max 10 outstanding messages per worker)
    - Ack deadline extension for long-running pipelines
    - Dead-letter topic after N failed deliveries
"""

from __future__ import annotations

import asyncio
import contextlib
import os
from collections.abc import Callable
from typing import Any, Protocol

from src.core.config import settings
from src.core.logging import logger as _root_logger
from src.domain.queue_messages import IngestionMessage

logger = _root_logger.getChild("pubsub")


# ═══════════════════════════════════════════════════════════════════════════════
# Abstract interface
# ═══════════════════════════════════════════════════════════════════════════════


class QueuePublisher(Protocol):
    """Interface for publishing ingestion messages."""

    async def publish(self, message: IngestionMessage) -> str: ...
    async def close(self) -> None: ...


class QueueSubscriber(Protocol):
    """Interface for consuming ingestion messages."""

    async def start(
        self,
        callback: Callable[[IngestionMessage], Any],
    ) -> None: ...

    async def stop(self) -> None: ...


# ═══════════════════════════════════════════════════════════════════════════════
# Google Cloud Pub/Sub implementation
# ═══════════════════════════════════════════════════════════════════════════════


class PubSubPublisher:
    """
    Publishes ingestion messages to a Cloud Pub/Sub topic.

    Creates the topic idempotently on first use. Messages include
    org_id and job_id as attributes for filtering/monitoring.
    """

    def __init__(self, project_id: str, topic_id: str) -> None:
        from google.cloud import pubsub_v1

        self._publisher = pubsub_v1.PublisherClient()
        self._topic_path = self._publisher.topic_path(project_id, topic_id)
        self._project_id = project_id
        self._topic_id = topic_id
        self._ensure_topic()

    def _ensure_topic(self) -> None:
        """Create topic if it doesn't exist (idempotent)."""
        from google.api_core.exceptions import AlreadyExists

        try:
            self._publisher.create_topic(request={"name": self._topic_path})
            logger.info("Created Pub/Sub topic", extra={"topic": self._topic_id})
        except AlreadyExists:
            logger.debug("Pub/Sub topic exists", extra={"topic": self._topic_id})

    async def publish(self, message: IngestionMessage) -> str:
        """
        Publish an ingestion message to the topic.

        Returns the message ID assigned by Pub/Sub.
        Attributes (org_id, job_id) are set for server-side filtering.
        """
        loop = asyncio.get_event_loop()
        future = self._publisher.publish(
            self._topic_path,
            data=message.to_json_bytes(),
            org_id=message.org_id,
            job_id=message.job_id,
            message_type=message.message_type.value,
        )
        # Resolve future in executor to avoid blocking the event loop
        message_id = await loop.run_in_executor(None, future.result, 30)
        logger.info(
            "Published ingestion message",
            extra={
                "message_id": message_id,
                "job_id": message.job_id,
                "org_id": message.org_id,
                "type": message.message_type.value,
            },
        )
        return message_id

    async def close(self) -> None:
        """Shutdown the publisher transport."""
        self._publisher.transport.close()


class PubSubSubscriber:
    """
    Pulls ingestion messages from a Cloud Pub/Sub subscription.

    Creates the subscription idempotently with dead-letter config.
    Uses streaming pull with flow control (max 10 outstanding).

    The callback receives an IngestionMessage and should raise on
    failure — the message will be nacked and retried (up to
    max_delivery_attempts before going to DLQ).
    """

    def __init__(
        self,
        project_id: str,
        subscription_id: str,
        topic_id: str,
        dlq_topic_id: str,
        max_delivery_attempts: int = 5,
        ack_deadline_sec: int = 600,
    ) -> None:
        from google.cloud import pubsub_v1

        self._subscriber = pubsub_v1.SubscriberClient()
        self._subscription_path = self._subscriber.subscription_path(
            project_id,
            subscription_id,
        )
        self._project_id = project_id
        self._subscription_id = subscription_id
        self._topic_id = topic_id
        self._dlq_topic_id = dlq_topic_id
        self._max_delivery_attempts = max_delivery_attempts
        self._ack_deadline_sec = ack_deadline_sec
        self._streaming_pull_future = None
        self._callback = None
        self._ensure_subscription()

    def _ensure_subscription(self) -> None:
        """Create subscription + DLQ topic if they don't exist."""
        from google.api_core.exceptions import AlreadyExists
        from google.cloud import pubsub_v1

        publisher = pubsub_v1.PublisherClient()

        # Ensure DLQ topic exists
        dlq_topic_path = publisher.topic_path(
            self._project_id,
            self._dlq_topic_id,
        )
        try:
            publisher.create_topic(request={"name": dlq_topic_path})
            logger.info("Created DLQ topic", extra={"topic": self._dlq_topic_id})
        except AlreadyExists:
            pass

        # Ensure subscription with dead-letter policy
        topic_path = self._subscriber.topic_path(
            self._project_id,
            self._topic_id,
        )
        try:
            self._subscriber.create_subscription(
                request={
                    "name": self._subscription_path,
                    "topic": topic_path,
                    "ack_deadline_seconds": self._ack_deadline_sec,
                    "dead_letter_policy": {
                        "dead_letter_topic": dlq_topic_path,
                        "max_delivery_attempts": self._max_delivery_attempts,
                    },
                    "retry_policy": {
                        "minimum_backoff": {"seconds": 10},
                        "maximum_backoff": {"seconds": 600},
                    },
                },
            )
            logger.info(
                "Created Pub/Sub subscription",
                extra={
                    "subscription": self._subscription_id,
                    "dlq": self._dlq_topic_id,
                    "max_attempts": self._max_delivery_attempts,
                },
            )
        except AlreadyExists:
            logger.debug(
                "Pub/Sub subscription exists",
                extra={"subscription": self._subscription_id},
            )

        publisher.transport.close()

    async def start(
        self,
        callback: Callable[[IngestionMessage], Any],
    ) -> None:
        """
        Start pulling messages. Calls callback(IngestionMessage) for each.

        The callback should be an async function that processes the message.
        If it raises, the message is nacked (will be retried).
        If it returns normally, the message is acked.
        """
        from google.cloud import pubsub_v1

        self._callback = callback

        def _sync_callback(message: Any) -> None:
            """Sync wrapper called by the streaming pull thread."""
            try:
                msg = IngestionMessage.from_json_bytes(message.data)
                # Get delivery attempt from attributes
                delivery_attempt = message.delivery_attempt or 0
                msg.attempt = delivery_attempt

                # Run async callback in the event loop
                loop = asyncio.get_event_loop()
                future = asyncio.run_coroutine_threadsafe(
                    self._process_message(msg, message),
                    loop,
                )
                # Block the streaming pull thread until processing completes
                future.result(timeout=self._ack_deadline_sec - 30)
            except Exception as exc:
                logger.error(
                    "Message processing failed — nacking",
                    extra={
                        "error": str(exc),
                        "message_id": message.message_id,
                    },
                )
                message.nack()

        flow_control = pubsub_v1.types.FlowControl(
            max_messages=10,
            max_bytes=50 * 1024 * 1024,  # 50 MB
        )

        self._streaming_pull_future = self._subscriber.subscribe(
            self._subscription_path,
            callback=_sync_callback,
            flow_control=flow_control,
        )

        logger.info(
            "Pub/Sub subscriber started",
            extra={"subscription": self._subscription_id},
        )

    async def _process_message(
        self,
        msg: IngestionMessage,
        raw_message: Any,
    ) -> None:
        """Process a single message and ack/nack accordingly."""
        try:
            await self._callback(msg)
            raw_message.ack()
            logger.info(
                "Message processed and acked",
                extra={"job_id": msg.job_id, "org_id": msg.org_id},
            )
        except Exception as exc:
            logger.error(
                "Message processing failed — nacking for retry",
                extra={
                    "job_id": msg.job_id,
                    "org_id": msg.org_id,
                    "attempt": msg.attempt,
                    "error": str(exc),
                },
            )
            raw_message.nack()

    async def stop(self) -> None:
        """Cancel the streaming pull and close the subscriber."""
        if self._streaming_pull_future:
            self._streaming_pull_future.cancel()
            self._streaming_pull_future = None
        self._subscriber.close()
        logger.info("Pub/Sub subscriber stopped")


# ═══════════════════════════════════════════════════════════════════════════════
# In-memory fallback (local dev, no Pub/Sub)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryPublisher:
    """
    In-memory queue publisher for local development.
    Shares a queue instance with InMemorySubscriber via module-level ref.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[IngestionMessage] = _get_shared_queue()
        self._counter = 0
        logger.info("In-memory queue publisher initialized (no Pub/Sub)")

    async def publish(self, message: IngestionMessage) -> str:
        self._counter += 1
        msg_id = f"mem-{self._counter}"
        await self._queue.put(message)
        logger.info(
            "Published to in-memory queue",
            extra={"message_id": msg_id, "job_id": message.job_id},
        )
        return msg_id

    async def close(self) -> None:
        pass


class InMemorySubscriber:
    """
    In-memory queue subscriber for local development.
    Pulls from the shared asyncio.Queue.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[IngestionMessage] = _get_shared_queue()
        self._running = False
        self._task: asyncio.Task | None = None
        logger.info("In-memory queue subscriber initialized (no Pub/Sub)")

    async def start(
        self,
        callback: Callable[[IngestionMessage], Any],
    ) -> None:
        self._running = True

        async def _pull_loop() -> None:
            while self._running:
                try:
                    msg = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                    try:
                        await callback(msg)
                    except Exception as exc:
                        logger.error(
                            "In-memory message processing failed",
                            extra={"job_id": msg.job_id, "error": str(exc)},
                        )
                except TimeoutError:
                    continue

        self._task = asyncio.create_task(_pull_loop())
        logger.info("In-memory subscriber started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        logger.info("In-memory subscriber stopped")


# Shared queue singleton for in-memory mode
_shared_queue: asyncio.Queue[IngestionMessage] | None = None


def _get_shared_queue() -> asyncio.Queue[IngestionMessage]:
    global _shared_queue
    if _shared_queue is None:
        _shared_queue = asyncio.Queue(maxsize=1000)
    return _shared_queue


# ═══════════════════════════════════════════════════════════════════════════════
# Factory functions
# ═══════════════════════════════════════════════════════════════════════════════


def create_publisher() -> PubSubPublisher | InMemoryPublisher:
    """Create the appropriate queue publisher based on configuration."""
    if not settings.PUBSUB_ENABLED:
        return InMemoryPublisher()

    # Set emulator host if configured
    if settings.PUBSUB_EMULATOR_HOST:
        os.environ["PUBSUB_EMULATOR_HOST"] = settings.PUBSUB_EMULATOR_HOST

    project_id = settings.PUBSUB_PROJECT_ID or _detect_project_id()
    if not project_id:
        logger.warning("No GCP project ID — falling back to in-memory queue")
        return InMemoryPublisher()

    try:
        return PubSubPublisher(
            project_id=project_id,
            topic_id=settings.PUBSUB_TOPIC,
        )
    except Exception as exc:
        logger.warning(
            "Pub/Sub publisher init failed — falling back to in-memory",
            extra={"error": str(exc)},
        )
        return InMemoryPublisher()


def create_subscriber() -> PubSubSubscriber | InMemorySubscriber:
    """Create the appropriate queue subscriber based on configuration."""
    if not settings.PUBSUB_ENABLED:
        return InMemorySubscriber()

    if settings.PUBSUB_EMULATOR_HOST:
        os.environ["PUBSUB_EMULATOR_HOST"] = settings.PUBSUB_EMULATOR_HOST

    project_id = settings.PUBSUB_PROJECT_ID or _detect_project_id()
    if not project_id:
        logger.warning("No GCP project ID — falling back to in-memory subscriber")
        return InMemorySubscriber()

    try:
        return PubSubSubscriber(
            project_id=project_id,
            subscription_id=settings.PUBSUB_SUBSCRIPTION,
            topic_id=settings.PUBSUB_TOPIC,
            dlq_topic_id=settings.PUBSUB_DLQ_TOPIC,
            max_delivery_attempts=settings.PUBSUB_MAX_DELIVERY_ATTEMPTS,
            ack_deadline_sec=settings.PUBSUB_ACK_DEADLINE_SEC,
        )
    except Exception as exc:
        logger.warning(
            "Pub/Sub subscriber init failed — falling back to in-memory",
            extra={"error": str(exc)},
        )
        return InMemorySubscriber()


def _detect_project_id() -> str:
    """Auto-detect GCP project ID from metadata server (works on GKE/Cloud Run)."""
    try:
        import httpx

        resp = httpx.get(
            "http://metadata.google.internal/computeMetadata/v1/project/project-id",
            headers={"Metadata-Flavor": "Google"},
            timeout=2.0,
        )
        if resp.status_code == 200:
            return resp.text.strip()
    except Exception:
        pass
    return ""
