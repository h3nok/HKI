#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const update = args.has("--update");
const baselinePath = path.join(root, "scripts", "ui-token-audit-baseline.json");

const scanRoots = [
  "agentic/client/src",
  "packages/ui/src",
  "packages/ui/styles",
];

const ignoredPathParts = [
  "/node_modules/",
  "/dist/",
  "/.turbo/",
  "/coverage/",
  "/packages/ui/src/theme/",
  "/packages/ui/src/design-system/",
  "/packages/ui/tokens/",
  "/agentic/client/src/styles/",
  "/agentic/client/src/index.css",
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
    id: "hex-color",
    pattern: /(^|[^\w])#[0-9a-fA-F]{3,8}\b/g,
    message: "Use semantic CSS variables or @hki/ui tokens instead of hex colors.",
  },
  {
    id: "literal-rgb-hsl",
    pattern: /\b(?:rgb|rgba|hsl|hsla)\(\s*\d/g,
    message: "Use semantic CSS variables, color-mix, or tokenized alpha helpers.",
  },
  {
    id: "legacy-brand-copy",
    pattern: /\b(?:COSTCO|Costco|costco|Signature Design System|@signature\/ui)\b/g,
    message: "Remove legacy brand terms from public UI code.",
  },
  {
    id: "legacy-retail-domain",
    pattern: /\bretail\b/gi,
    message: "Use domain/value-stream/HKI examples instead of retail-specific copy.",
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
    if (!/\.(ts|tsx|js|jsx|css|md)$/.test(entry.name)) continue;
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
        sample: match[0].trim(),
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
  console.log(`Updated UI token audit baseline: ${baselinePath}`);
}

let baseline = null;
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

console.log("UI token audit");
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
  console.error("Strict UI token audit failed.");
  process.exit(1);
}

if (!strict && baseline && summary.total > baseline.total) {
  console.error(
    `UI token debt increased from baseline ${baseline.total} to ${summary.total}.`,
  );
  process.exit(1);
}

if (!strict && !baseline && summary.total > 0) {
  console.error("No baseline found. Run with --update or fix all findings.");
  process.exit(1);
}
