import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { createLogger } from "./logger";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const normalizeEmail = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const getIapEmail = (req: Request): string | null => {
  const header = req.headers["x-goog-authenticated-user-email"];
  if (typeof header !== "string") return null;
  return normalizeEmail(header.replace(/^accounts\.google\.com:/, ""));
};

const log = createLogger("auth");

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

type VerifiedSession = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    if (!ENV.oAuthServerUrl) {
      log.error("OAUTH_SERVER_URL is not configured");
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) {
      log.warn(
        "JWT_SECRET is empty — using insecure dev fallback. Set JWT_SECRET in .env."
      );
      return new TextEncoder().encode(
        "insecure-dev-jwt-secret-do-not-use-in-production-min-32-chars"
      );
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setIssuer("agentic-bff")
      .setAudience("agentic-client")
      .setSubject(payload.openId)
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      log.warn("Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        log.warn("Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      log.warn({ error: String(error) }, "Session verification failed");
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  // ── Throttle lastSignedIn updates: once per 5 minutes per user ──
  private lastSignedInCache = new Map<string, number>();
  private shouldUpdateLastSignedIn(openId: string): boolean {
    const now = Date.now();
    const last = this.lastSignedInCache.get(openId) || 0;
    if (now - last < 5 * 60 * 1000) return false; // 5 minute throttle
    this.lastSignedInCache.set(openId, now);
    return true;
  }

  private inferDevRole(openId: string): User["role"] {
    if (openId === "dev-user-123") return "admin";
    const match = /^dev-(admin|manager|operator|viewer)\b/.exec(openId);
    return (match?.[1] as User["role"] | undefined) ?? "viewer";
  }

  private buildSyntheticDevUser(
    session: VerifiedSession | null,
    overrides: Partial<User> = {}
  ): User {
    const openId = session?.openId || "dev-user-123";
    const role = overrides.role ?? this.inferDevRole(openId);
    const isDefaultDevUser = openId === "dev-user-123";
    const fallbackEmail = isDefaultDevUser
      ? "hghebrechristos@hki.com"
      : `${openId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@hki.com`;

    return {
      id: 1,
      openId,
      name:
        overrides.name ??
        session?.name ??
        (isDefaultDevUser ? "Henok Ghebrechristos" : "Dev User"),
      email: overrides.email ?? fallbackEmail,
      pngId: overrides.pngId ?? "PNG12345",
      role,
      department: overrides.department ?? "Innovation Lab",
      orgId: overrides.orgId ?? "hki",
      valueStreams: overrides.valueStreams ?? null,
      loginMethod: overrides.loginMethod ?? "dev",
      isActive: overrides.isActive ?? 1,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
      lastSignedIn: overrides.lastSignedIn ?? new Date(),
    } as User;
  }

  private async resolveDevBypassUser(
    session: VerifiedSession | null
  ): Promise<User> {
    const fallbackUser = this.buildSyntheticDevUser(session);

    try {
      const existingUser = await db.getUserByOpenId(fallbackUser.openId);
      if (existingUser) {
        return existingUser;
      }

      await db.upsertUser({
        openId: fallbackUser.openId,
        name: fallbackUser.name,
        email: fallbackUser.email,
        pngId: fallbackUser.pngId,
        role: fallbackUser.role,
        department: fallbackUser.department,
        orgId: fallbackUser.orgId,
        valueStreams: fallbackUser.valueStreams,
        loginMethod: fallbackUser.loginMethod,
        isActive: fallbackUser.isActive,
        lastSignedIn: new Date(),
      });

      const createdUser = await db.getUserByOpenId(fallbackUser.openId);
      if (createdUser) {
        return createdUser;
      }
    } catch (err) {
      log.warn(
        { error: String(err), openId: fallbackUser.openId },
        "Falling back to synthetic dev identity"
      );
    }

    return fallbackUser;
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    const iapEmail = getIapEmail(req);

    if (ENV.devBypassEnabled && session) {
      return this.resolveDevBypassUser(session);
    }

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;

    // Dev user bypass — return synthetic user without DB lookup
    if (
      sessionUserId.startsWith("dev-user-") &&
      process.env.NODE_ENV === "development"
    ) {
      return this.resolveDevBypassUser(session);
    }

    let user: User | null = null;
    try {
      user = (await db.getUserByOpenId(sessionUserId)) ?? null;
    } catch (err) {
      log.warn(
        { error: String(err) },
        "DB lookup failed, using session-only identity"
      );
    }

    if (iapEmail) {
      try {
        const emailUser = (await db.getPreferredUserByEmail(iapEmail)) ?? null;
        if (emailUser && (!user || emailUser.id !== user.id)) {
          log.info(
            {
              email: iapEmail,
              requestedOpenId: sessionUserId,
              resolvedOpenId: emailUser.openId,
            },
            "Resolved request to canonical user by email"
          );
          user = emailUser;
        }
      } catch (err) {
        log.warn(
          { error: String(err), email: iapEmail },
          "Email-based user resolution failed"
        );
      }
    }

    // If user not in DB, try to sync from OAuth server
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        const normalizedUserEmail = normalizeEmail(userInfo.email ?? null);
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: normalizedUserEmail,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });
        if (normalizedUserEmail) {
          user =
            (await db.getPreferredUserByEmail(normalizedUserEmail)) ?? null;
        }
        if (!user) {
          user = (await db.getUserByOpenId(userInfo.openId)) ?? null;
        }
      } catch {
        // OAuth sync failed — try creating user from session data (covers IAP-authenticated users)
      }
    }

    // If still no user, try to create from session payload (IAP auth path)
    if (!user) {
      try {
        const fallbackEmail = iapEmail;
        await db.upsertUser({
          openId: session.openId,
          name: session.name || null,
          email: fallbackEmail,
          role: "viewer",
          loginMethod: fallbackEmail ? "google-iap" : null,
          lastSignedIn: new Date(),
        });
        if (fallbackEmail) {
          user = (await db.getPreferredUserByEmail(fallbackEmail)) ?? null;
        }
        if (!user) {
          user = (await db.getUserByOpenId(session.openId)) ?? null;
        }
      } catch (err) {
        log.error(
          { error: String(err) },
          "Failed to create user from session data"
        );
      }
    }

    if (!user) {
      throw ForbiddenError(
        "User account not found. Database may be unavailable. Please try again or re-authenticate."
      );
    }

    if (!user.isActive) {
      throw ForbiddenError("Account has been deactivated");
    }

    // Throttle lastSignedIn writes: once per 5 minutes instead of every request
    if (this.shouldUpdateLastSignedIn(user.openId)) {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
    }

    return user;
  }
}

export const sdk = new SDKServer();
