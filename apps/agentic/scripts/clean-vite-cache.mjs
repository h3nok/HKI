import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "../..");
const cleanIfStale = process.argv.includes("--if-stale");

const cacheDirs = [
  path.resolve(appRoot, "node_modules", ".vite"),
  path.resolve(appRoot, "client", "node_modules", ".vite"),
  path.resolve(repoRoot, "node_modules", ".vite"),
];

const dependencyInputs = [
  path.resolve(repoRoot, "pnpm-lock.yaml"),
  path.resolve(appRoot, "package.json"),
  path.resolve(appRoot, "vite.config.ts"),
  path.resolve(appRoot, "server", "_core", "vite.ts"),
  path.resolve(repoRoot, "packages", "chat", "package.json"),
  path.resolve(repoRoot, "packages", "ui", "package.json"),
];

function mtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function shouldClean(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    return false;
  }

  if (!cleanIfStale) {
    return true;
  }

  const newestInput = Math.max(...dependencyInputs.map(mtimeMs));
  return mtimeMs(cacheDir) < newestInput;
}

const removed = [];

for (const cacheDir of cacheDirs) {
  if (!shouldClean(cacheDir)) {
    continue;
  }

  fs.rmSync(cacheDir, { force: true, recursive: true });
  removed.push(path.relative(appRoot, cacheDir) || cacheDir);
}

if (removed.length > 0) {
  console.log(`Removed Vite dependency cache: ${removed.join(", ")}`);
}
