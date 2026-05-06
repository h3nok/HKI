import type { TaskMessage, TaskMessageAttributes } from "../types";
import type { Evidence } from "../ui/evidence-chip";

type MessageCitation = NonNullable<TaskMessageAttributes["citations"]>[number];

/* ------------------------------------------------------------------ */
/*  Field readers — defensively extract typed values from citations     */
/* ------------------------------------------------------------------ */

function readString(
  citation: MessageCitation,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = (citation as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(
  citation: MessageCitation,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = (citation as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  citationToEvidence — map a raw citation to the Evidence model      */
/* ------------------------------------------------------------------ */

function citationToEvidence(
  citation: MessageCitation,
  index: number
): Evidence {
  const title =
    readString(citation, "title", "document_title", "documentTitle") ||
    readString(citation, "source", "source_url", "sourceUrl") ||
    `Source ${index + 1}`;
  const snippet =
    readString(
      citation,
      "highlight",
      "preview",
      "content_preview",
      "contentPreview",
      "chunk_text",
      "chunkText"
    ) || "Preview unavailable for this citation.";
  const documentId = readString(citation, "document_id", "documentId");
  const chunkId = readString(citation, "chunk_id", "chunkId", "id");
  const section = readString(
    citation,
    "page_or_section",
    "pageOrSection",
    "section"
  );
  const source = readString(citation, "source", "source_url", "sourceUrl");
  const score = readNumber(
    citation,
    "score",
    "relevance_score",
    "relevanceScore"
  );

  return {
    id: chunkId || documentId || `citation-${index + 1}`,
    type: "knowledge_base",
    title,
    snippet,
    url: source,
    confidence: score != null ? Math.round(score * 100) : 0,
    metadata: {
      section,
      documentId,
      chunkId,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  extractEvidenceFromMessage — main public API                       */
/*                                                                     */
/*  - Deduplicates by chunkId or documentId+title to prevent           */
/*    the same passage appearing multiple times                        */
/*  - Sorts by descending confidence so the best evidence is first     */
/* ------------------------------------------------------------------ */

export function extractEvidenceFromMessage(message: TaskMessage): Evidence[] {
  const citations = message.attributes?.citations;
  if (!citations || !Array.isArray(citations) || citations.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: Evidence[] = [];

  for (let i = 0; i < citations.length; i++) {
    const ev = citationToEvidence(citations[i], i);

    // Deduplicate by chunk id, then by document+title fingerprint
    const dedupeKey =
      ev.metadata?.chunkId || `${ev.metadata?.documentId ?? ""}::${ev.title}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push(ev);
  }

  // Sort by confidence descending — strongest evidence first
  result.sort((a, b) => b.confidence - a.confidence);

  return result;
}
