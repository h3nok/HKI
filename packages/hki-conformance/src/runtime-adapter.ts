import {
  assertArtifactVisible,
  deriveHkiCacheKey,
  evaluateGatewayTarget,
  rejectConflictingScopeArgument,
  validateEnvelope,
  type HkiArtifactLabel,
  type HkiCacheKeyInput,
  type HkiEnvelope,
  type HkiGatewayTarget,
} from "@hki/runtime";

import { CONFORMANCE_NOW } from "./fixtures";
import type { HkiConformanceAdapter } from "./types";

export interface RuntimeConformanceAdapterOptions {
  now?: number;
}

export function createRuntimeConformanceAdapter(
  options: RuntimeConformanceAdapterOptions = {},
): HkiConformanceAdapter {
  const now = options.now ?? CONFORMANCE_NOW;

  return {
    name: "@hki/runtime",
    version: "0.1.0",
    validateEnvelope(envelope: HkiEnvelope) {
      return validateEnvelope(envelope, { now, requireSignature: true });
    },
    canReadArtifact(envelope: HkiEnvelope, artifact: HkiArtifactLabel) {
      return assertArtifactVisible(envelope, artifact) === null;
    },
    deriveCacheKey(input: HkiCacheKeyInput) {
      return deriveHkiCacheKey(input);
    },
    evaluateGatewayTarget(envelope: HkiEnvelope, target: HkiGatewayTarget) {
      return evaluateGatewayTarget(envelope, target);
    },
    rejectScopeOverride(envelope: HkiEnvelope, args: Record<string, unknown>) {
      return rejectConflictingScopeArgument(envelope, args) !== null;
    },
  };
}
