"""
Tool Output Schemas — Pydantic models defining the expected shape of each tool's output.

Used by the VerificationEngine to perform fast, deterministic schema checks
after each tool execution. If the actual output doesn't match the expected
schema, the step fails verification without needing an LLM call.

Each schema is intentionally loose (most fields Optional) because real APIs
return varying shapes. The goal is to catch structural failures (missing
critical fields, wrong types) not to enforce a rigid contract.
"""

from __future__ import annotations

import typing

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Tool Output Schemas
# ═══════════════════════════════════════════════════════════════════════════════


class SearchProductsOutput(pydantic.BaseModel):
    query: str = ""
    results: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)
    total: int = 0


class CheckInventoryOutput(pydantic.BaseModel):
    sku: str = ""
    on_hand: int | None = None
    available: int | None = None
    reorder_point: int | None = None


class ProductDetailsOutput(pydantic.BaseModel):
    sku: str = ""
    name: str = ""
    price: float | None = None
    category: str = ""


class PricingOutput(pydantic.BaseModel):
    sku: str = ""
    regular_price: float | None = None
    current_price: float | None = None
    margin_pct: float | None = None


class MemberInfoOutput(pydantic.BaseModel):
    member_id: str = ""
    tier: str = ""
    annual_spend: float | None = None


class OrderStatusOutput(pydantic.BaseModel):
    order_id: str = ""
    status: str = ""
    eta: str | None = None


class SalesAnalysisOutput(pydantic.BaseModel):
    category: str = ""
    total_revenue: float | None = None
    units_sold: int | None = None


class KnowledgeSearchOutput(pydantic.BaseModel):
    query: str = ""
    total_results: int = 0
    results: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)
    citations: list[dict[str, typing.Any]] = pydantic.Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Registry — maps tool name → output schema
# ═══════════════════════════════════════════════════════════════════════════════

TOOL_OUTPUT_SCHEMAS: dict[str, type[pydantic.BaseModel]] = {
    "search_products": SearchProductsOutput,
    "check_inventory": CheckInventoryOutput,
    "get_product_details": ProductDetailsOutput,
    "get_pricing": PricingOutput,
    "get_member_info": MemberInfoOutput,
    "check_order_status": OrderStatusOutput,
    "analyze_sales": SalesAnalysisOutput,
    "search_knowledge": KnowledgeSearchOutput,
}


def validate_tool_output(tool_name: str, output: typing.Any) -> tuple[bool, str]:
    """
    Validate a tool's output against its expected schema.

    Returns:
        (is_valid, error_message) — error_message is empty if valid.
    """
    schema_cls: pydantic.BaseModel | None = TOOL_OUTPUT_SCHEMAS.get(tool_name)
    if schema_cls is None:
        # No schema defined — pass by default
        return True, ""

    if output is None:
        return False, f"Tool {tool_name} returned None"

    if not isinstance(output, dict):
        return False, f"Tool {tool_name} returned {type(output).__name__}, expected dict"

    try:
        schema_cls.model_validate(output)
        return True, ""
    except Exception as exc:
        return False, str(exc)
