import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import type {
  DocumentContentExport,
  GeneratedAnswer,
  PreIngestAnalysis,
  QualityReport,
  ReviewRecord,
  SearchResponse,
} from "../shared/knowledge-types";

const mocks = vi.hoisted(() => ({
  serviceJsonTyped: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./service-client", () => ({
  serviceJson: vi.fn().mockResolvedValue({}),
  serviceJsonTyped: mocks.serviceJsonTyped,
  serviceMultipartUpload: vi.fn().mockResolvedValue({}),
  serviceCall: vi.fn(),
  buildSnakeBody: (input: unknown) => input,
  KNOWLEDGE_PIPELINE_URL: "http://pipeline.test",
  VECTOR_STORE_URL: "http://vector.test",
  ANALYTICS_URL: "http://analytics.test",
  ORCHESTRATOR_URL: "http://orchestrator.test",
  LLM_GATEWAY_BASE_URL: "http://gateway.test",
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("ioredis", () => {
  const Redis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
    duplicate: vi.fn().mockReturnThis(),
  }));
  return { default: Redis };
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "review-submit-user",
    name: "Manager Jane",
    email: "manager.jane@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "manager",
    department: null,
    orgId: "default",
    valueStreams: "pharmacy",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: User = makeUser()): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { host: "localhost" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function makeQualityReport(): QualityReport {
  return {
    overallScore: 91,
    completeness: { score: 0.92, details: "Complete operational guidance." },
    specificity: { score: 0.88, details: "Includes step-level detail." },
    accuracySignals: {
      score: 0.85,
      details: "Uses precise operational language.",
    },
    actionability: { score: 0.9, details: "Clear actions and owners." },
    readability: {
      fleschKincaidGrade: 9.2,
      fleschReadingEase: 57,
      gradeLabel: "Standard",
      wordCount: 320,
      sentenceCount: 18,
    },
    piiScan: {
      piiDetected: false,
      categoriesFound: [],
      matchCount: 0,
      summary: "No sensitive PII found.",
    },
    autoApproveEligible: false,
  };
}

function makeAnalysis(): PreIngestAnalysis {
  return {
    validate: {
      qualityScore: 88,
      completeness: 22,
      specificity: 21,
      accuracySignals: 22,
      actionability: 23,
      wordCount: 320,
      sentenceCount: 18,
      readabilityGrade: "Standard",
      readingEase: 57,
      piiDetected: false,
      piiCategories: [],
      contactInfoDetected: false,
      contactInfoCategories: [],
      issues: [],
      passed: true,
      piiJudges: [],
    },
    interpret: {
      detectedType: "Policy",
      department: "Pharmacy",
      tags: ["dosing", "safety"],
      entities: ["metformin"],
      summary: "Dose guidance for pharmacy operations.",
      language: "English",
      confidence: 0.84,
      passed: true,
    },
    decide: {
      recommendation: "review",
      relevanceScore: 0.91,
      reasoning:
        "Similar guidance exists and one dosage claim may conflict with an active SOP.",
      valueStreamMatch: true,
      passed: true,
      duplicates: [
        {
          documentId: "doc-existing",
          title: "Metformin Dosing SOP",
          similarity: 0.94,
          chunkPreview: "Maximum metformin dose is 2550mg per day for adults.",
          matchType: "similar",
        },
      ],
      contradictions: [
        {
          documentId: "doc-existing",
          title: "Metformin Dosing SOP",
          candidateClaim:
            "Maximum metformin dose is 2000mg per day for adults.",
          conflictingClaim:
            "Maximum metformin dose is 2550mg per day for adults.",
          chunkPreview: "Existing SOP says 2550mg per day for adults.",
          confidence: 0.89,
          rationale: "Conflicting numeric dosage guidance detected.",
        },
      ],
    },
    overallPass: true,
    overallConfidence: 0.87,
  };
}

function makeContent(): DocumentContentExport {
  return {
    documentId: "doc-1",
    title: "Dosing Guidance",
    content: "Maximum metformin dose is 2000mg per day for adults.",
    contentLength: 55,
    wordCount: 10,
    metadata: {},
    status: "indexed",
    chunkCount: 2,
  };
}

function makeReviewRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  const now = new Date().toISOString();
  return {
    id: "review-1",
    orgId: "default",
    documentId: "doc-1",
    streamId: "pharmacy",
    title: "Dosing Guidance",
    department: "Pharmacy",
    tags: ["dosing", "safety"],
    sourceRef: "doc-1",
    status: "pending_review",
    submittedBy: "manager.jane@hki.com",
    submittedAt: now,
    reviewedBy: "",
    reviewedAt: null,
    assignedTo: "",
    assignedBy: "",
    assignedAt: null,
    lastRemindedAt: null,
    publishedAt: null,
    archivedAt: null,
    autoApproved: false,
    autoApproveRule: "",
    qualityReport: null,
    trustScore: null,
    comments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSearchResponse(
  results: SearchResponse["results"],
  overrides: Partial<SearchResponse> = {}
): SearchResponse {
  return {
    query: "metformin dosing guidance",
    mode: "hybrid",
    results,
    totalResults: results.length,
    citations: [],
    searchTimeMs: 18,
    ...overrides,
  };
}

function makeSearchResult(
  documentId: string,
  title: string,
  content: string,
  score: number
): SearchResponse["results"][number] {
  return {
    chunkId: `${documentId}-chunk-1`,
    documentId,
    content,
    score,
    scoreScale: "normalized",
    vectorScore: score,
    vectorScoreScale: "normalized",
    keywordScore: 0.25,
    keywordScoreScale: "normalized",
    citation: {
      documentId,
      documentTitle: title,
      chunkId: `${documentId}-chunk-1`,
      contentPreview: content,
      relevanceScore: score,
      relevanceScoreScale: "normalized",
      sourceUrl: "",
      pageOrSection: "",
      highlight: content,
    },
    metadata: { title },
  };
}

function makeGeneratedAnswer(answer: string): GeneratedAnswer {
  return {
    answer,
    confidence: 0.84,
    citations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue(null);
});

describe("knowledge.reviewSubmit", () => {
  it("enriches review submissions with quality and review-intelligence signals", async () => {
    const content = makeContent();
    const qualityReport = makeQualityReport();
    const analysis = makeAnalysis();
    const reviewRecord = makeReviewRecord();
    const submitBodies: unknown[] = [];

    mocks.serviceJsonTyped.mockImplementation(
      (url: string, _ctx: unknown, options?: { body?: unknown }) => {
        if (url === "http://vector.test/v1/documents/doc-1/content") {
          return Promise.resolve(content);
        }
        if (url === "http://pipeline.test/v1/quality/score") {
          return Promise.resolve(qualityReport);
        }
        if (url === "http://pipeline.test/v1/pre-ingest/analyze") {
          return Promise.resolve(analysis);
        }
        if (url === "http://pipeline.test/v1/review/submit") {
          submitBodies.push(options?.body);
          return Promise.resolve(reviewRecord);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }
    );

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.reviewSubmit({
      documentId: "doc-1",
      streamId: "pharmacy",
      title: "Dosing Guidance",
      department: "Pharmacy",
      tags: ["dosing", "safety"],
      sourceRef: "doc-1",
    });

    expect(result).toEqual(reviewRecord);
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/documents/doc-1/content",
      expect.any(Object)
    );
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/quality/score",
      expect.any(Object),
      expect.objectContaining({ method: "POST" })
    );
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/pre-ingest/analyze",
      expect.any(Object),
      expect.objectContaining({ method: "POST" })
    );

    expect(submitBodies).toHaveLength(1);
    expect(submitBodies[0]).toEqual(
      expect.objectContaining({
        documentId: "doc-1",
        streamId: "pharmacy",
        title: "Dosing Guidance",
        qualityReport,
        trustScore: 91,
        reviewIntelligence: expect.objectContaining({
          duplicates: analysis.decide.duplicates,
          contradictions: analysis.decide.contradictions,
          recommendation: "review",
          reasoning: analysis.decide.reasoning,
        }),
      })
    );
    expect(
      String(
        (submitBodies[0] as { reviewIntelligence?: { summary?: string } })
          .reviewIntelligence?.summary
      )
    ).toContain("duplicate match");
  });
});

describe("knowledge.compareShadowRetrieval", () => {
  it("returns baseline and shadow snapshots and flags pending-only matches", async () => {
    const baselineSearch = makeSearchResponse([
      makeSearchResult(
        "doc-existing",
        "Metformin Dosing SOP",
        "Existing SOP says 2550mg per day for adults.",
        0.83
      ),
    ]);
    const shadowSearch = makeSearchResponse([
      makeSearchResult(
        "doc-1",
        "Dosing Guidance",
        "Candidate draft says 2000mg per day for adults.",
        0.91
      ),
      makeSearchResult(
        "doc-existing",
        "Metformin Dosing SOP",
        "Existing SOP says 2550mg per day for adults.",
        0.83
      ),
    ]);

    mocks.serviceJsonTyped.mockImplementation((url: string, _ctx: unknown) => {
      if (url === "http://vector.test/v1/search") {
        const nextResponse = mocks.serviceJsonTyped.mock.calls.filter(
          ([calledUrl]) => calledUrl === "http://vector.test/v1/search"
        ).length;
        return Promise.resolve(
          nextResponse === 1 ? baselineSearch : shadowSearch
        );
      }
      if (url === "http://pipeline.test/v1/generate/answer") {
        const nextResponse = mocks.serviceJsonTyped.mock.calls.filter(
          ([calledUrl]) =>
            calledUrl === "http://pipeline.test/v1/generate/answer"
        ).length;
        return Promise.resolve(
          nextResponse === 1
            ? makeGeneratedAnswer(
                "Current retrieval does not include the pending draft."
              )
            : makeGeneratedAnswer(
                "Shadow retrieval now includes the pending draft guidance."
              )
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.compareShadowRetrieval({
      query: "What is the maximum adult metformin dose?",
      valueStreamId: "pharmacy",
      selectedDocumentId: "doc-1",
      limit: 5,
      mode: "hybrid",
    });

    expect(result.baseline.includesSelectedDocument).toBe(false);
    expect(result.shadow.includesSelectedDocument).toBe(true);
    expect(result.shadow.search.results[0]?.documentId).toBe("doc-1");
    expect(result.summary).toContain("only appears in the shadow comparison");
    expect(result.baseline.answer?.answer).toContain("does not include");
    expect(result.shadow.answer?.answer).toContain(
      "includes the pending draft"
    );
  });
});
