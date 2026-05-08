#!/usr/bin/env node
/**
 * HKI TypeScript AST audit (M6 — TS half).
 *
 * Walks every first-party TypeScript file, parses it with the bundled
 * TypeScript compiler API, and finds untrusted reads of scope-like fields
 * on request-body identifiers — e.g. `input.streamId`, `body["active_domain"]`.
 *
 * Each finding is classified by surface and guard presence, identical to the
 * Python AST audit:
 *
 *   - **public**  — public route handler, no HKI guard call in the same fn
 *   - **internal** — internal/admin/mcp file path or fn name
 *   - **guarded** — finds a known guard call in the same fn (treated advisory)
 *
 * Output (text or `--json`):
 *
 *   total / blocking / advisory counts and per-finding location.
 *
 * Exit code 1 iff any blocking finding exists.
 *
 * Run:
 *   pnpm audit:hki-ast-ts
 *   node scripts/hki-ast-audit-ts.mjs --json > findings.json
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const SCAN_ROOTS = [
  "apps/agentic/server",
  "packages/chat/src",
  "packages/sdk/src",
  "packages/ui/src",
  "packages/hki-runtime/src",
];

const SCOPE_FIELDS = new Set([
  "stream_id",
  "streamId",
  "active_domain",
  "activeDomain",
  "valueStreamId",
]);
const BODY_NAMES = new Set([
  "body",
  "payload",
  "input",
  "inputs",
  "args",
  "kwargs",
]);
const HKI_GUARDS = new Set([
  "rejectScopeOverride",
  "rejectConflictingScopeArgument",
  "validateEnvelope",
  "deriveHkiCacheKey",
  // Project-specific resolvers / authorization checks treated as guards.
  "resolveAuthorizedStreamId",
  "requireAuthorizedStreamId",
  "resolveKnowledgeStreamId",
  "resolveKnowledgeRuntimeStreamId",
  "resolveGeminiKnowledgeStreamId",
  "resolveJourneyStreamId",
  "resolvePersistedConnectorStreamId",
  "requirePersistedConnectorStreamId",
  "requireConnectorStreamId",
  "requireConnectorSelectionStreamId",
  "resolveValueStream",
  "ensureManagerHasStreamAccess",
  "ensureStreamAccess",
  "requireStreamAccess",
  "getScopedStreamMatchers",
  "assertScopeAuthorized",
]);
const INTERNAL_FILE_MARKERS = [
  "/internal/",
  "/admin/",
  "/mcp/",
  ".internal.",
  ".admin.",
  "/admin.ts",
  "/admin.tsx",
  "/mcp-",
];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
  "__tests__",
]);

const SKIP_FILE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
  /\.test\.tsx$/,
];

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const strictInternal = args.has("--strict-internal");

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
    if (SKIP_FILE_PATTERNS.some(p => p.test(entry.name))) continue;
    yield full;
  }
}

function classifySurface(filePath, fnName) {
  const norm = filePath.replaceAll(path.sep, "/");
  if (INTERNAL_FILE_MARKERS.some(m => norm.includes(m))) return "internal";
  if (/(?:^|\W)(internal|admin|mcp)[A-Z_]/.test(fnName ?? ""))
    return "internal";
  return "public";
}

function getNameOfNode(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

function isScopeField(name) {
  return SCOPE_FIELDS.has(name);
}

function isBodyId(node) {
  return ts.isIdentifier(node) && BODY_NAMES.has(node.text);
}

function isLhsAssignment(node) {
  // Walk up to detect being on the LHS of `=`, `+=`, etc.
  let cur = node;
  while (cur && cur.parent) {
    const parent = cur.parent;
    if (ts.isBinaryExpression(parent) && parent.left === cur) {
      const kind = parent.operatorToken.kind;
      if (
        kind === ts.SyntaxKind.EqualsToken ||
        (kind >= ts.SyntaxKind.PlusEqualsToken &&
          kind <= ts.SyntaxKind.CaretEqualsToken)
      ) {
        return true;
      }
    }
    if (
      ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent) ||
      ts.isParenthesizedExpression(parent)
    ) {
      cur = parent;
      continue;
    }
    return false;
  }
  return false;
}

function findEnclosingFunction(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur)
    ) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function functionGuards(fnNode) {
  const guards = new Set();
  if (!fnNode || !fnNode.body) return guards;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = getNameOfNode(node.expression);
      if (callee && HKI_GUARDS.has(callee)) guards.add(callee);
    }
    ts.forEachChild(node, visit);
  }
  visit(fnNode.body);
  return guards;
}

function functionDisplayName(fnNode) {
  if (!fnNode) return "<top-level>";
  if (ts.isFunctionDeclaration(fnNode) && fnNode.name) return fnNode.name.text;
  if (
    ts.isMethodDeclaration(fnNode) &&
    fnNode.name &&
    ts.isIdentifier(fnNode.name)
  ) {
    return fnNode.name.text;
  }
  // Variable-bound arrow / function expression
  let p = fnNode.parent;
  while (p) {
    if (ts.isVariableDeclaration(p) && p.name && ts.isIdentifier(p.name))
      return p.name.text;
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name))
      return p.name.text;
    p = p.parent;
  }
  return "<anonymous>";
}

function lineOf(sourceFile, pos) {
  const lc = sourceFile.getLineAndCharacterOfPosition(pos);
  return lc.line + 1;
}

function scanFile(filePath, findings) {
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true
  );
  const rel = path.relative(REPO, filePath);

  function record(node, expression) {
    const fn = findEnclosingFunction(node);
    const fnName = functionDisplayName(fn);
    const guards = functionGuards(fn);
    const surface = classifySurface(rel, fnName);
    const has_guard = guards.size > 0;
    findings.push({
      file: rel,
      line: lineOf(sourceFile, node.getStart(sourceFile)),
      function: fnName,
      expression,
      surface,
      has_guard,
      blocking: surface === "public" && !has_guard,
    });
  }

  function visit(node) {
    // input.streamId
    if (ts.isPropertyAccessExpression(node)) {
      const exp = node.expression;
      const fld = node.name?.text;
      if (isBodyId(exp) && fld && isScopeField(fld) && !isLhsAssignment(node)) {
        record(node, `${exp.text}.${fld}`);
      }
    }
    // input["streamId"]
    if (ts.isElementAccessExpression(node)) {
      const exp = node.expression;
      const idx = node.argumentExpression;
      if (
        isBodyId(exp) &&
        idx &&
        ts.isStringLiteralLike(idx) &&
        isScopeField(idx.text) &&
        !isLhsAssignment(node)
      ) {
        record(node, `${exp.text}["${idx.text}"]`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const findings = [];
for (const root of SCAN_ROOTS) {
  for (const file of walk(path.join(REPO, root))) {
    scanFile(file, findings);
  }
}

if (strictInternal) {
  for (const f of findings) {
    if (!f.has_guard && f.surface === "internal") {
      f.surface = "public";
      f.blocking = true;
    }
  }
}

const blocking = findings.filter(f => f.blocking);
const advisory = findings.filter(f => !f.blocking);

if (asJson) {
  process.stdout.write(
    JSON.stringify(
      {
        total: findings.length,
        blocking_count: blocking.length,
        advisory_count: advisory.length,
        blocking,
        advisory,
      },
      null,
      2
    ) + "\n"
  );
} else {
  console.log(
    `HKI TS AST audit: total=${findings.length} blocking=${blocking.length} advisory=${advisory.length}`
  );
  if (blocking.length > 0) {
    console.log("\nBLOCKING:");
    for (const f of blocking) {
      console.log(`  ${f.file}:${f.line} ${f.function} -> ${f.expression}`);
    }
  } else {
    console.log("No blocking TS AST findings.");
  }
  if (advisory.length > 0) {
    const counts = new Map();
    for (const f of advisory)
      counts.set(f.surface, (counts.get(f.surface) ?? 0) + 1);
    console.log(`\nADVISORY (${advisory.length}):`);
    for (const [k, v] of [...counts.entries()].sort())
      console.log(`  ${k}: ${v}`);
  }
}

process.exitCode = blocking.length > 0 ? 1 : 0;
