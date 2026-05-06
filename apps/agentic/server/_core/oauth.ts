import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createLogger } from "./logger";
import { sdk } from "./sdk";

const log = createLogger("oauth");

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function parseDevRole(value: string | undefined) {
  switch (value) {
    case "admin":
    case "manager":
    case "operator":
    case "viewer":
      return value;
    default:
      return "admin";
  }
}

function normalizeRedirectPath(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return value.startsWith("/") ? value : fallback;
}

export function registerOAuthRoutes(app: Express) {
  // ── Dev-only login bypass ───────────────────────────────────────────────
  // Skips DB entirely — dev user is synthetic, JWT-only session
  app.get("/api/dev-login", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "development") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const role = parseDevRole(getQueryParam(req, "role"));
      const openId =
        getQueryParam(req, "openId") ||
        (role === "admin" ? "dev-user-123" : `dev-${role}-user`);
      const name =
        getQueryParam(req, "name") ||
        (role === "admin" ? "Henok Ghebrechristos" : `Dev ${role} user`);
      const email =
        getQueryParam(req, "email") ||
        (role === "admin"
          ? "hghebrechristos@hki.com"
          : `${openId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@hki.com`);
      const orgId = getQueryParam(req, "orgId") || "hki";
      const valueStreams = getQueryParam(req, "valueStreams") || null;
      const redirectPath = normalizeRedirectPath(
        getQueryParam(req, "redirect"),
        role === "admin" ? "/admin" : "/login"
      );

      await db.upsertUser({
        openId,
        name,
        email,
        role,
        orgId,
        valueStreams,
        loginMethod: "dev-bypass",
        isActive: 1,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, redirectPath);
    } catch (error) {
      log.error({ err: error }, "Dev login failed");
      res.status(500).json({ error: "Dev login failed" });
    }
  });

  // ── OAuth callback ──────────────────────────────────────────────────────
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Redirect to /chat — client-side ProtectedRoute handles returnTo via sessionStorage
      res.redirect(302, "/chat");
    } catch (error) {
      log.error({ err: error }, "OAuth callback failed");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
