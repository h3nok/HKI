import type { HkiConformanceCase, HkiConformanceCaseResult } from "./types";
import {
  activeGatewayTarget,
  baseEnvelope,
  cacheInput,
  changedOperationCacheInput,
  changedPolicyCacheInput,
  crossDomainArtifact,
  crossDomainCacheInput,
  crossDomainGatewayTarget,
  crossOrgArtifact,
  expiredEnvelope,
  globalArtifact,
  globalAuthorizedEnvelope,
  globalEnvelope,
  globalGatewayTarget,
  missingActiveDomainEnvelope,
  publishedGatewayTarget,
  unsignedEnvelope,
  unauthorizedEnvelope,
  visibleArtifact,
  wildcardArtifact,
  wildcardAuthorizedEnvelope,
  wildcardEnvelope,
  wildcardGatewayTarget,
  wildcardPublishedGatewayTarget,
  wrongVersionEnvelope,
} from "./fixtures";

type CaseMeta = Omit<HkiConformanceCaseResult, "passed" | "actual">;

function result(
  meta: CaseMeta,
  passed: boolean,
  actual: string
): HkiConformanceCaseResult {
  return {
    ...meta,
    passed,
    actual,
  };
}

function envelopeCase(
  meta: CaseMeta,
  envelope: typeof baseEnvelope,
  expectedOk: boolean
): HkiConformanceCase {
  return {
    ...meta,
    async run(adapter) {
      const validation = await adapter.validateEnvelope(envelope);
      return result(
        meta,
        validation.ok === expectedOk,
        validation.ok ? "accepted" : "rejected"
      );
    },
  };
}

function artifactCase(
  meta: CaseMeta,
  artifact: typeof visibleArtifact,
  expectedVisible: boolean
): HkiConformanceCase {
  return {
    ...meta,
    async run(adapter) {
      const visible = await adapter.canReadArtifact(baseEnvelope, artifact);
      return result(
        meta,
        visible === expectedVisible,
        visible ? "visible" : "blocked"
      );
    },
  };
}

function cacheDifferenceCase(
  meta: CaseMeta,
  candidateInput: typeof cacheInput
): HkiConformanceCase {
  return {
    ...meta,
    async run(adapter) {
      const activeKey = await adapter.deriveCacheKey(cacheInput);
      const candidateKey = await adapter.deriveCacheKey(candidateInput);
      const passed = activeKey.length > 0 && activeKey !== candidateKey;
      return result(meta, passed, passed ? "different cache keys" : "same key");
    },
  };
}

function gatewayCase(
  meta: CaseMeta,
  target: typeof activeGatewayTarget,
  expectedAllowed: boolean
): HkiConformanceCase {
  return {
    ...meta,
    async run(adapter) {
      const decision = await adapter.evaluateGatewayTarget(
        baseEnvelope,
        target
      );
      return result(
        meta,
        decision.allowed === expectedAllowed,
        decision.allowed ? "allowed" : "blocked"
      );
    },
  };
}

function scopeOverrideCase(
  meta: CaseMeta,
  args: Record<string, unknown>,
  expectedRejected: boolean
): HkiConformanceCase {
  return {
    ...meta,
    async run(adapter) {
      const rejected = await adapter.rejectScopeOverride(baseEnvelope, args);
      return result(
        meta,
        rejected === expectedRejected,
        rejected ? "blocked" : "allowed"
      );
    },
  };
}

const validEnvelopeMeta: CaseMeta = {
  id: "HKI-C01-valid-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement:
    "Accept a signed runtime envelope with one non-global active domain.",
  severity: "must",
  expected: "accepted",
};

const globalEnvelopeMeta: CaseMeta = {
  id: "HKI-C02-reject-global-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject a runtime envelope whose active domain is global.",
  severity: "must",
  expected: "rejected",
};

const unauthorizedEnvelopeMeta: CaseMeta = {
  id: "HKI-C03-reject-unauthorized-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement:
    "Reject an active domain that is not inside the authorized domain set.",
  severity: "must",
  expected: "rejected",
};

const missingActiveDomainMeta: CaseMeta = {
  id: "HKI-C04-reject-missing-active-domain",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject runtime envelopes with a missing active domain.",
  severity: "must",
  expected: "rejected",
};

const expiredEnvelopeMeta: CaseMeta = {
  id: "HKI-C05-reject-expired-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject expired runtime envelopes.",
  severity: "must",
  expected: "rejected",
};

const unsignedEnvelopeMeta: CaseMeta = {
  id: "HKI-C06-reject-unsigned-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement:
    "Reject unsigned envelopes at a runtime boundary that requires signatures.",
  severity: "must",
  expected: "rejected",
};

const globalAuthorizedEnvelopeMeta: CaseMeta = {
  id: "HKI-C07-reject-global-authorized-domain",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject authorized domain sets that include global.",
  severity: "must",
  expected: "rejected",
};

const wrongVersionEnvelopeMeta: CaseMeta = {
  id: "HKI-C08-reject-unsupported-hki-version",
  level: 2,
  surface: "runtime-envelope",
  requirement:
    "Reject envelopes that do not declare the supported HKI version.",
  severity: "must",
  expected: "rejected",
};

const visibleArtifactMeta: CaseMeta = {
  id: "HKI-C09-allow-active-domain-artifact",
  level: 3,
  surface: "artifact-read",
  requirement:
    "Allow artifact reads only when org and active domain labels match.",
  severity: "must",
  expected: "visible",
};

const crossDomainArtifactMeta: CaseMeta = {
  id: "HKI-C10-reject-cross-domain-artifact",
  level: 3,
  surface: "artifact-read",
  requirement: "Reject artifact reads from an authorized but inactive domain.",
  severity: "must",
  expected: "blocked",
};

const crossOrgArtifactMeta: CaseMeta = {
  id: "HKI-C11-reject-cross-org-artifact",
  level: 3,
  surface: "artifact-read",
  requirement: "Reject artifact reads from another organization.",
  severity: "must",
  expected: "blocked",
};

const globalArtifactMeta: CaseMeta = {
  id: "HKI-C12-reject-global-artifact",
  level: 3,
  surface: "artifact-read",
  requirement: "Reject runtime artifacts labeled as global.",
  severity: "must",
  expected: "blocked",
};

const cacheDomainMeta: CaseMeta = {
  id: "HKI-C13-cache-key-binds-active-domain",
  level: 3,
  surface: "cache",
  requirement: "Cache keys change when the active domain changes.",
  severity: "must",
  expected: "different cache keys",
};

const cachePolicyMeta: CaseMeta = {
  id: "HKI-C14-cache-key-binds-policy-pack",
  level: 3,
  surface: "cache",
  requirement: "Cache keys change when the policy pack changes.",
  severity: "must",
  expected: "different cache keys",
};

const cacheOperationMeta: CaseMeta = {
  id: "HKI-C15-cache-key-binds-operation",
  level: 3,
  surface: "cache",
  requirement: "Cache keys change when the runtime operation changes.",
  severity: "must",
  expected: "different cache keys",
};

const activeGatewayMeta: CaseMeta = {
  id: "HKI-C16-allow-active-domain-tool",
  level: 3,
  surface: "gateway",
  requirement: "Allow tools published into the active domain.",
  severity: "must",
  expected: "allowed",
};

const publishedGatewayMeta: CaseMeta = {
  id: "HKI-C17-allow-published-domain-target",
  level: 3,
  surface: "gateway",
  requirement: "Allow targets explicitly published into the active domain.",
  severity: "must",
  expected: "allowed",
};

const crossGatewayMeta: CaseMeta = {
  id: "HKI-C18-reject-cross-domain-tool",
  level: 3,
  surface: "gateway",
  requirement: "Reject tools published only into a non-active domain.",
  severity: "must",
  expected: "blocked",
};

const globalGatewayMeta: CaseMeta = {
  id: "HKI-C19-reject-global-gateway-target",
  level: 3,
  surface: "gateway",
  requirement: "Reject gateway targets labeled as global.",
  severity: "must",
  expected: "blocked",
};

const scopeOverrideMeta: CaseMeta = {
  id: "HKI-C20-reject-scope-override",
  level: 4,
  surface: "gateway",
  requirement:
    "Reject body or query arguments that attempt to override signed scope.",
  severity: "must",
  expected: "blocked",
};

const streamOverrideMeta: CaseMeta = {
  id: "HKI-C21-reject-stream-id-override",
  level: 4,
  surface: "gateway",
  requirement:
    "Reject stream_id arguments that attempt to override signed scope.",
  severity: "must",
  expected: "blocked",
};

const matchingScopeMeta: CaseMeta = {
  id: "HKI-C22-allow-matching-scope-argument",
  level: 4,
  surface: "gateway",
  requirement:
    "Allow explicit scope arguments only when they match signed scope.",
  severity: "should",
  expected: "allowed",
};

const wildcardEnvelopeMeta: CaseMeta = {
  id: "HKI-C23-reject-wildcard-envelope",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject wildcard runtime active domains.",
  severity: "must",
  expected: "rejected",
};

const wildcardAuthorizedEnvelopeMeta: CaseMeta = {
  id: "HKI-C24-reject-wildcard-authorized-domain",
  level: 2,
  surface: "runtime-envelope",
  requirement: "Reject authorized domain sets that include wildcard scope.",
  severity: "must",
  expected: "rejected",
};

const wildcardArtifactMeta: CaseMeta = {
  id: "HKI-C25-reject-wildcard-artifact",
  level: 3,
  surface: "artifact-read",
  requirement: "Reject runtime artifacts labeled with wildcard scope.",
  severity: "must",
  expected: "blocked",
};

const wildcardGatewayMeta: CaseMeta = {
  id: "HKI-C26-reject-wildcard-gateway-target",
  level: 3,
  surface: "gateway",
  requirement: "Reject gateway targets labeled with wildcard scope.",
  severity: "must",
  expected: "blocked",
};

const wildcardPublishedGatewayMeta: CaseMeta = {
  id: "HKI-C27-reject-wildcard-gateway-publication",
  level: 3,
  surface: "gateway",
  requirement: "Reject gateway targets published into wildcard scope.",
  severity: "must",
  expected: "blocked",
};

const arrayScopeOverrideMeta: CaseMeta = {
  id: "HKI-C28-reject-array-scope-override",
  level: 4,
  surface: "gateway",
  requirement:
    "Reject array-shaped scope arguments when any value widens signed scope.",
  severity: "must",
  expected: "blocked",
};

export const HKI_CONFORMANCE_CASES = [
  envelopeCase(validEnvelopeMeta, baseEnvelope, true),
  envelopeCase(globalEnvelopeMeta, globalEnvelope, false),
  envelopeCase(unauthorizedEnvelopeMeta, unauthorizedEnvelope, false),
  envelopeCase(missingActiveDomainMeta, missingActiveDomainEnvelope, false),
  envelopeCase(expiredEnvelopeMeta, expiredEnvelope, false),
  envelopeCase(unsignedEnvelopeMeta, unsignedEnvelope, false),
  envelopeCase(globalAuthorizedEnvelopeMeta, globalAuthorizedEnvelope, false),
  envelopeCase(wrongVersionEnvelopeMeta, wrongVersionEnvelope, false),
  artifactCase(visibleArtifactMeta, visibleArtifact, true),
  artifactCase(crossDomainArtifactMeta, crossDomainArtifact, false),
  artifactCase(crossOrgArtifactMeta, crossOrgArtifact, false),
  artifactCase(globalArtifactMeta, globalArtifact, false),
  cacheDifferenceCase(cacheDomainMeta, crossDomainCacheInput),
  cacheDifferenceCase(cachePolicyMeta, changedPolicyCacheInput),
  cacheDifferenceCase(cacheOperationMeta, changedOperationCacheInput),
  gatewayCase(activeGatewayMeta, activeGatewayTarget, true),
  gatewayCase(publishedGatewayMeta, publishedGatewayTarget, true),
  gatewayCase(crossGatewayMeta, crossDomainGatewayTarget, false),
  gatewayCase(globalGatewayMeta, globalGatewayTarget, false),
  scopeOverrideCase(scopeOverrideMeta, { scope: "fraud" }, true),
  scopeOverrideCase(streamOverrideMeta, { stream_id: "fraud" }, true),
  scopeOverrideCase(matchingScopeMeta, { scope: "payments" }, false),
  envelopeCase(wildcardEnvelopeMeta, wildcardEnvelope, false),
  envelopeCase(
    wildcardAuthorizedEnvelopeMeta,
    wildcardAuthorizedEnvelope,
    false
  ),
  artifactCase(wildcardArtifactMeta, wildcardArtifact, false),
  gatewayCase(wildcardGatewayMeta, wildcardGatewayTarget, false),
  gatewayCase(
    wildcardPublishedGatewayMeta,
    wildcardPublishedGatewayTarget,
    false
  ),
  scopeOverrideCase(
    arrayScopeOverrideMeta,
    { scope: ["payments", "fraud"] },
    true
  ),
] satisfies HkiConformanceCase[];
