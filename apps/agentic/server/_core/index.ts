import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { validateEnv } from "./env";
import { buildAgenticReadinessPayload } from "./hvsi-audit";
import { createRouteRateLimiter } from "./rate-limit";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import googleAuthRoutes from "../auth/google-routes";
import googleDriveAuthRoutes from "../connectors/google-drive-auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { setupWebSocket } from "../websocket";
import { logger } from "./logger";
import { requestIdMiddleware } from "./request-id";
import { applySecurityMiddleware } from "./security";
import { createOriginGuard } from "./origin-guard";
import type { ErrorRequestHandler } from "express";

const staticFallbackRateLimit = createRouteRateLimiter({
  identifier: "agentic-static-fallback",
  windowMs: 60_000,
  limit: 600,
  message: "Too many page requests. Please try again shortly.",
});

function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

function listenOnce(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve(port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

async function listenWithFallback(
  server: Server,
  preferredPort: number
): Promise<number> {
  const allowFallback =
    process.env.NODE_ENV === "development" &&
    process.env.HKI_DEV_PORT_FALLBACK !== "false";
  const maxAttempts = allowFallback ? 20 : 1;

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferredPort + offset;
    try {
      return await listenOnce(server, port);
    } catch (error) {
      if (!isAddressInUse(error) || offset === maxAttempts - 1) {
        throw error;
      }
      logger.warn(
        { preferredPort, busyPort: port, nextPort: port + 1 },
        "Port busy during listen; trying alternate development port"
      );
    }
  }

  throw new Error(`No available port found starting from ${preferredPort}`);
}

async function startServer() {
  validateEnv();

  const app = express();
  const server = createServer(app);

  // Trust proxy headers from the load balancer / ingress layer.
  app.set("trust proxy", true);

  // ── Security headers (helmet) + CORS ──────────────────────────────────────
  // Must run before any route so headers attach to every response.
  applySecurityMiddleware(app);

  // Disable the X-Powered-By: Express header.
  app.disable("x-powered-by");

  // Configure body parsers.
  // The default API parser is 2 MB. tRPC needs a larger ceiling because
  // base64-encoded file uploads pass through it; the limit is configurable
  // via TRPC_BODY_LIMIT (default 20 MB). Long-term plan: migrate file uploads
  // to presigned GCS/S3 URLs and drop this to 2 MB.
  const trpcBodyLimit = process.env.TRPC_BODY_LIMIT || "20mb";
  const defaultJson = express.json({ limit: "2mb" });
  app.use((req, res, next) => {
    // Skip the 2 MB parser for tRPC — it gets its own larger one below.
    if (req.path.startsWith("/api/trpc")) return next();
    defaultJson(req, res, next);
  });
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.use("/api/trpc", express.json({ limit: trpcBodyLimit }));

  // ── Request-ID propagation (before any route) ─────────────────────────────
  app.use(requestIdMiddleware);

  // ── CSRF: reject cross-origin browser POSTs to state-changing endpoints. ──
  // Health/ready and OAuth callbacks come from external origins (Google), so
  // mount the guard on /api/trpc only — OAuth routes do their own state check.
  app.use("/api/trpc", createOriginGuard());

  // ── Health endpoints (raw HTTP for K8s probes — NOT behind tRPC) ──────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "agentic",
      uptime: process.uptime(),
    });
  });
  app.get("/ready", async (_req, res) => {
    const payload = await buildAgenticReadinessPayload();
    if (payload.status !== "ready") {
      return res.status(503).json(payload);
    }

    res.json(payload);
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Google OAuth routes
  app.use("/api/auth", googleAuthRoutes);
  // Google Drive connector OAuth flow
  app.use("/api/connectors/google-drive", googleDriveAuthRoutes);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // Production: serve static files
    const distPath = path.resolve(import.meta.dirname, "public");
    const indexPath = path.resolve(distPath, "index.html");

    if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      // Fall through to index.html if the file doesn't exist
      app.use("/{*path}", staticFallbackRateLimit, (_req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      logger.warn(
        `Build directory not found: ${distPath} — run "pnpm build" first for production mode`
      );
    }
  }

  // Global error handler — prevents stack trace leaks and unhandled crashes
  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const errWithStatus = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = errWithStatus.status ?? errWithStatus.statusCode ?? 500;
    const log = (req as { log?: typeof logger }).log ?? logger;
    log.error({ err, status }, "Unhandled error");
    res.status(status).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : (errWithStatus.message ?? "Unknown error"),
    });
  };
  app.use(errorHandler);

  const preferredPort = parseInt(process.env.PORT || "9001");

  // Setup WebSocket server
  logger.info("Setting up WebSocket server");
  setupWebSocket(server);

  // Start connector sync scheduler (checks for due syncs every 60s)
  import("../connectors/sync-scheduler")
    .then(({ startSyncScheduler }) => {
      startSyncScheduler();
    })
    .catch(err => {
      logger.warn(
        { err },
        "Sync scheduler failed to start — connector auto-sync disabled"
      );
    });

  const port = await listenWithFallback(server, preferredPort);
  logger.info(
    { port, preferredPort, ws: `/ws` },
    `Agentic BFF running on http://localhost:${port}/`
  );
}

startServer().catch(err => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
