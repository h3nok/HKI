"""
Scheduled Jobs Infrastructure — Cloud Scheduler → Pub/Sub → Worker.

Provides a job dispatcher that processes scheduled tasks from a Pub/Sub
subscription. Cloud Scheduler publishes messages on a cron schedule,
and this module routes them to the appropriate handler.

Supported job types:
    - knowledge_refresh:  Re-ingest stale documents (freshness check)
    - eval_run:           Execute the RAGAS evaluation suite
    - raptor_build:       Rebuild hierarchical RAPTOR summaries
    - graph_communities:  Recompute knowledge graph communities
    - cleanup:            Purge expired jobs, orphaned chunks

Architecture:
    Cloud Scheduler → Pub/Sub topic → Subscription → JobDispatcher
    Each job type maps to an async handler function.
    Jobs are idempotent and support retry via Pub/Sub ack deadlines.

Local dev: Jobs can be triggered manually via POST /v1/jobs/trigger.
"""

from __future__ import annotations

import asyncio
import collections.abc
import concurrent.futures
import datetime as datetime_
import enum
import time
import typing

import google.cloud.pubsub_v1.subscriber.futures
import httpx
import pydantic
import redis.asyncio.client

import src.core.logging

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class JobType(enum.StrEnum):
    """Supported scheduled job types."""

    KNOWLEDGE_REFRESH = "knowledge_refresh"
    EVAL_RUN = "eval_run"
    RAPTOR_BUILD = "raptor_build"
    GRAPH_COMMUNITIES = "graph_communities"
    CLEANUP = "cleanup"


class ScheduledJob(pydantic.BaseModel):
    """A scheduled job to execute."""

    job_type: JobType
    payload: dict[str, typing.Any] = pydantic.Field(default_factory=dict)
    scheduled_at: datetime_.datetime = pydantic.Field(
        default_factory=lambda: datetime_.datetime.now(datetime_.UTC)
    )
    org_id: str = "default"


class JobResult(pydantic.BaseModel):
    """Result of a scheduled job execution."""

    job_type: JobType
    success: bool = True
    duration_ms: float = 0.0
    items_processed: int = 0
    message: str = ""
    error: str | None = None


# Handler type: async fn(ScheduledJob) -> JobResult
JobHandler = collections.abc.Callable[[ScheduledJob], collections.abc.Awaitable[JobResult]]


# ═══════════════════════════════════════════════════════════════════════════════
# Job Dispatcher
# ═══════════════════════════════════════════════════════════════════════════════


class JobDispatcher:
    """
    Routes scheduled jobs to their handlers.

    Register handlers at startup, then dispatch incoming jobs.
    Handles timeouts, retries, and error reporting.
    """

    def __init__(self, timeout_seconds: float = 300.0) -> None:
        self._handlers: dict[JobType, JobHandler] = {}
        self._timeout: float = timeout_seconds

    def register(
        self,
        job_type: JobType,
        handler: JobHandler,
    ) -> None:
        """Register a handler for a job type."""
        self._handlers[job_type] = handler
        src.core.logging.logger.info(
            "Job handler registered",
            extra={"job_type": job_type.value},
        )

    async def dispatch(self, job: ScheduledJob) -> JobResult:
        """
        Execute a scheduled job with timeout and error handling.

        Returns a JobResult regardless of success or failure.
        """
        handler: JobHandler | None = self._handlers.get(job.job_type)
        if handler is None:
            return JobResult(
                job_type=job.job_type,
                success=False,
                error=f"No handler for job type: {job.job_type.value}",
            )

        start: float = time.perf_counter()
        try:
            result: JobResult = await asyncio.wait_for(
                handler(job),
                timeout=self._timeout,
            )
            result.duration_ms = (time.perf_counter() - start) * 1000
            src.core.logging.logger.info(
                "Job completed",
                extra={
                    "job_type": job.job_type.value,
                    "duration_ms": round(result.duration_ms, 1),
                    "items": result.items_processed,
                },
            )
            return result

        except TimeoutError:
            elapsed: float = (time.perf_counter() - start) * 1000
            src.core.logging.logger.error(
                "Job timed out",
                extra={
                    "job_type": job.job_type.value,
                    "timeout_s": self._timeout,
                },
            )
            return JobResult(
                job_type=job.job_type,
                success=False,
                duration_ms=elapsed,
                error=f"Timeout after {self._timeout}s",
            )

        except Exception as exc:
            elapsed: float = (time.perf_counter() - start) * 1000
            src.core.logging.logger.error(
                "Job failed",
                extra={
                    "job_type": job.job_type.value,
                    "error": str(exc),
                },
            )
            return JobResult(
                job_type=job.job_type,
                success=False,
                duration_ms=elapsed,
                error=str(exc),
            )


# ═══════════════════════════════════════════════════════════════════════════════
# Built-in Job Handlers
# ═══════════════════════════════════════════════════════════════════════════════


async def handle_knowledge_refresh(job: ScheduledJob) -> JobResult:
    """
    Re-ingest documents that haven't been updated in N days.

    Checks document freshness against a configurable threshold
    and re-runs the ingestion pipeline for stale documents.
    """
    from shared.http_client import create_service_client

    from src.core.config import settings

    max_age_days = job.payload.get("max_age_days", 30)
    org_id: str = job.org_id or "default"
    api_url = settings.KNOWLEDGE_API_URL
    src.core.logging.logger.info(
        "Starting knowledge refresh",
        extra={"max_age_days": max_age_days, "org_id": org_id},
    )

    refreshed = 0
    try:
        async with create_service_client("pipeline-scheduler", timeout=30.0) as client:
            # 1. Get all documents from knowledge-api
            resp: httpx.Response = await client.get(
                f"{api_url}/v1/documents",
                params={"org_id": org_id, "limit": 500},
            )
            resp.raise_for_status()
            docs = resp.json().get("documents", [])

            # 2. Find stale documents (updated_at older than threshold)
            from datetime import timedelta

            cutoff: datetime_.datetime = datetime_.datetime.now(
                datetime_.UTC
            ) - timedelta(days=max_age_days)
            stale_ids = []
            for doc in docs:
                updated = doc.get("updated_at", doc.get("created_at", ""))
                if updated:
                    try:
                        doc_updated: datetime_.datetime = datetime_.datetime.fromisoformat(
                            updated.replace("Z", "+00:00")
                        )
                        if doc_updated < cutoff:
                            stale_ids.append(doc["id"])
                    except (ValueError, KeyError):
                        continue

            src.core.logging.logger.info(
                "Found stale documents",
                extra={"count": len(stale_ids), "threshold_days": max_age_days},
            )

            # 3. Mark stale documents for re-ingestion
            for doc_id in stale_ids:
                try:
                    await client.patch(
                        f"{api_url}/v1/documents/{doc_id}/status",
                        json={"status": "pending"},
                    )
                    refreshed += 1
                except Exception as exc:
                    src.core.logging.logger.warning(
                        "Failed to mark document for refresh",
                        extra={"document_id": doc_id, "error": str(exc)},
                    )
    except Exception as exc:
        src.core.logging.logger.error("Knowledge refresh failed", extra={"error": str(exc)})
        return JobResult(
            job_type=job.job_type,
            success=False,
            items_processed=refreshed,
            error=str(exc),
        )

    return JobResult(
        job_type=job.job_type,
        success=True,
        items_processed=refreshed,
        message=f"Marked {refreshed} stale docs (older than {max_age_days}d) for re-ingestion",
    )


async def handle_cleanup(job: ScheduledJob) -> JobResult:
    """
    Purge expired pipeline jobs and orphaned chunks.

    Removes:
    - Pipeline jobs older than retention_days (completed/failed)
    - Expired Redis cache entries (job hashes past TTL)
    """
    import redis.asyncio as aioredis

    from src.core.config import settings

    retention_days = job.payload.get("retention_days", 7)
    org_id: str = job.org_id or "default"
    src.core.logging.logger.info(
        "Starting cleanup job",
        extra={"org_id": org_id, "retention_days": retention_days},
    )

    cleaned = 0
    try:
        if settings.REDIS_URL:
            r: redis.asyncio.client.Redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
            try:
                # Scan for pipeline job keys and remove expired ones
                prefix = settings.REDIS_JOB_PREFIX
                cursor = 0
                while True:
                    cursor, keys = await r.scan(cursor=cursor, match=f"{prefix}*", count=200)
                    for key in keys:
                        try:
                            job_data = await r.hgetall(key)
                            if not job_data:
                                await r.delete(key)
                                cleaned += 1
                                continue

                            status = job_data.get("status", "")
                            if status in ("completed", "failed"):
                                from datetime import timedelta

                                completed_at = job_data.get("completed_at", "")
                                if completed_at:
                                    try:
                                        ts: datetime_.datetime = datetime_.datetime.fromisoformat(
                                            completed_at.replace("Z", "+00:00")
                                        )
                                        cutoff: datetime_.datetime = (
                                            datetime_.datetime.now(datetime_.UTC)
                                            - timedelta(days=retention_days)
                                        )
                                        if ts < cutoff:
                                            await r.delete(key)
                                            cleaned += 1
                                    except ValueError:
                                        pass
                        except Exception:
                            src.core.logging.logger.warning(
                                "Error processing key during cleanup",
                                extra={"key": key},
                                exc_info=True,
                            )

                    if cursor == 0:
                        break
            finally:
                await r.aclose()
        else:
            src.core.logging.logger.info("No Redis configured — skipping job cleanup")

    except Exception as exc:
        src.core.logging.logger.error("Cleanup job failed", extra={"error": str(exc)})
        return JobResult(
            job_type=job.job_type,
            success=False,
            items_processed=cleaned,
            error=str(exc),
        )

    return JobResult(
        job_type=job.job_type,
        success=True,
        items_processed=cleaned,
        message=f"Cleaned {cleaned} expired job records (retention={retention_days}d)",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Pub/Sub Consumer (GCP-native)
# ═══════════════════════════════════════════════════════════════════════════════


class PubSubConsumer:
    """
    Consumes messages from a Cloud Pub/Sub subscription.

    Each message is expected to contain a JSON body matching
    the ScheduledJob schema. Messages are acked after successful
    processing and nacked on failure (for retry).

    Usage:
        consumer = PubSubConsumer(
            project_id="my-project",
            subscription_id="scheduler-sub",
            dispatcher=dispatcher,
        )
        await consumer.start()  # Runs until cancelled
    """

    def __init__(
        self,
        project_id: str,
        subscription_id: str,
        dispatcher: JobDispatcher,
    ) -> None:
        self._project: str = project_id
        self._subscription: str = subscription_id
        self._dispatcher: JobDispatcher = dispatcher
        self._running = False

    async def start(self) -> None:
        """Start consuming messages. Blocks until stop() is called."""
        self._running = True
        src.core.logging.logger.info(
            "Pub/Sub consumer starting",
            extra={
                "project": self._project,
                "subscription": self._subscription,
            },
        )

        try:
            import json

            from google.cloud import pubsub_v1

            subscriber = pubsub_v1.SubscriberClient()
            sub_path: str = subscriber.subscription_path(
                self._project,
                self._subscription,
            )

            def callback(message: typing.Any) -> None:
                try:
                    data = json.loads(message.data.decode("utf-8"))
                    job = ScheduledJob(**data)
                    # Run dispatch in the event loop
                    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
                    future: concurrent.futures.Future[JobResult] = asyncio.run_coroutine_threadsafe(
                        self._dispatcher.dispatch(job),
                        loop,
                    )
                    result: JobResult = future.result(timeout=330)
                    if result.success:
                        message.ack()
                    else:
                        message.nack()
                except Exception as exc:
                    src.core.logging.logger.error(
                        "Pub/Sub message processing failed",
                        extra={"error": str(exc)},
                    )
                    message.nack()

            streaming_pull: google.cloud.pubsub_v1.subscriber.futures.StreamingPullFuture = (
                subscriber.subscribe(
                    sub_path,
                    callback=callback,
                )
            )
            src.core.logging.logger.info("Pub/Sub consumer listening")

            # Block until cancelled
            while self._running:
                await asyncio.sleep(1)

            streaming_pull.cancel()

        except ImportError:
            src.core.logging.logger.warning(
                "google-cloud-pubsub not installed, Pub/Sub consumer disabled"
            )

    async def stop(self) -> None:
        """Signal the consumer to stop."""
        self._running = False


def create_default_dispatcher() -> JobDispatcher:
    """Create a dispatcher with all built-in handlers registered."""
    dispatcher = JobDispatcher()
    dispatcher.register(
        JobType.KNOWLEDGE_REFRESH,
        handle_knowledge_refresh,
    )
    dispatcher.register(JobType.CLEANUP, handle_cleanup)
    # RAPTOR and graph community handlers are registered
    # by their respective modules when imported
    return dispatcher
