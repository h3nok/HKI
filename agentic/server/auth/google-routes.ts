import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { type Role } from "@shared/access-control";
import { Router, Request, Response } from "express";
import { getDb, getPreferredUserByEmail } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getSessionCookieClearOptions,
  getSessionCookieOptions,
} from "../_core/cookies";
import { createRouteRateLimiter } from "../_core/rate-limit";
import { sdk } from "../_core/sdk";
import {
  GOOGLE_OAUTH_CONFIG,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserProfile,
  extractPngId,
  determineUserRole,
  resolveLoginRole,
  deriveOrgId,
  extractDepartment,
  DEV_BYPASS,
} from "./google-oauth";
import { createLogger } from "../_core/logger";

const log = createLogger("auth");
const router = Router();

function getIapRateLimitKey(req: Request): string | undefined {
  const rawHeader = req.headers["x-goog-authenticated-user-email"];
  const iapEmailHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!iapEmailHeader) {
    return undefined;
  }

  const email = iapEmailHeader
    .replace(/^accounts\.google\.com:/, "")
    .trim()
    .toLowerCase();

  return email ? `iap:${email}` : undefined;
}

const googleAuthFlowRateLimit = createRouteRateLimiter({
  identifier: "google-auth-flow",
  windowMs: 5 * 60_000,
  limit: 10,
  message:
    "Too many authentication requests. Please try again in a few minutes.",
  keyBuilder: getIapRateLimitKey,
});

const googleAuthSessionRateLimit = createRouteRateLimiter({
  identifier: "google-auth-session",
  windowMs: 60_000,
  limit: 120,
  message: "Too many authentication requests. Please try again shortly.",
  keyBuilder: getIapRateLimitKey,
});

function getPostAuthRedirect(role: Role | null | undefined): string {
  if (role === "admin") {
    return "/admin";
  }
  return role === "manager" ? "/knowledge" : "/chat";
}

/**
 * Initiate Google OAuth login
 * GET /api/auth/google/login
 *
 * Behind IAP: the user is already authenticated — read IAP headers and
 * create a session directly. No redirect to Google needed.
 */
router.get(
  "/google/login",
  googleAuthFlowRateLimit,
  async (req: Request, res: Response) => {
    // Dev bypass
    if (DEV_BYPASS.enabled) {
      log.info("Dev bypass: skipping Google OAuth, creating dev session");
      try {
        const sessionToken = await sdk.createSessionToken(
          DEV_BYPASS.mockUser.openId,
          {
            name: DEV_BYPASS.mockUser.name,
            expiresInMs: ONE_YEAR_MS,
          }
        );
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return res.redirect("/admin");
      } catch (error) {
        log.error({ err: error }, "Dev bypass session creation failed");
        return res.status(500).json({ error: "Dev login failed" });
      }
    }

    // IAP bypass: if IAP already authenticated, create session from IAP headers
    const iapEmail = req.headers["x-goog-authenticated-user-email"] as
      | string
      | undefined;
    if (iapEmail) {
      return handleIapAuth(req, res, iapEmail);
    }

    const authUrl = getGoogleAuthUrl();
    res.redirect(authUrl);
  }
);

/**
 * Handle IAP-authenticated user — create session from IAP headers.
 * Called when X-Goog-Authenticated-User-Email is present.
 */
async function handleIapAuth(
  req: Request,
  res: Response,
  iapEmailHeader: string
) {
  try {
    const email = iapEmailHeader.replace(/^accounts\.google\.com:/, "").trim();
    const iapId = (req.headers["x-goog-authenticated-user-id"] as string) || "";
    const googleId =
      iapId.replace(/^accounts\.google\.com:/, "").trim() || `iap-${email}`;

    log.info({ email, googleId }, "IAP-authenticated user, creating session");

    const allowedDomain = GOOGLE_OAUTH_CONFIG.allowedDomain;
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      return res
        .status(403)
        .json({ error: `Access restricted to @${allowedDomain}` });
    }

    const name = email
      .split("@")[0]
      .replace(/\./g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
    const orgId = deriveOrgId({}, email);
    const derivedRole = determineUserRole(null, email);
    let finalRole: Role = derivedRole;
    let sessionOpenId = googleId;

    const db = await getDb();
    if (db) {
      try {
        const canonicalUser = await getPreferredUserByEmail(email);
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.openId, googleId))
          .limit(1);
        const targetUser =
          canonicalUser && canonicalUser.openId !== googleId
            ? canonicalUser
            : (existing ?? canonicalUser);

        if (targetUser) {
          finalRole = resolveLoginRole(targetUser.role, derivedRole, email);
          await db
            .update(users)
            .set({
              name,
              email,
              role: finalRole,
              orgId,
              lastSignedIn: new Date(),
              loginMethod: "google-iap",
            })
            .where(eq(users.id, targetUser.id));
          sessionOpenId = targetUser.openId;
        } else {
          await db.insert(users).values({
            openId: googleId,
            name,
            email,
            orgId,
            role: finalRole,
            loginMethod: "google-iap",
            isActive: 1,
          });
        }
      } catch (err) {
        log.error(
          { err },
          "DB upsert failed during IAP auth — user may not be persisted"
        );
      }
    } else {
      log.error(
        "Database unavailable during IAP auth — user will not be persisted"
      );
    }

    const sessionToken = await sdk.createSessionToken(sessionOpenId, {
      name,
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });

    return res.redirect(getPostAuthRedirect(finalRole));
  } catch (error) {
    log.error({ err: error }, "IAP auth session creation failed");
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get(
  "/google/callback",
  googleAuthFlowRateLimit,
  async (req: Request, res: Response) => {
    try {
      // If IAP is present, use IAP identity instead of exchanging the code
      const iapEmail = req.headers["x-goog-authenticated-user-email"] as
        | string
        | undefined;
      if (iapEmail) {
        return handleIapAuth(req, res, iapEmail);
      }

      const { code } = req.query;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Missing authorization code" });
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);
      const accessToken = tokens.access_token;

      if (!accessToken) {
        return res.status(500).json({ error: "Failed to get access token" });
      }

      // Get user profile from Google
      const profile = await getGoogleUserProfile(accessToken);
      const { id: googleId, email, name, picture } = profile;

      // Domain restriction — reject non-corporate emails
      const allowedDomain = GOOGLE_OAUTH_CONFIG.allowedDomain;
      if (allowedDomain && email && !email.endsWith(`@${allowedDomain}`)) {
        log.warn({ email }, "Rejected login from unauthorized domain");
        return res.status(403).json({
          error: `Access restricted to @${allowedDomain} accounts`,
        });
      }

      // Extract PNG ID from Google Workspace
      const pngId = await extractPngId(accessToken, email);

      // Determine role based on PNG ID
      const derivedRole = determineUserRole(pngId, email);

      // Extract department
      const department = extractDepartment(email, profile);

      // Derive org_id from Google hosted domain (hd) claim
      const orgId = deriveOrgId(profile, email);

      // Find or create user in database
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database connection failed" });
      }
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.openId, googleId))
        .limit(1);

      const canonicalUser = await getPreferredUserByEmail(email);
      let finalRole: Role = derivedRole;
      let sessionOpenId = googleId;
      const targetUser =
        canonicalUser && canonicalUser.openId !== googleId
          ? canonicalUser
          : (existingUsers[0] ?? canonicalUser);
      if (targetUser) {
        // Update existing user
        finalRole = resolveLoginRole(targetUser.role, derivedRole, email);
        await db
          .update(users)
          .set({
            name,
            email,
            pngId,
            role: finalRole,
            department,
            orgId,
            lastSignedIn: new Date(),
            loginMethod: "google",
          })
          .where(eq(users.id, targetUser.id));
        sessionOpenId = targetUser.openId;
      } else {
        // Create new user
        await db.insert(users).values({
          openId: googleId,
          name,
          email,
          pngId,
          role: finalRole,
          department,
          orgId,
          loginMethod: "google",
          isActive: 1,
        });
      }

      // Mint session JWT and set cookie (same pattern as Manus OAuth callback)
      const sessionToken = await sdk.createSessionToken(sessionOpenId, {
        name: name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(getPostAuthRedirect(finalRole));
    } catch (error) {
      log.error({ err: error }, "Google OAuth callback error");
      res.status(500).json({ error: "Authentication failed" });
    }
  }
);

/**
 * Logout
 * POST /api/auth/logout
 */
router.post(
  "/logout",
  googleAuthSessionRateLimit,
  (req: Request, res: Response) => {
    for (const cookieOptions of getSessionCookieClearOptions(req)) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
    }
    res.json({ success: true });
  }
);

/**
 * Get current user (for dev bypass)
 * GET /api/auth/me
 */
router.get(
  "/me",
  googleAuthSessionRateLimit,
  async (req: Request, res: Response) => {
    // Verify session cookie and return user
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user });
    } catch {
      res.status(401).json({ error: "Not authenticated" });
    }
  }
);

export default router;
