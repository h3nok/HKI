"""
Tests for the Tiered Caching System.

Validates L1 in-process cache (LRU + TTL), the TieredCache facade
(L1 + L2 Redis), circuit breaker, and the cache key generation utility.
"""

import pytest
import time

from src.adapters.cache import (
    L1Cache,
    TieredCache,
    _CircuitBreaker,
    make_cache_key,
)


# ═══════════════════════════════════════════════════════════════════════════════
# L1 Cache (In-Process LRU)
# ═══════════════════════════════════════════════════════════════════════════════


class TestL1Cache:
    @pytest.fixture
    def cache(self) -> L1Cache:
        return L1Cache(max_size=5)

    def test_get_miss(self, cache: L1Cache):
        assert cache.get("nonexistent") is None

    def test_set_and_get(self, cache: L1Cache):
        cache.set("key1", {"data": "value"})
        assert cache.get("key1") == {"data": "value"}

    def test_overwrite(self, cache: L1Cache):
        cache.set("key1", "old")
        cache.set("key1", "new")
        assert cache.get("key1") == "new"

    def test_lru_eviction(self, cache: L1Cache):
        # Fill cache to capacity (max_size=5)
        for i in range(5):
            cache.set(f"key{i}", i)

        # Add one more — should evict key0 (LRU)
        cache.set("key5", 5)
        assert cache.get("key0") is None
        assert cache.get("key5") == 5

    def test_lru_access_prevents_eviction(self, cache: L1Cache):
        for i in range(5):
            cache.set(f"key{i}", i)

        # Access key0 to make it recently used
        cache.get("key0")

        # Add one more — should evict key1 (now the LRU)
        cache.set("key5", 5)
        assert cache.get("key0") == 0  # Still present
        assert cache.get("key1") is None  # Evicted

    def test_ttl_expiry(self, cache: L1Cache):
        cache.set("key1", "value", ttl=1)
        assert cache.get("key1") == "value"

        # Wait for expiry
        time.sleep(1.1)
        assert cache.get("key1") is None

    def test_no_ttl_persists(self, cache: L1Cache):
        cache.set("key1", "value", ttl=0)
        assert cache.get("key1") == "value"

    def test_invalidate_existing(self, cache: L1Cache):
        cache.set("key1", "value")
        assert cache.invalidate("key1") is True
        assert cache.get("key1") is None

    def test_invalidate_nonexistent(self, cache: L1Cache):
        assert cache.invalidate("nonexistent") is False

    def test_clear(self, cache: L1Cache):
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.get("a") is None
        assert cache.get("b") is None

    def test_stats(self, cache: L1Cache):
        cache.set("a", 1)
        cache.get("a")  # hit
        cache.get("b")  # miss
        stats = cache.stats
        assert stats["size"] == 1
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 50.0

    def test_stores_various_types(self, cache: L1Cache):
        cache.set("str", "hello")
        cache.set("int", 42)
        cache.set("list", [1, 2, 3])
        cache.set("dict", {"a": 1})
        assert cache.get("str") == "hello"
        assert cache.get("int") == 42
        assert cache.get("list") == [1, 2, 3]
        assert cache.get("dict") == {"a": 1}


# ═══════════════════════════════════════════════════════════════════════════════
# Circuit Breaker
# ═══════════════════════════════════════════════════════════════════════════════


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = _CircuitBreaker(failure_threshold=3)
        assert cb.state == _CircuitBreaker.CLOSED
        assert cb.allow_request is True

    def test_stays_closed_under_threshold(self):
        cb = _CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == _CircuitBreaker.CLOSED
        assert cb.allow_request is True

    def test_opens_at_threshold(self):
        cb = _CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == _CircuitBreaker.OPEN
        assert cb.allow_request is False
        assert cb.stats["total_trips"] == 1

    def test_success_resets_count(self):
        cb = _CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        cb.record_failure()
        # Should still be closed — success reset the count
        assert cb.state == _CircuitBreaker.CLOSED

    def test_half_open_after_recovery_timeout(self):
        cb = _CircuitBreaker(
            failure_threshold=1, recovery_timeout=0.1,
        )
        cb.record_failure()
        assert cb.state == _CircuitBreaker.OPEN
        time.sleep(0.15)
        assert cb.state == _CircuitBreaker.HALF_OPEN
        assert cb.allow_request is True

    def test_half_open_success_closes(self):
        cb = _CircuitBreaker(
            failure_threshold=1, recovery_timeout=0.1,
        )
        cb.record_failure()
        time.sleep(0.15)
        assert cb.state == _CircuitBreaker.HALF_OPEN
        cb.record_success()
        assert cb.state == _CircuitBreaker.CLOSED

    def test_half_open_failure_reopens(self):
        cb = _CircuitBreaker(
            failure_threshold=1, recovery_timeout=0.1,
        )
        cb.record_failure()
        time.sleep(0.15)
        _ = cb.state  # Trigger HALF_OPEN transition
        cb.record_failure()
        assert cb.state == _CircuitBreaker.OPEN
        assert cb.stats["total_trips"] == 2


# ═══════════════════════════════════════════════════════════════════════════════
# Tiered Cache (L1 + L2)
# ═══════════════════════════════════════════════════════════════════════════════


class TestTieredCache:
    @pytest.fixture
    def cache(self) -> TieredCache:
        # L1-only mode (no Redis URL), disable early expiry for tests
        return TieredCache(
            redis_url="",
            l1_max_size=100,
            early_expiry_probability=0.0,
        )

    @pytest.mark.asyncio
    async def test_connect_without_redis(self, cache: TieredCache):
        await cache.connect()
        stats = cache.stats()
        assert stats["l2_connected"] is False

    @pytest.mark.asyncio
    async def test_set_and_get_l1_only(self, cache: TieredCache):
        await cache.connect()
        await cache.set("llm", "key1", {"response": "hello"})
        result = await cache.get("llm", "key1")
        assert result == {"response": "hello"}

    @pytest.mark.asyncio
    async def test_miss(self, cache: TieredCache):
        await cache.connect()
        result = await cache.get("llm", "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_namespace_isolation(self, cache: TieredCache):
        await cache.connect()
        await cache.set("llm", "key1", "llm_value")
        await cache.set("tool", "key1", "tool_value")
        assert await cache.get("llm", "key1") == "llm_value"
        assert await cache.get("tool", "key1") == "tool_value"

    @pytest.mark.asyncio
    async def test_custom_ttl(self, cache: TieredCache):
        await cache.connect()
        await cache.set("llm", "key1", "value", ttl=1)
        assert await cache.get("llm", "key1") == "value"
        time.sleep(1.1)
        assert await cache.get("llm", "key1") is None

    @pytest.mark.asyncio
    async def test_invalidate(self, cache: TieredCache):
        await cache.connect()
        await cache.set("tool", "key1", "value")
        await cache.invalidate("tool", "key1")
        assert await cache.get("tool", "key1") is None

    @pytest.mark.asyncio
    async def test_default_ttls(self):
        assert TieredCache.DEFAULT_TTLS["llm"] == 900
        assert TieredCache.DEFAULT_TTLS["tool"] == 300
        assert TieredCache.DEFAULT_TTLS["embedding"] == 3600

    @pytest.mark.asyncio
    async def test_stats_format(self, cache: TieredCache):
        await cache.connect()
        await cache.set("tool", "k1", "v1")
        await cache.get("tool", "k1")
        stats = cache.stats()
        assert "l1" in stats
        assert "l2_connected" in stats
        assert "l2_url" in stats
        assert "circuit_breaker" in stats
        assert "namespace_hit_rates" in stats
        assert "l2_avg_latency_ms" in stats

    @pytest.mark.asyncio
    async def test_close(self, cache: TieredCache):
        await cache.connect()
        await cache.close()
        stats = cache.stats()
        assert stats["l2_connected"] is False

    @pytest.mark.asyncio
    async def test_per_namespace_l1_sizing(self):
        cache = TieredCache(
            redis_url="", early_expiry_probability=0.0,
        )
        await cache.connect()
        # Trigger L1 creation for known namespaces
        await cache.set("tool", "k1", "v1")
        await cache.set("llm", "k1", "v1")
        tool_l1 = cache._get_l1("tool")
        llm_l1 = cache._get_l1("llm")
        assert tool_l1._max_size == 2000
        assert llm_l1._max_size == 500

    @pytest.mark.asyncio
    async def test_namespace_hit_rate_tracking(
        self, cache: TieredCache,
    ):
        await cache.connect()
        await cache.set("tool", "k1", "v1")
        await cache.get("tool", "k1")  # hit
        await cache.get("tool", "k2")  # miss
        stats = cache.stats()
        rates = stats["namespace_hit_rates"]
        assert "tool" in rates
        assert rates["tool"] == 50.0

    @pytest.mark.asyncio
    async def test_clear_namespace(self, cache: TieredCache):
        await cache.connect()
        await cache.set("tool", "k1", "v1")
        await cache.set("tool", "k2", "v2")
        await cache.clear_namespace("tool")
        assert await cache.get("tool", "k1") is None
        assert await cache.get("tool", "k2") is None


# ═══════════════════════════════════════════════════════════════════════════════
# Cache Key Generation
# ═══════════════════════════════════════════════════════════════════════════════


class TestMakeCacheKey:
    def test_deterministic(self):
        key1 = make_cache_key(model="gemini", temperature=0.3)
        key2 = make_cache_key(model="gemini", temperature=0.3)
        assert key1 == key2

    def test_order_independent(self):
        key1 = make_cache_key(a=1, b=2, c=3)
        key2 = make_cache_key(c=3, a=1, b=2)
        assert key1 == key2

    def test_different_inputs_different_keys(self):
        key1 = make_cache_key(model="gemini", temperature=0.3)
        key2 = make_cache_key(model="gemini", temperature=0.7)
        assert key1 != key2

    def test_returns_hex_string(self):
        key = make_cache_key(query="test")
        assert len(key) == 16
        assert all(c in "0123456789abcdef" for c in key)

    def test_handles_complex_types(self):
        key = make_cache_key(
            messages=[{"role": "user", "content": "hello"}],
            tools=["search", "inventory"],
            temperature=0.3,
        )
        assert len(key) == 16
