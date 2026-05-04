import { TRPCError } from "@trpc/server";
import { isKbHermeticIsolationEnabled } from "./env";

type ValueStreamUserLike = {
  role?: string | null;
  valueStreams?: string | null;
};

export type ValueStreamAccessContext = {
  user?: ValueStreamUserLike | null;
  scopes?: string[];
  isGlobalScope?: boolean;
};

export function parseValueStreamScopes(raw?: string | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      String(raw)
        .split(",")
        .map(scope => scope.trim())
        .filter(Boolean)
    )
  );
}

function getContextScopes(ctx: ValueStreamAccessContext): string[] {
  if (ctx.scopes && ctx.scopes.length > 0) {
    return Array.from(
      new Set(ctx.scopes.map(scope => scope.trim()).filter(Boolean))
    );
  }

  return parseValueStreamScopes(ctx.user?.valueStreams);
}

export function resolveAuthorizedStreamId(
  ctx: ValueStreamAccessContext,
  requestedStreamId?: string | null,
  opts: { defaultToFirstScoped?: boolean; allowGlobalSelection?: boolean } = {}
): string | null {
  const scopes = getContextScopes(ctx);
  const hasGlobalScope = Boolean(
    ctx.user?.role === "admin" || ctx.isGlobalScope || scopes.includes("global")
  );
  const allowedStreams = scopes.filter(scope => scope && scope !== "global");
  const normalized = requestedStreamId?.trim();

  if (!normalized) {
    if (
      opts.defaultToFirstScoped &&
      !hasGlobalScope &&
      !isKbHermeticIsolationEnabled()
    ) {
      return allowedStreams[0] ?? null;
    }
    return null;
  }

  if (normalized === "global") {
    if (opts.allowGlobalSelection === false || !hasGlobalScope) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to the global knowledge scope",
      });
    }
    return "global";
  }

  if (hasGlobalScope || allowedStreams.includes(normalized)) {
    return normalized;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You do not have access to value stream "${normalized}"`,
  });
}

export function scopedRequestContext<T extends ValueStreamAccessContext>(
  ctx: T,
  streamId: string | null
): T {
  if (!streamId || streamId === "global") return ctx;
  return {
    ...ctx,
    scopes: [streamId],
    isGlobalScope: false,
  };
}

export function ensureManagerHasStreamAccess(
  ctx: ValueStreamAccessContext & { user: { role?: string | null } },
  valueStreamId: string
): void {
  const scopes = getContextScopes(ctx);
  if (
    ctx.user.role === "admin" ||
    ctx.isGlobalScope ||
    scopes.includes("global") ||
    scopes.includes(valueStreamId)
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You can only access your assigned value streams",
  });
}

export function requireAuthorizedStreamId(
  ctx: ValueStreamAccessContext,
  requestedStreamId?: string | null,
  opts: {
    defaultToFirstScoped?: boolean;
    allowGlobalSelection?: boolean;
    missingSelectionMessage?: string;
  } = {}
): string {
  const resolved = resolveAuthorizedStreamId(ctx, requestedStreamId, opts);
  if (resolved) {
    return resolved;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      opts.missingSelectionMessage ??
      "Select a value stream explicitly before continuing",
  });
}
