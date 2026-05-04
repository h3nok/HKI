import type { DocumentStatus } from "@shared/knowledge-types";

export type KnowledgeDocumentDisplayStatus = DocumentStatus | "approved";

function normalizeStatus(status: string | null | undefined): string {
  return (status || "").trim().toLowerCase();
}

export function getEffectiveDocumentStatus(
  documentStatus: string | null | undefined,
  reviewStatus?: string | null
): KnowledgeDocumentDisplayStatus {
  const normalizedDocumentStatus = normalizeStatus(documentStatus) || "pending";
  const normalizedReviewStatus = normalizeStatus(reviewStatus);

  if (
    normalizedDocumentStatus === "pending_review" &&
    normalizedReviewStatus === "approved"
  ) {
    return "approved";
  }

  switch (normalizedDocumentStatus) {
    case "pending":
    case "processing":
    case "pending_review":
    case "indexed":
    case "published":
    case "failed":
    case "archived":
      return normalizedDocumentStatus;
    default:
      return "pending";
  }
}

export function buildReviewStatusByDocumentId(
  records: Array<{ documentId?: string | null; status?: string | null }>
): Map<string, string> {
  const statuses = new Map<string, string>();

  for (const record of records) {
    const documentId = record.documentId?.trim();
    const status = normalizeStatus(record.status);

    if (!documentId || !status) {
      continue;
    }

    statuses.set(documentId, status);
  }

  return statuses;
}