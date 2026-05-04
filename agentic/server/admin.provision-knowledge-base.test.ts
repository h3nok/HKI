import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import {
  knowledgeCollections,
  type User,
  users,
  userValueStreams,
  valueStreams,
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
    openId: "kb-provision-user",
    name: "KB Creator",
    email: "creator@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "viewer",
    department: null,
    orgId: "default",
    valueStreams: null,
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

function createProvisionDbMock() {
  const inserts: Array<{ table: unknown; value: any }> = [];
  const updates: Array<{ table: unknown; payload: any }> = [];
  const assignments: Array<{ valueStreamId: string }> = [];

  const db = {
    select: vi.fn(() => {
      const state: { table: unknown } = { table: null };
      const chain: any = {
        from(table: unknown) {
          state.table = table;
          return chain;
        },
        where: vi.fn(() => {
          if (state.table === valueStreams) {
            return {
              limit: vi.fn().mockResolvedValue([]),
            };
          }

          if (state.table === userValueStreams) {
            return Promise.resolve(assignments);
          }

          return Promise.resolve([]);
        }),
      };
      return chain;
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (value: any) => {
        inserts.push({ table, value });
        if (table === userValueStreams) {
          assignments.push({ valueStreamId: value.valueStreamId });
        }
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((payload: any) => ({
        where: vi.fn(async () => {
          updates.push({ table, payload });
        }),
      })),
    })),
  };

  return { db, inserts, updates };
}

describe("admin.provisionKnowledgeBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects viewers from self-provisioning a knowledge base", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.admin.provisionKnowledgeBase({
        name: "Legal Ops",
        description: "Privileged workflows and intake guidance.",
        icon: "⚖️",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only knowledge managers can provision a knowledge base",
    });

    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("allows a manager to provision a stream without changing their role", async () => {
    const { db, inserts, updates } = createProvisionDbMock();
    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      makeCtx(makeUser({ role: "manager" }))
    );

    const result = await caller.admin.provisionKnowledgeBase({
      name: "Legal Ops",
      description: "Privileged workflows and intake guidance.",
      icon: "⚖️",
    });

    expect(result).toMatchObject({
      id: "legal-ops",
      name: "Legal Ops",
    });

    expect(inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: valueStreams,
          value: expect.objectContaining({
            id: "legal-ops",
            name: "Legal Ops",
            icon: "⚖️",
          }),
        }),
        expect.objectContaining({
          table: knowledgeCollections,
          value: expect.objectContaining({
            valueStreamId: "legal-ops",
            name: "General",
          }),
        }),
        expect.objectContaining({
          table: userValueStreams,
          value: expect.objectContaining({
            userId: 1,
            valueStreamId: "legal-ops",
          }),
        }),
      ])
    );

    const userUpdate = updates.find(update => update.table === users);
    expect(userUpdate?.payload).toMatchObject({
      valueStreams: "legal-ops",
    });
    expect(userUpdate?.payload).not.toHaveProperty("role");

    const provisionedStream = inserts.find(
      insert => insert.table === valueStreams
    )?.value;
    const knowledgeConfig = JSON.parse(provisionedStream.knowledgeConfig);
    expect(knowledgeConfig).toMatchObject({
      similarityThreshold: 0.85,
      maxResults: 5,
    });
  });
});
