import { HKI_CONFORMANCE_CASES } from "./cases";
import type {
  HkiConformanceAdapter,
  HkiConformanceReport,
  HkiConformanceRunOptions,
} from "./types";

export async function runHkiConformance(
  adapter: HkiConformanceAdapter,
  options: HkiConformanceRunOptions = {},
): Promise<HkiConformanceReport> {
  const cases = options.cases ?? HKI_CONFORMANCE_CASES;
  const results = [];

  for (const testCase of cases) {
    results.push(await testCase.run(adapter));
  }

  const failed = results.filter(item => !item.passed);
  const mustFailed = failed.filter(item => item.severity === "must");
  const shouldFailed = failed.filter(item => item.severity === "should");

  const adapterInfo: HkiConformanceReport["adapter"] = {
    name: adapter.name,
  };

  if (adapter.version !== undefined) {
    adapterInfo.version = adapter.version;
  }

  return {
    hki_version: "1.0",
    generated_at: new Date().toISOString(),
    adapter: adapterInfo,
    passed: failed.length === 0,
    totals: {
      passed: results.length - failed.length,
      failed: failed.length,
      must_failed: mustFailed.length,
      should_failed: shouldFailed.length,
    },
    results,
  };
}

export function formatConformanceReport(report: HkiConformanceReport): string {
  const heading = [
    `HKI conformance report for ${report.adapter.name}`,
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Passed: ${report.totals.passed}`,
    `Failed: ${report.totals.failed}`,
  ];

  const rows = report.results.map(item => {
    const status = item.passed ? "PASS" : "FAIL";
    return `${status} ${item.id} ${item.requirement} (${item.actual})`;
  });

  return [...heading, "", ...rows].join("\n");
}
