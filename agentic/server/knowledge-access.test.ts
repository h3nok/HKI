import { describe, expect, it } from "vitest";

import {
  canManageKnowledgeWorkspace,
  canWriteKnowledgeWorkspace,
  getAllowedKnowledgeTabs,
} from "../client/src/_core/access/knowledge";

describe("knowledge access helpers", () => {
  it("lets KB operators ingest content without granting governance controls", () => {
    expect(canWriteKnowledgeWorkspace("operator")).toBe(true);
    expect(canManageKnowledgeWorkspace("operator")).toBe(false);
    expect(getAllowedKnowledgeTabs("operator")).toEqual([
      "overview",
      "ingest",
      "library",
      "validate",
      "activity",
    ]);
  });

  it("keeps KB admins on the managed knowledge tab set", () => {
    expect(getAllowedKnowledgeTabs("manager")).toEqual([
      "overview",
      "ingest",
      "library",
      "validate",
      "govern",
      "pipelines",
      "activity",
    ]);
  });
});
