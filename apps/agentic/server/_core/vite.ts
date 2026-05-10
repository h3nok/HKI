import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import type { ViteDevServer } from "vite";
import { createLogger } from "./logger";

const log = createLogger("static");
const appRoot = path.resolve(import.meta.dirname, "../..");
const forceOptimizeDeps = process.env.HKI_VITE_FORCE_DEPS === "true";

export async function setupVite(app: Express, server: Server) {
  // Dynamic import to avoid bundling vite in production
  const { createServer: createViteServer } = await import("vite");
  const { default: react } = await import("@vitejs/plugin-react");
  const { default: tailwindcss } = await import("@tailwindcss/vite");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite: ViteDevServer = await createViteServer({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(appRoot, "client", "src"),
        "@shared": path.resolve(appRoot, "shared"),
        "@assets": path.resolve(appRoot, "attached_assets"),
        react: path.resolve(appRoot, "node_modules/react"),
        "react-dom": path.resolve(appRoot, "node_modules/react-dom"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-grid-layout", "react-resizable"],
      force: forceOptimizeDeps,
    },
    envDir: appRoot,
    cacheDir: path.resolve(appRoot, "node_modules", ".vite"),
    root: path.resolve(appRoot, "client"),
    publicDir: path.resolve(appRoot, "client", "public"),
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(appRoot, "client", "index.html");

      // always reload the index.html file from disk in case it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      // Let Vite handle HMR naturally - no cache busting needed
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(appRoot, "dist", "public")
      : path.resolve(import.meta.dirname, "public");

  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
    log.warn(
      { distPath },
      "Build directory not found — run 'pnpm build' first for production mode"
    );
    // Don't register static middleware if there's nothing to serve
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(indexPath);
  });
}
