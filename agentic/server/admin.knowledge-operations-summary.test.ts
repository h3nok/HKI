import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { valueStreams } from "../drizzle/schema";

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
    openId: "admin-kb-summary-user",
    name: "Admin User",
    email: "admin@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "admin",
    department: null,
    orgId: "default",
    valueStreams: "global",
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

function makeStreamsDb(
  streams: Array<{ id: string; name: string }>
): Record<string, unknown> {
  return {
    select: vi.fn(() => {
      const state: { table: unknown } = { table: null };
      const chain: any = {
        from(table: unknown) {
          state.table = table;
          return chain;
        },
        where: vi.fn(() => ({
          orderBy: vi.fn().mockImplementation(async () => {
            if (state.table === valueStreams) {
              return streams;
            }
            return [];
          }),
        })),
      };
      return chain;
    }),
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "job-1",
    orgId: "default",
    streamId: "pharmacy",
    status: "queued",
    sourceType: "file",
    sourceRef: "refill.pdf",
    title: "Refill Guide",
    department: "Pharmacy",
    documentType: "policy",
    tags: [],
    classification: "internal",
    accessControl: undefined,
    documentId: null,
    chunkCount: 0,
    entityCount: 0,
    error: null,
    failedAtStage: null,
    rawSizeBytes: 0,
    cleanSizeBytes: 0,
    processingTimeMs: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...overrides,
  };
}

describe("admin.knowledgeOperationsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates KB metrics across active non-global streams", async () => {
    mocks.getDb.mockResolvedValue(
      makeStreamsDb([
        { id: "global", name: "Global" },
        { id: "optical", name: "Optical" },
        { id: "pharmacy", name: "Pharmacy" },
      ])
    );

    mocks.serviceJsonTyped.mockImplementation((url: string, ctx: any) => {
      const streamId = ctx.scopes?.[0];
      if (url === "http://vector.test/v1/stats") {
        return Promise.resolve(
          streamId === "pharmacy"
            ? { documents: 12, chunks: 120 }
            : { totalDocuments: 4, totalChunks: 40 }
        );
      }
      if (url === "http://vector.test/v1/graph/stats") {
        return Promise.resolve(
          streamId === "pharmacy"
            ? { entities: 7, relationships: 15 }
            : { totalEntities: 3, relationships: 5 }
        );
      }
      if (url === "http://pipeline.test/v1/jobs?limit=100&offset=0") {
        return Promise.resolve({
          jobs:
            streamId === "pharmacy"
              ? [
                  makeJob({
                    id: "job-pharmacy-active",
                    streamId,
                    createdAt: "2026-04-09T12:00:00.000Z",
                    status: "queued",
                  }),
                  makeJob({
                    id: "job-pharmacy-done",
                    streamId,
                    createdAt: "2026-04-09T10:00:00.000Z",
                    status: "completed",
                  }),
                ]
              : [
                  makeJob({
                    id: "job-optical-failed",
                    streamId,
                    createdAt: "2026-04-09T11:00:00.000Z",
                    status: "failed",
                  }),
                ],
          total: 0,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.knowledgeOperationsSummary();

    expect(result.aggregate).toMatchObject({
      documents: 16,
      chunks: 160,
      entities: 10,
      relationships: 20,
      totalJobs: 3,
      activeJobs: 1,
      completedJobs: 1,
      failedJobs: 1,
    });
    expect(result.streams.map(stream => stream.valueStreamId)).toEqual([
      "optical",
      "pharmacy",
    ]);
    expect(result.recentActiveJobs.map(job => job.id)).toEqual([
      "job-pharmacy-active",
    ]);
    expect(result.partialFailures).toBe(0);
  });

  it("returns partial data when one stream fails downstream", async () => {
    mocks.getDb.mockResolvedValue(
      makeStreamsDb([
        { id: "optical", name: "Optical" },
        { id: "pharmacy", name: "Pharmacy" },
      ])
    );

    mocks.serviceJsonTyped.mockImplementation((url: string, ctx: any) => {
      const streamId = ctx.scopes?.[0];
      if (streamId === "optical" && url === "http://vector.test/v1/stats") {
        return Promise.reject(new Error("vector offline"));
      }
      if (url === "http://vector.test/v1/stats") {
        return Promise.resolve({ totalDocuments: 5, totalChunks: 50 });
      }
      if (url === "http://vector.test/v1/graph/stats") {
        return Promise.resolve({ totalEntities: 2, relationships: 4 });
      }
      if (url === "http://pipeline.test/v1/jobs?limit=100&offset=0") {
        return Promise.resolve({
          jobs: [makeJob({ id: `job-${streamId}`, streamId, status: "queued" })],
          total: 1,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.knowledgeOperationsSummary();
    const optical = result.streams.find(stream => stream.valueStreamId === "optical");

    expect(optical).toMatchObject({
      documents: 0,
      chunks: 0,
      entities: 2,
      relationships: 4,
      activeJobs: 1,
      partialFailure: true,
    });
    expect(result.partialFailures).toBe(1);
    expect(result.aggregate.activeJobs).toBe(2);
  });
});
