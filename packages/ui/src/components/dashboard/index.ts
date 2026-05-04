export { GridBackground, type GridBackgroundProps } from "./grid-background";
export { StatPill, type StatPillProps, type StatPillColor } from "./stat-pill";
export { DashboardCard, type DashboardCardProps } from "./dashboard-card";
export { InteractiveBentoGrid, type InteractiveBentoGridProps } from "./bento-grid";
export { BentoCard, type BentoCardProps } from "./bento-card";
export {
  DashboardBanner,
  type DashboardBannerProps,
  type Stat,
  type GamificationBadge,
} from "./dashboard-banner";
export { PageShell, type PageShellProps, type BreadcrumbItem } from "./page-shell";
export { PageHeader, type PageHeaderProps } from "./page-header";
export { ThemeToggle, type ThemeToggleProps } from "./theme-toggle";
export { StatusBadge, type StatusBadgeProps, type StatusBadgeVariant } from "./status-badge";
export { FilterBar, type FilterBarProps, type FilterOption } from "./filter-bar";
export {
  DUOTONE,
  EASE,
  fadeUp,
  stagger,
  cardPop,
  PRIORITY_STYLES,
  STAGE_COLORS,
  formatCurrency,
} from "./page-animations";

// Re-export platform surface tokens for convenience
export {
  surface,
  border,
  textColor,
  shadow,
  focusRing,
  focusRingOnCard,
  status,
  accentBlue,
  accentRed,
  pageBg,
  type SurfaceLevel,
  type StatusVariant,
} from "../../theme/surfaces";
