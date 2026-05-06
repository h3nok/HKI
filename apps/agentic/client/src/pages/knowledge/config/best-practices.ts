/**
 * Static KB best practices & guidelines — injected into every Gemini context.
 *
 * Defined as a standalone module so it's never re-created on render
 * and can be imported independently by any component that needs it.
 */

export const KB_BEST_PRACTICES = {
  contentIngestion: {
    title: "What to ingest",
    guidelines: [
      "Prefer authoritative, well-structured documents (SOPs, runbooks, policies, FAQs) over raw data dumps",
      "Each document should cover one topic or process — avoid mega-documents that cover everything",
      "Include metadata: department, document type, owner — this improves filtering and freshness tracking",
      "Ingest at least 50–100 documents before running Gap Analysis for meaningful results",
      "Re-ingest updated versions of documents rather than letting stale content accumulate",
    ],
  },
  chunking: {
    title: "Chunking & retrieval quality",
    guidelines: [
      "Smaller chunks (200–400 tokens) = higher precision, better for fact retrieval",
      "Larger chunks (500–800 tokens) = more context per result, better for summarization tasks",
      "The pipeline uses semantic chunking by default — respects paragraph and section boundaries",
      "Low chunk count relative to document count means documents are short or extraction failed",
      "Target: 5–20 chunks per document for typical business documents",
    ],
  },
  searchModes: {
    title: "When to use each search mode",
    hybrid:
      "Best default — combines vector similarity + BM25 keyword. Use for most queries.",
    vector:
      "Best for semantic/conceptual questions ('what is our policy on X'). Handles paraphrasing well.",
    keyword:
      "Best for exact term lookup (product codes, names, IDs). Fails on synonyms.",
    tips: [
      "If hybrid returns irrelevant results, try keyword — the query may be too specific",
      "If keyword returns nothing, try vector — the exact term may not appear in documents",
      "Confidence <50% almost always means the content isn't in the KB yet — ingest it",
    ],
  },
  coverageScore: {
    title: "Coverage score interpretation",
    bands: {
      "90–100 (Excellent)":
        "KB covers the domain well. Focus on freshness and edge cases.",
      "75–89 (Good)":
        "Solid foundation. Fill high-severity gaps and update stale content.",
      "50–74 (Moderate)":
        "Significant gaps. Prioritize high-severity gaps before agent goes live.",
      "0–49 (Low)":
        "KB is too sparse for reliable agent answers. Ingest core content first.",
    },
    improvementCycle: [
      "1. Run Gap Analysis → note high-severity gaps",
      "2. Go to Ingest → add documents covering those topics",
      "3. Wait for pipeline to complete (check Overview jobs)",
      "4. Re-run Gap Analysis → compare delta in Coverage History",
      "5. Repeat until score reaches target band",
    ],
  },
  entityGraph: {
    title: "Knowledge graph & entities",
    guidelines: [
      "Entities are extracted automatically during ingestion and mapped to your taxonomy",
      "Higher entity count = richer semantic understanding and better graph traversal",
      "The graph enables 'neighbor' retrieval — finding related content even without keyword overlap",
      "Build your taxonomy (Taxonomy tab) before ingesting large volumes for best entity mapping",
    ],
  },
  reviewQueue: {
    title: "Review queue best practices",
    guidelines: [
      "Enable review gate for sensitive domains (HR, Legal, Finance) to prevent bad content reaching agents",
      "Approve documents quickly — pending documents are NOT retrievable until approved",
      "Reject documents with PII, outdated info, or low readability scores",
      "Use the quality report (readability, PII scan, heuristic score) to triage efficiently",
    ],
  },
  agentReadiness: {
    title: "When is the KB agent-ready?",
    checklist: [
      "Coverage score ≥75 (Good band)",
      "No high-severity gaps remaining in latest Gap Analysis",
      "Retrieval confidence >70% on your most common query types (test on Validate tab)",
      "No documents older than 90 days on critical topics",
      "Review queue is empty (all documents approved)",
      "Entity count growing — knowledge graph is being populated",
    ],
  },
} as const;
