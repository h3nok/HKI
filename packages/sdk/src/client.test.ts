import { describe, expect, it } from "vitest";
import {
  HKI_ENVELOPE_HEADER,
  envelopeHeaders,
  mintEnvelope,
  verifyEnvelope,
  withDomain,
  wrap,
} from "./client";
import type { HkiEnvelope } from "@hki/runtime";

const NOW = 1_777_900_000;
const FUTURE = NOW + 300;

const BASE: HkiEnvelope = {
  hki_version: "1.0",
  envelope_id: "env_test",
  org_id: "org_acme",
  subject_id: "user_42",
  active_domain: "payments",
  authorized_domains: ["payments"],
  purpose: "retrieve",
  risk_tier: "read-only",
  policy_pack_id: "pp_v1",
  issued_at: NOW,
  expires_at: FUTURE,
  issuer: "urn:hki:test",
  signature: "sig_test",
};

// ---------------------------------------------------------------------------
// mintEnvelope
// ---------------------------------------------------------------------------

describe("mintEnvelope", () => {
  it("returns a valid envelope from minimal options", () => {
    const env = mintEnvelope({
      org_id: "org_acme",
      subject_id: "user_1",
      active_domain: "payments",
      purpose: "retrieve",
      risk_tier: "read-only",
      policy_pack_id: "pp_v1",
      issuer: "urn:hki:gateway",
      signature: "sig",
      issued_at: NOW,
      ttl: 300,
    });
    expect(env.hki_version).toBe("1.0");
    expect(env.active_domain).toBe("payments");
    expect(env.authorized_domains).toEqual(["payments"]);
    expect(env.expires_at).toBe(NOW + 300);
  });

  it("defaults authorized_domains to [active_domain]", () => {
    const env = mintEnvelope({
      org_id: "org_acme",
      subject_id: "user_1",
      active_domain: "hr",
      purpose: "chat",
      risk_tier: "read-only",
      policy_pack_id: "pp_v1",
      issuer: "urn:hki:gateway",
      signature: "sig",
      issued_at: NOW,
      ttl: 300,
    });
    expect(env.authorized_domains).toEqual(["hr"]);
  });

  it("throws when options produce an invalid envelope", () => {
    expect(() =>
      mintEnvelope({
        org_id: "org_acme",
        subject_id: "user_1",
        active_domain: "global",
        authorized_domains: ["global"],
        purpose: "retrieve",
        risk_tier: "read-only",
        policy_pack_id: "pp_v1",
        issuer: "urn:hki:gateway",
        issued_at: NOW,
        ttl: 300,
      })
    ).toThrow("mintEnvelope");
  });

  it("generates a unique envelope_id when not provided", () => {
    const e1 = mintEnvelope({
      org_id: "o", subject_id: "s", active_domain: "payments",
      purpose: "retrieve", risk_tier: "read-only", policy_pack_id: "p",
      issuer: "i", signature: "sig", issued_at: NOW, ttl: 300,
    });
    const e2 = mintEnvelope({
      org_id: "o", subject_id: "s", active_domain: "payments",
      purpose: "retrieve", risk_tier: "read-only", policy_pack_id: "p",
      issuer: "i", signature: "sig", issued_at: NOW, ttl: 300,
    });
    expect(e1.envelope_id).not.toBe(e2.envelope_id);
  });
});

// ---------------------------------------------------------------------------
// verifyEnvelope
// ---------------------------------------------------------------------------

describe("verifyEnvelope", () => {
  it("returns the envelope when valid", () => {
    const env = verifyEnvelope(BASE, { now: NOW + 100, requireSignature: true });
    expect(env.active_domain).toBe("payments");
  });

  it("throws on invalid input", () => {
    expect(() => verifyEnvelope({}, { requireSignature: true })).toThrow(
      "verifyEnvelope"
    );
  });

  it("throws on expired envelope", () => {
    const expired = { ...BASE, expires_at: NOW - 1 };
    expect(() =>
      verifyEnvelope(expired, { now: NOW + 100, requireSignature: true })
    ).toThrow("verifyEnvelope");
  });

  it("throws on missing signature when required", () => {
    const unsigned = { ...BASE, signature: undefined };
    expect(() =>
      verifyEnvelope(unsigned, { now: NOW + 100, requireSignature: true })
    ).toThrow("verifyEnvelope");
  });
});

// ---------------------------------------------------------------------------
// envelopeHeaders
// ---------------------------------------------------------------------------

describe("envelopeHeaders", () => {
  it("returns an object with the x-hki-envelope header", () => {
    const headers = envelopeHeaders(BASE);
    expect(headers[HKI_ENVELOPE_HEADER]).toBe(JSON.stringify(BASE));
  });
});

// ---------------------------------------------------------------------------
// wrap
// ---------------------------------------------------------------------------

describe("wrap", () => {
  it("injects the envelope header into existing headers", () => {
    const calls: unknown[] = [];
    const client = {
      get(url: string, config?: { headers?: Record<string, string> }) {
        calls.push({ url, config });
        return Promise.resolve({ status: 200 });
      },
    };

    const wrapped = wrap(client, BASE);
    wrapped.get("/search", { headers: { "Authorization": "Bearer tok" } });

    const [call] = calls as [{ url: string; config: { headers: Record<string, string> } }];
    expect(call.config.headers[HKI_ENVELOPE_HEADER]).toBe(JSON.stringify(BASE));
    expect(call.config.headers["Authorization"]).toBe("Bearer tok");
  });

  it("adds headers object when none exists", () => {
    const calls: unknown[][] = [];
    const client = {
      post(...args: unknown[]) {
        calls.push(args);
        return Promise.resolve({ status: 200 });
      },
    };

    const wrapped = wrap(client, BASE);
    wrapped.post("/refund", { amount: 50 });

    // The wrapper appends a headers-only config when no object arg has one
    const args = calls[0]!;
    const injectedConfig = args.find(
      a => a !== null && typeof a === "object" && !Array.isArray(a) &&
        (a as Record<string, unknown>).headers !== undefined
    ) as { headers: Record<string, string> } | undefined;
    expect(injectedConfig?.headers[HKI_ENVELOPE_HEADER]).toBe(JSON.stringify(BASE));
  });

  it("passes non-method properties through unchanged", () => {
    const client = { baseURL: "https://api.example.com", get() {} };
    const wrapped = wrap(client, BASE);
    expect(wrapped.baseURL).toBe("https://api.example.com");
  });
});

// ---------------------------------------------------------------------------
// withDomain
// ---------------------------------------------------------------------------

describe("withDomain", () => {
  const paymentsHandler = (envelope: HkiEnvelope, amount: number) =>
    `refund ${amount} in ${envelope.active_domain}`;

  const paymentsOnly = withDomain(paymentsHandler, "payments");

  it("calls handler when domain matches", () => {
    const result = paymentsOnly(BASE, 99);
    expect(result).toBe("refund 99 in payments");
  });

  it("throws when domain does not match", () => {
    const hrEnvelope = { ...BASE, active_domain: "hr", authorized_domains: ["hr"] };
    expect(() => paymentsOnly(hrEnvelope, 99)).toThrow(
      `active_domain "hr" does not match required domain "payments"`
    );
  });

  it("is case-insensitive", () => {
    const upperEnvelope = { ...BASE, active_domain: "Payments" };
    expect(() => paymentsOnly(upperEnvelope, 10)).not.toThrow();
  });

  it("throws at creation time for global domain", () => {
    expect(() => withDomain(paymentsHandler, "global")).toThrow("withDomain");
  });

  it("throws at creation time for wildcard domain", () => {
    expect(() => withDomain(paymentsHandler, "*")).toThrow("withDomain");
  });
});
