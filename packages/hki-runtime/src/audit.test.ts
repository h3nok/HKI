import { describe, expect, it } from "vitest";

import {
  HKI_AUDIT_EVENT_SCHEMA,
  auditBoundaryFromEnvelope,
  validateAuditEvent,
  type HkiAuditEvent,
  type HkiEnvelope,
} from "./index";

const envelope: HkiEnvelope = {
  hki_version: "1.0",
  envelope_id: "env_test",
  org_id: "org_acme",
  subject_id: "user_42",
  active_domain: "payments",
  authorized_domains: ["payments"],
  purpose: "tool-call",
  risk_tier: "regulated",
  policy_pack_id: "payments@2026-05",
  issued_at: 1000,
  expires_at: 1300,
  issuer: "gateway",
};

function auditEvent(overrides: Partial<HkiAuditEvent> = {}): HkiAuditEvent {
  return {
    schema: HKI_AUDIT_EVENT_SCHEMA,
    event_id: "evt_1",
    occurred_at: "2026-05-16T00:00:00.000Z",
    received_at: "2026-05-16T00:00:01.000Z",
    source: {
      platform: "agentic-bff",
      service: "agentic",
      environment: "test",
      collector: "native",
    },
    actor: {
      subject_id: "user_42",
      role: "manager",
    },
    boundary: auditBoundaryFromEnvelope(envelope),
    operation: {
      type: "tool.call",
      name: "refund_lookup",
      target_domain: "payments",
      purpose: "support",
    },
    decision: {
      outcome: "allow",
      reason: "active-domain-match",
    },
    evidence: {
      trace_id: "trace_1",
      request_id: "req_1",
      payload_hash: "sha256:test",
      redaction_profile: "metadata-only",
    },
    ...overrides,
  };
}

describe("validateAuditEvent", () => {
  it("accepts an evidence-grade native runtime event", () => {
    const result = validateAuditEvent(auditEvent());
    expect(result.ok).toBe(true);
  });

  it("rejects audit events with unsupported schema versions", () => {
    const result = validateAuditEvent(
      auditEvent({ schema: "hki.audit.event.v0" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.code)).toContain(
        "invalid-version"
      );
    }
  });

  it("rejects missing active domains", () => {
    const result = validateAuditEvent(
      auditEvent({
        boundary: {
          ...auditBoundaryFromEnvelope(envelope),
          active_domain: "",
        },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.field)).toContain(
        "boundary.active_domain"
      );
    }
  });

  it("rejects global and wildcard audit boundaries", () => {
    for (const forbiddenDomain of ["global", "*"]) {
      const result = validateAuditEvent(
        auditEvent({
          boundary: {
            ...auditBoundaryFromEnvelope(envelope),
            active_domain: forbiddenDomain,
            authorized_domains: [forbiddenDomain],
          },
        })
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.map(issue => issue.code)).toContain(
          "invalid-domain"
        );
      }
    }
  });

  it("rejects runtime target domains outside the active domain", () => {
    const result = validateAuditEvent(
      auditEvent({
        operation: {
          type: "tool.call",
          target_domain: "fraud",
        },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "unauthorized-domain",
          field: "operation.target_domain",
        })
      );
    }
  });

  it("allows admin-plane audit events to reference another domain", () => {
    const result = validateAuditEvent(
      auditEvent({
        operation: {
          type: "audit.review",
          plane: "admin",
          target_domain: "fraud",
        },
      })
    );
    expect(result.ok).toBe(true);
  });
});
