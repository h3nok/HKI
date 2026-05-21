/**
 * Knowledge Platform — HKI Iris Accent Theme
 *
 * Neutral surfaces from the shared agentic design system + HKI Iris accent.
 * Cards float on the gray canvas via layered shadows, subtle borders, and depth.
 *
 * Surface hierarchy (5 levels — visually distinct in both light & dark):
 *
 *   Light:
 *     Ground     bg-background   — recessed content area
 *     Card       bg-card (white) — elevated panels, floats with shadow+border
 *     Inset      bg-muted        — recessed area inside a card
 *     Raised     bg-card + glow  — action-focused element
 *     Overlay    bg-card         — dialog/tooltip layer
 *
 *   Dark:
 *     Ground     bg-background   — deep recessed area
 *     Card       bg-card         — elevated with luminous border
 *     Inset      bg-muted        — recessed area inside a card
 *     Raised     bg-card + glow  — action-focused element
 *     Overlay    bg-card         — dialog/tooltip layer
 *
 * Type scale — NO sub-12px sizes:
 *   Display   text-lg   18px  — page titles
 *   Title     text-sm   14px  — section headings, panel headers
 *   Body      text-xs   12px  — all body text, buttons, labels
 *
 * Color strategy:
 *   Surfaces are neutral (shared design system tokens).
 *   Accent is HKI Iris via @hki/ui tokens (buttons, highlights, links).
 *
 * Usage:
 *   import { k } from '../theme';
 *   <h2 className={k.display}>Knowledge Domain</h2>
 */

import { HKI_IRIS, brandColors } from "@hki/ui";

// ── Primary accent — sourced from @hki/ui ─────────────────────────────────

/** Hex values for inline styles (icon boxes, SVG strokes, etc.) */
export const ACCENT = HKI_IRIS;
export const ACCENT_RED = HKI_IRIS;
export const ACCENT_HOVER = brandColors.blue[700];
export const ACCENT_LIGHT = brandColors.blue[300];

const DUOTONE_ACCENT_TEXT = "kb-duotone-accent-text";

const DUOTONE_ACCENT_SOLID = "kb-duotone-accent-solid";

const DUOTONE_ACCENT_SOLID_HOVER = "kb-duotone-accent-solid-hover";

const DUOTONE_FILL = "kb-duotone-fill";

const DUOTONE_SHADOW_SOFT = "kb-duotone-shadow-soft";

const DUOTONE_SHADOW_HOVER = "kb-duotone-shadow-hover";

const DUOTONE_SURFACE_ACTIVE = "kb-duotone-surface-active";

const DUOTONE_HOVER = "kb-duotone-hover";

const DUOTONE_HOVER_STRONG = "kb-duotone-hover-strong";

const DUOTONE_FIELD = "kb-duotone-field";

const DUOTONE_SELECT_ITEM = "kb-duotone-select-item";

const DUOTONE_ICON_HOVER = "kb-duotone-icon-hover";

// ── Tailwind class tokens ────────────────────────────────────────────────────

export const k = {
  // ── Accent — HKI Iris ──
  accentText: DUOTONE_ACCENT_TEXT,
  brandRedText: "kb-brand-red-text",
  accentBg: "bg-primary",
  accentBgSubtle: "bg-primary/10 dark:bg-primary/12",
  accentBorder: "border-primary/20 dark:border-primary/25",
  duoToneAccentText: DUOTONE_ACCENT_TEXT,
  duoToneAccentSolid: DUOTONE_ACCENT_SOLID,
  duoToneAccentSolidHover: DUOTONE_ACCENT_SOLID_HOVER,
  duoToneFill: DUOTONE_FILL,
  duoToneShadowSoft: DUOTONE_SHADOW_SOFT,
  duoToneShadowHover: DUOTONE_SHADOW_HOVER,
  duoToneSurfaceActive: DUOTONE_SURFACE_ACTIVE,
  duoToneHover: DUOTONE_HOVER,
  duoToneHoverStrong: DUOTONE_HOVER_STRONG,
  duoToneField: DUOTONE_FIELD,
  duoToneSelectItem: DUOTONE_SELECT_ITEM,
  duoToneIconHover: DUOTONE_ICON_HOVER,
  duoToneTextHover: "kb-duotone-text-hover",
  duoToneBorderHoverSoft: "kb-duotone-border-hover-soft",
  duoToneBorderHover: "kb-duotone-border-hover",
  duoToneBorderHoverStrong: "kb-duotone-border-hover-strong",
  duoToneBgHoverSoft: "kb-duotone-bg-hover-soft",
  duoToneBgHover: "kb-duotone-bg-hover",
  duoToneBgHoverStrong: "kb-duotone-bg-hover-strong",
  duoToneChip: "kb-duotone-chip",
  duoToneChipBorder: "kb-duotone-chip-border",
  duoToneChipHover: "kb-duotone-chip-hover",
  duoTonePanelHover: "kb-duotone-panel-hover",
  duoTonePanelHoverStrong: "kb-duotone-panel-hover-strong",

  // ── Buttons (legacy — prefer <Button> from @hki/ui) ──
  btnPrimary: [
    "inline-flex items-center justify-center gap-1.5",
    "px-4 py-2 text-xs font-semibold rounded-lg",
    DUOTONE_ACCENT_SOLID,
    DUOTONE_ACCENT_SOLID_HOVER,
    "disabled:opacity-50 disabled:pointer-events-none",
    "shadow-sm transition-colors",
  ].join(" "),

  btnSecondary: [
    "inline-flex items-center justify-center gap-1.5",
    "px-3 py-1.5 text-xs font-medium rounded-lg",
    DUOTONE_ACCENT_TEXT,
    DUOTONE_FILL,
    "kb-duotone-bg-hover-strong",
    "disabled:opacity-50 disabled:pointer-events-none",
    "transition-colors",
  ].join(" "),

  btnGhost: [
    "inline-flex items-center justify-center gap-1.5",
    "px-2.5 py-1.5 text-xs font-medium rounded-lg",
    "text-muted-foreground",
    "hover:text-foreground",
    "kb-duotone-bg-hover",
    "transition-colors",
  ].join(" "),

  // ── Focus ring ──
  focusRing:
    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",

  // ── Input (legacy — prefer <Input> from @hki/ui) ──
  input: [
    "w-full px-3 py-2 text-sm rounded-lg",
    "border border-border/40",
    "bg-card text-foreground",
    "placeholder:text-muted-foreground/50",
    "focus:outline-none focus:ring-2 focus:ring-primary/30",
  ].join(" "),

  // ── Card / Panel — powered by @hki/ui primitives (surface-stamped /
  //    surface-precision in tokens/signature.css). The page should wrap its
  //    root in `k.ground` which adds `plane-publication`, so brand-tinted
  //    detail tokens (hairline-brand, shadow drop, focus glow) retint to
  //    violet automatically. No hardcoded colors, no app-level shims.
  card: ["surface-stamped text-card-foreground"].join(" "),
  sectionSurface: ["surface-precision text-card-foreground"].join(" "),
  surfaceRaised: ["surface-stamped text-card-foreground"].join(" "),
  surfaceTinted: ["surface-stamped text-card-foreground"].join(" "),
  surfaceSubtle: ["surface-precision text-card-foreground"].join(" "),
  utilityPill: ["rounded-2xl", "surface-precision text-card-foreground"].join(
    " "
  ),
  cardHeader: "px-5 py-3 border-b border-border/50",

  /** Elevated card — alias of k.card for back-compat. */
  cardShadow: ["surface-stamped text-card-foreground"].join(" "),

  // ── Typography — 3-level hierarchy (NO sub-12px sizes) ──
  /** Display — page titles, hero text. 18px / semibold / tight tracking */
  display: "text-lg font-semibold tracking-tight text-foreground",
  /** Heading — section titles, panel headers. 14px / semibold */
  heading: "text-sm font-semibold text-foreground",
  /** Body — secondary content. 14px / normal weight */
  subtext: "text-sm text-muted-foreground",
  /** Label — all-caps section dividers. 11px / bold / widest tracking */
  label:
    "text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70",
  /** Muted — tertiary info. 12px / normal */
  muted: "text-xs text-muted-foreground",
  /** Caption — smallest allowed. 12px / medium */
  caption: "text-xs font-medium text-muted-foreground",
  /** Mono — code, IDs, numbers. 12px / tabular */
  mono: "text-xs font-mono tabular-nums text-muted-foreground",

  // ── Inset surface — recessed section inside a card (primitive) ──
  inset: ["surface-precision"].join(" "),

  /** Ground — page canvas. Sets plane context to `publication` so all
   *  brand-tinted detail tokens inside (focus rings, hairline-brand,
   *  shadow-stamped drop) automatically retint to violet. */
  ground: "bg-background plane-publication",

  // ── Pill / badge (legacy — prefer <Badge> from @hki/ui) ──
  pill: [
    "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full",
    DUOTONE_FILL,
    "border border-primary/20",
  ].join(" "),

  // ── Selected / hover state — HKI Iris system ──
  /** Selected nav item, tab, or list row — semi-transparent HKI Iris */
  selected: [DUOTONE_FILL, "font-semibold"].join(" "),
  /** Hover for interactive items — lighter HKI Iris tint */
  hover: DUOTONE_HOVER,
  /** Active tab with border accent */
  activeTab: [DUOTONE_SURFACE_ACTIVE, "ring-1 ring-primary/20"].join(" "),
  inactiveTab: ["border-border", DUOTONE_HOVER].join(" "),
  sidebarNavActive: [
    DUOTONE_SURFACE_ACTIVE,
    "text-foreground",
    "ring-1 ring-primary/15",
  ].join(" "),
  sidebarNavIdle: [
    "text-muted-foreground",
    "hover:text-foreground",
    DUOTONE_HOVER,
  ].join(" "),

  // ── Status colors ──
  statusPositiveSurface: "kb-status-positive-surface",
  statusPositiveBadge: "kb-status-positive-badge",
  statusPositiveText: "kb-status-positive-text",
  statusPositiveDot: "kb-status-positive-dot",
  statusPositiveBar: "kb-status-positive-bar",
  statusWarningSurface: "kb-status-warning-surface",
  statusWarningBadge: "kb-status-warning-badge",
  statusWarningText: "kb-status-warning-text",
  statusWarningDot: "kb-status-warning-dot",
  statusWarningBar: "kb-status-warning-bar",
  statusCriticalSurface: "kb-status-critical-surface",
  statusCriticalBadge: "kb-status-critical-badge",
  statusCriticalText: "kb-status-critical-text",
  statusCriticalDot: "kb-status-critical-dot",
  statusCriticalBar: "kb-status-critical-bar",
  statusNeutralSurface: "kb-status-neutral-surface",
  statusNeutralBadge: "kb-status-neutral-badge",
  statusNeutralText: "kb-status-neutral-text",
  statusNeutralDot: "kb-status-neutral-dot",
  statusNeutralBar: "kb-status-neutral-bar",
  statusCompleted: "text-primary",
  statusFailed: "text-destructive",
  statusRunning: "text-primary",
  statusQueued: "text-muted-foreground/50",

  // ── Signature accent bar — gradient left border for active panels ──
  accentBar: [
    "relative",
    "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px]",
    "before:rounded-full before:bg-gradient-to-b before:from-primary before:to-primary/45",
  ].join(" "),

  // ── Lift — restrained depth (token-derived, plane-aware via --plane-current) ──
  glow: "shadow-[var(--shadow-precision)]",
} as const;

// ── Pipeline polling config ──────────────────────────────────────────────────

/** How often to poll for job status when there are active (non-terminal) jobs */
export const JOB_POLL_INTERVAL_MS = 3_000;

/** Job statuses that are considered "terminal" (no more polling needed) */
export const TERMINAL_JOB_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "expired",
]);

/** Check if any jobs in a list are still active (need polling) */
export function hasActiveJobs(jobs: Array<{ status: string }>): boolean {
  return jobs.some(j => !TERMINAL_JOB_STATUSES.has(j.status));
}

// ── Domain color palette ─────────────────────────────────────────────────────

/**
 * A set of visually distinct, accessible Tailwind color tokens.
 * Each domain gets a deterministic slot so the color is stable
 * across sessions — same domain always gets the same color.
 *
 * Null stream (global view) always gets the primary (HKI Iris) slot.
 */
const STREAM_PALETTE = [
  // text / bg / ring
  {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/12",
    ring: "ring-violet-500/25",
    icon: "#7C3AED",
  },
  {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/12",
    ring: "ring-emerald-500/25",
    icon: "#059669",
  },
  {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/12",
    ring: "ring-rose-500/25",
    icon: "#E11D48",
  },
  {
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/12",
    ring: "ring-sky-500/25",
    icon: "#0284C7",
  },
  {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/12",
    ring: "ring-cyan-500/25",
    icon: "#0891B2",
  },
  {
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-500/12",
    ring: "ring-fuchsia-500/25",
    icon: "#C026D3",
  },
  {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/12",
    ring: "ring-emerald-500/25",
    icon: "#059669",
  },
  {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/12",
    ring: "ring-rose-500/25",
    icon: "#E11D48",
  },
] as const;

/** Global (no stream) always uses HKI Iris. */
const GLOBAL_SLOT = {
  text: "text-primary",
  bg: "bg-primary/10",
  ring: "ring-primary/20",
  icon: ACCENT,
} as const;

/**
 * Returns stable color tokens for a given stream ID.
 * Pass `null` or `""` to get the global (HKI Iris) slot.
 */
export function streamColorToken(streamId: string | null | undefined) {
  if (!streamId) return GLOBAL_SLOT;
  // Simple djb2-style hash → palette index
  let hash = 5381;
  for (let i = 0; i < streamId.length; i++) {
    hash = ((hash << 5) + hash) ^ streamId.charCodeAt(i);
  }
  return STREAM_PALETTE[Math.abs(hash) % STREAM_PALETTE.length]!;
}
