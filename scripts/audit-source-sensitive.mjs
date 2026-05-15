#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
});

if (repoRootResult.status !== 0) {
  console.error("source sensitive audit must run inside a git repository");
  process.exit(2);
}

const repoRoot = repoRootResult.stdout.trim();
const filesResult = spawnSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
});

if (filesResult.status !== 0) {
  console.error("failed to list tracked files for source sensitive audit");
  process.exit(filesResult.status ?? 1);
}

const trackedFiles = filesResult.stdout.split("\n").filter(Boolean);
const findings = [];

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
    id: "credential-json",
    test: relativePath =>
      /(^|\/)(gcp_creds|service[-_]?account.*|.*credentials.*)\.json$/i.test(
        relativePath
      ),
  },
  {
    id: "private-key-file",
    test: relativePath => /\.(pem|p12|pfx|key)$/i.test(relativePath),
  },
  {
    id: "kubeconfig-file",
    test: relativePath => /(^|\/)(kubeconfig|\.kube)(\/|$)/.test(relativePath),
  },
];

const selfDescribingFiles = new Set([
  "scripts/audit-public-release.mjs",
  "scripts/audit-source-sensitive.mjs",
]);

const contentRules = [
  {
    id: "private-key-material",
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/g,
  },
  {
    id: "gcp-service-account-key",
    pattern:
      /"type"\s*:\s*"service_account"|"private_key_id"\s*:|-----BEGIN PRIVATE KEY-----/g,
  },
  {
    id: "aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "google-api-key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "google-oauth-token",
    pattern: /\bya29\.[0-9A-Za-z_-]+\b/g,
  },
  {
    id: "github-token",
    pattern: /\b(?:ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g,
  },
  {
    id: "openai-style-token",
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]+\b/g,
  },
];

function isProbablyText(buffer) {
  if (buffer.length === 0) {
    return true;
  }
  return !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

for (const relativePath of trackedFiles) {
  for (const rule of pathRules) {
    if (rule.test(relativePath)) {
      findings.push({ kind: "path", id: rule.id, relativePath });
    }
  }

  if (selfDescribingFiles.has(relativePath)) {
    continue;
  }

  const absolutePath = path.join(repoRoot, relativePath);
  const buffer = readFileSync(absolutePath);
  if (!isProbablyText(buffer)) {
    continue;
  }

  const content = buffer.toString("utf8");
  for (const rule of contentRules) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(content);
    if (match) {
      findings.push({
        kind: "content",
        id: rule.id,
        relativePath,
        lineNumber: lineNumber(content, match.index),
      });
    }
  }
}

if (findings.length > 0) {
  console.error("HKI source sensitive audit failed");
  for (const finding of findings) {
    const location = finding.lineNumber
      ? `${finding.relativePath}:${finding.lineNumber}`
      : finding.relativePath;
    console.error(`- ${finding.kind}:${finding.id} at ${location}`);
  }
  process.exit(1);
}

console.log("HKI source sensitive audit passed");
