"""
Tool Registry for the Orchestrator Agent.

Defines tools as:
  1. OpenAI function-calling JSON schemas (for LiteLLM gateway)
  2. A name → callable registry for local execution

``get_openai_tools()`` returns the schema list to send in the chat
completion request; ``get_tool_registry()`` returns the dispatch map
used by the agent loop to actually execute a called tool.
"""

# Removed: from __future__ import annotations (causing ADK tool introspection issues)

import dataclasses
import typing

import src.core.config
import src.core.logging
import src.domain.models

logger = src.core.logging.logger.getChild("tools")

# ═══════════════════════════════════════════════════════════════════════════════
# Native Python Tool Declarations (Vertex AI Format)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Mock Product Catalog ──────────────────────────────────────────────────────
# Realistic HKI-style products for demo.  Replace with a real API call when
# the product-search service is available (see TODO below each function).

_PRODUCT_CATALOG: list[dict[str, typing.Any]] = [
    # Beverages
    {
        "sku": "KS-1001",
        "name": "Kirkland Signature Purified Water 40-pack",
        "category": "Beverages",
        "price": 4.99,
        "stock": 2400,
        "brand": "Kirkland Signature",
        "tags": ["water", "bottled", "purified", "hydration"],
    },
    {
        "sku": "KS-1002",
        "name": "Kirkland Signature Cold Brew Coffee 11oz 12-pack",
        "category": "Beverages",
        "price": 18.99,
        "stock": 340,
        "brand": "Kirkland Signature",
        "tags": ["coffee", "cold brew", "iced", "drinks"],
    },
    {
        "sku": "KS-1003",
        "name": "Kirkland Signature Organic Coconut Water 12-pack",
        "category": "Beverages",
        "price": 16.49,
        "stock": 185,
        "brand": "Kirkland Signature",
        "tags": ["coconut", "water", "organic", "electrolytes"],
    },
    {
        "sku": "BV-1010",
        "name": "San Pellegrino Sparkling Water 24-pack",
        "category": "Beverages",
        "price": 19.99,
        "stock": 560,
        "brand": "San Pellegrino",
        "tags": ["sparkling", "water", "mineral", "italian"],
    },
    {
        "sku": "BV-1011",
        "name": "Red Bull Energy Drink 24-pack",
        "category": "Beverages",
        "price": 36.99,
        "stock": 720,
        "brand": "Red Bull",
        "tags": ["energy", "drink", "caffeine"],
    },
    # Household
    {
        "sku": "KS-2001",
        "name": "Kirkland Signature Bath Tissue 30-roll",
        "category": "Household",
        "price": 22.99,
        "stock": 1800,
        "brand": "Kirkland Signature",
        "tags": ["toilet paper", "bath tissue", "bathroom", "tissue"],
    },
    {
        "sku": "KS-2002",
        "name": "Kirkland Signature Paper Towels 12-roll",
        "category": "Household",
        "price": 19.99,
        "stock": 0,
        "brand": "Kirkland Signature",
        "tags": ["paper towels", "kitchen", "cleaning"],
    },
    {
        "sku": "KS-2003",
        "name": "Kirkland Signature Ultra Clean Laundry Detergent 194 loads",
        "category": "Household",
        "price": 21.49,
        "stock": 650,
        "brand": "Kirkland Signature",
        "tags": ["laundry", "detergent", "cleaning", "soap"],
    },
    {
        "sku": "HH-2010",
        "name": "Bounty Advanced Select-A-Size Paper Towels 12-roll",
        "category": "Household",
        "price": 29.99,
        "stock": 420,
        "brand": "Bounty",
        "tags": ["paper towels", "kitchen", "cleaning", "select-a-size"],
    },
    {
        "sku": "HH-2011",
        "name": "Tide PODS Laundry Detergent 112 ct",
        "category": "Household",
        "price": 29.49,
        "stock": 310,
        "brand": "Tide",
        "tags": ["laundry", "detergent", "pods", "cleaning"],
    },
    # Snacks & Pantry
    {
        "sku": "KS-3001",
        "name": "Kirkland Signature Extra Fancy Mixed Nuts 2.5 lb",
        "category": "Snacks",
        "price": 14.99,
        "stock": 500,
        "brand": "Kirkland Signature",
        "tags": ["nuts", "mixed nuts", "snack", "cashew", "almond"],
    },
    {
        "sku": "KS-3002",
        "name": "Kirkland Signature Organic Extra Virgin Olive Oil 2L",
        "category": "Pantry",
        "price": 13.99,
        "stock": 275,
        "brand": "Kirkland Signature",
        "tags": ["olive oil", "organic", "cooking", "italian"],
    },
    {
        "sku": "KS-3003",
        "name": "Kirkland Signature Trail Mix 4 lb",
        "category": "Snacks",
        "price": 12.99,
        "stock": 390,
        "brand": "Kirkland Signature",
        "tags": ["trail mix", "snack", "nuts", "raisins", "chocolate"],
    },
    {
        "sku": "SN-3010",
        "name": "Stacy's Simply Naked Pita Chips 28 oz",
        "category": "Snacks",
        "price": 7.49,
        "stock": 180,
        "brand": "Stacy's",
        "tags": ["pita chips", "snack", "crackers"],
    },
    # Fresh & Deli
    {
        "sku": "FR-4001",
        "name": "Rotisserie Chicken",
        "category": "Deli",
        "price": 4.99,
        "stock": 120,
        "brand": "HKI",
        "tags": ["chicken", "rotisserie", "deli", "hot", "meal"],
    },
    {
        "sku": "FR-4002",
        "name": "Kirkland Signature Atlantic Salmon Fillet 3 lb",
        "category": "Fresh",
        "price": 32.99,
        "stock": 85,
        "brand": "Kirkland Signature",
        "tags": ["salmon", "fish", "seafood", "atlantic", "fillet"],
    },
    {
        "sku": "FR-4003",
        "name": "USDA Prime Ribeye Steak per lb",
        "category": "Fresh",
        "price": 27.99,
        "stock": 60,
        "brand": "USDA Prime",
        "tags": ["steak", "ribeye", "beef", "prime", "meat"],
    },
    # Electronics
    {
        "sku": "EL-5001",
        "name": 'Sony 65" BRAVIA XR OLED 4K TV',
        "category": "Electronics",
        "price": 1599.99,
        "stock": 12,
        "brand": "Sony",
        "tags": ["tv", "oled", "4k", "television", "65 inch", "sony"],
    },
    {
        "sku": "EL-5002",
        "name": 'Apple MacBook Air M3 15" 256GB',
        "category": "Electronics",
        "price": 1199.99,
        "stock": 45,
        "brand": "Apple",
        "tags": ["laptop", "macbook", "apple", "computer", "m3"],
    },
    {
        "sku": "EL-5003",
        "name": "Apple AirPods Pro 2nd Generation",
        "category": "Electronics",
        "price": 189.99,
        "stock": 220,
        "brand": "Apple",
        "tags": ["airpods", "earbuds", "headphones", "wireless", "apple"],
    },
    {
        "sku": "EL-5004",
        "name": 'Samsung 85" QLED 4K Smart TV',
        "category": "Electronics",
        "price": 1999.99,
        "stock": 8,
        "brand": "Samsung",
        "tags": ["tv", "qled", "4k", "television", "85 inch", "samsung"],
    },
    # Health & Pharmacy
    {
        "sku": "KS-6001",
        "name": "Kirkland Signature Ibuprofen 200mg 500 ct",
        "category": "Health",
        "price": 11.49,
        "stock": 900,
        "brand": "Kirkland Signature",
        "tags": ["ibuprofen", "pain relief", "medicine", "otc"],
    },
    {
        "sku": "KS-6002",
        "name": "Kirkland Signature Vitamin D3 2000 IU 600 ct",
        "category": "Health",
        "price": 9.99,
        "stock": 450,
        "brand": "Kirkland Signature",
        "tags": ["vitamin d", "supplement", "d3", "vitamins"],
    },
    {
        "sku": "KS-6003",
        "name": "Kirkland Signature Daily Multi Vitamins 500 ct",
        "category": "Health",
        "price": 14.99,
        "stock": 375,
        "brand": "Kirkland Signature",
        "tags": ["multivitamin", "vitamin", "supplement", "daily"],
    },
    # Office & Supplies
    {
        "sku": "OF-7001",
        "name": "HP 910XL Ink Cartridge Combo Pack",
        "category": "Office",
        "price": 79.99,
        "stock": 130,
        "brand": "HP",
        "tags": ["ink", "printer", "cartridge", "hp", "office"],
    },
    {
        "sku": "OF-7002",
        "name": "Duracell AA Batteries 40-pack",
        "category": "Office",
        "price": 16.99,
        "stock": 850,
        "brand": "Duracell",
        "tags": ["batteries", "aa", "power", "duracell"],
    },
]

# Index for fast lookup
_SKU_INDEX: dict[str, dict[str, typing.Any]] = {
    product["sku"]: product for product in _PRODUCT_CATALOG
}


def _score_product(product: dict[str, typing.Any], query: str) -> float:
    """Simple TF-like relevance scoring for demo search."""
    query_lower: str = query.lower()
    terms: list[str] = query_lower.split()
    score = 0.0
    name_lower = product["name"].lower()
    cat_lower = product["category"].lower()
    tags: list[typing.Any] = [t.lower() for t in product.get("tags", [])]
    brand_lower = product.get("brand", "").lower()

    for term in terms:
        if term in name_lower:
            score += 3.0
        if term in brand_lower:
            score += 2.0
        if term in cat_lower:
            score += 1.5
        if any(term in tag for tag in tags):
            score += 1.0
    return score


def search_products(query: str, category: str = "") -> dict[str, typing.Any]:
    """Search products in the retail catalog by keyword and optional category."""
    # TODO: Replace with real product search API or ADK Connector
    results: list[dict[str, typing.Any]] = _PRODUCT_CATALOG
    if category:
        cat_lower: str = category.lower()
        results = [
            product
            for product in results
            if cat_lower in product["category"].lower()
        ]

    scored: list[tuple[dict[str, typing.Any], float]] = [
        (product, _score_product(product, query)) for product in results
    ]
    scored: list[tuple[dict[str, typing.Any], float]] = [
        (product, score)
        for product, score in scored
        if score > 0
    ]
    scored.sort(key=lambda x: x[1], reverse=True)

    return {
        "query": query,
        "category": category or None,
        "results": [
            {
                "sku": p["sku"],
                "name": p["name"],
                "category": p["category"],
                "brand": p.get("brand", ""),
                "price": p["price"],
                "in_stock": p["stock"] > 0,
            }
            for p, _ in scored[:8]
        ],
        "total_results": len(scored),
    }


def check_inventory(sku: str, warehouse_id: str = "") -> dict[str, typing.Any]:
    """Check realtime inventory for a specific SKU."""
    # TODO: Replace with real WMS API call
    product: dict[str, typing.Any] | None = _SKU_INDEX.get(sku.upper()) or _SKU_INDEX.get(sku)
    if not product:
        return {
            "sku": sku,
            "warehouse_id": warehouse_id or "WH-001",
            "error": f"SKU {sku} not found in catalog.",
        }
    stock = product["stock"]
    return {
        "sku": sku,
        "product_name": product["name"],
        "warehouse_id": warehouse_id or "WH-001",
        "in_stock": stock > 0,
        "quantity": stock,
        "low_stock": 0 < stock <= 20,
        "next_delivery": "2026-04-10" if stock == 0 else None,
    }


def get_product_pricing(sku: str) -> dict[str, typing.Any]:
    """Get current pricing and promotion details for a SKU."""
    # TODO: Replace with real POS/Pricing API call
    product: dict[str, typing.Any] | None = _SKU_INDEX.get(sku.upper()) or _SKU_INDEX.get(sku)
    if not product:
        return {"sku": sku, "error": f"SKU {sku} not found in catalog."}

    base_price = product["price"]
    # Simulate some products having promotions
    has_promo: bool = hash(sku) % 3 == 0
    discount: typing.Any | int = round(base_price * 0.15, 2) if has_promo else 0
    return {
        "sku": sku,
        "product_name": product["name"],
        "base_price": base_price,
        "current_price": round(base_price - discount, 2),
        "has_promotion": has_promo,
        "discount_amount": discount,
        "discount_type": "member_instant_savings" if has_promo else None,
        "valid_until": "2026-04-30" if has_promo else None,
    }


def get_member_info(member_number: str) -> dict[str, typing.Any]:
    """Retrieve HKI member details and status."""
    return {
        "member_number": member_number,
        "level": "Executive",
        "status": "Active",
        "renewal_date": "2024-12-01",
        "rewards_balance": 184.50,
    }


async def search_knowledge(
    query: str,
    org_id: str = "default",
    top_k: int = 5,
    mode: str = "hybrid",
) -> dict[str, typing.Any]:
    """
    Search the organizational knowledge base using RAG.
    Mode is determined by the value stream's retrieval strategy (semantic|hybrid|graph).
    """
    from src.core.service_client import service_client

    url: str = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/search"
    payload = {
        "query": query,
        "org_id": org_id,
        "mode": mode,
        "top_k": top_k,
        "include_content": True,
        "include_citations": True,
        # Always rerank for agent queries — highest-stakes retrieval path.
        # Falls back silently to RRF order if the LLM gateway is unavailable.
        "rerank": True,
        # Post-retrieval context shaping: token budgeting + MMR diversity
        # so the agent receives a single optimised context string instead of
        # raw chunks.  Falls back gracefully (shaped_context absent) if the
        # knowledge-api cannot produce embeddings for MMR scoring.
        "shape_context": True,
        "shaping_max_tokens": 3072,
        "shaping_min_relevance": 0.35,
        "shaping_diversity_weight": 0.3,
    }

    try:
        async with service_client(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        results = [
            {
                "id": r.get("chunk_id"),
                "document_id": r.get("document_id"),
                "content": r.get("content", ""),
                "score": r.get("score", 0.0),
                "title": (r.get("citation") or {}).get("document_title", ""),
                "source_url": (r.get("citation") or {}).get("source_url", ""),
            }
            for r in data.get("results", [])
        ]

        citations = [
            {
                "document_id": c.get("document_id"),
                "title": c.get("document_title", ""),
                "preview": c.get("content_preview", ""),
                "score": c.get("relevance_score", 0.0),
                "url": c.get("source_url", ""),
                "highlight": c.get("highlight", ""),
            }
            for c in data.get("citations", [])
        ]

        logger.info(
            "Knowledge search completed",
            extra={
                "query": query,
                "result_count": len(results),
                "search_time_ms": data.get("search_time_ms", 0),
            },
        )

        shaped_context = data.get("shaped_context")

        # When the knowledge-api returns a shaped context string, that is the
        # primary input for the LLM — it has already been token-budgeted and
        # MMR-diversified.  Sending the raw `results` array alongside it would
        # duplicate content in the context window and confuse citation matching.
        # We keep only lightweight stubs (id + score + title) so corrective RAG
        # can still inspect relevance scores, but the full chunk text is omitted.
        if shaped_context:
            result_stubs = [
                {
                    "id": r["id"],
                    "document_id": r["document_id"],
                    "score": r["score"],
                    "title": r["title"],
                    "source_url": r["source_url"],
                }
                for r in results
            ]
            response: dict[str, typing.Any] = {
                "query": query,
                "context": shaped_context,          # primary: agent reads this
                "results": result_stubs,             # stubs only: used by corrective RAG
                "citations": citations,
                "total_results": data.get("total_results", len(results)),
                "search_time_ms": data.get("search_time_ms", 0),
                "shaping_stats": data.get("shaping_stats"),
            }
        else:
            # No shaped context (e.g. MMR scoring failed) — fall back to raw chunks.
            response = {
                "query": query,
                "results": results,
                "citations": citations,
                "total_results": data.get("total_results", len(results)),
                "search_time_ms": data.get("search_time_ms", 0),
            }
        return response

    except Exception as exc:
        logger.error(
            f"Knowledge API search failed: {exc}",
            extra={"query": query, "url": url},
        )
        return {
            "query": query,
            "results": [],
            "citations": [],
            "error": "Knowledge base search temporarily unavailable.",
        }


async def search_entities(
    query: str,
    entity_type: str = "",
    org_id: str = "default",
    limit: int = 10,
) -> dict[str, typing.Any]:
    """
    Search the knowledge graph for named entities (people, products, policies,
    concepts, locations) that appear in organizational documents.

    Use this when the user asks about specific named things — e.g. "what do we
    know about Product X?", "who is responsible for Y?" — to discover which
    documents and chunks mention that entity, then follow up with search_knowledge
    using the chunk IDs or entity name as the query.

    Returns a list of entities with their connected chunk IDs.
    """
    from src.core.service_client import service_client

    url: str = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/graph/entities/search"
    payload: dict[str, typing.Any] = {"query": query, "limit": limit}
    if entity_type:
        payload["entity_type"] = entity_type
    if org_id:
        payload["org_id"] = org_id

    try:
        async with service_client(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        entities = data.get("entities", [])
        logger.info(
            "Entity search completed",
            extra={"query": query, "entity_count": len(entities)},
        )
        return {
            "query": query,
            "entities": entities,
            "total": data.get("total", len(entities)),
        }

    except Exception as exc:
        logger.error(f"Entity search failed: {exc}", extra={"query": query})
        return {"query": query, "entities": [], "error": "Entity search temporarily unavailable."}


async def get_entity_context(
    entity_name: str,
    org_id: str = "default",
    max_depth: int = 2,
) -> dict[str, typing.Any]:
    """
    Explore the knowledge graph neighborhood of a named entity to support
    multi-hop reasoning.

    Use this after search_entities identifies a relevant entity, to discover
    how it connects to other entities and concepts. For example: finding all
    policies related to a product category, or all documents that mention
    both an entity and its related concepts.

    Returns paths (chains of entities and relationships) up to max_depth hops away.
    """
    from src.core.service_client import service_client

    url: str = f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/graph/entities/context"
    payload: dict[str, typing.Any] = {
        "entity_name": entity_name,
        "max_depth": max_depth,
        "limit": 30,
    }

    try:
        async with service_client(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        logger.info(
            "Entity context retrieved",
            extra={"entity": entity_name, "paths": data.get("total_paths", 0)},
        )
        return {
            "entity": entity_name,
            "paths": data.get("paths", []),
            "total_paths": data.get("total_paths", 0),
        }

    except Exception as exc:
        logger.error(f"Entity context failed: {exc}", extra={"entity": entity_name})
        return {
            "entity": entity_name,
            "paths": [],
            "error": "Entity context temporarily unavailable.",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Catalog — metadata used for governance, UI, and policy enforcement
# ═══════════════════════════════════════════════════════════════════════════════


@dataclasses.dataclass(frozen=True)
class ToolSpec:
    name: str
    func: typing.Any
    description: str
    category: str
    risk_level: src.domain.models.RiskLevel


_TOOL_SPECS: dict[str, ToolSpec] = {
    "search_products": ToolSpec(
        name="search_products",
        func=search_products,
        description="Search products in the retail catalog.",
        category="search",
        risk_level=src.domain.models.RiskLevel.LOW,
    ),
    "check_inventory": ToolSpec(
        name="check_inventory",
        func=check_inventory,
        description="Check realtime inventory for a specific SKU.",
        category="data",
        risk_level=src.domain.models.RiskLevel.LOW,
    ),
    "get_product_pricing": ToolSpec(
        name="get_product_pricing",
        func=get_product_pricing,
        description="Get current pricing and promotion details for a SKU.",
        category="data",
        risk_level=src.domain.models.RiskLevel.LOW,
    ),
    "get_member_info": ToolSpec(
        name="get_member_info",
        func=get_member_info,
        description="Retrieve HKI member details and status.",
        category="data",
        risk_level=src.domain.models.RiskLevel.HIGH,
    ),
    "search_knowledge": ToolSpec(
        name="search_knowledge",
        func=search_knowledge,
        description="Search the organizational knowledge base using RAG.",
        category="knowledge",
        risk_level=src.domain.models.RiskLevel.MEDIUM,
    ),
    "search_entities": ToolSpec(
        name="search_entities",
        func=search_entities,
        description=(
            "Search the knowledge graph for named entities (people, products, "
            "policies, concepts) that appear in organizational documents."
        ),
        category="knowledge",
        risk_level=src.domain.models.RiskLevel.LOW,
    ),
    "get_entity_context": ToolSpec(
        name="get_entity_context",
        func=get_entity_context,
        description=(
            "Explore entity relationships in the knowledge graph for multi-hop "
            "reasoning. Use after search_entities to find how an entity connects "
            "to related concepts and documents."
        ),
        category="knowledge",
        risk_level=src.domain.models.RiskLevel.LOW,
    ),
}


def get_tool_catalog(enabled_tools: list[str] | None = None) -> dict[str, ToolSpec]:
    """Return name → ToolSpec metadata, optionally filtered by allow-list."""
    if enabled_tools:
        allowed: set[str] = set(enabled_tools)
        return {name: spec for name, spec in _TOOL_SPECS.items() if name in allowed}
    return dict(_TOOL_SPECS)


def get_tool_spec(name: str) -> ToolSpec | None:
    """Return metadata for a single tool."""
    return _TOOL_SPECS.get(name)


# ═══════════════════════════════════════════════════════════════════════════════
# OpenAI Function-Calling Schemas
# ═══════════════════════════════════════════════════════════════════════════════

_TOOL_SCHEMAS: list[dict[str, typing.Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search products in the retail catalog.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "category": {"type": "string", "description": "Optional category filter"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Check realtime inventory for a specific SKU.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "Product SKU"},
                    "warehouse_id": {"type": "string", "description": "Optional warehouse ID"},
                },
                "required": ["sku"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_pricing",
            "description": "Get current pricing and promotion details for a SKU.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "Product SKU"},
                },
                "required": ["sku"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_member_info",
            "description": "Retrieve HKI member details and status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_number": {"type": "string", "description": "Member number"},
                },
                "required": ["member_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "Search the organizational knowledge base (hybrid RAG).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "org_id": {"type": "string", "description": "Organization ID"},
                },
                "required": ["query"],
            },
        },
    },
]

# Map function names to callables
_TOOL_REGISTRY: dict[str, typing.Any] = {name: spec.func for name, spec in _TOOL_SPECS.items()}


def get_openai_tools() -> list[dict[str, typing.Any]]:
    """Return tool schemas in OpenAI function-calling format."""
    return _TOOL_SCHEMAS


def get_tool_registry() -> dict[str, typing.Any]:
    """Return name → callable map for tool execution."""
    return _TOOL_REGISTRY
