import { useState } from "react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  FeatureFlagDependencyIssue,
  FeatureFlagKey,
} from "@shared/feature-flags";
import {
  getChildFeatureFlagKeys,
  getFeatureFlagDefinition,
  getRequiredParentFeatureFlagKey,
} from "@shared/feature-flags";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { a } from "../theme";
import {
  CATEGORY_META,
  FEATURE_ICONS,
  SOFT_BADGE_CLASS,
  TONE_STYLES,
} from "../constants";
import { formatAuditTimestamp, getIssueTone, getOverrideMode } from "../utils";
import { DisclosureAffordance, SourceBadge, StateBadge } from "./primitives";
import type { FeatureFlagListItem } from "../types";

function RolloutIssueCallout({ issue }: { issue: FeatureFlagDependencyIssue }) {
  const tone = getIssueTone(issue.severity);
  const styles = TONE_STYLES[tone];
  const Icon = issue.severity === "critical" ? AlertTriangle : ShieldCheck;

  return (
    <div className={cn(a.inset, "rounded-xl px-3 py-2.5")}>
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            styles.iconClass,
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-foreground">
              {issue.title}
            </p>
            <Badge
              className={cn(
                styles.badgeClass,
                SOFT_BADGE_CLASS,
                "px-2 py-0.5 text-[10px]"
              )}
            >
              {issue.severity === "critical" ? "Critical" : "Warning"}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {issue.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function OverrideModeControl({
  item,
  isPending,
  onToggle,
  onReset,
}: {
  item: FeatureFlagListItem;
  isPending: boolean;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => void;
  onReset: (featureKey: FeatureFlagKey) => void;
}) {
  const mode = getOverrideMode(item);
  const helperText =
    item.overrideEnabled == null
      ? `Platform default: ${item.defaultEnabled ? "On" : "Off"}`
      : `Org override: ${item.overrideEnabled ? "On" : "Off"}`;

  return (
    <div className={cn(a.inset, "rounded-xl p-3.5")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">State</p>
          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge enabled={item.effectiveEnabled} />
          {item.source === "admin_override" ? (
            <SourceBadge source={item.source} />
          ) : null}
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={value => {
          if (!value || isPending || !item.adminEditable) return;
          if (value === "default") {
            onReset(item.key);
            return;
          }
          onToggle(item.key, value === "enabled");
        }}
        className="mt-3 grid w-full grid-cols-3 gap-1 rounded-xl bg-muted/55 p-1 sm:max-w-md"
        aria-label={`Feature state for ${item.label}`}
      >
        <ToggleGroupItem
          value="default"
          disabled={isPending || !item.adminEditable}
          className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          Default
        </ToggleGroupItem>
        <ToggleGroupItem
          value="enabled"
          disabled={isPending || !item.adminEditable}
          className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
        >
          On
        </ToggleGroupItem>
        <ToggleGroupItem
          value="disabled"
          disabled={isPending || !item.adminEditable}
          className="h-9 rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          Off
        </ToggleGroupItem>
      </ToggleGroup>

      <p className="text-[11px] text-muted-foreground">
        {item.adminEditable
          ? "Use Default to inherit the platform posture."
          : "Locked by the platform."}
      </p>
    </div>
  );
}

export function FeatureRow({
  item,
  issues,
  pendingKey,
  onToggle,
  onReset,
}: {
  item: FeatureFlagListItem;
  issues: FeatureFlagDependencyIssue[];
  pendingKey: string | null;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => void;
  onReset: (featureKey: FeatureFlagKey) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isPending = pendingKey === item.key;
  const Icon = FEATURE_ICONS[item.key] ?? CATEGORY_META[item.category].icon;
  const parentKey = getRequiredParentFeatureFlagKey(item.key);
  const childKeys = getChildFeatureFlagKeys(item.key);

  return (
    <div className={cn(a.previewRow, "rounded-xl border border-border/50")}>
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        className="flex w-full cursor-pointer flex-col gap-3 px-3.5 py-3 text-left sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              a.iconNeutral,
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {item.label}
              </h3>
              {issues.length > 0 ? (
                <Badge className={cn(a.pillWarning, "px-2 py-0.5 text-[10px]")}>
                  {`${issues.length} issue${issues.length === 1 ? "" : "s"}`}
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-1 text-[12px] text-muted-foreground">
              {item.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:ml-4">
          <div className="flex items-center gap-2">
            <StateBadge enabled={item.effectiveEnabled} />
            {item.source === "admin_override" ? (
              <SourceBadge source={item.source} />
            ) : null}
          </div>
          <DisclosureAffordance
            isOpen={isOpen}
            openLabel="Details"
            closeLabel="Hide"
          />
        </div>
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-border/60 px-3.5 pb-3.5 pt-3">
          <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
            <p>Type: {item.category === "debug" ? "Debug" : "Release"}</p>
            <p>Min role: {item.minimumRole ?? "viewer"}</p>
            <p>Owner: {item.owner}</p>
            <p>Default: {item.defaultEnabled ? "On" : "Off"}</p>
            {parentKey ? (
              <p>Depends on: {getFeatureFlagDefinition(parentKey).label}</p>
            ) : null}
            {childKeys.length > 0 ? (
              <p>
                Controls {childKeys.length} sub-area
                {childKeys.length === 1 ? "" : "s"}
              </p>
            ) : null}
            {item.updatedAt ? (
              <p>Updated {formatAuditTimestamp(item.updatedAt)}</p>
            ) : null}
          </div>

          <OverrideModeControl
            item={item}
            isPending={isPending}
            onToggle={onToggle}
            onReset={onReset}
          />

          {issues.length > 0 ? (
            <div className="space-y-2">
              {issues.map(issue => (
                <RolloutIssueCallout key={issue.id} issue={issue} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
