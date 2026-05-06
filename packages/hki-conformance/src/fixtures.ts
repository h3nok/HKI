import type {
  HkiArtifactLabel,
  HkiCacheKeyInput,
  HkiEnvelope,
  HkiGatewayTarget,
} from "@hki/runtime";

export const CONFORMANCE_NOW = 1777900100;

export const baseEnvelope: HkiEnvelope = {
  hki_version: "1.0",
  envelope_id: "env_hki_conformance",
  org_id: "org_acme",
  subject_id: "user_42",
  active_domain: "payments",
  authorized_domains: ["payments", "fraud"],
  purpose: "retrieve",
  risk_tier: "read-only",
  policy_pack_id: "policy_2026_05",
  issued_at: 1777900000,
  expires_at: 1777900300,
  issuer: "hki-conformance",
  signature: "sig_conformance",
};

export const globalEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_global",
  active_domain: "global",
  authorized_domains: ["global"],
};

export const wildcardEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_wildcard",
  active_domain: "*",
  authorized_domains: ["*"],
};

export const missingActiveDomainEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_missing_domain",
  active_domain: "",
};

export const unauthorizedEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_unauthorized",
  active_domain: "legal",
  authorized_domains: ["payments"],
};

export const expiredEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_expired",
  expires_at: CONFORMANCE_NOW - 1,
};

export const unsignedEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_unsigned",
  signature: undefined,
};

export const globalAuthorizedEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_global_authorized",
  authorized_domains: ["payments", "global"],
};

export const wildcardAuthorizedEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_wildcard_authorized",
  authorized_domains: ["payments", "*"],
};

export const wrongVersionEnvelope: HkiEnvelope = {
  ...baseEnvelope,
  envelope_id: "env_hki_wrong_version",
  hki_version: "0.9",
};

export const visibleArtifact: HkiArtifactLabel = {
  org_id: "org_acme",
  domain: "payments",
  artifact_type: "document",
  artifact_id: "doc_payment_policy",
};

export const globalArtifact: HkiArtifactLabel = {
  org_id: "org_acme",
  domain: "global",
  artifact_type: "document",
  artifact_id: "doc_global_policy",
};

export const wildcardArtifact: HkiArtifactLabel = {
  org_id: "org_acme",
  domain: "*",
  artifact_type: "document",
  artifact_id: "doc_wildcard_policy",
};

export const crossDomainArtifact: HkiArtifactLabel = {
  org_id: "org_acme",
  domain: "fraud",
  artifact_type: "document",
  artifact_id: "doc_fraud_model",
};

export const crossOrgArtifact: HkiArtifactLabel = {
  org_id: "org_other",
  domain: "payments",
  artifact_type: "document",
  artifact_id: "doc_other_org",
};

export const activeGatewayTarget: HkiGatewayTarget = {
  type: "tool",
  id: "retrieval.search",
  domain: "payments",
};

export const publishedGatewayTarget: HkiGatewayTarget = {
  type: "resource",
  id: "published.policy.release",
  domain: "policy-authoring",
  published_domains: ["payments"],
};

export const globalGatewayTarget: HkiGatewayTarget = {
  type: "tool",
  id: "global.search",
  domain: "global",
};

export const wildcardGatewayTarget: HkiGatewayTarget = {
  type: "tool",
  id: "wildcard.search",
  domain: "*",
};

export const wildcardPublishedGatewayTarget: HkiGatewayTarget = {
  type: "tool",
  id: "wildcard.published_search",
  domain: "search",
  published_domains: ["*"],
};

export const crossDomainGatewayTarget: HkiGatewayTarget = {
  type: "tool",
  id: "fraud.case_lookup",
  domain: "fraud",
};

export const cacheInput: HkiCacheKeyInput = {
  envelope: baseEnvelope,
  operation: "retrieval.search",
  input: { query: "refund window" },
  model_route: "gpt-5.4",
  context_version: "kb-v1",
};

export const crossDomainCacheInput: HkiCacheKeyInput = {
  ...cacheInput,
  envelope: {
    ...baseEnvelope,
    envelope_id: "env_hki_fraud",
    active_domain: "fraud",
  },
};

export const changedPolicyCacheInput: HkiCacheKeyInput = {
  ...cacheInput,
  envelope: {
    ...baseEnvelope,
    envelope_id: "env_hki_policy",
    policy_pack_id: "policy_2026_06",
  },
};

export const changedOperationCacheInput: HkiCacheKeyInput = {
  ...cacheInput,
  operation: "memory.read",
};
