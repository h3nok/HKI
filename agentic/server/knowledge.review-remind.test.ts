import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import type { ReviewRecord } from "../shared/knowledge-types";

const mocks = vi.hoisted(() => ({
  serviceJsonTyped: vi.fn(),
  sendReviewReminderEmail: vi.fn(),
  sendReviewReminderGoogleChat: vi.fn(),
  getDb: vi.fn(),
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

vi.mock("./email", () => ({
  sendReviewReminderEmail: mocks.sendReviewReminderEmail,
}));

vi.mock("./google-chat", () => ({
  sendReviewReminderGoogleChat: mocks.sendReviewReminderGoogleChat,
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
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
    openId: "review-remind-user",
    name: "Manager Jane",
    email: "manager.jane@hki.com",
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

function makeReviewRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  const now = new Date().toISOString();
  return {
    id: "review-1",
    orgId: "default",
    documentId: "doc-1",
    streamId: "pharmacy",
    title: "Pharmacy Handling SOP",
    department: "Pharmacy",
    tags: [],
    sourceRef: "https://example.hki.com/reviews/doc-1",
    status: "pending_review",
    submittedBy: "submitter@hki.com",
    submittedAt: now,
    reviewedBy: "",
    reviewedAt: null,
    assignedTo: "reviewer@hki.com",
    assignedBy: "manager@hki.com",
    assignedAt: now,
    lastRemindedAt: now,
    publishedAt: null,
    archivedAt: null,
    autoApproved: false,
    autoApproveRule: "",
    qualityReport: null,
    trustScore: null,
    comments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue(null);
  mocks.sendReviewReminderEmail.mockResolvedValue(true);
  mocks.sendReviewReminderGoogleChat.mockResolvedValue(true);
});

describe("knowledge.reviewRemind", () => {
  it("sends Google Chat and email when the assignee is already an email address", async () => {
    const { appRouter } = await import("./routers");
    const record = makeReviewRecord({ assignedTo: "reviewer@hki.com" });
    mocks.serviceJsonTyped.mockResolvedValue(record);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.knowledge.reviewRemind({
      recordId: record.id,
      valueStreamId: record.streamId,
      message: "Please review this before end of day.",
    });

    expect(result).toEqual(record);
    expect(mocks.sendReviewReminderGoogleChat).toHaveBeenCalledWith(
      expect.objectContaining({
        documentTitle: "Pharmacy Handling SOP",
        remindedBy: "Manager Jane",
        assigneeLabel: "reviewer@hki.com",
        streamId: "pharmacy",
        streamLabel: "pharmacy",
        message: "Please review this before end of day.",
      })
    );
    expect(mocks.sendReviewReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "reviewer@hki.com",
        documentTitle: "Pharmacy Handling SOP",
        remindedBy: "Manager Jane",
        assigneeLabel: "reviewer@hki.com",
        message: "Please review this before end of day.",
      })
    );
  });

  it("resolves the assignee email from the users table when the record stores only a name", async () => {
    const { appRouter } = await import("./routers");
    const record = makeReviewRecord({ assignedTo: "Jane Reviewer" });
    mocks.serviceJsonTyped.mockResolvedValue(record);
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi
              .fn()
              .mockResolvedValue([{ email: "jane.reviewer@hki.com" }]),
          })),
        })),
      })),
    });

    const caller = appRouter.createCaller(makeCtx());
    await caller.knowledge.reviewRemind({
      recordId: record.id,
      valueStreamId: record.streamId,
    });

    expect(mocks.sendReviewReminderGoogleChat).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeLabel: "Jane Reviewer",
        streamId: "pharmacy",
      })
    );

    expect(mocks.sendReviewReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane.reviewer@hki.com",
        assigneeLabel: "Jane Reviewer",
      })
    );
  });

  it("still sends Google Chat when assignee email cannot be resolved", async () => {
    const { appRouter } = await import("./routers");
    const record = makeReviewRecord({ assignedTo: "Queue Owner" });
    mocks.serviceJsonTyped.mockResolvedValue(record);
    mocks.getDb.mockResolvedValue(null);

    const caller = appRouter.createCaller(makeCtx());
    await caller.knowledge.reviewRemind({
      recordId: record.id,
      valueStreamId: record.streamId,
    });

    expect(mocks.sendReviewReminderGoogleChat).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeLabel: "Queue Owner",
        streamId: "pharmacy",
      })
    );
    expect(mocks.sendReviewReminderEmail).not.toHaveBeenCalled();
  });
});
