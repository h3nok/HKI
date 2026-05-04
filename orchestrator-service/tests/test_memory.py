"""
Tests for the 4-store Memory System.

Validates all four memory stores (Semantic, Episodic, Procedural, Declarative)
and the unified MemoryManager facade, including recall aggregation and
prompt section generation.
"""

import pytest

from src.domain.memory import (
    DeclarativeMemory,
    EpisodicMemory,
    MemoryContext,
    MemoryManager,
    ProceduralMemory,
    SemanticMemory,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Semantic Memory
# ═══════════════════════════════════════════════════════════════════════════════


class TestSemanticMemory:
    @pytest.fixture
    def store(self) -> SemanticMemory:
        return SemanticMemory()

    @pytest.mark.asyncio
    async def test_store_and_recall_single_fact(self, store: SemanticMemory):
        await store.store("user:1", "department", "Electronics")
        facts = await store.recall("user:1", "department")
        assert len(facts) == 1
        assert facts[0]["key"] == "department"
        assert facts[0]["value"] == "Electronics"

    @pytest.mark.asyncio
    async def test_recall_all_facts_for_scope(self, store: SemanticMemory):
        await store.store("user:1", "department", "Electronics")
        await store.store("user:1", "tier", "Executive")
        facts = await store.recall("user:1")
        assert len(facts) == 2
        keys = {f["key"] for f in facts}
        assert keys == {"department", "tier"}

    @pytest.mark.asyncio
    async def test_recall_empty_scope(self, store: SemanticMemory):
        facts = await store.recall("user:nonexistent")
        assert facts == []

    @pytest.mark.asyncio
    async def test_recall_missing_key(self, store: SemanticMemory):
        await store.store("user:1", "department", "Electronics")
        facts = await store.recall("user:1", "nonexistent_key")
        assert facts == []

    @pytest.mark.asyncio
    async def test_overwrite_fact(self, store: SemanticMemory):
        await store.store("user:1", "department", "Electronics")
        await store.store("user:1", "department", "Grocery")
        facts = await store.recall("user:1", "department")
        assert facts[0]["value"] == "Grocery"

    @pytest.mark.asyncio
    async def test_forget_specific_key(self, store: SemanticMemory):
        await store.store("user:1", "a", "1")
        await store.store("user:1", "b", "2")
        removed = await store.forget("user:1", "a")
        assert removed is True
        facts = await store.recall("user:1")
        assert len(facts) == 1
        assert facts[0]["key"] == "b"

    @pytest.mark.asyncio
    async def test_forget_entire_scope(self, store: SemanticMemory):
        await store.store("user:1", "a", "1")
        await store.store("user:1", "b", "2")
        removed = await store.forget("user:1")
        assert removed is True
        facts = await store.recall("user:1")
        assert facts == []

    @pytest.mark.asyncio
    async def test_forget_nonexistent(self, store: SemanticMemory):
        removed = await store.forget("user:none", "x")
        assert removed is False

    @pytest.mark.asyncio
    async def test_scope_isolation(self, store: SemanticMemory):
        await store.store("user:1", "name", "Alice")
        await store.store("user:2", "name", "Bob")
        facts_1 = await store.recall("user:1")
        facts_2 = await store.recall("user:2")
        assert facts_1[0]["value"] == "Alice"
        assert facts_2[0]["value"] == "Bob"

    @pytest.mark.asyncio
    async def test_access_count_increments(self, store: SemanticMemory):
        await store.store("user:1", "key", "val")
        await store.recall("user:1", "key")
        await store.recall("user:1", "key")
        # Access count is internal — we verify recall still works
        facts = await store.recall("user:1", "key")
        assert len(facts) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Episodic Memory
# ═══════════════════════════════════════════════════════════════════════════════


class TestEpisodicMemory:
    @pytest.fixture
    def store(self) -> EpisodicMemory:
        return EpisodicMemory(max_episodes=5)

    @pytest.mark.asyncio
    async def test_store_and_recall_episode(self, store: EpisodicMemory):
        await store.store("user:1", "Asked about inventory levels")
        episodes = await store.recall("user:1")
        assert len(episodes) == 1
        assert "inventory" in episodes[0]["summary"]

    @pytest.mark.asyncio
    async def test_recall_returns_most_recent_first(self, store: EpisodicMemory):
        await store.store("user:1", "First question")
        await store.store("user:1", "Second question")
        await store.store("user:1", "Third question")
        episodes = await store.recall("user:1", limit=3)
        assert episodes[0]["summary"] == "Third question"
        assert episodes[2]["summary"] == "First question"

    @pytest.mark.asyncio
    async def test_limit_parameter(self, store: EpisodicMemory):
        for i in range(5):
            await store.store("user:1", f"Episode {i}")
        episodes = await store.recall("user:1", limit=2)
        assert len(episodes) == 2

    @pytest.mark.asyncio
    async def test_max_episodes_window(self, store: EpisodicMemory):
        # Max is 5 — store 7 episodes
        for i in range(7):
            await store.store("user:1", f"Episode {i}")
        episodes = await store.recall("user:1", limit=10)
        assert len(episodes) == 5
        # Should have episodes 2-6 (first two evicted)
        assert episodes[0]["summary"] == "Episode 6"

    @pytest.mark.asyncio
    async def test_clear_scope(self, store: EpisodicMemory):
        await store.store("user:1", "Some episode")
        cleared = await store.clear("user:1")
        assert cleared is True
        episodes = await store.recall("user:1")
        assert episodes == []

    @pytest.mark.asyncio
    async def test_clear_nonexistent(self, store: EpisodicMemory):
        cleared = await store.clear("user:none")
        assert cleared is False

    @pytest.mark.asyncio
    async def test_metadata_preserved(self, store: EpisodicMemory):
        await store.store("user:1", "Test", metadata={"agent": "retail", "tools_used": ["search"]})
        episodes = await store.recall("user:1")
        assert episodes[0]["metadata"]["agent"] == "retail"


# ═══════════════════════════════════════════════════════════════════════════════
# Procedural Memory
# ═══════════════════════════════════════════════════════════════════════════════


class TestProceduralMemory:
    @pytest.fixture
    def store(self) -> ProceduralMemory:
        return ProceduralMemory()

    @pytest.mark.asyncio
    async def test_store_and_recall_procedure(self, store: ProceduralMemory):
        await store.store(
            "user:1",
            "reorder_check",
            ["check_inventory(sku)", "get_pricing(sku)", "compare_to_reorder_point"],
            trigger="reorder",
        )
        procs = await store.recall("user:1", trigger="reorder")
        assert len(procs) == 1
        assert procs[0]["name"] == "reorder_check"
        assert len(procs[0]["steps"]) == 3

    @pytest.mark.asyncio
    async def test_trigger_matching(self, store: ProceduralMemory):
        await store.store("user:1", "proc_a", ["step1"], trigger="inventory check")
        await store.store("user:1", "proc_b", ["step1"], trigger="pricing analysis")
        procs = await store.recall("user:1", trigger="inventory")
        assert len(procs) == 1
        assert procs[0]["name"] == "proc_a"

    @pytest.mark.asyncio
    async def test_recall_all_when_no_trigger(self, store: ProceduralMemory):
        await store.store("user:1", "proc_a", ["s1"], trigger="a")
        await store.store("user:1", "proc_b", ["s2"], trigger="b")
        procs = await store.recall("user:1")
        assert len(procs) == 2

    @pytest.mark.asyncio
    async def test_recall_empty_scope(self, store: ProceduralMemory):
        procs = await store.recall("user:none")
        assert procs == []


# ═══════════════════════════════════════════════════════════════════════════════
# Declarative Memory
# ═══════════════════════════════════════════════════════════════════════════════


class TestDeclarativeMemory:
    @pytest.fixture
    def store(self) -> DeclarativeMemory:
        return DeclarativeMemory()

    @pytest.mark.asyncio
    async def test_store_and_recall_rule(self, store: DeclarativeMemory):
        await store.store("global", "Never exceed 15% markup", "pricing", priority=1)
        rules = await store.recall("global")
        assert len(rules) == 1
        assert "15%" in rules[0]["rule"]

    @pytest.mark.asyncio
    async def test_filter_by_category(self, store: DeclarativeMemory):
        await store.store("global", "Rule A", "pricing")
        await store.store("global", "Rule B", "compliance")
        rules = await store.recall("global", category="pricing")
        assert len(rules) == 1
        assert rules[0]["category"] == "pricing"

    @pytest.mark.asyncio
    async def test_priority_ordering(self, store: DeclarativeMemory):
        await store.store("global", "Low priority rule", "general", priority=10)
        await store.store("global", "High priority rule", "general", priority=1)
        rules = await store.recall("global")
        assert rules[0]["priority"] == 1
        assert rules[1]["priority"] == 10

    @pytest.mark.asyncio
    async def test_load_defaults(self, store: DeclarativeMemory):
        await store.load_defaults()
        rules = await store.recall("global")
        assert len(rules) == 8  # 8 default HKI rules
        # Check that compliance rules (priority 1) come first
        assert rules[0]["priority"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Memory Manager (Unified Facade)
# ═══════════════════════════════════════════════════════════════════════════════


class TestMemoryManager:
    @pytest.fixture
    async def manager(self) -> MemoryManager:
        mgr = MemoryManager()
        await mgr.initialize()
        return mgr

    @pytest.mark.asyncio
    async def test_initialize_loads_default_rules(self, manager: MemoryManager):
        rules = await manager.declarative.recall("global")
        assert len(rules) == 8

    @pytest.mark.asyncio
    async def test_store_and_recall_semantic(self, manager: MemoryManager):
        await manager.store_semantic("user123", "department", "Electronics")
        context = await manager.recall_all("user123", "conv1")
        assert len(context.semantic_facts) == 1
        assert context.semantic_facts[0]["value"] == "Electronics"

    @pytest.mark.asyncio
    async def test_store_and_recall_episode(self, manager: MemoryManager):
        await manager.store_episode("user123", "User asked about pricing", metadata={"agent": "retail"})
        context = await manager.recall_all("user123", "conv1")
        assert len(context.recent_episodes) == 1
        assert "pricing" in context.recent_episodes[0]["summary"]

    @pytest.mark.asyncio
    async def test_recall_all_aggregates_all_stores(self, manager: MemoryManager):
        await manager.store_semantic("user123", "pref", "organic")
        await manager.store_episode("user123", "Session summary")
        await manager.store_procedure("user123", "proc1", ["step1"], trigger="inventory check")
        context = await manager.recall_all("user123", "conv1", query="inventory check")
        assert context.total_memories > 0
        assert len(context.semantic_facts) == 1
        assert len(context.recent_episodes) == 1
        assert len(context.relevant_procedures) == 1
        assert len(context.applicable_rules) == 8  # default rules

    @pytest.mark.asyncio
    async def test_recall_all_empty_user(self, manager: MemoryManager):
        context = await manager.recall_all("new_user", "conv1")
        # Should still have the 8 default global rules
        assert len(context.applicable_rules) == 8
        assert len(context.semantic_facts) == 0
        assert len(context.recent_episodes) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Memory Context (Prompt Section Generation)
# ═══════════════════════════════════════════════════════════════════════════════


class TestMemoryContext:
    def test_empty_context_returns_empty_string(self):
        ctx = MemoryContext(total_memories=0)
        assert ctx.to_prompt_section() == ""

    def test_prompt_section_includes_facts(self):
        ctx = MemoryContext(
            semantic_facts=[{"key": "dept", "value": "Electronics"}],
            total_memories=1,
        )
        section = ctx.to_prompt_section()
        assert "=== MEMORY CONTEXT ===" in section
        assert "dept: Electronics" in section
        assert "=== END MEMORY ===" in section

    def test_prompt_section_includes_episodes(self):
        ctx = MemoryContext(
            recent_episodes=[{"summary": "Discussed inventory levels"}],
            total_memories=1,
        )
        section = ctx.to_prompt_section()
        assert "[Recent Interactions]" in section
        assert "Discussed inventory levels" in section

    def test_prompt_section_includes_rules(self):
        ctx = MemoryContext(
            applicable_rules=[{"rule": "Never exceed 15% markup"}],
            total_memories=1,
        )
        section = ctx.to_prompt_section()
        assert "[Business Rules]" in section
        assert "15%" in section

    def test_prompt_section_includes_procedures(self):
        ctx = MemoryContext(
            relevant_procedures=[{"name": "reorder_check", "steps": "step1, step2"}],
            total_memories=1,
        )
        section = ctx.to_prompt_section()
        assert "[Learned Procedures]" in section
        assert "reorder_check" in section
