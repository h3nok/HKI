import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import {
  auditLog,
  featureFlagOverrides,
  featureFlagPresets,
} from "../drizzle/schema";
import {
  FEATURE_FLAG_DEFINITIONS,
  getFeatureFlagPreset,
} from "@shared/feature-flags";

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

function makeAdminUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    openId: "admin-feature-flags-test",
    name: "Admin Test User",
    email: "admin.test@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "admin",
    department: null,
    orgId: "hki",
    valueStreams: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: User = makeAdminUser()): TrpcContext {
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

function createDbMock() {
  const overrideUpserts: unknown[] = [];
  const auditEntries: unknown[] = [];
  const deleteCalls: unknown[] = [];
  const presetInserts: unknown[] = [];

  const db = {
    select: vi.fn(),
    insert: vi.fn((table: unknown) => {
      if (table === featureFlagOverrides) {
        return {
          values: vi.fn((values: unknown) => {
            overrideUpserts.push(values);
            return {
              onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
            };
          }),
        };
      }

      if (table === auditLog) {
        return {
          values: vi.fn(async (values: unknown) => {
            auditEntries.push(values);
          }),
        };
      }

      if (table === featureFlagPresets) {
        return {
          values: vi.fn(async (values: unknown) => {
            presetInserts.push(values);
          }),
        };
      }

      return {
        values: vi.fn().mockResolvedValue(undefined),
      };
    }),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async () => {
        deleteCalls.push(table);
      }),
    })),
  };

  return {
    db,
    overrideUpserts,
    auditEntries,
    deleteCalls,
    presetInserts,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin feature flags", () => {
  it("lists evaluated feature flags with override metadata", async () => {
    const overrideUpdatedAt = new Date("2026-04-13T12:00:00.000Z");
    const { db } = createDbMock();

    db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            featureKey: "release.knowledge.ingest.textPaste",
            enabled: 1,
            updatedAt: overrideUpdatedAt,
            updatedBy: 42,
          },
        ]),
      })),
    });

    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.admin.listFeatureFlags();

    const textPaste = result.find(
      item => item.key === "release.knowledge.ingest.textPaste"
    );

    expect(result).toHaveLength(FEATURE_FLAG_DEFINITIONS.length);
    expect(textPaste).toMatchObject({
      effectiveEnabled: true,
      updatedBy: 42,
      updatedAt: overrideUpdatedAt.toISOString(),
    });
  });

  it("persists an admin-editable override and records an audit entry", async () => {
    const { db, overrideUpserts, auditEntries } = createDbMock();
    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.setFeatureFlagOverride({
      featureKey: "debug.chat.activityPanel",
      enabled: true,
    });

    expect(result).toEqual({ success: true });
    expect(overrideUpserts).toHaveLength(1);
    expect(overrideUpserts[0]).toMatchObject({
      orgId: "hki",
      featureKey: "debug.chat.activityPanel",
      enabled: 1,
      updatedBy: 7,
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: "feature_flag_override_set",
      targetId: "debug.chat.activityPanel",
      actorId: 7,
    });
  });

  it("resets an override and records an audit entry", async () => {
    const { db, auditEntries, deleteCalls } = createDbMock();
    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.resetFeatureFlagOverride({
      featureKey: "debug.chat.activityPanel",
    });

    expect(result).toEqual({ success: true });
    expect(deleteCalls).toContain(featureFlagOverrides);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: "feature_flag_override_reset",
      targetId: "debug.chat.activityPanel",
      actorId: 7,
    });
  });

  it("applies a preset across the entire feature inventory and records an audit entry", async () => {
    const preset = getFeatureFlagPreset("mvp.first");
    const { db, auditEntries, deleteCalls, overrideUpserts } = createDbMock();

    db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "preset-1",
              sourceTemplateKey: preset.key,
              name: preset.label,
              overrides: JSON.stringify(preset.overrides),
            },
          ]),
        })),
      })),
    });

    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.applyFeatureFlagPreset({
      presetId: "preset-1",
    });

    const featureOverrideDeletes = deleteCalls.filter(
      table => table === featureFlagOverrides
    ).length;

    expect(result).toEqual({ success: true, presetId: "preset-1" });
    expect(overrideUpserts.length + featureOverrideDeletes).toBe(
      FEATURE_FLAG_DEFINITIONS.length
    );
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: "feature_flag_preset_apply",
      targetId: "preset-1",
      actorId: 7,
    });
  });

  it("deletes a custom preset and records an audit entry", async () => {
    const { db, auditEntries, deleteCalls } = createDbMock();

    db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "preset-custom-1",
              name: "Temporary rollout",
              sourceTemplateKey: null,
            },
          ]),
        })),
      })),
    });

    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.admin.deleteFeatureFlagPreset({
      presetId: "preset-custom-1",
    });

    expect(result).toEqual({ success: true, presetId: "preset-custom-1" });
    expect(deleteCalls).toContain(featureFlagPresets);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      action: "feature_flag_preset_delete",
      targetId: "preset-custom-1",
      actorId: 7,
    });
  });

  it("blocks deletion of seeded template presets", async () => {
    const preset = getFeatureFlagPreset("mvp.first");
    const { db, deleteCalls, auditEntries } = createDbMock();

    db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              id: "preset-template-1",
              name: preset.label,
              sourceTemplateKey: preset.key,
            },
          ]),
        })),
      })),
    });

    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());

    await expect(
      caller.admin.deleteFeatureFlagPreset({
        presetId: "preset-template-1",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Template presets cannot be deleted",
    });

    expect(deleteCalls).not.toContain(featureFlagPresets);
    expect(auditEntries).toHaveLength(0);
  });

  it("backfills missing template presets for orgs seeded before new templates were added", async () => {
    const firstPreset = getFeatureFlagPreset("mvp.first");
    const curatedPreset = getFeatureFlagPreset("mvp.curated");
    const fullPreset = getFeatureFlagPreset("beta.full");
    const { db, presetInserts } = createDbMock();

    db.select
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValue([
              { sourceTemplateKey: "mvp.first" },
              { sourceTemplateKey: "mvp.curated" },
            ]),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "preset-1",
                sourceTemplateKey: firstPreset.key,
                name: firstPreset.label,
                description: firstPreset.description,
                overrides: JSON.stringify(firstPreset.overrides),
                updatedAt: new Date("2026-04-16T13:00:00.000Z"),
                updatedBy: null,
              },
              {
                id: "preset-2",
                sourceTemplateKey: curatedPreset.key,
                name: curatedPreset.label,
                description: curatedPreset.description,
                overrides: JSON.stringify(curatedPreset.overrides),
                updatedAt: new Date("2026-04-16T13:00:00.000Z"),
                updatedBy: null,
              },
              {
                id: "preset-3",
                sourceTemplateKey: fullPreset.key,
                name: fullPreset.label,
                description: fullPreset.description,
                overrides: JSON.stringify(fullPreset.overrides),
                updatedAt: new Date("2026-04-16T13:00:00.000Z"),
                updatedBy: null,
              },
            ]),
          })),
        })),
      });

    mocks.getDb.mockResolvedValue(db);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.admin.listFeatureFlagPresets();

    expect(result.map(item => item.sourceTemplateKey)).toEqual([
      "mvp.first",
      "mvp.curated",
      "beta.full",
    ]);
    expect(presetInserts).toHaveLength(1);
    expect(presetInserts[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orgId: "hki",
          sourceTemplateKey: "beta.full",
          name: fullPreset.label,
        }),
      ])
    );
  });
});
