/**
 * M4 schema freeze tests — Zod parsers and backward-compatibility.
 *
 * These tests are the formal proof that the schema contract is frozen at
 * hki/1.0. Any change that makes a previously-valid envelope invalid, or
 * a previously-invalid envelope valid, is a breaking change and requires
 * a new version identifier.
 */

import { describe, expect, it } from "vitest";
import {
  HkiArtifactLabelSchema,
  HkiEnvelopeSchema,
  HkiGatewayTargetSchema,
} from "./schema";

const NOW = 1_777_900_000;

const VALID_ENVELOPE = {
  hki_version: "1.0" as const,
  envelope_id: "env_compat_01",
  org_id: "org_acme",
  subject_id: "user_42",
  active_domain: "payments",
  authorized_domains: ["payments", "fraud"],
  purpose: "retrieve",
  risk_tier: "read-only",
  policy_pack_id: "policy_2026_05",
  issued_at: NOW,
  expires_at: NOW + 300,
  issuer: "urn:hki:gateway",
  signature: "sig_conformance",
};

// ---------------------------------------------------------------------------
// Envelope schema
// ---------------------------------------------------------------------------

describe("HkiEnvelopeSchema — backward-compat", () => {
  it("accepts the canonical conformance fixture (must never fail post-freeze)", () => {
    const result = HkiEnvelopeSchema.safeParse(VALID_ENVELOPE);
    expect(result.success).toBe(true);
  });

  it("accepts envelope without optional signature field", () => {
    const { signature: _, ...withoutSig } = VALID_ENVELOPE;
    expect(HkiEnvelopeSchema.safeParse(withoutSig).success).toBe(true);
  });

  it("rejects wrong hki_version", () => {
    expect(
      HkiEnvelopeSchema.safeParse({ ...VALID_ENVELOPE, hki_version: "0.9" }).success
    ).toBe(false);
  });

  it("rejects global active_domain", () => {
    expect(
      HkiEnvelopeSchema.safeParse({
        ...VALID_ENVELOPE,
        active_domain: "global",
        authorized_domains: ["global"],
      }).success
    ).toBe(false);
  });

  it("rejects wildcard active_domain", () => {
    expect(
      HkiEnvelopeSchema.safeParse({
        ...VALID_ENVELOPE,
        active_domain: "*",
        authorized_domains: ["*"],
      }).success
    ).toBe(false);
  });

  it("rejects global in authorized_domains", () => {
    expect(
      HkiEnvelopeSchema.safeParse({
        ...VALID_ENVELOPE,
        authorized_domains: ["payments", "global"],
      }).success
    ).toBe(false);
  });

  it("rejects empty authorized_domains", () => {
    expect(
      HkiEnvelopeSchema.safeParse({
        ...VALID_ENVELOPE,
        authorized_domains: [],
      }).success
    ).toBe(false);
  });

  it("rejects duplicate authorized_domains", () => {
    expect(
      HkiEnvelopeSchema.safeParse({
        ...VALID_ENVELOPE,
        authorized_domains: ["payments", "payments"],
      }).success
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { org_id: _, ...withoutOrg } = VALID_ENVELOPE;
    expect(HkiEnvelopeSchema.safeParse(withoutOrg).success).toBe(false);
  });

  it("parse() returns typed object matching HkiEnvelope shape", () => {
    const env = HkiEnvelopeSchema.parse(VALID_ENVELOPE);
    expect(env.hki_version).toBe("1.0");
    expect(env.active_domain).toBe("payments");
    expect(Array.isArray(env.authorized_domains)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Artifact label schema
// ---------------------------------------------------------------------------

describe("HkiArtifactLabelSchema — backward-compat", () => {
  const VALID_LABEL = {
    org_id: "org_acme",
    domain: "payments",
    artifact_type: "document",
    artifact_id: "doc_policy_001",
  };

  it("accepts a valid artifact label", () => {
    expect(HkiArtifactLabelSchema.safeParse(VALID_LABEL).success).toBe(true);
  });

  it("accepts optional provenance_id", () => {
    expect(
      HkiArtifactLabelSchema.safeParse({
        ...VALID_LABEL,
        provenance_id: "prov_abc",
      }).success
    ).toBe(true);
  });

  it("rejects global domain", () => {
    expect(
      HkiArtifactLabelSchema.safeParse({ ...VALID_LABEL, domain: "global" }).success
    ).toBe(false);
  });

  it("rejects wildcard domain", () => {
    expect(
      HkiArtifactLabelSchema.safeParse({ ...VALID_LABEL, domain: "*" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gateway target schema
// ---------------------------------------------------------------------------

describe("HkiGatewayTargetSchema — backward-compat", () => {
  const VALID_TARGET = {
    type: "tool" as const,
    id: "retrieval.search",
    domain: "payments",
  };

  it("accepts a valid gateway target", () => {
    expect(HkiGatewayTargetSchema.safeParse(VALID_TARGET).success).toBe(true);
  });

  it("accepts optional published_domains", () => {
    expect(
      HkiGatewayTargetSchema.safeParse({
        ...VALID_TARGET,
        published_domains: ["finance", "audit"],
      }).success
    ).toBe(true);
  });

  it("rejects unknown target type", () => {
    expect(
      HkiGatewayTargetSchema.safeParse({ ...VALID_TARGET, type: "unknown" }).success
    ).toBe(false);
  });
});
