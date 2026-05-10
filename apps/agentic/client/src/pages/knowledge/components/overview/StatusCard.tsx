/**
 * StatusCard — minimal overview card primitive.
 *
 * Design: one large primary number + short label, a single status dot,
 * optional secondary text, optional thin bar, one action link.
 * No rings. No donuts. No grids of sub-metrics.
 * Total card height target: ~190–220px.
 */
import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { k } from "../../theme";
import OverviewSectionCard from "./OverviewSectionCard";

export type CardStatus = "ok" | "warn" | "error" | "neutral";

const DOT: Record<CardStatus, string> = {
  ok: k.statusPositiveDot,
  warn: `${k.statusWarningDot} animate-pulse`,
  error: `${k.statusCriticalDot} animate-pulse`,
  neutral: k.statusNeutralDot,
};

const NUM: Record<CardStatus, string> = {
  ok: "text-foreground",
  warn: "text-foreground",
  error: k.statusCriticalText,
  neutral: k.statusNeutralText,
};

interface StatusCardProps {
  icon: LucideIcon;
  title: string;
  status: CardStatus;
  /** The big number or short value shown prominently. */
  primaryValue: string | number;
  /** One-line description under the number. */
  primaryLabel: string;
  /** Optional second-line of stats, separated by  ·  */
  secondaryText?: string;
  /** Optional inline content below secondary text (thin bars, service dots, etc.) */
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function StatusCard({
  icon: Icon,
  title,
  status,
  primaryValue,
  primaryLabel,
  secondaryText,
  children,
  actionLabel,
  onAction,
  className,
}: StatusCardProps) {
  return (
    <OverviewSectionCard
      className={className}
      bodyClassName="p-4"
      actionLabel={actionLabel}
      onAction={onAction}
      headerContent={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/12 bg-primary/8 text-primary/80 shadow-[0_10px_20px_-16px_rgba(14,124,123,0.3)] dark:border-white/8 dark:bg-white/4 dark:text-primary dark:shadow-none">
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80 truncate">
              {title}
            </span>
          </div>
          <div className={cn("w-2 h-2 rounded-full shrink-0", DOT[status])} />
        </div>
      }
    >
      <div className="-mt-0.5">
        <p
          className={cn(
            "text-4xl font-black tabular-nums leading-none tracking-tight",
            NUM[status]
          )}
        >
          {primaryValue}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-none">
          {primaryLabel}
        </p>
      </div>

      {secondaryText && (
        <p className="text-[11px] text-muted-foreground/72 leading-relaxed -mt-1">
          {secondaryText}
        </p>
      )}

      {children && <div className="-mt-0.5">{children}</div>}
    </OverviewSectionCard>
  );
}
