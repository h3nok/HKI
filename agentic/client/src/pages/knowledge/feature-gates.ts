import type { FeatureFlagKey } from "@shared/feature-flags";
import type {
  ActivitySection,
  GovernSection,
  KnowledgeTab,
  LibraryView,
  ValidateSection,
} from "./types";

type FeatureGatePredicate = (key: FeatureFlagKey) => boolean;

export const KNOWLEDGE_TAB_FEATURE_KEYS: Record<KnowledgeTab, FeatureFlagKey> =
  {
    overview: "release.knowledge.tabs.overview",
    ingest: "release.knowledge.tabs.ingest",
    library: "release.knowledge.tabs.library",
    validate: "release.knowledge.tabs.validate",
    govern: "release.knowledge.tabs.govern",
    pipelines: "release.knowledge.tabs.pipelines",
    activity: "release.knowledge.tabs.activity",
  };

export const LIBRARY_VIEW_FEATURE_KEYS: Record<LibraryView, FeatureFlagKey> = {
  documents: "release.knowledge.library.documents",
  collections: "release.knowledge.library.collections",
  taxonomy: "release.knowledge.library.taxonomy",
  graph: "release.knowledge.library.graph",
};

export const VALIDATE_SECTION_FEATURE_KEYS: Record<
  ValidateSection,
  FeatureFlagKey
> = {
  test: "release.knowledge.validate.testSandbox",
  eval: "release.knowledge.validate.evalSuite",
  quality: "release.knowledge.validate.quality",
  gaps: "release.knowledge.validate.gaps",
};

export const GOVERN_SECTION_FEATURE_KEYS: Record<
  GovernSection,
  FeatureFlagKey
> = {
  review: "release.knowledge.govern.reviewQueue",
  team: "release.knowledge.govern.usersAccess",
  compliance: "release.knowledge.govern.compliance",
};

export const ACTIVITY_SECTION_FEATURE_KEYS: Record<
  ActivitySection,
  FeatureFlagKey
> = {
  pipeline: "release.knowledge.activity.pipelineJobs",
  alerts: "release.knowledge.activity.alertHistory",
};

function filterByFeature<T extends string>(
  items: readonly T[],
  featureMap: Record<T, FeatureFlagKey>,
  isEnabled: FeatureGatePredicate
): T[] {
  return items.filter(item => isEnabled(featureMap[item]));
}

export function getAvailableLibraryViews(options: {
  canManageKnowledge: boolean;
  isEnabled: FeatureGatePredicate;
}): LibraryView[] {
  const candidateViews: readonly LibraryView[] = options.canManageKnowledge
    ? ["documents", "collections", "taxonomy", "graph"]
    : ["documents"];

  return filterByFeature(
    candidateViews,
    LIBRARY_VIEW_FEATURE_KEYS,
    options.isEnabled
  );
}

export function getAvailableValidateSections(
  isEnabled: FeatureGatePredicate
): ValidateSection[] {
  return filterByFeature(
    ["test", "eval", "quality", "gaps"],
    VALIDATE_SECTION_FEATURE_KEYS,
    isEnabled
  );
}

export function getAvailableGovernSections(
  isEnabled: FeatureGatePredicate
): GovernSection[] {
  return filterByFeature(
    ["review", "team", "compliance"],
    GOVERN_SECTION_FEATURE_KEYS,
    isEnabled
  );
}

export function getAvailableActivitySections(
  isEnabled: FeatureGatePredicate
): ActivitySection[] {
  return filterByFeature(
    ["pipeline", "alerts"],
    ACTIVITY_SECTION_FEATURE_KEYS,
    isEnabled
  );
}

export function getAvailableKnowledgeTabs(options: {
  allowedTabs: KnowledgeTab[];
  canManageKnowledge: boolean;
  isEnabled: FeatureGatePredicate;
}): KnowledgeTab[] {
  return options.allowedTabs.filter(tab => {
    if (!options.isEnabled(KNOWLEDGE_TAB_FEATURE_KEYS[tab])) {
      return false;
    }

    if (tab === "library") {
      return (
        getAvailableLibraryViews({
          canManageKnowledge: options.canManageKnowledge,
          isEnabled: options.isEnabled,
        }).length > 0
      );
    }

    if (tab === "validate") {
      return getAvailableValidateSections(options.isEnabled).length > 0;
    }

    if (tab === "govern") {
      return getAvailableGovernSections(options.isEnabled).length > 0;
    }

    if (tab === "activity") {
      return getAvailableActivitySections(options.isEnabled).length > 0;
    }

    return true;
  });
}

export function getFirstAvailableKnowledgeTab(options: {
  allowedTabs: KnowledgeTab[];
  canManageKnowledge: boolean;
  isEnabled: FeatureGatePredicate;
}): KnowledgeTab | null {
  return getAvailableKnowledgeTabs(options)[0] ?? null;
}
