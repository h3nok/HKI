/**
 * Shared plane tokens used by every architecture diagram.
 *
 * Colors are architecture primitives, mirrored from @hki/ui raw design tokens.
 * Keep them explicit here so the diagram never falls back to browser/default
 * chart or semantic app colors.
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
    "--arch-page": "#0A0F14",
    "--arch-panel": "#0F172A",
    "--arch-panel-raised": "#111827",
    "--arch-panel-muted": "#172033",
    "--arch-border": "#334155",
    "--arch-border-muted": "#1F2937",
    "--arch-text": "#F8FAFC",
    "--arch-text-muted": "#CBD5E1",
    "--arch-text-subtle": "#94A3B8",
    "--arch-grid": "#243447",
    "--arch-overlay": "rgba(2, 6, 23, 0.72)",
    "--arch-shadow": "rgba(0, 0, 0, 0.45)",
    "--arch-minimap-mask": "rgba(10, 15, 20, 0.76)",
    "--arch-focus": "#3DCBC6",
    "--arch-danger": "#F87171",
    "--arch-dim-edge": "#334155",
    "--arch-edge-accent": "#3DCBC6",
    "--arch-edge-bg": "rgba(17, 24, 39, 0.78)",
    "--arch-edge-border": "rgba(61, 203, 198, 0.34)",
    "--arch-runtime-accent": "#60A5FA",
    "--arch-runtime-bg": "rgba(17, 24, 39, 0.78)",
    "--arch-runtime-border": "rgba(96, 165, 250, 0.34)",
    "--arch-publication-accent": "#FACC15",
    "--arch-publication-bg": "rgba(17, 24, 39, 0.78)",
    "--arch-publication-border": "rgba(250, 204, 21, 0.3)",
    "--arch-admin-accent": "#F87171",
    "--arch-admin-bg": "rgba(17, 24, 39, 0.78)",
    "--arch-admin-border": "rgba(248, 113, 113, 0.34)",
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
