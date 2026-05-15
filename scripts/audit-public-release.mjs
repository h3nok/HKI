#!/usr/bin/env node
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootArg = process.argv[2] ?? ".";
const root = path.resolve(process.cwd(), rootArg);

if (!existsSync(root)) {
  console.error(
    `HKI public release audit failed: path does not exist: ${root}`
  );
  process.exit(2);
}

const skippedDirs = new Set([
  ".git",
  ".hg",
  ".svn",
  ".turbo",
  ".venv",
  "node_modules",
  "dist",
  "build",
  "__pycache__",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
]);

const contextualPrivateRefFiles = new Set([
  "docs/ARCHITECTURE.md",
  "docs/COMMUNITY_ENABLEMENT.md",
  "docs/HKI_PUBLIC_READINESS_PLAN.md",
  "docs/HKI_ROADMAP.md",
  "docs/HKI_SERVICE_EVIDENCE.md",
  "docs/REFERENCE_ARCHITECTURE_K8S.md",
  "scripts/audit-hki-conformance.mjs",
  "scripts/audit-public-release.mjs",
  "scripts/hki-ast-audit-ts.mjs",
  "scripts/hki_ast_audit.py",
]);

const contextualPrivateRefPrefixes = ["examples/reference-k8s/"];

const selfDescribingAuditFiles = new Set(["scripts/audit-public-release.mjs"]);

const pathRules = [
  {
    id: "terraform-state-file",
    test: relativePath =>
      /(^|\/)terraform\.tfstate(\.backup)?$/.test(relativePath),
  },
  {
    id: "terraform-vars-file",
    test: relativePath => /(^|\/)terraform\.tfvars$/.test(relativePath),
  },
  {
    id: "terraform-working-dir",
    test: relativePath => /(^|\/)\.terraform(\/|$)/.test(relativePath),
  },
  {
    id: "environment-file",
    test: relativePath => {
      const name = path.posix.basename(relativePath);
      return /^\.env(\..+)?$/.test(name) && !name.endsWith(".example");
    },
  },
  {
    id: "credential-directory",
    test: relativePath => /(^|\/)creds(\/|$)/.test(relativePath),
  },
  {
    id: "gcp-credential-json",
    test: relativePath =>
      /(^|\/)(gcp_creds|service[-_]?account.*)\.json$/i.test(relativePath),
  },
  {
    id: "private-key-file",
    test: relativePath => /\.(pem|p12|pfx|key)$/i.test(relativePath),
  },
];

const contentRules = [
  {
    id: "private-gcp-project-id",
    pattern: /\bp-642-[a-z0-9-]+\b/g,
  },
  {
    id: "private-cilab-marker",
    pattern: /\bcilabs?\b/g,
  },
  {
    id: "private-artifact-registry",
    pattern: /\b[a-z0-9-]+-docker\.pkg\.dev\/[A-Za-z0-9._/-]+/g,
  },
  {
    id: "gcp-service-account-key",
    pattern:
      /"type"\s*:\s*"service_account"|"private_key_id"\s*:|-----BEGIN PRIVATE KEY-----/g,
  },
  {
    id: "gcp-iam-service-account",
    pattern: /\b[A-Za-z0-9._%+-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com\b/g,
  },
  {
    id: "private-rfc1918-address",
    pattern:
      /\b(?:10|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b|\b172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g,
  },
  {
    id: "cloud-sql-instance-id",
    pattern:
      /\b[a-z][a-z0-9-]{4,}:(?:us|europe|asia|northamerica|southamerica|australia|me|africa)-[a-z]+[0-9]:[a-z][a-z0-9-]+\b/g,
  },
  {
    id: "private-hki-hostname",
    pattern: /\b[A-Za-z0-9.-]+\.hki\.com\b/g,
  },
  {
    id: "customer-name",
    pattern: /\b[Cc]ostco\b/g,
  },
];

const privateReferenceRules = [
  {
    id: "private-app-reference",
    pattern: /apps\/agentic/g,
  },
  {
    id: "private-services-reference",
    pattern: /services\//g,
  },
  {
    id: "private-docker-compose-reference",
    pattern: /docker-compose/g,
  },
  {
    id: "private-deploy-k8s-reference",
    pattern: /deploy\/k8s/g,
  },
  {
    id: "private-service-name",
    pattern:
      /\b(?:knowledge-api|ingestion-pipeline-service|orchestrator-service|analytics-service)\b/g,
  },
];

const findings = [];

function toRelative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function shouldSkipDir(name) {
  return skippedDirs.has(name);
}

function isContextualPrivateRefFile(relativePath) {
  return (
    contextualPrivateRefFiles.has(relativePath) ||
    contextualPrivateRefPrefixes.some(prefix => relativePath.startsWith(prefix))
  );
}

function addFinding(kind, id, relativePath, lineNumber) {
  findings.push({ kind, id, relativePath, lineNumber });
}

function isProbablyText(buffer) {
  if (buffer.length === 0) {
    return true;
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0);
}

function findLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanContent(relativePath, absolutePath) {
  const buffer = readFileSync(absolutePath);
  if (!isProbablyText(buffer)) {
    return;
  }

  const content = buffer.toString("utf8");

  if (!selfDescribingAuditFiles.has(relativePath)) {
    for (const rule of contentRules) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(content);
      if (match) {
        addFinding(
          "content",
          rule.id,
          relativePath,
          findLineNumber(content, match.index)
        );
      }
    }
  }

  if (isContextualPrivateRefFile(relativePath)) {
    return;
  }

  for (const rule of privateReferenceRules) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(content);
    if (match) {
      addFinding(
        "private-reference",
        rule.id,
        relativePath,
        findLineNumber(content, match.index)
      );
    }
  }
}

function scanEntry(absolutePath) {
  const stat = lstatSync(absolutePath);
  const relativePath = toRelative(absolutePath);

  if (stat.isDirectory()) {
    for (const rule of pathRules) {
      if (rule.test(relativePath + "/")) {
        addFinding("path", rule.id, relativePath || ".");
      }
    }

    const name = path.basename(absolutePath);
    if (shouldSkipDir(name)) {
      return;
    }

    for (const child of readdirSync(absolutePath)) {
      scanEntry(path.join(absolutePath, child));
    }
    return;
  }

  if (!stat.isFile()) {
    return;
  }

  for (const rule of pathRules) {
    if (rule.test(relativePath)) {
      addFinding("path", rule.id, relativePath);
    }
  }

  scanContent(relativePath, absolutePath);
}

scanEntry(root);

if (findings.length > 0) {
  console.error(`HKI public release audit failed for ${root}`);
  for (const finding of findings) {
    const location = finding.lineNumber
      ? `${finding.relativePath}:${finding.lineNumber}`
      : finding.relativePath;
    console.error(`- ${finding.kind}:${finding.id} at ${location}`);
  }
  process.exit(1);
}

console.log(`HKI public release audit passed for ${root}`);
