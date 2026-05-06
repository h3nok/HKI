import { describe, expect, it } from "vitest";

import { activeGatewayTarget, baseEnvelope } from "./fixtures";
import type { HkiConformanceAdapter } from "./types";
import { createRuntimeConformanceAdapter, runHkiConformance } from "./index";

describe("runHkiConformance", () => {
  it("passes the HKI runtime reference adapter", async () => {
    const report = await runHkiConformance(createRuntimeConformanceAdapter());

    expect(report.passed).toBe(true);
    expect(report.totals.failed).toBe(0);
  });

  it("fails adapters that widen runtime isolation", async () => {
    const permissiveAdapter: HkiConformanceAdapter = {
      name: "permissive-test-adapter",
      validateEnvelope() {
        return { ok: true, envelope: baseEnvelope };
      },
      canReadArtifact() {
        return true;
      },
      deriveCacheKey() {
        return "shared-key";
      },
      evaluateGatewayTarget() {
        return {
          allowed: true,
          reason: "permissive",
          target: activeGatewayTarget,
        };
      },
      rejectScopeOverride() {
        return false;
      },
    };

    const report = await runHkiConformance(permissiveAdapter);

    expect(report.passed).toBe(false);
    expect(report.totals.must_failed).toBeGreaterThanOrEqual(1);
    expect(report.results.some(item => item.id === "HKI-C10-reject-cross-domain-artifact")).toBe(
      true,
    );
  });
});
