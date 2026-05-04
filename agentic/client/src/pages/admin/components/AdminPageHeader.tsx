import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, HkiCard } from "@hki/ui";
import { a, type AdminTone } from "../theme";

type AdminPageHeaderStat = {
  label: string;
  value: string;
  tone?: AdminTone;
};

const STAT_TONE_CLASS: Record<AdminTone, string> = {
  primary: a.pillPrimary,
  positive: a.pillPositive,
  warning: a.pillWarning,
  critical: a.pillCritical,
  neutral: a.pillNeutral,
};

interface AdminPageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  eyebrow?: string;
  action?: ReactNode;
  stats?: AdminPageHeaderStat[];
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  eyebrow = "Enterprise Hub",
  action,
  stats = [],
  className,
}: AdminPageHeaderProps) {
  return (
    <HkiCard
      interactive={false}
      elevation="flat"
      size="md"
      className={cn(a.hero, "relative overflow-hidden rounded-2xl", className)}
    >
      <div className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className={a.sectionEyebrow}>{eyebrow}</p>

          <div className="mt-3 flex items-start gap-4">
            <div
              className={cn(
                a.iconPrimary,
                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-foreground/78">
                {title}
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-foreground/68 dark:text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>

        {action ? (
          <div className="shrink-0 self-start lg:pl-5">{action}</div>
        ) : null}
      </div>

      {stats.length > 0 && (
        <div className={cn(a.dataPanel, "border-t border-border/30 px-6 py-4")}>
          <div className="flex flex-wrap items-center gap-2">
            {stats.map(stat => (
              <div
                key={`${stat.label}:${stat.value}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
                  STAT_TONE_CLASS[stat.tone ?? "neutral"]
                )}
              >
                <span className="text-sm font-semibold tabular-nums text-foreground dark:text-foreground/78">
                  {stat.value}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </HkiCard>
  );
}
