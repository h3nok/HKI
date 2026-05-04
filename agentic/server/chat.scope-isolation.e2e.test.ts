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
    openId: "chat-scope-e2e-user",
    name: "Scoped Chat User",
    email: "chat-scope@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "operator",
    department: null,
    orgId: "hki",
    valueStreams: "fraud,innovation",
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

describe("E2E: chat value-stream isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("filters task listings and hides conversations after stream access narrows", async () => {
    const { appRouter } = await import("./routers");

    const creator = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4101,
          role: "operator",
          valueStreams: "fraud,innovation",
        })
      )
    );

    const fraudTask = await creator.chat.createTask({
      title: "Fraud conversation",
      scope: "fraud",
    });
    const innovationTask = await creator.chat.createTask({
      title: "Innovation conversation",
      scope: "innovation",
    });

    const narrowedReader = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4101,
          role: "viewer",
          valueStreams: "fraud",
        })
      )
    );

    const visibleTasks = await narrowedReader.chat.getTasks({ userId: 4101 });

    expect(visibleTasks.map(task => task.id)).toContain(fraudTask.id);
    expect(visibleTasks.map(task => task.id)).not.toContain(innovationTask.id);

    const fraudConversation = await narrowedReader.chat.getTask({
      conversationId: fraudTask.id,
    });
    expect(fraudConversation.conversation.scope).toBe("fraud");

    await expect(
      narrowedReader.chat.getTask({ conversationId: innovationTask.id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Conversation not found",
    });
  });

  it("fails closed when a user explicitly requests an unauthorized chat stream", async () => {
    const { appRouter } = await import("./routers");

    const caller = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4102,
          role: "operator",
          valueStreams: "fraud",
        })
      )
    );

    await expect(
      caller.chat.createTask({
        title: "Unauthorized innovation conversation",
        scope: "innovation",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: 'You do not have access to chat stream "innovation"',
    });
  });

  it("fails closed when a user starts a chat without selecting a stream", async () => {
    const { appRouter } = await import("./routers");

    const caller = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4103,
          role: "operator",
          valueStreams: "fraud",
        })
      )
    );

    await expect(
      caller.chat.createTask({
        title: "Missing scope conversation",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Select a value stream before starting a chat",
    });
  });

  it("hides explicit global conversations after a user's access narrows", async () => {
    const { appRouter } = await import("./routers");

    const creator = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4104,
          role: "operator",
          valueStreams: "global,fraud",
        })
      )
    );

    const globalTask = await creator.chat.createTask({
      title: "Global conversation",
      scope: "global",
    });

    const narrowedReader = appRouter.createCaller(
      makeCtx(
        makeUser({
          id: 4104,
          role: "viewer",
          valueStreams: "fraud",
        })
      )
    );

    const visibleTasks = await narrowedReader.chat.getTasks({ userId: 4104 });

    expect(visibleTasks.map(task => task.id)).not.toContain(globalTask.id);

    await expect(
      narrowedReader.chat.getTask({ conversationId: globalTask.id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Conversation not found",
    });
  });
});
