"""
API Routes — Taxonomy Management

CRUD endpoints for the hierarchical taxonomy system. Consumed by the
Knowledge UI for vocabulary management and by the ingestion pipeline
for tag validation at ingest time.

Endpoints:
    POST   /v1/taxonomy/nodes          — Create a taxonomy node
    GET    /v1/taxonomy/nodes           — List root nodes
    GET    /v1/taxonomy/nodes/{id}      — Get node details
    PUT    /v1/taxonomy/nodes/{id}      — Update a node
    DELETE /v1/taxonomy/nodes/{id}      — Delete a node (optional cascade)
    GET    /v1/taxonomy/nodes/{id}/children — List children
    GET    /v1/taxonomy/nodes/{id}/path     — Get path from root
    POST   /v1/taxonomy/nodes/{id}/move     — Re-parent a node
    POST   /v1/taxonomy/validate        — Validate tags against taxonomy
    GET    /v1/taxonomy/info            — Tree summary statistics
"""

from __future__ import annotations

import fastapi
import pydantic

import src.core.auth
import src.core.logging
import src.domain.taxonomy

router = fastapi.APIRouter(
    prefix="/v1/taxonomy",
    tags=["taxonomy"],
    dependencies=[fastapi.Depends(src.core.auth.verify_request_jwt)],
)

_identity_dependency = fastapi.Depends(src.core.auth.verify_request_jwt)


# ── Request models ────────────────────────────────────────────────────────


class CreateNodeRequest(pydantic.BaseModel):
    label: str
    parent_id: str | None = None
    description: str = ""
    aliases: list[str] = pydantic.Field(default_factory=list)
    metadata: dict = pydantic.Field(default_factory=dict)


class UpdateNodeRequest(pydantic.BaseModel):
    label: str | None = None
    description: str | None = None
    aliases: list[str] | None = None
    metadata: dict | None = None


class MoveNodeRequest(pydantic.BaseModel):
    new_parent_id: str | None = None


class ValidateTagsRequest(pydantic.BaseModel):
    tags: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_tree(request: fastapi.Request, org_id: str) -> src.domain.taxonomy.TaxonomyTree:
    store = request.app.state.taxonomy_store
    return src.domain.taxonomy.TaxonomyTree(store=store, org_id=org_id)


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/nodes", response_model=src.domain.taxonomy.TaxonomyNode, status_code=201)
async def create_node(
    body: CreateNodeRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.TaxonomyNode:
    """Create a new taxonomy node."""
    tree = _get_tree(request, identity.org_id)
    try:
        node = await tree.create_node(
            label=body.label,
            parent_id=body.parent_id,
            description=body.description,
            aliases=body.aliases,
            metadata=body.metadata,
        )
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc

    src.core.logging.logger.info(
        "Taxonomy node created",
        extra={"node_id": node.id, "label": node.label},
    )
    return node


@router.get("/nodes", response_model=list[src.domain.taxonomy.TaxonomyNode])
async def list_roots(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[src.domain.taxonomy.TaxonomyNode]:
    """List all root-level taxonomy nodes."""
    tree = _get_tree(request, identity.org_id)
    return await tree.get_roots()


@router.get("/nodes/{node_id}", response_model=src.domain.taxonomy.TaxonomyNode)
async def get_node(
    node_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.TaxonomyNode:
    """Get a taxonomy node by ID."""
    store = request.app.state.taxonomy_store
    node = await store.get_node(node_id)
    if node is None:
        raise fastapi.HTTPException(status_code=404, detail="Node not found")
    return node


@router.put("/nodes/{node_id}", response_model=src.domain.taxonomy.TaxonomyNode)
async def update_node(
    node_id: str,
    body: UpdateNodeRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.TaxonomyNode:
    """Update a taxonomy node."""
    tree = _get_tree(request, identity.org_id)
    try:
        return await tree.update_node(
            node_id=node_id,
            label=body.label,
            description=body.description,
            aliases=body.aliases,
            metadata=body.metadata,
        )
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: str,
    request: fastapi.Request,
    cascade: bool = False,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> dict:
    """Delete a taxonomy node. Set cascade=true to remove descendants."""
    tree = _get_tree(request, identity.org_id)
    count = await tree.delete_node(node_id, cascade=cascade)
    if count == 0:
        raise fastapi.HTTPException(status_code=404, detail="Node not found")
    return {"deleted": count}


@router.get("/nodes/{node_id}/children", response_model=list[src.domain.taxonomy.TaxonomyNode])
async def get_children(
    node_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[src.domain.taxonomy.TaxonomyNode]:
    """List direct children of a taxonomy node."""
    tree = _get_tree(request, identity.org_id)
    return await tree.get_children(node_id)


@router.get("/nodes/{node_id}/path", response_model=list[src.domain.taxonomy.TaxonomyNode])
async def get_path(
    node_id: str,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> list[src.domain.taxonomy.TaxonomyNode]:
    """Get the path from root to the specified node."""
    tree = _get_tree(request, identity.org_id)
    return await tree.get_path(node_id)


@router.post("/nodes/{node_id}/move", response_model=src.domain.taxonomy.TaxonomyNode)
async def move_node(
    node_id: str,
    body: MoveNodeRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.TaxonomyNode:
    """Re-parent a taxonomy node."""
    tree = _get_tree(request, identity.org_id)
    try:
        return await tree.move_node(node_id, body.new_parent_id)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/validate", response_model=src.domain.taxonomy.ValidationResult)
async def validate_tags(
    body: ValidateTagsRequest,
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.ValidationResult:
    """Validate a set of tags against the taxonomy."""
    tree = _get_tree(request, identity.org_id)
    return await tree.validate_tags(body.tags)


@router.get("/info", response_model=src.domain.taxonomy.TaxonomyTreeInfo)
async def get_info(
    request: fastapi.Request,
    identity: src.core.auth.RequestIdentity = _identity_dependency,
) -> src.domain.taxonomy.TaxonomyTreeInfo:
    """Get summary statistics for the taxonomy tree."""
    tree = _get_tree(request, identity.org_id)
    return await tree.get_info()
