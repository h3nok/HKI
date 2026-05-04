import * as React from "react";
import { cn } from "../../utils";

const VARIANT_CLASSES = {
  emerald: "bg-[#ecfdf5] dark:bg-[#064e3b]/20 text-[#065f46] dark:text-[#6ee7b7]",
  blue: "bg-[#eff6ff] dark:bg-[#1e3a5f]/20 text-[#1e40af] dark:text-[#93c5fd]",
  violet: "bg-[#f5f3ff] dark:bg-[#4c1d95]/20 text-[#5b21b6] dark:text-[#c4b5fd]",
  amber: "bg-[#fffbeb] dark:bg-[#78350f]/20 text-[#92400e] dark:text-[#fcd34d]",
  red: "bg-[#fef2f2] dark:bg-[#7f1d1d]/20 text-[#991b1b] dark:text-[#fca5a5]",
  slate: "bg-[#f3f2ef] dark:bg-[#1e1e1e] text-[#525150] dark:text-[#a3a29f]",
} as const;

export type StatusBadgeVariant = keyof typeof VARIANT_CLASSES;

export interface StatusBadgeProps {
  /** Badge label text */
  label: string;
  /** Color variant */
  variant?: StatusBadgeVariant;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Compact status badge with icon, label, and color variant.
 * Used for MVP / Live / Planned indicators and similar.
 *
 * @example
 * <StatusBadge label="MVP" variant="emerald" icon={<Sparkles className="w-3 h-3" />} />
 * <StatusBadge label="Live" variant="blue" icon={<CheckCircle2 className="w-3 h-3" />} />
 */
export function StatusBadge({
  label,
  variant = "slate",
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide rounded-md",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}
