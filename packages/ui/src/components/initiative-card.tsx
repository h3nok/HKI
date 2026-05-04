/**
 * Initiative Card Component
 *
 * Compact card for displaying initiative summary in lists and grids.
 */

import * as React from "react";
import { cn } from "../utils";
import { Calendar, DollarSign, User, ChevronRight, ArrowUpRight } from "lucide-react";

export interface InitiativeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  stage: React.ReactNode;
  priority?: React.ReactNode;
  sponsor?: string;
  estimatedCost?: number;
  estimatedSavings?: number;
  updatedAt?: string | Date;
  onClick?: () => void;
  showArrow?: boolean;
  variant?: "default" | "compact" | "detailed";
}

const InitiativeCard = React.forwardRef<HTMLDivElement, InitiativeCardProps>(
  (
    {
      className,
      title,
      description,
      stage,
      priority,
      sponsor,
      estimatedCost,
      estimatedSavings,
      updatedAt,
      onClick,
      showArrow = true,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const formatCurrency = (value: number) => {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value}`;
    };

    const formatDate = (date: string | Date) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };

    if (variant === "compact") {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center justify-between p-3 bg-card rounded-lg border border-border",
            "hover:bg-muted hover:border-border transition-all",
            onClick && "cursor-pointer",
            className
          )}
          onClick={onClick}
          {...props}
        >
          <div className="flex items-center gap-3 min-w-0">
            {stage}
            <span className="font-medium text-foreground truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {priority}
            {showArrow && onClick && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-card rounded-xl border border-border shadow-sm overflow-hidden",
          "hover:shadow-md hover:border-border transition-all",
          onClick && "cursor-pointer group",
          className
        )}
        onClick={onClick}
        {...props}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {stage}
              {priority}
            </div>
            {showArrow && onClick && (
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-[#0066B2] transition-colors">
            {title}
          </h3>

          {/* Description */}
          {description && variant === "detailed" && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{description}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
            {sponsor && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span className="truncate max-w-[100px]">{sponsor}</span>
              </div>
            )}
            {estimatedSavings !== undefined && (
              <div className="flex items-center gap-1 text-green-600">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{formatCurrency(estimatedSavings)}</span>
              </div>
            )}
            {updatedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial summary bar (for detailed variant) */}
        {variant === "detailed" &&
          estimatedCost !== undefined &&
          estimatedSavings !== undefined && (
            <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  Cost:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(estimatedCost)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Savings:{" "}
                  <span className="font-medium text-green-600">
                    {formatCurrency(estimatedSavings)}
                  </span>
                </span>
              </div>
              {estimatedSavings > estimatedCost && (
                <span className="text-green-600 font-medium">
                  +{formatCurrency(estimatedSavings - estimatedCost)} net
                </span>
              )}
            </div>
          )}
      </div>
    );
  }
);
InitiativeCard.displayName = "InitiativeCard";

/**
 * Initiative Card Grid - Responsive grid layout
 */
interface InitiativeCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3;
}

const InitiativeCardGrid = React.forwardRef<HTMLDivElement, InitiativeCardGridProps>(
  ({ className, columns = 2, children, ...props }, ref) => {
    const colClasses = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    };

    return (
      <div ref={ref} className={cn("grid gap-4", colClasses[columns], className)} {...props}>
        {children}
      </div>
    );
  }
);
InitiativeCardGrid.displayName = "InitiativeCardGrid";

export { InitiativeCard, InitiativeCardGrid };
