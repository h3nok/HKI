import type {
  HkiArtifactLabel,
  HkiCacheKeyInput,
  HkiEnvelope,
  HkiGatewayDecision,
  HkiGatewayTarget,
  HkiValidationResult,
} from "@hki/runtime";

export type Awaitable<T> = T | Promise<T>;

export interface HkiConformanceAdapter {
  name: string;
  version?: string;
  validateEnvelope(envelope: HkiEnvelope): Awaitable<HkiValidationResult>;
  canReadArtifact(
    envelope: HkiEnvelope,
    artifact: HkiArtifactLabel,
  ): Awaitable<boolean>;
  deriveCacheKey(input: HkiCacheKeyInput): Awaitable<string>;
  evaluateGatewayTarget(
    envelope: HkiEnvelope,
    target: HkiGatewayTarget,
  ): Awaitable<HkiGatewayDecision>;
  rejectScopeOverride(
    envelope: HkiEnvelope,
    args: Record<string, unknown>,
  ): Awaitable<boolean>;
}

export type HkiConformanceSeverity = "must" | "should";

export interface HkiConformanceCase {
  id: string;
  level: 1 | 2 | 3 | 4;
  surface: string;
  requirement: string;
  severity: HkiConformanceSeverity;
  run(adapter: HkiConformanceAdapter): Promise<HkiConformanceCaseResult>;
}

export interface HkiConformanceCaseResult {
  id: string;
  level: 1 | 2 | 3 | 4;
  surface: string;
  requirement: string;
  severity: HkiConformanceSeverity;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface HkiConformanceReport {
  hki_version: "1.0";
  generated_at: string;
  adapter: {
    name: string;
    version?: string;
  };
  passed: boolean;
  totals: {
    passed: number;
    failed: number;
    must_failed: number;
    should_failed: number;
  };
  results: HkiConformanceCaseResult[];
}

export interface HkiConformanceRunOptions {
  cases?: HkiConformanceCase[];
}
