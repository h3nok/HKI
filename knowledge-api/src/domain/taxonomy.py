"""
Taxonomy Management — controlled vocabulary for knowledge classification.

Provides a hierarchical taxonomy system that enforces consistent terminology
across the knowledge base. Agents and ingestion pipelines validate tags
against the taxonomy before storage, preventing vocabulary drift.

Architecture Blueprint alignment:
    "Taxonomy is a structured classification system that organizes
     knowledge into categories, hierarchies, and relationships.
     Creates a consistent vocabulary that both humans and AI models
     can interpret reliably."

Components:
    TaxonomyNode     — a single term in the hierarchy
    TaxonomyTree     — in-memory tree with CRUD + traversal
    TagValidator     — validates tags against the active taxonomy
    TaxonomyStore    — Protocol for persistent backends
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Protocol

from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class TaxonomyNode(BaseModel):
    """
    A single node in the taxonomy hierarchy.

    Nodes form a tree: each node has at most one parent and zero or
    more children. Aliases allow multiple surface forms to resolve
    to the same canonical term.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = "default"
    label: str  # Canonical term (e.g., "Return Policy")
    slug: str = ""  # URL-safe key (auto-generated if empty)
    parent_id: str | None = None  # None = root node
    description: str = ""
    aliases: list[str] = Field(default_factory=list)  # Alternate labels
    metadata: dict = Field(default_factory=dict)
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def model_post_init(self, __context: object) -> None:
        if not self.slug:
            self.slug = _slugify(self.label)


class TaxonomyTreeInfo(BaseModel):
    """Summary statistics for a taxonomy tree."""

    org_id: str
    total_nodes: int = 0
    max_depth: int = 0
    root_count: int = 0


class ValidationResult(BaseModel):
    """Result of validating a set of tags against the taxonomy."""

    valid: list[str] = Field(default_factory=list)
    invalid: list[str] = Field(default_factory=list)
    suggestions: dict[str, list[str]] = Field(
        default_factory=dict,
        description="For each invalid tag, a list of close matches",
    )
    all_valid: bool = True


# ═══════════════════════════════════════════════════════════════════════════════
# Store Protocol
# ═══════════════════════════════════════════════════════════════════════════════


class TaxonomyStore(Protocol):
    """Persistence interface for taxonomy nodes."""

    async def save_node(self, node: TaxonomyNode) -> None: ...
    async def get_node(self, node_id: str) -> TaxonomyNode | None: ...
    async def delete_node(self, node_id: str) -> bool: ...
    async def list_nodes(
        self,
        org_id: str,
        parent_id: str | None = ...,
    ) -> list[TaxonomyNode]: ...
    async def list_all(self, org_id: str) -> list[TaxonomyNode]: ...


# ═══════════════════════════════════════════════════════════════════════════════
# In-Memory Store (development fallback)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryTaxonomyStore:
    """
    In-memory taxonomy store for local development.

    Production: replace with AlloyDB-backed store using the same Protocol.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, TaxonomyNode] = {}

    async def save_node(self, node: TaxonomyNode) -> None:
        node.updated_at = datetime.now(UTC)
        self._nodes[node.id] = node

    async def get_node(self, node_id: str) -> TaxonomyNode | None:
        return self._nodes.get(node_id)

    async def delete_node(self, node_id: str) -> bool:
        return self._nodes.pop(node_id, None) is not None

    async def list_nodes(
        self,
        org_id: str,
        parent_id: str | None = None,
    ) -> list[TaxonomyNode]:
        return [n for n in self._nodes.values() if n.org_id == org_id and n.parent_id == parent_id]

    async def list_all(self, org_id: str) -> list[TaxonomyNode]:
        return sorted(
            (n for n in self._nodes.values() if n.org_id == org_id),
            key=lambda n: (n.sort_order, n.label),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Taxonomy Tree — business logic
# ═══════════════════════════════════════════════════════════════════════════════


class TaxonomyTree:
    """
    Manages a tenant-scoped taxonomy tree.

    All mutations go through the store for persistence.
    Query operations build results from the store's list methods.

    Usage:
        store = InMemoryTaxonomyStore()
        tree = TaxonomyTree(store=store, org_id="hki")
        node = await tree.create_node(label="Membership", parent_id=None)
        children = await tree.get_children(node.id)
    """

    def __init__(self, store: TaxonomyStore, org_id: str = "default") -> None:
        self._store = store
        self._org_id = org_id

    # ── CRUD ───────────────────────────────────────────────────────────────

    async def create_node(
        self,
        label: str,
        parent_id: str | None = None,
        description: str = "",
        aliases: list[str] | None = None,
        metadata: dict | None = None,
    ) -> TaxonomyNode:
        """Create and persist a new taxonomy node."""
        if parent_id is not None:
            parent = await self._store.get_node(parent_id)
            if parent is None:
                raise ValueError(f"Parent node {parent_id} does not exist")

        siblings = await self._store.list_nodes(self._org_id, parent_id)
        for sib in siblings:
            if sib.label.lower() == label.lower():
                raise ValueError(f"Duplicate label '{label}' under parent {parent_id}")

        node = TaxonomyNode(
            org_id=self._org_id,
            label=label,
            parent_id=parent_id,
            description=description,
            aliases=aliases or [],
            metadata=metadata or {},
            sort_order=len(siblings),
        )
        await self._store.save_node(node)
        return node

    async def update_node(
        self,
        node_id: str,
        label: str | None = None,
        description: str | None = None,
        aliases: list[str] | None = None,
        metadata: dict | None = None,
    ) -> TaxonomyNode:
        """Update an existing node's mutable fields."""
        node = await self._store.get_node(node_id)
        if node is None:
            raise ValueError(f"Node {node_id} not found")

        if label is not None:
            node.label = label
            node.slug = _slugify(label)
        if description is not None:
            node.description = description
        if aliases is not None:
            node.aliases = aliases
        if metadata is not None:
            node.metadata = metadata

        await self._store.save_node(node)
        return node

    async def delete_node(self, node_id: str, cascade: bool = False) -> int:
        """
        Delete a node. If cascade=True, also delete all descendants.
        Returns the number of nodes deleted.
        """
        node = await self._store.get_node(node_id)
        if node is None:
            return 0

        count = 0
        if cascade:
            descendants = await self._get_descendants(node_id)
            for desc in reversed(descendants):  # leaves first
                await self._store.delete_node(desc.id)
                count += 1

        await self._store.delete_node(node_id)
        count += 1
        return count

    async def move_node(self, node_id: str, new_parent_id: str | None) -> TaxonomyNode:
        """Re-parent a node within the tree."""
        node = await self._store.get_node(node_id)
        if node is None:
            raise ValueError(f"Node {node_id} not found")

        if new_parent_id is not None:
            # Prevent cycles: new parent must not be a descendant
            descendants = await self._get_descendants(node_id)
            desc_ids = {d.id for d in descendants}
            if new_parent_id in desc_ids:
                raise ValueError("Cannot move a node under its own descendant")
            parent = await self._store.get_node(new_parent_id)
            if parent is None:
                raise ValueError(f"Target parent {new_parent_id} not found")

        node.parent_id = new_parent_id
        await self._store.save_node(node)
        return node

    # ── Queries ────────────────────────────────────────────────────────────

    async def get_roots(self) -> list[TaxonomyNode]:
        """Return all root-level nodes."""
        return await self._store.list_nodes(self._org_id, parent_id=None)

    async def get_children(self, parent_id: str) -> list[TaxonomyNode]:
        """Return direct children of a node."""
        return await self._store.list_nodes(self._org_id, parent_id=parent_id)

    async def get_path(self, node_id: str) -> list[TaxonomyNode]:
        """Return the path from root to this node (inclusive)."""
        path: list[TaxonomyNode] = []
        current_id: str | None = node_id
        visited: set[str] = set()

        while current_id and current_id not in visited:
            visited.add(current_id)
            node = await self._store.get_node(current_id)
            if node is None:
                break
            path.append(node)
            current_id = node.parent_id

        path.reverse()
        return path

    async def get_info(self) -> TaxonomyTreeInfo:
        """Compute summary statistics for the taxonomy."""
        all_nodes = await self._store.list_all(self._org_id)
        if not all_nodes:
            return TaxonomyTreeInfo(org_id=self._org_id)

        root_count = sum(1 for n in all_nodes if n.parent_id is None)
        children_map: dict[str | None, list[str]] = {}
        for n in all_nodes:
            children_map.setdefault(n.parent_id, []).append(n.id)

        max_depth = 0
        for n in all_nodes:
            if n.parent_id is None:
                depth = self._measure_depth(n.id, children_map)
                max_depth = max(max_depth, depth)

        return TaxonomyTreeInfo(
            org_id=self._org_id,
            total_nodes=len(all_nodes),
            max_depth=max_depth,
            root_count=root_count,
        )

    # ── Tag Validation ─────────────────────────────────────────────────────

    async def validate_tags(self, tags: list[str]) -> ValidationResult:
        """
        Validate a list of tags against the taxonomy.

        Tags match if they equal any node label or alias (case-insensitive).
        Invalid tags get fuzzy suggestions based on edit distance.
        """
        all_nodes = await self._store.list_all(self._org_id)
        label_set: set[str] = set()
        for n in all_nodes:
            label_set.add(n.label.lower())
            label_set.add(n.slug)
            for alias in n.aliases:
                label_set.add(alias.lower())

        valid: list[str] = []
        invalid: list[str] = []
        suggestions: dict[str, list[str]] = {}

        for tag in tags:
            if tag.lower() in label_set or _slugify(tag) in label_set:
                valid.append(tag)
            else:
                invalid.append(tag)
                close = _fuzzy_matches(tag.lower(), label_set, max_results=3)
                if close:
                    suggestions[tag] = close

        return ValidationResult(
            valid=valid,
            invalid=invalid,
            suggestions=suggestions,
            all_valid=len(invalid) == 0,
        )

    # ── Internal helpers ───────────────────────────────────────────────────

    async def _get_descendants(self, node_id: str) -> list[TaxonomyNode]:
        """BFS to collect all descendants of a node."""
        all_nodes = await self._store.list_all(self._org_id)
        children_map: dict[str | None, list[TaxonomyNode]] = {}
        for n in all_nodes:
            children_map.setdefault(n.parent_id, []).append(n)

        result: list[TaxonomyNode] = []
        queue = list(children_map.get(node_id, []))
        while queue:
            current = queue.pop(0)
            result.append(current)
            queue.extend(children_map.get(current.id, []))
        return result

    @staticmethod
    def _measure_depth(
        node_id: str,
        children_map: dict[str | None, list[str]],
    ) -> int:
        """Measure the depth of a subtree rooted at node_id."""
        children = children_map.get(node_id, [])
        if not children:
            return 1
        return 1 + max(TaxonomyTree._measure_depth(cid, children_map) for cid in children)


# ═══════════════════════════════════════════════════════════════════════════════
# Utility functions
# ═══════════════════════════════════════════════════════════════════════════════


def _slugify(text: str) -> str:
    """Convert a label to a URL-safe slug."""
    import re

    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _edit_distance(a: str, b: str) -> int:
    """Levenshtein distance between two strings."""
    if len(a) < len(b):
        return _edit_distance(b, a)
    if not b:
        return len(a)

    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            cost = 0 if ca == cb else 1
            curr.append(
                min(
                    curr[j] + 1,  # insert
                    prev[j + 1] + 1,  # delete
                    prev[j] + cost,  # replace
                )
            )
        prev = curr
    return prev[-1]


def _fuzzy_matches(
    query: str,
    candidates: set[str],
    max_results: int = 3,
    max_distance: int = 3,
) -> list[str]:
    """Return the closest candidates by edit distance."""
    scored = []
    for c in candidates:
        dist = _edit_distance(query, c)
        if dist <= max_distance:
            scored.append((dist, c))
    scored.sort(key=lambda x: x[0])
    return [c for _, c in scored[:max_results]]
