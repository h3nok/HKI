/**
 * Shared plane tokens used by every architecture diagram.
 *
 * Colors are architecture primitives layered over @hki/ui theme tokens.
 * Light mode keeps explicit paper/diagram values; dark mode inherits the app
 * semantic surfaces so the top bar, standard, and architecture pages stay in
 * the same dark theme.
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
    "--arch-page": "#F9FAFB",
    "--arch-panel": "#FFFFFF",
    "--arch-panel-raised": "#F3F4F6",
    "--arch-panel-muted": "#F8FAFC",
    "--arch-border": "#D1D5DB",
    "--arch-border-muted": "#E5E7EB",
    "--arch-text": "#111827",
    "--arch-text-muted": "#4B5563",
    "--arch-text-subtle": "#6B7280",
    "--arch-grid": "#D1D5DB",
    "--arch-overlay": "rgba(17, 24, 39, 0.36)",
    "--arch-shadow": "rgba(17, 24, 39, 0.12)",
    "--arch-minimap-mask": "rgba(249, 250, 251, 0.72)",
    "--arch-focus": "#0E7C7B",
    "--arch-danger": "#DC2626",
    "--arch-dim-edge": "#D1D5DB",
    "--arch-edge-accent": "#0E7C7B",
    "--arch-edge-bg": "#ECFDFC",
    "--arch-edge-border": "#6EE0DA",
    "--arch-runtime-accent": "#2563EB",
    "--arch-runtime-bg": "#EFF6FF",
    "--arch-runtime-border": "#BFDBFE",
    "--arch-publication-accent": "#CA8A04",
    "--arch-publication-bg": "#FEFCE8",
    "--arch-publication-border": "#FEF08A",
    "--arch-admin-accent": "#DC2626",
    "--arch-admin-bg": "#FEF2F2",
    "--arch-admin-border": "#FECACA",
  },
  dark: {
    "--arch-page": "var(--background)",
    "--arch-panel": "var(--card)",
    "--arch-panel-raised":
      "color-mix(in srgb, var(--card) 82%, var(--muted) 18%)",
    "--arch-panel-muted":
      "color-mix(in srgb, var(--card) 68%, var(--muted) 32%)",
    "--arch-border": "var(--border)",
    "--arch-border-muted": "var(--border-muted)",
    "--arch-text": "var(--foreground)",
    "--arch-text-muted": "var(--muted-foreground)",
    "--arch-text-subtle":
      "color-mix(in srgb, var(--muted-foreground) 72%, transparent)",
    "--arch-grid": "color-mix(in srgb, var(--border) 62%, transparent)",
    "--arch-overlay": "color-mix(in srgb, var(--background) 72%, transparent)",
    "--arch-shadow": "rgba(0, 0, 0, 0.45)",
    "--arch-minimap-mask":
      "color-mix(in srgb, var(--background) 76%, transparent)",
    "--arch-focus": "var(--primary)",
    "--arch-danger": "var(--destructive)",
    "--arch-dim-edge": "var(--border)",
    "--arch-edge-accent": "var(--primary)",
    "--arch-edge-bg": "color-mix(in srgb, var(--card) 90%, var(--primary) 10%)",
    "--arch-edge-border":
      "color-mix(in srgb, var(--primary) 36%, var(--border) 64%)",
    "--arch-runtime-accent": "#60A5FA",
    "--arch-runtime-bg": "color-mix(in srgb, var(--card) 90%, #60A5FA 10%)",
    "--arch-runtime-border":
      "color-mix(in srgb, #60A5FA 34%, var(--border) 66%)",
    "--arch-publication-accent": "#FACC15",
    "--arch-publication-bg": "color-mix(in srgb, var(--card) 90%, #FACC15 10%)",
    "--arch-publication-border":
      "color-mix(in srgb, #FACC15 30%, var(--border) 70%)",
    "--arch-admin-accent": "var(--destructive)",
    "--arch-admin-bg":
      "color-mix(in srgb, var(--card) 90%, var(--destructive) 10%)",
    "--arch-admin-border":
      "color-mix(in srgb, var(--destructive) 34%, var(--border) 66%)",
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
