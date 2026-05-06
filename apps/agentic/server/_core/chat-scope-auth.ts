import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { valueStreams } from "../../drizzle/schema";
import { parseValueStreamScopes } from "./value-stream-access";

type ChatScopeUserLike = {
  role?: string | null;
  valueStreams?: string | null;
};

function parseChatScopeList(raw?: string | null): string[] {
  return parseValueStreamScopes(raw);
}

export async function getAllowedChatScopes(
  user: ChatScopeUserLike,
  db: {
    select: (...args: any[]) => any;
  } | null,
  requestedScope?: string
): Promise<string[]> {
  if (user.role === "admin") {
    if (!db) {
      return Array.from(
        new Set([
          ...parseChatScopeList(user.valueStreams),
          ...(requestedScope ? [requestedScope.trim()] : []),
          "global",
        ])
      );
    }

    const rows = await db
      .select({ id: valueStreams.id })
      .from(valueStreams)
      .where(eq(valueStreams.isActive, 1));

    return Array.from(new Set(rows.map((row: { id: string }) => row.id)));
  }

  return parseChatScopeList(user.valueStreams);
}

export function canAccessChatScope(
  scope: string | null | undefined,
  allowedScopes: string[]
): boolean {
  const normalizedScope = scope?.trim();
  if (!normalizedScope) return false;
  return allowedScopes.includes(normalizedScope);
}

export function assertAuthorizedChatScope(
  scope: string | null | undefined,
  allowedScopes: string[],
  message = "You do not have access to this conversation's value stream"
): string {
  const normalizedScope = scope?.trim();
  if (normalizedScope && canAccessChatScope(normalizedScope, allowedScopes)) {
    return normalizedScope;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

export function resolveRequestedChatScope(
  requestedScope: string | undefined,
  allowedScopes: string[]
): string {
  const normalizedScope = requestedScope?.trim();
  if (!normalizedScope) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a value stream before starting a chat",
    });
  }
  return assertAuthorizedChatScope(
    normalizedScope,
    allowedScopes,
    `You do not have access to chat stream "${normalizedScope}"`
  );
}
