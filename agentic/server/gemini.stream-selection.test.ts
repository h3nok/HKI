import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  serviceJsonTyped: vi.fn(),
  loadFeatureFlagOverrides: vi.fn(),
  isFeatureEnabledForUser: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./service-client", () => ({
  buildSnakeBody: (input: unknown) => input,
  ORCHESTRATOR_URL: "http://orchestrator.test",
  serviceJsonTyped: mocks.serviceJsonTyped,
}));

vi.mock("./_core/feature-flags", () => ({
  loadFeatureFlagOverrides: mocks.loadFeatureFlagOverrides,
  isFeatureEnabledForUser: mocks.isFeatureEnabledForUser,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "gemini-stream-user",
    name: "KB Manager",
    email: "kb.manager@hki.com",
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

describe("gemini knowledge stream selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.LLM_API_KEY = "";
    process.env.LITELLM_API_KEY = "";
    process.env.LITELLM_KEY = "";
    process.env.LLM_GATEWAY_URL = "http://localhost:4000/v1";
    process.env.NODE_ENV = "test";
    mocks.getDb.mockResolvedValue(null);
    mocks.serviceJsonTyped.mockResolvedValue({});
    mocks.loadFeatureFlagOverrides.mockResolvedValue([]);
    mocks.isFeatureEnabledForUser.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when ingestion planning omits a stream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { geminiRouter } = await import("./gemini");
    const caller = geminiRouter.createCaller(makeCtx());

    await expect(
      caller.suggestIngestionPlan({
        streamName: "Pharmacy",
      })
    ).rejects.toThrow(/Select a value stream before planning ingestion/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when gap analysis omits a stream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { geminiRouter } = await import("./gemini");
    const caller = geminiRouter.createCaller(makeCtx());

    await expect(
      caller.analyzeGaps({
        streamName: "Pharmacy",
        documents: [],
      })
    ).rejects.toThrow(/Select a value stream before analyzing knowledge gaps/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects global gap snapshot history requests even for admins", async () => {
    const { geminiRouter } = await import("./gemini");
    const caller = geminiRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "global" }))
    );

    await expect(
      caller.listGapSnapshots({
        valueStreamId: "global",
        limit: 10,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to the global knowledge scope",
    });
  });
});
