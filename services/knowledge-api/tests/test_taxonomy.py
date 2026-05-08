"""Tests for the Taxonomy Management system."""

from __future__ import annotations

import pytest

from src.domain.taxonomy import (
    InMemoryTaxonomyStore,
    TaxonomyNode,
    TaxonomyTree,
    ValidationResult,
    _edit_distance,
    _fuzzy_matches,
    _slugify,
)


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def store():
    return InMemoryTaxonomyStore()


@pytest.fixture
def tree(store):
    return TaxonomyTree(store=store, org_id="test-org")


# ── Unit tests: utilities ─────────────────────────────────────────────────


class TestSlugify:
    def test_basic(self):
        assert _slugify("Return Policy") == "return-policy"

    def test_special_chars(self):
        assert _slugify("FAQ & Help!") == "faq-help"

    def test_leading_trailing(self):
        assert _slugify("  spaces  ") == "spaces"

    def test_empty(self):
        assert _slugify("") == ""


class TestEditDistance:
    def test_identical(self):
        assert _edit_distance("cat", "cat") == 0

    def test_one_char(self):
        assert _edit_distance("cat", "bat") == 1

    def test_insertion(self):
        assert _edit_distance("cat", "cats") == 1

    def test_deletion(self):
        assert _edit_distance("cats", "cat") == 1

    def test_empty(self):
        assert _edit_distance("", "abc") == 3
        assert _edit_distance("abc", "") == 3


class TestFuzzyMatches:
    def test_close_matches(self):
        candidates = {"return-policy", "membership", "shipping"}
        matches = _fuzzy_matches("retur-policy", candidates, max_results=2)
        assert "return-policy" in matches

    def test_no_matches(self):
        candidates = {"alpha", "beta"}
        matches = _fuzzy_matches("zzzzzzzzzzz", candidates, max_distance=2)
        assert matches == []


# ── Integration tests: store ──────────────────────────────────────────────


class TestInMemoryTaxonomyStore:
    @pytest.mark.asyncio
    async def test_save_and_get(self, store):
        node = TaxonomyNode(label="Test", org_id="org1")
        await store.save_node(node)
        retrieved = await store.get_node(node.id)
        assert retrieved is not None
        assert retrieved.label == "Test"

    @pytest.mark.asyncio
    async def test_delete(self, store):
        node = TaxonomyNode(label="Delete Me", org_id="org1")
        await store.save_node(node)
        assert await store.delete_node(node.id) is True
        assert await store.get_node(node.id) is None
        assert await store.delete_node("nonexistent") is False

    @pytest.mark.asyncio
    async def test_list_nodes_by_parent(self, store):
        root = TaxonomyNode(label="Root", org_id="org1", parent_id=None)
        child = TaxonomyNode(label="Child", org_id="org1", parent_id=root.id)
        await store.save_node(root)
        await store.save_node(child)

        roots = await store.list_nodes("org1", parent_id=None)
        assert len(roots) == 1
        assert roots[0].id == root.id

        children = await store.list_nodes("org1", parent_id=root.id)
        assert len(children) == 1
        assert children[0].id == child.id

    @pytest.mark.asyncio
    async def test_list_all_sorted(self, store):
        n1 = TaxonomyNode(label="Zebra", org_id="org1", sort_order=2)
        n2 = TaxonomyNode(label="Apple", org_id="org1", sort_order=1)
        await store.save_node(n1)
        await store.save_node(n2)

        all_nodes = await store.list_all("org1")
        assert len(all_nodes) == 2
        assert all_nodes[0].sort_order <= all_nodes[1].sort_order


# ── Integration tests: tree ───────────────────────────────────────────────


class TestTaxonomyTree:
    @pytest.mark.asyncio
    async def test_create_root_node(self, tree):
        node = await tree.create_node(label="Policies")
        assert node.label == "Policies"
        assert node.parent_id is None
        assert node.slug == "policies"
        assert node.org_id == "test-org"

    @pytest.mark.asyncio
    async def test_create_child_node(self, tree):
        parent = await tree.create_node(label="Policies")
        child = await tree.create_node(label="Returns", parent_id=parent.id)
        assert child.parent_id == parent.id

    @pytest.mark.asyncio
    async def test_create_with_nonexistent_parent_raises(self, tree):
        with pytest.raises(ValueError, match="does not exist"):
            await tree.create_node(label="Orphan", parent_id="fake-id")

    @pytest.mark.asyncio
    async def test_duplicate_label_under_same_parent_raises(self, tree):
        await tree.create_node(label="Shipping")
        with pytest.raises(ValueError, match="Duplicate label"):
            await tree.create_node(label="Shipping")

    @pytest.mark.asyncio
    async def test_update_node(self, tree):
        node = await tree.create_node(label="Old Label")
        updated = await tree.update_node(
            node.id, label="New Label", description="Updated",
        )
        assert updated.label == "New Label"
        assert updated.description == "Updated"
        assert updated.slug == "new-label"

    @pytest.mark.asyncio
    async def test_update_nonexistent_raises(self, tree):
        with pytest.raises(ValueError, match="not found"):
            await tree.update_node("fake-id", label="X")

    @pytest.mark.asyncio
    async def test_delete_leaf(self, tree):
        node = await tree.create_node(label="Leaf")
        count = await tree.delete_node(node.id)
        assert count == 1

    @pytest.mark.asyncio
    async def test_delete_cascade(self, tree):
        root = await tree.create_node(label="Root")
        child = await tree.create_node(label="Child", parent_id=root.id)
        grandchild = await tree.create_node(label="GC", parent_id=child.id)
        count = await tree.delete_node(root.id, cascade=True)
        assert count == 3  # root + child + grandchild

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, tree):
        assert await tree.delete_node("nope") == 0

    @pytest.mark.asyncio
    async def test_move_node(self, tree):
        a = await tree.create_node(label="A")
        b = await tree.create_node(label="B")
        child = await tree.create_node(label="Child", parent_id=a.id)

        moved = await tree.move_node(child.id, new_parent_id=b.id)
        assert moved.parent_id == b.id

    @pytest.mark.asyncio
    async def test_move_to_descendant_raises(self, tree):
        parent = await tree.create_node(label="Parent")
        child = await tree.create_node(label="Child", parent_id=parent.id)
        with pytest.raises(ValueError, match="descendant"):
            await tree.move_node(parent.id, new_parent_id=child.id)

    @pytest.mark.asyncio
    async def test_get_roots(self, tree):
        await tree.create_node(label="R1")
        await tree.create_node(label="R2")
        roots = await tree.get_roots()
        assert len(roots) == 2

    @pytest.mark.asyncio
    async def test_get_children(self, tree):
        parent = await tree.create_node(label="Parent")
        await tree.create_node(label="C1", parent_id=parent.id)
        await tree.create_node(label="C2", parent_id=parent.id)
        children = await tree.get_children(parent.id)
        assert len(children) == 2

    @pytest.mark.asyncio
    async def test_get_path(self, tree):
        root = await tree.create_node(label="Root")
        mid = await tree.create_node(label="Mid", parent_id=root.id)
        leaf = await tree.create_node(label="Leaf", parent_id=mid.id)
        path = await tree.get_path(leaf.id)
        assert len(path) == 3
        assert path[0].id == root.id
        assert path[2].id == leaf.id

    @pytest.mark.asyncio
    async def test_get_info(self, tree):
        root = await tree.create_node(label="Root")
        await tree.create_node(label="Child", parent_id=root.id)
        info = await tree.get_info()
        assert info.total_nodes == 2
        assert info.root_count == 1
        assert info.max_depth == 2

    @pytest.mark.asyncio
    async def test_get_info_empty(self, tree):
        info = await tree.get_info()
        assert info.total_nodes == 0


# ── Tag validation ────────────────────────────────────────────────────────


class TestTagValidation:
    @pytest.mark.asyncio
    async def test_valid_tags(self, tree):
        await tree.create_node(label="Returns", aliases=["refunds"])
        result = await tree.validate_tags(["Returns", "refunds"])
        assert result.all_valid
        assert len(result.valid) == 2
        assert len(result.invalid) == 0

    @pytest.mark.asyncio
    async def test_invalid_tags_get_suggestions(self, tree):
        await tree.create_node(label="Shipping")
        result = await tree.validate_tags(["shiping"])  # typo
        assert not result.all_valid
        assert "shiping" in result.invalid
        assert "shiping" in result.suggestions
        assert "shipping" in result.suggestions["shiping"]

    @pytest.mark.asyncio
    async def test_case_insensitive(self, tree):
        await tree.create_node(label="Membership")
        result = await tree.validate_tags(["MEMBERSHIP", "membership"])
        assert result.all_valid

    @pytest.mark.asyncio
    async def test_slug_matching(self, tree):
        await tree.create_node(label="Return Policy")
        result = await tree.validate_tags(["return-policy"])
        assert result.all_valid

    @pytest.mark.asyncio
    async def test_empty_tags(self, tree):
        result = await tree.validate_tags([])
        assert result.all_valid
        assert result.valid == []
