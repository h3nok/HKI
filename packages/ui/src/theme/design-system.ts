/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SIGNATURE DESIGN SYSTEM — TypeScript Token Definitions
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Enterprise-grade design token system for the Signature platform.
 * **Source of Truth**: tokens/index.css — this file mirrors those CSS variables.
 *
 * @packageDocumentation
 * @module @signature/ui/design-system
 *
 * @example Basic Usage
 * ```tsx
 * import { colors, spacing, ui, cn } from '@signature/ui';
 *
 * // Access tokens directly
 * <div style={{ color: colors.brand.blue[500] }} />
 *
 * // Use pre-built utility classes
 * <div className={cn(ui.card, ui.focusRing)} />
 * ```
 *
 * @example Status Colors
 * ```tsx
 * import { getStatusColors } from '@signature/ui';
 *
 * const { bg, text, border, icon } = getStatusColors('success');
 * ```
 *
 * Architecture Principles:
 * - **Type-safe**: Exhaustive TypeScript types with autocompletion
 * - **Immutable**: All objects are readonly (`as const`)
 * - **1:1 CSS Parity**: Every token maps to a CSS variable
 * - **WCAG 2.1 AA**: All color combinations meet contrast requirements
 * - **Composable**: Tokens combine without side effects
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Color scale steps — 12-step system for brand and status colors.
 * Follows perceptually uniform progression from light (25) to dark (950).
 * @see CSS: --hki-blue-{step}, --hki-red-{step}, --success-{step}, etc.
 */
export type ColorStep =
  | 25
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950;

/**
 * Neutral scale steps — 17-step warm neutral palette.
 * Extended scale with half-steps (75, 150, 850, 925) for fine-grained control.
 * @see CSS: --neutral-{step}
 */
export type NeutralStep =
  | 0
  | 25
  | 50
  | 75
  | 100
  | 150
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 850
  | 900
  | 925
  | 950;

/**
 * Spacing scale keys — 4px base unit system.
 * Values: 0, px, 0.5 (2px), 1 (4px), ... 64 (256px)
 * @see CSS: --space-{key}
 */
export type SpacingKey =
  | 0
  | "px"
  | 0.5
  | 1
  | 1.5
  | 2
  | 2.5
  | 3
  | 3.5
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 14
  | 16
  | 20
  | 24
  | 28
  | 32
  | 36
  | 40
  | 48
  | 56
  | 64;

/**
 * Border radius scale keys.
 * @see CSS: --radius-{key}
 */
export type RadiusKey =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "full";

/**
 * Shadow/elevation scale keys — soft depth system.
 * @see CSS: --shadow-{key}, --elevation-{0-5}
 */
export type ShadowKey = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Animation duration scale keys (milliseconds).
 * @see CSS: --duration-{key}
 */
export type DurationKey =
  | "instant"
  | "faster"
  | "fast"
  | "normal"
  | "moderate"
  | "slow"
  | "slower"
  | "slowest";

/**
 * Easing curve keys — perceptually smooth motion.
 * @see CSS: --ease-{key}
 */
export type EasingKey =
  | "linear"
  | "in"
  | "out"
  | "inOut"
  | "smooth"
  | "spring"
  | "swift"
  | "emphasized"
  | "decelerate";

/**
 * Z-index scale keys — predictable stacking order.
 * @see CSS: --z-{key}
 */
export type ZIndexKey =
  | "behind"
  | "base"
  | "raised"
  | "dropdown"
  | "sticky"
  | "fixed"
  | "overlay"
  | "modal"
  | "popover"
  | "toast"
  | "tooltip"
  | "max";

/**
 * Semantic status types for alerts, badges, and state indicators.
 */
export type StatusType = "success" | "warning" | "error" | "info" | "neutral";

/**
 * Component size variants.
 */
export type SizeVariant = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Glow intensity levels for brand accent effects.
 */
export type GlowIntensity = "sm" | "md" | "lg";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: COLOR SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete color system for the Signature platform.
 *
 * @remarks
 * Colors are organized into:
 * - **brand**: HKI Blue & Red — primary identity colors
 * - **neutral**: Warm gray scale — No-Washout palette
 * - **status**: Semantic colors for success/warning/error/info states
 * - **chart**: Data visualization palette (colorblind-safe)
 * - **data**: Categorical palette for multi-series charts
 *
 * @example
 * ```tsx
 * // Brand colors
 * colors.brand.blue[500]  // #2b45c2 — Core Blue
 * colors.brand.red[500]   // #dc2626 — Core Red
 *
 * // Status colors
 * colors.status.success[500]
 *
 * // Chart colors (for data viz)
 * colors.chart.emerald
 * colors.data[1]  // First series
 * ```
 *
 * @see CSS: --hki-blue-*, --hki-red-*, --neutral-*, --success-*, etc.
 */
export const colors = {
  /**
   * Brand Colors — Official HKI Blue & Red
   * - Blue: #0066B2 - Trust, authority, technology
   * - Red: #E31837 - Energy, urgency, action
   * Source: AI Platform design tokens.
   */
  brand: {
    blue: {
      25: "#F0F7FC",
      50: "#E6F2FA",
      100: "#CCE5F5",
      200: "#99CBEB",
      300: "#66B1E1",
      400: "#3397D7",
      500: "#0066B2", // ★ Official HKI Blue
      600: "#00528E",
      700: "#003E6B",
      800: "#002A47",
      900: "#001624",
      950: "#000B12",
    },
    red: {
      25: "#FEF5F6",
      50: "#FCE8EC",
      100: "#F9D1D9",
      200: "#F3A3B3",
      300: "#ED758D",
      400: "#E74767",
      500: "#E31837", // ★ Official HKI Red
      600: "#B6132C",
      700: "#880E21",
      800: "#5B0916",
      900: "#2D050B",
      950: "#170305",
    },
  },

  /**
   * Warm Neutrals — No-Washout Palette
   * Stone/cream undertones for premium feel. Avoids sterile white.
   * Extended scale with half-steps for precise control.
   */
  neutral: {
    0: "#ffffff", // Pure white — use sparingly
    25: "#fdfdfb", // Warm off-white
    50: "#faf9f7", // ★ App background — warm cream
    75: "#f7f6f3", // Subtle surface step
    100: "#f3f2ef", // Cards, panels — 1 step up
    150: "#eae9e6", // Interactive surfaces
    200: "#e0dfdc", // ★ Borders — visible but quiet
    300: "#d1d0cd", // Stronger borders
    400: "#a3a29f", // Placeholder text
    500: "#6f6e6b", // ★ Secondary text
    600: "#525150", // Body text
    700: "#3f3e3d", // ★ Primary text / headings
    800: "#292827", // Dark surfaces
    850: "#1f1e1d", // Darker
    900: "#171716", // ★ Near black (dark mode bg)
    925: "#121211", // Deeper
    950: "#0a0a09", // True dark
  },

  /**
   * Semantic Status Colors
   * Purpose-built colors for system states and data communication.
   * Each scale optimized for accessibility and clarity.
   */
  status: {
    /** SUCCESS — Positive outcomes, completions, approvals */
    success: {
      25: "#f0fdf4",
      50: "#dcfce7",
      100: "#bbf7d0",
      200: "#86efac",
      300: "#4ade80",
      400: "#22c55e",
      500: "#16a34a", // ★ Primary success
      600: "#15803d",
      700: "#166534",
      800: "#14532d",
      900: "#052e16",
    },
    /** WARNING — Cautions, pending states, attention needed */
    warning: {
      25: "#fffbeb",
      50: "#fef3c7",
      100: "#fde68a",
      200: "#fcd34d",
      300: "#fbbf24",
      400: "#f59e0b",
      500: "#d97706", // ★ Primary warning
      600: "#b45309",
      700: "#92400e",
      800: "#78350f",
      900: "#451a03",
    },
    /** ERROR — Failures, destructive actions, critical states */
    error: {
      25: "#fff7f7",
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#dc2626", // ★ Primary error (same as brand red)
      600: "#b91c1c",
      700: "#991b1b",
      800: "#7f1d1d",
      900: "#631414",
    },
    /** INFO — Informational, neutral highlights */
    info: {
      25: "#f0f9ff",
      50: "#e0f2fe",
      100: "#bae6fd",
      200: "#7dd3fc",
      300: "#38bdf8",
      400: "#0ea5e9",
      500: "#0284c7", // ★ Primary info
      600: "#0369a1",
      700: "#075985",
      800: "#0c4a6e",
      900: "#082f49",
    },
  },

  /**
   * Data Visualization Palette
   * Carefully selected colors for charts, graphs, and analytics.
   * Optimized for colorblind accessibility (Deuteranopia, Protanopia).
   * @see CSS: --chart-*
   */
  chart: {
    blue: "#2b45c2",
    red: "#dc2626",
    emerald: "#10b981",
    amber: "#f59e0b",
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    rose: "#f43f5e",
    indigo: "#6366f1",
    orange: "#f97316",
    teal: "#14b8a6",
  },

  /**
   * Categorical Data Palette
   * For multi-series data visualizations. Use in order: data[1], data[2], etc.
   * @see CSS: --data-1 through --data-8
   */
  data: {
    1: "#2b45c2", // Brand blue
    2: "#f87171", // Red-400
    3: "#10b981", // Emerald
    4: "#f59e0b", // Amber
    5: "#8b5cf6", // Violet
    6: "#06b6d4", // Cyan
    7: "#ec4899", // Pink
    8: "#84cc16", // Lime
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Surface System — No-Washout Depth Ladder
 * Each level is 1 step brighter than the previous
 */
export const surfaces = {
  background: colors.neutral[50], // App background (warm cream)
  ground: colors.neutral[75], // Recessed areas
  base: colors.neutral[0], // Cards, panels
  raised: colors.neutral[0], // Hover cards, dropdowns
  overlay: colors.neutral[0], // Modals, popovers

  // Interactive states
  hover: colors.neutral[75],
  active: colors.neutral[100],
  selected: colors.brand.blue[25],
  input: colors.neutral[0],

  // Muted
  muted: colors.neutral[100],
  mutedForeground: colors.neutral[500],
} as const;

/**
 * Text Colors — Hierarchy System
 */
export const text = {
  primary: colors.neutral[700], // Body text
  secondary: colors.neutral[500], // Secondary labels
  muted: colors.neutral[400], // Placeholders, hints
  heading: colors.neutral[900], // Headings - maximum contrast
  inverse: colors.neutral[0], // Text on dark backgrounds
  link: colors.brand.blue[500],
  linkHover: colors.brand.blue[600],
} as const;

/**
 * Border Colors — Quiet Separation
 * Hairline borders for separation, not loud decoration.
 * @see CSS: --border, --border-muted, --border-subtle, etc.
 */
export const borders = {
  default: colors.neutral[200],
  muted: colors.neutral[150],
  subtle: "rgba(0, 0, 0, 0.06)",
  hover: colors.neutral[300],
  focus: colors.brand.blue[500],
  error: colors.status.error[500],
  success: colors.status.success[500],
  /** Input-specific borders */
  input: colors.neutral[200],
  inputHover: colors.neutral[300],
  inputFocus: colors.brand.blue[400],
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: INTERACTIVE ACCENT TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interactive Accent System
 * Semantic tokens for buttons, links, and interactive elements.
 * @see CSS: --accent-blue-*, --accent-red-*, --accent-primary-*, --link-*
 */
export const accent = {
  /** Blue accent scale (primary actions) */
  blue: {
    subtle: colors.brand.blue[25],
    muted: colors.brand.blue[50],
    light: colors.brand.blue[100],
    default: colors.brand.blue[500],
    emphasis: colors.brand.blue[600],
    strong: colors.brand.blue[700],
    contrast: colors.neutral[0],
  },
  /** Red accent scale (destructive/secondary) */
  red: {
    subtle: colors.brand.red[25],
    muted: colors.brand.red[50],
    light: colors.brand.red[100],
    default: colors.brand.red[500],
    emphasis: colors.brand.red[600],
    strong: colors.brand.red[700],
    contrast: colors.neutral[0],
  },
  /** Primary interactive tokens */
  primary: {
    default: colors.brand.blue[500],
    hover: colors.brand.blue[600],
    active: colors.brand.blue[700],
    light: colors.brand.blue[50],
  },
  /** Secondary interactive tokens */
  secondary: {
    default: colors.brand.red[500],
    hover: colors.brand.red[600],
    active: colors.brand.red[700],
    light: colors.brand.red[50],
  },
  /** Link colors */
  link: {
    default: colors.brand.blue[500],
    hover: colors.brand.blue[600],
    visited: colors.brand.blue[700],
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: SPACING SYSTEM — 4px Base Unit
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  11: "2.75rem", // 44px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  28: "7rem", // 112px
  32: "8rem", // 128px
  36: "9rem", // 144px
  40: "10rem", // 160px
  48: "12rem", // 192px
  56: "14rem", // 224px
  64: "16rem", // 256px
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
  none: "0",
  xs: "0.125rem", // 2px
  sm: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  "3xl": "1.5rem", // 24px
  full: "9999px",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: ELEVATION & SHADOWS — Soft Depth System
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Shadow System — Soft depth for quiet elevation.
 * Combined with borders for "material on material" feel.
 * @see CSS: --shadow-*, --elevation-*, --glow-*, --ring-*
 */
export const shadows = {
  /** Shadow ladder (matches surface ladder) */
  none: "none",
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.06)",
  md: "0 2px 4px -1px rgba(0, 0, 0, 0.05), 0 4px 6px -1px rgba(0, 0, 0, 0.07)",
  lg: "0 4px 6px -2px rgba(0, 0, 0, 0.04), 0 10px 15px -3px rgba(0, 0, 0, 0.08)",
  xl: "0 10px 10px -5px rgba(0, 0, 0, 0.03), 0 20px 25px -5px rgba(0, 0, 0, 0.08)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.15)",

  /** Inset shadows for inputs/recessed areas */
  insetSm: "inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
  insetMd: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",

  /** Soft card shadow */
  soft: "0 2px 8px -2px rgba(0, 0, 0, 0.08)",
} as const;

/**
 * Brand Glow Effects
 * Subtle colored shadows for emphasis on interactive elements.
 * @see CSS: --glow-blue-*, --glow-red-*
 */
export const glows = {
  blue: {
    sm: "0 0 0 1px rgba(43, 69, 194, 0.08), 0 2px 8px -2px rgba(43, 69, 194, 0.12), 0 4px 12px -4px rgba(43, 69, 194, 0.08)",
    md: "0 0 0 1px rgba(43, 69, 194, 0.12), 0 4px 16px -4px rgba(43, 69, 194, 0.18), 0 8px 24px -8px rgba(43, 69, 194, 0.12)",
    lg: "0 0 0 1px rgba(43, 69, 194, 0.16), 0 8px 32px -8px rgba(43, 69, 194, 0.24), 0 16px 48px -16px rgba(43, 69, 194, 0.16)",
  },
  red: {
    sm: "0 0 0 1px rgba(220, 38, 38, 0.08), 0 2px 8px -2px rgba(220, 38, 38, 0.12), 0 4px 12px -4px rgba(220, 38, 38, 0.08)",
    md: "0 0 0 1px rgba(220, 38, 38, 0.12), 0 4px 16px -4px rgba(220, 38, 38, 0.18), 0 8px 24px -8px rgba(220, 38, 38, 0.12)",
    lg: "0 0 0 1px rgba(220, 38, 38, 0.16), 0 8px 32px -8px rgba(220, 38, 38, 0.24), 0 16px 48px -16px rgba(220, 38, 38, 0.16)",
  },
} as const;

/**
 * Focus Ring System
 * Accessible focus indicators for keyboard navigation.
 * @see CSS: --ring-blue, --ring-red, --ring-offset
 */
export const focusRings = {
  blue: "0 0 0 3px rgba(43, 69, 194, 0.25)",
  red: "0 0 0 3px rgba(220, 38, 38, 0.25)",
  /** Ring with offset (for elements on dark backgrounds) */
  offset: (bgColor: string = colors.neutral[50]) => `0 0 0 2px ${bgColor}`,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace',
    display:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    md: "1.125rem", // 18px
    lg: "1.25rem", // 20px
    xl: "1.5rem", // 24px
    "2xl": "1.875rem", // 30px
    "3xl": "2.25rem", // 36px
    "4xl": "3rem", // 48px
    "5xl": "3.75rem", // 60px
    "6xl": "4.5rem", // 72px
  },

  lineHeight: {
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  },

  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },

  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION & MOTION
// ═══════════════════════════════════════════════════════════════════════════════

export const duration = {
  instant: 50,
  faster: 100,
  fast: 150,
  normal: 200,
  moderate: 250,
  slow: 300,
  slower: 400,
  slowest: 500,
} as const;

export const easing = {
  linear: "linear",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  swift: "cubic-bezier(0.4, 0, 0.2, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)",
} as const;

/**
 * Framer Motion Animation Variants
 * Pre-built animation presets for consistent motion
 */
export const animation = {
  /** Fade in from below */
  fadeInUp: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.slow / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Fade in from above */
  fadeInDown: {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.slow / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Fade in with scale */
  fadeInScale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: duration.normal / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Simple fade */
  fade: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: duration.normal / 1000 },
    },
  },

  /** Slide in from left */
  slideInLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: duration.slow / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Slide in from right */
  slideInRight: {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: duration.slow / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Stagger container for children */
  staggerContainer: (staggerDelay: number = 0.1) => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: staggerDelay },
    },
  }),

  /** Stagger item (use with staggerContainer) */
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.slow / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  },

  /** Spring animation for interactive elements */
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 25,
  },

  /** Tap/press animation */
  tap: { scale: 0.98 },

  /** Hover animation */
  hover: { scale: 1.02 },

  /** Subtle hover */
  hoverSubtle: { y: -2 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Z-INDEX SCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const zIndex = {
  behind: -1,
  base: 0,
  raised: 1,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  max: 9999,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT SIZING
// ═══════════════════════════════════════════════════════════════════════════════

export const componentSize = {
  input: {
    sm: "2rem", // 32px
    md: "2.5rem", // 40px
    lg: "3rem", // 48px
  },
  button: {
    xs: "1.75rem", // 28px
    sm: "2rem", // 32px
    md: "2.5rem", // 40px
    lg: "3rem", // 48px
    xl: "3.5rem", // 56px
  },
  avatar: {
    xs: "1.5rem", // 24px
    sm: "2rem", // 32px
    md: "2.5rem", // 40px
    lg: "3rem", // 48px
    xl: "4rem", // 64px
    "2xl": "5rem", // 80px
  },
  icon: {
    xs: "0.75rem", // 12px
    sm: "1rem", // 16px
    md: "1.25rem", // 20px
    lg: "1.5rem", // 24px
    xl: "2rem", // 32px
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const layout = {
  sidebar: {
    width: "16rem", // 256px
    collapsed: "4rem", // 64px
  },
  header: {
    height: "4rem", // 64px
  },
  footer: {
    height: "4rem", // 64px
  },
  content: {
    xs: "20rem", // 320px
    sm: "24rem", // 384px
    md: "28rem", // 448px
    lg: "32rem", // 512px
    xl: "36rem", // 576px
    "2xl": "42rem", // 672px
    "3xl": "48rem", // 768px
    "4xl": "56rem", // 896px
    "5xl": "64rem", // 1024px
    "6xl": "72rem", // 1152px
    "7xl": "80rem", // 1280px
    full: "100%",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRADIENT PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const gradients = {
  /** Primary brand gradient (Blue → Red) */
  brand: "linear-gradient(135deg, #2b45c2 0%, #dc2626 100%)",
  brandReverse: "linear-gradient(135deg, #dc2626 0%, #2b45c2 100%)",
  brandVertical: "linear-gradient(180deg, #2b45c2 0%, #dc2626 100%)",
  brandHorizontal: "linear-gradient(90deg, #2b45c2 0%, #dc2626 100%)",

  /** Subtle gradients (for backgrounds) */
  brandSubtle:
    "linear-gradient(135deg, rgba(43, 69, 194, 0.06) 0%, rgba(220, 38, 38, 0.06) 100%)",
  brandLight: "linear-gradient(135deg, #ebeffe 0%, #fef2f2 100%)",

  /** Monochromatic */
  blue: "linear-gradient(135deg, #536ef3 0%, #2339a8 100%)",
  blueLight: "linear-gradient(135deg, #ebeffe 0%, #d4dbfc 100%)",
  red: "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
  redLight: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",

  /** Neutral */
  subtle: "linear-gradient(180deg, #faf9f7 0%, #f3f2ef 100%)",
  elevated: "linear-gradient(180deg, #ffffff 0%, #faf9f7 100%)",

  /** Shimmer/loading */
  shimmer:
    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: STATUS STYLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get status-specific colors
 */
export function getStatusColors(status: StatusType) {
  const statusMap = {
    success: {
      bg: colors.status.success[50],
      text: colors.status.success[700],
      border: colors.status.success[200],
      icon: colors.status.success[500],
    },
    warning: {
      bg: colors.status.warning[50],
      text: colors.status.warning[700],
      border: colors.status.warning[200],
      icon: colors.status.warning[500],
    },
    error: {
      bg: colors.status.error[50],
      text: colors.status.error[700],
      border: colors.status.error[200],
      icon: colors.status.error[500],
    },
    info: {
      bg: colors.status.info[50],
      text: colors.status.info[700],
      border: colors.status.info[200],
      icon: colors.status.info[500],
    },
    neutral: {
      bg: colors.neutral[100],
      text: colors.neutral[700],
      border: colors.neutral[200],
      icon: colors.neutral[500],
    },
  };
  return statusMap[status];
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: TRANSITION SHORTHAND
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate CSS transition string
 */
export function transition(
  properties: string | string[] = "all",
  durationKey: DurationKey = "normal",
  easingKey: EasingKey = "smooth",
): string {
  const props = Array.isArray(properties) ? properties.join(", ") : properties;
  return `${props} ${duration[durationKey]}ms ${easing[easingKey]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMBINED TOKENS OBJECT (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Combined Design Tokens Object
 * All tokens in a single namespace for convenient access.
 *
 * @example
 * ```tsx
 * import { designTokens } from '@signature/ui';
 *
 * const { colors, spacing, shadows } = designTokens;
 * ```
 */
export const designTokens = {
  // Color system
  colors,
  surfaces,
  text,
  borders,
  accent,
  // Spacing & sizing
  spacing,
  radius,
  // Elevation
  shadows,
  glows,
  focusRings,
  // Typography
  typography,
  // Animation
  duration,
  easing,
  animation,
  // Layout
  zIndex,
  componentSize,
  layout,
  // Gradients
  gradients,
  // Utilities
  getStatusColors,
  transition,
} as const;

/** Type for the complete design tokens object */
export type DesignTokens = typeof designTokens;
