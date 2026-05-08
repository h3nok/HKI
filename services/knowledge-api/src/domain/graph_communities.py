"""
Graph RAG Community Detection — Neo4j Louvain + community summaries.

Detects communities of related entities in the knowledge graph using
the Louvain algorithm, then generates summary descriptions for each
community. These summaries enable "global search" — answering questions
about broad topics by consulting community descriptions rather than
individual chunks.

Reference: GraphRAG (Microsoft Research, 2024)

Architecture:
    Neo4j knowledge graph
      → Run Louvain community detection (GDS plugin)
      → For each community: gather member entities + chunks
      → Summarize with Gemini
      → Store community summaries as searchable nodes
      → Enable community-level search in the retrieval pipeline

Usage:
    detector = CommunityDetector(
        neo4j_driver=driver,
        gemini_client=gemini,
    )
    report = await detector.detect_and_summarize(org_id="default")
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from src.core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class Community(BaseModel):
    """A detected community in the knowledge graph."""
    community_id: int
    member_count: int = 0
    entity_names: list[str] = Field(default_factory=list)
    summary: str = ""
    representative_chunks: list[str] = Field(default_factory=list)


class CommunityReport(BaseModel):
    """Report from community detection run."""
    org_id: str = "default"
    total_communities: int = 0
    communities: list[Community] = Field(default_factory=list)
    summaries_generated: int = 0
    duration_ms: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Community Detector
# ═══════════════════════════════════════════════════════════════════════════════


class CommunityDetector:
    """
    Detects and summarizes communities in the knowledge graph.

    Requires:
    - neo4j_driver: Neo4j async driver for graph queries
    - gemini_client: For generating community summaries
    """

    def __init__(
        self,
        neo4j_driver: Any = None,
        gemini_client: Any = None,
        min_community_size: int = 3,
    ) -> None:
        self._driver = neo4j_driver
        self._gemini = gemini_client
        self._min_size = min_community_size

    async def detect_and_summarize(
        self,
        org_id: str = "default",
    ) -> CommunityReport:
        """
        Run the full community detection and summarization pipeline.

        1. Project the graph into GDS
        2. Run Louvain community detection
        3. Extract community memberships
        4. Generate summaries for each community
        5. Store community nodes in the graph
        """
        import time

        start = time.perf_counter()
        report = CommunityReport(org_id=org_id)

        if not self._driver:
            logger.warning("No Neo4j driver — community detection skipped")
            return report

        # Step 1: Run Louvain
        raw_communities = await self._run_louvain(org_id)
        if not raw_communities:
            logger.info("No communities detected")
            return report

        # Step 2: Filter by minimum size
        communities = [
            c for c in raw_communities
            if c.member_count >= self._min_size
        ]
        report.total_communities = len(communities)

        # Step 3: Generate summaries
        for community in communities:
            chunks = await self._get_community_chunks(
                community.community_id, org_id,
            )
            community.representative_chunks = [
                c.get("chunk_id", "") for c in chunks[:5]
            ]

            summary = await self._summarize_community(
                community.entity_names,
                [c.get("content", "") for c in chunks[:10]],
            )
            if summary:
                community.summary = summary
                report.summaries_generated += 1

            # Store the community node
            await self._store_community_node(community, org_id)

        report.communities = communities
        report.duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "Community detection complete",
            extra={
                "communities": len(communities),
                "summaries": report.summaries_generated,
                "duration_ms": round(report.duration_ms, 1),
            },
        )

        return report

    async def _run_louvain(
        self, org_id: str,
    ) -> list[Community]:
        """
        Run Louvain community detection on the knowledge graph.

        Uses Neo4j GDS (Graph Data Science) plugin for the algorithm.
        Falls back to connected components if GDS is not available.
        """
        try:
            async with self._driver.session() as session:
                # Try GDS Louvain first
                try:
                    result = await session.run(
                        """
                        CALL gds.louvain.stream({
                            nodeProjection: 'Entity',
                            relationshipProjection: {
                                RELATED_TO: {
                                    type: 'RELATED_TO',
                                    orientation: 'UNDIRECTED'
                                }
                            }
                        })
                        YIELD nodeId, communityId
                        WITH communityId, collect(gds.util.asNode(nodeId).name) AS members
                        WHERE size(members) >= $min_size
                        RETURN communityId, members, size(members) AS memberCount
                        ORDER BY memberCount DESC
                        """,
                        min_size=self._min_size,
                    )
                    records = await result.data()
                except Exception:
                    # Fallback: use connected components via standard Cypher
                    result = await session.run(
                        """
                        MATCH (e:Entity)-[:RELATED_TO*1..3]-(other:Entity)
                        WITH e, collect(DISTINCT other.name) AS neighbors
                        WHERE size(neighbors) >= $min_size
                        RETURN id(e) AS communityId,
                               [e.name] + neighbors AS members,
                               size(neighbors) + 1 AS memberCount
                        ORDER BY memberCount DESC
                        LIMIT 50
                        """,
                        min_size=self._min_size,
                    )
                    records = await result.data()

                communities = []
                for record in records:
                    communities.append(Community(
                        community_id=record["communityId"],
                        member_count=record["memberCount"],
                        entity_names=record["members"][:20],
                    ))
                return communities

        except Exception as exc:
            logger.error(
                "Louvain community detection failed",
                extra={"error": str(exc)},
            )
            return []

    async def _get_community_chunks(
        self,
        community_id: int,
        org_id: str,
    ) -> list[dict[str, Any]]:
        """Get representative chunks for a community's entities."""
        try:
            async with self._driver.session() as session:
                result = await session.run(
                    """
                    MATCH (e:Entity)-[:MENTIONED_IN]->(c:Chunk)
                    WHERE id(e) = $community_id
                    RETURN c.chunk_id AS chunk_id,
                           c.content AS content
                    LIMIT 10
                    """,
                    community_id=community_id,
                )
                return await result.data()
        except Exception:
            return []

    async def _summarize_community(
        self,
        entity_names: list[str],
        chunk_contents: list[str],
    ) -> str:
        """Generate a summary description for a community."""
        if not self._gemini:
            return f"Community of: {', '.join(entity_names[:10])}"

        entities_str = ", ".join(entity_names[:15])
        context = "\n\n".join(chunk_contents[:5])

        prompt = (
            f"Summarize this knowledge community in 2-3 sentences. "
            f"The community contains these entities: {entities_str}\n\n"
            f"Representative content:\n{context}\n\n"
            f"Summary:"
        )

        try:
            response = await self._gemini.generate(prompt)
            return response.strip() if response else ""
        except Exception as exc:
            logger.warning(
                "Community summarization failed",
                extra={"error": str(exc)},
            )
            return ""

    async def _store_community_node(
        self,
        community: Community,
        org_id: str,
    ) -> None:
        """Store the community summary as a node in the graph."""
        if not self._driver or not community.summary:
            return

        try:
            async with self._driver.session() as session:
                await session.run(
                    """
                    MERGE (c:Community {communityId: $id, orgId: $org_id})
                    SET c.summary = $summary,
                        c.memberCount = $count,
                        c.entityNames = $entities,
                        c.updatedAt = datetime()
                    """,
                    id=community.community_id,
                    org_id=org_id,
                    summary=community.summary,
                    count=community.member_count,
                    entities=community.entity_names[:20],
                )
        except Exception as exc:
            logger.warning(
                "Failed to store community node",
                extra={
                    "community_id": community.community_id,
                    "error": str(exc),
                },
            )
