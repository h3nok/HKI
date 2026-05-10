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
 * colors.brand.pulse[500]  // legacy alias -> HKI Iris
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
   * Brand Colors — HKI Iris plus legacy Pulse aliases
   * - Iris:  #0E7C7B — deep teal, depth, focus
   * - Pulse: compatibility alias mapped to Iris in strict duotone
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
      25: "#ECFDFC",
      50: "#D5F8F5",
      100: "#A8F0EB",
      200: "#6EE0DA",
      300: "#3DCBC6",
      400: "#1FA9A5",
      500: "#0E7C7B", // legacy alias -> HKI Iris
      600: "#0B6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
      950: "#010C0C",
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
    /** SUCCESS — Duotone status signal; labels and icons carry meaning */
    success: {
      25: "#ecfdfc",
      50: "#d5f8f5",
      100: "#a8f0eb",
      200: "#6ee0da",
      300: "#3dcbc6",
      400: "#1fa9a5",
      500: "#0e7c7b",
      600: "#0b6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
    },
    /** WARNING — Duotone status signal; labels and icons carry meaning */
    warning: {
      25: "#ecfdfc",
      50: "#d5f8f5",
      100: "#a8f0eb",
      200: "#6ee0da",
      300: "#3dcbc6",
      400: "#1fa9a5",
      500: "#0e7c7b",
      600: "#0b6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
    },
    /** ERROR — Duotone status signal; labels and icons carry meaning */
    error: {
      25: "#ecfdfc",
      50: "#d5f8f5",
      100: "#a8f0eb",
      200: "#6ee0da",
      300: "#3dcbc6",
      400: "#1fa9a5",
      500: "#0e7c7b",
      600: "#0b6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
    },
    /** INFO — Duotone status signal; labels and icons carry meaning */
    info: {
      25: "#ecfdfc",
      50: "#d5f8f5",
      100: "#a8f0eb",
      200: "#6ee0da",
      300: "#3dcbc6",
      400: "#1fa9a5",
      500: "#0e7c7b",
      600: "#0b6261",
      700: "#094948",
      800: "#063030",
      900: "#031818",
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
    pulse: "#0E7C7B",
    emerald: "#0B6261",
    amber: "#4a4a4a",
    violet: "#094948",
    cyan: "#1FA9A5",
    rose: "#363636",
    indigo: "#063030",
    orange: "#636363",
    teal: "#0E7C7B",
  },

  /**
   * Categorical Data Palette
   * For multi-series data visualizations. Use in order: data[1], data[2], etc.
   * @see CSS: --data-1 through --data-8
   */
  data: {
    1: "#0E7C7B", // HKI Iris (deep teal)
    2: "#363636", // Neutral
    3: "#094948", // HKI Iris dark
    4: "#636363", // Neutral
    5: "#3DCBC6", // HKI Iris light
    6: "#262626", // Neutral dark
    7: "#0B6261", // HKI Iris emphasis
    8: "#8c8c8c", // Neutral light
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
    subtle: colors.brand.iris[25],
    muted: colors.brand.iris[50],
    light: colors.brand.iris[100],
    default: colors.brand.iris[500],
    emphasis: colors.brand.iris[600],
    strong: colors.brand.iris[700],
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
    default: colors.brand.iris[500],
    hover: colors.brand.iris[600],
    active: colors.brand.iris[700],
    light: colors.brand.iris[50],
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
    sm: "0 0 0 1px rgba(14,124,123, 0.18)",
    md: "0 0 0 1px rgba(14,124,123, 0.22), 0 2px 8px -2px rgba(14,124,123, 0.18)",
  },
  pulse: {
    sm: "0 0 0 1px rgba(14,124,123, 0.18)",
    md: "0 0 0 1px rgba(14,124,123, 0.22), 0 2px 8px -2px rgba(14,124,123, 0.18)",
  },
} as const;

export const focusRings = {
  iris: "0 0 0 2px rgba(14,124,123, 0.4)",
  pulse: "0 0 0 2px rgba(14,124,123, 0.4)",
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
// FLAT COLOR PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const gradients = {
  brand: "#0E7C7B",
  brandReverse: "#0E7C7B",
  brandVertical: "#0E7C7B",
  brandHorizontal: "#0E7C7B",
  brandSubtle: "#D5F8F5",
  iris: "#0E7C7B",
  pulse: "#0E7C7B",
  subtle: "#f5f5f5",
  elevated: "#ffffff",
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
