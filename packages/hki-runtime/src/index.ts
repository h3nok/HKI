export {
  GLOBAL_DOMAIN,
  HKI_VERSION,
  WILDCARD_DOMAIN,
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
} from "./types";
export {
  isForbiddenRuntimeDomain,
  isGlobalDomain,
  isWildcardDomain,
  normalizeDomain,
  normalizeDomainList,
  sameDomain,
} from "./domain";
export {
  assertArtifactVisible,
  validateEnvelope,
  type ValidateEnvelopeOptions,
} from "./envelope";
export { assertCacheKeyBoundToEnvelope, deriveHkiCacheKey } from "./cache";
export {
  evaluateGatewayTarget,
  rejectConflictingScopeArgument,
} from "./gateway";
export { applyHkiTraceAttributes, hkiTraceAttributes } from "./telemetry";
export { stableStringify } from "./stable-stringify";
export { signEnvelope, verifyEnvelopeSignature } from "./signing";
export {
  HKI_AUDIT_EVENT_SCHEMA,
  auditBoundaryFromEnvelope,
  validateAuditEvent,
  type HkiAuditEvent,
  type HkiAuditEventActor,
  type HkiAuditEventBoundary,
  type HkiAuditEventDecision,
  type HkiAuditEventEvidence,
  type HkiAuditEventOperation,
  type HkiAuditEventSource,
  type HkiAuditEventValidationResult,
  type HkiAuditPlane,
} from "./audit";
