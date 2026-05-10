/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HKI PLATFORM — Surface & Color Token System
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Platform-wide Tailwind class tokens for every page and component.
 * Implements the HKI Duotone design language:
 *
 *   Iris  (#0E7C7B) — depth, focus, primary actions
 *   Neutral surfaces — secondary emphasis without another brand hue
 *
 * Surface Hierarchy (5 levels, No-Washout):
 *
 *   Level 0 — Page background (warm cream / deep ink)
 *   Level 1 — Ground / canvas (subtle step up)
 *   Level 2 — Card / panel (primary content surface)
 *   Level 3 — Raised / dropdown (elevated interactive)
 *   Level 4 — Overlay / modal (highest elevation)
 *
 * Accessibility targets (WCAG 2.1 AA):
 *   - Normal text (< 18px): 4.5:1 contrast ratio
 *   - Large text (≥ 18px bold / ≥ 24px): 3:1 contrast ratio
 *   - UI components & graphical objects: 3:1 ratio
 *   - Focus indicators: 3:1 against adjacent colors
 *
 * @module @hki/ui/theme/surfaces
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND ACCENT — HKI Duotone
// ═══════════════════════════════════════════════════════════════════════════════

/** Primary accent (legacy `Blue` alias) — HKI Iris actions, links, focus */
export const accentBlue = {
  /** Subtle tint background */
  bg: "bg-[#D5F8F5] dark:bg-[#0E7C7B]/14",
  /** Default text / icon color */
  text: "text-[#0E7C7B] dark:text-[#3DCBC6]",
  /** Solid fill (buttons, badges) */
  solid: "bg-[#0E7C7B] dark:bg-[#1FA9A5]",
  /** Solid fill text */
  solidText: "text-white",
  /** Border */
  border: "border-[#6EE0DA] dark:border-[#0B6261]",
  /** Hover */
  hover: "hover:bg-[#0B6261] dark:hover:bg-[#0E7C7B]",
} as const;

/** Secondary accent (legacy `Red` alias) — maps to HKI Iris for strict duotone */
export const accentRed = {
  bg: "bg-[#D5F8F5] dark:bg-[#0E7C7B]/14",
  text: "text-[#0E7C7B] dark:text-[#3DCBC6]",
  solid: "bg-[#0E7C7B] dark:bg-[#1FA9A5]",
  solidText: "text-white",
  border: "border-[#6EE0DA] dark:border-[#0B6261]",
  hover: "hover:bg-[#0B6261] dark:hover:bg-[#0E7C7B]",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SURFACE HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 5-level surface system.
 * Light: warm cream → white.  Dark: deep ink → lighter slate.
 * Each `.both` class applies light + dark: variant together.
 */
export const surface = {
  /** Level 0 — Page background */
  page: {
    light: "bg-[#faf9f7]",
    dark: "bg-[#111111]",
    both: "bg-[#faf9f7] dark:bg-[#111111]",
  },
  /** Level 1 — Ground / canvas */
  ground: {
    light: "bg-[#f5f4f1]",
    dark: "bg-[#161616]",
    both: "bg-[#f5f4f1] dark:bg-[#161616]",
  },
  /** Level 2 — Card / panel (contrast: visibly lighter than page #111111) */
  card: {
    light: "bg-white",
    dark: "bg-[#1e1e1e]",
    both: "bg-white dark:bg-[#1e1e1e]",
  },
  /** Level 3 — Raised / dropdown */
  raised: {
    light: "bg-white",
    dark: "bg-[#2a2a2a]",
    both: "bg-white dark:bg-[#2a2a2a]",
  },
  /** Level 4 — Overlay / modal */
  overlay: {
    light: "bg-white",
    dark: "bg-[#2e2e2e]",
    both: "bg-white dark:bg-[#2e2e2e]",
  },
  /** Hover state for interactive surfaces */
  hover: {
    light: "hover:bg-[#f7f6f3]",
    dark: "dark:hover:bg-[#2a2a2a]",
    both: "hover:bg-[#f7f6f3] dark:hover:bg-[#2a2a2a]",
  },
  /** Muted / recessed area inside cards */
  muted: {
    light: "bg-[#f3f2ef]",
    dark: "bg-[#1e1e1e]",
    both: "bg-[#f3f2ef] dark:bg-[#1e1e1e]",
  },
  /** Input field background */
  input: {
    light: "bg-white",
    dark: "bg-[#1e1e1e]",
    both: "bg-white dark:bg-[#1e1e1e]",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

/** Quiet separation — perceptible in both modes (dark: visible on #1e1e1e card) */
export const border = {
  default: "border-[#e0dfdc] dark:border-[#383838]",
  subtle: "border-[#eae9e6] dark:border-[#2e2e2e]",
  strong: "border-[#d1d0cd] dark:border-[#4a4a4a]",
  hover: "hover:border-[#d1d0cd] dark:hover:border-[#4a4a4a]",
  focus: "focus:border-[#0E7C7B] dark:focus:border-[#3DCBC6]",
  /** Brand Iris border for active/selected states */
  active: "border-[#0E7C7B] dark:border-[#3DCBC6]",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT COLOR HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Text tokens — high-contrast hierarchy.
 *
 * Light mode ratios (on #faf9f7 / #ffffff):
 *   heading  #1a1a19  ~16:1 ✓
 *   primary  #3f3e3d  ~9:1  ✓
 *   secondary #6f6e6b ~5:1  ✓
 *   muted    #8a8986  ~3.7:1 (large text / decorative only)
 *
 * Dark mode ratios (on #111111 / #1e1e1e — neutral, contrast-tuned):
 *   heading  #f5f4f1  ~14:1 ✓
 *   primary  #d1d0cd  ~9:1  ✓
 *   secondary #a3a29f ~5.5:1 ✓
 *   muted    #6f6e6b  ~3.5:1 (large text / decorative only; use secondary for body)
 */
export const textColor = {
  heading: "text-[#1a1a19] dark:text-[#f5f4f1]",
  primary: "text-[#3f3e3d] dark:text-[#d1d0cd]",
  secondary: "text-[#6f6e6b] dark:text-[#a3a29f]",
  muted: "text-[#8a8986] dark:text-[#6f6e6b]",
  inverse: "text-white dark:text-[#111111]",
  /** Brand link color — meets 4.5:1 on both surfaces */
  link: "text-[#0E7C7B] dark:text-[#3DCBC6]",
  linkHover: "hover:text-[#0B6261] dark:hover:text-[#6EE0DA]",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOW SYSTEM — Soft Depth
// ═══════════════════════════════════════════════════════════════════════════════

/** Shadows matched to surface levels. Dark mode shadows are stronger. */
export const shadow = {
  none: "shadow-none",
  xs: "shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]",
  sm: "shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_1px_2px_-1px_rgba(0,0,0,0.2)]",
  md: "shadow-[0_4px_6px_-2px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_6px_-2px_rgba(0,0,0,0.35),0_2px_4px_-2px_rgba(0,0,0,0.25)]",
  lg: "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4),0_4px_6px_-4px_rgba(0,0,0,0.3)]",
  /** Soft card shadow (combined border+shadow feel) */
  soft: "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)]",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS RING — Accessible keyboard navigation
// ═══════════════════════════════════════════════════════════════════════════════

/** WCAG 2.4.7 — 3:1 ratio against adjacent, 2px offset from page bg */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#3DCBC6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf9f7] dark:focus-visible:ring-offset-[#111111]";

/** Focus ring for elements on card surfaces (white offset) */
export const focusRingOnCard =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#3DCBC6] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1e1e1e]";

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS PALETTES — WCAG AA text-on-bg
// ═══════════════════════════════════════════════════════════════════════════════

export const status = {
  success: {
    bg: "bg-[#ecfdf5] dark:bg-[#064e3b]/20",
    text: "text-[#065f46] dark:text-[#6ee7b7]",
    border: "border-[#a7f3d0] dark:border-[#065f46]",
    icon: "text-[#16a34a] dark:text-[#4ade80]",
  },
  warning: {
    bg: "bg-[#fffbeb] dark:bg-[#78350f]/20",
    text: "text-[#92400e] dark:text-[#fcd34d]",
    border: "border-[#fde68a] dark:border-[#78350f]",
    icon: "text-[#d97706] dark:text-[#fbbf24]",
  },
  error: {
    bg: "bg-[#fef2f2] dark:bg-[#7f1d1d]/20",
    text: "text-[#991b1b] dark:text-[#fca5a5]",
    border: "border-[#fecaca] dark:border-[#7f1d1d]",
    icon: "text-[#dc2626] dark:text-[#f87171]",
  },
  info: {
    bg: "bg-[#eff6ff] dark:bg-[#1e3a5f]/20",
    text: "text-[#1e40af] dark:text-[#93c5fd]",
    border: "border-[#bfdbfe] dark:border-[#1e3a5f]",
    icon: "text-[#0284c7] dark:text-[#38bdf8]",
  },
  neutral: {
    bg: "bg-[#f3f2ef] dark:bg-[#1e1e1e]",
    text: "text-[#525150] dark:text-[#a3a29f]",
    border: "border-[#e0dfdc] dark:border-[#383838]",
    icon: "text-[#6f6e6b] dark:text-[#a3a29f]",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSED PATTERNS — Common multi-class combos
// ═══════════════════════════════════════════════════════════════════════════════

/** Page-level wrapper */
export const pageBg = `${surface.page.both} ${textColor.primary} min-h-screen transition-colors`;

/** Standard card */
export const card = `${surface.card.both} border ${border.default} rounded-xl ${shadow.sm}`;

/** Interactive card (clickable) */
export const cardInteractive = `${card} ${surface.hover.both} ${border.hover} hover:${shadow.md} transition-all cursor-pointer ${focusRingOnCard}`;

/** Elevated card (dropdowns, popovers) */
export const cardElevated = `${surface.raised.both} border ${border.default} rounded-xl ${shadow.md}`;

/** Modal / overlay surface */
export const cardOverlay = `${surface.overlay.both} border ${border.default} rounded-2xl ${shadow.lg}`;

/** Muted section inside a card */
export const sectionMuted = `${surface.muted.both} border ${border.subtle} rounded-lg`;

/** Input field base */
export const inputBase = `${surface.input.both} border ${border.default} ${border.focus} rounded-lg px-4 py-2.5 ${textColor.primary} placeholder:${textColor.muted} transition-all ${focusRingOnCard}`;

// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-WASHOUT ACCENT PATTERNS — CSS utility classes
//
// These reference CSS classes defined in each app's index.css. They provide
// the "visual anchor" layer that prevents the warm-stone-on-white washout.
// ═══════════════════════════════════════════════════════════════════════════════

/** Card with 3px left-edge brand accent — draws the eye to key content */
export const cardAccentLeft = "surface-accent-left rounded-xl";

/** Card with 2px top-edge colored accent — for stat/category cards.
 *  Use data-accent="red|green|yellow" for color variants. */
export const cardAccentTop = "surface-accent-top rounded-xl";

/** Subtle tinted section header — visual rhythm between card groups */
export const sectionHeader = "surface-section rounded-t-lg";

/** Recessed panel — sits below canvas level (sidebar wells, code blocks) */
export const panelRecessed = "surface-recessed rounded-lg";

/** Iris-tinted surface — for informational/primary context panels */
export const surfaceTintedBlue = "surface-tinted-blue rounded-xl";

/** Pulse-tinted surface — for alert/emphasis panels */
export const surfaceTintedRed = "surface-tinted-red rounded-xl";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type SurfaceLevel = keyof typeof surface;
export type StatusVariant = keyof typeof status;
