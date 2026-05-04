import * as React from "react";
import { cn } from "../../utils";

const COLOR_VARIANTS = {
  emerald:
    "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  blue:
    "bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/20 text-blue-700 dark:text-blue-400",
  violet:
    "bg-violet-50 dark:bg-violet-500/10 border-violet-200/60 dark:border-violet-500/20 text-violet-700 dark:text-violet-400",
  amber:
    "bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
  red:
    "bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/20 text-red-700 dark:text-red-400",
  slate:
    "bg-[#f5f4f1] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-[#525150] dark:text-[#8B949E]",
  default:
    "bg-white dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-[#1a1a19] dark:text-[#E6EDF3]",
} as const;

export type StatPillColor = keyof typeof COLOR_VARIANTS;

export interface StatPillProps {
  /** Numeric value to display prominently */
  value: number | string;
  /** Label text beside the value */
  label: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Color variant */
  color?: StatPillColor;
  /** Additional class names */
  className?: string;
}

/**
 * Compact stat indicator — value + label in a rounded pill.
 *
 * @example
 * <StatPill value={27} label="Total" />
 * <StatPill value={12} label="MVP" icon={<Sparkles />} color="emerald" />
 */
export function StatPill({
  value,
  label,
  icon,
  color = "default",
  className,
}: StatPillProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm",
        COLOR_VARIANTS[color],
        className
      )}
    >
      {icon && <span className="opacity-70 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
      <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
      <span className="font-medium opacity-60">{label}</span>
    </div>
  );
}
