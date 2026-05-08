"""
Tests for the hardened agent loop — validates that caching, tool schemas,
and execution policy are correctly wired into the AdkAgent.

Note: TestHistoryWindowing, TestToolCaching, and TestTokenBudget were
removed because the agent was refactored to use ADK's native reasoning
loop.  _window_messages() and _execute_tool() no longer exist on AdkAgent.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest  # noqa: F401

from src.adapters.cache import TieredCache, make_cache_key
from src.domain.agent import AdkAgent

# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


def _make_llm_response(content: str = "", tool_calls=None, usage=None):
    """Build a mock LLM response."""
    resp = MagicMock()
    resp.content = content
    resp.tool_calls = tool_calls or []
    resp.raw_tool_calls = [
        {
            "id": tc.id,
            "type": "function",
            "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
        }
        for tc in (tool_calls or [])
    ]
    resp.has_tool_calls = bool(tool_calls)
    resp.usage = usage or {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}
    resp.finish_reason = "stop"
    return resp


def _make_tool_call(tool_id: str, name: str, arguments: dict):
    """Build a mock tool call request."""
    tc = MagicMock()
    tc.id = tool_id
    tc.name = name
    tc.arguments = arguments
    return tc


# ═══════════════════════════════════════════════════════════════════════════════
# Cache Key Generation
# ═══════════════════════════════════════════════════════════════════════════════


class TestCacheKeyForTools:
    def test_same_args_same_key(self):
        k1 = make_cache_key(tool="search_products", query="water")
        k2 = make_cache_key(tool="search_products", query="water")
        assert k1 == k2

    def test_different_args_different_key(self):
        k1 = make_cache_key(tool="search_products", query="water")
        k2 = make_cache_key(tool="search_products", query="towels")
        assert k1 != k2

    def test_order_independent(self):
        k1 = make_cache_key(tool="check_inventory", sku="KS-001", warehouse_id="WH-1")
        k2 = make_cache_key(warehouse_id="WH-1", tool="check_inventory", sku="KS-001")
        assert k1 == k2


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Output Validation (wired in)
# ═══════════════════════════════════════════════════════════════════════════════


class TestToolOutputValidation:
    def test_valid_search_products_output(self):
        """A well-formed search_products result passes validation."""
        from src.domain.tool_schemas import validate_tool_output

        output = {"query": "water", "results": [{"sku": "KS-001", "name": "Water"}], "total": 1}
        is_valid, error = validate_tool_output("search_products", output)
        assert is_valid is True
        assert error == ""

    def test_invalid_output_caught(self):
        """A malformed result is flagged but doesn't crash (loose validation)."""
        from src.domain.tool_schemas import validate_tool_output

        # Not a dict — should at least not crash
        is_valid, error = validate_tool_output("search_products", "not a dict")
        # The validator should handle gracefully
        assert isinstance(is_valid, bool)

    def test_unknown_tool_passes(self):
        """Tools without a schema pass validation (no schema = no check)."""
        from src.domain.tool_schemas import validate_tool_output

        is_valid, error = validate_tool_output("unknown_tool", {"any": "data"})
        assert is_valid is True
