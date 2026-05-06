import {
  HKI_VERSION,
  type HkiArtifactLabel,
  type HkiEnvelope,
  type HkiValidationIssue,
  type HkiValidationResult,
} from "./types";
import {
  isForbiddenRuntimeDomain,
  normalizeDomain,
  normalizeDomainList,
  sameDomain,
} from "./domain";

export interface ValidateEnvelopeOptions {
  now?: number | undefined;
  maxFutureSkewSeconds?: number | undefined;
  requireSignature?: boolean | undefined;
}

const REQUIRED_STRING_FIELDS = [
  "hki_version",
  "envelope_id",
  "org_id",
  "subject_id",
  "active_domain",
  "purpose",
  "risk_tier",
  "policy_pack_id",
  "issuer",
] as const;

function addMissingStringIssues(
  input: Record<string, unknown>,
  issues: HkiValidationIssue[]
) {
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!normalizeDomain(input[field])) {
      issues.push({
        code: "missing-field",
        field,
        message: `${field} is required.`,
      });
    }
  }
}

export function validateEnvelope(
  input: Partial<HkiEnvelope> | Record<string, unknown>,
  options: ValidateEnvelopeOptions = {}
): HkiValidationResult {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? 60;
  const issues: HkiValidationIssue[] = [];
  const record = input as Record<string, unknown>;

  addMissingStringIssues(record, issues);

  const hkiVersion = normalizeDomain(record.hki_version);
  if (hkiVersion && hkiVersion !== HKI_VERSION) {
    issues.push({
      code: "invalid-version",
      field: "hki_version",
      message: `hki_version must be ${HKI_VERSION}.`,
    });
  }

  if (options.requireSignature && !normalizeDomain(record.signature)) {
    issues.push({
      code: "missing-field",
      field: "signature",
      message: "signature is required.",
    });
  }

  const activeDomain = normalizeDomain(record.active_domain);
  if (!activeDomain || isForbiddenRuntimeDomain(activeDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "active_domain",
      message: "active_domain must be present, non-global, and non-wildcard.",
    });
  }

  const authorizedDomains = normalizeDomainList(record.authorized_domains);
  if (authorizedDomains.length === 0) {
    issues.push({
      code: "missing-field",
      field: "authorized_domains",
      message: "authorized_domains must contain at least the active domain.",
    });
  }

  if (authorizedDomains.some(isForbiddenRuntimeDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "authorized_domains",
      message:
        "authorized_domains must not include global or wildcard domains.",
    });
  }

  if (
    activeDomain &&
    authorizedDomains.length > 0 &&
    !authorizedDomains.some(domain => sameDomain(domain, activeDomain))
  ) {
    issues.push({
      code: "unauthorized-domain",
      field: "active_domain",
      message: "active_domain must appear in authorized_domains.",
    });
  }

  const issuedAt = Number(record.issued_at);
  const expiresAt = Number(record.expires_at);
  if (!Number.isFinite(issuedAt)) {
    issues.push({
      code: "missing-field",
      field: "issued_at",
      message: "issued_at must be a numeric epoch timestamp.",
    });
  }
  if (!Number.isFinite(expiresAt)) {
    issues.push({
      code: "missing-field",
      field: "expires_at",
      message: "expires_at must be a numeric epoch timestamp.",
    });
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    issues.push({
      code: "expired-envelope",
      field: "expires_at",
      message: "envelope is expired.",
    });
  }
  if (Number.isFinite(issuedAt) && issuedAt > now + maxFutureSkewSeconds) {
    issues.push({
      code: "future-envelope",
      field: "issued_at",
      message: "issued_at is too far in the future.",
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    envelope: {
      hki_version: String(record.hki_version ?? HKI_VERSION),
      envelope_id: String(record.envelope_id),
      org_id: String(record.org_id),
      subject_id: String(record.subject_id),
      active_domain: String(activeDomain),
      authorized_domains: authorizedDomains,
      purpose: String(record.purpose),
      risk_tier: String(record.risk_tier),
      policy_pack_id: String(record.policy_pack_id),
      issued_at: issuedAt,
      expires_at: expiresAt,
      issuer: String(record.issuer),
      signature: normalizeDomain(record.signature) ?? undefined,
    },
  };
}

export function assertArtifactVisible(
  envelope: HkiEnvelope,
  artifact: HkiArtifactLabel
): HkiValidationIssue | null {
  if (
    !normalizeDomain(artifact.domain) ||
    isForbiddenRuntimeDomain(artifact.domain)
  ) {
    return {
      code: "invalid-domain",
      field: "domain",
      message: "artifact domain must be present, non-global, and non-wildcard.",
    };
  }

  if (!sameDomain(envelope.org_id, artifact.org_id)) {
    return {
      code: "artifact-scope-mismatch",
      field: "org_id",
      message: "artifact org_id does not match envelope org_id.",
    };
  }

  if (!sameDomain(envelope.active_domain, artifact.domain)) {
    return {
      code: "artifact-scope-mismatch",
      field: "domain",
      message: "artifact domain does not match envelope active_domain.",
    };
  }

  return null;
}
