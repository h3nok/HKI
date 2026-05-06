import { describe, expect, it } from "vitest";

import { normalizeConfidenceScore } from "../client/src/components/chat-ui/task-messages/task-message-metadata";

describe("normalizeConfidenceScore", () => {
  it("converts orchestrator 0..1 scores to percentages", () => {
    expect(normalizeConfidenceScore(0.67)).toBe(67);
    expect(normalizeConfidenceScore(0.94)).toBe(94);
  });

  it("passes through percentage scores unchanged", () => {
    expect(normalizeConfidenceScore(67)).toBe(67);
    expect(normalizeConfidenceScore(100)).toBe(100);
  });

  it("ignores empty or invalid scores", () => {
    expect(normalizeConfidenceScore(null)).toBeNull();
    expect(normalizeConfidenceScore(undefined)).toBeNull();
    expect(normalizeConfidenceScore(0)).toBeNull();
    expect(normalizeConfidenceScore("not-a-number")).toBeNull();
  });

  it("clamps out-of-range values", () => {
    expect(normalizeConfidenceScore(120)).toBe(100);
    expect(normalizeConfidenceScore(0.004)).toBe(1);
  });
});