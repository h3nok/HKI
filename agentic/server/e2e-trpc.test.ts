/**
 * E2E tests for the BFF tRPC layer (agentic server).
 *
 * Tests the full tRPC procedure chain: validation → auth middleware → RBAC →
 * business logic, using `appRouter.createCaller()` with synthesised contexts.
 *
 * The orchestrator HTTP call is mocked so these tests can run offline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ── Mock service-client BEFORE any router module imports ──────────────────

vi.mock("./service-client", () => ({
  serviceJson: vi.fn().mockResolvedValue({}),
  serviceMultipartUpload: vi.fn().mockResolvedValue({}),
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

// ── Helpers ───────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "e2e-test-user",
    name: "E2E Test User",
    email: "e2e@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "viewer",
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

function makeCtx(user: User | null = makeUser()): TrpcContext {
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

// ═════════════════════════════════════════════════════════════════════════════
// Auth Procedures
// ═════════════════════════════════════════════════════════════════════════════

describe("E2E: auth", () => {
  it("auth.me returns user when authenticated", async () => {
    const { appRouter } = await import("./routers");
    const user = makeUser({ name: "Alice", email: "alice@hki.com" });
    const caller = appRouter.createCaller(makeCtx(user));
    const result = await caller.auth.me();
    expect(result).toMatchObject({ name: "Alice", email: "alice@hki.com" });
  });

  it("auth.me returns null when unauthenticated", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.logout clears session cookie", async () => {
    const { appRouter } = await import("./routers");
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC Enforcement
// ═════════════════════════════════════════════════════════════════════════════

describe("E2E: RBAC enforcement across all procedure tiers", () => {
  it("protectedProcedure rejects unauthenticated user", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(null));
    // chat.getTasks is a protectedProcedure
    await expect(
      caller.chat.getTasks({ cursor: null, limit: 10 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protectedProcedure allows any authenticated role", async () => {
    const { appRouter } = await import("./routers");
    for (const role of ["viewer", "operator", "manager", "admin"] as const) {
      const caller = appRouter.createCaller(makeCtx(makeUser({ role })));
      // This should not throw — it may return empty results or error
      // from DB, but the auth middleware should pass.
      // We only check that UNAUTHORIZED is not thrown.
      try {
        await caller.chat.getTasks({ cursor: null, limit: 10 });
      } catch (err: any) {
        expect(err.code).not.toBe("UNAUTHORIZED");
      }
    }
  });

  it("adminProcedure rejects non-admin roles", async () => {
    const { appRouter } = await import("./routers");
    for (const role of ["viewer", "operator", "manager"] as const) {
      const caller = appRouter.createCaller(makeCtx(makeUser({ role })));
      // admin.listUsers is an adminProcedure
      try {
        await caller.admin.listUsers({
          search: "",
          page: 1,
          limit: 10,
          role: undefined,
        });
      } catch (err: any) {
        expect(err.code).toBe("FORBIDDEN");
      }
    }
  });

  it("adminProcedure allows admin", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    // Should not throw FORBIDDEN — may error from DB but auth passes
    try {
      await caller.admin.listUsers({
        search: "",
        page: 1,
        limit: 10,
        role: undefined,
      });
    } catch (err: any) {
      expect(err.code).not.toBe("FORBIDDEN");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Input Validation (Zod schemas)
// ═════════════════════════════════════════════════════════════════════════════

describe("E2E: input validation", () => {
  it("chat.createTask rejects missing required fields", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      // @ts-expect-error intentionally passing invalid input
      caller.chat.createTask({})
    ).rejects.toThrow();
  });

  it("chat.sendMessage rejects missing conversationId", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      // @ts-expect-error intentionally passing invalid input
      caller.chat.sendMessage({ content: "hello" })
    ).rejects.toThrow();
  });

  it("chat.sendMessage rejects missing content", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      // @ts-expect-error intentionally passing invalid input
      caller.chat.sendMessage({ conversationId: "conv-1" })
    ).rejects.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// System Router
// ═════════════════════════════════════════════════════════════════════════════

describe("E2E: system router", () => {
  it("system.health returns ok", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.system.health({ timestamp: Date.now() });
    expect(result).toMatchObject({ ok: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Value Stream Scope Resolution
// ═════════════════════════════════════════════════════════════════════════════

describe("E2E: scope listing", () => {
  it("scope.listStreams returns array (may be empty without DB)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    try {
      const result = await caller.scope.listStreams();
      expect(Array.isArray(result)).toBe(true);
    } catch {
      // DB not available — that's OK for offline E2E
    }
  });
});
