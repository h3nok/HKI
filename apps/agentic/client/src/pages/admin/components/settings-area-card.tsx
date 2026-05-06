import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import { usesHKIAccentSurface } from "../utils";
import { SettingsButton } from "./primitives";
import type { Tone } from "../types";

export function SettingsAreaCard({
  title,
  description,
  icon: Icon,
  tone,
  stats,
  actionLabel,
  actionIcon,
  onAction,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone: Tone;
  stats: Array<{ label: string; value: string }>;
  actionLabel: string;
  actionIcon?: LucideIcon;
  onAction: () => void;
}) {
  const styles = TONE_STYLES[tone];
  const surfaceClass = usesHKIAccentSurface(tone) ? a.panelPrimary : a.card;
  const ActionIcon = actionIcon ?? ArrowRight;

  return (
    <div
      className={cn(
        surfaceClass,
        "flex h-full flex-col overflow-hidden rounded-2xl"
      )}
    >
      <div
        className={cn(a.cardHeader, "flex items-center gap-3 px-4 pt-4 pb-3")}
      >
        <div
          className={cn(
            styles.iconClass,
            a.metricIcon,
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
        <div className={cn(a.inset, "rounded-xl")}>
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-2",
                i < stats.length - 1 && "border-b border-border/40"
              )}
            >
              <span className={a.microText}>{stat.label}</span>
              <span className="text-[12px] font-semibold text-foreground tabular-nums">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        <SettingsButton
          type="button"
          onClick={onAction}
          variant={
            tone === "primary"
              ? "brand"
              : tone === "warning" || tone === "neutral"
                ? "outline"
                : "default"
          }
          size="sm"
          className={cn(
            "mt-auto w-full justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium"
          )}
        >
          <span className="inline-flex items-center gap-2">
            <ActionIcon className="h-3.5 w-3.5" />
            {actionLabel}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </SettingsButton>
      </div>
    </div>
  );
}
