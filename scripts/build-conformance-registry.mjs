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
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : "conformance.json";
const strictRelease = args.includes("--strict-release");

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
      evidence_profile: deriveProbeEvidenceProfile(raw),
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
const implementation = {
  name: "hki-reference",
  repository: git("config --get remote.origin.url", "local"),
  commit: git("rev-parse HEAD", "unknown"),
  branch: git("rev-parse --abbrev-ref HEAD", "unknown"),
  dirty: git("status --porcelain", "") !== "",
};
const packages = {
  "@hki/runtime": readPackageVersion("packages/hki-runtime"),
  "@hki/conformance": readPackageVersion("packages/hki-conformance"),
  "hki-runtime-py": readPackageVersion("packages/hki-runtime-py"),
  "hki-litellm": readPackageVersion("packages/hki-litellm"),
  "hki-langchain": readPackageVersion("packages/hki-langchain"),
  "hki-llamaindex": readPackageVersion("packages/hki-llamaindex"),
  "hki-adk": readPackageVersion("packages/hki-adk"),
  "hki-autogen": readPackageVersion("packages/hki-autogen"),
  "hki-crewai": readPackageVersion("packages/hki-crewai"),
};

const passedCases =
  conformance && Array.isArray(conformance.results)
    ? conformance.results.filter(r => r.passed).length
    : null;
const totalCases =
  conformance && Array.isArray(conformance.results)
    ? conformance.results.length
    : null;
const level = deriveLevel({ conformance, baseline, threats, httpProbe });
const evidenceProfile = deriveEvidenceProfile(httpProbe);

const registry = {
  $schema: "https://hki.dev/schemas/conformance-registry/v1.json",
  generatedAt: new Date().toISOString(),
  implementation,
  packages,
  conformance: {
    passed: passedCases,
    total: totalCases,
    overallPassed: conformance?.passed ?? null,
    cases:
      conformance && Array.isArray(conformance.results)
        ? conformance.results.map(r => ({
            id: r.case?.id ?? r.id,
            title:
              r.case?.title ??
              r.title ??
              r.case?.requirement ??
              r.requirement ??
              null,
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
  evidenceProfile,
  releaseEvidence: buildReleaseEvidence({
    conformance,
    baseline,
    threats,
    ast,
    astTs,
    httpProbe,
    implementation,
    packages,
    level,
    evidenceProfile,
  }),
  level,
};

const schemaErrors = validateAgainstSchema(registry);
if (schemaErrors.length > 0) {
  console.error("Registry artifact failed schema validation:");
  for (const err of schemaErrors) console.error(`  - ${err}`);
  process.exit(1);
}

const resolvedOutPath = path.isAbsolute(outPath)
  ? outPath
  : path.join(root, outPath);
fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
fs.writeFileSync(resolvedOutPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (level=${registry.level}, evidenceProfile=${registry.evidenceProfile})`
);

if (
  strictRelease &&
  registry.releaseEvidence.releaseReadiness.blockers.length > 0
) {
  console.error("Release evidence is not strict-release eligible:");
  for (const blocker of registry.releaseEvidence.releaseReadiness.blockers) {
    console.error(`  - ${blocker.id}: ${blocker.message}`);
  }
  process.exit(1);
}

function buildReleaseEvidence({
  conformance,
  baseline,
  threats,
  ast,
  astTs,
  httpProbe,
  implementation,
  packages,
  level,
  evidenceProfile,
}) {
  const commandManifest = [
    {
      id: "adapter-conformance",
      command: "pnpm verify:hki-conformance",
      status: conformance?.passed === true ? "pass" : "fail",
      summary: {
        passed: passedCases,
        total: totalCases,
        mustFailed: conformance?.totals?.must_failed ?? null,
        shouldFailed: conformance?.totals?.should_failed ?? null,
      },
    },
    {
      id: "audit-baseline",
      command: "pnpm audit:hki",
      status: baseline ? "baseline-present" : "missing",
      summary: {
        total: baseline?.total ?? null,
        byRule: baseline?.byRule ?? null,
        generatedAt: baseline?.generatedAt ?? null,
      },
    },
    {
      id: "python-ast-audit",
      command: "pnpm audit:hki-ast",
      status: ast?.error
        ? "error"
        : ast?.blocking_count === 0
          ? "pass"
          : "fail",
      summary: ast?.error
        ? { error: ast.error }
        : {
            total: ast?.total ?? null,
            blocking: ast?.blocking_count ?? null,
            advisory: ast?.advisory_count ?? null,
          },
    },
    {
      id: "typescript-ast-audit",
      command: "pnpm audit:hki-ast-ts",
      status: astTs?.error
        ? "error"
        : astTs?.blocking_count === 0
          ? "pass"
          : "fail",
      summary: astTs?.error
        ? { error: astTs.error }
        : {
            total: astTs?.total ?? null,
            blocking: astTs?.blocking_count ?? null,
            advisory: astTs?.advisory_count ?? null,
          },
    },
    {
      id: "threat-catalog",
      command: "pnpm test:hki-threats",
      status: threats.length >= 15 ? "inventory-complete" : "incomplete",
      summary: {
        total: threats.length,
        expectedMinimum: 15,
        ids: threats,
      },
    },
    {
      id: "http-probe",
      command:
        evidenceProfile === "live"
          ? "hki-probe <live-url>"
          : "pnpm probe:smoke",
      status: httpProbe
        ? httpProbe.failed === 0 && httpProbe.passed > 0
          ? "pass"
          : "fail"
        : "missing",
      summary: httpProbe
        ? {
            passed: httpProbe.passed,
            failed: httpProbe.failed,
            total: httpProbe.total,
            evidenceProfile,
            target: httpProbe.target,
            bundleHash: httpProbe.bundle_hash,
          }
        : null,
    },
  ];

  const releaseReadiness = deriveReleaseReadiness({
    implementation,
    conformance,
    baseline,
    threats,
    ast,
    astTs,
    httpProbe,
    evidenceProfile,
  });

  const manifest = {
    schemaVersion: "1.0",
    level,
    evidenceProfile,
    generatedBy: "scripts/build-conformance-registry.mjs",
    commandManifest,
    componentHashes: {
      conformanceResults: sha256Json(conformance?.results ?? null),
      auditSummary: sha256Json({ baseline, ast, astTs }),
      threatCatalog: sha256Json(threats),
      packageVersions: sha256Json(packages),
      probeBundle: httpProbe?.bundle_hash ?? null,
    },
    verification: {
      schema: "packages/hki-conformance/schemas/conformance-registry-v1.json",
      reproduce: [
        "pnpm verify:hki-conformance",
        "pnpm audit:hki",
        "pnpm audit:hki-ast",
        "pnpm audit:hki-ast-ts",
        evidenceProfile === "live"
          ? "hki-probe <live-url>"
          : "pnpm probe:smoke",
        "pnpm registry:build",
      ],
      strictReleaseCommand:
        "node scripts/build-conformance-registry.mjs --strict-release",
    },
    releaseReadiness,
  };

  return {
    ...manifest,
    manifestHash: sha256Json(manifest),
  };
}

function deriveReleaseReadiness({
  implementation,
  conformance,
  baseline,
  threats,
  ast,
  astTs,
  httpProbe,
  evidenceProfile,
}) {
  const blockers = [];
  const warnings = [];

  if (implementation.dirty) {
    blockers.push({
      id: "dirty-worktree",
      message: "Generate release evidence from a clean commit.",
    });
  }
  if (conformance?.passed !== true) {
    blockers.push({
      id: "conformance-failed",
      message: "All adapter conformance cases must pass.",
    });
  }
  if (!baseline) {
    blockers.push({
      id: "missing-audit-baseline",
      message: "The HKI audit baseline must be present.",
    });
  }
  if ((ast?.blocking_count ?? 0) > 0 || (astTs?.blocking_count ?? 0) > 0) {
    blockers.push({
      id: "blocking-audit-findings",
      message: "Blocking AST audit findings must be resolved before release.",
    });
  }
  if (threats.length < 15) {
    blockers.push({
      id: "incomplete-threat-catalog",
      message: "The threat catalog must include at least HKI-T01..HKI-T15.",
    });
  }
  if (!httpProbe || httpProbe.failed !== 0 || httpProbe.passed <= 0) {
    blockers.push({
      id: "missing-probe-evidence",
      message: "HTTP probe evidence must exist and pass.",
    });
  }
  if (evidenceProfile === "smoke") {
    blockers.push({
      id: "smoke-evidence-only",
      message:
        "Strict release evidence requires live or release evidence, not local smoke evidence.",
    });
  }
  if ((ast?.advisory_count ?? 0) > 0 || (astTs?.advisory_count ?? 0) > 0) {
    warnings.push({
      id: "advisory-audit-findings",
      message:
        "Advisory audit findings remain; confirm they are documented or intentionally accepted.",
    });
  }

  return {
    strictReleaseEligible: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    warnings,
  };
}

function sha256Json(value) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null), "utf8")
    .digest("hex");
}

function deriveProbeEvidenceProfile(raw) {
  const baseUrl = String(raw?.target?.base_url ?? "");
  if (!baseUrl) return "none";
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(baseUrl)
    ? "smoke"
    : "live";
}

function deriveEvidenceProfile(httpProbe) {
  if (!httpProbe) return "none";
  return httpProbe.evidence_profile ?? deriveProbeEvidenceProfile(httpProbe);
}

function deriveLevel({ conformance, baseline, threats, httpProbe }) {
  const allCasesPassed = conformance?.passed === true;
  const noNewDebt = !!baseline; // baseline ratchet exists
  const hasThreats = threats.length >= 15;
  const probeAllPassed =
    httpProbe && httpProbe.failed === 0 && httpProbe.passed > 0;

  if (!allCasesPassed) return "L0-documented";
  if (allCasesPassed && noNewDebt && hasThreats && probeAllPassed)
    return "L4-tested";
  return "L3-enforced";
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
