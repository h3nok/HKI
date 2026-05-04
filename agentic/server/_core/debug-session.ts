import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./cookies";

export const DEBUG_SESSION_COOKIE_NAME = "__agentic_debug_session";
export const DEFAULT_DEBUG_SESSION_MINUTES = 30;
export const MIN_DEBUG_SESSION_MINUTES = 15;
export const MAX_DEBUG_SESSION_MINUTES = 60;

type DebugSessionPayload = {
  sub: string;
  orgId: string;
  durationMinutes: number;
  iat?: number;
  exp?: number;
};

export type DebugSessionState = {
  active: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  minutesRemaining: number;
  durationMinutes: number | null;
  reason: "active" | "missing" | "expired" | "invalid" | "user-mismatch";
};

const DEBUG_SESSION_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-jwt-secret-change-me"
);

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;

  for (const token of header.split(";")) {
    const [rawKey, ...rawValue] = token.trim().split("=");
    if (rawKey !== name) continue;
    return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

function toIsoString(value: number | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function normalizeDurationMinutes(durationMinutes?: number): number {
  const value = Math.floor(durationMinutes ?? DEFAULT_DEBUG_SESSION_MINUTES);
  return Math.min(
    MAX_DEBUG_SESSION_MINUTES,
    Math.max(MIN_DEBUG_SESSION_MINUTES, value)
  );
}

function buildClearCookieOptions(req: Request) {
  const cookieOptions = getSessionCookieOptions(req);
  const clearOptions = [
    {
      ...cookieOptions,
      expires: new Date(0),
      maxAge: -1,
    },
  ];

  if (cookieOptions.domain) {
    const { domain: _domain, ...hostOnlyOptions } = cookieOptions;
    clearOptions.push({
      ...hostOnlyOptions,
      expires: new Date(0),
      maxAge: -1,
    });
  }

  return clearOptions;
}

export async function issueDebugSession(options: {
  req: Request;
  res: Response;
  userId: number;
  orgId: string;
  durationMinutes?: number;
}): Promise<DebugSessionState> {
  const durationMinutes = normalizeDurationMinutes(options.durationMinutes);
  const token = await new SignJWT({
    orgId: options.orgId,
    durationMinutes,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(options.userId))
    .setIssuedAt()
    .setExpirationTime(`${durationMinutes}m`)
    .sign(DEBUG_SESSION_SECRET);

  const maxAge = durationMinutes * 60 * 1000;
  options.res.cookie(DEBUG_SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(options.req),
    maxAge,
  });

  const nowMs = Date.now();
  return {
    active: true,
    startedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + maxAge).toISOString(),
    minutesRemaining: durationMinutes,
    durationMinutes,
    reason: "active",
  };
}

export function clearDebugSessionCookie(req: Request, res: Response): void {
  for (const cookieOptions of buildClearCookieOptions(req)) {
    res.clearCookie(DEBUG_SESSION_COOKIE_NAME, cookieOptions);
  }
}

export async function getDebugSessionState(options: {
  req: Request;
  expectedUserId: number;
  expectedOrgId: string;
}): Promise<DebugSessionState> {
  const rawToken = parseCookie(
    options.req.headers.cookie,
    DEBUG_SESSION_COOKIE_NAME
  );
  if (!rawToken) {
    return {
      active: false,
      startedAt: null,
      expiresAt: null,
      minutesRemaining: 0,
      durationMinutes: null,
      reason: "missing",
    };
  }

  try {
    const { payload } = await jwtVerify(rawToken, DEBUG_SESSION_SECRET, {
      algorithms: ["HS256"],
    });
    const sessionPayload = payload as unknown as DebugSessionPayload;

    if (
      sessionPayload.sub !== String(options.expectedUserId) ||
      sessionPayload.orgId !== options.expectedOrgId
    ) {
      return {
        active: false,
        startedAt: null,
        expiresAt: null,
        minutesRemaining: 0,
        durationMinutes: null,
        reason: "user-mismatch",
      };
    }

    const expMs =
      typeof sessionPayload.exp === "number" ? sessionPayload.exp * 1000 : 0;
    const remainingMs = Math.max(expMs - Date.now(), 0);

    return {
      active: true,
      startedAt: toIsoString(sessionPayload.iat),
      expiresAt: toIsoString(sessionPayload.exp),
      minutesRemaining: Math.max(1, Math.ceil(remainingMs / 60_000)),
      durationMinutes: sessionPayload.durationMinutes ?? null,
      reason: "active",
    };
  } catch (error: any) {
    const reason = error?.code === "ERR_JWT_EXPIRED" ? "expired" : "invalid";
    return {
      active: false,
      startedAt: null,
      expiresAt: null,
      minutesRemaining: 0,
      durationMinutes: null,
      reason,
    };
  }
}
