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
    openId: "knowledge-eval-user",
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

describe("knowledge scoped generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("forwards only the selected stream scope when searching", async () => {
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
  });

  it("fails closed when retrieval is tested without an explicit stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.search({
        query: "refill steps",
      })
    ).rejects.toThrow(/Select a value stream before testing retrieval/);

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("generates eval cases only from documents in the selected stream", async () => {
    mocks.serviceJsonTyped.mockImplementation((url: string) => {
      if (url.includes("/v1/documents?")) {
        return Promise.resolve({
          documents: [
            {
              id: "doc-stream",
              title: "Pharmacy Refill Workflow",
              department: "Pharmacy",
              documentType: "sop",
              streamId: "pharmacy",
              status: "published",
              chunkCount: 4,
              createdAt: new Date().toISOString(),
            },
            {
              id: "doc-global",
              title: "General Copilot Playbook",
              department: "Operations",
              documentType: "policy",
              streamId: null,
              status: "published",
              chunkCount: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 2,
          limit: 12,
          offset: 0,
        });
      }

      if (url.endsWith("/v1/documents/doc-stream/content")) {
        return Promise.resolve({
          documentId: "doc-stream",
          title: "Pharmacy Refill Workflow",
          content:
            "Members can request refills through the pharmacy desk or online. Staff must verify eligibility before processing.",
          contentLength: 118,
          wordCount: 18,
          metadata: { streamId: "pharmacy" },
          status: "published",
          chunkCount: 4,
        });
      }

      if (url.endsWith("/v1/generate/answer")) {
        return Promise.resolve({
          answer:
            '[{"query":"How do pharmacy staff process a refill request?","expectedAnswer":"Verify eligibility and follow the refill workflow before dispensing."}]',
          confidence: 0.93,
          citations: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.generateEvalSuite({
      valueStreamId: "pharmacy",
      limit: 4,
    });

    expect(result.source).toBe("generated");
    expect(result.basedOnDocumentCount).toBe(1);
    expect(result.cases.length).toBeGreaterThanOrEqual(1);
    expect(
      result.cases.some(testCase => testCase.query.includes("refill request"))
    ).toBe(true);
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/documents/doc-stream/content",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
    expect(mocks.serviceJsonTyped).not.toHaveBeenCalledWith(
      "http://vector.test/v1/documents/doc-global/content",
      expect.anything()
    );
  });

  it("falls back to content-grounded eval cases when generated questions are title-only", async () => {
    mocks.serviceJsonTyped.mockImplementation((url: string) => {
      if (url.includes("/v1/documents?")) {
        return Promise.resolve({
          documents: [
            {
              id: "doc-noisy",
              title:
                "KB2021621 — id=kb_article_view&sys_kb_id=0bd0905397dd3d9018ae3aa71153afe3",
              department: "Pharmacy",
              documentType: "policy",
              streamId: "pharmacy",
              status: "published",
              chunkCount: 4,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        });
      }

      if (url.endsWith("/v1/documents/doc-noisy/content")) {
        return Promise.resolve({
          documentId: "doc-noisy",
          title: "KB2021621",
          content:
            "Managers must verify member eligibility before approving emergency refill overrides. Escalate fraud concerns to pharmacy leadership when verification fails.",
          contentLength: 147,
          wordCount: 18,
          metadata: { streamId: "pharmacy" },
          status: "published",
          chunkCount: 4,
        });
      }

      if (url.endsWith("/v1/generate/answer")) {
        return Promise.resolve({
          answer:
            '[{"query":"What guidance does KB2021621 — id=kb_article_view&sys_kb_id=0bd0905397dd3d9018ae3aa71153afe3 provide?","expectedAnswer":""}]',
          confidence: 0.42,
          citations: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.generateEvalSuite({
      valueStreamId: "pharmacy",
      limit: 4,
    });

    expect(result.source).toBe("fallback");
    expect(result.cases.length).toBeGreaterThan(0);
    expect(
      result.cases.some(testCase =>
        /eligibility|fraud|approval/i.test(testCase.query)
      )
    ).toBe(true);
    expect(
      result.cases.some(testCase =>
        /sys_kb_id|kb_article_view/i.test(testCase.query)
      )
    ).toBe(false);
  });
});
