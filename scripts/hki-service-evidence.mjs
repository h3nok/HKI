#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SECRET = "local-dev-secret-key-12345";
const DEFAULT_TIMEOUT_MS = 10_000;
const ISSUER = "agentic-bff";
const AUDIENCE = "internal-services";
const ALGORITHM = "HS256";

function usage() {
  return `Usage: node scripts/hki-service-evidence.mjs [options]

Options:
  --targets <list>              Comma-separated targets. Default: all
  --out <file>                  Evidence bundle path. Default: artifacts/hki/service-evidence.json
  --json                        Print the full evidence bundle to stdout
  --timeout <ms>                Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --secret <value>              JWT signing secret. Default: SERVICE_AUTH_SECRET/JWT_SECRET/local dev secret
  --domain <id>                 Authorized runtime domain. Default: pharmacy
  --other-domain <id>           Unauthorized runtime domain. Default: optical
  --org <id>                    Authorized org. Default: default
  --other-org <id>              Unauthorized org. Default: other-org
  --subject <id>                JWT subject. Default: hki-evidence-probe
  --knowledge-api-url <url>     Override knowledge-api base URL
  --ingestion-pipeline-url <url> Override ingestion-pipeline base URL
  --orchestrator-url <url>      Override orchestrator base URL
  --analytics-url <url>         Override analytics base URL
`;
}

function parseArgs(argv) {
  const options = {
    out: "artifacts/hki/service-evidence.json",
    json: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    domain: "pharmacy",
    otherDomain: "optical",
    org: "default",
    otherOrg: "other-org",
    subject: "hki-evidence-probe",
    targets: null,
    secret:
      process.env.SERVICE_AUTH_SECRET ||
      process.env.JWT_SECRET ||
      DEFAULT_SECRET,
    knowledgeApiUrl:
      process.env.KNOWLEDGE_API_URL || process.env.VECTOR_STORE_URL,
    ingestionPipelineUrl: process.env.KNOWLEDGE_PIPELINE_URL,
    orchestratorUrl: process.env.ORCHESTRATOR_URL,
    analyticsUrl: process.env.ANALYTICS_URL,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [name, inlineValue] = arg.split("=", 2);
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      if (i >= argv.length) {
        throw new Error(`Missing value for ${name}`);
      }
      return argv[i];
    };

    switch (name) {
      case "--":
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--out":
        options.out = takeValue();
        break;
      case "--timeout":
        options.timeoutMs = Number(takeValue());
        break;
      case "--secret":
        options.secret = takeValue();
        break;
      case "--domain":
        options.domain = takeValue();
        break;
      case "--other-domain":
        options.otherDomain = takeValue();
        break;
      case "--org":
        options.org = takeValue();
        break;
      case "--other-org":
        options.otherOrg = takeValue();
        break;
      case "--subject":
        options.subject = takeValue();
        break;
      case "--targets":
        options.targets = takeValue()
          .split(",")
          .map(value => value.trim())
          .filter(Boolean);
        break;
      case "--knowledge-api-url":
        options.knowledgeApiUrl = takeValue();
        break;
      case "--ingestion-pipeline-url":
        options.ingestionPipelineUrl = takeValue();
        break;
      case "--orchestrator-url":
        options.orchestratorUrl = takeValue();
        break;
      case "--analytics-url":
        options.analyticsUrl = takeValue();
        break;
      default:
        throw new Error(`Unknown argument: ${name}`);
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }

  return options;
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(payload, secret) {
  const header = { alg: ALGORITHM, typ: "JWT" };
  const encoded = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function mintToken(options, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: options.subject,
    name: "HKI Evidence Probe",
    role: "admin",
    org_id: options.org,
    groups: ["role:admin"],
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: now + 30,
  };

  if (!overrides.omitScopeClaims) {
    payload.scope = overrides.scope ?? options.domain;
    payload.scopes = overrides.scopes ?? [payload.scope];
  }

  Object.assign(payload, overrides.claims ?? {});

  if (overrides.expOffsetSeconds !== undefined) {
    payload.exp = now + overrides.expOffsetSeconds;
  }

  return signJwt(payload, overrides.secret ?? options.secret);
}

function joinUrl(baseUrl, routePath, query) {
  const url = new URL(
    routePath,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function truncateBody(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 500 ? `${compact.slice(0, 500)}...` : compact;
}

async function request(baseUrl, probe, token, timeoutMs) {
  const url = joinUrl(baseUrl, probe.path, probe.query);
  const headers = {
    Accept: "application/json",
    ...(probe.headers ?? {}),
  };

  let body;
  if (probe.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(probe.body);
  }

  if (token !== null) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Service-Auth"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: probe.method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      url: String(url),
      body_excerpt: truncateBody(text),
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      url: String(url),
      body_excerpt: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function tokenForCase(options, caseDef) {
  switch (caseDef.auth) {
    case "valid":
      return mintToken(options);
    case "missing":
      return null;
    case "malformed":
      return "not.a.jwt";
    case "expired":
      return mintToken(options, { expOffsetSeconds: -60 });
    case "missing-scope":
      return mintToken(options, { omitScopeClaims: true });
    case "global-scope":
      return mintToken(options, { scope: "global", scopes: ["global"] });
    case "global-in-scopes":
      return mintToken(options, {
        scope: options.domain,
        scopes: [options.domain, "global"],
      });
    case "wrong-signature":
      return mintToken(options, { secret: `${options.secret}-wrong` });
    default:
      throw new Error(`Unknown auth case: ${caseDef.auth}`);
  }
}

function statusPassed(actualStatus, expected) {
  if (expected.kind === "success") {
    return actualStatus >= 200 && actualStatus < 300;
  }
  return expected.statuses.includes(actualStatus);
}

function targetDefinitions(options) {
  return [
    {
      id: "knowledge-api",
      baseUrl: options.knowledgeApiUrl || "http://localhost:9509",
      probes: [
        {
          id: "stats",
          method: "GET",
          path: "/v1/stats",
          title: "Knowledge stats",
        },
      ],
    },
    {
      id: "ingestion-pipeline",
      baseUrl: options.ingestionPipelineUrl || "http://localhost:9508",
      probes: [
        {
          id: "jobs",
          method: "GET",
          path: "/v1/jobs",
          title: "Ingestion jobs",
        },
      ],
      additionalCases: [
        {
          id: "cross-stream-ingest-rejected",
          title: "Cross-stream ingestion request is rejected",
          probe: {
            method: "POST",
            path: "/v1/ingest/text",
            body: {
              content:
                "HKI evidence probe content. This request should be rejected before ingestion.",
              title: "HKI Evidence Probe",
              document_type: "policy",
              stream_id: options.otherDomain,
            },
          },
          auth: "valid",
          expected: {
            description: "403",
            statuses: [403],
          },
          severity: "critical",
        },
      ],
    },
    {
      id: "orchestrator",
      baseUrl: options.orchestratorUrl || "http://localhost:9501",
      probes: [
        {
          id: "tools",
          method: "GET",
          path: "/v1/tools",
          title: "Tool catalog",
        },
      ],
    },
    {
      id: "analytics",
      baseUrl: options.analyticsUrl || "http://localhost:9510",
      probes: [
        {
          id: "events-summary",
          method: "GET",
          path: "/v1/events/summary",
          title: "Analytics summary",
        },
      ],
      additionalCases: [
        {
          id: "cross-stream-summary-rejected",
          title: "Cross-stream analytics summary request is rejected",
          probe: {
            method: "GET",
            path: "/v1/events/summary",
            query: { stream_id: options.otherDomain },
          },
          auth: "valid",
          expected: {
            description: "403",
            statuses: [403],
          },
          severity: "critical",
        },
        {
          id: "cross-org-summary-rejected",
          title: "Cross-org analytics summary request is rejected",
          probe: {
            method: "GET",
            path: "/v1/events/summary",
            query: { org_id: options.otherOrg },
          },
          auth: "valid",
          expected: {
            description: "403",
            statuses: [403],
          },
          severity: "critical",
        },
      ],
    },
  ];
}

const STANDARD_AUTH_CASES = [
  {
    id: "valid-scoped-token",
    title: "Valid scoped JWT is accepted",
    auth: "valid",
    expected: { kind: "success", description: "2xx" },
    severity: "critical",
  },
  {
    id: "missing-token-rejected",
    title: "Missing service JWT is rejected",
    auth: "missing",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "malformed-token-rejected",
    title: "Malformed service JWT is rejected",
    auth: "malformed",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "expired-token-rejected",
    title: "Expired service JWT is rejected",
    auth: "expired",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "missing-scope-rejected",
    title: "JWT without runtime scope is rejected",
    auth: "missing-scope",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "global-scope-rejected",
    title: "Global runtime scope is rejected",
    auth: "global-scope",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "global-in-scopes-rejected",
    title: "Global scope inside scopes array is rejected",
    auth: "global-in-scopes",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
  {
    id: "wrong-signature-rejected",
    title: "Wrong JWT signature is rejected",
    auth: "wrong-signature",
    expected: { description: "401", statuses: [401] },
    severity: "critical",
  },
];

function standardCasesForProbe(target, probe) {
  return STANDARD_AUTH_CASES.map(caseDef => ({
    ...caseDef,
    id: `${target.id}.${probe.id}.${caseDef.id}`,
    service: target.id,
    endpoint: `${probe.method} ${probe.path}`,
    title: `${probe.title}: ${caseDef.title}`,
    probe,
  }));
}

async function runCase(options, target, caseDef) {
  const actual = await request(
    target.baseUrl,
    caseDef.probe,
    tokenForCase(options, caseDef),
    options.timeoutMs
  );
  const passed = statusPassed(actual.status, caseDef.expected);
  return {
    id: caseDef.id,
    service: target.id,
    endpoint:
      caseDef.endpoint ?? `${caseDef.probe.method} ${caseDef.probe.path}`,
    title: caseDef.title,
    severity: caseDef.severity,
    outcome: passed ? "passed" : "failed",
    expected: caseDef.expected.description,
    actual,
  };
}

function buildBundle(options, results) {
  const failed = results.filter(result => result.outcome === "failed").length;
  const passed = results.filter(result => result.outcome === "passed").length;
  const bundle = {
    hki_version: 1,
    profile: "strict-jwt-service-boundaries",
    generated_at: new Date().toISOString(),
    configuration: {
      domain: options.domain,
      other_domain: options.otherDomain,
      org: options.org,
      other_org: options.otherOrg,
      timeout_ms: options.timeoutMs,
    },
    target_count: new Set(results.map(result => result.service)).size,
    passed,
    failed,
    skipped: 0,
    results,
  };
  bundle.bundle_hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(bundle))
    .digest("hex");
  return bundle;
}

function printSummary(bundle, outputPath) {
  console.log("HKI service evidence");
  console.log(`  profile: ${bundle.profile}`);
  console.log(`  targets: ${bundle.target_count}`);
  console.log(`  passed: ${bundle.passed}`);
  console.log(`  failed: ${bundle.failed}`);
  console.log(`  bundle: ${outputPath}`);
  console.log(`  hash: ${bundle.bundle_hash}`);

  const failures = bundle.results.filter(result => result.outcome === "failed");
  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failures) {
      const detail = failure.actual.error
        ? `${failure.actual.status} ${failure.actual.error}`
        : `${failure.actual.status} ${failure.actual.body_excerpt}`;
      console.log(
        `  - ${failure.id}: expected ${failure.expected}, got ${detail}`.slice(
          0,
          240
        )
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const selectedTargets = new Set(options.targets ?? []);
  const targets = targetDefinitions(options).filter(
    target => selectedTargets.size === 0 || selectedTargets.has(target.id)
  );
  if (targets.length === 0) {
    throw new Error(`No targets matched: ${(options.targets ?? []).join(",")}`);
  }

  const unknownTargets = [...selectedTargets].filter(
    targetId =>
      !targetDefinitions(options).some(target => target.id === targetId)
  );
  if (unknownTargets.length > 0) {
    throw new Error(`Unknown target(s): ${unknownTargets.join(", ")}`);
  }

  const results = [];
  for (const target of targets) {
    for (const probe of target.probes) {
      for (const caseDef of standardCasesForProbe(target, probe)) {
        results.push(await runCase(options, target, caseDef));
      }
    }
    for (const caseDef of target.additionalCases ?? []) {
      results.push(
        await runCase(options, target, {
          ...caseDef,
          id: `${target.id}.${caseDef.id}`,
          service: target.id,
          endpoint: `${caseDef.probe.method} ${caseDef.probe.path}`,
        })
      );
    }
  }

  const bundle = buildBundle(options, results);
  const outputPath = path.resolve(options.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );

  if (options.json) {
    console.log(JSON.stringify(bundle, null, 2));
  } else {
    printSummary(bundle, outputPath);
  }

  if (bundle.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
