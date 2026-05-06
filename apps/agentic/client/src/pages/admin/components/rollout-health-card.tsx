import {
  AlertTriangle,
  CheckCircle2,
  Power,
  PowerOff,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FeatureFlagDependencyIssue,
  FeatureFlagKey,
} from "@shared/feature-flags";
import { getFeatureFlagDefinition } from "@shared/feature-flags";
import { a } from "../theme";
import { SOFT_BADGE_CLASS, SOFT_LABEL_CLASS, TONE_STYLES } from "../constants";
import { getIssueTone } from "../utils";
import { SectionPill, SettingsButton } from "./primitives";
import type { Tone } from "../types";

/** Derive actionable quick-fixes from a dependency issue. */
function getIssueFixes(issue: FeatureFlagDependencyIssue): Array<{
  label: string;
  featureKey: FeatureFlagKey;
  enable: boolean;
}> {
  if (issue.id.startsWith("missing-parent:")) {
    // featureKeys = [child, parent]
    const [childKey, parentKey] = issue.featureKeys;
    const parentDef = getFeatureFlagDefinition(parentKey);
    const childDef = getFeatureFlagDefinition(childKey);
    return [
      { label: `Enable ${parentDef.label}`, featureKey: parentKey, enable: true },
      { label: `Turn off ${childDef.label}`, featureKey: childKey, enable: false },
    ];
  }
  if (issue.id.startsWith("empty-surface:")) {
    // featureKeys = [parent, ...children]
    const [parentKey] = issue.featureKeys;
    const parentDef = getFeatureFlagDefinition(parentKey);
    return [
      { label: `Disable ${parentDef.label}`, featureKey: parentKey, enable: false },
    ];
  }
  return [];
}

function RolloutIssueCallout({
  issue,
  onFix,
  isPending,
}: {
  issue: FeatureFlagDependencyIssue;
  onFix?: (featureKey: FeatureFlagKey, enable: boolean) => void;
  isPending?: boolean;
}) {
  const tone = getIssueTone(issue.severity);
  const styles = TONE_STYLES[tone];
  const Icon = issue.severity === "critical" ? AlertTriangle : ShieldCheck;
  const fixes = onFix ? getIssueFixes(issue) : [];

  return (
    <div className={cn(a.inset, "rounded-2xl p-4")}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            styles.iconClass,
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {issue.title}
            </p>
            <Badge className={cn(styles.badgeClass, SOFT_BADGE_CLASS)}>
              {issue.severity === "critical" ? "Critical" : "Warning"}
            </Badge>
          </div>

          {fixes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fixes.map(fix => (
                <SettingsButton
                  key={fix.featureKey}
                  type="button"
                  variant={fix.enable ? "brand" : "outline"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => onFix?.(fix.featureKey, fix.enable)}
                  className="h-7 rounded-lg px-2.5 text-xs"
                >
                  {fix.enable ? (
                    <Power className="h-3 w-3" />
                  ) : (
                    <PowerOff className="h-3 w-3" />
                  )}
                  {fix.label}
                </SettingsButton>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {issue.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RolloutHealthCard({
  issues,
  onFix,
  isPending,
}: {
  issues: FeatureFlagDependencyIssue[];
  onFix?: (featureKey: FeatureFlagKey, enable: boolean) => void;
  isPending?: boolean;
}) {
  return (
    <Card className={cn(a.card, "overflow-hidden")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <p className={a.sectionEyebrow}>Rollout Health</p>
          <SectionPill
            label={issues.length > 0 ? `${issues.length} issues` : "Clean"}
            icon={issues.length > 0 ? AlertTriangle : CheckCircle2}
            className={issues.length > 0 ? a.pillWarning : a.pillPositive}
          />
        </div>
        <CardTitle className="pt-2 text-base font-semibold text-foreground">
          {issues.length === 0
            ? "All controls healthy"
            : `${issues.length} ${issues.length === 1 ? "issue" : "issues"} to resolve`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.length === 0 ? (
          <div className={cn(a.inset, "rounded-2xl p-4")}>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  a.iconPositive,
                  "flex h-8 w-8 items-center justify-center rounded-xl"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  No rollout issues
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  All enabled features have their dependencies satisfied.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.slice(0, 6).map(issue => (
              <RolloutIssueCallout
                key={issue.id}
                issue={issue}
                onFix={onFix}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
