from __future__ import annotations

import time

import hki_runtime
import pytest

import src.adapters.cache
import src.core.config
import src.domain.adk_callbacks


def _envelope(domain: str) -> hki_runtime.HkiEnvelope:
    now = int(time.time())
    validation: hki_runtime.HkiValidationResult = hki_runtime.validate_envelope(
        {
            "hki_version": "1.0",
            "envelope_id": f"env-{domain}",
            "org_id": "default",
            "subject_id": "user-1",
            "active_domain": domain,
            "authorized_domains": [domain],
            "purpose": "tool-call",
            "risk_tier": "read-only",
            "policy_pack_id": "policy-test",
            "issued_at": now - 1,
            "expires_at": now + 300,
            "issuer": "agentic-bff",
            "signature": "sig-test",
        },
        require_signature=True,
    )
    assert validation.envelope is not None
    return validation.envelope


@pytest.mark.asyncio
async def test_search_knowledge_bypasses_stale_tool_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(src.core.config.settings, "CORRECTIVE_RAG_ENABLED", False)

    cache = src.adapters.cache.TieredCache(redis_url="", early_expiry_probability=0.0)
    await cache.connect()

    arguments: dict[str, str] = {"query": "fall-protection-plan.md"}
    cache_key: str = src.adapters.cache.make_cache_key(tool="search_knowledge", **arguments)
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

    result, duration_ms, cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
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
async def test_non_search_tools_still_use_tool_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(src.core.config.settings, "CORRECTIVE_RAG_ENABLED", False)

    cache = src.adapters.cache.TieredCache(redis_url="", early_expiry_probability=0.0)
    await cache.connect()

    arguments: dict[str, str] = {"query": "water"}
    cached_result = {
        "query": arguments["query"],
        "results": [{"sku": "1"}],
        "total": 1,
    }

    calls: list[dict[str, str]] = []

    async def tool_func(**kwargs: str):
        calls.append(kwargs)
        return cached_result

    first_result, _, first_cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
        "search_products",
        tool_func,
        arguments,
        cache=cache,
    )
    second_result, _, second_cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
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


@pytest.mark.asyncio
async def test_tool_cache_key_is_bound_to_hki_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(src.core.config.settings, "CORRECTIVE_RAG_ENABLED", False)

    cache = src.adapters.cache.TieredCache(redis_url="", early_expiry_probability=0.0)
    await cache.connect()

    arguments: dict[str, str] = {"query": "water"}
    calls: list[dict[str, str]] = []

    async def tool_func(**kwargs: str) -> dict[str, int]:
        calls.append(kwargs)
        return {"call_count": len(calls)}

    first_result, _, first_cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
        "search_products",
        tool_func,
        arguments,
        cache=cache,
        hki_envelope=_envelope("pharmacy"),
    )
    second_result, _, second_cache_hit = await src.domain.adk_callbacks.execute_tool_with_hooks(
        "search_products",
        tool_func,
        arguments,
        cache=cache,
        hki_envelope=_envelope("optical"),
    )

    assert first_cache_hit is False
    assert second_cache_hit is False
    assert first_result == {"call_count": 1}
    assert second_result == {"call_count": 2}
    assert calls == [arguments, arguments]
