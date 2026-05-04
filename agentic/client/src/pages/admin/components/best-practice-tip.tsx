import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import { usesHKIAccentSurface } from "../utils";
import type { Tone } from "../types";

export function BestPracticeTip({
  title,
  points,
  icon: Icon,
  tone,
  actions,
  defaultOpen = false,
}: {
  title: string;
  points: string[];
  icon: LucideIcon;
  tone: Tone;
  actions?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const styles = TONE_STYLES[tone];
  const surfaceClass = usesHKIAccentSurface(tone) ? a.panelPrimary : a.card;

  return (
    <div className={cn(surfaceClass, "overflow-hidden rounded-2xl")}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-expanded={isOpen}
      >
        <div
          className={cn(
            styles.iconClass,
            a.metricIcon,
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="flex-1 text-[13px] font-semibold text-foreground">
          {title}
        </p>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
          <div className={cn(a.inset, "space-y-2 rounded-xl p-3")}>
            {points.map((point, index) => (
              <div key={point} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    styles.badgeClass,
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold"
                  )}
                >
                  {index + 1}
                </span>
                <p className="text-xs leading-5 text-muted-foreground">
                  {point}
                </p>
              </div>
            ))}
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
