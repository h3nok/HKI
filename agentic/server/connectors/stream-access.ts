import { TRPCError } from "@trpc/server";
import { isKbHermeticIsolationEnabled } from "../_core/env";

import {
  parseValueStreamScopes,
  requireAuthorizedStreamId,
  resolveAuthorizedStreamId,
  type ValueStreamAccessContext,
} from "../_core/value-stream-access";

type ConnectorConfigLike = Record<string, unknown> | string | null | undefined;
type PersistedConnectorLike = {
  streamId?: string | null;
  config?: ConnectorConfigLike;
};

export function parseConnectorConfig(
  config: ConnectorConfigLike
): Record<string, unknown> {
  if (!config) return {};
  if (typeof config === "string") {
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return config;
}

export function getConnectorStreamId(
  config: ConnectorConfigLike
): string | null {
  const parsed = parseConnectorConfig(config);
  const streamId = parsed.streamId;
  return typeof streamId === "string" && streamId.trim()
    ? streamId.trim()
    : null;
}

export function resolvePersistedConnectorStreamId(
  connector: PersistedConnectorLike
): string | null {
  const streamId =
    typeof connector.streamId === "string" && connector.streamId.trim()
      ? connector.streamId.trim()
      : getConnectorStreamId(connector.config);

  if (!streamId || streamId === "global") {
    return null;
  }

  return streamId;
}

export function requireConnectorSelectionStreamId(
  ctx: ValueStreamAccessContext,
  streamId?: string | null,
  message = "Select a value stream for this connector"
): string {
  return requireAuthorizedStreamId(ctx, streamId, {
    allowGlobalSelection: false,
    missingSelectionMessage: message,
  });
}

export function requirePersistedConnectorStreamId(
  connector: PersistedConnectorLike,
  message = "Connector is missing a non-global value stream assignment"
): string {
  const streamId = resolvePersistedConnectorStreamId(connector);
  if (streamId) {
    return streamId;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

function hasGlobalConnectorAccess(ctx: ValueStreamAccessContext): boolean {
  const scopes =
    ctx.scopes && ctx.scopes.length > 0
      ? ctx.scopes
      : parseValueStreamScopes(ctx.user?.valueStreams);

  return Boolean(
    ctx.user?.role === "admin" || ctx.isGlobalScope || scopes.includes("global")
  );
}

export function ensureConnectorAccess(
  ctx: ValueStreamAccessContext,
  config: ConnectorConfigLike,
  message = "You do not have access to this connector"
): string | null {
  const streamId = getConnectorStreamId(config);
  if (!streamId) {
    if (hasGlobalConnectorAccess(ctx)) {
      return null;
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message,
    });
  }

  return resolveAuthorizedStreamId(ctx, streamId);
}

export function isConnectorVisibleToUser(
  ctx: ValueStreamAccessContext,
  config: ConnectorConfigLike
): boolean {
  try {
    ensureConnectorAccess(ctx, config);
    return true;
  } catch {
    return false;
  }
}

export function normalizeConnectorConfigStream<
  T extends Record<string, unknown> & {
    streamId?: unknown;
    streamName?: unknown;
  },
>(
  ctx: ValueStreamAccessContext,
  config: T,
  opts: { defaultToFirstScoped?: boolean } = {}
): T & { streamId?: string; streamName?: string } {
  const resolvedStreamId = resolveAuthorizedStreamId(
    ctx,
    typeof config.streamId === "string" ? config.streamId : undefined,
    {
      defaultToFirstScoped: opts.defaultToFirstScoped ?? true,
    }
  );

  if (!resolvedStreamId && isKbHermeticIsolationEnabled()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a value stream for this connector",
    });
  }

  return {
    ...config,
    streamId: resolvedStreamId ?? undefined,
    streamName:
      resolvedStreamId && typeof config.streamName === "string"
        ? config.streamName
        : undefined,
  };
}
