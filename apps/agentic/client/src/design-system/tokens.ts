/**
 * Agentic Chat Design Tokens — Bridge Module
 *
 * THIS FILE IS A THIN BRIDGE. All core brand, color, and typography values
 * are sourced from @hki/ui (packages/ui). Only chat-UI-specific layout,
 * glass, glow, and grid tokens are defined locally.
 *
 * If you need a design token, check @hki/ui first:
 *   import { FONT_FAMILY, brandColors, colors, typography, ... } from '@hki/ui';
 *
 * This bridge keeps backward-compat for the chat UI's existing imports while
 * eliminating the competing neutral/brand palettes that caused cross-app drift.
 */

import {
  brandColors,
  colors,
  typography as sharedTypography,
  shadows,
  FONT_FAMILY as SHARED_FONT_FAMILY,
} from "@hki/ui";

// ============================================================================
// RE-EXPORTS — sourced from @hki/ui (single source of truth)
// ============================================================================

export const BRAND = brandColors;

export const FONT_FAMILY = SHARED_FONT_FAMILY;

/** Warm neutral scale — matches CSS primitives.css / semantic.css */
export const NEUTRAL = colors.neutral;

export const SEMANTIC = {
  success: {
    light: colors.status.success[50],
    base: colors.status.success[500],
    dark: colors.status.success[600],
  },
  warning: {
    light: colors.status.warning[50],
    base: colors.status.warning[500],
    dark: colors.status.warning[600],
  },
  error: {
    light: colors.status.error[100],
    base: colors.status.error[500],
    dark: colors.status.error[600],
  },
  info: {
    light: colors.status.info[50],
    base: colors.status.info[500],
    dark: colors.status.info[600],
  },
} as const;

export const TEXT = {
  primary: NEUTRAL[700],
  secondary: NEUTRAL[600],
  tertiary: NEUTRAL[500],
  disabled: NEUTRAL[400],
  inverse: NEUTRAL[0],
  link: BRAND.blue[500],
  linkHover: BRAND.blue[600],
  error: SEMANTIC.error.base,
} as const;

export const SURFACE = {
  background: NEUTRAL[50],
  base: NEUTRAL[0],
  raised: NEUTRAL[0],
  overlay: NEUTRAL[0],
  muted: NEUTRAL[100],
  sunken: NEUTRAL[75],
  hover: NEUTRAL[50],
} as const;

export const BORDER = {
  subtle: NEUTRAL[100],
  default: NEUTRAL[200],
  strong: NEUTRAL[300],
  focus: BRAND.blue[500],
} as const;

export const TYPOGRAPHY = {
  display: {
    size: sharedTypography.fontSize["3xl"],
    weight: sharedTypography.fontWeight.bold,
    lineHeight: 1.2,
    letterSpacing: sharedTypography.letterSpacing.tighter,
  },
  h1: {
    size: sharedTypography.fontSize.xl,
    weight: sharedTypography.fontWeight.semibold,
    lineHeight: 1.3,
    letterSpacing: sharedTypography.letterSpacing.tight,
  },
  h2: {
    size: sharedTypography.fontSize.lg,
    weight: sharedTypography.fontWeight.semibold,
    lineHeight: 1.35,
    letterSpacing: sharedTypography.letterSpacing.tight,
  },
  h3: {
    size: sharedTypography.fontSize.md,
    weight: sharedTypography.fontWeight.semibold,
    lineHeight: 1.4,
    letterSpacing: sharedTypography.letterSpacing.tight,
  },
  body: {
    size: sharedTypography.fontSize.sm,
    weight: sharedTypography.fontWeight.regular,
    lineHeight: 1.6,
    letterSpacing: sharedTypography.letterSpacing.normal,
  },
  bodySmall: {
    size: sharedTypography.fontSize.sm,
    weight: sharedTypography.fontWeight.regular,
    lineHeight: 1.5,
    letterSpacing: sharedTypography.letterSpacing.normal,
  },
  caption: {
    size: sharedTypography.fontSize.xs,
    weight: sharedTypography.fontWeight.medium,
    lineHeight: 1.4,
    letterSpacing: sharedTypography.letterSpacing.wide,
  },
  overline: {
    size: "0.6875rem",
    weight: sharedTypography.fontWeight.semibold,
    lineHeight: 1.4,
    letterSpacing: sharedTypography.letterSpacing.widest,
  },
  mono: {
    size: sharedTypography.fontSize.xs,
    weight: sharedTypography.fontWeight.medium,
    lineHeight: 1.4,
    letterSpacing: "0.04em",
    fontFamily: FONT_FAMILY.mono,
  },
  monoSmall: {
    size: "0.625rem",
    weight: sharedTypography.fontWeight.medium,
    lineHeight: 1.4,
    letterSpacing: "0.06em",
    fontFamily: FONT_FAMILY.mono,
  },
  label: {
    size: sharedTypography.fontSize.xs,
    weight: sharedTypography.fontWeight.bold,
    lineHeight: 1.3,
    letterSpacing: sharedTypography.letterSpacing.widest,
    textTransform: "uppercase" as const,
  },
} as const;

export const SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const ELEVATION = {
  flat: { shadow: shadows.none },
  raised: { shadow: shadows.sm },
  elevated: { shadow: shadows.md },
  overlay: { shadow: shadows.lg },
  floating: { shadow: shadows.lg },
} as const;

export const MOTION = {
  fast: 150,
  normal: 200,
  slow: 300,
  easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
  easeInOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  spring: {
    type: "spring" as const,
    stiffness: 400,
    damping: 28,
  },
  springGentle: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
  },
} as const;

export const RADIUS = {
  none: "0",
  xs: "0.125rem",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  full: "9999px",
} as const;

// ============================================================================
// CHAT-UI-SPECIFIC TOKENS — not in @hki/ui (layout is app-specific)
// ============================================================================

export const LAYOUT = {
  sidebar: {
    width: 320,
    minWidth: 280,
    maxWidth: 360,
    collapsedWidth: 0,
    collapsedIconWidth: 72,
  },
  contextPanel: {
    width: 360,
    minWidth: 320,
    maxWidth: 480,
    collapsedWidth: 72,
  },
  chat: {
    maxWidth: 720, // Industry standard readable width (ChatGPT/Claude ~720px)
    minWidth: 480,
    contentPadding: SPACING[6],
    inputPaddingY: SPACING[5], // 20px — matches ChatGPT/Claude bottom inset
    inputPaddingX: SPACING[6],
    messageBottomSpacer: 96, // keeps last message clear of the input bar; matches FAB bottom-24
  },
  header: {
    height: 56,
  },
  inputBar: {
    maxHeight: 200,
    minHeight: 56,
  },
} as const;

export const GRID = {
  baseUnit: 4,
  heroIconSize: 64,
  cardIconSize: 40,
  welcome: {
    heroToHeading: SPACING[8],
    headingToSubtitle: SPACING[2],
    heroToInput: SPACING[10],
    inputToCards: SPACING[8],
    cardsGap: SPACING[4],
    cardsToHint: SPACING[8],
  },
} as const;

export const GRADIENTS = {
  primary: BRAND.blue[500],
  primarySubtle: BRAND.blue[50],
  accent: BRAND.blue[500],
  accentSubtle: BRAND.blue[50],
  surface: SURFACE.base,
  surfaceSubtle: NEUTRAL[0],
  ambient: NEUTRAL[50],
  premiumBlue: BRAND.blue[500],
  premiumRed: BRAND.blue[500],
  premiumDark: NEUTRAL[900],
  aurora: BRAND.blue[500],
  meshDark: NEUTRAL[900],
} as const;

export const GLASS = {
  light: {
    background: "rgba(255, 255, 255, 0.7)",
    border: "rgba(255, 255, 255, 0.2)",
    backdrop: "blur(12px) saturate(180%)",
  },
  dark: {
    background: "rgba(15, 23, 42, 0.8)",
    border: "rgba(255, 255, 255, 0.1)",
    backdrop: "blur(16px) saturate(180%)",
  },
  card: {
    background: "rgba(30, 41, 59, 0.6)",
    border: "rgba(255, 255, 255, 0.08)",
    backdrop: "blur(12px)",
  },
  hud: {
    background: "rgba(20, 24, 33, 0.85)",
    border: "rgba(255,255,255,0.08)",
    borderFallback: "rgba(255, 255, 255, 0.08)",
    backdrop: "blur(16px) saturate(150%)",
    innerGlow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  input: {
    background: "rgba(15, 20, 30, 0.9)",
    border: "rgba(255, 255, 255, 0.1)",
    backdrop: "blur(20px) saturate(180%)",
    focusGlow: `0 0 0 1px color-mix(in srgb, ${BRAND.blue[500]} 50%, transparent), 0 0 24px -4px color-mix(in srgb, ${BRAND.blue[500]} 30%, transparent), 0 8px 32px rgba(0,0,0,0.4)`,
    idleGlow: "0 8px 32px rgba(0,0,0,0.4)",
  },
} as const;

export const GLOW = {
  blue: {
    sm: `0 0 20px -5px color-mix(in srgb, ${BRAND.blue[500]} 40%, transparent)`,
    md: `0 0 30px -5px color-mix(in srgb, ${BRAND.blue[500]} 50%, transparent)`,
    lg: `0 4px 40px -8px color-mix(in srgb, ${BRAND.blue[500]} 60%, transparent)`,
  },
  red: {
    sm: `0 0 20px -5px color-mix(in srgb, ${BRAND.red[500]} 40%, transparent)`,
    md: `0 0 30px -5px color-mix(in srgb, ${BRAND.red[500]} 50%, transparent)`,
    lg: `0 4px 40px -8px color-mix(in srgb, ${BRAND.red[500]} 60%, transparent)`,
  },
  mixed: {
    sm: `0 0 20px -5px color-mix(in srgb, ${BRAND.blue[500]} 40%, transparent)`,
    md: `0 0 30px -5px color-mix(in srgb, ${BRAND.blue[500]} 50%, transparent)`,
    lg: `0 4px 40px -8px color-mix(in srgb, ${BRAND.blue[500]} 60%, transparent)`,
  },
} as const;

export const QUICK_ACTIONS = [
  {
    id: "search-products",
    icon: "🔍",
    title: "Search Products",
    description: "Find items in catalog",
    gradient: BRAND.blue[50],
    iconColor: BRAND.blue[500],
  },
  {
    id: "check-inventory",
    icon: "📦",
    title: "Check Inventory",
    description: "Real-time stock levels",
    gradient: BRAND.blue[50],
    iconColor: BRAND.blue[500],
  },
  {
    id: "analytics",
    icon: "📊",
    title: "Analytics",
    description: "Sales & performance",
    gradient: BRAND.blue[50],
    iconColor: BRAND.blue[500],
  },
  {
    id: "price-check",
    icon: "💰",
    title: "Price Check",
    description: "Compare pricing",
    gradient: BRAND.blue[50],
    iconColor: BRAND.blue[500],
  },
] as const;

// ============================================================================
// AGGREGATE EXPORT (backward compat for `import { tokens } from ...`)
// ============================================================================

export const tokens = {
  BRAND,
  NEUTRAL,
  SEMANTIC,
  TEXT,
  SURFACE,
  BORDER,
  FONT_FAMILY,
  TYPOGRAPHY,
  SPACING,
  ELEVATION,
  LAYOUT,
  MOTION,
  RADIUS,
  GRID,
  GRADIENTS,
  GLASS,
  GLOW,
  QUICK_ACTIONS,
} as const;

export default tokens;
