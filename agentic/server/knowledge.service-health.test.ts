import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import {
  knowledgeContributions,
  knowledgeDocumentImpact,
} from "../drizzle/schema";

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
  LLM_GATEWAY_BASE_URL: "http://gateway.test",
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
    openId: "knowledge-health-user",
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

function makeAuditDb(counts: {
  contributions: number;
  documentImpact: number;
}): Record<string, unknown> {
  return {
    select: vi.fn(() => {
      const state: { table: unknown | null } = { table: null };
      const chain: any = {
        from(table: unknown) {
          state.table = table;
          return chain;
        },
        where: vi.fn().mockImplementation(async () => {
          if (state.table === knowledgeContributions) {
            return [{ count: counts.contributions }];
          }
          if (state.table === knowledgeDocumentImpact) {
            return [{ count: counts.documentImpact }];
          }
          return [{ count: 0 }];
        }),
      };
      return chain;
    }),
  };
}

function makeResponse(
  ok: boolean,
  status: number,
  payload?: Record<string, unknown>
) {
  return {
    ok,
    status,
    clone: () => ({
      json: async () => payload ?? null,
    }),
  } as Response;
}

describe("knowledge.serviceHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KB_HERMETIC_ISOLATION = "true";
    mocks.getDb.mockResolvedValue(
      makeAuditDb({ contributions: 1, documentImpact: 0 })
    );
  });

  it("uses readiness probes for KB services and reports the local HVSI audit", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "http://vector.test/ready") {
        return Promise.resolve(
          makeResponse(false, 503, {
            status: "blocked",
            hvsi: {
              enabled: true,
              ready: false,
              issues: { documents_missing_stream: 2 },
            },
          })
        );
      }

      if (url === "http://pipeline.test/ready") {
        return Promise.resolve(
          makeResponse(true, 200, {
            status: "ready",
            hvsi: { enabled: true, ready: true, issues: {} },
          })
        );
      }

      if (url === "http://orchestrator.test/health") {
        return Promise.resolve(makeResponse(true, 200, { status: "healthy" }));
      }

      if (url === "http://gateway.test/health") {
        return Promise.resolve(makeResponse(true, 200, { status: "healthy" }));
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.serviceHealth();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://vector.test/ready",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://pipeline.test/ready",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://orchestrator.test/health",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://gateway.test/health",
      expect.any(Object)
    );

    expect(result.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "knowledge-api",
          ok: false,
        }),
        expect.objectContaining({
          name: "pipeline",
          ok: true,
        }),
        expect.objectContaining({
          name: "hvsi-audit",
          ok: false,
        }),
      ])
    );
  });
});
