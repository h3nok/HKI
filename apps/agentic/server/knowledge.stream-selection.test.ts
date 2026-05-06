import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  serviceJsonTyped: vi.fn(),
  serviceMultipartUpload: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./service-client", () => ({
  serviceJson: vi.fn().mockResolvedValue({}),
  serviceJsonTyped: mocks.serviceJsonTyped,
  serviceMultipartUpload: mocks.serviceMultipartUpload,
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
    openId: "knowledge-stream-user",
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

describe("knowledge stream selection enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
    mocks.serviceMultipartUpload.mockResolvedValue({
      status: "queued",
      title: "upload",
      chunkCount: 0,
    });
  });

  it("scopes admin file uploads to the explicitly selected stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(
        makeUser({
          role: "admin",
          valueStreams:
            "feature-flags-e2e-1776107127763,feature-flags-e2e-1776107359471",
        })
      )
    );

    await caller.knowledge.uploadFile({
      fileBase64: "aGVsbG8=",
      filename: "formulary.txt",
      contentType: "text/plain",
      streamId: "pharmacy",
    });

    expect(mocks.serviceMultipartUpload).toHaveBeenCalledWith(
      "http://pipeline.test/v1/ingest/file",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      "aGVsbG8=",
      "formulary.txt",
      "text/plain",
      expect.objectContaining({
        stream_id: "pharmacy",
      })
    );
  });

  it("fails closed when automated evaluation omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.evaluateAuto({
        cases: [{ query: "How do staff process a refill request?" }],
      })
    ).rejects.toThrow(
      /Select a value stream before running an automated evaluation/
    );

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("scopes suggested test question generation to the selected stream", async () => {
    mocks.serviceJsonTyped.mockImplementation((url: string) => {
      if (url === "http://vector.test/v1/documents/doc-pharmacy/content") {
        return Promise.resolve({
          documentId: "doc-pharmacy",
          title: "Pharmacy Refill Workflow",
          content:
            "Members can request refills online or at the pharmacy desk. Staff verify eligibility before dispensing medication.",
          contentLength: 114,
          wordCount: 17,
          metadata: { streamId: "pharmacy" },
          status: "published",
          chunkCount: 3,
        });
      }

      if (url === "http://pipeline.test/v1/generate/answer") {
        return Promise.resolve({
          answer: JSON.stringify([
            "How do members request refills?",
            "What eligibility checks are required before dispensing?",
            "When should pharmacy staff escalate a refill issue?",
            "Which refill channels are available to members?",
            "What happens before medication is dispensed?",
          ]),
          confidence: 0.94,
          citations: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.suggestTestQuestions({
      documentId: "doc-pharmacy",
      title: "Pharmacy Refill Workflow",
      department: "Pharmacy",
      valueStreamId: "pharmacy",
    });

    expect(result.questions).toHaveLength(5);
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
  });

  it("fails closed when graph entity search omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.entitySearch({
        query: "refill",
      })
    ).rejects.toThrow(
      /Select a value stream before searching the knowledge graph/
    );

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("fails closed when graph context omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.entityContext({
        entityName: "Refill Request",
      })
    ).rejects.toThrow(/Select a value stream before opening graph context/);

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("scopes observability summary to the selected stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      totalTraces: 0,
      errorCount: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      operations: {},
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await caller.knowledge.observabilitySummary({
      valueStreamId: "pharmacy",
    });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/observability/summary",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
  });

  it("scopes taxonomy roots to the selected stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue([]);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await caller.knowledge.taxonomyListRoots({ valueStreamId: "pharmacy" });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/taxonomy/nodes",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
  });
});
