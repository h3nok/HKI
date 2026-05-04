import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  Layers,
  Mic,
  Network,
  PanelRightOpen,
  Paperclip,
  Plug,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { a } from "./theme";
import type { FeatureSectionKey, Tone } from "./types";

export const CATEGORY_META = {
  release: {
    label: "Release Controls",
    icon: Sparkles,
    pillClass: a.pillPrimary,
    description: "Progressively launch user-facing capabilities.",
  },
  debug: {
    label: "Debug Tools",
    icon: Wrench,
    pillClass: a.pillWarning,
    description: "Admin-only observability and diagnostic surfaces.",
  },
  experiment: {
    label: "Experiments",
    icon: Gauge,
    pillClass: a.pillNeutral,
    description: "Compare alternate UX or behavior safely.",
  },
  "kill-switch": {
    label: "Kill Switch",
    icon: Shield,
    pillClass: a.pillCritical,
    description: "Emergency shutdown controls for risky behavior.",
  },
} as const;

export const TONE_STYLES: Record<
  Tone,
  { iconClass: string; badgeClass: string }
> = {
  primary: { iconClass: a.iconPrimary, badgeClass: a.pillPrimary },
  positive: { iconClass: a.iconPositive, badgeClass: a.pillPositive },
  warning: { iconClass: a.iconWarning, badgeClass: a.pillWarning },
  critical: { iconClass: a.iconCritical, badgeClass: a.pillCritical },
  neutral: { iconClass: a.iconNeutral, badgeClass: a.pillNeutral },
};

export const SOFT_BADGE_CLASS = "px-2.5 py-1 text-[11px] font-medium";
export const SOFT_LABEL_CLASS = "text-[11px] font-medium text-muted-foreground";

export const LEGACY_AUDIT_COPY: Partial<
  Record<string, { title: string; description: string }>
> = {
  "release.admin.usagePage": {
    title: "Retired admin usage flag",
    description:
      "Historical entry from a rollout key that no longer controls admin availability.",
  },
};

export const FEATURE_ICONS: Partial<Record<FeatureFlagKey, LucideIcon>> = {
  "release.chat.promptGenerator": Sparkles,
  "release.chat.attachments": Paperclip,
  "release.chat.voice": Mic,
  "release.chat.rerun": RotateCcw,
  "release.chat.clearAllTasks": Trash2,
  "release.knowledge.tabs.overview": LayoutDashboard,
  "release.knowledge.overview.contentReadiness": LayoutDashboard,
  "release.knowledge.overview.answerTrust": ShieldCheck,
  "release.knowledge.overview.reviewQueue": Shield,
  "release.knowledge.overview.connectedSources": Plug,
  "release.knowledge.overview.complianceSafety": ShieldCheck,
  "release.knowledge.overview.contentCurrency": RefreshCw,
  "release.knowledge.overview.telemetry": Activity,
  "release.knowledge.tabs.ingest": Upload,
  "release.knowledge.tabs.library": BookOpen,
  "release.knowledge.tabs.validate": ShieldCheck,
  "release.knowledge.tabs.govern": Shield,
  "release.knowledge.tabs.pipelines": Workflow,
  "release.knowledge.tabs.activity": Activity,
  "release.knowledge.ingest.fileUpload": Upload,
  "release.knowledge.ingest.textPaste": FileText,
  "release.knowledge.ingest.urlCrawl": Globe,
  "release.knowledge.ingest.connectors": Plug,
  "release.knowledge.ingest.accessControls": Shield,
  "release.knowledge.ingest.tags": Tags,
  "release.knowledge.library.documents": BookOpen,
  "release.knowledge.library.collections": Layers,
  "release.knowledge.library.taxonomy": Tags,
  "release.knowledge.library.graph": Network,
  "release.knowledge.library.filters": Search,
  "release.knowledge.library.gapAnalysis": AlertTriangle,
  "release.knowledge.validate.testSandbox": ShieldCheck,
  "release.knowledge.validate.evalSuite": BarChart3,
  "release.knowledge.validate.quality": Sparkles,
  "release.knowledge.validate.gaps": Search,
  "release.knowledge.validate.compare": Search,
  "release.knowledge.validate.contextShaping": ShieldCheck,
  "release.knowledge.govern.reviewQueue": Shield,
  "release.knowledge.govern.usersAccess": Users,
  "release.knowledge.govern.compliance": ShieldCheck,
  "release.knowledge.govern.reviewAssignments": Users,
  "release.knowledge.activity.pipelineJobs": Workflow,
  "release.knowledge.activity.alertHistory": Bell,
  "release.connectors.googleDrive": Plug,
  "debug.chat.activityPanel": PanelRightOpen,
  "debug.chat.tracePayloads": Activity,
};

export const FEATURE_SECTION_META: Record<
  FeatureSectionKey,
  { title: string; description: string; icon: LucideIcon }
> = {
  agentic: {
    title: "Agentic Experience",
    description: "Controls the Agent Chat experience and prompting behavior.",
    icon: Sparkles,
  },
  knowledgeTabs: {
    title: "Knowledge Workspace",
    description: "Which core knowledge areas appear.",
    icon: LayoutDashboard,
  },
  ingest: {
    title: "Ingest Methods",
    description: "How content enters the knowledge base.",
    icon: Upload,
  },
  library: {
    title: "Library Surfaces",
    description: "Browse, organize, and graph content.",
    icon: BookOpen,
  },
  validate: {
    title: "Validation",
    description: "Testing, evaluation, and quality checks.",
    icon: ShieldCheck,
  },
  govern: {
    title: "Governance",
    description: "Review, access, and compliance controls.",
    icon: Shield,
  },
  activity: {
    title: "Activity & Monitoring",
    description: "Jobs, alerts, and monitoring.",
    icon: Activity,
  },
  connectors: {
    title: "Connectors",
    description: "Source integrations and connector rollout.",
    icon: Plug,
  },
  debug: {
    title: "Debug Diagnostics",
    description: "Investigation-only tools behind debug access.",
    icon: Wrench,
  },
  other: {
    title: "Other Controls",
    description: "Remaining controls.",
    icon: Gauge,
  },
};
