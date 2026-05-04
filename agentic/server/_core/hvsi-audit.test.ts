import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  knowledgeContributions,
  knowledgeDocumentImpact,
} from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
}));

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

describe("buildLocalHvsiAuditStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KB_HERMETIC_ISOLATION;
  });

  it("returns ready when strict mode is disabled", async () => {
    const { buildLocalHvsiAuditStatus } = await import("./hvsi-audit");

    const result = await buildLocalHvsiAuditStatus();

    expect(result).toMatchObject({
      enabled: false,
      ready: true,
      issues: {},
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("fails closed when strict mode is enabled and the database is unavailable", async () => {
    process.env.KB_HERMETIC_ISOLATION = "true";
    mocks.getDb.mockResolvedValue(null);

    const { buildAgenticReadinessPayload, buildLocalHvsiAuditStatus } =
      await import("./hvsi-audit");

    const audit = await buildLocalHvsiAuditStatus();
    const readiness = await buildAgenticReadinessPayload();

    expect(audit).toMatchObject({
      enabled: true,
      ready: false,
      issues: { database_unavailable: 1 },
    });
    expect(readiness).toMatchObject({
      status: "blocked",
      service: "agentic",
      hvsi: expect.objectContaining({ ready: false }),
    });
  });

  it("reports legacy null-stream rows when strict mode is enabled", async () => {
    process.env.KB_HERMETIC_ISOLATION = "true";
    mocks.getDb.mockResolvedValue(
      makeAuditDb({ contributions: 2, documentImpact: 1 })
    );

    const { buildLocalHvsiAuditStatus } = await import("./hvsi-audit");

    const result = await buildLocalHvsiAuditStatus();

    expect(result).toMatchObject({
      enabled: true,
      ready: false,
      issues: {
        contributions_missing_stream: 2,
        document_impact_missing_stream: 1,
      },
    });
    expect(result.summary).toContain("contributions_missing_stream=2");
    expect(result.summary).toContain("document_impact_missing_stream=1");
  });
});
