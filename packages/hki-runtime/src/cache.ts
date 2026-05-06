import type { HkiCacheKeyInput, HkiEnvelope } from "./types";
import { stableStringify } from "./stable-stringify";

export function deriveHkiCacheKey(input: HkiCacheKeyInput): string {
  const { envelope } = input;
  const parts = [
    "hki",
    envelope.hki_version,
    envelope.org_id,
    envelope.active_domain,
    envelope.purpose,
    input.operation,
    envelope.policy_pack_id,
    input.model_route ?? "model:any",
    input.context_version ?? "context:any",
    stableFingerprint(input.input),
  ];

  if (input.extra) {
    parts.push(stableFingerprint(input.extra));
  }

  return parts.map(encodePart).join(":");
}

export function assertCacheKeyBoundToEnvelope(
  key: string,
  envelope: HkiEnvelope,
): boolean {
  const encodedOrg = encodePart(envelope.org_id);
  const encodedDomain = encodePart(envelope.active_domain);
  return key.includes(`:${encodedOrg}:`) && key.includes(`:${encodedDomain}:`);
}

function stableFingerprint(value: unknown): string {
  return stableStringify(value);
}

function encodePart(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase());
}

