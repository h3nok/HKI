/**
 * HMAC-SHA256 envelope signing — server-side only (requires Node.js crypto).
 *
 * Usage at the gateway edge (before handing envelope to downstream services):
 *
 *   import { signEnvelope } from "@hki/runtime/signing";
 *   const signed = { ...envelope, signature: signEnvelope(envelope, gatewaySecret) };
 *
 * Usage in middleware (after receiving envelope from upstream):
 *
 *   import { verifyEnvelopeSignature } from "@hki/runtime/signing";
 *   if (!verifyEnvelopeSignature(envelope, gatewaySecret)) {
 *     return { error: "invalid-signature", status: 401 };
 *   }
 *
 * The secret is a shared HS256 key between the gateway and its downstream services.
 * Rotate it via environment variable (HKI_SIGNING_SECRET) without code changes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { stableStringify } from "./stable-stringify";
import type { HkiEnvelope } from "./types";

const ALGORITHM_PREFIX = "hmac-sha256:";

/**
 * The canonical payload covers every field that governs access decisions.
 * Excluded: hki_version (fixed constant), signature (would be circular).
 */
function canonicalPayload(envelope: HkiEnvelope): string {
  const payload = {
    active_domain: envelope.active_domain,
    authorized_domains: [...envelope.authorized_domains].sort(),
    envelope_id: envelope.envelope_id,
    expires_at: envelope.expires_at,
    issued_at: envelope.issued_at,
    issuer: envelope.issuer,
    org_id: envelope.org_id,
    policy_pack_id: envelope.policy_pack_id,
    purpose: envelope.purpose,
    risk_tier: envelope.risk_tier,
    subject_id: envelope.subject_id,
  };
  return stableStringify(payload);
}

/**
 * Sign an envelope with HMAC-SHA256. Returns `"hmac-sha256:<base64url>"`.
 *
 * Call this at the gateway, then set `envelope.signature = signEnvelope(envelope, secret)`.
 */
export function signEnvelope(envelope: HkiEnvelope, secret: string): string {
  const sig = createHmac("sha256", secret)
    .update(canonicalPayload(envelope))
    .digest("base64url");
  return `${ALGORITHM_PREFIX}${sig}`;
}

/**
 * Verify an envelope's HMAC-SHA256 signature in constant time.
 *
 * Returns `false` if:
 *   - `envelope.signature` is missing or empty
 *   - the algorithm prefix doesn't match
 *   - the HMAC doesn't match the expected value for the given secret
 */
export function verifyEnvelopeSignature(
  envelope: HkiEnvelope,
  secret: string
): boolean {
  const actual = envelope.signature ?? "";
  if (!actual.startsWith(ALGORITHM_PREFIX)) return false;

  const expected = signEnvelope(envelope, secret);
  // timingSafeEqual requires equal-length Buffers; lengths are fixed for SHA-256.
  const eBuf = Buffer.from(expected);
  const aBuf = Buffer.from(actual);
  if (eBuf.length !== aBuf.length) return false;
  return timingSafeEqual(eBuf, aBuf);
}
