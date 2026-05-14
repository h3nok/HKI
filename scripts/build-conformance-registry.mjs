#!/usr/bin/env node
/**
 * M9 — Evidence registry builder.
 *
 * Aggregates the outputs of every HKI gate into a single signed-by-CI
 * `conformance.json` artifact:
 *
 *   - hki conformance cases (pass/fail counts, per-case status)
 *   - audit:hki findings + baseline ratchet
 *   - threat catalog coverage (T01..Tn)
 *   - hki-runtime / hki-runtime-py / hki-litellm / hki-langchain test totals
 *   - commit SHA, branch, build timestamp
 *
 * This is the artifact that other implementations point at when they
 * publish their own `conformance.json` against the HKI registry.
 *
 * Usage:
 *   node scripts/build-conformance-registry.mjs [--out=conformance.json]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : "conformance.json";

function git(cmd, fallback = "") {
  try {
    return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function exec(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readPackageVersion(rel) {
  const p = path.join(root, rel, "package.json");
  if (fs.existsSync(p))
    return JSON.parse(fs.readFileSync(p, "utf8")).version ?? null;
  const py = path.join(root, rel, "pyproject.toml");
  if (fs.existsSync(py)) {
    const m = fs.readFileSync(py, "utf8").match(/^version\s*=\s*"([^"]+)"/m);
    return m ? m[1] : null;
  }
  return null;
}

function loadJson(relPath) {
  const p = path.join(root, relPath);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function runConformance() {
  try {
    // Build first so dist/cli.js exists, then call the CLI directly with --json.
    exec("pnpm -s build:hki-runtime");
    exec("pnpm -s build:hki-conformance");
    const out = exec("node packages/hki-conformance/dist/cli.js --json");
    const start = out.indexOf("{");
    const json = start >= 0 ? out.slice(start) : out;
    return JSON.parse(json);
  } catch (err) {
    return { error: err.message ?? String(err) };
  }
}

function listThreats() {
  const dir = path.join(root, "examples", "threats");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith("HKI-T"))
    .map(d => d.name)
    .sort();
}

function readBaseline() {
  const p = path.join(root, "scripts", "hki-conformance-audit-baseline.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function runAstAudit() {
  try {
    const out = exec(
      "uv run --with libcst python scripts/hki_ast_audit.py --json"
    );
    const start = out.indexOf("{");
    return JSON.parse(start >= 0 ? out.slice(start) : out);
  } catch (err) {
    return { error: err.message ?? String(err) };
  }
}

function loadProbeEvidence() {
  // Probe:smoke writes to /tmp/hki-evidence.json; also support --probe-evidence=<path> arg.
  const overrideArg = args.find(a => a.startsWith("--probe-evidence="));
  const evidencePath = overrideArg
    ? overrideArg.slice("--probe-evidence=".length)
    : "/tmp/hki-evidence.json";
  if (!fs.existsSync(evidencePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    return {
      passed: raw.passed ?? null,
      failed: raw.failed ?? null,
      total: (raw.passed ?? 0) + (raw.failed ?? 0),
      level_claim: raw.level_claim ?? null,
      bundle_hash: raw.bundle_hash ?? null,
      target: raw.target ?? null,
      generated_at: raw.generated_at ?? null,
    };
  } catch {
    return null;
  }
}

function runAstAuditTs() {
  try {
    const out = exec("node scripts/hki-ast-audit-ts.mjs --json");
    const start = out.indexOf("{");
    return JSON.parse(start >= 0 ? out.slice(start) : out);
  } catch (err) {
    return { error: err.message ?? String(err) };
  }
}

const conformance = runConformance();
const baseline = readBaseline();
const threats = listThreats();
const ast = runAstAudit();
const astTs = runAstAuditTs();
const httpProbe = loadProbeEvidence();

const passedCases =
  conformance && Array.isArray(conformance.results)
    ? conformance.results.filter(r => r.passed).length
    : null;
const totalCases =
  conformance && Array.isArray(conformance.results)
    ? conformance.results.length
    : null;

const registry = {
  $schema: "https://hki.dev/schemas/conformance-registry/v1.json",
  generatedAt: new Date().toISOString(),
  implementation: {
    name: "hki-reference",
    repository: git("config --get remote.origin.url", "local"),
    commit: git("rev-parse HEAD", "unknown"),
    branch: git("rev-parse --abbrev-ref HEAD", "unknown"),
    dirty: git("status --porcelain", "") !== "",
  },
  packages: {
    "@hki/runtime": readPackageVersion("packages/hki-runtime"),
    "@hki/conformance": readPackageVersion("packages/hki-conformance"),
    "hki-runtime-py": readPackageVersion("packages/hki-runtime-py"),
    "hki-litellm": readPackageVersion("packages/hki-litellm"),
    "hki-langchain": readPackageVersion("packages/hki-langchain"),
    "hki-llamaindex": readPackageVersion("packages/hki-llamaindex"),
    "hki-adk": readPackageVersion("packages/hki-adk"),
    "hki-autogen": readPackageVersion("packages/hki-autogen"),
    "hki-crewai": readPackageVersion("packages/hki-crewai"),
  },
  conformance: {
    passed: passedCases,
    total: totalCases,
    overallPassed: conformance?.passed ?? null,
    cases:
      conformance && Array.isArray(conformance.results)
        ? conformance.results.map(r => ({
            id: r.case?.id ?? r.id,
            title: r.case?.title ?? r.title ?? null,
            severity: r.case?.severity ?? r.severity ?? null,
            passed: r.passed,
          }))
        : null,
    error: conformance?.error ?? null,
  },
  audit: {
    baseline: baseline?.total ?? null,
    byRule: baseline?.byRule ?? null,
    ast: ast?.error
      ? { error: ast.error }
      : {
          total: ast?.total ?? null,
          blocking: ast?.blocking_count ?? null,
          advisory: ast?.advisory_count ?? null,
        },
    astTs: astTs?.error
      ? { error: astTs.error }
      : {
          total: astTs?.total ?? null,
          blocking: astTs?.blocking_count ?? null,
          advisory: astTs?.advisory_count ?? null,
        },
    baselineGeneratedAt: baseline?.generatedAt ?? null,
  },
  threats: {
    total: threats.length,
    ids: threats,
  },
  httpProbe: httpProbe,
  level: deriveLevel({ conformance, baseline, threats, httpProbe }),
};

const schemaErrors = validateAgainstSchema(registry);
if (schemaErrors.length > 0) {
  console.error("Registry artifact failed schema validation:");
  for (const err of schemaErrors) console.error(`  - ${err}`);
  process.exit(1);
}

fs.writeFileSync(
  path.join(root, outPath),
  `${JSON.stringify(registry, null, 2)}\n`
);
console.log(`Wrote ${outPath} (level=${registry.level})`);

function deriveLevel({ conformance, baseline, threats, httpProbe }) {
  const allCasesPassed = conformance?.passed === true;
  const noNewDebt = !!baseline; // baseline ratchet exists
  const hasThreats = threats.length >= 15;
  const probeAllPassed =
    httpProbe && httpProbe.failed === 0 && httpProbe.passed > 0;

  if (!allCasesPassed) return "L0-non-conformant";
  if (allCasesPassed && noNewDebt && hasThreats && probeAllPassed)
    return "L4-deployed";
  if (allCasesPassed && noNewDebt && hasThreats) return "L3-evidenced";
  if (allCasesPassed && noNewDebt) return "L2-baseline";
  return "L1-passing";
}

/**
 * Minimal JSON-Schema validator covering the subset we use in
 * conformance-registry-v1.json: type, required, enum, pattern, properties,
 * additionalProperties, items, minimum, minLength, uniqueItems, anyOf,
 * format (date-time + uri are best-effort).
 */
function validateAgainstSchema(value) {
  const schemaPath = path.join(
    root,
    "packages/hki-conformance/schemas/conformance-registry-v1.json"
  );
  if (!fs.existsSync(schemaPath)) return [];
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const errors = [];
  validate(value, schema, "$", errors);
  return errors;
}

function validate(value, schema, pointer, errors) {
  if (!schema || typeof schema !== "object") return;
  if (schema.anyOf) {
    const branchErrors = schema.anyOf.map(s => {
      const e = [];
      validate(value, s, pointer, e);
      return e;
    });
    if (!branchErrors.some(e => e.length === 0)) {
      errors.push(`${pointer}: did not match any anyOf branch`);
    }
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(
      `${pointer}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`
    );
    return;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = jsonType(value);
    if (!types.includes(actual)) {
      errors.push(`${pointer}: type ${actual} not in ${JSON.stringify(types)}`);
      return;
    }
    if (actual === "null") return;
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${pointer}: minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${pointer}: does not match pattern ${schema.pattern}`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${pointer}: minimum ${schema.minimum}`);
    }
  }
  if (Array.isArray(value)) {
    if (
      schema.uniqueItems &&
      new Set(value.map(v => JSON.stringify(v))).size !== value.length
    ) {
      errors.push(`${pointer}: items must be unique`);
    }
    if (schema.items) {
      value.forEach((item, i) =>
        validate(item, schema.items, `${pointer}[${i}]`, errors)
      );
    }
  }
  if (jsonType(value) === "object") {
    for (const req of schema.required ?? []) {
      if (!(req in value))
        errors.push(`${pointer}: missing required property "${req}"`);
    }
    for (const [k, v] of Object.entries(value)) {
      const propSchema = schema.properties?.[k];
      if (propSchema) {
        validate(v, propSchema, `${pointer}.${k}`, errors);
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        validate(v, schema.additionalProperties, `${pointer}.${k}`, errors);
      }
    }
  }
}

function jsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}
