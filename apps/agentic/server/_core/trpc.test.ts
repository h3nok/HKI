import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  knowledgeManageProcedure,
  knowledgeReadProcedure,
  knowledgeWriteProcedure,
  managerProcedure,
  scopedProcedure,
  router,
} from "./trpc";
import { UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG } from "@shared/const";
import type { TrpcContext } from "./context";
import type { User } from "../../drizzle/schema";

// ─── Minimal test router ─────────────────────────────────────────────────────

/**
 * Each procedure returns whatever it can observe from ctx so we can assert
 * on role enforcement and scope injection without touching the real app router.
 */
const testRouter = router({
  adminCheck: adminProcedure.query(({ ctx }) => ({
    role: ctx.user.role,
  })),

  managerCheck: managerProcedure.query(({ ctx }) => ({
    // scopes / isGlobalScope are injected by the middleware into the extended ctx
    scopes: (ctx as any).scopes as string[],
    isGlobalScope: (ctx as any).isGlobalScope as boolean,
    role: ctx.user.role,
  })),

  knowledgeReadCheck: knowledgeReadProcedure.query(({ ctx }) => ({
    scopes: (ctx as any).scopes as string[],
    isGlobalScope: (ctx as any).isGlobalScope as boolean,
    role: ctx.user.role,
  })),

  knowledgeWriteCheck: knowledgeWriteProcedure.query(({ ctx }) => ({
    scopes: (ctx as any).scopes as string[],
    isGlobalScope: (ctx as any).isGlobalScope as boolean,
    role: ctx.user.role,
  })),

  knowledgeManageCheck: knowledgeManageProcedure.query(({ ctx }) => ({
    scopes: (ctx as any).scopes as string[],
    isGlobalScope: (ctx as any).isGlobalScope as boolean,
    role: ctx.user.role,
  })),

  scopedCheck: scopedProcedure.query(({ ctx }) => ({
    scopes: (ctx as any).scopes as string[],
    isGlobalScope: (ctx as any).isGlobalScope as boolean,
  })),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-user",
    name: "Test User",
    email: "test@hki.com",
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

function makeCtx(user: User | null): TrpcContext {
  return {
    user,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

async function expectForbidden(fn: () => Promise<unknown>) {
  await expect(fn()).rejects.toMatchObject({ code: "FORBIDDEN" });
}

async function expectUnauthorized(fn: () => Promise<unknown>) {
  await expect(fn()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
}

// ─── adminProcedure ───────────────────────────────────────────────────────────

describe("adminProcedure", () => {
  it("allows admin through", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "admin" }))
    );
    await expect(caller.adminCheck()).resolves.toEqual({ role: "admin" });
  });

  it("rejects manager with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "manager" }))
    );
    await expectForbidden(() => caller.adminCheck());
  });

  it("rejects operator with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator" }))
    );
    await expectForbidden(() => caller.adminCheck());
  });

  it("rejects viewer with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "viewer" }))
    );
    await expectForbidden(() => caller.adminCheck());
  });

  it("rejects unauthenticated request with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(makeCtx(null));
    await expectForbidden(() => caller.adminCheck());
  });

  it("includes the expected error message", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "viewer" }))
    );
    await expect(caller.adminCheck()).rejects.toMatchObject({
      message: NOT_ADMIN_ERR_MSG,
    });
  });
});

// ─── managerProcedure ─────────────────────────────────────────────────────────

describe("managerProcedure", () => {
  describe("role enforcement", () => {
    it("allows manager through", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "manager" }))
      );
      await expect(caller.managerCheck()).resolves.toMatchObject({
        role: "manager",
      });
    });

    it("allows admin through", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "admin" }))
      );
      await expect(caller.managerCheck()).resolves.toMatchObject({
        role: "admin",
      });
    });

    it("rejects operator with FORBIDDEN", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "operator" }))
      );
      await expectForbidden(() => caller.managerCheck());
    });

    it("rejects viewer with FORBIDDEN", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "viewer" }))
      );
      await expectForbidden(() => caller.managerCheck());
    });

    it("rejects unauthenticated request with FORBIDDEN", async () => {
      const caller = testRouter.createCaller(makeCtx(null));
      await expectForbidden(() => caller.managerCheck());
    });
  });

  describe("scope injection", () => {
    it("admin always gets global scope regardless of valueStreams", async () => {
      const caller = testRouter.createCaller(
        makeCtx(
          makeUser({ role: "admin", valueStreams: "pharmacy,fresh-foods" })
        )
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["global"]);
      expect(result.isGlobalScope).toBe(true);
    });

    it("manager with no valueStreams falls back to global scope outside production", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "manager", valueStreams: null }))
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["global"]);
      expect(result.isGlobalScope).toBe(true);
    });

    it("manager with no valueStreams is rejected in production", async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "manager", valueStreams: null }))
      );
      try {
        await expectForbidden(() => caller.managerCheck());
        await expect(caller.managerCheck()).rejects.toMatchObject({
          message:
            "No value stream access is configured for this manager account",
        });
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    it("manager with assigned streams receives exactly those scopes", async () => {
      const caller = testRouter.createCaller(
        makeCtx(
          makeUser({ role: "manager", valueStreams: "pharmacy,fresh-foods" })
        )
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["pharmacy", "fresh-foods"]);
      expect(result.isGlobalScope).toBe(false);
    });

    it("trims whitespace around stream names", async () => {
      const caller = testRouter.createCaller(
        makeCtx(
          makeUser({
            role: "manager",
            valueStreams: " pharmacy , fresh-foods ",
          })
        )
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["pharmacy", "fresh-foods"]);
    });

    it("filters out empty segments from malformed valueStreams", async () => {
      const caller = testRouter.createCaller(
        makeCtx(
          makeUser({ role: "manager", valueStreams: "pharmacy,,fresh-foods" })
        )
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["pharmacy", "fresh-foods"]);
    });

    it('manager with only the "global" stream gets isGlobalScope=true', async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "manager", valueStreams: "global" }))
      );
      const result = await caller.managerCheck();
      expect(result.isGlobalScope).toBe(true);
    });

    it("manager scoped to a single stream is not global", async () => {
      const caller = testRouter.createCaller(
        makeCtx(makeUser({ role: "manager", valueStreams: "optical" }))
      );
      const result = await caller.managerCheck();
      expect(result.scopes).toEqual(["optical"]);
      expect(result.isGlobalScope).toBe(false);
    });
  });
});

describe("knowledge permission procedures", () => {
  it("rejects viewer from knowledgeReadProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "viewer", valueStreams: "pharmacy" }))
    );
    await expectForbidden(() => caller.knowledgeReadCheck());
  });

  it("allows operator through knowledgeReadProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: "pharmacy" }))
    );
    await expect(caller.knowledgeReadCheck()).resolves.toMatchObject({
      role: "operator",
      scopes: ["pharmacy"],
    });
  });

  it("rejects viewer from knowledgeWriteProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "viewer", valueStreams: "pharmacy" }))
    );
    await expectForbidden(() => caller.knowledgeWriteCheck());
  });

  it("allows operator through knowledgeWriteProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: "pharmacy" }))
    );
    await expect(caller.knowledgeWriteCheck()).resolves.toMatchObject({
      role: "operator",
      scopes: ["pharmacy"],
    });
  });

  it("rejects operator from knowledgeManageProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: "pharmacy" }))
    );
    await expectForbidden(() => caller.knowledgeManageCheck());
  });

  it("allows manager through knowledgeManageProcedure", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "manager", valueStreams: "pharmacy" }))
    );
    await expect(caller.knowledgeManageCheck()).resolves.toMatchObject({
      role: "manager",
      scopes: ["pharmacy"],
    });
  });

  it("rejects knowledgeReadProcedure in production when no scopes are configured", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: null }))
    );
    try {
      await expectForbidden(() => caller.knowledgeReadCheck());
      await expect(caller.knowledgeReadCheck()).rejects.toMatchObject({
        message: "No value stream access is configured for this account",
      });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

// ─── scopedProcedure ─────────────────────────────────────────────────────────

describe("scopedProcedure", () => {
  it("rejects unauthenticated request with UNAUTHORIZED", async () => {
    const caller = testRouter.createCaller(makeCtx(null));
    await expectUnauthorized(() => caller.scopedCheck());
  });

  it("rejects unauthenticated request with expected message", async () => {
    const caller = testRouter.createCaller(makeCtx(null));
    await expect(caller.scopedCheck()).rejects.toMatchObject({
      message: UNAUTHED_ERR_MSG,
    });
  });

  it("admin gets global scope", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "admin", valueStreams: "pharmacy" }))
    );
    const result = await caller.scopedCheck();
    expect(result.scopes).toEqual(["global"]);
    expect(result.isGlobalScope).toBe(true);
  });

  it("non-admin with assigned streams receives those scopes", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: "pharmacy,optical" }))
    );
    const result = await caller.scopedCheck();
    expect(result.scopes).toEqual(["pharmacy", "optical"]);
    expect(result.isGlobalScope).toBe(false);
  });

  it("non-admin with no valueStreams falls back to global scope", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "operator", valueStreams: null }))
    );
    const result = await caller.scopedCheck();
    expect(result.scopes).toEqual(["global"]);
    expect(result.isGlobalScope).toBe(true);
  });

  it("viewer can access a scoped procedure (no role restriction on scopedProcedure)", async () => {
    const caller = testRouter.createCaller(
      makeCtx(makeUser({ role: "viewer", valueStreams: "pharmacy" }))
    );
    await expect(caller.scopedCheck()).resolves.toMatchObject({
      scopes: ["pharmacy"],
    });
  });
});
