import type { FeatureFlagDependencyIssue } from "@shared/feature-flags";
import { FEATURE_SECTION_META, LEGACY_AUDIT_COPY } from "./constants";
import type {
  FeatureFlagAuditEvent,
  FeatureFlagListItem,
  FeatureSectionKey,
  OverrideMode,
  Tone,
} from "./types";

export function getFeatureSectionKey(
  item: FeatureFlagListItem
): FeatureSectionKey {
  if (item.category === "debug") return "debug";
  if (item.key.startsWith("release.chat.")) return "agentic";
  if (item.key.startsWith("release.knowledge.overview."))
    return "knowledgeTabs";
  if (item.key.startsWith("release.knowledge.tabs.")) return "knowledgeTabs";
  if (item.key.startsWith("release.knowledge.ingest.")) return "ingest";
  if (item.key.startsWith("release.knowledge.library.")) return "library";
  if (item.key.startsWith("release.knowledge.validate.")) return "validate";
  if (item.key.startsWith("release.knowledge.govern.")) return "govern";
  if (item.key.startsWith("release.knowledge.activity.")) return "activity";
  if (item.key.startsWith("release.connectors.")) return "connectors";
  return "other";
}

export function groupFeatureItemsBySection(items: FeatureFlagListItem[]) {
  const grouped = new Map<FeatureSectionKey, FeatureFlagListItem[]>();

  for (const item of items) {
    const sectionKey = getFeatureSectionKey(item);
    const existing = grouped.get(sectionKey) ?? [];
    existing.push(item);
    grouped.set(sectionKey, existing);
  }

  return Array.from(grouped.entries()).sort(([leftKey], [rightKey]) => {
    const sectionOrder = Object.keys(
      FEATURE_SECTION_META
    ) as FeatureSectionKey[];
    return sectionOrder.indexOf(leftKey) - sectionOrder.indexOf(rightKey);
  });
}

export function featureMatchesSearch(
  item: FeatureFlagListItem,
  searchValue: string
) {
  const query = searchValue.trim().toLowerCase();
  if (!query) return true;

  return [item.label, item.description, item.key, item.owner]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function getOverrideMode(item: FeatureFlagListItem): OverrideMode {
  if (item.overrideEnabled == null) return "default";
  return item.overrideEnabled ? "enabled" : "disabled";
}

export function getIssueTone(
  severity: FeatureFlagDependencyIssue["severity"]
): Tone {
  return severity === "critical" ? "critical" : "warning";
}

export function formatAuditTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getFeatureSectionId(sectionKey: FeatureSectionKey): string {
  return `feature-section-${sectionKey}`;
}

export function getAuditEventPresentation(event: FeatureFlagAuditEvent) {
  const legacy = LEGACY_AUDIT_COPY[event.targetId];
  if (!legacy) return event;

  return {
    ...event,
    title: legacy.title,
    description: legacy.description,
  };
}

export function usesHKIAccentSurface(tone: Tone) {
  return tone === "primary" || tone === "positive";
}
