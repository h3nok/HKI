/**
 * Tests for StreamRouter — query-to-stream routing.
 *
 * Covers:
 *   - tokenize: basic tokenization, stop-word filtering, min-length filtering
 *   - scoreStream: empty query, matching terms, no match, partial match
 *   - routeToStream: single candidate, empty query, low confidence, correct routing
 *
 * DB and Redis are mocked so these tests run without any external services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  tokenize,
  scoreStream,
  routeToStream,
  ROUTING_CONFIDENCE_THRESHOLD,
} from "./stream-router";

// ── Module mocks ──────────────────────────────────────────────────────────────
// Mock ioredis so the module never attempts a real TCP connection.
vi.mock("ioredis", () => {
  const Redis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    on: vi.fn(),
  }));
  return { default: Redis };
});

// Mock the DB layer so we control what stream profiles are returned.
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

// ── Helpers ────────────────────────────────────────────────────────────────────

interface MockProfile {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
}

function makeMockDb(profiles: MockProfile[]) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(profiles),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
  };
}

// ── tokenize ──────────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric characters", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("filters out English stop words", () => {
    const result = tokenize("what is the policy");
    expect(result).not.toContain("what");
    expect(result).not.toContain("is");
    expect(result).not.toContain("the");
    expect(result).toContain("policy");
  });

  it("filters out tokens shorter than 2 characters", () => {
    // "a", "b", "c" are length 1 — filtered out
    // "db" is length 2 and not a stop word — kept
    // "run" is length 3 — kept
    const result = tokenize("a b c db run");
    expect(result).not.toContain("a");
    expect(result).not.toContain("b");
    expect(result).not.toContain("c");
    expect(result).toContain("db");
    expect(result).toContain("run");
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles string with only stop words", () => {
    expect(tokenize("what is the a an")).toEqual([]);
  });

  it("handles camelCase by splitting on non-alphanumeric only (no case splitting)", () => {
    // tokenize splits on non-alphanumeric chars, not case changes
    expect(tokenize("fifoPolicy")).toContain("fifopolicy");
  });

  it("returns domain terms from a realistic query", () => {
    const terms = tokenize("What are the controlled substance FIFO rotation policies?");
    expect(terms).toContain("controlled");
    expect(terms).toContain("substance");
    expect(terms).toContain("fifo");
    expect(terms).toContain("rotation");
    expect(terms).toContain("policies");
    // stop words must be absent
    expect(terms).not.toContain("what");
    expect(terms).not.toContain("are");
    expect(terms).not.toContain("the");
  });
});

// ── scoreStream ───────────────────────────────────────────────────────────────

describe("scoreStream", () => {
  const pharmacyProfile = {
    id: "pharmacy",
    name: "Pharmacy Operations",
    description: "Handles controlled substances, FIFO rotation, and drug inventory management.",
    systemPrompt: "You assist pharmacy staff with controlled substance compliance.",
  };

  it("returns 0 for empty query terms", () => {
    expect(scoreStream([], pharmacyProfile)).toBe(0);
  });

  it("returns 0 when no query terms match the profile", () => {
    const terms = tokenize("shipping logistics warehouse freight");
    expect(scoreStream(terms, pharmacyProfile)).toBe(0);
  });

  it("returns 1.0 when all query terms appear in the profile", () => {
    // "fifo" and "controlled" are both in the pharmacy profile
    const terms = ["fifo", "controlled"];
    const score = scoreStream(terms, pharmacyProfile);
    expect(score).toBe(1.0);
  });

  it("returns a fractional score for partial matches", () => {
    // "fifo" matches, "freight" does not — 1 out of 2 = 0.5
    const terms = ["fifo", "freight"];
    const score = scoreStream(terms, pharmacyProfile);
    expect(score).toBe(0.5);
  });

  it("is case-insensitive (profile text is tokenized)", () => {
    // "pharmacy" appears in the name "Pharmacy Operations"
    expect(scoreStream(["pharmacy"], pharmacyProfile)).toBe(1.0);
  });

  it("returns 0 for a profile with no text", () => {
    const emptyProfile = { id: "empty", name: "", description: null, systemPrompt: null };
    expect(scoreStream(["fifo"], emptyProfile)).toBe(0);
  });

  it("does not double-count duplicate query terms", () => {
    // "fifo" appears once in profile vocab, but twice in query — score is 2/2 = 1.0
    // because matching is per-query-term, and both "fifo" instances hit the set
    const terms = ["fifo", "fifo"];
    const score = scoreStream(terms, pharmacyProfile);
    expect(score).toBe(1.0);
  });
});

// ── routeToStream ─────────────────────────────────────────────────────────────

describe("routeToStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for a single candidate stream", async () => {
    const result = await routeToStream("any query", ["pharmacy"]);
    expect(result).toBeNull();
  });

  it("returns null for an empty candidate list", async () => {
    const result = await routeToStream("any query", []);
    expect(result).toBeNull();
  });

  it("returns null when the query tokenizes to nothing", async () => {
    // Only stop words — no signal
    const result = await routeToStream("what is the", ["pharmacy", "logistics"]);
    expect(result).toBeNull();
  });

  it("returns null when no profile scores above the confidence threshold", async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeMockDb([
        { id: "pharmacy", name: "Pharmacy", description: null, systemPrompt: null },
        { id: "logistics", name: "Logistics", description: null, systemPrompt: null },
      ]) as any,
    );

    // Generic query with no domain terms matching either sparse profile
    const result = await routeToStream("general question about things", ["pharmacy", "logistics"]);
    expect(result).toBeNull();
  });

  it("routes to the stream whose profile best matches the query", async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeMockDb([
        {
          id: "pharmacy",
          name: "Pharmacy Operations",
          description: "Controlled substances, FIFO rotation, drug dispensing compliance.",
          systemPrompt: null,
        },
        {
          id: "logistics",
          name: "Logistics and Freight",
          description: "Warehouse shipping, freight tracking, inventory management.",
          systemPrompt: null,
        },
      ]) as any,
    );

    const result = await routeToStream(
      "What are the FIFO rotation requirements for controlled substances?",
      ["pharmacy", "logistics"],
    );

    expect(result).not.toBeNull();
    expect(result!.streamId).toBe("pharmacy");
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it("returns scoredStreams with all candidates ranked by score", async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeMockDb([
        {
          id: "pharmacy",
          name: "Pharmacy Operations",
          description: "Controlled substance FIFO rotation and compliance.",
          systemPrompt: null,
        },
        {
          id: "logistics",
          name: "Logistics Freight",
          description: "Shipping and warehouse freight operations.",
          systemPrompt: null,
        },
      ]) as any,
    );

    const result = await routeToStream(
      "controlled substance FIFO rotation pharmacy compliance",
      ["pharmacy", "logistics"],
    );

    expect(result).not.toBeNull();
    expect(result!.scoredStreams).toHaveLength(2);
    // First scored stream must be the winner
    expect(result!.scoredStreams[0].streamId).toBe(result!.streamId);
    // Scores must be descending
    expect(result!.scoredStreams[0].score).toBeGreaterThanOrEqual(
      result!.scoredStreams[1].score,
    );
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as any);

    const result = await routeToStream(
      "controlled substance fifo rotation",
      ["pharmacy", "logistics"],
    );
    expect(result).toBeNull();
  });

  it("returns null when DB throws", async () => {
    vi.mocked(getDb).mockRejectedValue(new Error("DB connection failed"));

    const result = await routeToStream(
      "controlled substance fifo rotation",
      ["pharmacy", "logistics"],
    );
    expect(result).toBeNull();
  });

  it("confidence is normalised: best_score / sum_of_scores", async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeMockDb([
        {
          id: "pharmacy",
          name: "Pharmacy Operations",
          description: "Controlled substance FIFO rotation compliance drug dispensing.",
          systemPrompt: null,
        },
        {
          id: "logistics",
          name: "Logistics",
          description: "Freight shipping warehouse.",
          systemPrompt: null,
        },
      ]) as any,
    );

    const result = await routeToStream(
      "pharmacy controlled substance fifo rotation",
      ["pharmacy", "logistics"],
    );

    expect(result).not.toBeNull();
    const { scoredStreams, confidence } = result!;
    const totalScore = scoredStreams.reduce((s, r) => s + r.score, 0);
    const expectedConfidence = scoredStreams[0].score / totalScore;
    expect(confidence).toBeCloseTo(expectedConfidence, 3);
  });
});
