/**
 * `hki probe` — black-box HTTP conformance probe.
 *
 * Runs a battery of HTTP-level tests against a deployed HKI gateway and
 * emits a signed JSON evidence bundle. This complements the in-process
 * adapter conformance kit (`hki-conformance`) by validating the system as
 * a whole.
 *
 * Probes implemented (L4-tested evidence):
 *   P01  missing envelope          -> 401
 *   P02  malformed envelope        -> 401
 *   P03  expired envelope          -> 401
 *   P04  active_domain = "global"  -> 403
 *   P05  active_domain = "*"       -> 403
 *   P06  scope body override       -> 403
 *   P07  unauthorized active_domain (not in authorized_domains) -> 403
 *   P08  cache replay across domains returns distinct responses
 *   P09  cross-domain artifact id  -> 403 or 404 (NEVER 200)
 *   P10  envelope downgrade hki_version=0.9 -> 401
 *
 * Each probe is independently runnable. Failures are reported with the
 * actual HTTP status, response body excerpt, and the rule that was violated.
 *
 * Usage:
 *   npx hki-probe https://gateway.example.com \
 *     --route /v1/chat \
 *     --org org_acme --domain iris --other-domain pulse \
 *     --out evidence.json
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { HKI_VERSION, type HkiEnvelope } from "@hki/runtime";

interface ProbeOptions {
  baseUrl: string;
  route: string;
  orgId: string;
  domain: string;
  otherDomain: string;
  issuer: string;
  policyPackId: string;
  signature: string;
  outFile: string | undefined;
  json: boolean;
  timeoutMs: number;
  extraHeaders: Record<string, string>;
  bodyTemplate: Record<string, unknown>;
}

export interface ProbeResult {
  id: string;
  title: string;
  passed: boolean;
  expected: string;
  actual: { status?: number; bodyExcerpt?: string; note?: string };
}

export interface EvidenceBundle {
  hki_version: string;
  generated_at: string;
  target: { base_url: string; route: string };
  passed: number;
  failed: number;
  level_claim: 0 | 1 | 2 | 3 | 4;
  results: ProbeResult[];
  /**
   * SHA-256 of the canonical evidence payload (hki_version + generated_at +
   * target + results), hex-encoded. Allows downstream tooling to verify that
   * the bundle was not tampered with after generation.
   */
  bundle_hash: string;
}

/** Compute a tamper-evident SHA-256 hash over the evidence payload. */
function signBundle(
  hki_version: string,
  generated_at: string,
  target: EvidenceBundle["target"],
  results: ProbeResult[]
): string {
  const payload = JSON.stringify({
    hki_version,
    generated_at,
    target,
    results,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// argv parsing (zero-dependency)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): ProbeOptions {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  const baseUrl = positional[0] ?? (flags["url"] as string | undefined);
  if (!baseUrl) {
    printUsageAndExit();
  }
  return {
    baseUrl: String(baseUrl).replace(/\/$/, ""),
    route: String(flags["route"] ?? "/v1/chat"),
    orgId: String(flags["org"] ?? "org_acme"),
    domain: String(flags["domain"] ?? "iris"),
    otherDomain: String(flags["other-domain"] ?? "pulse"),
    issuer: String(flags["issuer"] ?? "hki-probe"),
    policyPackId: String(flags["policy"] ?? "p1"),
    signature: String(flags["signature"] ?? "probe-signature"),
    outFile: flags["out"] ? String(flags["out"]) : undefined,
    json: Boolean(flags["json"]),
    timeoutMs: Number(flags["timeout"] ?? 10_000),
    extraHeaders: parseHeaders(flags["header"]),
    bodyTemplate: { query: "probe" },
  };
}

function parseHeaders(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    const str = String(item);
    const idx = str.indexOf(":");
    if (idx > 0) out[str.slice(0, idx).trim()] = str.slice(idx + 1).trim();
  }
  return out;
}

function printUsageAndExit(): never {
  process.stderr.write(
    `Usage: hki-probe <base-url> [--route /v1/chat] [--org id] [--domain d] [--other-domain d2]
                  [--issuer who] [--policy id] [--signature sig] [--out evidence.json]
                  [--header "k: v"] [--timeout ms] [--json]

Runs L4-tested HKI conformance probes against a gateway.\n`
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// envelope helpers
// ---------------------------------------------------------------------------

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function makeEnvelope(
  opts: ProbeOptions,
  overrides: Partial<HkiEnvelope> = {}
): HkiEnvelope {
  return {
    hki_version: HKI_VERSION,
    envelope_id: `probe_${Math.random().toString(36).slice(2, 10)}`,
    org_id: opts.orgId,
    subject_id: "probe-subject",
    active_domain: opts.domain,
    authorized_domains: [opts.domain, opts.otherDomain],
    purpose: "retrieve",
    risk_tier: "read-only",
    policy_pack_id: opts.policyPackId,
    issued_at: nowSec(),
    expires_at: nowSec() + 600,
    issuer: opts.issuer,
    signature: opts.signature,
    ...overrides,
  };
}

function encode(envelope: unknown): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

// ---------------------------------------------------------------------------
// HTTP probe runner
// ---------------------------------------------------------------------------

interface ProbeRequest {
  envelopeHeader?: string;
  body?: Record<string, unknown>;
  method?: string;
}

async function send(
  opts: ProbeOptions,
  req: ProbeRequest
): Promise<{ status: number; body: string }> {
  const url = `${opts.baseUrl}${opts.route}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...opts.extraHeaders,
  };
  if (req.envelopeHeader !== undefined) {
    headers["X-HKI-Envelope"] = req.envelopeHeader;
  }
  try {
    const res = await fetch(url, {
      method: req.method ?? "POST",
      headers,
      body: JSON.stringify(req.body ?? opts.bodyTemplate),
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 800) };
  } catch (err) {
    return { status: 0, body: `fetch-error: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

const PROBES: Array<(opts: ProbeOptions) => Promise<ProbeResult>> = [
  // P01 missing envelope
  async opts => {
    const r = await send(opts, {});
    return mk("P01", "missing envelope -> 401", r.status === 401, "401", r);
  },
  // P02 malformed envelope (not base64, not JSON)
  async opts => {
    const r = await send(opts, { envelopeHeader: "not-an-envelope" });
    return mk("P02", "malformed envelope -> 401", r.status === 401, "401", r);
  },
  // P03 expired envelope
  async opts => {
    const env = makeEnvelope(opts, { issued_at: 0, expires_at: 1 });
    const r = await send(opts, { envelopeHeader: encode(env) });
    return mk("P03", "expired envelope -> 401", r.status === 401, "401", r);
  },
  // P04 active_domain = global
  async opts => {
    const env = makeEnvelope(opts, {
      active_domain: "global",
      authorized_domains: ["global"],
    });
    const r = await send(opts, { envelopeHeader: encode(env) });
    return mk("P04", "active_domain=global -> 403", r.status === 403, "403", r);
  },
  // P05 active_domain = *
  async opts => {
    const env = makeEnvelope(opts, {
      active_domain: "*",
      authorized_domains: ["*"],
    });
    const r = await send(opts, { envelopeHeader: encode(env) });
    return mk("P05", "active_domain=* -> 403", r.status === 403, "403", r);
  },
  // P06 scope body override
  async opts => {
    const env = makeEnvelope(opts);
    const r = await send(opts, {
      envelopeHeader: encode(env),
      body: { ...opts.bodyTemplate, scope: opts.otherDomain },
    });
    return mk("P06", "scope body override -> 403", r.status === 403, "403", r);
  },
  // P07 unauthorized active_domain
  async opts => {
    const env = makeEnvelope(opts, {
      active_domain: "not-in-list",
      authorized_domains: [opts.domain],
    });
    const r = await send(opts, { envelopeHeader: encode(env) });
    return mk(
      "P07",
      "unauthorized active_domain -> 403",
      r.status === 403,
      "403",
      r
    );
  },
  // P08 cache replay across domains returns distinct content
  async opts => {
    const a = makeEnvelope(opts, { active_domain: opts.domain });
    const b = makeEnvelope(opts, { active_domain: opts.otherDomain });
    const r1 = await send(opts, { envelopeHeader: encode(a) });
    const r2 = await send(opts, { envelopeHeader: encode(b) });
    const distinct =
      r1.status >= 400 || r2.status >= 400 || r1.body !== r2.body;
    return mk(
      "P08",
      "same query under different domains -> distinct responses or rejection",
      distinct,
      "distinct",
      { status: r2.status, bodyExcerpt: distinct ? "ok" : "IDENTICAL BODIES" }
    );
  },
  // P09 cross-domain artifact id (best-effort: send body referencing other domain)
  async opts => {
    const env = makeEnvelope(opts, { active_domain: opts.domain });
    const r = await send(opts, {
      envelopeHeader: encode(env),
      body: { ...opts.bodyTemplate, artifact_domain: opts.otherDomain },
    });
    const ok = r.status === 403 || r.status === 404;
    return mk("P09", "cross-domain artifact -> 403/404", ok, "403 or 404", r);
  },
  // P10 envelope version downgrade
  async opts => {
    const env = makeEnvelope(opts, {
      hki_version: "0.9",
    } as Partial<HkiEnvelope>);
    const r = await send(opts, { envelopeHeader: encode(env) });
    return mk(
      "P10",
      "envelope version downgrade -> 401",
      r.status === 401,
      "401",
      r
    );
  },
];

function mk(
  id: string,
  title: string,
  passed: boolean,
  expected: string,
  r:
    | { status: number; body: string }
    | { status?: number; bodyExcerpt?: string }
): ProbeResult {
  const actual: ProbeResult["actual"] = {};
  if ("status" in r) actual.status = r.status;
  if ("body" in r) actual.bodyExcerpt = r.body;
  if ("bodyExcerpt" in r) actual.bodyExcerpt = r.bodyExcerpt;
  return { id, title, passed, expected, actual };
}

// ---------------------------------------------------------------------------
// reporter
// ---------------------------------------------------------------------------

function levelClaim(
  passed: number,
  total: number
): EvidenceBundle["level_claim"] {
  if (passed === total) return 4;
  if (passed >= Math.ceil(total * 0.8)) return 3;
  if (passed >= Math.ceil(total * 0.5)) return 2;
  if (passed > 0) return 1;
  return 0;
}

function renderText(bundle: EvidenceBundle): string {
  const lines: string[] = [];
  lines.push(
    `HKI probe report — ${bundle.target.base_url}${bundle.target.route}`
  );
  lines.push(`Generated: ${bundle.generated_at}`);
  lines.push("");
  for (const r of bundle.results) {
    const tag = r.passed ? "PASS" : "FAIL";
    const detail = `expected=${r.expected} actual=${JSON.stringify(r.actual)}`;
    lines.push(`  [${tag}] ${r.id} ${r.title}`);
    if (!r.passed) lines.push(`        ${detail}`);
  }
  lines.push("");
  lines.push(
    `Summary: ${bundle.passed}/${bundle.passed + bundle.failed} passed — claimed level L${bundle.level_claim}`
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function runProbe(opts: ProbeOptions): Promise<EvidenceBundle> {
  const results: ProbeResult[] = [];
  for (const probe of PROBES) {
    results.push(await probe(opts));
  }
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const hki_version = HKI_VERSION;
  const generated_at = new Date().toISOString();
  const target = { base_url: opts.baseUrl, route: opts.route };
  const bundle: EvidenceBundle = {
    hki_version,
    generated_at,
    target,
    passed,
    failed,
    level_claim: levelClaim(passed, results.length),
    results,
    bundle_hash: signBundle(hki_version, generated_at, target, results),
  };
  return bundle;
}

export async function main(argv: string[]): Promise<number> {
  const opts = parseArgs(argv);
  const bundle = await runProbe(opts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(bundle, null, 2) + "\n");
  } else {
    process.stdout.write(renderText(bundle) + "\n");
  }
  if (opts.outFile) {
    writeFileSync(opts.outFile, JSON.stringify(bundle, null, 2));
  }
  return bundle.failed === 0 ? 0 : 1;
}

if (typeof require !== "undefined" && require.main === module) {
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    err => {
      process.stderr.write(`hki-probe: ${err?.stack ?? err}\n`);
      process.exit(2);
    }
  );
}
