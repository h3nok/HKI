/**
 * Shared plane tokens used by every architecture diagram.
 *
 * Colors are architecture primitives layered over @hki/ui theme tokens.
 * The diagram must not carry its own color story: it borrows semantic
 * surfaces plus the three HKI plane tokens so the architecture view, standard,
 * admin, runtime, and publication surfaces stay visually coherent.
 */

export type PlaneId = "edge" | "runtime" | "publication" | "admin";
export type ArchitectureTheme = "light" | "dark";

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

export const ARCHITECTURE_COLORS = {
  surface: {
    page: "var(--arch-page)",
    panel: "var(--arch-panel)",
    panelRaised: "var(--arch-panel-raised)",
    panelMuted: "var(--arch-panel-muted)",
    border: "var(--arch-border)",
    borderMuted: "var(--arch-border-muted)",
    text: "var(--arch-text)",
    textMuted: "var(--arch-text-muted)",
    textSubtle: "var(--arch-text-subtle)",
    grid: "var(--arch-grid)",
    overlay: "var(--arch-overlay)",
    shadow: "var(--arch-shadow)",
    minimapMask: "var(--arch-minimap-mask)",
  },
  status: {
    focus: "var(--arch-focus)",
    danger: "var(--arch-danger)",
    dimEdge: "var(--arch-dim-edge)",
  },
} as const;

export const ARCHITECTURE_THEME_VARS: Record<
  ArchitectureTheme,
  Record<`--arch-${string}`, string>
> = {
  light: {
    "--arch-page":
      "color-mix(in srgb, var(--background) 84%, var(--muted) 16%)",
    "--arch-panel": "color-mix(in srgb, var(--card) 94%, var(--muted) 6%)",
    "--arch-panel-raised":
      "color-mix(in srgb, var(--card) 78%, var(--muted) 22%)",
    "--arch-panel-muted":
      "color-mix(in srgb, var(--muted) 82%, var(--card) 18%)",
    "--arch-border":
      "color-mix(in srgb, var(--border) 84%, var(--foreground) 8%)",
    "--arch-border-muted": "color-mix(in srgb, var(--border) 70%, transparent)",
    "--arch-text": "var(--foreground)",
    "--arch-text-muted": "var(--muted-foreground)",
    "--arch-text-subtle":
      "color-mix(in srgb, var(--muted-foreground) 76%, transparent)",
    "--arch-grid": "color-mix(in srgb, var(--foreground) 8%, transparent)",
    "--arch-overlay": "color-mix(in srgb, var(--background) 64%, transparent)",
    "--arch-shadow":
      "color-mix(in srgb, var(--color-neutral-950) 18%, transparent)",
    "--arch-minimap-mask":
      "color-mix(in srgb, var(--background) 74%, transparent)",
    "--arch-focus": "var(--plane-runtime)",
    "--arch-danger": "var(--plane-admin)",
    "--arch-dim-edge": "color-mix(in srgb, var(--border) 78%, transparent)",
    "--arch-edge-accent": "var(--primary)",
    "--arch-edge-bg":
      "color-mix(in srgb, var(--arch-page) 88%, var(--primary) 12%)",
    "--arch-edge-border":
      "color-mix(in srgb, var(--primary) 34%, var(--border) 66%)",
    "--arch-runtime-accent": "var(--plane-runtime)",
    "--arch-runtime-bg":
      "color-mix(in srgb, var(--plane-runtime-muted) 56%, var(--arch-page) 44%)",
    "--arch-runtime-border": "var(--plane-runtime-border)",
    "--arch-publication-accent": "var(--plane-publication)",
    "--arch-publication-bg":
      "color-mix(in srgb, var(--plane-publication-muted) 56%, var(--arch-page) 44%)",
    "--arch-publication-border": "var(--plane-publication-border)",
    "--arch-admin-accent": "var(--plane-admin)",
    "--arch-admin-bg":
      "color-mix(in srgb, var(--plane-admin-muted) 56%, var(--arch-page) 44%)",
    "--arch-admin-border": "var(--plane-admin-border)",
  },
  dark: {
    "--arch-page":
      "color-mix(in srgb, var(--background) 88%, var(--muted) 12%)",
    "--arch-panel": "color-mix(in srgb, var(--card) 92%, var(--muted) 8%)",
    "--arch-panel-raised":
      "color-mix(in srgb, var(--card) 78%, var(--muted) 22%)",
    "--arch-panel-muted":
      "color-mix(in srgb, var(--card) 64%, var(--muted) 36%)",
    "--arch-border": "var(--border)",
    "--arch-border-muted": "var(--border-muted)",
    "--arch-text": "var(--foreground)",
    "--arch-text-muted": "var(--muted-foreground)",
    "--arch-text-subtle":
      "color-mix(in srgb, var(--muted-foreground) 72%, transparent)",
    "--arch-grid": "color-mix(in srgb, var(--foreground) 5%, transparent)",
    "--arch-overlay": "color-mix(in srgb, var(--background) 72%, transparent)",
    "--arch-shadow":
      "color-mix(in srgb, var(--color-neutral-950) 58%, transparent)",
    "--arch-minimap-mask":
      "color-mix(in srgb, var(--background) 76%, transparent)",
    "--arch-focus": "var(--plane-runtime)",
    "--arch-danger": "var(--plane-admin)",
    "--arch-dim-edge": "var(--border)",
    "--arch-edge-accent": "var(--primary)",
    "--arch-edge-bg":
      "color-mix(in srgb, var(--arch-page) 88%, var(--primary) 12%)",
    "--arch-edge-border":
      "color-mix(in srgb, var(--primary) 36%, var(--border) 64%)",
    "--arch-runtime-accent": "var(--plane-runtime)",
    "--arch-runtime-bg":
      "color-mix(in srgb, var(--plane-runtime-muted) 68%, var(--arch-page) 32%)",
    "--arch-runtime-border": "var(--plane-runtime-border)",
    "--arch-publication-accent": "var(--plane-publication)",
    "--arch-publication-bg":
      "color-mix(in srgb, var(--plane-publication-muted) 68%, var(--arch-page) 32%)",
    "--arch-publication-border": "var(--plane-publication-border)",
    "--arch-admin-accent": "var(--plane-admin)",
    "--arch-admin-bg":
      "color-mix(in srgb, var(--plane-admin-muted) 68%, var(--arch-page) 32%)",
    "--arch-admin-border": "var(--plane-admin-border)",
  },
};

export const PLANES: Record<PlaneId, PlaneToken> = {
  edge: {
    label: "Edge",
    sub: "Identity & envelope minting",
    accent: "var(--arch-edge-accent)",
    tintBg: "var(--arch-edge-bg)",
    tintBorder: "var(--arch-edge-border)",
  },
  runtime: {
    label: "Runtime plane",
    sub: "One active domain, end-to-end",
    accent: "var(--arch-runtime-accent)",
    tintBg: "var(--arch-runtime-bg)",
    tintBorder: "var(--arch-runtime-border)",
  },
  publication: {
    label: "Publication plane",
    sub: "The only authorized cross-domain bridge",
    accent: "var(--arch-publication-accent)",
    tintBg: "var(--arch-publication-bg)",
    tintBorder: "var(--arch-publication-border)",
  },
  admin: {
    label: "Admin plane",
    sub: "Audited · unreachable from runtime",
    accent: "var(--arch-admin-accent)",
    tintBg: "var(--arch-admin-bg)",
    tintBorder: "var(--arch-admin-border)",
  },
};

export function architectureThemeVars(theme: ArchitectureTheme) {
  return ARCHITECTURE_THEME_VARS[theme];
}

export const PLANE_ORDER: readonly PlaneId[] = [
  "edge",
  "runtime",
  "publication",
  "admin",
];
