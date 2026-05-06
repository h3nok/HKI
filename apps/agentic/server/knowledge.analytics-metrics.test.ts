import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  serviceJsonTyped: vi.fn(),
}));

vi.mock("./service-client", () => ({
  serviceJson: vi.fn().mockResolvedValue({}),
  serviceJsonTyped: mocks.serviceJsonTyped,
  serviceMultipartUpload: vi.fn(),
  serviceCall: vi.fn(),
  buildSnakeBody: (input: unknown) => input,
  KNOWLEDGE_PIPELINE_URL: "http://pipeline.test",
  VECTOR_STORE_URL: "http://vector.test",
  ANALYTICS_URL: "http://analytics.test",
  ORCHESTRATOR_URL: "http://orchestrator.test",
  LLM_GATEWAY_BASE_URL: "http://llm.test",
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
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
    id: 7,
    openId: "knowledge-analytics-user",
    name: "Scoped Manager",
    email: "manager@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "manager",
    department: null,
    orgId: "default",
    valueStreams: "pharmacy,optical",
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

describe("knowledge analytics metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps camelCase analytics responses and scopes stream requests", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      totalEvents: 9,
      uniqueUsers: 3,
      eventsByType: { "kb.search": 4 },
      eventsByService: { "knowledge-api": 4 },
      periodStart: "2026-04-16T00:00:00Z",
      periodEnd: "2026-04-16T01:00:00Z",
      knowledge: {
        cmos: 180.5,
        avgChunksPerSearch: 4.5,
        avgTopScore: 0.82,
        totalIngestJobs: 2,
        ingestSuccessRate: 1,
        avgIngestDurationMs: 320,
        p95IngestDurationMs: 640,
        totalChunksIndexed: 44,
        ragasSampleCount: 4,
        ragasCoverageRate: 1,
        avgFaithfulness: 0.79,
        avgAnswerRelevancy: 0.81,
        avgContextPrecision: 0.75,
        avgContextRecall: 0.77,
        avgAnswerCorrectness: 0.8,
      },
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.analyticsMetrics({
      valueStreamId: "pharmacy",
    });

    expect(result).toMatchObject({
      cmos: 180.5,
      avgChunksPerSearch: 4.5,
      avgTopScore: 0.82,
      totalIngestJobs: 2,
      ingestSuccessRate: 1,
      avgIngestDurationMs: 320,
      p95IngestDurationMs: 640,
      totalChunksIndexed: 44,
      ragasSampleCount: 4,
      ragasCoverageRate: 1,
      avgFaithfulness: 0.79,
      avgAnswerRelevancy: 0.81,
      avgContextPrecision: 0.75,
      avgContextRecall: 0.77,
      avgAnswerCorrectness: 0.8,
      totalEvents: 9,
      uniqueUsers: 3,
      eventsByType: { "kb.search": 4 },
      eventsByService: { "knowledge-api": 4 },
      periodStart: "2026-04-16T00:00:00Z",
      periodEnd: "2026-04-16T01:00:00Z",
    });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://analytics.test/v1/events/summary",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
  });
});
