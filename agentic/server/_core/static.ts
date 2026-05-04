import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createLogger } from "./logger";

const log = createLogger("static");

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
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
