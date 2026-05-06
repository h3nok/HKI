#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRuntimeConformanceAdapter } from "./runtime-adapter";
import { formatConformanceReport, runHkiConformance } from "./runner";
import type { HkiConformanceAdapter } from "./types";

const HELP = `HKI conformance runner

Usage:
  hki-conformance [adapter-module] [--json]
  hki-conformance --help

Adapter modules must export one of:
  default
  adapter
  createAdapter()

If no adapter module is provided, the runner uses the @hki/runtime reference adapter.`;

function isAdapter(value: unknown): value is HkiConformanceAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof HkiConformanceAdapter, unknown>>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.validateEnvelope === "function" &&
    typeof candidate.canReadArtifact === "function" &&
    typeof candidate.deriveCacheKey === "function" &&
    typeof candidate.evaluateGatewayTarget === "function" &&
    typeof candidate.rejectScopeOverride === "function"
  );
}

async function loadAdapter(adapterPath: string): Promise<HkiConformanceAdapter> {
  const url = pathToFileURL(resolve(adapterPath)).href;
  const moduleExports = (await import(url)) as Record<string, unknown>;
  const candidate =
    moduleExports.default ??
    moduleExports.adapter ??
    (typeof moduleExports.createAdapter === "function"
      ? await moduleExports.createAdapter()
      : undefined);

  if (!isAdapter(candidate)) {
    throw new Error(
      "Adapter module must export default, adapter, or createAdapter() matching HkiConformanceAdapter.",
    );
  }

  return candidate;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const json = args.includes("--json");
  const adapterPath = args.find(arg => !arg.startsWith("--"));
  const adapter = adapterPath
    ? await loadAdapter(adapterPath)
    : createRuntimeConformanceAdapter();
  const report = await runHkiConformance(adapter);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatConformanceReport(report));
  }

  process.exitCode = report.passed ? 0 : 1;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
