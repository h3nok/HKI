#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [packageDirArg, markerArg = "dist/index.d.ts"] = process.argv.slice(2);

if (!packageDirArg) {
  console.error("Usage: ensure-package-built.mjs <package-dir> [marker]");
  process.exit(2);
}

const packageDir = path.resolve(process.cwd(), packageDirArg);
const marker = path.resolve(packageDir, markerArg);

if (existsSync(marker)) {
  process.exit(0);
}

const result = spawnSync("pnpm", ["--dir", packageDir, "build"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
