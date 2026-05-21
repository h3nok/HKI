import type { ThemeConfig } from "antd";

// ═══════════════════════════════════════════════════════════════════════════════
// ANT DESIGN THEME (used by ConfigProvider in design-system.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

import { colors } from "./design-system";

/**
 * Ant Design theme configuration mapped from the Signature Design System.
 * Used by the DesignSystemProvider's ConfigProvider.
 */
export const signatureTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0E7C7B",
    colorInfo: "#0284c7",
    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    fontFamily:
      'var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    fontSize: 14,
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    borderRadiusXS: 2,
    colorBgLayout: colors.neutral[50],
    colorBgContainer: colors.neutral[0],
    colorBgElevated: colors.neutral[0],
    colorBgSpotlight: colors.neutral[75],
    colorText: colors.neutral[700],
    colorTextSecondary: colors.neutral[500],
    colorTextTertiary: colors.neutral[400],
    colorTextQuaternary: colors.neutral[300],
    colorBorder: colors.neutral[200],
    colorBorderSecondary: colors.neutral[150],
    boxShadow:
      "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.06)",
    boxShadowSecondary:
      "0 2px 4px -1px rgba(0, 0, 0, 0.05), 0 4px 6px -1px rgba(0, 0, 0, 0.07)",
    boxShadowTertiary:
      "0 4px 6px -2px rgba(0, 0, 0, 0.04), 0 10px 15px -3px rgba(0, 0, 0, 0.08)",
  },
  components: {
    Button: {
      algorithm: true,
      controlHeight: 36,
      borderRadius: 6,
      primaryShadow: "0 2px 0 rgba(14,124,123, 0.12)",
      defaultBorderColor: colors.neutral[200],
      defaultBg: colors.neutral[0],
    },
    Card: {
      borderRadiusLG: 12,
      colorBgContainer: colors.neutral[0],
      colorBorderSecondary: colors.neutral[200],
    },
    Layout: {
      bodyBg: colors.neutral[50],
      headerBg: colors.neutral[0],
      siderBg: colors.neutral[0],
      headerHeight: 64,
    },
    Menu: {
      itemSelectedBg: "#D5F8F5",
      itemSelectedColor: "#0B6261",
      itemHoverBg: colors.neutral[75],
      activeBarBorderWidth: 0,
      itemBorderRadius: 6,
    },
    Table: {
      headerBg: colors.neutral[75],
      headerColor: colors.neutral[600],
      headerSplitColor: "transparent",
      rowHoverBg: colors.neutral[50],
      borderColor: colors.neutral[150],
    },
    Input: {
      colorBgContainer: colors.neutral[0],
      colorBorder: colors.neutral[200],
      hoverBorderColor: colors.neutral[300],
      activeBorderColor: "#0E7C7B",
      activeShadow: "0 0 0 3px rgba(14,124,123, 0.16)",
    },
    Select: {
      colorBgContainer: colors.neutral[0],
      colorBorder: colors.neutral[200],
      optionSelectedBg: "#D5F8F5",
    },
    Modal: {
      contentBg: colors.neutral[0],
      headerBg: colors.neutral[0],
      borderRadiusLG: 12,
    },
    Typography: {
      fontFamilyCode: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORT FROM DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export {
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
  gradients,
  // Utilities
  getStatusColors,
  transition,
  designTokens,
  // Types
  type ColorStep,
  type NeutralStep,
  type SpacingKey,
  type RadiusKey,
  type ShadowKey,
  type DurationKey,
  type EasingKey,
  type ZIndexKey,
  type StatusType,
  type SizeVariant,
  type GlowIntensity,
  type DesignTokens,
} from "./design-system";

export {
  cn,
  ui,
  hub,
  gradientText,
  when,
  either,
  type UIUtilities,
  type HubPresets,
} from "./utilities";
