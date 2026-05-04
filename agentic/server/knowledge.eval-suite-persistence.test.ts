import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { KnowledgeEvalSuite, User } from "../drizzle/schema";

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
    id: 7,
    openId: "knowledge-eval-suite-user",
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

function makeSuiteRow(
  overrides: Partial<KnowledgeEvalSuite> = {}
): KnowledgeEvalSuite {
  return {
    id: "suite-1",
    valueStreamId: "pharmacy",
    orgId: "default",
    name: "Pharmacy rollout gate",
    origin: "manual",
    basedOnSnapshotId: null,
    cases: JSON.stringify([
      {
        id: "case-1",
        query: "How do pharmacy staff process refills?",
        expectedAnswer: "Verify eligibility before dispensing.",
      },
    ]),
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    updatedAt: new Date("2026-04-10T12:00:00.000Z"),
    ...overrides,
  };
}

function createEvalSuiteDb(initialRows: KnowledgeEvalSuite[] = []) {
  const rows = [...initialRows];

  const makeOrderedResult = () => ({
    limit: vi.fn(async (limit?: number) => rows.slice(0, limit ?? rows.length)),
  });

  const makeWhereResult = () => ({
    limit: vi.fn(async (limit?: number) => rows.slice(0, limit ?? rows.length)),
    orderBy: vi.fn(() => makeOrderedResult()),
  });

  return {
    _rows: rows,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => makeWhereResult()),
        orderBy: vi.fn(() => makeOrderedResult()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(
        async (value: Omit<KnowledgeEvalSuite, "createdAt" | "updatedAt">) => {
          const now = new Date("2026-04-10T13:00:00.000Z");
          rows.unshift({
            ...value,
            createdAt: now,
            updatedAt: now,
          });
        }
      ),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Partial<KnowledgeEvalSuite>) => ({
        where: vi.fn(async () => {
          if (!rows[0]) return;
          rows[0] = {
            ...rows[0],
            ...patch,
            updatedAt: new Date("2026-04-10T14:00:00.000Z"),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        rows.splice(0, 1);
      }),
    })),
  };
}

describe("knowledge maintained eval suites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceJsonTyped.mockReset();
  });

  it("saves a maintained suite and lists it for the selected stream", async () => {
    const db = createEvalSuiteDb();
    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const saved = await caller.knowledge.saveEvalSuite({
      valueStreamId: "pharmacy",
      name: "Pharmacy rollout gate",
      origin: "manual",
      basedOnSnapshotId: null,
      cases: [
        {
          id: "case-1",
          query: "How do pharmacy staff process refills?",
          expectedAnswer: "Verify eligibility before dispensing.",
        },
        {
          id: "case-blank",
          query: "   ",
          expectedAnswer: "",
        },
      ],
    });

    expect(saved.name).toBe("Pharmacy rollout gate");
    expect(saved.caseCount).toBe(1);
    expect(saved.cases[0]?.query).toBe(
      "How do pharmacy staff process refills?"
    );
    expect(db.insert).toHaveBeenCalledTimes(1);

    const suites = await caller.knowledge.listEvalSuites({
      valueStreamId: "pharmacy",
    });

    expect(suites).toHaveLength(1);
    expect(suites[0]?.id).toBe(saved.id);
    expect(suites[0]?.cases[0]?.expectedAnswer).toBe(
      "Verify eligibility before dispensing."
    );
  });

  it("updates and deletes a maintained suite", async () => {
    const db = createEvalSuiteDb([makeSuiteRow()]);
    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const updated = await caller.knowledge.saveEvalSuite({
      id: "suite-1",
      valueStreamId: "pharmacy",
      name: "Pharmacy launch gate",
      origin: "generated",
      basedOnSnapshotId: "gap-snapshot-9",
      cases: [
        {
          id: "case-2",
          query: "When should pharmacy staff escalate a refill exception?",
          expectedAnswer: "Escalate once eligibility or safety checks fail.",
        },
      ],
    });

    expect(updated.name).toBe("Pharmacy launch gate");
    expect(updated.origin).toBe("generated");
    expect(updated.basedOnSnapshotId).toBe("gap-snapshot-9");
    expect(db.update).toHaveBeenCalledTimes(1);

    const deleted = await caller.knowledge.deleteEvalSuite({
      id: "suite-1",
      valueStreamId: "pharmacy",
    });

    expect(deleted).toEqual({ deleted: true, id: "suite-1" });
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db._rows).toHaveLength(0);
  });
});
