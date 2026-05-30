/**
 * CSRF protection via Origin / Sec-Fetch-Site validation.
 *
 * The BFF is a cookie-authenticated SPA, so it is vulnerable to CSRF unless
 * we verify that state-changing requests originate from an allowed origin.
 * We do NOT use a token-based CSRF scheme — tRPC + fetch in the SPA already
 * sends the Origin header on every same-origin POST, and browsers do not let
 * third-party pages forge it. SameSite=lax/none cookies plus this check is the
 * standard defense-in-depth for tRPC.
 *
 * Safe methods (GET, HEAD, OPTIONS) and same-origin requests pass through.
 * Cross-origin POST/PUT/PATCH/DELETE without an allowed Origin are rejected
 * with 403.
 */

import type { Request, RequestHandler } from "express";
import { ENV } from "./env";
import { createLogger } from "./logger";

const log = createLogger("origin-guard");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function allowedOrigins(): string[] {
  const explicit = parseList(process.env.ALLOWED_ORIGINS);
  if (explicit.length > 0) return explicit;
  return [ENV.baseUrl];
}

function originOfRequest(req: Request): string | undefined {
  // The Forwarded/Host headers tell us our own canonical origin behind a proxy.
  const proto =
    (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() ||
    req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() ||
    req.headers.host;
  if (!proto || !host) return undefined;
  return `${proto}://${host}`;
}

export function createOriginGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin =
      (req.headers.origin as string) || (req.headers.referer as string);
    const sameOrigin = origin && originOfRequest(req) === origin;
    const fetchSite = req.headers["sec-fetch-site"];

    // Same-origin browser POST is always safe.
    if (sameOrigin) return next();
    if (fetchSite === "same-origin" || fetchSite === "none") return next();

    // Cross-origin: only allow configured allowlist (e.g., trusted SaaS host).
    if (origin && allowedOrigins().includes(origin)) return next();

    // Non-browser callers (curl, server-to-server) typically send no Origin.
    // For those we require an explicit bearer token or service JWT, which is
    // enforced elsewhere in the tRPC context. Reject browser-style requests.
    if (!origin && !fetchSite) {
      // No Origin AND no Sec-Fetch-Site means a non-browser client. Allow —
      // auth is enforced inside tRPC procedures.
      return next();
    }

    log.warn(
      {
        method: req.method,
        path: req.originalUrl || req.url,
        origin,
        fetchSite,
        expectedOrigin: originOfRequest(req),
      },
      "Rejected request with disallowed origin (CSRF guard)"
    );
    res.status(403).json({ error: "Forbidden: disallowed request origin" });
  };
}
