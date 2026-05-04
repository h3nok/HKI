import { OAuth2Client } from "google-auth-library";
import { createLogger } from "../_core/logger";
import { ENV } from "../_core/env";

const log = createLogger("google-oauth");

// Google OAuth Configuration — fail fast on missing credentials in production
const _clientId = process.env.GOOGLE_CLIENT_ID;
const _clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (process.env.NODE_ENV === "production" && (!_clientId || !_clientSecret)) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in production. " +
      "Configure these environment variables before deploying."
  );
}

export const GOOGLE_OAUTH_CONFIG = {
  clientId: _clientId || "__GOOGLE_CLIENT_ID_NOT_SET__",
  clientSecret: _clientSecret || "__GOOGLE_CLIENT_SECRET_NOT_SET__",
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${ENV.baseUrl}/api/auth/google/callback`,
  pngIdField: process.env.PNG_ID_FIELD || "employeeId",
  allowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN || "hki.com",
};

// Debug logging for OAuth configuration
log.info(
  {
    baseUrl: ENV.baseUrl,
    redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
    clientIdSet: !!_clientId,
    googleRedirectUriEnv: process.env.GOOGLE_REDIRECT_URI || "(not set)",
  },
  "OAuth Configuration initialized"
);

/**
 * Dev bypass — requires BOTH conditions:
 *   1. NODE_ENV === 'development'
 *   2. DEV_BYPASS env var explicitly set to 'true'
 * This prevents accidental bypass in staging/production.
 */
export const DEV_BYPASS = {
  enabled:
    process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true",
  mockUser: {
    openId: "dev-user-123",
    name: "Henok Ghebrechristos",
    email: "hghebrechristos@hki.com",
    pngId: "PNG12345",
    role: "admin" as const,
    department: "Innovation Lab",
    orgId: "hki",
  },
};

export const googleOAuthClient = new OAuth2Client(
  GOOGLE_OAUTH_CONFIG.clientId,
  GOOGLE_OAUTH_CONFIG.clientSecret,
  GOOGLE_OAUTH_CONFIG.redirectUri
);

export function getGoogleAuthUrl(): string {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  return googleOAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string) {
  const { tokens } = await googleOAuthClient.getToken(code);
  googleOAuthClient.setCredentials(tokens);
  return tokens;
}

export async function getGoogleUserProfile(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user profile from Google");
  }

  return await response.json();
}

export async function extractPngId(
  accessToken: string,
  email: string
): Promise<string | null> {
  try {
    // Fetch user details from Google Directory API
    const response = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${email}?projection=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      log.warn("Could not fetch Google Directory user details");
      return null;
    }

    const userData = await response.json();

    const pngId =
      userData.customSchemas?.employee?.[GOOGLE_OAUTH_CONFIG.pngIdField] ||
      userData.externalIds?.find((id: any) => id.type === "organization")
        ?.value ||
      null;

    return pngId;
  } catch (error) {
    log.error({ err: error }, "Error extracting PNG ID");
    return null;
  }
}

export function isSuperAdminEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return ENV.superAdminEmails.includes(normalizedEmail);
}

export function determineUserRole(
  pngId: string | null,
  email: string
): "admin" | "manager" | "operator" | "viewer" {
  const normalizedEmail = email.trim().toLowerCase();

  if (isSuperAdminEmail(normalizedEmail)) return "admin";
  if (!pngId) return "viewer";
  if (pngId.startsWith("ADM")) return "admin";
  if (pngId.startsWith("MGR")) return "manager";
  if (pngId.startsWith("OPR")) return "operator";
  return "viewer";
}

export function resolveLoginRole(
  existingRole: string | null | undefined,
  derivedRole: "admin" | "manager" | "operator" | "viewer",
  email: string
): "admin" | "manager" | "operator" | "viewer" {
  if (isSuperAdminEmail(email)) return "admin";

  if (
    existingRole === "admin" ||
    existingRole === "manager" ||
    existingRole === "operator" ||
    existingRole === "viewer"
  ) {
    return existingRole;
  }

  return derivedRole;
}

/**
 * Derive org_id from Google `hd` (hosted domain) claim.
 * hki.com → "hki", gmail.com → "default"
 */
export function deriveOrgId(profile: any, email?: string): string {
  const hd: string | undefined = profile.hd;
  if (hd && hd !== "gmail.com" && hd !== "googlemail.com") {
    const parts = hd.split(".");
    if (parts.length > 2 && parts[parts.length - 2].length <= 3) {
      return parts.slice(0, -2).join(".");
    }
    return parts.slice(0, -1).join(".");
  }

  if (email) {
    const domain = email.split("@")[1];
    if (domain && domain !== "gmail.com" && domain !== "googlemail.com") {
      const parts = domain.split(".");
      return parts.slice(0, -1).join(".");
    }
  }

  return "default";
}

export function extractDepartment(email: string, profile: any): string | null {
  if (profile.organizations && profile.organizations.length > 0) {
    return profile.organizations[0].department || null;
  }

  const emailParts = email.split("@")[0].split("-");
  if (emailParts.length > 1) {
    return emailParts[emailParts.length - 1];
  }

  return null;
}
