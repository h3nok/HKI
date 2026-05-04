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
    id: 11,
    openId: "knowledge-summary-user",
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

describe("knowledge document inventory summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the caller omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(caller.knowledge.documentInventorySummary({})).rejects.toThrow(
      /Select a value stream before viewing document inventory/
    );

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("returns the scoped document inventory summary", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      totalDocuments: 311,
      liveCount: 293,
      pendingReviewCount: 18,
      processingCount: 0,
      archivedCount: 0,
      failedCount: 0,
      missingLabelsCount: 7,
      topDepartments: [
        { label: "Pharmacy", value: 204 },
        { label: "Operations", value: 67 },
      ],
      freshness: {
        currentCount: 270,
        reviewCount: 28,
        staleCount: 13,
        unknownCount: 0,
      },
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.documentInventorySummary({
      valueStreamId: "pharmacy",
    });

    expect(result).toMatchObject({
      totalDocuments: 311,
      liveCount: 293,
      pendingReviewCount: 18,
      processingCount: 0,
      archivedCount: 0,
      failedCount: 0,
      missingLabelsCount: 7,
      topDepartments: [
        { label: "Pharmacy", value: 204 },
        { label: "Operations", value: 67 },
      ],
      freshness: {
        currentCount: 270,
        reviewCount: 28,
        staleCount: 13,
        unknownCount: 0,
      },
    });

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://vector.test/v1/documents/summary",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
  });
});
