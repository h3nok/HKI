/**
 * Zod schemas for HKI 1.0 envelope, artifact label, and gateway target.
 *
 * These parsers enforce structural rules. They do **not** enforce expiry,
 * domain consistency, or signature verification — use `validateEnvelope`
 * (or `verifyEnvelope` from `@hki/sdk/client`) for runtime enforcement.
 *
 * @example
 * import { HkiEnvelopeSchema } from "@hki/sdk/schema";
 * const envelope = HkiEnvelopeSchema.parse(rawInput);
 */

import { z } from "zod";
import { GLOBAL_DOMAIN, HKI_VERSION, WILDCARD_DOMAIN } from "@hki/runtime";

const nonForbiddenDomain = z
  .string()
  .min(1)
  .refine(
    val =>
      val.toLowerCase() !== GLOBAL_DOMAIN &&
      val.toLowerCase() !== WILDCARD_DOMAIN,
    { message: `domain must not be "${GLOBAL_DOMAIN}" or "${WILDCARD_DOMAIN}"` }
  );

export const HkiEnvelopeSchema = z.object({
  hki_version: z.literal(HKI_VERSION),
  envelope_id: z.string().min(1),
  org_id: z.string().min(1),
  subject_id: z.string().min(1),
  active_domain: nonForbiddenDomain,
  authorized_domains: z
    .array(nonForbiddenDomain)
    .min(1)
    .refine(arr => new Set(arr).size === arr.length, {
      message: "authorized_domains must not contain duplicates",
    }),
  purpose: z.string().min(1),
  risk_tier: z.string().min(1),
  policy_pack_id: z.string().min(1),
  issued_at: z.number(),
  expires_at: z.number(),
  issuer: z.string().min(1),
  signature: z.string().min(1).optional(),
});

export type HkiEnvelopeInput = z.input<typeof HkiEnvelopeSchema>;
export type HkiEnvelopeOutput = z.output<typeof HkiEnvelopeSchema>;

export const HkiArtifactLabelSchema = z.object({
  org_id: z.string().min(1),
  domain: nonForbiddenDomain,
  artifact_type: z.string().min(1),
  artifact_id: z.string().min(1),
  provenance_id: z.string().min(1).optional(),
});

export type HkiArtifactLabelInput = z.input<typeof HkiArtifactLabelSchema>;
export type HkiArtifactLabelOutput = z.output<typeof HkiArtifactLabelSchema>;

export const HkiGatewayTargetSchema = z.object({
  type: z.enum(["tool", "agent", "resource", "model", "memory", "retrieval"]),
  id: z.string().min(1),
  domain: z.string().min(1),
  published_domains: z.array(z.string().min(1)).optional(),
});

export type HkiGatewayTargetInput = z.input<typeof HkiGatewayTargetSchema>;
