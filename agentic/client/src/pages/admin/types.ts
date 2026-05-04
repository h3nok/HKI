import type {
  EvaluatedFeatureFlag,
  FeatureFlagKey,
  FeatureFlagPresetKey,
  FeatureFlagSnapshot,
} from "@shared/feature-flags";
import type { LucideIcon } from "lucide-react";

export type FeatureFlagListItem = EvaluatedFeatureFlag & {
  updatedAt: string | null;
  updatedBy: number | null;
};

export type FeatureFlagAuditEvent = {
  id: number;
  kind:
    | "preset-apply"
    | "preset-update"
    | "preset-create"
    | "preset-delete"
    | "override"
    | "reset";
  title: string;
  description: string;
  actorEmail: string;
  targetId: string;
  createdAt: string;
};

export type AdminUserSnapshot = {
  id: number;
  role: string;
  isActive: boolean;
};

export type FeatureFlagPresetItem = {
  id: string;
  sourceTemplateKey: FeatureFlagPresetKey | null;
  name: string;
  description: string;
  overrides: FeatureFlagSnapshot;
  updatedAt: string;
  updatedBy: number | null;
};

export type FeatureTab = "overview" | "access" | "release" | "debug" | "all";
export type OverrideMode = "default" | "enabled" | "disabled";
export type Tone = "primary" | "positive" | "warning" | "critical" | "neutral";
export type FeatureSectionKey =
  | "agentic"
  | "knowledgeTabs"
  | "ingest"
  | "library"
  | "validate"
  | "govern"
  | "activity"
  | "connectors"
  | "debug"
  | "other";

export type SettingsTabNavItem = {
  key: FeatureTab;
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  tone: Tone;
};
