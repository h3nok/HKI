/**
 * Shared plane tokens used by every architecture diagram.
 *
 * Colors come from the design-system chart palette (`var(--chart-N)`) which is
 * defined in @hki/ui/tokens for both light and dark themes. Never hard-code
 * colors — always go through this module so theme switching stays consistent.
 */

export type PlaneId = "edge" | "runtime" | "publication" | "admin";

export type PlaneToken = {
  /** Display label (one short noun phrase). */
  label: string;
  /** Sub-label, ~6 words, explains the plane's purpose. */
  sub: string;
  /** Accent color (CSS color expression, theme-reactive). */
  accent: string;
  /** Plane fill (theme-reactive surface tint). */
  tintBg: string;
  /** Plane border (theme-reactive). */
  tintBorder: string;
};

export const PLANES: Record<PlaneId, PlaneToken> = {
  edge: {
    label: "Edge",
    sub: "Identity & envelope minting",
    accent: "var(--chart-1, var(--primary))",
    tintBg:
      "color-mix(in srgb, var(--chart-1, var(--primary)) 6%, var(--card))",
    tintBorder:
      "color-mix(in srgb, var(--chart-1, var(--primary)) 24%, var(--border))",
  },
  runtime: {
    label: "Runtime plane",
    sub: "One active domain, end-to-end",
    accent: "var(--chart-2, var(--primary))",
    tintBg:
      "color-mix(in srgb, var(--chart-2, var(--primary)) 6%, var(--card))",
    tintBorder:
      "color-mix(in srgb, var(--chart-2, var(--primary)) 24%, var(--border))",
  },
  publication: {
    label: "Publication plane",
    sub: "The only authorized cross-domain bridge",
    accent: "var(--chart-4, #d97706)",
    tintBg: "color-mix(in srgb, var(--chart-4, #d97706) 7%, var(--card))",
    tintBorder:
      "color-mix(in srgb, var(--chart-4, #d97706) 30%, var(--border))",
  },
  admin: {
    label: "Admin plane",
    sub: "Audited · unreachable from runtime",
    accent: "color-mix(in srgb, var(--foreground) 55%, transparent)",
    tintBg: "color-mix(in srgb, var(--foreground) 4%, var(--card))",
    tintBorder: "color-mix(in srgb, var(--foreground) 18%, var(--border))",
  },
};

export const PLANE_ORDER: readonly PlaneId[] = [
  "edge",
  "runtime",
  "publication",
  "admin",
];
