import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  serviceJsonTyped: vi.fn(),
  startJobWatcher: vi.fn(),
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
}));

vi.mock("./job-watcher", () => ({
  startJobWatcher: mocks.startJobWatcher,
  isTerminalJobStatus: (status: string | null | undefined) =>
    status === "completed" || status === "failed",
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
    openId: "knowledge-job-user",
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

function makeJob(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "job-pharmacy",
    orgId: "default",
    streamId: "pharmacy",
    status: "queued",
    sourceType: "file",
    sourceRef: "refill-playbook.pdf",
    title: "Refill Playbook",
    department: "Pharmacy",
    documentType: "policy",
    tags: [],
    classification: "internal",
    accessControl: undefined,
    documentId: null,
    chunkCount: 0,
    entityCount: 0,
    error: null,
    failedAtStage: null,
    rawSizeBytes: 0,
    cleanSizeBytes: 0,
    processingTimeMs: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...overrides,
  };
}

describe("knowledge job stream scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("fails closed when KB job history omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.listJobs({
        limit: 10,
      })
    ).rejects.toThrow(
      /Select a value stream before viewing KB processing jobs/
    );

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("fails closed when KB job detail omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.getJob({
        jobId: "job-pharmacy",
      })
    ).rejects.toThrow(
      /Select a value stream before viewing KB processing jobs/
    );

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("fails closed when document listing omits a stream", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.listDocuments({
        limit: 10,
      })
    ).rejects.toThrow(/Select a value stream before viewing documents/);

    expect(mocks.serviceJsonTyped).not.toHaveBeenCalled();
  });

  it("filters KB job history to the selected stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      jobs: [
        makeJob({ id: "job-pharmacy", streamId: "pharmacy" }),
        makeJob({ id: "job-optical", streamId: "optical" }),
      ],
      total: 2,
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.knowledge.listJobs({
      limit: 10,
      valueStreamId: "pharmacy",
    });

    expect(result.jobs.map(job => job.id)).toEqual(["job-pharmacy"]);
    expect(result.total).toBe(1);
    expect(mocks.startJobWatcher).toHaveBeenCalledWith(
      "job-pharmacy",
      1,
      expect.objectContaining({ id: 1 }),
      "pharmacy"
    );
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/jobs?limit=10&offset=0",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
  });

  it("rejects a job detail response that does not match the selected stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      job: makeJob({ id: "job-optical", streamId: "optical" }),
      stagesCompleted: [],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.getJob({
        jobId: "job-optical",
        valueStreamId: "pharmacy",
      })
    ).rejects.toThrow(/Job not found in selected value stream/);

    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/jobs/job-optical",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      })
    );
    expect(mocks.startJobWatcher).not.toHaveBeenCalled();
  });

  it("bootstraps watcher when loading active job detail", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      job: makeJob({
        id: "job-pharmacy",
        streamId: "pharmacy",
        status: "queued",
      }),
      stagesCompleted: [],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await caller.knowledge.getJob({
      jobId: "job-pharmacy",
      valueStreamId: "pharmacy",
    });

    expect(mocks.startJobWatcher).toHaveBeenCalledWith(
      "job-pharmacy",
      1,
      expect.objectContaining({ id: 1 }),
      "pharmacy"
    );
  });

  it("cancels a job within the selected stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      job: makeJob({
        id: "job-pharmacy",
        streamId: "pharmacy",
        status: "cancelled",
      }),
      stagesCompleted: ["extracting", "cleaning"],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const response = await caller.knowledge.cancelJob({
      jobId: "job-pharmacy",
      valueStreamId: "pharmacy",
    });

    expect(response.job.status).toBe("cancelled");
    expect(mocks.serviceJsonTyped).toHaveBeenCalledWith(
      "http://pipeline.test/v1/jobs/job-pharmacy/cancel",
      expect.objectContaining({
        scopes: ["pharmacy"],
        isGlobalScope: false,
      }),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects cancelling a job returned from another stream", async () => {
    mocks.serviceJsonTyped.mockResolvedValue({
      job: makeJob({
        id: "job-optical",
        streamId: "optical",
        status: "cancelled",
      }),
      stagesCompleted: [],
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.knowledge.cancelJob({
        jobId: "job-optical",
        valueStreamId: "pharmacy",
      })
    ).rejects.toThrow(/Job not found in selected value stream/);
  });
});
