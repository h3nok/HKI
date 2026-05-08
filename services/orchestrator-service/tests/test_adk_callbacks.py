from __future__ import annotations

import pytest

from src.adapters.cache import TieredCache, make_cache_key
from src.core.config import settings
from src.domain.adk_callbacks import execute_tool_with_hooks


@pytest.mark.asyncio
async def test_search_knowledge_bypasses_stale_tool_cache(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "CORRECTIVE_RAG_ENABLED", False)

    cache = TieredCache(redis_url="", early_expiry_probability=0.0)
    await cache.connect()

    arguments = {"query": "fall-protection-plan.md"}
    cache_key = make_cache_key(tool="search_knowledge", **arguments)
    stale_result = {
        "query": arguments["query"],
        "total_results": 0,
        "results": [],
        "citations": [],
    }
    fresh_result = {
        "query": arguments["query"],
        "total_results": 1,
        "results": [{"id": "fresh-chunk"}],
        "citations": [{"id": "fresh-doc"}],
    }

    await cache.set("tool", cache_key, stale_result)

    calls: list[dict[str, str]] = []

    async def tool_func(**kwargs: str):
        calls.append(kwargs)
        return fresh_result

    result, duration_ms, cache_hit = await execute_tool_with_hooks(
        "search_knowledge",
        tool_func,
        arguments,
        cache=cache,
    )

    assert cache_hit is False
    assert duration_ms >= 0.0
    assert result == fresh_result
    assert calls == [arguments]
    assert await cache.get("tool", cache_key) == stale_result


@pytest.mark.asyncio
async def test_non_search_tools_still_use_tool_cache(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "CORRECTIVE_RAG_ENABLED", False)

    cache = TieredCache(redis_url="", early_expiry_probability=0.0)
    await cache.connect()

    arguments = {"query": "water"}
    cached_result = {
        "query": arguments["query"],
        "results": [{"sku": "1"}],
        "total": 1,
    }

    calls: list[dict[str, str]] = []

    async def tool_func(**kwargs: str):
        calls.append(kwargs)
        return cached_result

    first_result, _, first_cache_hit = await execute_tool_with_hooks(
        "search_products",
        tool_func,
        arguments,
        cache=cache,
    )
    second_result, _, second_cache_hit = await execute_tool_with_hooks(
        "search_products",
        tool_func,
        arguments,
        cache=cache,
    )

    assert first_cache_hit is False
    assert second_cache_hit is True
    assert first_result == cached_result
    assert second_result == cached_result
    assert calls == [arguments]
