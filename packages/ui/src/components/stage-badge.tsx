/**
 * Stage Badge Component
 *
 * Displays initiative stage with consistent styling across the platform.
 * Uses the innovation stage progression: Ideate → Prove → Pilot → Scale → Impact
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const stageBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      stage: {
        INTAKE: "bg-gray-100 text-gray-700 border border-gray-200",
        TRIAGE: "bg-primary/10 text-primary border border-primary/25",
        EXPLORE: "bg-primary/10 text-primary border border-primary/25",
        PILOT: "bg-primary/10 text-primary border border-primary/25",
        SCALE: "bg-primary/10 text-primary border border-primary/25",
        OPERATE: "bg-primary/10 text-primary border border-primary/25",
        RETIRE: "bg-gray-100 text-gray-500 border border-gray-200",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      stage: "INTAKE",
      size: "md",
    },
  }
);

const STAGE_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  TRIAGE: "Triage",
  EXPLORE: "Explore",
  PILOT: "Pilot",
  SCALE: "Scale",
  OPERATE: "Operate",
  RETIRE: "Retire",
};

const STAGE_ICONS: Record<string, string> = {
  INTAKE: "📥",
  TRIAGE: "🔍",
  EXPLORE: "💡",
  PILOT: "🧪",
  SCALE: "📈",
  OPERATE: "✅",
  RETIRE: "📦",
};

export interface StageBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof stageBadgeVariants> {
  showIcon?: boolean;
  customLabel?: string;
}

const StageBadge = React.forwardRef<HTMLSpanElement, StageBadgeProps>(
  ({ className, stage, size, showIcon = false, customLabel, ...props }, ref) => {
    const stageKey = stage || "INTAKE";
    const label = customLabel || STAGE_LABELS[stageKey] || stageKey;

    return (
      <span
        ref={ref}
        className={cn(stageBadgeVariants({ stage, size }), className)}
        {...props}
      >
        {showIcon && <span>{STAGE_ICONS[stageKey]}</span>}
        {label}
      </span>
    );
  }
);
StageBadge.displayName = "StageBadge";

export { StageBadge, stageBadgeVariants, STAGE_LABELS, STAGE_ICONS };
