/**
 * KPI Card Component
 *
 * Displays key performance indicators with consistent styling.
 * Supports trends, icons, and accent colors.
 */

import * as React from "react";
import { cn } from "../utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface KPICardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
  };
  icon?: React.ReactNode;
  accentColor?: string;
  iconBgColor?: string;
  iconColor?: string;
  loading?: boolean;
}

const KPICard = React.forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      className,
      title,
      value,
      subtitle,
      trend,
      icon,
      accentColor = "var(--primary)",
      iconBgColor = "#ebeffe",
      iconColor = "var(--primary)",
      loading = false,
      ...props
    },
    ref
  ) => {
    const getTrendIcon = () => {
      if (!trend) return null;
      if (trend.value > 0) return <TrendingUp className="w-3.5 h-3.5" />;
      if (trend.value < 0) return <TrendingDown className="w-3.5 h-3.5" />;
      return <Minus className="w-3.5 h-3.5" />;
    };

    const getTrendColor = () => {
      if (!trend) return "";
      if (trend.value > 0) return "text-green-600";
      if (trend.value < 0) return "text-red-600";
      return "text-gray-500";
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative bg-card rounded-xl border border-border shadow-sm overflow-hidden",
          "hover:shadow-md transition-shadow",
          className
        )}
        {...props}
      >
        {/* Accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: accentColor }}
        />

        <div className="p-5 pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </p>
              {loading ? (
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{value}</span>
                  {trend && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-sm font-semibold",
                        getTrendColor()
                      )}
                    >
                      {getTrendIcon()}
                      {Math.abs(trend.value)}%
                    </span>
                  )}
                </div>
              )}
              {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
            </div>

            {icon && (
              <div
                className="p-2 rounded-xl"
                style={{
                  backgroundColor: iconBgColor,
                  color: iconColor,
                }}
              >
                {icon}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
KPICard.displayName = "KPICard";

/**
 * KPI Card Grid - Responsive grid layout for KPI cards
 */
interface KPICardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4 | 6;
}

const KPICardGrid = React.forwardRef<HTMLDivElement, KPICardGridProps>(
  ({ className, columns = 3, children, ...props }, ref) => {
    const colClasses = {
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      6: "grid-cols-1 md:grid-cols-3 lg:grid-cols-6",
    };

    return (
      <div ref={ref} className={cn("grid gap-4", colClasses[columns], className)} {...props}>
        {children}
      </div>
    );
  }
);
KPICardGrid.displayName = "KPICardGrid";

export { KPICard, KPICardGrid };
