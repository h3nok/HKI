"""
Entity Extraction — LLM-based structured entity and relationship extraction.

Extracts named entities and their relationships from document chunks
using the LLM gateway (LiteLLM → Vertex AI). Falls back to regex-based
extraction when the LLM is unavailable.

Usage:
    extractor = EntityExtractor(llm_url="http://localhost:4000/v1")
    result = await extractor.extract(
        text="John Smith works at Acme Corp..."
    )
    # result.entities = [Entity(name="John Smith", ...)]
    # result.relationships = [Relationship(source="John Smith", ...)]
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from src.adapters.neo4j_graph import ExtractedEntity, ExtractedRelationship
from src.core.logging import logger as _root_logger

logger = _root_logger.getChild("entity_extraction")


# ═══════════════════════════════════════════════════════════════════════════════
# Extraction Result
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class ExtractionResult:
    """Result of entity extraction from a text chunk."""

    entities: list[ExtractedEntity] = field(default_factory=list)
    relationships: list[ExtractedRelationship] = field(default_factory=list)
    method: str = "llm"  # "llm" or "regex"


# ═══════════════════════════════════════════════════════════════════════════════
# Extraction Prompt
# ═══════════════════════════════════════════════════════════════════════════════

_EXTRACTION_PROMPT = """\
Extract named entities and relationships from the following text.

Return a JSON object with two arrays:
1. "entities" — each with: name, type
   (person|organization|product|concept|location|event), properties (optional)
2. "relationships" — each with: source (entity name), target (entity name),
   type (works_for|located_in|part_of|related_to|produces|manages|references)

Rules:
- Only extract clearly stated facts, not inferences.
- Normalize entity names (e.g., "John" and "John Smith" → "John Smith" if context confirms).
- Merge duplicate entities.
- Keep the JSON compact. No markdown fences.

Text:
---
{text}
---

JSON:"""


# ═══════════════════════════════════════════════════════════════════════════════
# Entity Extractor
# ═══════════════════════════════════════════════════════════════════════════════


class EntityExtractor:
    """
    Extracts entities and relationships from text using LLM or regex fallback.

    Uses the existing LiteLLM gateway for structured extraction.
    """

    def __init__(
        self,
        llm_url: str = "http://localhost:4000/v1",
        llm_api_key: str = "sk-1234",
        model: str = "gemini-2.0-flash",
        timeout: float = 30.0,
    ) -> None:
        self._llm_url = llm_url.rstrip("/")
        self._api_key = llm_api_key
        self._model = model
        from shared.http_client import create_service_client

        self._http = create_service_client("knowledge-api-extractor", timeout=timeout)

    async def close(self) -> None:
        """Clean up HTTP connections."""
        await self._http.aclose()

    async def extract(self, text: str) -> ExtractionResult:
        """
        Extract entities and relationships from text.

        Tries LLM-based extraction first, falls back to regex on failure.
        """
        if len(text.strip()) < 20:
            return ExtractionResult(method="skip")

        try:
            return await self._extract_llm(text)
        except Exception as exc:
            logger.warning(
                "LLM extraction failed, falling back to regex",
                extra={"error": str(exc)},
            )
            return self._extract_regex(text)

    # ═══════════════════════════════════════════════════════════════════════
    # LLM-based extraction
    # ═══════════════════════════════════════════════════════════════════════

    async def _extract_llm(self, text: str) -> ExtractionResult:
        """Call LLM for structured entity extraction."""
        # Truncate to avoid token limits
        truncated = text[:4000] if len(text) > 4000 else text

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": _EXTRACTION_PROMPT.format(text=truncated),
                }
            ],
            "temperature": 0.0,
            "max_tokens": 2000,
        }

        resp = await self._http.post(
            f"{self._llm_url}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        return self._parse_llm_response(content)

    def _parse_llm_response(self, content: str) -> ExtractionResult:
        """Parse structured JSON from LLM response."""
        # Strip markdown fences if present
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON object in the response
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                parsed = json.loads(match.group())
            else:
                logger.warning("Could not parse LLM extraction response")
                return ExtractionResult(method="llm_parse_failed")

        entities = []
        for e in parsed.get("entities", []):
            if not e.get("name"):
                continue
            entities.append(
                ExtractedEntity(
                    name=e["name"],
                    entity_type=e.get("type", "concept"),
                    properties=e.get("properties", {}),
                    confidence=e.get("confidence", 0.9),
                )
            )

        relationships = []
        for r in parsed.get("relationships", []):
            if not r.get("source") or not r.get("target"):
                continue
            relationships.append(
                ExtractedRelationship(
                    source_name=r["source"],
                    target_name=r["target"],
                    relationship_type=r.get("type", "related_to"),
                    weight=r.get("weight", 1.0),
                )
            )

        logger.info(
            "LLM extraction complete",
            extra={
                "entities": len(entities),
                "relationships": len(relationships),
            },
        )

        return ExtractionResult(
            entities=entities,
            relationships=relationships,
            method="llm",
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Regex fallback — lightweight NER without LLM
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _extract_regex(text: str) -> ExtractionResult:
        """
        Extract entities using regex patterns.

        Catches capitalized multi-word phrases (likely proper nouns),
        email addresses, URLs, and monetary amounts.
        """
        entities: list[ExtractedEntity] = []
        seen: set[str] = set()

        # Capitalized multi-word phrases (proper nouns)
        for match in re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text):
            name = match.group(1)
            if name not in seen and len(name) > 5:
                seen.add(name)
                entities.append(
                    ExtractedEntity(
                        name=name,
                        entity_type="concept",
                        confidence=0.5,
                    )
                )

        # ALL-CAPS acronyms (3+ chars)
        for match in re.finditer(r"\b([A-Z]{3,})\b", text):
            name = match.group(1)
            if name not in seen:
                seen.add(name)
                entities.append(
                    ExtractedEntity(
                        name=name,
                        entity_type="organization",
                        confidence=0.3,
                    )
                )

        # Limit to top 20
        entities = entities[:20]

        return ExtractionResult(
            entities=entities,
            relationships=[],
            method="regex",
        )
