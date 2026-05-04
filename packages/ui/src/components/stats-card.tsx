"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils";

// --- StatsCard Variants ---
const statsCardVariants = cva("relative rounded-xl p-6 transition-all duration-200", {
  variants: {
    variant: {
      default: "bg-card border border-border/60 shadow-sm",
      ghost: "bg-transparent border-0",
      gradient:
        "bg-linear-to-br from-hki-blue-50 to-hki-blue-100 dark:from-hki-blue-950 dark:to-hki-blue-900 border border-hki-blue-200/50 dark:border-hki-blue-800/30",
      outline: "bg-transparent border border-border/60",
      filled: "bg-muted/50 border-0",
      accent: "surface-accent-top",
    },
    size: {
      default: "p-6",
      sm: "p-4",
      lg: "p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

// --- Icon Container Variants ---
const iconContainerVariants = cva("flex items-center justify-center rounded-lg", {
  variants: {
    color: {
      default: "bg-muted/60 text-muted-foreground",
      blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
      red: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
      green: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
      purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    size: {
      default: "h-12 w-12",
      sm: "h-10 w-10",
      lg: "h-14 w-14",
    },
  },
  defaultVariants: {
    color: "default",
    size: "default",
  },
});

// --- Trend Indicator ---
interface TrendProps {
  value: number;
  label?: string;
  showIcon?: boolean;
}

function Trend({ value, label, showIcon = true }: TrendProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        isPositive && "text-emerald-600 dark:text-emerald-400",
        value < 0 && "text-hki-red-600 dark:text-hki-red-400",
        isNeutral && "text-muted-foreground"
      )}
    >
      {showIcon && (
        <>
          {isPositive && <TrendingUp className="h-4 w-4" />}
          {value < 0 && <TrendingDown className="h-4 w-4" />}
          {isNeutral && <Minus className="h-4 w-4" />}
        </>
      )}
      <span>
        {isPositive && "+"}
        {value}%
      </span>
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </div>
  );
}

// --- StatsCard ---
interface StatsCardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statsCardVariants> {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  iconColor?: VariantProps<typeof iconContainerVariants>["color"];
  trend?: TrendProps;
  footer?: React.ReactNode;
  loading?: boolean;
}

function StatsCard({
  className,
  variant,
  size,
  title,
  value,
  description,
  icon: Icon,
  iconColor = "default",
  trend,
  footer,
  loading = false,
  ...props
}: StatsCardProps) {
  if (loading) {
    return (
      <div className={cn(statsCardVariants({ variant, size }), className)} {...props}>
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-12 w-12 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(statsCardVariants({ variant, size }), className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {trend && <Trend {...trend} />}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {Icon && (
          <div className={cn(iconContainerVariants({ color: iconColor, size }))}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      {footer && <div className="mt-4 pt-4 border-t border-border/60">{footer}</div>}
    </div>
  );
}

// --- StatsCardGrid ---
interface StatsCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

function StatsCardGrid({ className, columns = 4, children, ...props }: StatsCardGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Mini Stats Card ---
interface MiniStatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: VariantProps<typeof iconContainerVariants>["color"];
}

function MiniStatsCard({
  className,
  title,
  value,
  icon: Icon,
  iconColor = "default",
  ...props
}: MiniStatsCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl p-3",
        "bg-card",
        "border border-border/60",
        "shadow-sm",
        "hover:shadow-md hover:border-border transition-shadow",
        "transition-all duration-150",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className={cn(iconContainerVariants({ color: iconColor, size: "sm" }))}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export { StatsCard, StatsCardGrid, MiniStatsCard, Trend, statsCardVariants, iconContainerVariants };
