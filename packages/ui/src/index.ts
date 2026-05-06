// Utilities
export { cn } from "./utils";

// Hooks
export { useIsMobile } from "./hooks/use-mobile";
export {
  useRetry,
  useTimeout,
  useAsyncOperation,
  TimeoutError,
  type UseRetryOptions,
  type UseRetryReturn,
  type UseTimeoutOptions,
  type UseTimeoutReturn,
  type UseAsyncOperationOptions,
  type UseAsyncOperationReturn,
} from "./hooks/use-resilience";

/**
 * HKI Innovations Brand Colors
 * Standardized across all AI Platform apps.
 *
 * - HKI Blue: #0066B2 (primary actions, trust, reliability)
 * - HKI Red: #E31837 (emphasis, urgency, important actions)
 */
export const brandColors = {
  name: "HKIs",
  shortName: "Innovations",
  blue: {
    50: "#E6F2FA",
    100: "#CCE5F5",
    200: "#99CBEB",
    300: "#66B1E1",
    400: "#3397D7",
    500: "#0066B2", // ★ Core HKI Blue
    600: "#00528E",
    700: "#003E6B",
    800: "#002A47",
    900: "#001624",
  },
  red: {
    50: "#FCE8EC",
    100: "#F9D1D9",
    200: "#F3A3B3",
    300: "#ED758D",
    400: "#E74767",
    500: "#E31837", // ★ Core HKI Red
    600: "#B6132C",
    700: "#880E21",
    800: "#5B0916",
    900: "#2D050B",
  },
} as const;

/** HKI Iris — primary brand (Pharos deep teal). */
export const HKI_IRIS = "#0E7C7B";
/** HKI Pulse — secondary brand (Pharos warm amber). */
export const HKI_PULSE = "#E07A1F";
/** Full brand object (alias for brandColors) */
export const BRAND = brandColors;

/**
 * Warm Neutral Scale — No-Washout Palette
 * Stone/cream undertones for premium feel. Matches colors.neutral in design-system.ts
 * and the CSS primitives in tokens/primitives.css.
 */
import { colors as _colors } from "./theme/design-system";
export const neutrals = _colors.neutral;

/**
 * Motion tokens for animations
 */
export const motion = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 400,
  },
  easing: {
    smooth: [0.16, 1, 0.3, 1],
    spring: [0.34, 1.56, 0.64, 1],
    swift: [0.4, 0, 0.2, 1],
  },
} as const;

/**
 * Re-export components
 */
export * from "./components";

/**
 * Re-export patterns
 * NOTE: app-shell is Next.js-specific and should be imported directly:
 * import { AppShell } from '@signature/ui/patterns/app-shell'
 */
// export * from './patterns/app-shell'; // Commented out - requires Next.js

/**
 * Re-export providers and theme
 */
export { DesignSystemProvider } from "./providers/design-system";
export {
  ThemeProvider,
  useTheme,
  ThemeToggle,
  type Theme,
  type ThemeProviderProps,
  type ThemeContextValue,
} from "./providers/theme-provider";
export { signatureTheme } from "./theme/tokens";

/**
 * Error Boundary Components
 */
export {
  ErrorBoundary,
  ErrorFallback,
  AgentErrorFallback,
  useErrorBoundary,
  type ErrorBoundaryProps,
  type FallbackProps,
  type ErrorFallbackProps,
  type AgentErrorFallbackProps,
} from "./components/error-boundary";

/**
 * HKI Table Primitive
 * NOTE: HkiCard, HkiBadge, HkiStat, HkiEmptyState are
 * already re-exported via `export * from "./components"` → components/glass
 */
export {
  HkiTable,
  HkiThead,
  HkiTbody,
  HkiTr,
  HkiTh,
  HKITd,
} from "./components/HkiTable";
export type {
  HkiTableProps,
  HkiTheadProps,
  HkiTrProps,
  HkiThProps,
  SortDirection,
} from "./components/HkiTable";

// Re-export theme utilities from design-system
export {
  colors,
  surfaces,
  text,
  borders,
  accent,
  spacing,
  radius,
  shadows,
  glows,
  focusRings,
  typography,
  duration,
  easing,
  animation,
  zIndex,
  componentSize,
  layout,
  gradients,
  getStatusColors,
  transition,
  designTokens,
} from "./theme/design-system";

// Re-export UI utilities
export { ui, hub, gradientText, when, either } from "./theme/utilities";
export type { HubPresets } from "./theme/utilities";

// Platform-wide surface token system (HKI Duotone)
export {
  accentBlue,
  accentRed,
  surface,
  border as borderTokens,
  textColor,
  shadow as shadowTokens,
  focusRing as focusRingToken,
  focusRingOnCard,
  status as statusTokens,
  pageBg,
  card as cardToken,
  cardInteractive as cardInteractiveToken,
  cardElevated as cardElevatedToken,
  cardOverlay as cardOverlayToken,
  sectionMuted,
  inputBase,
  type SurfaceLevel,
  type StatusVariant,
} from "./theme/surfaces";

// ═══════════════════════════════════════════════════════════════════════════════
// FONT FAMILY — Platform-wide font stacks
// Convenience alias so apps can import { FONT_FAMILY } from '@hki/ui'
// instead of reaching into design-system/tokens.ts
// ═══════════════════════════════════════════════════════════════════════════════
export const FONT_FAMILY = {
  heading:
    '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace',
} as const;

// Re-export type utilities
export type { ClassValue } from "clsx";
