import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  serviceJsonTyped: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
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
  LLM_GATEWAY_BASE_URL: "http://llm.test",
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
    openId: "knowledge-operator-user",
    name: "Scoped Operator",
    email: "operator@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "operator",
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

function createStreamMetaDb(departments: Array<string | null>) {
  return {
    select: vi.fn((fields?: Record<string, unknown>) => {
      const selectsDepartments = Boolean(fields?.department);

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => {
            if (selectsDepartments) {
              return Promise.resolve(
                departments.map(department => ({ department }))
              );
            }

            return {
              limit: vi.fn(() =>
                Promise.resolve([
                  {
                    knowledgeConfig: null,
                    name: "QA Stream",
                    description: null,
                    sampleQuestions: null,
                  },
                ])
              ),
            };
          }),
        })),
      };
    }),
  };
}

describe("knowledge validate sandbox access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("allows operators to run stream-scoped retrieval tests", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      query: "refill steps",
      mode: "hybrid",
      results: [],
      totalResults: 0,
      citations: [],
      searchTimeMs: 0,
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await caller.knowledge.search({
      query: "refill steps",
      valueStreamId: "pharmacy",
    });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/search",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
    const request = mocks.serviceJsonTyped.mock.calls[0]?.[2];
    expect(JSON.parse(String(request.body))).toMatchObject({
      query: "refill steps",
      mode: "hybrid",
      top_k: 5,
    });
  });

  it("does not send placeholder collection departments as retrieval filters", async () => {
    mocks.getDb.mockResolvedValue(createStreamMetaDb(["General"]));
    mocks.serviceJsonTyped.mockResolvedValue({
      query: "What is the emergency override code?",
      mode: "hybrid",
      results: [],
      totalResults: 0,
      citations: [],
      searchTimeMs: 0,
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await caller.knowledge.search({
      query: "What is the emergency override code?",
      valueStreamId: "pharmacy",
    });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/search",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
    const request = mocks.serviceJsonTyped.mock.calls[0]?.[2];
    const payload = JSON.parse(String(request.body));
    expect(payload).toMatchObject({
      query: "What is the emergency override code?",
      mode: "hybrid",
      top_k: 5,
    });
    expect(payload).not.toHaveProperty("departments");
  });

  it("allows operators to generate grounded answers and inline evaluations", async () => {
    mocks.serviceJsonTyped
      .mockResolvedValueOnce({
        answer: "Members can request refills online or at the pharmacy desk.",
        confidence: 0.93,
        citations: [],
      })
      .mockResolvedValueOnce({
        overall: 0.88,
        metrics: {},
        summary: "Grounded answer looks solid.",
      });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.generateAnswer({
        valueStreamId: "pharmacy",
        query: "How do members request refills?",
        chunks: [
          {
            content:
              "Members can request refills online or at the pharmacy desk.",
            score: 0.97,
            metadata: { title: "Refill workflow" },
          },
        ],
      })
    ).resolves.toMatchObject({ confidence: 0.93 });

    await expect(
      caller.knowledge.evaluateSingle({
        valueStreamId: "pharmacy",
        query: "How do members request refills?",
        retrievedContexts: [
          "Members can request refills online or at the pharmacy desk.",
        ],
        generatedAnswer:
          "Members can request refills online or at the pharmacy desk.",
      })
    ).resolves.toMatchObject({ overall: 0.88 });

    expect(mocks.serviceJsonTyped).toHaveBeenNthCalledWith(
      1,
      "http://pipeline.test/v1/generate/answer",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
    expect(mocks.serviceJsonTyped).toHaveBeenNthCalledWith(
      2,
      "http://vector.test/v1/evaluate/single",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("allows operators to generate question suggestions and submit answer feedback", async () => {
    mocks.serviceJsonTyped
      .mockResolvedValueOnce({
        documentId: "doc-pharmacy",
        title: "Pharmacy Refill Workflow",
        content:
          "Members can request refills online or at the pharmacy desk. Staff verify eligibility before dispensing medication.",
        contentLength: 114,
        wordCount: 17,
        metadata: { streamId: "pharmacy" },
        status: "published",
        chunkCount: 3,
      })
      .mockResolvedValueOnce({
        answer: JSON.stringify([
          "How do members request refills?",
          "What eligibility checks happen before dispensing?",
          "When should pharmacy staff escalate a refill issue?",
          "Which refill channels are available to members?",
          "What happens before medication is dispensed?",
        ]),
        confidence: 0.94,
        citations: [],
      })
      .mockResolvedValueOnce({ recorded: 1, message: "captured" });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.suggestTestQuestions({
        documentId: "doc-pharmacy",
        title: "Pharmacy Refill Workflow",
        department: "Pharmacy",
        valueStreamId: "pharmacy",
      })
    ).resolves.toMatchObject({
      questions: expect.arrayContaining(["How do members request refills?"]),
    });

    await expect(
      caller.knowledge.chunkFeedback({
        valueStreamId: "pharmacy",
        signal: "up",
        query: "How do members request refills?",
        answer: "Members can request refills online or at the pharmacy desk.",
        chunkIds: ["chunk-1"],
        documentIds: ["doc-pharmacy"],
        confidence: 0.94,
        evalScore: 0.88,
      })
    ).resolves.toMatchObject({ recorded: 1 });

    expect(mocks.serviceJsonTyped).toHaveBeenNthCalledWith(
      1,
      "http://vector.test/v1/documents/doc-pharmacy/content",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
    expect(mocks.serviceJsonTyped).toHaveBeenNthCalledWith(
      2,
      "http://pipeline.test/v1/generate/answer",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
    expect(mocks.serviceJsonTyped).toHaveBeenNthCalledWith(
      3,
      "http://pipeline.test/v1/feedback/chunk",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("keeps compareShadowRetrieval manager-only", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.compareShadowRetrieval({
        query: "What is the maximum adult metformin dose?",
        valueStreamId: "pharmacy",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
