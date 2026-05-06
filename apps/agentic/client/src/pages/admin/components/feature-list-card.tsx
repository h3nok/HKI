import { useEffect, useMemo, useState } from "react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  FeatureFlagDependencyIssue,
  FeatureFlagKey,
} from "@shared/feature-flags";
import { a } from "../theme";
import { FEATURE_SECTION_META } from "../constants";
import { getFeatureSectionId, groupFeatureItemsBySection } from "../utils";
import { DisclosureAffordance } from "./primitives";
import { FeatureRow } from "./feature-row";
import type { FeatureFlagListItem, FeatureSectionKey } from "../types";

function FeatureSectionCard({
  sectionId,
  sectionKey,
  items,
  featureIssueMap,
  pendingKey,
  onToggle,
  onReset,
  isOpen,
  onSectionToggle,
}: {
  sectionId: string;
  sectionKey: FeatureSectionKey;
  items: FeatureFlagListItem[];
  featureIssueMap: Map<FeatureFlagKey, FeatureFlagDependencyIssue[]>;
  pendingKey: string | null;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => void;
  onReset: (featureKey: FeatureFlagKey) => void;
  isOpen: boolean;
  onSectionToggle: () => void;
}) {
  const meta = FEATURE_SECTION_META[sectionKey];
  const enabledCount = items.filter(item => item.effectiveEnabled).length;
  const sectionIssueCount = useMemo(() => {
    const issueIds = new Set<string>();

    for (const item of items) {
      for (const issue of featureIssueMap.get(item.key) ?? []) {
        issueIds.add(issue.id);
      }
    }

    return issueIds.size;
  }, [featureIssueMap, items]);
  const Icon = meta.icon;

  return (
    <div
      id={sectionId}
      className={cn(a.card, "scroll-mt-28 overflow-hidden rounded-2xl")}
    >
      <button
        type="button"
        onClick={onSectionToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              a.iconPrimary,
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {meta.title}
              </h3>
              <span className="text-[11px] text-muted-foreground/72">
                {enabledCount}/{items.length} on
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground/78">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {sectionIssueCount > 0 ? (
            <Badge className={cn(a.pillWarning, "px-2 py-0.5 text-[10px]")}>
              {`${sectionIssueCount} issue${sectionIssueCount === 1 ? "" : "s"}`}
            </Badge>
          ) : null}
          <DisclosureAffordance
            isOpen={isOpen}
            openLabel="Open"
            closeLabel="Close"
          />
        </div>
      </button>

      {isOpen ? (
        <div className="space-y-2 border-t border-border/60 px-4 pb-4 pt-3">
          {items.map(item => (
            <FeatureRow
              key={item.key}
              item={item}
              issues={featureIssueMap.get(item.key) ?? []}
              pendingKey={pendingKey}
              onToggle={onToggle}
              onReset={onReset}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FeatureListCard({
  title,
  description,
  items,
  featureIssueMap,
  pendingKey,
  onToggle,
  onReset,
  emptyTitle,
}: {
  title: string;
  description?: string;
  items: FeatureFlagListItem[];
  featureIssueMap: Map<FeatureFlagKey, FeatureFlagDependencyIssue[]>;
  pendingKey: string | null;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => void;
  onReset: (featureKey: FeatureFlagKey) => void;
  emptyTitle: string;
}) {
  const groupedItems = useMemo(
    () => groupFeatureItemsBySection(items),
    [items]
  );
  const enabledCount = useMemo(
    () => items.filter(item => item.effectiveEnabled).length,
    [items]
  );
  const overrideCount = useMemo(
    () => items.filter(item => item.source === "admin_override").length,
    [items]
  );
  const sectionIssueCounts = useMemo(
    () =>
      new Map(
        groupedItems.map(([sectionKey, sectionItems]) => {
          const issueIds = new Set<string>();
          for (const item of sectionItems) {
            for (const issue of featureIssueMap.get(item.key) ?? []) {
              issueIds.add(issue.id);
            }
          }
          return [sectionKey, issueIds.size] as const;
        })
      ),
    [featureIssueMap, groupedItems]
  );
  const [openSectionKey, setOpenSectionKey] = useState<FeatureSectionKey | null>(
    null
  );

  useEffect(() => {
    if (
      openSectionKey &&
      !groupedItems.some(([sectionKey]) => sectionKey === openSectionKey)
    ) {
      setOpenSectionKey(null);
    }
  }, [groupedItems, openSectionKey, sectionIssueCounts]);

  return (
    <Card className={cn(a.card, "overflow-hidden")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription className="mt-1 text-[12px] text-muted-foreground/80">
                {description}
              </CardDescription>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground/72">
            {groupedItems.length} sections · {enabledCount}/{items.length} on · {overrideCount} overrides
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div
            className={cn(
              a.inset,
              "rounded-2xl border-dashed p-8 text-sm text-muted-foreground"
            )}
          >
            {emptyTitle}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedItems.map(([sectionKey, sectionItems]) => (
              <FeatureSectionCard
                key={sectionKey}
                sectionId={getFeatureSectionId(sectionKey)}
                sectionKey={sectionKey}
                items={sectionItems}
                featureIssueMap={featureIssueMap}
                pendingKey={pendingKey}
                onToggle={onToggle}
                onReset={onReset}
                isOpen={openSectionKey === sectionKey}
                onSectionToggle={() =>
                  setOpenSectionKey(current =>
                    current === sectionKey ? null : sectionKey
                  )
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
