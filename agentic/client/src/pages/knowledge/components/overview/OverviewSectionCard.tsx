import { type ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { k } from "../../theme";

export type CardBadgeTone = "positive" | "warning" | "critical" | "neutral";

interface OverviewSectionCardProps {
  icon?: LucideIcon;
  title?: string;
  badge?: string;
  badgeTone?: CardBadgeTone;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  headerContent?: ReactNode;
}

const BADGE_CLS: Record<CardBadgeTone, string> = {
  positive: k.statusPositiveBadge,
  warning: k.statusWarningBadge,
  critical: k.statusCriticalBadge,
  neutral: k.statusNeutralBadge,
};

const OVERVIEW_CARD_SHELL = [
  "relative overflow-hidden flex flex-col",
  "border border-border/50 bg-card",
  "shadow-sm",
  "transition-[box-shadow,border-color,transform] duration-200",
  "hover:-translate-y-[1px] hover:border-primary/20 hover:shadow-md",
  "dark:border-border/30 dark:bg-card",
  "dark:shadow-[0_8px_16px_-12px_rgba(0,0,0,0.3)]",
  "dark:hover:border-primary/24 dark:hover:shadow-[0_12px_24px_-14px_rgba(0,0,0,0.36)]",
].join(" ");

export default function OverviewSectionCard({
  icon: Icon,
  title,
  badge,
  badgeTone = "neutral",
  actionLabel,
  onAction,
  children,
  className,
  headerClassName,
  bodyClassName,
  headerContent,
}: OverviewSectionCardProps) {
  return (
    <div className={cn(k.card, OVERVIEW_CARD_SHELL, className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-linear-to-b from-white/88 via-white/36 to-transparent dark:from-white/6 dark:via-transparent dark:to-transparent"
      />
      {(headerContent || (Icon && title)) && (
        <div
          className={cn(
            "relative border-b border-border/55 bg-white/44 dark:border-white/6 dark:bg-white/2",
            headerClassName
          )}
        >
          {headerContent ?? (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-sm",
                    k.duoToneFill
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                </div>
                <p className="text-sm font-semibold text-foreground truncate">
                  {title}
                </p>
              </div>
              {badge && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    BADGE_CLS[badgeTone]
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        className={cn(
          "relative p-3.5 flex flex-col gap-3 flex-1",
          bodyClassName
        )}
      >
        {children}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-auto inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/12 dark:border-primary/20 dark:bg-primary/10 dark:hover:bg-primary/14"
          >
            {actionLabel}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
