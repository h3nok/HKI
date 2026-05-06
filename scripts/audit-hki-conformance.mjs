#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const update = args.has("--update");
const baselinePath = path.join(root, "scripts", "hki-conformance-audit-baseline.json");

const scanRoots = [
  "agentic/server",
  "knowledge-api/src",
  "ingestion-pipeline-service/src",
  "orchestrator-service/src",
  "shared",
];

const ignoredPathParts = [
  "/node_modules/",
  "/dist/",
  "/.turbo/",
  "/coverage/",
  "/__pycache__/",
  "/tests/",
  ".test.",
  ".spec.",
];

const ignoredExtensions = new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".map",
]);

const rules = [
  {
    id: "runtime-global-default",
    pattern:
      /\b(?:scope|scopes|stream_id|streamId|active_domain|activeDomain)\s*(?::\s*[\w.[\] |]+)?=\s*(?:Field\([^)]*default\s*=\s*)?["']global["']|\bdefault\s*=\s*["']global["']/g,
    message: "Runtime scope must not default to global on HKI-conformant paths.",
  },
  {
    id: "implicit-global-fallback",
    pattern:
      /\b(?:or|\?\?)\s*(?:GLOBAL_SCOPE|["']global["'])|\belse\s+(?:GLOBAL_SCOPE|["']global["'])|\|\|\s*(?:GLOBAL_SCOPE|["']global["'])/g,
    message: "Use fail-closed handling or explicit admin-plane routing instead of global fallback.",
  },
  {
    id: "global-copy-contract",
    pattern: /\b(?:org-global|global fallback|global documents|unscoped documents|null means org-global)\b/gi,
    message: "Shared knowledge should be explicit publication, not org-global runtime visibility.",
  },
  {
    id: "nullable-domain-query",
    pattern: /\b(?:domain|scope|stream|value_stream)[\w."]*\s+IS\s+NULL\b|\bOR\b[^;\n]*(?:domain|scope|stream|value_stream)[\w."]*\s*=\s*["']global["']/gi,
    message: "Runtime queries must reject null/global wildcard visibility.",
  },
];

function walk(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];

  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(abs, entry.name);
    const rel = path.relative(root, full);
    const normalized = `/${rel.split(path.sep).join("/")}`;

    if (ignoredPathParts.some(part => normalized.includes(part))) continue;

    if (entry.isDirectory()) {
      files.push(...walk(rel));
      continue;
    }

    if (ignoredExtensions.has(path.extname(entry.name))) continue;
    if (!/\.(ts|tsx|js|jsx|py|sql|yaml|yml)$/.test(entry.name)) continue;
    files.push(rel);
  }

  return files;
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

const findings = [];

for (const file of scanRoots.flatMap(walk)) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        rule: rule.id,
        file,
        line: lineForOffset(text, match.index ?? 0),
        sample: match[0].trim().replace(/\s+/g, " "),
        message: rule.message,
      });
    }
  }
}

const summary = findings.reduce(
  (acc, finding) => {
    acc.total += 1;
    acc.byRule[finding.rule] = (acc.byRule[finding.rule] ?? 0) + 1;
    return acc;
  },
  { total: 0, byRule: {} },
);

if (update) {
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), ...summary }, null, 2)}\n`,
  );
  console.log(`Updated HKI conformance audit baseline: ${baselinePath}`);
}

let baseline = null;
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

console.log("HKI conformance audit");
console.log(`  total: ${summary.total}`);
for (const [rule, count] of Object.entries(summary.byRule).sort()) {
  console.log(`  ${rule}: ${count}`);
}

for (const finding of findings.slice(0, 40)) {
  console.log(
    `${finding.file}:${finding.line} ${finding.rule} ${JSON.stringify(finding.sample)}`,
  );
}
if (findings.length > 40) {
  console.log(`... ${findings.length - 40} additional finding(s) omitted`);
}

if (strict && summary.total > 0) {
  console.error("Strict HKI conformance audit failed.");
  process.exit(1);
}

if (!strict && baseline && summary.total > baseline.total) {
  console.error(
    `HKI conformance debt increased from baseline ${baseline.total} to ${summary.total}.`,
  );
  process.exit(1);
}

if (!strict && !baseline && summary.total > 0) {
  console.error("No baseline found. Run with --update or fix all findings.");
  process.exit(1);
}
