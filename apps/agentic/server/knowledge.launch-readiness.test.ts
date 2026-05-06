import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { serviceJsonTyped } from "./service-client";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./service-client", () => ({
  serviceJson: vi.fn().mockResolvedValue({}),
  serviceJsonTyped: vi.fn().mockResolvedValue({}),
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
    openId: "knowledge-scope-user",
    name: "Scoped Manager",
    email: "manager@hki.com",
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

describe("knowledge.launchReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("rejects managers who request an unassigned stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.launchReadiness({ valueStreamId: "optical" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: 'You do not have access to value stream "optical"',
    });
  });

  it("rejects global launch readiness requests even for admins", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await expect(
      caller.knowledge.launchReadiness({ valueStreamId: "global" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to the global knowledge scope",
    });
  });

  it("fails closed when readiness is requested for an allowed stream while the database is offline", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.launchReadiness({
      valueStreamId: "pharmacy",
    });

    expect(result.ready).toBe(false);
    expect(result.summary).toContain("database is offline");
    expect(result.checks.every(check => check.passed === false)).toBe(true);
  });

  it("accepts vector stats payloads that use documents/chunks keys", async () => {
    const serviceJsonTypedMock = vi.mocked(serviceJsonTyped);
    const fakeDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
        }),
    };

    mocks.getDb.mockResolvedValue(fakeDb);
    serviceJsonTypedMock.mockImplementation(async url => {
      if (url === "http://vector.test/v1/stats") {
        return { documents: 311, chunks: 429 };
      }
      if (
        url ===
        "http://pipeline.test/v1/review/pending?limit=100&value_stream_id=pharmacy"
      ) {
        return [];
      }
      return { services: [] };
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.launchReadiness({
      valueStreamId: "pharmacy",
    });

    expect(
      result.checks.find(check => check.key === "live_content")
    ).toMatchObject({
      passed: true,
      detail: "311 live documents indexed",
    });
  });

  it("normalizes knowledge.stats responses to totalDocuments and totalChunks", async () => {
    const serviceJsonTypedMock = vi.mocked(serviceJsonTyped);
    serviceJsonTypedMock.mockImplementation(async url => {
      if (url === "http://vector.test/v1/stats") {
        return { documents: 12, chunks: 34 };
      }
      return {};
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.stats({ valueStreamId: "pharmacy" });

    expect(result).toMatchObject({
      documents: 12,
      chunks: 34,
      totalDocuments: 12,
      totalChunks: 34,
    });
  });
});
