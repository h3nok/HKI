from __future__ import annotations

import pytest

from src.adapters.vector_store import VectorStore
from src.domain.models import (
    Chunk,
    Document,
    DocumentAccessControl,
    DocumentClassification,
    DocumentMetadata,
    DocumentStatus,
    DocumentType,
)
from src.mcp_server import (
    DeleteDocumentInput,
    GetDocumentInput,
    GraphNeighborsInput,
    IngestInput,
    ListDocumentsInput,
    SearchInput,
    delete_document,
    discover_graph_neighbors,
    get_document,
    ingest_document,
    list_documents,
    search_knowledge,
)
import src.mcp_server as mcp_server


class StubEmbeddingClient:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 768 for _ in texts]

    async def embed_single(self, text: str) -> list[float]:
        return [0.1] * 768


@pytest.fixture()
def configured_mcp_store(monkeypatch: pytest.MonkeyPatch) -> VectorStore:
    store = VectorStore()
    monkeypatch.setattr(mcp_server, "_vector_store", store)
    monkeypatch.setattr(mcp_server, "_embedding_client", StubEmbeddingClient())
    monkeypatch.setattr(mcp_server, "_chunker", mcp_server.SentenceChunker(target_size=512, overlap=64))
    monkeypatch.setattr(mcp_server, "_using_local_embedder", True)
    monkeypatch.setattr(mcp_server, "_graph", None)
    monkeypatch.setattr(mcp_server, "_entity_extractor", None)
    return store


async def _seed_restricted_legal_doc(store: VectorStore) -> str:
    doc = Document(
        id="legal-doc",
        org_id="default",
        stream_id="legal",
        content="Privileged legal memo for active litigation.",
        metadata=DocumentMetadata(
            title="Legal Memo",
            department="Legal",
            document_type=DocumentType.POLICY,
            stream_id="legal",
            classification=DocumentClassification.RESTRICTED,
            access_control=DocumentAccessControl(
                allowed_groups=["department:legal"],
            ),
        ),
        status=DocumentStatus.PUBLISHED,
        chunk_count=1,
    )
    chunk = Chunk(
        id="legal-chunk",
        document_id=doc.id,
        org_id="default",
        content=doc.content,
        position=0,
        token_count=6,
        embedding=[0.1] * 768,
    )
    await store.store_document(doc, [chunk])
    return doc.id


@pytest.mark.asyncio
async def test_mcp_search_requires_stream_scope_and_acl(configured_mcp_store: VectorStore) -> None:
    await _seed_restricted_legal_doc(configured_mcp_store)

    hidden_without_stream = await search_knowledge(
        SearchInput(
            query="litigation memo",
            org_id="default",
            mode="keyword",
            caller_user_id="legal-user",
            caller_principals=["department:legal"],
        )
    )
    assert hidden_without_stream.total_results == 0

    hidden_for_wrong_group = await search_knowledge(
        SearchInput(
            query="litigation memo",
            org_id="default",
            mode="keyword",
            caller_user_id="ops-user",
            caller_principals=["department:operations"],
            value_streams=["legal"],
        )
    )
    assert hidden_for_wrong_group.total_results == 0

    visible = await search_knowledge(
        SearchInput(
            query="litigation memo",
            org_id="default",
            mode="keyword",
            caller_user_id="legal-user",
            caller_principals=["department:legal"],
            value_streams=["legal"],
        )
    )
    assert visible.total_results == 1
    assert visible.results[0].document_id == "legal-doc"


@pytest.mark.asyncio
async def test_mcp_document_management_respects_acl(configured_mcp_store: VectorStore) -> None:
    document_id = await _seed_restricted_legal_doc(configured_mcp_store)

    blocked_list = await list_documents(
        ListDocumentsInput(
            org_id="default",
            caller_user_id="ops-user",
            caller_principals=["department:operations"],
            value_streams=["legal"],
        )
    )
    assert blocked_list.total == 0

    allowed_list = await list_documents(
        ListDocumentsInput(
            org_id="default",
            caller_user_id="legal-user",
            caller_principals=["department:legal"],
            value_streams=["legal"],
        )
    )
    assert allowed_list.total == 1
    assert allowed_list.documents[0].id == document_id

    with pytest.raises(ValueError, match="Document not found"):
        await get_document(
            GetDocumentInput(
                document_id=document_id,
                org_id="default",
                caller_user_id="ops-user",
                caller_principals=["department:operations"],
                value_streams=["legal"],
            )
        )

    with pytest.raises(ValueError, match="Document not found"):
        await delete_document(
            DeleteDocumentInput(
                document_id=document_id,
                org_id="default",
                caller_user_id="ops-user",
                caller_principals=["department:operations"],
                value_streams=["legal"],
            )
        )

    detail = await get_document(
        GetDocumentInput(
            document_id=document_id,
            org_id="default",
            caller_user_id="legal-user",
            caller_principals=["department:legal"],
            value_streams=["legal"],
        )
    )
    assert detail.id == document_id


@pytest.mark.asyncio
async def test_mcp_graph_neighbors_are_acl_aware(configured_mcp_store: VectorStore) -> None:
    await _seed_restricted_legal_doc(configured_mcp_store)

    blocked = await discover_graph_neighbors(
        GraphNeighborsInput(
            chunk_id="legal-chunk",
            org_id="default",
            caller_user_id="ops-user",
            caller_principals=["department:operations"],
            value_streams=["legal"],
        )
    )
    assert blocked.nodes[0].label == "Unknown"

    allowed = await discover_graph_neighbors(
        GraphNeighborsInput(
            chunk_id="legal-chunk",
            org_id="default",
            caller_user_id="legal-user",
            caller_principals=["department:legal"],
            value_streams=["legal"],
        )
    )
    assert allowed.nodes[0].label == "Legal Memo"


@pytest.mark.asyncio
async def test_mcp_ingest_preserves_acl_metadata(configured_mcp_store: VectorStore) -> None:
    result = await ingest_document(
        IngestInput(
            content="Privileged merger memo for counsel.",
            org_id="default",
            title="Merger Memo",
            department="Legal",
            document_type="policy",
            classification="restricted",
            access_control=DocumentAccessControl(
                allowed_groups=["department:legal"],
                denied_groups=["department:sales"],
            ),
            stream_id="legal",
        )
    )

    stored = await configured_mcp_store.get_document(
        result.document_id,
        org_id="default",
        allowed_streams=["legal"],
        user_id="legal-user",
        principals=["department:legal"],
    )
    assert stored is not None
    assert stored.metadata.classification == DocumentClassification.RESTRICTED
    assert stored.metadata.access_control.allowed_groups == ["department:legal"]
    assert stored.metadata.stream_id == "legal"
