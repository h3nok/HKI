#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001").replace(
  /\/$/,
  "",
);
const timeoutMs = Number(process.env.AGENTIC_UI_SMOKE_TIMEOUT_MS ?? 20_000);

function log(message) {
  console.log(`[agentic-ui-smoke] ${message}`);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractAssets(html, pattern) {
  const assets = [];
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href) assets.push(href.startsWith("/") ? href : `/${href}`);
  }
  return assets;
}

async function expectHtml(pathname) {
  const response = await fetchWithTimeout(`${baseUrl}${pathname}`, {
    headers: { Accept: "text/html" },
  });
  assert.equal(response.status, 200, `${pathname} returned ${response.status}`);
  const html = await response.text();
  assert.match(html, /<div id="root"><\/div>/, `${pathname} missing root div`);
  assert.match(html, /HKI.+Hermetic Knowledge Isolation/, `${pathname} missing title`);
  return html;
}

async function expectAsset(assetPath) {
  const response = await fetchWithTimeout(`${baseUrl}${assetPath}`);
  assert.equal(response.status, 200, `${assetPath} returned ${response.status}`);
  const body = await response.arrayBuffer();
  assert.ok(body.byteLength > 0, `${assetPath} was empty`);
  return body.byteLength;
}

log(`Checking ${baseUrl}`);

const html = await expectHtml("/");
await expectHtml("/chat");
await expectHtml("/knowledge");
await expectHtml("/admin");

const assets = [
  ...extractAssets(
    html,
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g,
  ),
  ...extractAssets(
    html,
    /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/g,
  ),
  ...extractAssets(
    html,
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g,
  ),
];

assert.ok(assets.length >= 2, "Expected module and stylesheet assets in HTML");

let totalAssetBytes = 0;
for (const asset of assets) {
  totalAssetBytes += await expectAsset(asset);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      baseUrl,
      checkedPaths: ["/", "/chat", "/knowledge", "/admin"],
      checkedAssets: assets.length,
      totalAssetBytes,
    },
    null,
    2,
  ),
);
