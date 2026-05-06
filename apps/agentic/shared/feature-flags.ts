import type { Role } from "./access-control";

export type FeatureEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production";

export type FeatureFlagCategory =
  | "release"
  | "debug"
  | "experiment"
  | "kill-switch";

export type FeatureFlagKey =
  | "release.chat.promptGenerator"
  | "release.chat.attachments"
  | "release.chat.voice"
  | "release.chat.rerun"
  | "release.chat.clearAllTasks"
  | "release.knowledge.tabs.overview"
  | "release.knowledge.overview.contentReadiness"
  | "release.knowledge.overview.answerTrust"
  | "release.knowledge.overview.reviewQueue"
  | "release.knowledge.overview.connectedSources"
  | "release.knowledge.overview.complianceSafety"
  | "release.knowledge.overview.contentCurrency"
  | "release.knowledge.overview.telemetry"
  | "release.knowledge.tabs.ingest"
  | "release.knowledge.tabs.library"
  | "release.knowledge.tabs.validate"
  | "release.knowledge.tabs.govern"
  | "release.knowledge.tabs.pipelines"
  | "release.knowledge.tabs.activity"
  | "release.knowledge.ingest.fileUpload"
  | "release.knowledge.ingest.textPaste"
  | "release.knowledge.ingest.urlCrawl"
  | "release.knowledge.ingest.connectors"
  | "release.knowledge.ingest.accessControls"
  | "release.knowledge.ingest.tags"
  | "release.knowledge.library.documents"
  | "release.knowledge.library.collections"
  | "release.knowledge.library.taxonomy"
  | "release.knowledge.library.graph"
  | "release.knowledge.library.filters"
  | "release.knowledge.library.gapAnalysis"
  | "release.knowledge.validate.testSandbox"
  | "release.knowledge.validate.evalSuite"
  | "release.knowledge.validate.quality"
  | "release.knowledge.validate.gaps"
  | "release.knowledge.validate.compare"
  | "release.knowledge.validate.contextShaping"
  | "release.knowledge.govern.reviewQueue"
  | "release.knowledge.govern.usersAccess"
  | "release.knowledge.govern.compliance"
  | "release.knowledge.govern.reviewAssignments"
  | "release.knowledge.activity.pipelineJobs"
  | "release.knowledge.activity.alertHistory"
  | "release.connectors.googleDrive"
  | "debug.chat.activityPanel"
  | "debug.chat.tracePayloads";

export type FeatureFlagPresetKey = "mvp.first" | "mvp.curated" | "beta.full";

export type FeatureFlagDefinition = {
  key: FeatureFlagKey;
  category: FeatureFlagCategory;
  label: string;
  description: string;
  defaultEnabled: boolean;
  minimumRole?: Role;
  adminEditable: boolean;
  clientVisible: boolean;
  environments: readonly FeatureEnvironment[];
  owner: string;
};

export type FeatureFlagSnapshot = Record<FeatureFlagKey, boolean>;

export type EvaluatedFeatureFlag = FeatureFlagDefinition & {
  effectiveEnabled: boolean;
  overrideEnabled: boolean | null;
  source: "default" | "admin_override";
};

export type FeatureFlagPresetDefinition = {
  key: FeatureFlagPresetKey;
  label: string;
  description: string;
  owner: string;
  overrides: Partial<Record<FeatureFlagKey, boolean>>;
};

export type FeatureFlagDependencyIssueSeverity = "warning" | "critical";

export type FeatureFlagDependencyIssue = {
  id: string;
  severity: FeatureFlagDependencyIssueSeverity;
  featureKeys: FeatureFlagKey[];
  title: string;
  description: string;
};

export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
  {
    key: "release.chat.promptGenerator",
    category: "release",
    label: "Chat prompt generator",
    description:
      "Controls the automatic stream-specific prompt generation in Agent Chat.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-chat",
  },
  {
    key: "release.chat.attachments",
    category: "release",
    label: "Chat file attachments",
    description:
      "Controls whether file attachments are available in the Agent Chat input.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-chat",
  },
  {
    key: "release.chat.voice",
    category: "release",
    label: "Chat voice input",
    description:
      "Controls whether voice recording is available in the Agent Chat input.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-chat",
  },
  {
    key: "release.chat.rerun",
    category: "release",
    label: "Chat rerun action",
    description:
      "Controls whether the rerun action appears on user messages in Agent Chat.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-chat",
  },
  {
    key: "release.chat.clearAllTasks",
    category: "debug",
    label: "Chat clear all tasks (debug)",
    description:
      "Controls whether admins with an active debug session can use the destructive clear-all-tasks action in Agent Chat.",
    defaultEnabled: false,
    minimumRole: "admin",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-chat",
  },
  {
    key: "release.knowledge.tabs.overview",
    category: "release",
    label: "KB Overview tab",
    description:
      "Controls whether the Knowledge Overview tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.contentReadiness",
    category: "release",
    label: "KB Overview content readiness",
    description:
      "Controls whether the content readiness card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.answerTrust",
    category: "release",
    label: "KB Overview answer trust",
    description:
      "Controls whether the answer trust card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.reviewQueue",
    category: "release",
    label: "KB Overview review queue",
    description:
      "Controls whether the review queue card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.connectedSources",
    category: "release",
    label: "KB Overview connected sources",
    description:
      "Controls whether the connected sources card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.complianceSafety",
    category: "release",
    label: "KB Overview compliance and safety",
    description:
      "Controls whether the compliance and safety card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.contentCurrency",
    category: "release",
    label: "KB Overview content currency",
    description:
      "Controls whether the content currency card appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.overview.telemetry",
    category: "release",
    label: "KB Overview telemetry deck",
    description:
      "Controls whether the telemetry deck appears in the Knowledge Overview tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.ingest",
    category: "release",
    label: "KB Add Knowledge tab",
    description:
      "Controls whether the Knowledge Add Knowledge tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "operator",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.library",
    category: "release",
    label: "KB Library tab",
    description:
      "Controls whether the Knowledge Library tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.validate",
    category: "release",
    label: "KB Validate tab",
    description:
      "Controls whether the Knowledge Validate tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "operator",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.govern",
    category: "release",
    label: "KB Govern tab",
    description:
      "Controls whether the Knowledge Govern tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.pipelines",
    category: "release",
    label: "KB Processing Status tab",
    description:
      "Controls whether the Knowledge Processing Status tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.tabs.activity",
    category: "release",
    label: "KB Activity tab",
    description:
      "Controls whether the Knowledge Activity tab is visible in the workspace.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.fileUpload",
    category: "release",
    label: "Knowledge file upload",
    description:
      "Controls whether file upload is available in the Knowledge ingest flow.",
    defaultEnabled: true,
    minimumRole: "operator",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.textPaste",
    category: "release",
    label: "Knowledge text paste",
    description:
      "Controls whether pasted text can be reviewed and ingested in Knowledge.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.urlCrawl",
    category: "release",
    label: "Knowledge URL crawl",
    description:
      "Controls whether web links can be crawled and ingested in Knowledge.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.connectors",
    category: "release",
    label: "Knowledge connectors",
    description:
      "Controls whether automated source connectors are available in Knowledge ingest.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.accessControls",
    category: "release",
    label: "Knowledge intake access controls",
    description:
      "Controls whether document-level access controls are shown in the Knowledge ingest flow.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.ingest.tags",
    category: "release",
    label: "Knowledge intake tags",
    description:
      "Controls whether tag entry and suggested tags appear in the Knowledge ingest flow.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.documents",
    category: "release",
    label: "KB Library documents view",
    description:
      "Controls whether the documents view is available inside the Knowledge Library tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.collections",
    category: "release",
    label: "KB Library collections view",
    description:
      "Controls whether the collections view is available inside the Knowledge Library tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.taxonomy",
    category: "release",
    label: "KB Library taxonomy view",
    description:
      "Controls whether the taxonomy view is available inside the Knowledge Library tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.graph",
    category: "release",
    label: "KB Library graph view",
    description:
      "Controls whether the graph view is available inside the Knowledge Library tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.filters",
    category: "release",
    label: "KB Library document filters",
    description:
      "Controls whether search and filter controls appear in the Knowledge Library documents view.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.library.gapAnalysis",
    category: "release",
    label: "KB Library gap analysis prompt",
    description:
      "Controls whether the gap analysis recommendation banner appears in the Knowledge Library documents view.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.testSandbox",
    category: "release",
    label: "KB Validate test sandbox",
    description:
      "Controls whether the test sandbox section is available inside the Knowledge Validate tab.",
    defaultEnabled: true,
    minimumRole: "operator",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.evalSuite",
    category: "release",
    label: "KB Validate eval suite",
    description:
      "Controls whether the eval suite section is available inside the Knowledge Validate tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.quality",
    category: "release",
    label: "KB Validate quality view",
    description:
      "Controls whether the quality section is available inside the Knowledge Validate tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.gaps",
    category: "release",
    label: "KB Validate gap analysis",
    description:
      "Controls whether the gap analysis section is available inside the Knowledge Validate tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.compare",
    category: "release",
    label: "KB Validate compare action",
    description:
      "Controls whether the published-vs-pending compare action appears in the Knowledge test sandbox.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.validate.contextShaping",
    category: "release",
    label: "KB Validate context shaping",
    description:
      "Controls whether the context-shaping toggle appears in the Knowledge test sandbox.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.govern.reviewQueue",
    category: "release",
    label: "KB Govern review queue",
    description:
      "Controls whether the review queue section is available inside the Knowledge Govern tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.govern.reviewAssignments",
    category: "release",
    label: "KB Review ownership controls",
    description:
      "Controls whether assignment, claim, and reminder controls appear inside the review queue detail view.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.govern.usersAccess",
    category: "release",
    label: "KB Govern users and access",
    description:
      "Controls whether the users and access section is available inside the Knowledge Govern tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.govern.compliance",
    category: "release",
    label: "KB Govern compliance",
    description:
      "Controls whether the compliance section is available inside the Knowledge Govern tab.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.activity.pipelineJobs",
    category: "release",
    label: "KB Activity pipeline jobs",
    description:
      "Controls whether the pipeline jobs section is available inside the Knowledge Activity tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.knowledge.activity.alertHistory",
    category: "release",
    label: "KB Activity alert history",
    description:
      "Controls whether the alert history section is available inside the Knowledge Activity tab.",
    defaultEnabled: true,
    minimumRole: "viewer",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-knowledge",
  },
  {
    key: "release.connectors.googleDrive",
    category: "release",
    label: "Google Drive connector",
    description:
      "Controls whether the Google Drive connector can be configured and synced.",
    defaultEnabled: true,
    minimumRole: "manager",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-connectors",
  },
  {
    key: "debug.chat.activityPanel",
    category: "debug",
    label: "Chat activity panel",
    description:
      "Controls whether the chat activity sidebar and its keyboard shortcut are available.",
    defaultEnabled: false,
    minimumRole: "admin",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-observability",
  },
  {
    key: "debug.chat.tracePayloads",
    category: "debug",
    label: "Trace payload details",
    description:
      "Controls whether raw tool input and output payloads are shown in the chat trace UI.",
    defaultEnabled: false,
    minimumRole: "admin",
    adminEditable: true,
    clientVisible: true,
    environments: ["development", "test", "staging", "production"],
    owner: "platform-observability",
  },
] as const;

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_DEFINITIONS.map(
  definition => definition.key
) as FeatureFlagKey[];

export const DEBUG_FEATURE_FLAG_KEYS = FEATURE_FLAG_DEFINITIONS.filter(
  definition => definition.category === "debug"
).map(definition => definition.key) as FeatureFlagKey[];

export const FEATURE_FLAG_PRESETS: readonly FeatureFlagPresetDefinition[] = [
  {
    key: "mvp.first",
    label: "MVP 1 - Curated KB Pilot",
    description:
      "First MVP rollout with chat prompt generation and rerun, KB overview, file upload, document browsing, and basic activity monitoring while attachments, voice, destructive debug resets, advanced validation, governance, and connectors stay off.",
    owner: "platform-admin",
    overrides: {
      "release.chat.promptGenerator": true,
      "release.chat.attachments": false,
      "release.chat.voice": false,
      "release.chat.rerun": true,
      "release.chat.clearAllTasks": false,
      "release.knowledge.tabs.overview": true,
      "release.knowledge.overview.contentReadiness": true,
      "release.knowledge.overview.answerTrust": true,
      "release.knowledge.overview.reviewQueue": true,
      "release.knowledge.overview.connectedSources": true,
      "release.knowledge.overview.complianceSafety": true,
      "release.knowledge.overview.contentCurrency": true,
      "release.knowledge.overview.telemetry": true,
      "release.knowledge.tabs.ingest": true,
      "release.knowledge.tabs.library": true,
      "release.knowledge.tabs.validate": false,
      "release.knowledge.tabs.govern": false,
      "release.knowledge.tabs.pipelines": true,
      "release.knowledge.tabs.activity": true,
      "release.knowledge.ingest.fileUpload": true,
      "release.knowledge.ingest.textPaste": false,
      "release.knowledge.ingest.urlCrawl": false,
      "release.knowledge.ingest.connectors": false,
      "release.knowledge.ingest.accessControls": true,
      "release.knowledge.ingest.tags": true,
      "release.knowledge.library.documents": true,
      "release.knowledge.library.collections": false,
      "release.knowledge.library.taxonomy": false,
      "release.knowledge.library.graph": false,
      "release.knowledge.library.filters": true,
      "release.knowledge.library.gapAnalysis": true,
      "release.knowledge.validate.testSandbox": false,
      "release.knowledge.validate.evalSuite": false,
      "release.knowledge.validate.quality": false,
      "release.knowledge.validate.gaps": false,
      "release.knowledge.validate.compare": true,
      "release.knowledge.validate.contextShaping": true,
      "release.knowledge.govern.reviewQueue": false,
      "release.knowledge.govern.usersAccess": false,
      "release.knowledge.govern.compliance": false,
      "release.knowledge.govern.reviewAssignments": true,
      "release.knowledge.activity.pipelineJobs": true,
      "release.knowledge.activity.alertHistory": true,
      "release.connectors.googleDrive": false,
      "debug.chat.activityPanel": false,
      "debug.chat.tracePayloads": false,
    },
  },
  {
    key: "mvp.curated",
    label: "MVP 2 - Curated KB Workflow",
    description:
      "Pilot rollout for the explicit stream-scoped KB workflow with chat rerun, backend feedback capture, file upload, review queue, quality checks, test sandbox, and eval suites enabled while attachments, voice, connectors, alternate ingest modes, graph views, and destructive debug resets stay off.",
    owner: "platform-admin",
    overrides: {
      "release.chat.promptGenerator": true,
      "release.chat.attachments": false,
      "release.chat.voice": false,
      "release.chat.rerun": true,
      "release.chat.clearAllTasks": false,
      "release.knowledge.tabs.overview": true,
      "release.knowledge.overview.contentReadiness": true,
      "release.knowledge.overview.answerTrust": false,
      "release.knowledge.overview.reviewQueue": true,
      "release.knowledge.overview.connectedSources": false,
      "release.knowledge.overview.complianceSafety": false,
      "release.knowledge.overview.contentCurrency": false,
      "release.knowledge.overview.telemetry": false,
      "release.knowledge.tabs.ingest": true,
      "release.knowledge.tabs.library": true,
      "release.knowledge.tabs.validate": true,
      "release.knowledge.tabs.govern": true,
      "release.knowledge.tabs.pipelines": true,
      "release.knowledge.tabs.activity": true,
      "release.knowledge.ingest.fileUpload": true,
      "release.knowledge.ingest.textPaste": false,
      "release.knowledge.ingest.urlCrawl": false,
      "release.knowledge.ingest.connectors": false,
      "release.knowledge.ingest.accessControls": false,
      "release.knowledge.ingest.tags": false,
      "release.knowledge.library.documents": true,
      "release.knowledge.library.collections": false,
      "release.knowledge.library.taxonomy": false,
      "release.knowledge.library.graph": false,
      "release.knowledge.library.filters": false,
      "release.knowledge.library.gapAnalysis": false,
      "release.knowledge.validate.testSandbox": true,
      "release.knowledge.validate.evalSuite": true,
      "release.knowledge.validate.quality": true,
      "release.knowledge.validate.gaps": false,
      "release.knowledge.validate.compare": false,
      "release.knowledge.validate.contextShaping": false,
      "release.knowledge.govern.reviewQueue": true,
      "release.knowledge.govern.usersAccess": false,
      "release.knowledge.govern.compliance": false,
      "release.knowledge.govern.reviewAssignments": false,
      "release.knowledge.activity.pipelineJobs": true,
      "release.knowledge.activity.alertHistory": false,
      "release.connectors.googleDrive": false,
      "debug.chat.activityPanel": false,
      "debug.chat.tracePayloads": false,
    },
  },
  {
    key: "beta.full",
    label: "Beta - Full KB Workspace",
    description:
      "Expanded rollout for the complete Knowledge workspace: all core KB tabs, ingest modes, library views, validation sections, governance surfaces, activity monitoring, and Google Drive connector support are enabled while debug-only chat diagnostics remain off.",
    owner: "platform-admin",
    overrides: {
      "release.chat.promptGenerator": true,
      "release.chat.attachments": true,
      "release.chat.voice": true,
      "release.chat.rerun": true,
      "release.chat.clearAllTasks": false,
      "release.knowledge.tabs.overview": true,
      "release.knowledge.overview.contentReadiness": true,
      "release.knowledge.overview.answerTrust": true,
      "release.knowledge.overview.reviewQueue": true,
      "release.knowledge.overview.connectedSources": true,
      "release.knowledge.overview.complianceSafety": true,
      "release.knowledge.overview.contentCurrency": true,
      "release.knowledge.overview.telemetry": true,
      "release.knowledge.tabs.ingest": true,
      "release.knowledge.tabs.library": true,
      "release.knowledge.tabs.validate": true,
      "release.knowledge.tabs.govern": true,
      "release.knowledge.tabs.pipelines": true,
      "release.knowledge.tabs.activity": true,
      "release.knowledge.ingest.fileUpload": true,
      "release.knowledge.ingest.textPaste": true,
      "release.knowledge.ingest.urlCrawl": true,
      "release.knowledge.ingest.connectors": true,
      "release.knowledge.ingest.accessControls": true,
      "release.knowledge.ingest.tags": true,
      "release.knowledge.library.documents": true,
      "release.knowledge.library.collections": true,
      "release.knowledge.library.taxonomy": true,
      "release.knowledge.library.graph": true,
      "release.knowledge.library.filters": true,
      "release.knowledge.library.gapAnalysis": true,
      "release.knowledge.validate.testSandbox": true,
      "release.knowledge.validate.evalSuite": true,
      "release.knowledge.validate.quality": true,
      "release.knowledge.validate.gaps": true,
      "release.knowledge.validate.compare": true,
      "release.knowledge.validate.contextShaping": true,
      "release.knowledge.govern.reviewQueue": true,
      "release.knowledge.govern.usersAccess": true,
      "release.knowledge.govern.compliance": true,
      "release.knowledge.govern.reviewAssignments": true,
      "release.knowledge.activity.pipelineJobs": true,
      "release.knowledge.activity.alertHistory": true,
      "release.connectors.googleDrive": true,
      "debug.chat.activityPanel": false,
      "debug.chat.tracePayloads": false,
    },
  },
] as const;

const FEATURE_FLAG_DEFINITION_MAP: Record<
  FeatureFlagKey,
  FeatureFlagDefinition
> = FEATURE_FLAG_DEFINITIONS.reduce(
  (acc, definition) => {
    acc[definition.key] = definition;
    return acc;
  },
  {} as Record<FeatureFlagKey, FeatureFlagDefinition>
);

const FEATURE_FLAG_PRESET_MAP: Record<
  FeatureFlagPresetKey,
  FeatureFlagPresetDefinition
> = FEATURE_FLAG_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.key] = preset;
    return acc;
  },
  {} as Record<FeatureFlagPresetKey, FeatureFlagPresetDefinition>
);

const FEATURE_FLAG_PARENT_KEYS: Partial<
  Record<FeatureFlagKey, FeatureFlagKey>
> = {
  "release.knowledge.overview.contentReadiness":
    "release.knowledge.tabs.overview",
  "release.knowledge.overview.answerTrust": "release.knowledge.tabs.overview",
  "release.knowledge.overview.reviewQueue": "release.knowledge.tabs.overview",
  "release.knowledge.overview.connectedSources":
    "release.knowledge.tabs.overview",
  "release.knowledge.overview.complianceSafety":
    "release.knowledge.tabs.overview",
  "release.knowledge.overview.contentCurrency":
    "release.knowledge.tabs.overview",
  "release.knowledge.overview.telemetry": "release.knowledge.tabs.overview",
  "release.knowledge.ingest.fileUpload": "release.knowledge.tabs.ingest",
  "release.knowledge.ingest.textPaste": "release.knowledge.tabs.ingest",
  "release.knowledge.ingest.urlCrawl": "release.knowledge.tabs.ingest",
  "release.knowledge.ingest.connectors": "release.knowledge.tabs.ingest",
  "release.knowledge.ingest.accessControls": "release.knowledge.tabs.ingest",
  "release.knowledge.ingest.tags": "release.knowledge.tabs.ingest",
  "release.knowledge.library.documents": "release.knowledge.tabs.library",
  "release.knowledge.library.collections": "release.knowledge.tabs.library",
  "release.knowledge.library.taxonomy": "release.knowledge.tabs.library",
  "release.knowledge.library.graph": "release.knowledge.tabs.library",
  "release.knowledge.library.filters": "release.knowledge.library.documents",
  "release.knowledge.library.gapAnalysis":
    "release.knowledge.library.documents",
  "release.knowledge.validate.testSandbox": "release.knowledge.tabs.validate",
  "release.knowledge.validate.evalSuite": "release.knowledge.tabs.validate",
  "release.knowledge.validate.quality": "release.knowledge.tabs.validate",
  "release.knowledge.validate.gaps": "release.knowledge.tabs.validate",
  "release.knowledge.validate.compare":
    "release.knowledge.validate.testSandbox",
  "release.knowledge.validate.contextShaping":
    "release.knowledge.validate.testSandbox",
  "release.knowledge.govern.reviewQueue": "release.knowledge.tabs.govern",
  "release.knowledge.govern.usersAccess": "release.knowledge.tabs.govern",
  "release.knowledge.govern.compliance": "release.knowledge.tabs.govern",
  "release.knowledge.govern.reviewAssignments":
    "release.knowledge.govern.reviewQueue",
  "release.knowledge.activity.pipelineJobs": "release.knowledge.tabs.activity",
  "release.knowledge.activity.alertHistory": "release.knowledge.tabs.activity",
  "release.connectors.googleDrive": "release.knowledge.ingest.connectors",
};

const FEATURE_FLAG_CHILD_KEYS: Partial<
  Record<FeatureFlagKey, readonly FeatureFlagKey[]>
> = {
  "release.knowledge.tabs.ingest": [
    "release.knowledge.ingest.fileUpload",
    "release.knowledge.ingest.textPaste",
    "release.knowledge.ingest.urlCrawl",
    "release.knowledge.ingest.connectors",
  ],
  "release.knowledge.tabs.library": [
    "release.knowledge.library.documents",
    "release.knowledge.library.collections",
    "release.knowledge.library.taxonomy",
    "release.knowledge.library.graph",
  ],
  "release.knowledge.tabs.validate": [
    "release.knowledge.validate.testSandbox",
    "release.knowledge.validate.evalSuite",
    "release.knowledge.validate.quality",
    "release.knowledge.validate.gaps",
  ],
  "release.knowledge.tabs.govern": [
    "release.knowledge.govern.reviewQueue",
    "release.knowledge.govern.usersAccess",
    "release.knowledge.govern.compliance",
  ],
  "release.knowledge.tabs.activity": [
    "release.knowledge.activity.pipelineJobs",
    "release.knowledge.activity.alertHistory",
  ],
};

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(
    FEATURE_FLAG_DEFINITION_MAP,
    value
  );
}

export function getFeatureFlagDefinition(
  key: FeatureFlagKey
): FeatureFlagDefinition {
  return FEATURE_FLAG_DEFINITION_MAP[key];
}

export function isFeatureFlagPresetKey(
  value: string
): value is FeatureFlagPresetKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_PRESET_MAP, value);
}

export function getFeatureFlagPreset(
  key: FeatureFlagPresetKey
): FeatureFlagPresetDefinition {
  return FEATURE_FLAG_PRESET_MAP[key];
}

export function getRequiredParentFeatureFlagKey(
  key: FeatureFlagKey
): FeatureFlagKey | null {
  return FEATURE_FLAG_PARENT_KEYS[key] ?? null;
}

export function getChildFeatureFlagKeys(key: FeatureFlagKey): FeatureFlagKey[] {
  return [...(FEATURE_FLAG_CHILD_KEYS[key] ?? [])];
}

function isSnapshotFeatureEnabled(
  snapshot: Partial<Record<FeatureFlagKey, boolean>>,
  key: FeatureFlagKey
): boolean {
  if (typeof snapshot[key] === "boolean") {
    return snapshot[key] as boolean;
  }

  return getFeatureFlagDefinition(key).defaultEnabled;
}

export function getFeatureFlagDependencyIssues(
  snapshot: Partial<Record<FeatureFlagKey, boolean>>
): FeatureFlagDependencyIssue[] {
  const issues: FeatureFlagDependencyIssue[] = [];

  for (const [childKey, parentKey] of Object.entries(
    FEATURE_FLAG_PARENT_KEYS
  ) as Array<[FeatureFlagKey, FeatureFlagKey]>) {
    if (
      isSnapshotFeatureEnabled(snapshot, childKey) &&
      !isSnapshotFeatureEnabled(snapshot, parentKey)
    ) {
      const childDefinition = getFeatureFlagDefinition(childKey);
      const parentDefinition = getFeatureFlagDefinition(parentKey);
      issues.push({
        id: `missing-parent:${childKey}`,
        severity: "critical",
        featureKeys: [childKey, parentKey],
        title: `${childDefinition.label} depends on ${parentDefinition.label}`,
        description: `Enable ${parentDefinition.label} or turn off ${childDefinition.label} so this deployment does not advertise an inaccessible capability.`,
      });
    }
  }

  for (const [parentKey, childKeys] of Object.entries(
    FEATURE_FLAG_CHILD_KEYS
  ) as Array<[FeatureFlagKey, readonly FeatureFlagKey[]]>) {
    if (!isSnapshotFeatureEnabled(snapshot, parentKey)) {
      continue;
    }

    if (
      childKeys.some(childKey => isSnapshotFeatureEnabled(snapshot, childKey))
    ) {
      continue;
    }

    const parentDefinition = getFeatureFlagDefinition(parentKey);
    const childLabels = childKeys
      .map(childKey => getFeatureFlagDefinition(childKey).label)
      .join(", ");

    issues.push({
      id: `empty-surface:${parentKey}`,
      severity: "warning",
      featureKeys: [parentKey, ...childKeys],
      title: `${parentDefinition.label} has no enabled sub-controls`,
      description: `Turn on at least one of ${childLabels}, or disable ${parentDefinition.label} to avoid shipping an empty workspace surface.`,
    });
  }

  return issues;
}

export function createFeatureFlagSnapshot(
  initialValue = false
): FeatureFlagSnapshot {
  return FEATURE_FLAG_KEYS.reduce((snapshot, key) => {
    snapshot[key] = initialValue;
    return snapshot;
  }, {} as FeatureFlagSnapshot);
}

export function createDefaultFeatureFlagSnapshot(): FeatureFlagSnapshot {
  return FEATURE_FLAG_DEFINITIONS.reduce((snapshot, definition) => {
    snapshot[definition.key] = definition.defaultEnabled;
    return snapshot;
  }, {} as FeatureFlagSnapshot);
}

export function createFeatureFlagPresetSnapshot(
  overrides: Partial<Record<FeatureFlagKey, boolean>> = {}
): FeatureFlagSnapshot {
  const snapshot = createDefaultFeatureFlagSnapshot();

  for (const [featureKey, enabled] of Object.entries(overrides) as Array<
    [FeatureFlagKey, boolean | undefined]
  >) {
    if (typeof enabled === "boolean") {
      snapshot[featureKey] = enabled;
    }
  }

  return snapshot;
}
