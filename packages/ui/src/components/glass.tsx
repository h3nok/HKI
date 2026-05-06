/**
 * Hermetic Atelier Primitives — Card, Badge, Stat, EmptyState
 *
 * Editorial, hairline-precise. Token-only, no inline hex, no glass blur,
 * no shadow stacks, no scale-on-hover. Motion is colour/border only.
 *
 * Signature hover: interactive surfaces reveal a 1px iris→pulse accent
 * along the leading edge — the "seam" of the Hermetic seal.
 *
 * @module @hki/ui/components/glass
 */

import * as React from "react";

import { cn } from "../utils";

// ═══════════════════════════════════════════════════════════════════════════
// HermeticCard — flat hairline surface with seam-reveal hover
// ═══════════════════════════════════════════════════════════════════════════

export interface HermeticCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation — Atelier exposes only flat (recessed) and raised (paper). */
  elevation?: "flat" | "raised";
  /** Whether card is interactive (colour-only hover, no lift). */
  interactive?: boolean;
  /** Visual variant. */
  variant?: "default" | "subtle" | "emphasis";
  /** Corner radius preset. */
  size?: "sm" | "md" | "lg";
  /** @deprecated retained for legacy call-sites; ignored. */
  accent?: string;
}

const CARD_RADIUS = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
};

/** Surface tones — shadow gives separation, never borders. */
const CARD_SURFACE = {
  default:
    "bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-6px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_4px_12px_-6px_rgba(0,0,0,0.5)]",
  subtle: "bg-muted/40 text-card-foreground",
  emphasis:
    "bg-card text-card-foreground shadow-[0_2px_4px_rgba(15,23,42,0.05),0_12px_24px_-12px_rgba(15,23,42,0.12)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.6)]",
};

/**
 * Signature interaction: a warm iris→pulse wash sweeps across the surface
 * from the leading edge on hover. No borders, no lift, no scale —
 * the surface itself swipes.
 */
const SURFACE_SWIPE = cn(
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-[linear-gradient(110deg,color-mix(in_srgb,var(--primary)_8%,transparent)_0%,color-mix(in_srgb,var(--secondary)_5%,transparent)_55%,transparent_100%)]",
  "before:origin-left before:scale-x-0 before:transition-transform before:duration-[420ms] before:ease-[cubic-bezier(0.22,1,0.36,1)]",
  "hover:before:scale-x-100",
);

export const HermeticCard = React.forwardRef<HTMLDivElement, HermeticCardProps>(
  (
    {
      className,
      elevation = "raised",
      interactive = false,
      variant = "default",
      size = "md",
      accent: _accent,
      children,
      ...props
    },
    ref,
  ) => {
    void _accent;
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          CARD_RADIUS[size],
          CARD_SURFACE[variant],
          elevation === "flat" &&
            "bg-transparent shadow-none",
          interactive &&
            cn(
              "cursor-pointer transition-shadow duration-200 ease-out",
              "hover:shadow-[0_4px_8px_rgba(15,23,42,0.06),0_24px_48px_-20px_rgba(15,23,42,0.18)]",
              "dark:hover:shadow-[0_4px_8px_rgba(0,0,0,0.5),0_24px_48px_-20px_rgba(0,0,0,0.7)]",
              SURFACE_SWIPE,
            ),
          className,
        )}
        {...props}
      >
        <div className="relative z-[1]">{children}</div>
      </div>
    );
  },
);
HermeticCard.displayName = "HermeticCard";

// ═══════════════════════════════════════════════════════════════════════════
// HermeticBadge — outline-first, token-tone
// ═══════════════════════════════════════════════════════════════════════════

export type HermeticBadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface HermeticBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: HermeticBadgeTone;
  variant?: "outline" | "filled";
  size?: "sm" | "md" | "lg";
  /** @deprecated legacy hex; ignored — use `tone`. */
  accent?: string;
}

const BADGE_OUTLINE: Record<HermeticBadgeTone, string> = {
  neutral: "bg-muted/60 text-muted-foreground",
  brand: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
};

const BADGE_FILLED: Record<HermeticBadgeTone, string> = {
  neutral: "bg-muted text-foreground",
  brand: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  info: "bg-info text-info-foreground",
};

const BADGE_SIZE = {
  sm: "h-4 px-1.5 text-[0.625rem] tracking-[0.08em]",
  md: "h-5 px-2 text-[0.6875rem] tracking-[0.06em]",
  lg: "h-6 px-2.5 text-xs tracking-[0.04em]",
};

export const HermeticBadge = React.forwardRef<
  HTMLSpanElement,
  HermeticBadgeProps
>(
  (
    {
      className,
      tone = "neutral",
      variant = "outline",
      size = "md",
      accent: _accent,
      children,
      ...props
    },
    ref,
  ) => {
    void _accent;
    const palette = variant === "filled" ? BADGE_FILLED : BADGE_OUTLINE;
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium uppercase rounded",
          BADGE_SIZE[size],
          palette[tone],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
HermeticBadge.displayName = "HermeticBadge";

// ═══════════════════════════════════════════════════════════════════════════
// HermeticStat — chrome-less metric, eyebrow + tabular numeral
// ═══════════════════════════════════════════════════════════════════════════

export interface HermeticStatProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  /** Optional inline icon shown next to the eyebrow label. */
  icon?: React.ReactNode;
  /** Optional sparkline / inline chart slot. */
  sparkline?: React.ReactNode;
  /** Compact density. */
  size?: "sm" | "md";
}

const TREND_TONE = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const TREND_GLYPH = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export const HermeticStat = React.forwardRef<HTMLDivElement, HermeticStatProps>(
  (
    {
      className,
      label,
      value,
      trend,
      trendValue,
      icon,
      sparkline,
      size = "md",
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1.5", className)}
        {...props}
      >
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          {icon && (
            <span className="text-muted-foreground/60 [&_svg]:size-3.5">
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <span
            className={cn(
              "tabular-nums tracking-[-0.02em] leading-[1] text-foreground",
              size === "md"
                ? "text-3xl font-extrabold"
                : "text-xl font-bold",
            )}
          >
            {value}
          </span>
          {trendValue && trend && (
            <span
              className={cn(
                "text-xs font-semibold tabular-nums pb-0.5",
                TREND_TONE[trend],
              )}
            >
              {TREND_GLYPH[trend]} {trendValue}
            </span>
          )}
        </div>
        {sparkline && <div className="mt-1">{sparkline}</div>}
      </div>
    );
  },
);
HermeticStat.displayName = "HermeticStat";

// ═══════════════════════════════════════════════════════════════════════════
// HermeticEmptyState
// ═══════════════════════════════════════════════════════════════════════════

export interface HermeticEmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const HermeticEmptyState = React.forwardRef<
  HTMLDivElement,
  HermeticEmptyStateProps
>(({ className, icon, title, description, action, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6 gap-3",
      className,
    )}
    {...props}
  >
    {icon && (
      <div className="text-muted-foreground/50 [&_svg]:size-6 mb-1">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold tracking-[-0.005em] text-foreground">
      {title}
    </h3>
    {description && (
      <p className="text-xs leading-[1.55] text-muted-foreground max-w-xs">
        {description}
      </p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
));
HermeticEmptyState.displayName = "HermeticEmptyState";

// ═══════════════════════════════════════════════════════════════════════════
// Legacy aliases — Hki* names retained for in-flight migrations
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated use HermeticCard */
export const HkiCard = HermeticCard;
/** @deprecated use HermeticBadge */
export const HkiBadge = HermeticBadge;
/** @deprecated use HermeticStat */
export const HkiStat = HermeticStat;
/** @deprecated use HermeticEmptyState */
export const HkiEmptyState = HermeticEmptyState;

export type HkiCardProps = HermeticCardProps;
export type HkiBadgeProps = HermeticBadgeProps;
export type HkiBadgeTone = HermeticBadgeTone;
export type HkiStatProps = HermeticStatProps;
export type HkiEmptyStateProps = HermeticEmptyStateProps;
