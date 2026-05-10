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

  // Configure body parsers.
  // tRPC mutations can carry base64 file payloads (up to 50 MB per file).
  // A 50 MB file expands to roughly 67 MB when base64-encoded, so the tRPC
  // parser needs headroom above the decoded file-size limit.
  const defaultJson = express.json({ limit: "2mb" });
  app.use((req, res, next) => {
    // Skip the 2 MB parser for tRPC — it gets its own larger one below.
    if (req.path.startsWith("/api/trpc")) return next();
    defaultJson(req, res, next);
  });
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  app.use("/api/trpc", express.json({ limit: "75mb" }));

  // ── Request-ID propagation (before any route) ─────────────────────────────
  app.use(requestIdMiddleware);
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
  app.use((err: any, req: any, res: any, _next: any) => {
    const log = req.log || logger;
    log.error(
      { err, status: err.status || err.statusCode || 500 },
      "Unhandled error"
    );
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  });

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
