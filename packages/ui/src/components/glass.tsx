/**
 * HKI Primitives — Card, Badge, Stat, EmptyState
 *
 * Clean, minimal surface components. No decorative overlays.
 *
 * Design principles:
 * - Clean glass surface with subtle border
 * - Gentle spring-physics hover lift (no scale, no glow, no spotlight)
 * - Three sizes controlling radius
 * - Three variants controlling opacity/blur
 * - forwardRef + rest-props for full composability
 *
 * @module @hki/ui/components/glass
 */

import { motion } from "framer-motion";
import * as React from "react";

import { cn } from "../utils";

// ═══════════════════════════════════════════════════════════════════════════
// Tokens
// ═══════════════════════════════════════════════════════════════════════════

const SURFACE = {
  default: "bg-card border border-black/10 dark:border-white/[0.12]",
  subtle: "bg-card/90 border border-black/8 dark:border-white/[0.07]",
  emphasis: "bg-card border-none ring-1 ring-black/12 dark:ring-white/[0.18]",
};

const ELEVATION = {
  flat: "shadow-sm dark:shadow-md",
  raised:
    "shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
  floating:
    "shadow-[0_4px_8px_rgba(0,0,0,0.06),0_20px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)]",
};

const SIZE = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-[1.75rem]",
};

// ═══════════════════════════════════════════════════════════════════════════
// HkiCard
// ═══════════════════════════════════════════════════════════════════════════

export interface HkiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation level — affects shadow depth */
  elevation?: "flat" | "raised" | "floating";
  /** Whether card lifts on hover */
  interactive?: boolean;
  /** Visual variant */
  variant?: "default" | "subtle" | "emphasis";
  /** Size — controls corner radius */
  size?: "sm" | "md" | "lg";
  /** Accent color (used only for accent-left-border variant if needed) */
  accent?: string;
}

export const HkiCard = React.forwardRef<HTMLDivElement, HkiCardProps>(
  (
    {
      className,
      elevation = "raised",
      interactive = true,
      variant = "default",
      size = "md",
      accent: _accent,
      style,
      onClick,
      onMouseEnter,
      onMouseLeave,
      children,
      ...props
    },
    ref
  ) => {
    // Omit rest props from motion.div to avoid React↔framer-motion type conflicts
    void props;
    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative transition-all duration-300 will-change-transform group",
          SIZE[size],
          SURFACE[variant],
          ELEVATION[elevation],
          interactive &&
            "cursor-pointer hover:border-black/15 dark:hover:border-white/20 hover:shadow-lg transition-all duration-300",
          className
        )}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(style ? { style: style as any } : {})}
      >
        <div className="relative z-1 flex-1 flex flex-col w-full">{children}</div>
      </motion.div>
    );
  }
);
HkiCard.displayName = "HkiCard";

// ═══════════════════════════════════════════════════════════════════════════
// HkiBadge
// ═══════════════════════════════════════════════════════════════════════════

export interface HkiBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Accent color — hex or CSS variable */
  accent?: string;
  size?: "sm" | "md" | "lg";
}

export const HkiBadge = React.forwardRef<HTMLSpanElement, HkiBadgeProps>(
  ({ className, accent = "#0066B2", size = "md", children, ...props }, ref) => {
    const sizeStyles = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-1 text-sm",
      lg: "px-3 py-1.5 text-base",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium rounded-lg border",
          sizeStyles[size],
          "transition-colors duration-200",
          className
        )}
        style={{
          backgroundColor: `${accent}10`,
          borderColor: `${accent}30`,
          color: accent,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);
HkiBadge.displayName = "HkiBadge";

// ═══════════════════════════════════════════════════════════════════════════
// HkiStat — Compact metric card
// ═══════════════════════════════════════════════════════════════════════════

export interface HkiStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
}

export const HkiStat = React.forwardRef<HTMLDivElement, HkiStatProps>(
  ({ className, label, value, trend, trendValue, icon, ...props }, ref) => {
    const trendIcon =
      trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "neutral" ? "→" : null;

    const trendColor =
      trend === "up"
        ? "text-emerald-600 dark:text-emerald-400"
        : trend === "down"
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-1 px-4 py-3 rounded-xl",
          "bg-white/60 dark:bg-[#111111]/60 backdrop-blur-2xl",
          "border border-black/10 dark:border-white/10",
          "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          {icon && <span className="text-muted-foreground/60">{icon}</span>}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
          {trendValue && (
            <span className={cn("text-xs font-semibold pb-0.5", trendColor)}>
              {trendIcon} {trendValue}
            </span>
          )}
        </div>
      </div>
    );
  }
);
HkiStat.displayName = "HkiStat";

// ═══════════════════════════════════════════════════════════════════════════
// HkiEmptyState
// ═══════════════════════════════════════════════════════════════════════════

export interface HkiEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const HkiEmptyState = React.forwardRef<HTMLDivElement, HkiEmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-3",
        className
      )}
      {...props}
    >
      {icon && <div className="text-muted-foreground/40 mb-1">{icon}</div>}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
);
HkiEmptyState.displayName = "HkiEmptyState";
