import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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
  buildSnakeBody: (input: unknown) => input,
  ORCHESTRATOR_URL: "http://orchestrator.test",
  serviceJsonTyped: mocks.serviceJsonTyped,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "gemini-fallback-user",
    name: "KB Manager",
    email: "kb.manager@hki.com",
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

function makeCtx(user: User): TrpcContext {
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

describe("geminiRouter no-key fallback", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns fallback persona when no stream or platform LLM key exists", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { geminiRouter } = await import("./gemini");
    const caller = geminiRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: null }))
    );

    const result = await caller.generatePersona({
      streamName: "Pharmacy",
      domain: "pharmacy operations",
    });

    expect(result.persona).toContain(
      "You are the Pharmacy enterprise assistant"
    );
    expect(result.persona).toContain("pharmacy operations");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns fallback questions for a stream without an LLM key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ llmApiKey: null }]),
          })),
        })),
      })),
    });

    const { geminiRouter } = await import("./gemini");
    const caller = geminiRouter.createCaller(makeCtx(makeUser()));

    const result = await caller.suggestQuestions({
      title: "Return Policy",
      content:
        "Returns require a receipt, manager approval for damaged goods, and escalation when fraud is suspected.",
      valueStreamId: "pharmacy",
    });

    expect(result.questions).toHaveLength(5);
    expect(result.questions.join(" ").toLowerCase()).toContain("receipt");
    expect(result.questions.join(" ").toLowerCase()).toContain("approval");
    expect(result.questions.join(" ").toLowerCase()).toContain("fraud");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
