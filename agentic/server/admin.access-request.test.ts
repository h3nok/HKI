import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendAccessRequestSubmittedEmail: vi.fn(),
  serviceJsonTyped: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./email", async importOriginal => {
  const actual = await importOriginal<typeof import("./email")>();
  return {
    ...actual,
    sendAccessRequestSubmittedEmail: mocks.sendAccessRequestSubmittedEmail,
  };
});

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

function makeCtx(): TrpcContext {
  return {
    user: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.KNOWLEDGE_ACCESS_REQUEST_RECIPIENTS;
  mocks.sendAccessRequestSubmittedEmail.mockResolvedValue(true);
});

describe("admin.submitAccessRequest", () => {
  it("notifies admins and matching stream managers after saving a request", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const select = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: "pharmacy", name: "Pharmacy" }]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              email: "admin@hki.com",
              name: "James Admin",
              role: "admin",
              valueStreams: null,
            },
            {
              email: "manager@hki.com",
              name: "Maria Manager",
              role: "manager",
              valueStreams: "pharmacy,optical",
            },
            {
              email: "other-manager@hki.com",
              name: "Other Manager",
              role: "manager",
              valueStreams: "fresh-foods",
            },
          ]),
        })),
      }));

    mocks.getDb.mockResolvedValue({
      insert: vi.fn(() => ({ values: insertValues })),
      select,
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.submitAccessRequest({
      name: "Jane Doe",
      email: "jane.doe@hki.com",
      department: "Pharmacy",
      valueStream: "pharmacy",
      justification:
        "Need to review SOPs and manage our pharmacy knowledge base.",
      managerEmail: "leader@hki.com",
    });

    expect(result).toEqual({ success: true });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        email: "jane.doe@hki.com",
        department: "Pharmacy",
        valueStream: "pharmacy",
        managerEmail: "leader@hki.com",
      })
    );
    expect(mocks.sendAccessRequestSubmittedEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendAccessRequestSubmittedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@hki.com",
        reviewerName: "James Admin",
        requesterName: "Jane Doe",
        streamName: "Pharmacy",
      })
    );
    expect(mocks.sendAccessRequestSubmittedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager@hki.com",
        reviewerName: "Maria Manager",
        requesterName: "Jane Doe",
        streamName: "Pharmacy",
      })
    );
  });

  it("still succeeds when no reviewer recipients can be resolved", async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn().mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            email: null,
            name: "Manager Without Email",
            role: "manager",
            valueStreams: "pharmacy",
          },
        ]),
      })),
    }));

    mocks.getDb.mockResolvedValue({
      insert: vi.fn(() => ({ values: insertValues })),
      select,
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.submitAccessRequest({
      name: "Unassigned User",
      email: "user@hki.com",
      department: "Operations",
      justification: "Need access to support knowledge operations for my team.",
    });

    expect(result).toEqual({ success: true });
    expect(insertValues).toHaveBeenCalledOnce();
    expect(mocks.sendAccessRequestSubmittedEmail).not.toHaveBeenCalled();
  });
});
