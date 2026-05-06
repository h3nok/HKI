"""
Neo4j Knowledge Graph Adapter — Multi-Tenant Entity & Relationship Store

Provides tenant-isolated knowledge graph operations backed by Neo4j Aura.
Every node and relationship carries an org_id property, and all Cypher
queries are scoped to the caller's organization.

Graph Schema:
    (:Entity {id, org_id, name, type, properties})
    (:Document {id, org_id, title})
    (:Chunk {id, org_id, document_id})

    (Entity)-[:MENTIONED_IN {confidence, position}]->(Chunk)
    (Entity)-[:RELATED_TO {type, weight}]->(Entity)
    (Document)-[:CONTAINS]->(Chunk)
    (Chunk)-[:NEXT]->(Chunk)

Usage:
    graph = Neo4jKnowledgeGraph()
    await graph.connect("neo4j+s://xxx.databases.neo4j.io", "password")
    await graph.upsert_entities(org_id, entities, chunk_id)
    results = await graph.query_entities(org_id, "John Smith")
    await graph.close()
"""

from __future__ import annotations

import dataclasses
import logging
import typing
import uuid

import neo4j

logger: logging.Logger = logging.getLogger("knowledge.neo4j")


# ═══════════════════════════════════════════════════════════════════════════════
# Data Models — Extracted Entities and Relationships
# ═══════════════════════════════════════════════════════════════════════════════


@dataclasses.dataclass
class ExtractedEntity:
    """An entity extracted from document text."""

    name: str
    entity_type: str  # person, organization, product, concept, location, event
    properties: dict[str, typing.Any] = dataclasses.field(default_factory=dict)
    confidence: float = 1.0
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"ent_{uuid.uuid4().hex[:12]}"


@dataclasses.dataclass
class ExtractedRelationship:
    """A relationship between two extracted entities."""

    source_name: str
    target_name: str
    relationship_type: str  # works_for, located_in, related_to, etc.
    properties: dict[str, typing.Any] = dataclasses.field(default_factory=dict)
    weight: float = 1.0


@dataclasses.dataclass
class EntitySearchResult:
    """A result from entity search in the knowledge graph."""

    entity_id: str
    name: str
    entity_type: str
    org_id: str
    properties: dict[str, typing.Any] = dataclasses.field(default_factory=dict)
    connected_chunks: list[str] = dataclasses.field(default_factory=list)
    relevance: float = 1.0


@dataclasses.dataclass
class GraphPath:
    """A multi-hop path through the knowledge graph."""

    nodes: list[dict[str, typing.Any]] = dataclasses.field(default_factory=list)
    relationships: list[dict[str, typing.Any]] = dataclasses.field(default_factory=list)
    total_weight: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Neo4j Knowledge Graph — Tenant-Scoped Adapter
# ═══════════════════════════════════════════════════════════════════════════════


class Neo4jKnowledgeGraph:
    """
    Production knowledge graph backed by Neo4j Aura.

    All operations are scoped by org_id for multi-tenant isolation.
    Uses the official neo4j async driver with connection pooling.

    Constraints:
        - Entity uniqueness: (org_id, name, entity_type)
        - Document uniqueness: (org_id, id)
        - Chunk uniqueness: (org_id, id)
    """

    def __init__(self) -> None:
        self._driver = None

    async def connect(
        self,
        uri: str,
        password: str,
        username: str = "neo4j",
        database: str = "neo4j",
        max_connection_pool_size: int = 50,
    ) -> None:
        """Connect to Neo4j and initialize constraints."""
        import neo4j

        self._driver: neo4j.AsyncDriver = neo4j.AsyncGraphDatabase.driver(
            uri,
            auth=(username, password),
            max_connection_pool_size=max_connection_pool_size,
            database=database,
        )
        # Verify connectivity
        await self._driver.verify_connectivity()
        await self._init_constraints()
        logger.info("Neo4j connected", extra={"uri": uri, "database": database})

    async def close(self) -> None:
        """Close the Neo4j driver and release connections."""
        if self._driver:
            await self._driver.close()
            self._driver = None
            logger.info("Neo4j connection closed")

    @property
    def connected(self) -> bool:
        return self._driver is not None

    def _ensure_driver(self) -> neo4j.AsyncDriver:
        if self._driver is None:
            raise RuntimeError("Neo4j driver not initialized — call connect() first")
        return self._driver

    # ═══════════════════════════════════════════════════════════════════════
    # Schema — Constraints and Indexes
    # ═══════════════════════════════════════════════════════════════════════

    async def _init_constraints(self) -> None:
        """Create uniqueness constraints and indexes (idempotent)."""
        driver: neo4j.AsyncDriver = self._ensure_driver()
        constraints: list[tuple[str, str]] = [
            # Uniqueness constraints
            (
                "entity_unique",
                "CREATE CONSTRAINT entity_unique IF NOT EXISTS "
                "FOR (e:Entity) REQUIRE (e.org_id, e.name, e.entity_type) IS UNIQUE",
            ),
            (
                "document_unique",
                "CREATE CONSTRAINT document_unique IF NOT EXISTS "
                "FOR (d:Document) REQUIRE (d.org_id, d.id) IS UNIQUE",
            ),
            (
                "chunk_unique",
                "CREATE CONSTRAINT chunk_unique IF NOT EXISTS "
                "FOR (c:Chunk) REQUIRE (c.org_id, c.id) IS UNIQUE",
            ),
            # Indexes for tenant-scoped lookups
            (
                "idx_entity_org",
                "CREATE INDEX idx_entity_org IF NOT EXISTS FOR (e:Entity) ON (e.org_id)",
            ),
            (
                "idx_entity_type",
                "CREATE INDEX idx_entity_type IF NOT EXISTS "
                "FOR (e:Entity) ON (e.org_id, e.entity_type)",
            ),
            (
                "idx_entity_name",
                "CREATE INDEX idx_entity_name IF NOT EXISTS FOR (e:Entity) ON (e.org_id, e.name)",
            ),
            (
                "idx_document_org",
                "CREATE INDEX idx_document_org IF NOT EXISTS FOR (d:Document) ON (d.org_id)",
            ),
            (
                "idx_chunk_org",
                "CREATE INDEX idx_chunk_org IF NOT EXISTS FOR (c:Chunk) ON (c.org_id)",
            ),
        ]

        async with driver.session() as session:
            for name, cypher in constraints:
                try:
                    await session.run(cypher)
                except Exception as exc:
                    logger.warning(
                        "Constraint/index creation skipped",
                        extra={"name": name, "error": str(exc)},
                    )

    # ═══════════════════════════════════════════════════════════════════════
    # Write — Entity and Relationship Ingestion
    # ═══════════════════════════════════════════════════════════════════════

    async def upsert_entities(
        self,
        org_id: str,
        entities: list[ExtractedEntity],
        relationships: list[ExtractedRelationship],
        chunk_id: str,
        document_id: str,
        stream_id: str | None = None,
    ) -> dict[str, int]:
        """
        Upsert entities and relationships from a single chunk.

        Creates/updates Entity nodes, links them to the Chunk and Document,
        and creates inter-entity relationships. All scoped by org_id.

        Returns counts: {"entities": N, "relationships": N, "mentions": N}
        """
        driver: neo4j.AsyncDriver = self._ensure_driver()

        async with driver.session() as session:
            # Ensure Document and Chunk nodes exist
            await session.run(
                """
                MERGE (d:Document {id: $doc_id, org_id: $org_id})
                ON CREATE SET d.created_at = datetime(),
                              d.stream_id = $stream_id
                ON MATCH SET  d.stream_id = COALESCE(d.stream_id, $stream_id)
                """,
                doc_id=document_id,
                org_id=org_id,
                stream_id=stream_id,
            )
            await session.run(
                """
                MERGE (c:Chunk {id: $chunk_id, org_id: $org_id})
                ON CREATE SET c.document_id = $doc_id,
                              c.stream_id = $stream_id,
                              c.created_at = datetime()
                ON MATCH SET  c.stream_id = COALESCE(c.stream_id, $stream_id)
                WITH c
                MATCH (d:Document {id: $doc_id, org_id: $org_id})
                MERGE (d)-[:CONTAINS]->(c)
                """,
                chunk_id=chunk_id,
                doc_id=document_id,
                org_id=org_id,
                stream_id=stream_id,
            )

            # Upsert entities and link to chunk
            entity_count = 0
            mention_count = 0
            for entity in entities:
                await session.run(
                    """
                    MERGE (e:Entity {
                        org_id: $org_id,
                        name: $name,
                        entity_type: $entity_type
                    })
                    ON CREATE SET
                        e.id = $id,
                        e.properties = $properties,
                        e.created_at = datetime(),
                        e.mention_count = 1
                    ON MATCH SET
                        e.properties = $properties,
                        e.mention_count = e.mention_count + 1,
                        e.updated_at = datetime()
                    WITH e
                    MATCH (c:Chunk {id: $chunk_id, org_id: $org_id})
                    MERGE (e)-[m:MENTIONED_IN]->(c)
                    ON CREATE SET
                        m.confidence = $confidence,
                        m.created_at = datetime()
                    """,
                    org_id=org_id,
                    name=entity.name,
                    entity_type=entity.entity_type,
                    id=entity.id,
                    properties=entity.properties,
                    confidence=entity.confidence,
                    chunk_id=chunk_id,
                )
                entity_count += 1
                mention_count += 1

            # Upsert inter-entity relationships
            rel_count = 0
            for rel in relationships:
                await session.run(
                    """
                    MATCH (s:Entity {
                        org_id: $org_id, name: $source_name
                    })
                    MATCH (t:Entity {
                        org_id: $org_id, name: $target_name
                    })
                    MERGE (s)-[r:RELATED_TO {type: $rel_type}]->(t)
                    ON CREATE SET
                        r.weight = $weight,
                        r.org_id = $org_id,
                        r.created_at = datetime()
                    ON MATCH SET
                        r.weight = r.weight + $weight,
                        r.updated_at = datetime()
                    """,
                    org_id=org_id,
                    source_name=rel.source_name,
                    target_name=rel.target_name,
                    rel_type=rel.relationship_type,
                    weight=rel.weight,
                )
                rel_count += 1

        stats: dict[str, int] = {
            "entities": entity_count,
            "relationships": rel_count,
            "mentions": mention_count,
        }
        logger.info(
            "Entities upserted",
            extra={"org_id": org_id, "chunk_id": chunk_id, **stats},
        )
        return stats

    async def hvsi_audit(self, org_id: str | None = None) -> dict[str, int]:
        driver: neo4j.AsyncDriver = self._ensure_driver()

        document_filter: str = (
            "WHERE d.org_id = $org_id AND (NOT EXISTS(d.stream_id) OR trim(toString(d.stream_id)) = '')"
            if org_id
            else "WHERE NOT EXISTS(d.stream_id) OR trim(toString(d.stream_id)) = ''"
        )
        chunk_filter: str = (
            "WHERE c.org_id = $org_id AND (NOT EXISTS(c.stream_id) OR trim(toString(c.stream_id)) = '')"
            if org_id
            else "WHERE NOT EXISTS(c.stream_id) OR trim(toString(c.stream_id)) = ''"
        )
        params: dict[str, typing.Any] = {"org_id": org_id} if org_id else {}

        async with driver.session() as session:
            doc_result: neo4j.AsyncResult = await session.run(
                f"""
                MATCH (d:Document)
                {document_filter}
                RETURN count(d) AS count
                """,
                **params,
            )
            chunk_result: neo4j.AsyncResult = await session.run(
                f"""
                MATCH (c:Chunk)
                {chunk_filter}
                RETURN count(c) AS count
                """,
                **params,
            )

            doc_row: neo4j.Record | None = await doc_result.single()
            chunk_row: neo4j.Record | None = await chunk_result.single()

        return {
            "documents_missing_stream": int((doc_row or {}).get("count", 0)),
            "chunks_missing_stream": int((chunk_row or {}).get("count", 0)),
        }

    async def link_sequential_chunks(self, org_id: str, chunk_ids: list[str]) -> int:
        """Create NEXT relationships between sequential chunks."""
        driver: neo4j.AsyncDriver = self._ensure_driver()
        count = 0

        async with driver.session() as session:
            for i in range(len(chunk_ids) - 1):
                await session.run(
                    """
                    MATCH (a:Chunk {id: $a_id, org_id: $org_id})
                    MATCH (b:Chunk {id: $b_id, org_id: $org_id})
                    MERGE (a)-[:NEXT]->(b)
                    """,
                    a_id=chunk_ids[i],
                    b_id=chunk_ids[i + 1],
                    org_id=org_id,
                )
                count += 1

        return count

    # ═══════════════════════════════════════════════════════════════════════
    # Read — Entity Search and Graph Traversal
    # ═══════════════════════════════════════════════════════════════════════

    async def search_entities(
        self,
        org_id: str,
        query: str,
        entity_type: str | None = None,
        limit: int = 20,
        stream_ids: list[str] | None = None,
    ) -> list[EntitySearchResult]:
        """
        Search entities by name (case-insensitive substring match).

        Returns entities with their connected chunk IDs for RAG retrieval.
        Scoped to the caller's stream(s) when stream_ids is provided.
        Only chunks with an exact matching stream_id are visible.
        """
        driver: neo4j.AsyncDriver = self._ensure_driver()
        is_global: bool = not stream_ids

        type_filter: str = "AND e.entity_type = $entity_type" if entity_type else ""
        # For stream-scoped callers, only return entities that have at least
        # one accessible chunk in the exact requested stream set.
        stream_filter: str = "" if is_global else "WHERE size(accessible_chunks) > 0"
        chunk_match: str = (
            "OPTIONAL MATCH (e)-[:MENTIONED_IN]->(c:Chunk {org_id: $org_id})"
            if is_global
            else (
                "OPTIONAL MATCH (e)-[:MENTIONED_IN]->(c:Chunk {org_id: $org_id}) "
                "WHERE c.stream_id IN $stream_ids"
            )
        )
        cypher: str = f"""
            MATCH (e:Entity {{org_id: $org_id}})
            WHERE toLower(e.name) CONTAINS toLower($query)
            {type_filter}
            {chunk_match}
            WITH e, collect(c.id) AS accessible_chunks
            {stream_filter}
            RETURN e.id AS id, e.name AS name,
                   e.entity_type AS entity_type,
                   e.org_id AS org_id,
                   e.properties AS properties,
                   e.mention_count AS mention_count,
                   accessible_chunks AS chunk_ids
            ORDER BY e.mention_count DESC
            LIMIT $limit
        """

        params: dict[str, typing.Any] = {
            "org_id": org_id,
            "query": query,
            "limit": limit,
        }
        if entity_type:
            params["entity_type"] = entity_type
        if not is_global:
            params["stream_ids"] = stream_ids

        results: list[EntitySearchResult] = []
        async with driver.session() as session:
            result: neo4j.AsyncResult = await session.run(cypher, **params)
            records: list[dict[str, typing.Any]] = await result.data()

            for record in records:
                results.append(
                    EntitySearchResult(
                        entity_id=record["id"],
                        name=record["name"],
                        entity_type=record["entity_type"],
                        org_id=record["org_id"],
                        properties=record.get("properties") or {},
                        connected_chunks=record.get("chunk_ids") or [],
                        relevance=1.0,
                    )
                )

        return results

    async def get_entity_context(
        self,
        org_id: str,
        entity_name: str,
        max_depth: int = 2,
        limit: int = 50,
        stream_ids: list[str] | None = None,
    ) -> list[GraphPath]:
        """
        Get the neighborhood of an entity — related entities and
        their connecting relationships up to max_depth hops.

        Used by the orchestrator for multi-hop reasoning:
        "What products does Acme Corp sell?" → Entity(Acme Corp) →
        RELATED_TO → Entity(Product X) → MENTIONED_IN → Chunk(details)
        """
        driver: neo4j.AsyncDriver = self._ensure_driver()

        is_global: bool = not stream_ids
        # For stream-scoped callers, verify the starting entity has at least
        # one accessible chunk before traversing.  This prevents leaking entity
        # names that belong exclusively to other streams.
        access_check: str = (
            ""
            if is_global
            else """
            WITH start
            MATCH (start)-[:MENTIONED_IN]->(ac:Chunk {org_id: $org_id})
            WHERE ac.stream_id IN $stream_ids
            WITH start, count(ac) AS accessible
            WHERE accessible > 0
            """
        )
        cypher: str = f"""
            MATCH (start:Entity {{
                org_id: $org_id, name: $entity_name
            }})
            {access_check}
            MATCH path = (start)-[*1..$max_depth]-(connected)
            WHERE connected.org_id = $org_id
            WITH path, reduce(w = 0.0, r IN relationships(path) |
                w + COALESCE(r.weight, 1.0)) AS total_weight
            RETURN [n IN nodes(path) | {{
                id: n.id,
                name: n.name,
                type: coalesce(n.entity_type, labels(n)[0]),
                org_id: n.org_id
            }}] AS nodes,
            [r IN relationships(path) | {{
                type: type(r),
                weight: coalesce(r.weight, 1.0),
                source: startNode(r).name,
                target: endNode(r).name
            }}] AS rels,
            total_weight
            ORDER BY total_weight DESC
            LIMIT $limit
        """

        params: dict[str, typing.Any] = {
            "org_id": org_id,
            "entity_name": entity_name,
            "max_depth": max_depth,
            "limit": limit,
        }
        if not is_global:
            params["stream_ids"] = stream_ids

        paths: list[GraphPath] = []
        async with driver.session() as session:
            result: neo4j.AsyncResult = await session.run(
                cypher,
                **params,
            )
            records: list[dict[str, typing.Any]] = await result.data()

            for record in records:
                paths.append(
                    GraphPath(
                        nodes=record.get("nodes", []),
                        relationships=record.get("rels", []),
                        total_weight=record.get("total_weight", 0.0),
                    )
                )

        return paths

    async def get_chunk_entities(self, org_id: str, chunk_id: str) -> list[EntitySearchResult]:
        """Get all entities mentioned in a specific chunk."""
        driver: neo4j.AsyncDriver = self._ensure_driver()

        cypher = """
            MATCH (e:Entity {org_id: $org_id})-[m:MENTIONED_IN]->
                  (c:Chunk {id: $chunk_id, org_id: $org_id})
            RETURN e.id AS id, e.name AS name,
                   e.entity_type AS entity_type,
                   e.org_id AS org_id,
                   e.properties AS properties,
                   m.confidence AS confidence
            ORDER BY m.confidence DESC
        """

        results: list[EntitySearchResult] = []
        async with driver.session() as session:
            result: neo4j.AsyncResult = await session.run(cypher, org_id=org_id, chunk_id=chunk_id)
            records: list[dict[str, typing.Any]] = await result.data()

            for record in records:
                results.append(
                    EntitySearchResult(
                        entity_id=record["id"],
                        name=record["name"],
                        entity_type=record["entity_type"],
                        org_id=record["org_id"],
                        properties=record.get("properties") or {},
                        connected_chunks=[chunk_id],
                        relevance=record.get("confidence", 1.0),
                    )
                )

        return results

    # ═══════════════════════════════════════════════════════════════════════
    # Admin — Tenant Management
    # ═══════════════════════════════════════════════════════════════════════

    async def delete_document_graph(self, org_id: str, document_id: str) -> dict[str, int]:
        """
        Remove all graph data for a document within an organization.

        Deletes chunks, their MENTIONED_IN edges, and orphaned entities
        (entities with no remaining mentions in any chunk).
        """
        driver: neo4j.AsyncDriver = self._ensure_driver()

        async with driver.session() as session:
            # Get chunk count before deletion
            result: neo4j.AsyncResult = await session.run(
                """
                MATCH (d:Document {id: $doc_id, org_id: $org_id})
                       -[:CONTAINS]->(c:Chunk)
                RETURN count(c) AS chunk_count
                """,
                doc_id=document_id,
                org_id=org_id,
            )
            record: neo4j.Record | None = await result.single()
            chunk_count: typing.Any | int = record["chunk_count"] if record else 0

            # Delete chunks and their relationships
            await session.run(
                """
                MATCH (d:Document {id: $doc_id, org_id: $org_id})
                       -[:CONTAINS]->(c:Chunk)
                DETACH DELETE c
                """,
                doc_id=document_id,
                org_id=org_id,
            )

            # Delete the document node
            await session.run(
                """
                MATCH (d:Document {id: $doc_id, org_id: $org_id})
                DETACH DELETE d
                """,
                doc_id=document_id,
                org_id=org_id,
            )

            # Clean up orphaned entities (no remaining MENTIONED_IN edges)
            result: neo4j.AsyncResult = await session.run(
                """
                MATCH (e:Entity {org_id: $org_id})
                WHERE NOT (e)-[:MENTIONED_IN]->()
                WITH e, count(e) AS orphan_count
                DETACH DELETE e
                RETURN orphan_count
                """,
                org_id=org_id,
            )
            record: neo4j.Record | None = await result.single()
            orphans: typing.Any | int = record["orphan_count"] if record else 0

        stats: dict[str, typing.Any | int] = {
            "chunks_removed": chunk_count,
            "orphaned_entities_removed": orphans,
        }
        logger.info(
            "Document graph deleted",
            extra={"org_id": org_id, "document_id": document_id, **stats},
        )
        return stats

    async def org_stats(
        self,
        org_id: str,
        stream_ids: list[str] | None = None,
    ) -> dict[str, typing.Any]:
        """Get knowledge graph statistics for an organization.

        When stream_ids is provided, counts are limited to entities,
        documents, and chunks in those streams.
        """
        driver: neo4j.AsyncDriver = self._ensure_driver()
        is_global: bool = not stream_ids

        if is_global:
            cypher = """
                MATCH (e:Entity {org_id: $org_id})
                WITH count(e) AS entity_count
                OPTIONAL MATCH (d:Document {org_id: $org_id})
                WITH entity_count, count(d) AS doc_count
                OPTIONAL MATCH (c:Chunk {org_id: $org_id})
                WITH entity_count, doc_count, count(c) AS chunk_count
                OPTIONAL MATCH (:Entity {org_id: $org_id})
                              -[r:RELATED_TO]->()
                RETURN entity_count, doc_count, chunk_count,
                       count(r) AS relationship_count
            """
            params: dict[str, typing.Any] = {"org_id": org_id}
        else:
            cypher = """
                MATCH (c:Chunk {org_id: $org_id})
                WHERE c.stream_id IN $stream_ids
                WITH count(c) AS chunk_count
                OPTIONAL MATCH (e:Entity {org_id: $org_id})-[:MENTIONED_IN]->
                               (sc:Chunk {org_id: $org_id})
                WHERE sc.stream_id IN $stream_ids
                WITH chunk_count, count(DISTINCT e) AS entity_count
                OPTIONAL MATCH (d:Document {org_id: $org_id})
                WHERE d.stream_id IN $stream_ids
                WITH chunk_count, entity_count, count(d) AS doc_count
                RETURN entity_count, doc_count, chunk_count, 0 AS relationship_count
            """
            params = {"org_id": org_id, "stream_ids": stream_ids}

        async with driver.session() as session:
            result: neo4j.AsyncResult = await session.run(cypher, **params)
            record: neo4j.Record | None = await result.single()

            if not record:
                return {
                    "org_id": org_id,
                    "entities": 0,
                    "documents": 0,
                    "chunks": 0,
                    "relationships": 0,
                }

            return {
                "org_id": org_id,
                "entities": record["entity_count"],
                "documents": record["doc_count"],
                "chunks": record["chunk_count"],
                "relationships": record["relationship_count"],
            }
