#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(appRoot, "dist", "public");
const assetsRoot = path.join(distRoot, "assets");
const indexPath = path.join(distRoot, "index.html");
const kib = 1024;

const budgets = {
  entryJs: 175 * kib,
  initialJs: 2_650 * kib,
  initialCss: 725 * kib,
  largestJs: 850 * kib,
  largestCss: 725 * kib,
  chunks: [
    { label: "AgenticChat", pattern: /^AgenticChat-.*\.js$/, max: 320 * kib },
    {
      label: "StreamSwitcher",
      pattern: /^StreamSwitcher-.*\.js$/,
      max: 260 * kib,
    },
    { label: "hki-ui", pattern: /^hki-ui-.*\.js$/, max: 650 * kib },
    {
      label: "vendor-content",
      pattern: /^vendor-content-.*\.js$/,
      max: 850 * kib,
    },
    {
      label: "vendor-icons",
      pattern: /^vendor-icons-.*\.js$/,
      max: 650 * kib,
    },
    { label: "vendor-viz", pattern: /^vendor-viz-.*\.js$/, max: 700 * kib },
  ],
};

function fail(message) {
  console.error(`[bundle-check] ${message}`);
  process.exitCode = 1;
}

function formatBytes(bytes) {
  return `${(bytes / kib).toFixed(1)} KiB`;
}

function extractAssets(html, pattern) {
  const matches = [];
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href) matches.push(href.replace(/^\//, ""));
  }
  return matches;
}

function sizeOf(assetPath) {
  const fullPath = path.join(distRoot, assetPath);
  if (!existsSync(fullPath)) {
    fail(`Missing asset referenced by index.html: ${assetPath}`);
    return 0;
  }
  return statSync(fullPath).size;
}

function assertBudget(label, actual, max) {
  const ok = actual <= max;
  const line = `${label}: ${formatBytes(actual)} / ${formatBytes(max)}`;
  if (ok) {
    console.log(`[bundle-check] ${line}`);
  } else {
    fail(`${line} over budget`);
  }
}

if (!existsSync(indexPath) || !existsSync(assetsRoot)) {
  fail("dist/public is missing. Run `pnpm --dir apps/agentic build` first.");
  process.exit();
}

const html = readFileSync(indexPath, "utf8");
const entryScripts = extractAssets(
  html,
  /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g,
);
const preloadedScripts = extractAssets(
  html,
  /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/g,
);
const stylesheets = extractAssets(
  html,
  /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g,
);

if (entryScripts.length !== 1) {
  fail(`Expected one module entry script, found ${entryScripts.length}.`);
}

const jsAssets = readdirSync(assetsRoot)
  .filter(name => name.endsWith(".js"))
  .map(name => ({ name, size: statSync(path.join(assetsRoot, name)).size }))
  .sort((a, b) => b.size - a.size);

const cssAssets = readdirSync(assetsRoot)
  .filter(name => name.endsWith(".css"))
  .map(name => ({ name, size: statSync(path.join(assetsRoot, name)).size }))
  .sort((a, b) => b.size - a.size);

const entryJsSize = entryScripts.reduce((sum, asset) => sum + sizeOf(asset), 0);
const initialJsSize = [...entryScripts, ...preloadedScripts].reduce(
  (sum, asset) => sum + sizeOf(asset),
  0,
);
const initialCssSize = stylesheets.reduce((sum, asset) => sum + sizeOf(asset), 0);

assertBudget("entry js", entryJsSize, budgets.entryJs);
assertBudget("initial js", initialJsSize, budgets.initialJs);
assertBudget("initial css", initialCssSize, budgets.initialCss);
assertBudget("largest js chunk", jsAssets[0]?.size ?? 0, budgets.largestJs);
assertBudget("largest css chunk", cssAssets[0]?.size ?? 0, budgets.largestCss);

for (const chunkBudget of budgets.chunks) {
  const matches = jsAssets.filter(asset => chunkBudget.pattern.test(asset.name));
  if (matches.length === 0) {
    fail(`Missing expected ${chunkBudget.label} chunk.`);
    continue;
  }
  for (const asset of matches) {
    assertBudget(`${chunkBudget.label} chunk`, asset.size, chunkBudget.max);
  }
}

if (process.exitCode) {
  console.error("[bundle-check] Bundle budget failed.");
} else {
  console.log("[bundle-check] Bundle budget passed.");
}
