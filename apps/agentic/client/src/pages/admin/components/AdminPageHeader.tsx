import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, HkiCard } from "@hki/ui";
import { a, type AdminTone } from "../theme";
import { SectionPill } from "./primitives";

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
      className={cn(
        a.hero,
        "admin-page-header relative overflow-hidden rounded-xl",
        className
      )}
    >
      <div className="admin-page-header__main flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="admin-page-header__copy min-w-0 flex-1">
          <SectionPill
            label={eyebrow}
            icon={Icon}
            className={cn(
              a.pillNeutral,
              "admin-page-header__eyebrow rounded-full"
            )}
          />

          <div className="mt-3 flex items-start gap-4">
            <div
              className={cn(
                a.iconPrimary,
                "admin-page-header__icon mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1.5 max-w-3xl text-base leading-7 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>

        {action ? (
          <div className="admin-page-header__action shrink-0 self-start lg:pl-5">
            {action}
          </div>
        ) : null}
      </div>

      {stats.length > 0 && (
        <div className={cn(a.dataPanel, "admin-page-header__stats px-6 py-4")}>
          <div className="admin-page-header__stats-grid flex flex-wrap items-center gap-2">
            {stats.map(stat => (
              <div
                key={`${stat.label}:${stat.value}`}
                className={cn(
                  "admin-page-header__stat inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                  STAT_TONE_CLASS[stat.tone ?? "neutral"]
                )}
              >
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {stat.value}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
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
