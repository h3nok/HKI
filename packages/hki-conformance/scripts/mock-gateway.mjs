#!/usr/bin/env node
/**
 * Mock HKI gateway for CI smoke-testing `hki-probe`.
 *
 * Implements exactly the behaviours that P01–P10 probes assert:
 *
 *   P01  missing X-HKI-Envelope header          → 401
 *   P02  header not parseable as base64-JSON     → 401
 *   P03  envelope.expires_at <= now              → 401
 *   P10  envelope.hki_version !== "1.0"          → 401
 *   P04  active_domain === "global"              → 403
 *   P05  active_domain === "*"                   → 403
 *   P06  body.scope present                      → 403
 *   P07  active_domain not in authorized_domains → 403
 *   P08  same query under different domains      → distinct body (domain echoed)
 *   P09  body.artifact_domain != active_domain   → 403 (best-effort)
 *       otherwise                               → 200
 *
 * Usage:
 *   node scripts/mock-gateway.mjs [port]
 *
 * The server exits with 0 after SIGTERM or SIGINT.
 */

import http from "node:http";

const PORT = Number(process.argv[2] ?? 9780);
const HKI_VERSION = "1.0";

function parseEnvelope(header) {
  try {
    const json = Buffer.from(header, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function respond(res, status, message) {
  const body = JSON.stringify({ error: message });
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  // Only handle POST /v1/chat (the default probe route)
  if (req.method !== "POST") {
    respond(res, 405, "method not allowed");
    return;
  }

  // Read body
  let rawBody = "";
  for await (const chunk of req) rawBody += chunk;
  let body = {};
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    // treat as empty body
  }

  // --- P01: missing envelope ---
  const header = req.headers["x-hki-envelope"];
  if (!header) {
    respond(res, 401, "missing X-HKI-Envelope");
    return;
  }

  // --- P02: malformed envelope ---
  const env = parseEnvelope(header);
  if (!env || typeof env !== "object") {
    respond(res, 401, "malformed envelope");
    return;
  }

  // --- P10: version downgrade ---
  if (env.hki_version !== HKI_VERSION) {
    respond(res, 401, `unsupported hki_version: ${env.hki_version}`);
    return;
  }

  // --- P03: expired envelope ---
  if (typeof env.expires_at !== "number" || env.expires_at <= nowSec()) {
    respond(res, 401, "envelope expired");
    return;
  }

  // --- P04: active_domain = "global" ---
  if (env.active_domain === "global") {
    respond(res, 403, "active_domain=global is not permitted");
    return;
  }

  // --- P05: active_domain = "*" ---
  if (env.active_domain === "*") {
    respond(res, 403, "wildcard active_domain is not permitted");
    return;
  }

  // --- P07: unauthorized active_domain ---
  const authorized = Array.isArray(env.authorized_domains)
    ? env.authorized_domains
    : [];
  if (!authorized.includes(env.active_domain)) {
    respond(res, 403, "active_domain not in authorized_domains");
    return;
  }

  // --- P06: scope body override ---
  if (body.scope !== undefined) {
    respond(res, 403, "scope override in body is not permitted");
    return;
  }

  // --- P09: cross-domain artifact reference (best-effort) ---
  if (
    body.artifact_domain !== undefined &&
    body.artifact_domain !== env.active_domain
  ) {
    respond(res, 403, "artifact_domain crosses active_domain boundary");
    return;
  }

  // --- P08: domain-scoped response (distinct bodies per domain) ---
  const responseBody = JSON.stringify({
    ok: true,
    domain: env.active_domain,
    echo: body.query ?? "probe",
  });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(responseBody);
});

server.listen(PORT, "127.0.0.1", () => {
  // Write the port to stdout so the caller knows we are ready
  process.stdout.write(`mock-gateway listening on http://127.0.0.1:${PORT}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
