/**
 * HKI runtime primitives — envelope validation, cache keying,
 * gateway decisions, telemetry, and domain helpers.
 *
 * @example
 * import { validateEnvelope, deriveHkiCacheKey } from "@hki/sdk/runtime"
 */
export {
  GLOBAL_DOMAIN,
  HKI_VERSION,
  type HkiArtifactLabel,
  type HkiCacheKeyInput,
  type HkiEnvelope,
  type HkiGatewayDecision,
  type HkiGatewayTarget,
  type HkiPurpose,
  type HkiRiskTier,
  type HkiSpanLike,
  type HkiValidationCode,
  type HkiValidationIssue,
  type HkiValidationResult,
} from "@hki/runtime";

export {
  isGlobalDomain,
  normalizeDomain,
  normalizeDomainList,
  sameDomain,
} from "@hki/runtime";

export {
  assertArtifactVisible,
  validateEnvelope,
  type ValidateEnvelopeOptions,
} from "@hki/runtime";

export { assertCacheKeyBoundToEnvelope, deriveHkiCacheKey } from "@hki/runtime";
export { evaluateGatewayTarget, rejectConflictingScopeArgument } from "@hki/runtime";
export { applyHkiTraceAttributes, hkiTraceAttributes } from "@hki/runtime";
export { stableStringify } from "@hki/runtime";
