/**
 * Dashboard Surface Hierarchy
 * ═══════════════════════════════════════════════════════════════
 *
 * 5-level depth system following "No-Washout" design principles:
 *
 *   Level 0 — Page background (recessed)
 *   Level 1 — Ground / canvas
 *   Level 2 — Card / panel (primary content surface)
 *   Level 3 — Raised / popover (elevated interactive)
 *   Level 4 — Overlay / modal (highest elevation)
 *
 * Each level has:
 *   bg, border, shadow, text (primary + secondary + muted)
 *
 * Contrast targets: WCAG 2.1 AA minimum
 *   - Normal text (< 18px): 4.5:1 ratio
 *   - Large text (≥ 18px bold / ≥ 24px): 3:1 ratio
 *   - UI components & graphical objects: 3:1 ratio
 *
 * Light mode: cool blue-tinted neutrals (HKI Blue brand presence)
 * Dark mode: blue-tinted dark surfaces (~4% #0066B2 mix for cohesive brand feel)
 */

export const surface = {
  /** Level 0 — Page background */
  page: {
    light: "bg-[#f6f8fb]",
    dark: "bg-[#101417]",
    both: "bg-[#f6f8fb] dark:bg-[#101417]",
  },

  /** Level 1 — Ground / canvas (sits on page bg) */
  ground: {
    light: "bg-[#f0f4f9]",
    dark: "bg-[#15191c]",
    both: "bg-[#f0f4f9] dark:bg-[#15191c]",
  },

  /** Level 2 — Card / panel (primary content) */
  card: {
    light: "bg-[#fafbfe]",
    dark: "bg-[#1d2124]",
    both: "bg-[#fafbfe] dark:bg-[#1d2124]",
  },

  /** Level 3 — Raised / dropdown (elevated interactive) */
  raised: {
    light: "bg-[#f8fafd]",
    dark: "bg-[#23272a]",
    both: "bg-[#f8fafd] dark:bg-[#23272a]",
  },

  /** Level 4 — Overlay / modal (highest) */
  overlay: {
    light: "bg-[#fafbfe]",
    dark: "bg-[#282c2f]",
    both: "bg-[#fafbfe] dark:bg-[#282c2f]",
  },

  /** Interactive hover (for cards/buttons) */
  hover: {
    light: "hover:bg-[#f0f4f9]",
    dark: "dark:hover:bg-[#23272a]",
    both: "hover:bg-[#f0f4f9] dark:hover:bg-[#23272a]",
  },

  /** Muted / recessed areas within cards */
  muted: {
    light: "bg-[#edf1f7]",
    dark: "bg-[#191d20]",
    both: "bg-[#edf1f7] dark:bg-[#191d20]",
  },

  /** Input fields */
  input: {
    light: "bg-[#fafbfe]",
    dark: "bg-[#191d20]",
    both: "bg-[#fafbfe] dark:bg-[#191d20]",
  },
} as const;

/**
 * Border tokens — quiet separation, perceptible in both modes
 */
export const border = {
  /** Default card/section border */
  default: "border-[#d4dce6] dark:border-[#30363b]",
  /** Subtle inner border */
  subtle: "border-[#e0e7f0] dark:border-[#272e32]",
  /** Stronger border for emphasis */
  strong: "border-[#c5cdd8] dark:border-[#40464b]",
  /** Interactive hover border */
  hover: "hover:border-[#c5cdd8] dark:hover:border-[#40464b]",
  /** Focus border */
  focus: "focus:border-[#0066B2] dark:focus:border-[#3397D7]",
} as const;

/**
 * Text tokens — high-contrast hierarchy
 *
 * Light mode contrast ratios (on #f6f8fb / #fafbfe):
 *   heading (#1a1a19): ~16:1 ✓
 *   primary (#3f3e3d): ~9:1 ✓
 *   secondary (#6f6e6b): ~5:1 ✓
 *   muted (#8a8986): ~3.7:1 (large text OK, decorative)
 *
 * Dark mode contrast ratios (on #101417 / #1d2124):
 *   heading (#f5f4f1): ~15:1 ✓
 *   primary (#d1d0cd): ~10:1 ✓
 *   secondary (#a3a29f): ~6:1 ✓
 *   muted (#6f6e6b): ~3.5:1 (large text OK, decorative)
 */
export const textColor = {
  /** Headings — maximum contrast */
  heading: "text-[#1a1a19] dark:text-[#f5f4f1]",
  /** Primary body text */
  primary: "text-[#3f3e3d] dark:text-[#d1d0cd]",
  /** Secondary / supporting text */
  secondary: "text-[#6f6e6b] dark:text-[#a3a29f]",
  /** Muted / decorative (use on large text only, or non-essential) */
  muted: "text-[#8a8986] dark:text-[#6f6e6b]",
  /** Inverse text (on colored backgrounds) */
  inverse: "text-white dark:text-[#101417]",
} as const;

/**
 * Shadow tokens — soft depth matching surface level
 */
export const shadow = {
  none: "shadow-none",
  /** Level 1: ground */
  xs: "shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]",
  /** Level 2: card */
  sm: "shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_1px_2px_-1px_rgba(0,0,0,0.2)]",
  /** Level 3: raised / hover */
  md: "shadow-[0_4px_6px_-2px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_6px_-2px_rgba(0,0,0,0.35),0_2px_4px_-2px_rgba(0,0,0,0.25)]",
  /** Level 4: overlay */
  lg: "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4),0_4px_6px_-4px_rgba(0,0,0,0.3)]",
} as const;

/**
 * Focus ring — WCAG 2.1 SC 2.4.7 compliant
 * 3px offset, high-contrast brand ring
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066B2] dark:focus-visible:ring-[#3397D7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f8fb] dark:focus-visible:ring-offset-[#101417]";

/**
 * Status color palettes — WCAG AA compliant
 * Text on respective bg meets 4.5:1 in both modes
 */
export const status = {
  emerald: {
    bg: "bg-[#ecfdf5] dark:bg-[#064e3b]/20",
    text: "text-[#065f46] dark:text-[#6ee7b7]",
    border: "border-[#a7f3d0] dark:border-[#065f46]",
  },
  blue: {
    bg: "bg-[#eff6ff] dark:bg-[#1e3a5f]/20",
    text: "text-[#1e40af] dark:text-[#93c5fd]",
    border: "border-[#bfdbfe] dark:border-[#1e3a5f]",
  },
  violet: {
    bg: "bg-[#f5f3ff] dark:bg-[#4c1d95]/20",
    text: "text-[#5b21b6] dark:text-[#c4b5fd]",
    border: "border-[#ddd6fe] dark:border-[#4c1d95]",
  },
  amber: {
    bg: "bg-[#fffbeb] dark:bg-[#78350f]/20",
    text: "text-[#92400e] dark:text-[#fcd34d]",
    border: "border-[#fde68a] dark:border-[#78350f]",
  },
  red: {
    bg: "bg-[#fef2f2] dark:bg-[#7f1d1d]/20",
    text: "text-[#991b1b] dark:text-[#fca5a5]",
    border: "border-[#fecaca] dark:border-[#7f1d1d]",
  },
  slate: {
    bg: "bg-[#edf1f7] dark:bg-[#1d2124]",
    text: "text-[#525150] dark:text-[#a3a29f]",
    border: "border-[#d4dce6] dark:border-[#30363b]",
  },
} as const;

export type SurfaceLevel = keyof typeof surface;
export type StatusVariant = keyof typeof status;
