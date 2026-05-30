"""
Tests for the Pub/Sub queue system, concurrency control, and worker.

Covers:
    - IngestionMessage serialization round-trip
    - InMemoryPublisher + InMemorySubscriber end-to-end
    - NoOpConcurrencyLimiter (always allows)
    - Worker process_message flow with mocked pipeline
"""

from __future__ import annotations

import asyncio
from typing import Any, Generator
import unittest.mock

import pytest

import src.adapters.concurrency
import src.adapters.pubsub
import src.domain.queue_messages

# ═══════════════════════════════════════════════════════════════════════════════
# IngestionMessage tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestIngestionMessage:
    """Test message serialization."""

    def test_round_trip_text(self) -> None:
        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
            job_id="job-123",
            org_id="hki",
            stream_id="dev",
            content="Hello world",
            title="Test Doc",
            department="IT",
            tags=["test", "demo"],
        )
        data: bytes = msg.to_json_bytes()
        restored: src.domain.queue_messages.IngestionMessage = src.domain.queue_messages.IngestionMessage.from_json_bytes(data)

        assert restored.message_type == src.domain.queue_messages.IngestionMessageType.INGEST_TEXT
        assert restored.job_id == "job-123"
        assert restored.org_id == "hki"
        assert restored.content == "Hello world"
        assert restored.title == "Test Doc"
        assert restored.tags == ["test", "demo"]

    def test_round_trip_url(self) -> None:
        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_URL,
            job_id="job-456",
            org_id="default",
            stream_id="dev",
            url="https://example.com",
        )
        data: bytes = msg.to_json_bytes()
        restored: src.domain.queue_messages.IngestionMessage = src.domain.queue_messages.IngestionMessage.from_json_bytes(data)

        assert restored.message_type == src.domain.queue_messages.IngestionMessageType.INGEST_URL
        assert restored.url == "https://example.com"
        assert restored.content == ""

    def test_defaults(self) -> None:
        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
            job_id="job-789",
            stream_id="dev",
        )
        assert msg.org_id == "default"
        assert msg.chunk_size == 512
        assert msg.chunk_overlap == 64
        assert msg.tags == []
        assert msg.attempt == 0


# ═══════════════════════════════════════════════════════════════════════════════
# InMemory Queue tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestInMemoryQueue:
    """Test in-memory publisher + subscriber for local dev."""

    @pytest.fixture(autouse=True)
    def reset_shared_queue(self) -> Generator[None, Any, None]:
        """Reset the module-level shared queue between tests."""
        import src.adapters.pubsub as pubsub_mod

        pubsub_mod._shared_queue = None
        yield
        pubsub_mod._shared_queue = None

    async def test_publish_and_subscribe(self) -> None:
        publisher = src.adapters.pubsub.InMemoryPublisher()
        subscriber = src.adapters.pubsub.InMemorySubscriber()
        received: list[src.domain.queue_messages.IngestionMessage] = []

        async def callback(msg: src.domain.queue_messages.IngestionMessage) -> None:
            received.append(msg)

        await subscriber.start(callback)

        msg = src.domain.queue_messages.IngestionMessage(
            message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
            job_id="test-001",
            stream_id="dev",
            content="Test content",
        )
        msg_id: str = await publisher.publish(msg)
        assert msg_id.startswith("mem-")

        # Give the subscriber loop time to pick up the message
        await asyncio.sleep(0.2)

        assert len(received) == 1
        assert received[0].job_id == "test-001"
        assert received[0].content == "Test content"

        await subscriber.stop()
        await publisher.close()

    async def test_multiple_messages(self) -> None:
        publisher = src.adapters.pubsub.InMemoryPublisher()
        subscriber = src.adapters.pubsub.InMemorySubscriber()
        received: list[str] = []

        async def callback(msg: src.domain.queue_messages.IngestionMessage) -> None:
            received.append(msg.job_id)

        await subscriber.start(callback)

        for i in range(5):
            await publisher.publish(
                src.domain.queue_messages.IngestionMessage(
                    message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
                    job_id=f"batch-{i}",
                    stream_id="dev",
                    content=f"Content {i}",
                )
            )

        await asyncio.sleep(0.5)

        assert len(received) == 5
        assert set(received) == {f"batch-{i}" for i in range(5)}

        await subscriber.stop()

    async def test_callback_error_doesnt_crash_loop(self) -> None:
        publisher = src.adapters.pubsub.InMemoryPublisher()
        subscriber = src.adapters.pubsub.InMemorySubscriber()
        call_count = 0

        async def failing_callback(msg: src.domain.queue_messages.IngestionMessage) -> None:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ValueError("Simulated failure")

        await subscriber.start(failing_callback)

        # First message will fail, second should still be processed
        await publisher.publish(
            src.domain.queue_messages.IngestionMessage(
                message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
                job_id="fail-1",
                stream_id="dev",
                content="Will fail",
            )
        )
        await publisher.publish(
            src.domain.queue_messages.IngestionMessage(
                message_type=src.domain.queue_messages.IngestionMessageType.INGEST_TEXT,
                job_id="ok-2",
                stream_id="dev",
                content="Will succeed",
            )
        )

        await asyncio.sleep(0.3)
        assert call_count == 2

        await subscriber.stop()


# ═══════════════════════════════════════════════════════════════════════════════
# Concurrency Limiter tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestNoOpConcurrencyLimiter:
    """Test the no-op limiter (always allows)."""

    async def test_always_acquires(self) -> None:
        limiter = src.adapters.concurrency.NoOpConcurrencyLimiter()
        assert await limiter.acquire_slot("hki") is True
        assert await limiter.acquire_slot("hki") is True
        assert await limiter.get_active_count("hki") == 0

    async def test_release_is_noop(self) -> None:
        limiter = src.adapters.concurrency.NoOpConcurrencyLimiter()
        await limiter.release_slot("hki")  # Should not raise
        await limiter.close()


class TestConcurrencyLimitExceeded:
    """Test the exception."""

    def test_message(self) -> None:
        exc = src.adapters.concurrency.ConcurrencyLimitExceededError(org_id="hki", current=5, limit=5)
        assert "hki" in str(exc)
        assert "5/5" in str(exc)
        assert exc.org_id == "hki"
        assert exc.current == 5
        assert exc.limit == 5


class TestRedisConcurrencyLimiter:
    """Test Redis concurrency limiter with mocked Redis."""

    async def test_acquire_under_limit(self) -> None:
        mock_redis = unittest.mock.AsyncMock()
        mock_redis.incr = unittest.mock.AsyncMock(return_value=1)
        mock_redis.expire = unittest.mock.AsyncMock()

        limiter: src.adapters.concurrency.RedisConcurrencyLimiter = src.adapters.concurrency.RedisConcurrencyLimiter.__new__(src.adapters.concurrency.RedisConcurrencyLimiter)
        limiter._redis = mock_redis
        limiter._prefix = "kp:concurrency:"
        limiter._max_per_org = 5
        limiter._slot_ttl = 3600

        result: bool = await limiter.acquire_slot("hki")
        assert result is True
        mock_redis.incr.assert_called_once()

    async def test_acquire_over_limit(self) -> None:
        mock_redis = unittest.mock.AsyncMock()
        mock_redis.incr = unittest.mock.AsyncMock(return_value=6)
        mock_redis.decr = unittest.mock.AsyncMock()

        limiter: src.adapters.concurrency.RedisConcurrencyLimiter = src.adapters.concurrency.RedisConcurrencyLimiter.__new__(src.adapters.concurrency.RedisConcurrencyLimiter)
        limiter._redis = mock_redis
        limiter._prefix = "kp:concurrency:"
        limiter._max_per_org = 5
        limiter._slot_ttl = 3600

        result: bool = await limiter.acquire_slot("hki")
        assert result is False
        mock_redis.decr.assert_called_once()

    async def test_acquire_fails_open_on_redis_error(self) -> None:
        mock_redis = unittest.mock.AsyncMock()
        mock_redis.incr = unittest.mock.AsyncMock(side_effect=ConnectionError("Redis down"))

        limiter: src.adapters.concurrency.RedisConcurrencyLimiter = src.adapters.concurrency.RedisConcurrencyLimiter.__new__(src.adapters.concurrency.RedisConcurrencyLimiter)
        limiter._redis = mock_redis
        limiter._prefix = "kp:concurrency:"
        limiter._max_per_org = 5
        limiter._slot_ttl = 3600

        # Should fail-open (allow the job)
        result: bool = await limiter.acquire_slot("hki")
        assert result is True

    async def test_release_decrements(self) -> None:
        mock_redis = unittest.mock.AsyncMock()
        mock_redis.decr = unittest.mock.AsyncMock(return_value=2)

        limiter: src.adapters.concurrency.RedisConcurrencyLimiter = src.adapters.concurrency.RedisConcurrencyLimiter.__new__(src.adapters.concurrency.RedisConcurrencyLimiter)
        limiter._redis = mock_redis
        limiter._prefix = "kp:concurrency:"
        limiter._max_per_org = 5
        limiter._slot_ttl = 3600

        await limiter.release_slot("hki")
        mock_redis.decr.assert_called_once()

    async def test_release_guards_below_zero(self) -> None:
        mock_redis = unittest.mock.AsyncMock()
        mock_redis.decr = unittest.mock.AsyncMock(return_value=-1)
        mock_redis.set = unittest.mock.AsyncMock()

        limiter: src.adapters.concurrency.RedisConcurrencyLimiter = src.adapters.concurrency.RedisConcurrencyLimiter.__new__(src.adapters.concurrency.RedisConcurrencyLimiter)
        limiter._redis = mock_redis
        limiter._prefix = "kp:concurrency:"
        limiter._max_per_org = 5
        limiter._slot_ttl = 3600

        await limiter.release_slot("hki")
        mock_redis.set.assert_called_once()
