/**
 * Request JWT — Short-lived signed tokens for service-to-service calls.
 *
 * The BFF mints a request JWT (HS256, 30s TTL) before every downstream
 * call. It carries the authenticated user's identity and scope claims
 * so downstream services can validate + authorize without hitting the DB.
 *
 * Signing key: SERVICE_AUTH_SECRET (separate from JWT_SECRET for session cookies).
 * In K8s this comes from a Secret; locally it falls back to JWT_SECRET.
 */

import { SignJWT } from "jose";
import type { User } from "../../drizzle/schema";
import { isKbHermeticIsolationEnabled } from "../_core/env";
import { resolveRuntimeScope } from "../_core/hki-scope";

const REQUEST_JWT_TTL_SECONDS = 30;
const ISSUER = "agentic-bff";
const AUDIENCE = "internal-services";

/** Prefers SERVICE_AUTH_SECRET; falls back to JWT_SECRET for local dev. */
function getSigningKey(): Uint8Array {
  const secret = process.env.SERVICE_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "[Auth] Neither SERVICE_AUTH_SECRET nor JWT_SECRET is configured"
    );
  }
  return new TextEncoder().encode(secret);
}

export interface RequestJwtPayload {
  sub: string;
  name: string;
  role: string;
  org_id: string;
  scope: string;
  scopes: string[];
  groups: string[];
  stream_id?: string;
}

function normalizePrincipalToken(value: string): string {
  return value.trim().toLowerCase();
}

function collectRequestGroups(user: User): string[] {
  const groups = new Set<string>();

  const role = normalizePrincipalToken(String(user.role || "viewer"));
  if (role) groups.add(`role:${role}`);

  const department = String(user.department || "").trim();
  if (department) {
    groups.add(`department:${normalizePrincipalToken(department)}`);
  }

  const candidateFields = [
    (user as User & { groups?: unknown }).groups,
    (user as User & { securityGroups?: unknown }).securityGroups,
    (user as User & { aclGroups?: unknown }).aclGroups,
  ];

  for (const candidate of candidateFields) {
    if (!candidate) continue;
    const rawValues = Array.isArray(candidate)
      ? candidate
      : String(candidate)
          .split(",")
          .map(value => value.trim())
          .filter(Boolean);
    for (const rawValue of rawValues) {
      const normalized = normalizePrincipalToken(String(rawValue));
      if (normalized) groups.add(normalized);
    }
  }

  return Array.from(groups);
}

/** Mint a short-lived request JWT for a downstream service call. */
export async function signRequestJwt(
  user: User,
  scope?: string,
  scopes?: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const runtimeScope = resolveRuntimeScope({
    scope,
    scopes,
    hermetic: isKbHermeticIsolationEnabled(),
  });

  return new SignJWT({
    sub: String(user.id),
    name: user.name || "",
    role: user.role || "viewer",
    org_id: user.orgId || "default",
    scope: runtimeScope.scope,
    scopes: runtimeScope.scopes,
    groups: collectRequestGroups(user),
    stream_id: runtimeScope.streamId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + REQUEST_JWT_TTL_SECONDS)
    .sign(getSigningKey());
}
