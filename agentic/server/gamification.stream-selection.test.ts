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
    openId: "gamification-stream-user",
    name: "Knowledge Manager",
    email: "gamification.manager@hki.com",
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

describe("gamification contribution scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
    process.env.KB_HERMETIC_ISOLATION = "false";
  });

  it("fails closed when contribution recording omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.gamification.recordContribution({ action: "upload" })
    ).rejects.toThrow(
      /Select a value stream before recording a knowledge contribution/
    );
  });

  it("rejects global contribution recording even for admins", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await expect(
      caller.gamification.recordContribution({
        action: "upload",
        valueStreamId: "global",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to the global knowledge scope",
    });
  });
});
