"""
Pipeline Worker — pulls ingestion jobs from Pub/Sub and runs the pipeline.

This is the worker entry point, separate from the API server.
In production, this runs as its own worker deployment and scales independently.
In local dev, it runs alongside the API in the same process via in-memory queue.

Architecture:
    Pub/Sub subscription → worker.process_message() → IngestionPipeline
                                                     → ConcurrencyLimiter

    Each message is an IngestionMessage with job_id, content/URL, and metadata.
    The worker:
        1. Acquires a per-tenant concurrency slot (Redis semaphore)
        2. Runs the appropriate pipeline (text or URL)
        3. Releases the slot on completion or failure
        4. Acks the message (or nacks for retry on concurrency limit)

Startup:
    python -m src.worker
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import signal

import src.adapters.concurrency
import src.adapters.pubsub
import src.core.config
import src.core.logging
import src.domain.pipeline
import src.domain.queue_messages

# Module-level references for graceful shutdown
_subscriber = None
_pipeline = None
_limiter = None
_review_store = None


async def process_message(message: src.domain.queue_messages.IngestionMessage) -> None:
    """
    Process a single ingestion message from the queue.

    Acquires a concurrency slot, runs the pipeline, releases the slot.
    Raises on failure so the subscriber can nack for retry.
    """
    global _pipeline, _limiter

    if not _pipeline or not _limiter:
        raise RuntimeError("Worker not initialized")

    org_id = message.org_id
    job_id = message.job_id

    src.core.logging.logger.info(
        "Processing ingestion message",
        extra={
            "job_id": job_id,
            "org_id": org_id,
            "type": message.message_type.value,
            "attempt": message.attempt,
        },
    )

    # Acquire concurrency slot
    acquired = await _limiter.acquire_slot(org_id)
    if not acquired:
        raise src.adapters.concurrency.ConcurrencyLimitExceededError(
            org_id=org_id,
            current=await _limiter.get_active_count(org_id),
            limit=src.core.config.settings.CONCURRENCY_MAX_PER_ORG,
        )

    try:
        if message.message_type == src.domain.queue_messages.IngestionMessageType.INGEST_TEXT:
            await _pipeline.ingest_text(
                content=message.content,
                title=message.title,
                department=message.department,
                document_type=message.document_type,
                tags=message.tags,
                classification=message.classification,
                access_control=message.access_control,
                stream_id=message.stream_id,
                chunk_size=message.chunk_size,
                chunk_overlap=message.chunk_overlap,
                chunk_strategy=message.chunk_strategy,
                auth_token=message.auth_token,
                org_id=message.org_id,
            )
        elif message.message_type == src.domain.queue_messages.IngestionMessageType.INGEST_URL:
            await _pipeline.ingest_url(
                url=message.url,
                title=message.title,
                department=message.department,
                document_type=message.document_type,
                tags=message.tags,
                classification=message.classification,
                access_control=message.access_control,
                stream_id=message.stream_id,
                chunk_size=message.chunk_size,
                chunk_overlap=message.chunk_overlap,
                auth_token=message.auth_token,
                org_id=message.org_id,
            )
        else:
            src.core.logging.logger.error(
                "Unknown message type",
                extra={"type": message.message_type, "job_id": job_id},
            )

        src.core.logging.logger.info(
            "Ingestion message processed successfully",
            extra={"job_id": job_id, "org_id": org_id},
        )

    finally:
        await _limiter.release_slot(org_id)


async def run_worker() -> None:
    """Initialize adapters and start the subscriber loop."""
    global _subscriber, _pipeline, _limiter, _review_store

    src.core.logging.logger.info(
        "Starting pipeline worker",
        extra={
            "pubsub_enabled": src.core.config.settings.PUBSUB_ENABLED,
            "max_concurrent_per_org": src.core.config.settings.CONCURRENCY_MAX_PER_ORG,
            "environment": src.core.config.settings.ENVIRONMENT,
        },
    )

    from src.adapters.gcs_store import create_document_store
    from src.adapters.job_store import create_job_store

    job_store = await create_job_store()
    doc_store = await create_document_store()

    _pipeline = src.domain.pipeline.IngestionPipeline(
        job_store=job_store,
        document_store=doc_store,
    )
    from src.adapters.review_store import create_review_store
    from src.domain.review import AutoApproveRule, ReviewPolicy, ReviewWorkflow

    review_store = await create_review_store()
    _review_store = review_store
    review_policy = ReviewPolicy(
        rules=[
            AutoApproveRule(name="reingestion", is_reingestion=True),
        ]
    )
    _pipeline.set_review_workflow(ReviewWorkflow(store=review_store, policy=review_policy))

    _limiter = await src.adapters.concurrency.create_concurrency_limiter()
    _subscriber = src.adapters.pubsub.create_subscriber()

    # Start pulling messages
    await _subscriber.start(process_message)

    src.core.logging.logger.info("Pipeline worker running — waiting for messages")

    # Block until shutdown signal
    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        src.core.logging.logger.info("Shutdown signal received")
        stop_event.set()

    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _signal_handler)

    await stop_event.wait()

    # Graceful shutdown
    src.core.logging.logger.info("Shutting down pipeline worker")
    if _subscriber:
        await _subscriber.stop()
    if _pipeline:
        await _pipeline.close()
    if _limiter:
        await _limiter.close()
    if _review_store:
        await _review_store.close()

    src.core.logging.logger.info("Pipeline worker stopped")


def main() -> None:
    """Entry point: python -m src.worker"""
    logging.basicConfig(
        level=getattr(logging, src.core.config.settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(run_worker())


if __name__ == "__main__":
    main()
