export const HKI_VERSION = "1.0" as const;
export const GLOBAL_DOMAIN = "global" as const;
export const WILDCARD_DOMAIN = "*" as const;

export type HkiPurpose =
  | "chat"
  | "retrieve"
  | "ingest"
  | "review"
  | "publish"
  | "tool-call"
  | "memory"
  | "cache"
  | "eval"
  | "admin";

export type HkiRiskTier =
  | "read-only"
  | "write"
  | "regulated"
  | "destructive"
  | "privileged";

export interface HkiEnvelope {
  hki_version: typeof HKI_VERSION | string;
  envelope_id: string;
  org_id: string;
  subject_id: string;
  active_domain: string;
  authorized_domains: readonly string[];
  purpose: HkiPurpose | string;
  risk_tier: HkiRiskTier | string;
  policy_pack_id: string;
  issued_at: number;
  expires_at: number;
  issuer: string;
  signature?: string | undefined;
}

export interface HkiArtifactLabel {
  org_id: string;
  domain: string;
  artifact_type: string;
  artifact_id: string;
  provenance_id?: string | undefined;
}

export type HkiValidationCode =
  | "missing-field"
  | "invalid-version"
  | "invalid-domain"
  | "unauthorized-domain"
  | "expired-envelope"
  | "future-envelope"
  | "artifact-scope-mismatch";

export interface HkiValidationIssue {
  code: HkiValidationCode;
  field: string;
  message: string;
}

export type HkiValidationResult =
  | { ok: true; envelope: HkiEnvelope }
  | { ok: false; issues: HkiValidationIssue[] };

export interface HkiCacheKeyInput {
  envelope: HkiEnvelope;
  operation: string;
  input: unknown;
  model_route?: string | undefined;
  context_version?: string | undefined;
  extra?:
    | Record<string, string | number | boolean | null | undefined>
    | undefined;
}

export interface HkiGatewayTarget {
  type: "tool" | "agent" | "resource" | "model" | "memory" | "retrieval";
  id: string;
  domain: string;
  published_domains?: readonly string[] | undefined;
}

export interface HkiGatewayDecision {
  allowed: boolean;
  reason: string;
  target: HkiGatewayTarget;
}

export interface HkiSpanLike {
  setAttribute?:
    | ((key: string, value: string | number | boolean) => unknown)
    | undefined;
}
