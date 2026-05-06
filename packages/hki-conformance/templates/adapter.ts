import type { HkiConformanceAdapter } from "@hki/conformance";
import {
  assertArtifactVisible,
  deriveHkiCacheKey,
  evaluateGatewayTarget,
  rejectConflictingScopeArgument,
  validateEnvelope,
} from "@hki/runtime";

export default {
  name: "my-agent-gateway",
  version: "0.1.0",
  validateEnvelope(envelope) {
    return validateEnvelope(envelope, {
      requireSignature: true,
    });
  },
  canReadArtifact(envelope, artifact) {
    return assertArtifactVisible(envelope, artifact) === null;
  },
  deriveCacheKey(input) {
    return deriveHkiCacheKey(input);
  },
  evaluateGatewayTarget(envelope, target) {
    return evaluateGatewayTarget(envelope, target);
  },
  rejectScopeOverride(envelope, args) {
    return rejectConflictingScopeArgument(envelope, args) !== null;
  },
} satisfies HkiConformanceAdapter;
