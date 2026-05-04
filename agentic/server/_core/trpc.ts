import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { hasPermission, type Permission, type Role } from "../auth/rbac";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

function parseValueStreamScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
}

function resolveScopedAccess(
  ctx: TrpcContext,
  options?: {
    enforceConfiguredScopeInProd?: boolean;
    missingScopeMessage?: string;
  }
) {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const isAdmin = ctx.user.role === "admin";
  const parsedScopes = parseValueStreamScopes(ctx.user.valueStreams);
  const isProd = process.env.NODE_ENV === "production";

  if (
    options?.enforceConfiguredScopeInProd &&
    !isAdmin &&
    parsedScopes.length === 0 &&
    isProd
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        options?.missingScopeMessage ??
        "No value stream access is configured for this account",
    });
  }

  const scopes: string[] = isAdmin
    ? ["global"]
    : parsedScopes.length > 0
      ? parsedScopes
      : ["global"];

  return {
    user: ctx.user,
    scopes,
    isGlobalScope: isAdmin || scopes.includes("global"),
  };
}

function createScopedPermissionProcedure(
  permission: Permission,
  message: string
) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: UNAUTHED_ERR_MSG,
        });
      }

      if (!hasPermission(ctx.user.role as Role, permission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message,
        });
      }

      const scoped = resolveScopedAccess(ctx, {
        enforceConfiguredScopeInProd: true,
        missingScopeMessage:
          "No value stream access is configured for this account",
      });

      return next({
        ctx: {
          ...ctx,
          ...scoped,
        },
      });
    })
  );
}

/**
 * Scope-aware procedure — injects parsed value streams into context.
 * Routes using this can check ctx.scopes to filter data by business domain.
 */
const injectScopes = t.middleware(async opts => {
  const { ctx, next } = opts;
  const scoped = resolveScopedAccess(ctx);

  return next({
    ctx: {
      ...ctx,
      ...scoped,
    },
  });
});

export const scopedProcedure = t.procedure.use(injectScopes);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * Requires manager or admin role, and injects value stream scopes into context.
 * Used for knowledge self-service and other elevated operations.
 * ctx.scopes and ctx.isGlobalScope are always populated for downstream use.
 */
export const managerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const allowed = ["admin", "manager"];

    if (!ctx.user || !allowed.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This action requires at least a manager role",
      });
    }

    const scoped = resolveScopedAccess(ctx, {
      enforceConfiguredScopeInProd: true,
      missingScopeMessage:
        "No value stream access is configured for this manager account",
    });

    return next({
      ctx: {
        ...ctx,
        ...scoped,
      },
    });
  })
);

export const knowledgeReadProcedure = createScopedPermissionProcedure(
  "knowledge:read",
  "This action requires knowledge access"
);

export const knowledgeWriteProcedure = createScopedPermissionProcedure(
  "knowledge:write",
  "This action requires knowledge write access"
);

export const knowledgeManageProcedure = createScopedPermissionProcedure(
  "knowledge:manage",
  "This action requires knowledge management access"
);
