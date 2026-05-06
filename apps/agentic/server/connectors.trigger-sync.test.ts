import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  loadFeatureFlagOverrides: vi.fn(),
  isFeatureEnabledForUser: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./_core/feature-flags", () => ({
  loadFeatureFlagOverrides: mocks.loadFeatureFlagOverrides,
  isFeatureEnabledForUser: mocks.isFeatureEnabledForUser,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "connector-admin-user",
    name: "Connector Admin",
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

function makeSelectChain(result: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

describe("connector triggerSync isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFeatureFlagOverrides.mockResolvedValue([]);
    mocks.isFeatureEnabledForUser.mockReturnValue(true);
  });

  it("rejects persisted connectors that resolve to global stream ownership", async () => {
    const insert = vi.fn();
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          makeSelectChain([
            {
              id: "connector-1",
              orgId: "default",
              type: "google_drive",
              status: "active",
              lastSyncAt: null,
              config: {},
              streamId: "global",
              createdBy: 1,
            },
          ])
        )
        .mockImplementationOnce(() => makeSelectChain([])),
      insert,
    };

    mocks.getDb.mockResolvedValue(db);

    const { connectorsRouter } = await import("./connectors");
    const caller = connectorsRouter.createCaller(makeCtx());

    await expect(caller.triggerSync({ id: "connector-1" })).rejects.toThrow(
      /Connector is missing a non-global value stream assignment/
    );

    expect(insert).not.toHaveBeenCalled();
  });
});
