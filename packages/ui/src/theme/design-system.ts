/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SIGNATURE DESIGN SYSTEM — TypeScript Token Definitions
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Enterprise-grade design token system for the Signature platform.
 * **Source of Truth**: tokens/index.css — this file mirrors those CSS variables.
 *
 * @packageDocumentation
 * @module @hki/ui/design-system
 *
 * @example Basic Usage
 * ```tsx
 * import { colors, spacing, ui, cn } from '@hki/ui';
 *
 * // Access tokens directly
 * <div style={{ color: colors.brand.iris[500] }} />
 *
 * // Use pre-built utility classes
 * <div className={cn(ui.card, ui.focusRing)} />
 * ```
 *
 * @example Status Colors
 * ```tsx
 * import { getStatusColors } from '@hki/ui';
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
export type GlowIntensity = "sm" | "md";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: COLOR SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete color system for the Signature platform.
 *
 * @remarks
 * Colors are organized into:
 * - **brand**: HKI Iris & Pulse — primary identity colors
 * - **neutral**: Warm gray scale — No-Washout palette
 * - **status**: Semantic colors for success/warning/error/info states
 * - **chart**: Data visualization palette (colorblind-safe)
 * - **data**: Categorical palette for multi-series charts
 *
 * @example
 * ```tsx
 * // Brand colors
 * colors.brand.iris[500]   // #0E7C7B — HKI Iris (deep teal)
 * colors.brand.pulse[500]  // #E07A1F — HKI Pulse (warm amber)
 *
 * // Status colors
 * colors.status.success[500]
 *
 * // Chart colors (for data viz)
 * colors.chart.emerald
 * colors.data[1]  // First series
 * ```
 *
 * @see CSS: --color-brand-iris-*, --color-brand-pulse-*, --neutral-*, --success-*, etc.
 */
export const colors = {
  /**
   * Brand Colors — HKI Iris & Pulse
   * - Iris:  #0E7C7B — deep teal, depth, focus
   * - Pulse: #E07A1F — warm amber, signal, warmth
   */
  brand: {
    iris: {
      25: "#ECFDFC",
      50: "#D5F8F5",
      100: "#A8F0EB",
      200: "#6EE0DA",
      300: "#3DCBC6",
      400: "#1FA9A5",
      500: "#0E7C7B", // ★ HKI Iris (deep teal — Pharos)
      600: "#0B6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
      950: "#010C0C",
    },
    pulse: {
      25: "#FFF8EE",
      50: "#FEEBCC",
      100: "#FDD49A",
      200: "#FBBA68",
      300: "#F49E3B",
      400: "#ED8A28",
      500: "#E07A1F", // ★ HKI Pulse (warm amber — Pharos)
      600: "#B8611A",
      700: "#8C4A14",
      800: "#5E320D",
      900: "#2F1907",
      950: "#170C03",
    },
  },

  /**
   * System Neutrals — High-contrast scale
   * Clean gray for screen clarity. No warm tint.
   */
  neutral: {
    0: "#ffffff",
    25: "#fafafa",
    50: "#f5f5f5",
    75: "#f0f0f0",
    100: "#e8e8e8",
    150: "#dfdfdf",
    200: "#d4d4d4",
    300: "#b5b5b5",
    400: "#8c8c8c",
    500: "#636363",
    600: "#4a4a4a",
    700: "#363636",
    800: "#262626",
    850: "#1c1c1c",
    900: "#141414",
    925: "#0f0f0f",
    950: "#0a0a0a",
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
      500: "#dc2626", // ★ Primary error
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
    iris: "#0E7C7B",
    pulse: "#E07A1F",
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
    1: "#0E7C7B", // HKI Iris (deep teal)
    2: "#E07A1F", // HKI Pulse (warm amber)
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
  selected: colors.brand.iris[25],
  input: colors.neutral[0],

  // Muted
  muted: colors.neutral[100],
  mutedForeground: colors.neutral[500],
} as const;

/**
 * Text Colors — Hierarchy System
 */
export const text = {
  primary: colors.neutral[800],
  secondary: colors.neutral[600],
  muted: colors.neutral[500],
  heading: colors.neutral[950],
  inverse: colors.neutral[0],
  link: colors.brand.iris[600],
  linkHover: colors.brand.iris[700],
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
  hover: colors.neutral[400],
  focus: colors.brand.iris[500],
  error: colors.status.error[500],
  success: colors.status.success[500],
  input: colors.neutral[200],
  inputHover: colors.neutral[400],
  inputFocus: colors.brand.iris[500],
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
  /** Iris accent scale (primary actions) */
  iris: {
    subtle: colors.brand.iris[25],
    muted: colors.brand.iris[50],
    light: colors.brand.iris[100],
    default: colors.brand.iris[500],
    emphasis: colors.brand.iris[600],
    strong: colors.brand.iris[700],
    contrast: colors.neutral[0],
  },
  /** Pulse accent scale (secondary/highlight) */
  pulse: {
    subtle: colors.brand.pulse[25],
    muted: colors.brand.pulse[50],
    light: colors.brand.pulse[100],
    default: colors.brand.pulse[500],
    emphasis: colors.brand.pulse[600],
    strong: colors.brand.pulse[700],
    contrast: colors.neutral[0],
  },
  /** Primary interactive tokens */
  primary: {
    default: colors.brand.iris[500],
    hover: colors.brand.iris[600],
    active: colors.brand.iris[700],
    light: colors.brand.iris[50],
  },
  /** Secondary interactive tokens */
  secondary: {
    default: colors.brand.pulse[500],
    hover: colors.brand.pulse[600],
    active: colors.brand.pulse[700],
    light: colors.brand.pulse[50],
  },
  /** Link colors */
  link: {
    default: colors.brand.iris[500],
    hover: colors.brand.iris[600],
    visited: colors.brand.iris[700],
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
 * @see CSS: --glow-iris-*, --glow-pulse-*
 */
export const glows = {
  iris: {
    sm: "0 0 0 1px rgba(14, 124, 123, 0.18)",
    md: "0 0 0 1px rgba(14, 124, 123, 0.22), 0 2px 8px -2px rgba(14, 124, 123, 0.18)",
  },
  pulse: {
    sm: "0 0 0 1px rgba(224, 122, 31, 0.18)",
    md: "0 0 0 1px rgba(224, 122, 31, 0.22), 0 2px 8px -2px rgba(224, 122, 31, 0.18)",
  },
} as const;

export const focusRings = {
  iris: "0 0 0 2px rgba(14, 124, 123, 0.4)",
  pulse: "0 0 0 2px rgba(224, 122, 31, 0.4)",
  offset: (bgColor: string = colors.neutral[25]) => `0 0 0 2px ${bgColor}`,
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
  brand: "linear-gradient(135deg, #0E7C7B 0%, #E07A1F 100%)",
  brandReverse: "linear-gradient(135deg, #E07A1F 0%, #0E7C7B 100%)",
  brandVertical: "linear-gradient(180deg, #0E7C7B 0%, #E07A1F 100%)",
  brandHorizontal: "linear-gradient(90deg, #0E7C7B 0%, #E07A1F 100%)",
  brandSubtle:
    "linear-gradient(135deg, rgba(14, 124, 123, 0.06) 0%, rgba(224, 122, 31, 0.06) 100%)",
  iris: "linear-gradient(135deg, #1FA9A5 0%, #094948 100%)",
  pulse: "linear-gradient(135deg, #F49E3B 0%, #8C4A14 100%)",
  subtle: "linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)",
  elevated: "linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)",
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
 * import { designTokens } from '@hki/ui';
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
