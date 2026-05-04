import type { LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import type { Tone } from "../types";

export function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone: Tone;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        a.metricCard,
        "flex flex-col gap-2.5 rounded-xl p-3.5 h-full"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            styles.iconClass,
            a.metricIcon,
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className={cn(a.metricLabel)}>{label}</p>
      </div>
      <div>
        <p className="text-lg font-bold tracking-tight text-foreground tabular-nums leading-tight">
          {value}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground/70">
          {description}
        </p>
      </div>
    </div>
  );
}
