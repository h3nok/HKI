import { describe, expect, it } from "vitest";

import {
  assertArtifactVisible,
  assertCacheKeyBoundToEnvelope,
  deriveHkiCacheKey,
  evaluateGatewayTarget,
  rejectConflictingScopeArgument,
  validateEnvelope,
  type HkiEnvelope,
} from "./index";

const envelope: HkiEnvelope = {
  hki_version: "1.0",
  envelope_id: "env_test",
  org_id: "org_acme",
  subject_id: "user_42",
  active_domain: "payments",
  authorized_domains: ["payments", "fraud"],
  purpose: "retrieve",
  risk_tier: "read-only",
  policy_pack_id: "policy_current",
  issued_at: 1000,
  expires_at: 1300,
  issuer: "gateway",
  signature: "sig",
};

describe("validateEnvelope", () => {
  it("accepts a non-global active domain authorized by the envelope", () => {
    const result = validateEnvelope(envelope, {
      now: 1100,
      requireSignature: true,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects global runtime scope", () => {
    const result = validateEnvelope(
      { ...envelope, active_domain: "global", authorized_domains: ["global"] },
      { now: 1100 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.code)).toContain(
        "invalid-domain"
      );
    }
  });

  it("rejects wildcard runtime scope", () => {
    const result = validateEnvelope(
      { ...envelope, active_domain: "*", authorized_domains: ["*"] },
      { now: 1100 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.code)).toContain(
        "invalid-domain"
      );
    }
  });

  it("rejects active domains outside authorized domains", () => {
    const result = validateEnvelope(
      { ...envelope, active_domain: "legal", authorized_domains: ["payments"] },
      { now: 1100 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.code)).toContain(
        "unauthorized-domain"
      );
    }
  });

  it("rejects unsupported HKI envelope versions", () => {
    const result = validateEnvelope(
      { ...envelope, hki_version: "0.9" },
      { now: 1100 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(issue => issue.code)).toContain(
        "invalid-version"
      );
    }
  });
});

describe("artifact visibility", () => {
  it("allows exact-domain artifacts", () => {
    expect(
      assertArtifactVisible(envelope, {
        org_id: "org_acme",
        domain: "payments",
        artifact_type: "document",
        artifact_id: "doc_1",
      })
    ).toBeNull();
  });

  it("rejects cross-domain artifacts", () => {
    const issue = assertArtifactVisible(envelope, {
      org_id: "org_acme",
      domain: "fraud",
      artifact_type: "document",
      artifact_id: "doc_2",
    });
    expect(issue?.code).toBe("artifact-scope-mismatch");
  });

  it("rejects wildcard artifact labels", () => {
    const issue = assertArtifactVisible(envelope, {
      org_id: "org_acme",
      domain: "*",
      artifact_type: "document",
      artifact_id: "doc_wildcard",
    });
    expect(issue?.code).toBe("invalid-domain");
  });
});

describe("cache keys", () => {
  it("binds cache keys to org and active domain", () => {
    const key = deriveHkiCacheKey({
      envelope,
      operation: "search",
      input: { q: "refund policy" },
      model_route: "gpt-5.4",
      context_version: "kb-v1",
    });
    expect(assertCacheKeyBoundToEnvelope(key, envelope)).toBe(true);
    expect(key).toContain("payments");
  });
});

describe("gateway targets", () => {
  it("allows targets in active domain", () => {
    const decision = evaluateGatewayTarget(envelope, {
      type: "tool",
      id: "search",
      domain: "payments",
    });
    expect(decision.allowed).toBe(true);
  });

  it("rejects conflicting tool scope arguments", () => {
    expect(
      rejectConflictingScopeArgument(envelope, { scope: "fraud" })
    ).toMatch(/conflicts/);
  });

  it("rejects array-shaped scope overrides", () => {
    expect(
      rejectConflictingScopeArgument(envelope, { scope: ["payments", "fraud"] })
    ).toMatch(/conflicts/);
  });

  it("rejects wildcard gateway publication", () => {
    const decision = evaluateGatewayTarget(envelope, {
      type: "tool",
      id: "wildcard.search",
      domain: "search",
      published_domains: ["*"],
    });
    expect(decision.allowed).toBe(false);
  });
});
