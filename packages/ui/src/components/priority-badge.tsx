/**
 * Priority Badge Component
 *
 * Displays initiative priority with consistent styling.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const priorityBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full text-xs font-semibold",
  {
    variants: {
      priority: {
        CRITICAL: "bg-red-100 text-red-700 border border-red-200",
        HIGH: "bg-orange-100 text-orange-700 border border-orange-200",
        MEDIUM: "bg-blue-100 text-blue-700 border border-blue-200",
        LOW: "bg-gray-100 text-gray-600 border border-gray-200",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      priority: "MEDIUM",
      size: "md",
    },
  }
);

const PRIORITY_DOT_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export interface PriorityBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof priorityBadgeVariants> {
  showDot?: boolean;
  customLabel?: string;
}

const PriorityBadge = React.forwardRef<HTMLSpanElement, PriorityBadgeProps>(
  ({ className, priority, size, showDot = true, customLabel, ...props }, ref) => {
    const priorityKey = priority || "MEDIUM";
    const label = customLabel || PRIORITY_LABELS[priorityKey] || priorityKey;

    return (
      <span
        ref={ref}
        className={cn(priorityBadgeVariants({ priority, size }), className)}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              PRIORITY_DOT_COLORS[priorityKey]
            )}
          />
        )}
        {label}
      </span>
    );
  }
);
PriorityBadge.displayName = "PriorityBadge";

export { PriorityBadge, priorityBadgeVariants, PRIORITY_LABELS, PRIORITY_DOT_COLORS };
