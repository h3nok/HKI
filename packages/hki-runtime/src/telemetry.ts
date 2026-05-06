import type { HkiEnvelope, HkiSpanLike } from "./types";

export function hkiTraceAttributes(envelope: HkiEnvelope): Record<string, string | number> {
  return {
    "hki.version": envelope.hki_version,
    "hki.envelope_id": envelope.envelope_id,
    "hki.org_id": envelope.org_id,
    "hki.active_domain": envelope.active_domain,
    "hki.subject_id": envelope.subject_id,
    "hki.purpose": envelope.purpose,
    "hki.risk_tier": envelope.risk_tier,
    "hki.policy_pack_id": envelope.policy_pack_id,
    "hki.issuer": envelope.issuer,
  };
}

export function applyHkiTraceAttributes<TSpan extends HkiSpanLike>(
  span: TSpan,
  envelope: HkiEnvelope,
): TSpan {
  const attrs = hkiTraceAttributes(envelope);
  for (const [key, value] of Object.entries(attrs)) {
    span.setAttribute?.(key, value);
  }
  return span;
}

