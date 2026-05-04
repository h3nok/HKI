import { describe, expect, it } from "vitest";

import {
  buildReviewStatusByDocumentId,
  getEffectiveDocumentStatus,
} from "@/pages/knowledge/components/document-review-status";

describe("document-review-status", () => {
  it("promotes pending_review documents with approved review records", () => {
    expect(getEffectiveDocumentStatus("pending_review", "approved")).toBe(
      "approved"
    );
  });

  it("keeps truly pending documents in the pending_review bucket", () => {
    expect(
      getEffectiveDocumentStatus("pending_review", "pending_review")
    ).toBe("pending_review");
  });

  it("builds a document-id status lookup from review history", () => {
    const statuses = buildReviewStatusByDocumentId([
      { documentId: "doc-1", status: "approved" },
      { documentId: "doc-2", status: "pending_review" },
      { documentId: null, status: "published" },
    ]);

    expect(statuses.get("doc-1")).toBe("approved");
    expect(statuses.get("doc-2")).toBe("pending_review");
    expect(statuses.size).toBe(2);
  });
});