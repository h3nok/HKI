"""
Memory System — four-store memory architecture for agent continuity.

Implements the Memory Abstraction Layer from the architecture diagram.
Provides four specialized memory stores that the orchestrator uses to
maintain context across conversations and learn from interactions.

Memory Stores:
    SemanticMemory    — Long-term facts and entities (e.g., "user prefers Executive data")
    EpisodicMemory    — Conversation summaries and interaction history
    ProceduralMemory  — Learned workflows and multi-step procedures
    DeclarativeMemory — Business rules, policies, and constraints

Storage Backend:
    MVP uses in-process dictionaries. Each store defines a clear interface
    that can be swapped to Redis, AlloyDB, or a dedicated vector store
    in production without changing the orchestrator logic.

Usage:
    manager = MemoryManager()
    await manager.store_semantic("user:123", "preferred_department", "Electronics")
    facts = await manager.recall_semantic("user:123")
    context = await manager.recall_all("user:123", "conv:456")
"""

from __future__ import annotations

import time
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from src.core.logging import logger
from src.domain.models import MemoryPolicy

# ═══════════════════════════════════════════════════════════════════════════════
# Memory Record Types
# ═══════════════════════════════════════════════════════════════════════════════


class MemoryRecord(BaseModel):
    """Base record stored in any memory store."""

    key: str  # Lookup key (e.g., "user:123")
    value: Any  # The stored data
    store_type: str  # semantic | episodic | procedural | declarative
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    accessed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    access_count: int = 0  # How many times this memory was recalled
    ttl_seconds: int | None = None  # Optional expiry (None = permanent)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryContext(BaseModel):
    """
    Aggregated memory context injected into the LLM prompt.

    The orchestrator calls recall_all() before each LLM invocation
    to build this context, which is prepended to the system prompt.
    """

    semantic_facts: list[dict[str, Any]] = Field(default_factory=list)
    recent_episodes: list[dict[str, Any]] = Field(default_factory=list)
    relevant_procedures: list[dict[str, Any]] = Field(default_factory=list)
    applicable_rules: list[dict[str, Any]] = Field(default_factory=list)
    total_memories: int = 0

    def to_prompt_section(self) -> str:
        """
        Format memory context as a prompt section for LLM injection.

        Returns an empty string if no memories are available, so the
        orchestrator can conditionally skip the memory augmentation.
        """
        if self.total_memories == 0:
            return ""

        sections: list[str] = []
        sections.append("=== MEMORY CONTEXT ===")

        if self.semantic_facts:
            sections.append("\n[Known Facts]")
            for fact in self.semantic_facts:
                sections.append(f"- {fact.get('key', '?')}: {fact.get('value', '?')}")

        if self.recent_episodes:
            sections.append("\n[Recent Interactions]")
            for ep in self.recent_episodes:
                sections.append(f"- {ep.get('summary', '(no summary)')}")

        if self.relevant_procedures:
            sections.append("\n[Learned Procedures]")
            for proc in self.relevant_procedures:
                sections.append(f"- {proc.get('name', '?')}: {proc.get('steps', '?')}")

        if self.applicable_rules:
            sections.append("\n[Business Rules]")
            for rule in self.applicable_rules:
                sections.append(f"- {rule.get('rule', '?')}")

        sections.append("=== END MEMORY ===\n")
        return "\n".join(sections)


# ═══════════════════════════════════════════════════════════════════════════════
# Semantic Memory — facts and entities
# ═══════════════════════════════════════════════════════════════════════════════


class SemanticMemory:
    """
    Long-term storage for facts and entity knowledge.

    Stores key-value facts associated with a scope (user, conversation,
    global). Facts persist across conversations and accumulate over time.

    Examples:
        ("user:123", "preferred_department") → "Electronics"
        ("user:123", "membership_tier")      → "Executive"
        ("global", "busiest_warehouse")      → "WH-001"

    Production backend: Redis Hash per scope, with periodic persistence
    to AlloyDB for durability.
    """

    def __init__(self) -> None:
        # scope → {key → MemoryRecord}
        self._store: dict[str, dict[str, MemoryRecord]] = defaultdict(dict)

    async def store(
        self,
        scope: str,
        key: str,
        value: Any,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store or update a fact."""
        record = MemoryRecord(
            key=key,
            value=value,
            store_type="semantic",
            metadata=metadata or {},
        )
        self._store[scope][key] = record
        logger.debug("Semantic memory stored", extra={"scope": scope, "key": key})

    async def recall(self, scope: str, key: str | None = None) -> list[dict[str, Any]]:
        """
        Recall facts for a scope. If key is provided, return that specific
        fact; otherwise return all facts for the scope.
        """
        records = self._store.get(scope, {})
        if key:
            record = records.get(key)
            if record:
                record.accessed_at = datetime.now(UTC)
                record.access_count += 1
                return [{"key": record.key, "value": record.value, "metadata": record.metadata}]
            return []

        results: list[dict[str, Any]] = []
        for record in records.values():
            record.accessed_at = datetime.now(UTC)
            record.access_count += 1
            results.append({"key": record.key, "value": record.value, "metadata": record.metadata})
        return results

    async def forget(self, scope: str, key: str | None = None) -> bool:
        """Remove a specific fact or all facts for a scope."""
        if key:
            return self._store.get(scope, {}).pop(key, None) is not None
        removed = scope in self._store
        self._store.pop(scope, None)
        return removed


# ═══════════════════════════════════════════════════════════════════════════════
# Episodic Memory — conversation summaries and interaction history
# ═══════════════════════════════════════════════════════════════════════════════


class EpisodicMemory:
    """
    Stores conversation summaries and interaction episodes.

    Each episode captures the essence of a conversation: what was asked,
    what tools were used, and what the outcome was. This allows the agent
    to reference prior interactions ("As we discussed earlier...").

    Episodes are stored in recency order with a configurable window.

    Production backend: Redis Sorted Set (score = timestamp) with
    periodic archival to AlloyDB.
    """

    def __init__(self, max_episodes: int = 50) -> None:
        # scope → list of episodes (most recent last)
        self._store: dict[str, list[MemoryRecord]] = defaultdict(list)
        self._max = max_episodes

    async def store(
        self,
        scope: str,
        summary: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Store a conversation episode.

        Args:
            scope: Typically "user:{user_id}" for per-user history.
            summary: One-sentence summary of the interaction.
            metadata: Additional context (tools used, agent, topic).
        """
        record = MemoryRecord(
            key=f"episode_{int(time.time() * 1000)}",
            value=summary,
            store_type="episodic",
            metadata=metadata or {},
        )
        episodes = self._store[scope]
        episodes.append(record)
        # Trim to max window
        if len(episodes) > self._max:
            self._store[scope] = episodes[-self._max :]

    async def recall(self, scope: str, limit: int = 5) -> list[dict[str, Any]]:
        """Recall the most recent episodes for a scope."""
        episodes = self._store.get(scope, [])
        recent = episodes[-limit:]
        return [
            {
                "summary": ep.value,
                "timestamp": ep.created_at.isoformat(),
                "metadata": ep.metadata,
            }
            for ep in reversed(recent)  # Most recent first
        ]

    async def clear(self, scope: str) -> bool:
        """Clear all episodes for a scope."""
        removed = scope in self._store
        self._store.pop(scope, None)
        return removed


# ═══════════════════════════════════════════════════════════════════════════════
# Procedural Memory — learned workflows and multi-step procedures
# ═══════════════════════════════════════════════════════════════════════════════


class ProceduralMemory:
    """
    Stores learned multi-step workflows that the agent has executed
    successfully. When a similar task arises, the agent can reference
    these procedures to follow the same approach.

    Example:
        name: "inventory_reorder_check"
        steps: ["check_inventory(sku)", "get_pricing(sku)", "compare_to_reorder_point"]
        trigger: "When user asks about reorder status"

    Production backend: Redis Hash with procedure serialization.
    """

    def __init__(self) -> None:
        # scope → {procedure_name → MemoryRecord}
        self._store: dict[str, dict[str, MemoryRecord]] = defaultdict(dict)

    async def store(
        self,
        scope: str,
        name: str,
        steps: list[str],
        trigger: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a learned procedure."""
        record = MemoryRecord(
            key=name,
            value={"name": name, "steps": steps, "trigger": trigger},
            store_type="procedural",
            metadata=metadata or {},
        )
        self._store[scope][name] = record

    async def recall(self, scope: str, trigger: str = "") -> list[dict[str, Any]]:
        """
        Recall procedures for a scope. If trigger is provided,
        return only procedures matching the trigger keyword.
        """
        procedures = self._store.get(scope, {})
        results: list[dict[str, Any]] = []
        trigger_lower = trigger.lower()

        for record in procedures.values():
            proc = record.value
            if trigger_lower and trigger_lower not in proc.get("trigger", "").lower():
                continue
            record.accessed_at = datetime.now(UTC)
            record.access_count += 1
            results.append(proc)

        return results


# ═══════════════════════════════════════════════════════════════════════════════
# Declarative Memory — business rules and constraints
# ═══════════════════════════════════════════════════════════════════════════════


class DeclarativeMemory:
    """
    Stores business rules, policies, and constraints that the agent
    must always respect. These are typically loaded at startup from
    a configuration file or admin interface.

    Examples:
        - "Never disclose member financial information to non-members"
        - "HKI markup never exceeds 15% on any product"
        - "Executive membership requires minimum $130/year"

    Production backend: Loaded from a rules database, cached in Redis.
    """

    def __init__(self) -> None:
        # scope → list of rules
        self._store: dict[str, list[MemoryRecord]] = defaultdict(list)

    async def store(
        self,
        scope: str,
        rule: str,
        category: str = "general",
        priority: int = 5,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a business rule."""
        record = MemoryRecord(
            key=f"rule_{len(self._store[scope])}",
            value={"rule": rule, "category": category, "priority": priority},
            store_type="declarative",
            metadata=metadata or {},
        )
        self._store[scope].append(record)

    async def recall(
        self,
        scope: str,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Recall rules for a scope, optionally filtered by category."""
        rules = self._store.get(scope, [])
        results: list[dict[str, Any]] = []
        for record in rules:
            rule_data = record.value
            if category and rule_data.get("category") != category:
                continue
            results.append(rule_data)

        # Sort by priority (lower number = higher priority)
        results.sort(key=lambda r: r.get("priority", 5))
        return results

    async def load_defaults(self) -> None:
        """
        Load default HKI business rules.
        Called during service startup.
        """
        default_rules = [
            (
                "Never disclose member personal or financial information without verification.",
                "privacy",
                1,
            ),
            ("HKI's markup on any product never exceeds 15%.", "pricing", 2),
            (
                "Always recommend the Kirkland Signature alternative when available.",
                "merchandising",
                3,
            ),
            (
                "Executive membership requires annual spend of approximately $6,500 to break even.",
                "membership",
                3,
            ),
            (
                "HKI's return policy allows returns at any time for most merchandise.",
                "customer_service",
                3,
            ),
            ("All pharmacy interactions must comply with HIPAA regulations.", "compliance", 1),
            ("Controlled substance inquiries require member ID verification.", "compliance", 1),
            (
                "Electronics have a 90-day return window from date of receipt.",
                "customer_service",
                2,
            ),
        ]
        for rule, category, priority in default_rules:
            await self.store("global", rule, category=category, priority=priority)

        logger.info("Loaded default business rules", extra={"count": len(default_rules)})


# ═══════════════════════════════════════════════════════════════════════════════
# Memory Manager — unified facade
# ═══════════════════════════════════════════════════════════════════════════════


class MemoryManager:
    """
    Unified facade over all four memory stores.

    The orchestrator interacts exclusively with this manager.
    It provides two main operations:
        recall_all() — gather relevant memories before LLM invocation
        store_episode() — record the interaction after response generation

    The manager handles scoping (per-user, per-conversation, global)
    and aggregates results into a MemoryContext for prompt injection.

    Accepts injectable backends for production (Redis) or development
    (in-process). If no backends are provided, defaults to in-process.
    """

    def __init__(
        self,
        semantic: Any | None = None,
        episodic: Any | None = None,
        procedural: Any | None = None,
        declarative: Any | None = None,
    ) -> None:
        self.semantic = semantic or SemanticMemory()
        self.episodic = episodic or EpisodicMemory()
        self.procedural = procedural or ProceduralMemory()
        self.declarative = declarative or DeclarativeMemory()
        self._episode_write_counts: dict[str, int] = defaultdict(int)

    async def initialize(self) -> None:
        """Load default rules and any persisted state."""
        await self.declarative.load_defaults()
        logger.info("Memory manager initialized")

    async def recall_all(
        self,
        user_id: str,
        conversation_id: str,
        query: str = "",
        policy: MemoryPolicy | None = None,
    ) -> MemoryContext:
        """
        Aggregate memories from all four stores into a single context.

        Called by the orchestrator before each LLM invocation to provide
        the agent with relevant historical context.

        Args:
            user_id: Current user scope (e.g., "user:123")
            conversation_id: Current conversation scope
            query: Current user query (for procedural memory matching)

        Returns:
            MemoryContext with aggregated memories from all stores.
        """
        effective_policy = policy or MemoryPolicy()
        if not effective_policy.enabled:
            return MemoryContext()

        user_scope = f"user:{user_id}"

        # Recall from each store in parallel (all in-process, so fast)
        semantic_facts = await self.semantic.recall(user_scope)
        semantic_facts = semantic_facts[: max(0, effective_policy.max_semantic_facts)]

        recent_episodes = await self.episodic.recall(
            user_scope,
            limit=max(0, effective_policy.max_episodes),
        )

        procedures = await self.procedural.recall(user_scope, trigger=query)
        procedures = procedures[: max(0, effective_policy.max_procedures)]

        global_rules = (
            await self.declarative.recall("global")
            if effective_policy.include_rules
            else []
        )

        total = len(semantic_facts) + len(recent_episodes) + len(procedures) + len(global_rules)

        return MemoryContext(
            semantic_facts=semantic_facts,
            recent_episodes=recent_episodes,
            relevant_procedures=procedures,
            applicable_rules=global_rules,
            total_memories=total,
        )

    async def store_semantic(
        self,
        user_id: str,
        key: str,
        value: Any,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a fact about a user."""
        await self.semantic.store(f"user:{user_id}", key, value, metadata)

    async def store_episode(
        self,
        user_id: str,
        summary: str,
        metadata: dict[str, Any] | None = None,
        policy: MemoryPolicy | None = None,
    ) -> None:
        """Record a conversation episode."""
        effective_policy = policy or MemoryPolicy()
        if not effective_policy.enabled or not effective_policy.store_episodes:
            return

        scope = f"user:{user_id}"
        await self.episodic.store(scope, summary, metadata)
        self._episode_write_counts[scope] += 1

        threshold = max(1, effective_policy.consolidate_after_episodes)
        if self._episode_write_counts[scope] % threshold == 0:
            await self.compact_user_memory(user_id, effective_policy)

    async def store_procedure(
        self,
        user_id: str,
        name: str,
        steps: list[str],
        trigger: str = "",
    ) -> None:
        """Store a learned procedure."""
        await self.procedural.store(f"user:{user_id}", name, steps, trigger)

    async def compact_user_memory(
        self,
        user_id: str,
        policy: MemoryPolicy | None = None,
    ) -> None:
        """
        Compact episodic memory for a user by deduplicating recent summaries and
        reapplying the configured window. This is a lightweight, deterministic
        consolidation pass suitable for the MVP memory layer.
        """
        effective_policy = policy or MemoryPolicy()
        if not effective_policy.enabled or effective_policy.max_episodes <= 0:
            return

        scope = f"user:{user_id}"
        if not all(
            hasattr(self.episodic, attr) for attr in ("recall", "store", "clear")
        ):
            return

        recall_limit = max(
            effective_policy.max_episodes * 3,
            effective_policy.max_episodes,
        )
        recent = await self.episodic.recall(scope, limit=recall_limit)
        if len(recent) <= effective_policy.max_episodes:
            return

        deduped: list[dict[str, Any]] = []
        seen: set[str] = set()
        for episode in recent:
            normalized = " ".join(str(episode.get("summary", "")).lower().split())
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(episode)
            if len(deduped) >= effective_policy.max_episodes:
                break

        if len(deduped) == len(recent):
            return

        await self.episodic.clear(scope)
        for episode in reversed(deduped):
            await self.episodic.store(
                scope,
                str(episode.get("summary", "")),
                episode.get("metadata") or {},
            )

        logger.info(
            "Compacted episodic memory",
            extra={
                "user_id": user_id,
                "before_count": len(recent),
                "after_count": len(deduped),
            },
        )
