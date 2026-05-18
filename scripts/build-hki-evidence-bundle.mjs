#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AUDIT_SCHEMA = "hki.audit.event.v1";
const BUNDLE_SCHEMA = "hki.evidence.bundle.v1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/build-hki-evidence-bundle.mjs [options]

Options:
  --events <file>              Audit events JSON file. Repeatable. Use - for stdin.
  --service-evidence <file>    Service evidence JSON. Default: artifacts/hki/service-evidence.json if present.
  --conformance <file>         Conformance registry JSON. Default: conformance.json if present.
  --out <file>                 Output bundle path. Default: artifacts/hki/evidence-bundle.json
  --org <id>                   Filter bundle to one org_id.
  --domain <id>                Filter bundle to one active_domain.
  --from <iso>                 Include events at or after this timestamp.
  --to <iso>                   Include events at or before this timestamp.
  --release <id>               Release or evidence label.
  --redaction-profile <id>     Bundle redaction profile. Default: metadata-only
  --require-events             Fail when no evidence-grade audit events match.
  --allow-invalid              Do not fail when invalid audit events are present.
  --json                       Print bundle JSON to stdout.
  --help                       Show this help.
`;
}

function parseArgs(argv) {
  const options = {
    eventFiles: [],
    serviceEvidence: "artifacts/hki/service-evidence.json",
    conformance: "conformance.json",
    out: "artifacts/hki/evidence-bundle.json",
    org: "",
    domain: "",
    from: "",
    to: "",
    release: "",
    redactionProfile: "metadata-only",
    requireEvents: false,
    allowInvalid: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [name, inlineValue] = arg.split("=", 2);
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${name}`);
      return argv[index];
    };

    switch (name) {
      case "--":
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--events":
        options.eventFiles.push(takeValue());
        break;
      case "--service-evidence":
        options.serviceEvidence = takeValue();
        break;
      case "--conformance":
        options.conformance = takeValue();
        break;
      case "--out":
        options.out = takeValue();
        break;
      case "--org":
        options.org = takeValue().trim();
        break;
      case "--domain":
        options.domain = takeValue().trim();
        break;
      case "--from":
        options.from = takeValue().trim();
        break;
      case "--to":
        options.to = takeValue().trim();
        break;
      case "--release":
        options.release = takeValue().trim();
        break;
      case "--redaction-profile":
        options.redactionProfile = takeValue().trim() || "metadata-only";
        break;
      case "--require-events":
        options.requireEvents = true;
        break;
      case "--allow-invalid":
        options.allowInvalid = true;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${name}`);
    }
  }

  parseOptionalDate(options.from, "--from");
  parseOptionalDate(options.to, "--to");
  return options;
}

function resolvePath(filePath) {
  if (!filePath || filePath === "-") return filePath;
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(filePath, { optional = false, stdinText = null } = {}) {
  if (filePath === "-") {
    const text = stdinText ?? (await readStdin());
    return JSON.parse(text);
  }

  const resolved = resolvePath(filePath);
  if (!(await exists(resolved))) {
    if (optional) return null;
    throw new Error(`Missing JSON file: ${filePath}`);
  }
  return JSON.parse(await fs.readFile(resolved, "utf8"));
}

async function fileHash(filePath, stdinText = null) {
  if (filePath === "-") return sha256(stdinText ?? "");
  const resolved = resolvePath(filePath);
  return sha256(await fs.readFile(resolved));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function parseOptionalDate(value, field) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new Error(`${field} must be an ISO timestamp`);
  return timestamp;
}

function extractEvents(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
}

function auditPayload(raw) {
  if (raw?.schema === AUDIT_SCHEMA) return raw;
  if (raw?.payload?.schema === AUDIT_SCHEMA) return raw.payload;
  return null;
}

function normalizeDomain(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sameDomain(left, right) {
  const a = normalizeDomain(left);
  const b = normalizeDomain(right);
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function forbiddenDomain(value) {
  const domain = normalizeDomain(value);
  return !domain || domain.toLowerCase() === "global" || domain === "*";
}

function validateAuditEvent(event) {
  const issues = [];
  const boundary = event.boundary ?? {};
  const operation = event.operation ?? {};
  const activeDomain = normalizeDomain(boundary.active_domain);
  const authorizedDomains = Array.isArray(boundary.authorized_domains)
    ? boundary.authorized_domains.map(normalizeDomain).filter(Boolean)
    : [];
  const targetDomain = normalizeDomain(operation.target_domain);
  const plane =
    operation.plane === "admin" || operation.plane === "publication"
      ? operation.plane
      : "runtime";

  for (const [field, value] of [
    ["event_id", event.event_id],
    ["occurred_at", event.occurred_at],
    ["received_at", event.received_at],
    ["source.platform", event.source?.platform],
    ["source.service", event.source?.service],
    ["actor.subject_id", event.actor?.subject_id],
    ["boundary.org_id", boundary.org_id],
    ["operation.type", operation.type],
    ["decision.outcome", event.decision?.outcome],
  ]) {
    if (typeof value !== "string" || !value.trim()) {
      issues.push({ code: "missing-field", field });
    }
  }

  if (forbiddenDomain(activeDomain)) {
    issues.push({ code: "invalid-domain", field: "boundary.active_domain" });
  }
  if (authorizedDomains.length === 0) {
    issues.push({
      code: "missing-field",
      field: "boundary.authorized_domains",
    });
  }
  if (authorizedDomains.some(forbiddenDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "boundary.authorized_domains",
    });
  }
  if (
    activeDomain &&
    authorizedDomains.length > 0 &&
    !authorizedDomains.some(domain => sameDomain(domain, activeDomain))
  ) {
    issues.push({
      code: "unauthorized-domain",
      field: "boundary.active_domain",
    });
  }
  if (targetDomain && forbiddenDomain(targetDomain)) {
    issues.push({ code: "invalid-domain", field: "operation.target_domain" });
  }
  if (
    plane === "runtime" &&
    activeDomain &&
    targetDomain &&
    !sameDomain(targetDomain, activeDomain)
  ) {
    issues.push({
      code: "unauthorized-domain",
      field: "operation.target_domain",
    });
  }
  return issues;
}

function eventTimestamp(event) {
  return Date.parse(event.occurred_at || event.received_at || "");
}

function eventMatches(event, options) {
  if (options.org && !sameDomain(event.boundary?.org_id, options.org))
    return false;
  if (
    options.domain &&
    !sameDomain(event.boundary?.active_domain, options.domain)
  )
    return false;
  const timestamp = eventTimestamp(event);
  const from = parseOptionalDate(options.from, "--from");
  const to = parseOptionalDate(options.to, "--to");
  if (from !== null && (!Number.isFinite(timestamp) || timestamp < from))
    return false;
  if (to !== null && (!Number.isFinite(timestamp) || timestamp > to))
    return false;
  return true;
}

function countBy(events, selector) {
  const counts = {};
  for (const event of events) {
    const key = selector(event) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sourceRef(event) {
  return {
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    service: event.source?.service ?? "",
    active_domain: event.boundary?.active_domain ?? "",
    operation: event.operation?.type ?? "",
    decision: event.decision?.outcome ?? "",
    payload_hash: event.evidence?.payload_hash ?? "",
    payload_ref: event.evidence?.payload_ref ?? "",
  };
}

async function loadEventSources(options) {
  const stdinText = options.eventFiles.includes("-") ? await readStdin() : null;
  const sources = [];
  const allRawEvents = [];

  for (const filePath of options.eventFiles) {
    const raw = await readJson(filePath, { stdinText });
    const events = extractEvents(raw);
    allRawEvents.push(...events);
    sources.push({
      path: filePath,
      sha256: await fileHash(filePath, stdinText),
      raw_event_count: events.length,
    });
  }

  return { sources, allRawEvents };
}

async function optionalSource(filePath) {
  const resolved = resolvePath(filePath);
  if (!(await exists(resolved))) return null;
  const raw = await readJson(filePath, { optional: true });
  return {
    path: filePath,
    sha256: await fileHash(filePath),
    summary: summarizeSource(raw),
  };
}

function summarizeSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    schema: raw.$schema ?? raw.schema ?? null,
    generated_at: raw.generated_at ?? raw.generatedAt ?? null,
    bundle_hash: raw.bundle_hash ?? raw.manifest?.hash ?? null,
    passed: raw.passed ?? raw.conformance?.passed ?? null,
    failed: raw.failed ?? null,
    level: raw.level ?? null,
    evidence_profile: raw.evidenceProfile ?? raw.evidence_profile ?? null,
  };
}

function buildSummary({
  rawEvents,
  auditEvents,
  invalidEvents,
  matchedEvents,
}) {
  return {
    raw_events: rawEvents.length,
    evidence_grade_events: auditEvents.length,
    matched_events: matchedEvents.length,
    legacy_or_partial_events: rawEvents.length - auditEvents.length,
    invalid_evidence_grade_events: invalidEvents.length,
    missing_scope_events: invalidEvents.filter(event =>
      event.issues.some(issue => issue.field === "boundary.active_domain")
    ).length,
    forbidden_scope_events: invalidEvents.filter(event =>
      event.issues.some(issue => issue.code === "invalid-domain")
    ).length,
    unauthorized_target_events: invalidEvents.filter(event =>
      event.issues.some(issue => issue.field === "operation.target_domain")
    ).length,
    by_decision: countBy(matchedEvents, event => event.decision?.outcome),
    by_operation: countBy(matchedEvents, event => event.operation?.type),
    by_service: countBy(matchedEvents, event => event.source?.service),
  };
}

async function buildBundle(options) {
  const eventSources = await loadEventSources(options);
  const auditEvents = [];
  const invalidEvents = [];

  for (const raw of eventSources.allRawEvents) {
    const event = auditPayload(raw);
    if (!event) continue;
    const issues = validateAuditEvent(event);
    if (issues.length > 0) {
      invalidEvents.push({ event_id: event.event_id ?? "", issues });
      continue;
    }
    auditEvents.push(event);
  }

  const matchedEvents = auditEvents.filter(event =>
    eventMatches(event, options)
  );
  const serviceEvidence = await optionalSource(options.serviceEvidence);
  const conformance = await optionalSource(options.conformance);
  const bundle = {
    schema: BUNDLE_SCHEMA,
    generated_at: new Date().toISOString(),
    subject: {
      org_id: options.org || "all",
      active_domain: options.domain || "all",
      from: options.from || null,
      to: options.to || null,
      release: options.release || null,
    },
    redaction_profile: options.redactionProfile,
    sources: {
      event_files: eventSources.sources,
      service_evidence: serviceEvidence,
      conformance_registry: conformance,
    },
    invariant_summary: buildSummary({
      rawEvents: eventSources.allRawEvents,
      auditEvents,
      invalidEvents,
      matchedEvents,
    }),
    source_refs: matchedEvents.map(sourceRef),
    events: matchedEvents,
    invalid_events: invalidEvents,
    manifest: {
      hash_algorithm: "sha256",
    },
  };

  bundle.manifest.manifest_hash = sha256(stableStringify(bundle));
  return bundle;
}

function printSummary(bundle, outPath) {
  console.log("HKI evidence bundle");
  console.log(`  schema: ${bundle.schema}`);
  console.log(`  org: ${bundle.subject.org_id}`);
  console.log(`  domain: ${bundle.subject.active_domain}`);
  console.log(`  events: ${bundle.invariant_summary.matched_events}`);
  console.log(
    `  invalid: ${bundle.invariant_summary.invalid_evidence_grade_events}`
  );
  console.log(`  bundle: ${outPath}`);
  console.log(`  hash: ${bundle.manifest.manifest_hash}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const bundle = await buildBundle(options);
  const outputPath = resolvePath(options.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );

  if (options.json) console.log(JSON.stringify(bundle, null, 2));
  else printSummary(bundle, options.out);

  if (options.requireEvents && bundle.invariant_summary.matched_events === 0) {
    console.error("No matching evidence-grade audit events found.");
    process.exitCode = 1;
  }
  if (
    !options.allowInvalid &&
    bundle.invariant_summary.invalid_evidence_grade_events > 0
  ) {
    console.error("Invalid evidence-grade audit events found.");
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
