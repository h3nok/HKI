import type { ReactNode } from "react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import type { SettingsTabNavItem } from "../types";

export function SettingsHero({
  activeTab,
  activePresetName,
  featureCount,
  adminOverrideCount,
  rolloutIssueCount,
  debugSessionLabel,
  guidance,
  actions,
}: {
  activeTab: SettingsTabNavItem;
  activePresetName: string;
  featureCount: number;
  adminOverrideCount: number;
  rolloutIssueCount: number;
  debugSessionLabel: string;
  guidance: string;
  actions?: ReactNode;
}) {
  const styles = TONE_STYLES[activeTab.tone];
  const Icon = activeTab.icon;
  const heroStats = [
    {
      label: "Rollout posture",
      value: activePresetName,
    },
    {
      label: rolloutIssueCount === 0 ? "Inventory health" : "Rollout issues",
      value: rolloutIssueCount === 0 ? "Clean" : String(rolloutIssueCount),
    },
    {
      label: "Manual overrides",
      value: String(adminOverrideCount),
    },
    {
      label: "Debug access",
      value: debugSessionLabel,
    },
  ];

  return (
    <div className={cn(a.hero, "w-full overflow-hidden rounded-2xl")}>
      <div className="px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              styles.iconClass,
              a.metricIcon,
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold leading-tight text-foreground">
                {activeTab.label}
              </h1>
              <Badge
                className={cn(
                  styles.badgeClass,
                  "px-2 py-0.5 text-[10px] font-medium"
                )}
              >
                {activeTab.badge}
              </Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground/80">
              {guidance}
            </p>
            {actions ? (
              <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          a.dataPanel,
          "border-t border-border/30 px-5 py-3 sm:px-6 print:hidden"
        )}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map(item => (
            <div
              key={item.label}
              className={cn(a.inset, "rounded-lg px-3 py-2.5")}
            >
              <p className={a.microText}>{item.label}</p>
              <p className="mt-1 text-[13px] font-semibold leading-tight text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
