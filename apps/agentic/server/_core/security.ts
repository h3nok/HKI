/**
 * Security middleware: helmet (CSP, HSTS, X-Frame-Options, etc.) + CORS.
 *
 * CSP is configured to be Vite-HMR-friendly in development and strict in
 * production. The connect-src list intentionally includes the orchestrator,
 * knowledge API, and observability URLs so the SPA can call them without
 * CSP violations.
 */

import type { Express, RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { ENV } from "./env";
import { createLogger } from "./logger";

const log = createLogger("security");

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function buildAllowedOrigins(): string[] {
  const explicit = parseList(process.env.ALLOWED_ORIGINS);
  if (explicit.length > 0) return explicit;
  return [ENV.baseUrl];
}

function buildConnectSrc(): string[] {
  // The SPA talks to the BFF (same origin), plus optional external services.
  const extra = parseList(process.env.CSP_CONNECT_SRC_EXTRA);
  const observability = process.env.VITE_OBSERVABILITY_URL
    ? [process.env.VITE_OBSERVABILITY_URL]
    : [];
  const base = [
    "'self'",
    "https://www.googleapis.com",
    ...extra,
    ...observability,
  ];
  if (ENV.isDevelopment) {
    // Vite HMR uses ws:// to localhost.
    base.push("ws:", "wss:", "http://localhost:*", "ws://localhost:*");
  }
  return Array.from(new Set(base));
}

/**
 * Apply helmet + CORS to the express app. Must be called before any route
 * handlers so the headers attach to every response (including error pages).
 */
export function applySecurityMiddleware(app: Express): void {
  const allowedOrigins = buildAllowedOrigins();
  const connectSrc = buildConnectSrc();

  log.info(
    {
      allowedOrigins,
      connectSrcCount: connectSrc.length,
      env: ENV.isProduction ? "production" : "development",
    },
    "Applying security middleware"
  );

  // ── helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. ──
  const scriptSrc = ENV.isDevelopment
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Vite dev needs eval for HMR
    : ["'self'"];

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": scriptSrc,
          "style-src": ["'self'", "'unsafe-inline'"], // tailwind / radix injected styles
          "img-src": ["'self'", "data:", "blob:", "https:"],
          "font-src": ["'self'", "data:", "https:"],
          "connect-src": connectSrc,
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "form-action": ["'self'"],
          "upgrade-insecure-requests": ENV.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // breaks some third-party iframes; opt in later
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      strictTransportSecurity: ENV.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    })
  );

  // ── CORS: only allow configured origins; credentials enabled for cookies. ──
  const corsMiddleware: RequestHandler = cors({
    origin(origin, callback) {
      // Same-origin requests have no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      log.warn({ origin, allowedOrigins }, "CORS rejected origin");
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-trpc-source",
    ],
    maxAge: 600,
  });
  app.use(corsMiddleware);
}
