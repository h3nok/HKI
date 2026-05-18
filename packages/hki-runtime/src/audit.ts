import {
  isForbiddenRuntimeDomain,
  normalizeDomain,
  normalizeDomainList,
  sameDomain,
} from "./domain";
import type { HkiEnvelope, HkiValidationIssue } from "./types";

export const HKI_AUDIT_EVENT_SCHEMA = "hki.audit.event.v1" as const;

export type HkiAuditPlane = "runtime" | "admin" | "publication" | "imported";

export interface HkiAuditEventSource {
  platform: string;
  service: string;
  environment?: string | undefined;
  collector?: string | undefined;
}

export interface HkiAuditEventActor {
  subject_id: string;
  email_hash?: string | undefined;
  role?: string | undefined;
}

export interface HkiAuditEventBoundary {
  org_id: string;
  active_domain: string;
  authorized_domains: readonly string[];
  policy_pack_id?: string | undefined;
  risk_tier?: string | undefined;
}

export interface HkiAuditEventOperation {
  type: string;
  name?: string | undefined;
  target_domain?: string | undefined;
  purpose?: string | undefined;
  plane?: HkiAuditPlane | undefined;
}

export interface HkiAuditEventDecision {
  outcome: string;
  reason?: string | undefined;
  requires_human_approval?: boolean | undefined;
}

export interface HkiAuditEventEvidence {
  trace_id?: string | undefined;
  request_id?: string | undefined;
  payload_hash?: string | undefined;
  payload_ref?: string | undefined;
  redaction_profile?: string | undefined;
}

export interface HkiAuditEvent {
  schema: typeof HKI_AUDIT_EVENT_SCHEMA | string;
  event_id: string;
  occurred_at: string;
  received_at: string;
  source: HkiAuditEventSource;
  actor: HkiAuditEventActor;
  boundary: HkiAuditEventBoundary;
  operation: HkiAuditEventOperation;
  decision: HkiAuditEventDecision;
  evidence?: HkiAuditEventEvidence | undefined;
}

export type HkiAuditEventValidationResult =
  | { ok: true; event: HkiAuditEvent }
  | { ok: false; issues: HkiValidationIssue[] };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function addMissingIssue(
  issues: HkiValidationIssue[],
  field: string,
  message = `${field} is required.`
) {
  issues.push({ code: "missing-field", field, message });
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  issues: HkiValidationIssue[],
  field = key
): string {
  const value = record[key];
  if (!isNonEmptyString(value)) {
    addMissingIssue(issues, field);
    return "";
  }
  return value.trim();
}

function validateBoundary(
  boundary: Record<string, unknown>,
  issues: HkiValidationIssue[]
) {
  const orgId = requireString(boundary, "org_id", issues, "boundary.org_id");
  const activeDomain = normalizeDomain(boundary.active_domain);
  const authorizedDomains = normalizeDomainList(boundary.authorized_domains);

  if (!activeDomain || isForbiddenRuntimeDomain(activeDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "boundary.active_domain",
      message:
        "boundary.active_domain must be present, non-global, and non-wildcard.",
    });
  }

  if (authorizedDomains.length === 0) {
    addMissingIssue(
      issues,
      "boundary.authorized_domains",
      "boundary.authorized_domains must contain at least the active domain."
    );
  }

  if (authorizedDomains.some(isForbiddenRuntimeDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "boundary.authorized_domains",
      message:
        "boundary.authorized_domains must not include global or wildcard domains.",
    });
  }

  if (
    activeDomain &&
    authorizedDomains.length > 0 &&
    !authorizedDomains.some(domain => sameDomain(domain, activeDomain))
  ) {
    issues.push({
      code: "unauthorized-domain",
      field: "boundary.active_domain",
      message: "boundary.active_domain must appear in authorized_domains.",
    });
  }

  return { orgId, activeDomain, authorizedDomains };
}

function validateOperationTarget(
  operation: Record<string, unknown>,
  activeDomain: string | null,
  issues: HkiValidationIssue[]
) {
  const plane =
    operation.plane === "admin" || operation.plane === "publication"
      ? operation.plane
      : "runtime";
  const targetDomain = normalizeDomain(operation.target_domain);

  if (!targetDomain) return;

  if (isForbiddenRuntimeDomain(targetDomain)) {
    issues.push({
      code: "invalid-domain",
      field: "operation.target_domain",
      message:
        "operation.target_domain must be non-global and non-wildcard when present.",
    });
    return;
  }

  if (
    plane === "runtime" &&
    activeDomain &&
    !sameDomain(targetDomain, activeDomain)
  ) {
    issues.push({
      code: "unauthorized-domain",
      field: "operation.target_domain",
      message:
        "runtime operation.target_domain must match boundary.active_domain.",
    });
  }
}

export function validateAuditEvent(
  input: unknown
): HkiAuditEventValidationResult {
  const record = asRecord(input);
  const issues: HkiValidationIssue[] = [];

  const schema = requireString(record, "schema", issues);
  if (schema && schema !== HKI_AUDIT_EVENT_SCHEMA) {
    issues.push({
      code: "invalid-version",
      field: "schema",
      message: `schema must be ${HKI_AUDIT_EVENT_SCHEMA}.`,
    });
  }

  const source = asRecord(record.source);
  const actor = asRecord(record.actor);
  const boundary = asRecord(record.boundary);
  const operation = asRecord(record.operation);
  const decision = asRecord(record.decision);

  requireString(record, "event_id", issues);
  requireString(record, "occurred_at", issues);
  requireString(record, "received_at", issues);
  requireString(source, "platform", issues, "source.platform");
  requireString(source, "service", issues, "source.service");
  requireString(actor, "subject_id", issues, "actor.subject_id");
  requireString(operation, "type", issues, "operation.type");
  requireString(decision, "outcome", issues, "decision.outcome");

  const { activeDomain } = validateBoundary(boundary, issues);
  validateOperationTarget(operation, activeDomain, issues);

  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, event: record as unknown as HkiAuditEvent };
}

export function auditBoundaryFromEnvelope(
  envelope: HkiEnvelope
): HkiAuditEventBoundary {
  return {
    org_id: envelope.org_id,
    active_domain: envelope.active_domain,
    authorized_domains: envelope.authorized_domains,
    policy_pack_id: envelope.policy_pack_id,
    risk_tier: envelope.risk_tier,
  };
}
