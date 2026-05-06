import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

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
    openId: "release-guard-user",
    name: "Release Manager",
    email: "release.manager@hki.com",
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

function makeCandidateRelease() {
  const now = new Date();
  return {
    id: "release-1",
    valueStreamId: "pharmacy",
    orgId: "default",
    createdBy: 1,
    label: "Candidate release",
    notes: null,
    status: "candidate",
    basedOnEvalRunId: null,
    snapshot: JSON.stringify({ liveDocumentCount: 0 }),
    createdAt: now,
    updatedAt: now,
    promotedAt: null,
    rolledBackAt: null,
  };
}

function makeRelease(
  overrides: Partial<ReturnType<typeof makeCandidateRelease>> = {}
) {
  return {
    ...makeCandidateRelease(),
    ...overrides,
  };
}

describe("knowledge.rollbackRelease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([makeCandidateRelease()]),
          })),
        })),
      })),
    });
  });

  it("rejects rollback attempts against unreleased candidates", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.rollbackRelease({ releaseId: "release-1" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Only previously promoted releases can be restored through rollback",
    });
  });

  it("rejects rollback for releases in inaccessible streams", async () => {
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              makeRelease({
                id: "release-optical",
                valueStreamId: "optical",
                status: "promoted",
              }),
            ]),
          })),
        })),
      })),
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.rollbackRelease({ releaseId: "release-optical" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: 'You do not have access to value stream "optical"',
    });
  });

  it("rejects rollback for legacy global releases", async () => {
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              makeRelease({
                id: "release-global",
                valueStreamId: "global",
                status: "promoted",
              }),
            ]),
          })),
        })),
      })),
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await expect(
      caller.knowledge.rollbackRelease({ releaseId: "release-global" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to the global knowledge scope",
    });
  });
});

describe("knowledge.promoteRelease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              makeRelease({
                id: "release-optical",
                valueStreamId: "optical",
                status: "candidate",
              }),
            ]),
          })),
        })),
      })),
    });
  });

  it("rejects promotion for releases in inaccessible streams", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.promoteRelease({ releaseId: "release-optical" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: 'You do not have access to value stream "optical"',
    });
  });

  it("rejects promotion for legacy global releases", async () => {
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              makeRelease({
                id: "release-global",
                valueStreamId: "global",
                status: "candidate",
              }),
            ]),
          })),
        })),
      })),
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await expect(
      caller.knowledge.promoteRelease({ releaseId: "release-global" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to the global knowledge scope",
    });
  });
});
