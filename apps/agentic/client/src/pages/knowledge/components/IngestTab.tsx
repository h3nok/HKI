/**
 * Add Content — Guided Flow
 *
 * Redesigned from a multi-panel studio into a simpler guided intake flow.
 *
 * Five phases, one at a time — full-width with clear transitions:
 *   1. Add Content  → Choose one source and provide content
 *   2. Check        → Real-time quality and safety review
 *   3. Review       → Plain-language recommendation and decision
 *   4. Add          → Background processing progress
 *   5. Done         → Success state with next actions
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Upload,
  FileText,
  Globe,
  ShieldCheck,
  Eye,
  Gavel,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  RotateCw,
  BookOpen,
  FlaskConical,
  ChevronRight,
  Clock,
  Workflow,
  Plug,
  Plus,
  type LucideIcon,
  File,
  FileSpreadsheet,
  Trash2,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  Copy,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import {
  cn,
  useNotifications,
  Button,
  Badge,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import type {
  FeatureFlagKey,
  FeatureFlagSnapshot,
} from "@shared/feature-flags";
import {
  isSearchableDocumentStatus,
  type DocumentClassification,
  type DocumentStatus,
} from "@shared/knowledge-types";
import { k, JOB_POLL_INTERVAL_MS } from "../theme";
import {
  JOB_STATUS_META,
  type KnowledgeTab,
  getDocumentClassificationMeta,
  hasExplicitAccessControl,
  humanizeError,
  humanizePipelineError,
  isLikelyLegalStream,
  isSensitiveDocumentClassification,
  summarizeAccessControl,
} from "../types";
import {
  KNOWLEDGE_PIPELINE_STAGES,
  PIPELINE_STAGE_COPY,
  getPipelineStatusLabel,
  isPipelineProcessingStatus,
} from "../pipelineCopy";
import {
  GoogleDriveSetup,
  ConnectorCatalog,
  ActiveConnectors,
  type SourceTypeDefinition,
} from "./connectors";
import {
  useIngestPipeline,
  buildAccessControl,
  child,
  type IngestFormState,
} from "./ingest";
import { PipelineCoachCards } from "./pipeline/PipelineCoachCards";
import FileDropZone, { type SelectedFile } from "./upload/FileDropZone";

// ── Entry choices ────────────────────────────────────────────────────────────

type AddMethod = "file" | "text" | "url" | "connect";
type AddMethodOption = (typeof ADD_METHODS)[number] & { enabled: boolean };

const ADD_METHODS: {
  key: AddMethod;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    key: "file",
    label: "📄 Upload Files",
    icon: Upload,
    description: "PDFs, docs, spreadsheets, and more",
  },
  {
    key: "text",
    label: "📝 Paste Text",
    icon: FileText,
    description: "Policies, SOPs, FAQs, and notes",
  },
  {
    key: "url",
    label: "🌐 Add Web Link",
    icon: Globe,
    description: "Import a page from an internal or public site",
  },
  {
    key: "connect",
    label: "🔗 Connect Another System",
    icon: Plug,
    description: "Keep content in sync from another system",
  },
];

const ADD_METHOD_FEATURE_KEYS: Record<AddMethod, FeatureFlagKey> = {
  file: "release.knowledge.ingest.fileUpload",
  text: "release.knowledge.ingest.textPaste",
  url: "release.knowledge.ingest.urlCrawl",
  connect: "release.knowledge.ingest.connectors",
};

// ── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: EASE },
};

// ── Flow step definitions ────────────────────────────────────────────────────

// ── File type helpers ────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf")
    return { icon: FileText, color: "text-red-500", bg: "bg-red-500/10" };
  if (["docx", "doc"].includes(ext))
    return { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (["xlsx", "xls", "csv"].includes(ext))
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    };
  return { icon: File, color: "text-muted-foreground", bg: "bg-muted" };
}

// ── AI Analysis stage info ───────────────────────────────────────────────────

interface AnalysisStage {
  key: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  activeLabel: string;
}

const ANALYSIS_STAGES: AnalysisStage[] = [
  {
    key: "validate",
    icon: ShieldCheck,
    label: "Checking",
    desc: "Making sure your content is clear and safe",
    activeLabel: "Checking…",
  },
  {
    key: "interpret",
    icon: Eye,
    label: "Understanding",
    desc: "Figuring out what the document is about",
    activeLabel: "Reading…",
  },
  {
    key: "decide",
    icon: Gavel,
    label: "Reviewing",
    desc: "Checking for duplicates and relevance",
    activeLabel: "Reviewing…",
  },
  {
    key: "ingest",
    icon: Database,
    label: "Ready",
    desc: "Getting everything ready for your review",
    activeLabel: "Finishing up…",
  },
];

const JOB_WS_FALLBACK_POLL_MS = 15_000;
const JOB_IDLE_POLL_MAX_MS = 60_000;

const CLASSIFICATION_OPTIONS: Array<{
  value: DocumentClassification;
  label: string;
  description: string;
}> = [
  {
    value: "internal",
    label: "Internal",
    description: "Normal domain content for the broader working team.",
  },
  {
    value: "confidential",
    label: "Confidential",
    description:
      "Business-sensitive content for a narrower operating audience.",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "Sensitive material that should stay inside named groups.",
  },
  {
    value: "privileged",
    label: "Privileged",
    description: "Legal or regulated content that needs tight access controls.",
  },
];

function getClassificationDetails(value: DocumentClassification) {
  return (
    CLASSIFICATION_OPTIONS.find(option => option.value === value) ??
    CLASSIFICATION_OPTIONS[0]!
  );
}

function parsePrincipalList(value: string): string[] {
  return value
    .split(",")
    .map(token => token.trim())
    .filter(Boolean);
}

function summarizeAccessPolicy(
  form: IngestFormState,
  currentUserId?: string
): string {
  return summarizeAccessControl(buildAccessControl(form, currentUserId), {
    emptyLabel: "Uses normal domain access",
    userLabels: currentUserId ? { [currentUserId]: "You" } : undefined,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface IngestTabProps {
  streamName?: string;
  streamId?: string;
  onStepComplete?: (stepId: string) => void;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

export default function IngestTab({
  streamName,
  streamId,
  onStepComplete,
  onNavigate,
}: IngestTabProps) {
  const [showDrive, setShowDrive] = useState(false);
  const { notify } = useNotifications();
  const [, setLocation] = useLocation();
  const { role } = usePermissions();
  const {
    canView: canViewFeature,
    flags,
    isLoading: isFeatureAccessLoading,
  } = useFeatureAccess();
  const canManageFeatureControls = role === "admin";

  const connectorsQ = trpc.connectors.list.useQuery(undefined, {
    retry: false,
  });
  const connectors = connectorsQ.data ?? [];
  const activeConnectorTypes = connectors.map((c: any) => c.type);

  const pipeline = useIngestPipeline({ onStepComplete, streamId });
  // Sync addMethod to pipeline.mode so canAnalyze checks the right mode
  // (pipeline.mode may be hydrated from sessionStorage)
  const [addMethod, setAddMethod] = useState<AddMethod>(() => {
    const m = pipeline.mode;
    return m === "file" || m === "text" || m === "url" ? m : "file";
  });
  const { flowStep } = pipeline;
  const addMethodOptions = useMemo<AddMethodOption[]>(
    () =>
      ADD_METHODS.map(method => ({
        ...method,
        enabled: canViewFeature(ADD_METHOD_FEATURE_KEYS[method.key]),
      })),
    [canViewFeature]
  );
  const availableAddMethods = useMemo(
    () => addMethodOptions.filter(method => method.enabled),
    [addMethodOptions]
  );
  const showAccessControls = canViewFeature(
    "release.knowledge.ingest.accessControls"
  );
  const showTags = canViewFeature("release.knowledge.ingest.tags");
  const uploadLimitsQ = trpc.knowledge.uploadLimits.useQuery(
    { streamId: streamId || undefined },
    { retry: false, staleTime: 60_000 }
  );
  const effectiveMaxMb = uploadLimitsQ.data?.effectiveMaxMb ?? 50;

  useEffect(() => {
    if (isFeatureAccessLoading || showAccessControls) return;

    pipeline.setForm(current => {
      if (
        current.classification === "internal" &&
        !current.allowedGroups &&
        !current.deniedGroups
      ) {
        return current;
      }

      return {
        ...current,
        classification: "internal",
        allowedGroups: "",
        deniedGroups: "",
      };
    });
  }, [isFeatureAccessLoading, pipeline, showAccessControls]);

  useEffect(() => {
    if (isFeatureAccessLoading || showTags) return;

    pipeline.setForm(current => {
      if (!current.tags) return current;
      return { ...current, tags: "" };
    });
  }, [isFeatureAccessLoading, pipeline, showTags]);

  useEffect(() => {
    if (availableAddMethods.length === 0) return;
    if (availableAddMethods.some(method => method.key === addMethod)) return;

    const fallback = availableAddMethods[0]!.key;
    setAddMethod(fallback);
    if (fallback !== "connect") {
      pipeline.setMode(fallback);
    }
  }, [addMethod, availableAddMethods, pipeline]);

  // Google Drive setup view (or any connector setup that takes over the view)
  if (showDrive) {
    return (
      <motion.div {...child} className="w-full">
        <GoogleDriveSetup
          streamName={streamName}
          streamId={streamId}
          onBack={() => {
            setShowDrive(false);
          }}
          onConnected={() => {
            notify({
              title: "Google Drive connected",
              description: "Documents will sync automatically.",
              severity: "success",
              group: "connector",
            });
            connectorsQ.refetch();
            setShowDrive(false);
          }}
        />
      </motion.div>
    );
  }

  if (
    !isFeatureAccessLoading &&
    availableAddMethods.length === 0 &&
    flowStep === "add"
  ) {
    return (
      <motion.div {...child} className="w-full">
        <div className={cn(k.card, "p-6")}>
          <h3 className="text-base font-semibold text-foreground">
            Ingest is disabled for this deployment
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No ingest methods are currently enabled. An administrator can enable
            them from Settings.
          </p>
          {canManageFeatureControls && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setLocation("/admin/settings")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Open Settings
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full pb-8"
    >
      <AnimatePresence mode="wait">
        {flowStep === "add" && (
          <motion.div key="add" {...fadeUp}>
            <AddContentPhase
              pipeline={pipeline}
              streamId={streamId}
              streamName={streamName}
              effectiveMaxMb={effectiveMaxMb}
              addMethod={addMethod}
              addMethodOptions={addMethodOptions}
              onAddMethodChange={setAddMethod}
              connectors={connectors}
              connectorsLoading={connectorsQ.isLoading}
              onRefreshConnectors={() => connectorsQ.refetch()}
              activeConnectorTypes={activeConnectorTypes}
              deploymentFeatureFlags={
                isFeatureAccessLoading ? undefined : flags
              }
              showAccessControls={showAccessControls}
              showTags={showTags}
              onSelectConnector={source => {
                if (source.id === "google_drive") {
                  setShowDrive(true);
                } else if (source.id === "file_upload") {
                  setAddMethod("file");
                  pipeline.setMode("file");
                } else if (source.id === "text_paste") {
                  setAddMethod("text");
                  pipeline.setMode("text");
                } else if (source.id === "url_crawl") {
                  setAddMethod("url");
                  pipeline.setMode("url");
                } else {
                  notify({
                    title: `${source.name} setup`,
                    description: source.available
                      ? `${source.name} connector setup wizard coming soon.`
                      : `${source.name} is not yet available.`,
                    severity: "info",
                    group: "connector",
                  });
                }
              }}
            />
          </motion.div>
        )}

        {flowStep === "analyze" && (
          <motion.div key="analyze" {...fadeUp}>
            <AnalyzingPhase pipeline={pipeline} />
          </motion.div>
        )}

        {flowStep === "review" && (
          <motion.div key="review" {...fadeUp}>
            <ReviewPhase
              pipeline={pipeline}
              showAccessControls={showAccessControls}
              showTags={showTags}
            />
          </motion.div>
        )}

        {flowStep === "ingest" && (
          <motion.div key="ingest" {...fadeUp}>
            <ProcessingPhase pipeline={pipeline} />
          </motion.div>
        )}

        {flowStep === "track" && (
          <motion.div key="track" {...fadeUp}>
            <CompletePhase
              pipeline={pipeline}
              onNavigate={onNavigate}
              valueStreamId={streamId}
              showAccessControls={showAccessControls}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — ADD CONTENT
// ══════════════════════════════════════════════════════════════════════════════

function AddContentPhase({
  pipeline,
  streamId,
  streamName,
  effectiveMaxMb,
  addMethod,
  addMethodOptions,
  onAddMethodChange,
  connectors,
  connectorsLoading,
  onRefreshConnectors,
  activeConnectorTypes,
  deploymentFeatureFlags,
  showAccessControls,
  showTags,
  onSelectConnector,
}: {
  pipeline: ReturnType<typeof useIngestPipeline>;
  streamId?: string;
  streamName?: string;
  effectiveMaxMb: number;
  addMethod: AddMethod;
  addMethodOptions: AddMethodOption[];
  onAddMethodChange: (method: AddMethod) => void;
  connectors: any[];
  connectorsLoading: boolean;
  onRefreshConnectors: () => void;
  activeConnectorTypes: string[];
  deploymentFeatureFlags?: FeatureFlagSnapshot;
  showAccessControls: boolean;
  showTags: boolean;
  onSelectConnector: (source: SourceTypeDefinition) => void;
}) {
  const {
    mode,
    setMode,
    form,
    setForm,
    files,
    setFiles,
    canAnalyze,
    handleAnalyze,
    handleAnalyzeFiles,
    resetPipeline,
    hasAnalysis,
    isIngesting,
    isAnalyzing,
    currentUserId,
  } = pipeline;
  const [showConnectedSources, setShowConnectedSources] = useState(false);

  const activeCount = connectors.filter(
    (c: any) => c.status === "active"
  ).length;
  const disabled = isIngesting || isAnalyzing;
  const visibleAddMethodOptions = addMethodOptions.filter(
    option => option.enabled
  );

  const changeMethod = (next: AddMethod) => {
    onAddMethodChange(next);
    if (hasAnalysis) resetPipeline();
    if (next !== "connect") {
      setMode(next);
    }
  };

  const primaryHeading =
    addMethod === "file"
      ? "📄 Upload one or more files"
      : addMethod === "text"
        ? "📝 Paste content to review"
        : addMethod === "url"
          ? "🌐 Add a web page link"
          : "🔗 Connect a shared source";
  const primaryDescription =
    addMethod === "file"
      ? `Drag files here or browse from your computer. Each file can be up to ${effectiveMaxMb} MB.`
      : addMethod === "text"
        ? "Paste content from an email, policy, FAQ, or SOP. We will review it before adding it."
        : addMethod === "url"
          ? "Paste a page link and we will read the content before adding it."
          : "Set up a source once, then let it stay up to date automatically.";

  return (
    <div className="space-y-5" data-tour="ingest-upload">
      <div className={cn(k.card, "px-4 py-3")}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap mr-auto">
            <h3 className="text-sm font-semibold text-foreground">
              Add knowledge
            </h3>
            {addMethod !== "connect" && (
              <Badge
                variant="outline"
                className="border-primary/15 bg-primary/8 text-primary"
              >
                Max {effectiveMaxMb} MB
              </Badge>
            )}
            {activeCount > 0 && (
              <Badge
                variant="outline"
                className="border-primary/15 bg-primary/8 text-primary"
              >
                {activeCount} connected
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {visibleAddMethodOptions.map(option => {
              const isActive = addMethod === option.key;
              const compactLabel =
                option.key === "file"
                  ? "📄 Upload"
                  : option.key === "text"
                    ? "📝 Paste"
                    : option.key === "url"
                      ? "🌐 Web Link"
                      : "🔗 Connect";

              return (
                <button
                  key={option.key}
                  type="button"
                  data-testid={`kb-ingest-method-${option.key}`}
                  onClick={() => changeMethod(option.key)}
                  disabled={disabled}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                    isActive
                      ? cn(k.duoToneSurfaceActive, "ring-1 ring-primary/10")
                      : cn(
                          "border-border/30 bg-muted/10 text-muted-foreground",
                          k.duoToneHover
                        )
                  )}
                >
                  {compactLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={addMethod}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {addMethod === "connect" ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
              <div className={cn(k.card, "overflow-hidden")}>
                <div className="border-b border-border/25 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                        <Plug className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Automated sources
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                          {primaryHeading}
                        </h3>
                        <p className={cn(k.subtext, "mt-1 max-w-2xl")}>
                          {primaryDescription}
                        </p>
                      </div>
                    </div>
                    {activeCount > 0 && (
                      <Badge variant="outline" className="shrink-0">
                        {activeCount} connected
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="px-6 py-6">
                  <ConnectorCatalog
                    onSelectSource={onSelectConnector}
                    activeConnectorTypes={activeConnectorTypes}
                    enabledFeatureFlags={deploymentFeatureFlags}
                  />
                </div>
              </div>

              <div className="space-y-4 xl:sticky xl:top-6">
                <div className={cn(k.card, "space-y-4 p-5")}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                      <Plug className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <p
                        className={cn(k.caption, "font-semibold text-primary")}
                      >
                        Automated sync
                      </p>
                      <h4 className="mt-0.5 text-base font-semibold text-foreground">
                        Keep shared knowledge current
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Connected
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {activeCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sync style
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        Continuous refresh
                      </p>
                    </div>
                  </div>

                  <p className={cn(k.muted, "leading-5")}>
                    Select a source on the left to open its setup flow.
                    Connected systems can reduce one-off uploads and keep the
                    library fresh.
                  </p>
                </div>

                {activeCount > 0 && (
                  <div className={cn(k.card, "space-y-4 p-5")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Connected sources
                        </p>
                        <p className={cn(k.muted, "mt-1")}>
                          Review sync status or refresh an existing source.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost-primary"
                        size="sm"
                        onClick={() =>
                          setShowConnectedSources(current => !current)
                        }
                      >
                        {showConnectedSources ? "Hide" : "Show"}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showConnectedSources && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-1">
                            <ActiveConnectors
                              connectors={connectors}
                              isLoading={connectorsLoading}
                              onRefresh={onRefreshConnectors}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className={cn(k.card, "space-y-3 p-5")}>
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Why connect a system
                    </h4>
                  </div>
                  {[
                    "Reduce manual re-uploading for content that changes often.",
                    "Keep permissions and freshness tied to the source system.",
                    "Monitor sync status here instead of managing separate import jobs.",
                  ].map(step => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-xl border border-border/25 bg-muted/15 px-3 py-3"
                    >
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className={cn(k.muted, "leading-5")}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
              <div className="space-y-4">
                <div className={cn(k.card, "overflow-hidden px-5 py-5")}>
                  {addMethod === "file" ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Upload queue
                          </p>
                          <p className={cn(k.muted, "mt-1 text-xs leading-5")}>
                            {primaryDescription} Upload multiple PDFs, then
                            check one file, selected files, or the full batch.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-primary/15 bg-primary/8 text-primary"
                        >
                          Bulk + single-file actions
                        </Badge>
                      </div>

                      <div className="rounded-2xl border border-border/30 bg-muted/15 px-5 py-5 lg:px-6 lg:py-6">
                        <FileInputSection
                          files={files}
                          setFiles={setFiles}
                          maxFileSizeBytes={effectiveMaxMb * 1024 * 1024}
                          disabled={disabled}
                          hasAnalysis={hasAnalysis}
                          onReset={resetPipeline}
                          onAnalyzeAll={handleAnalyze}
                          onAnalyzeFiles={handleAnalyzeFiles}
                          canAnalyze={canAnalyze}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Content
                          </p>
                          <p className={cn(k.muted, "mt-1 text-xs leading-5")}>
                            Provide the draft, then review the settings
                            alongside it before you run the check.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-border/25 bg-muted/10 text-muted-foreground"
                        >
                          Nothing is added yet
                        </Badge>
                      </div>

                      <div className="rounded-2xl border border-border/30 bg-muted/15 px-5 py-5 lg:px-6 lg:py-6">
                        {addMethod === "text" && (
                          <TextInputSection
                            form={form}
                            setForm={setForm}
                            hasAnalysis={hasAnalysis}
                            onReset={resetPipeline}
                          />
                        )}

                        {addMethod === "url" && (
                          <UrlInputSection
                            form={form}
                            setForm={setForm}
                            onAnalyze={handleAnalyze}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/25 bg-muted/10 px-4 py-3 flex-wrap">
                        <p className={cn(k.muted, "text-xs leading-5")}>
                          Review the content first, then decide before anything
                          is indexed.
                        </p>
                        <Button
                          data-testid="kb-ingest-continue-to-check"
                          onClick={handleAnalyze}
                          disabled={!canAnalyze || disabled}
                          size="lg"
                          className="justify-center gap-2 text-sm font-bold"
                        >
                          {disabled ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          Continue to Check
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={cn(k.card, "p-4 xl:sticky xl:top-6")}>
                <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-3 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">
                    Document settings
                  </p>
                  <p className={cn(k.muted, "text-xs")}>
                    {addMethod === "file"
                      ? "Applies to the next checked files"
                      : "Set before you check"}
                  </p>
                </div>

                <div className="pt-3">
                  <OptionalDetailsSection
                    form={form}
                    setForm={setForm}
                    streamId={streamId}
                    streamName={streamName}
                    currentUserId={currentUserId}
                    showAccessControls={showAccessControls}
                    showTags={showTags}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Document settings section ────────────────────────────────────────────────

function OptionalDetailsSection({
  form,
  setForm,
  streamId,
  streamName,
  currentUserId,
  showAccessControls,
  showTags,
}: {
  form: IngestFormState;
  setForm: React.Dispatch<React.SetStateAction<IngestFormState>>;
  streamId?: string;
  streamName?: string;
  currentUserId?: string;
  showAccessControls: boolean;
  showTags: boolean;
}) {
  const classification = getClassificationDetails(form.classification);
  const legalStream = isLikelyLegalStream(streamId, streamName);
  const parsedAllowedGroups = parsePrincipalList(form.allowedGroups);
  const parsedDeniedGroups = parsePrincipalList(form.deniedGroups);
  const hasCustomAccessRules =
    parsedAllowedGroups.length > 0 || parsedDeniedGroups.length > 0;
  const isSensitive = isSensitiveDocumentClassification(form.classification);
  const needsAllowList = isSensitive && parsedAllowedGroups.length === 0;
  const accessSummary = summarizeAccessControl(
    buildAccessControl(form, currentUserId),
    {
      emptyLabel: "Uses normal domain access",
      userLabels: currentUserId ? { [currentUserId]: "You" } : undefined,
    }
  );
  const [settingsTab, setSettingsTab] = useState<"metadata" | "access">(
    showAccessControls && (isSensitive || hasCustomAccessRules)
      ? "access"
      : "metadata"
  );

  useEffect(() => {
    if (!showAccessControls && settingsTab !== "metadata") {
      setSettingsTab("metadata");
    }
  }, [settingsTab, showAccessControls]);

  const applySecurityPreset = (
    nextClassification: DocumentClassification,
    allowedGroups: string = "",
    deniedGroups: string = ""
  ) => {
    setForm(current => ({
      ...current,
      classification: nextClassification,
      allowedGroups,
      deniedGroups,
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/25 bg-muted/12 px-3 py-2.5">
        <Badge
          variant="outline"
          className="border-primary/20 bg-primary/8 text-primary"
        >
          {streamName || streamId || "Current stream"}
        </Badge>
        {legalStream && (
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/8 text-primary"
          >
            Legal stream
          </Badge>
        )}
        <Badge
          variant="outline"
          className="border-border/25 bg-background/70 text-foreground"
        >
          {classification.label}
        </Badge>
        {showAccessControls ? (
          <p
            className={cn(
              k.muted,
              "min-w-0 flex-1 text-xs leading-5 sm:text-right wrap-break-word"
            )}
          >
            {accessSummary}
          </p>
        ) : null}
      </div>

      {showAccessControls ? (
        <div className="rounded-xl border border-border/25 bg-muted/10 p-1.5">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setSettingsTab("metadata")}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all",
                settingsTab === "metadata"
                  ? k.duoToneSurfaceActive
                  : cn("text-muted-foreground", k.duoToneHover)
              )}
            >
              Metadata
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("access")}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all",
                settingsTab === "access"
                  ? k.duoToneSurfaceActive
                  : cn("text-muted-foreground", k.duoToneHover),
                needsAllowList && settingsTab !== "access" && "text-primary"
              )}
            >
              <span>Access</span>
              {needsAllowList ? (
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Review
                </span>
              ) : hasCustomAccessRules ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Custom
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      {settingsTab === "metadata" ? (
        <div className="rounded-xl border border-border/25 bg-muted/10 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q2 Return Policy"
                className={cn("h-10 bg-background", k.duoToneField)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Department
              </label>
              <Input
                value={form.department}
                onChange={e =>
                  setForm(f => ({ ...f, department: e.target.value }))
                }
                placeholder="e.g. Operations"
                className={cn("h-10 bg-background", k.duoToneField)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Document type
              </label>
              <Select
                value={form.documentType}
                onValueChange={v => setForm(f => ({ ...f, documentType: v }))}
              >
                <SelectTrigger
                  className={cn("h-10 bg-background", k.duoToneField)}
                >
                  <SelectValue placeholder="Document type" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "general",
                    "policy",
                    "sop",
                    "faq",
                    "training",
                    "report",
                    "memo",
                  ].map(t => (
                    <SelectItem
                      key={t}
                      value={t}
                      className={k.duoToneSelectItem}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showTags ? (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Tags{" "}
                  <span className="text-muted-foreground/50">
                    (comma-separated)
                  </span>
                </label>
                <Input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. policy, returns, 2025"
                  className={cn("h-10 bg-background", k.duoToneField)}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : showAccessControls ? (
        <div className="rounded-xl border border-border/25 bg-muted/10 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Access summary
              </p>
              <p
                className={cn(
                  k.muted,
                  "mt-0.5 text-xs leading-5 wrap-break-word"
                )}
              >
                {accessSummary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="kb-ingest-preset-open"
                className={cn("text-xs", k.duoToneHoverStrong)}
                onClick={() => applySecurityPreset("internal")}
              >
                Open to stream
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="kb-ingest-preset-legal-only"
                className={cn("text-xs", k.duoToneHoverStrong)}
                onClick={() =>
                  applySecurityPreset("privileged", "department:legal")
                }
              >
                Legal only
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Classification
            </label>
            <Select
              value={form.classification}
              onValueChange={value =>
                setForm(f => ({
                  ...f,
                  classification: value as DocumentClassification,
                }))
              }
            >
              <SelectTrigger
                className={cn("h-10 bg-background", k.duoToneField)}
              >
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATION_OPTIONS.map(option => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={k.duoToneSelectItem}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className={cn(k.muted, "text-xs leading-5")}>
              {classification.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Allowed groups
              </label>
              <Input
                data-testid="kb-ingest-allowed-groups"
                value={form.allowedGroups}
                onChange={e =>
                  setForm(f => ({ ...f, allowedGroups: e.target.value }))
                }
                placeholder="e.g. department:legal, role:manager"
                className={cn("h-10 bg-background", k.duoToneField)}
              />
              <p className={cn(k.muted, "text-xs leading-5")}>
                Leave blank to use the stream default.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Denied groups
              </label>
              <Input
                value={form.deniedGroups}
                onChange={e =>
                  setForm(f => ({ ...f, deniedGroups: e.target.value }))
                }
                placeholder="e.g. role:viewer"
                className={cn("h-10 bg-background", k.duoToneField)}
              />
              <p className={cn(k.muted, "text-xs leading-5")}>
                Deny rules win if someone matches both lists.
              </p>
            </div>
          </div>

          {currentUserId && (isSensitive || hasCustomAccessRules) && (
            <div className={cn(k.inset, "space-y-1.5 p-2.5")}>
              <p className="text-xs font-semibold text-foreground">
                Current rule
              </p>
              <p className={cn(k.muted, "text-xs leading-5 wrap-break-word")}>
                {accessSummary}
              </p>
              <p className={cn(k.muted, "text-xs leading-5")}>
                <span className="font-semibold text-foreground">You</span> stay
                on the allow-list for review.
              </p>
            </div>
          )}

          {needsAllowList && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-primary">
                Add an allow-list before indexing
              </p>
              <p
                className={cn(
                  k.muted,
                  "mt-1 text-xs leading-5 text-primary/80"
                )}
              >
                Sensitive content is safer with an allowed group such as{" "}
                <span className="font-mono text-foreground">
                  department:legal
                </span>
                .
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── File input section ───────────────────────────────────────────────────────

function FileInputSection({
  files,
  setFiles,
  maxFileSizeBytes,
  disabled,
  hasAnalysis,
  onReset,
  onAnalyzeAll,
  onAnalyzeFiles,
  canAnalyze,
}: {
  files: SelectedFile[];
  setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
  maxFileSizeBytes: number;
  disabled: boolean;
  hasAnalysis: boolean;
  onReset: () => void;
  onAnalyzeAll: () => void;
  onAnalyzeFiles: (fileIds: string[]) => void;
  canAnalyze: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const totalSize = files.reduce((sum, file) => sum + file.file.size, 0);

  const removeFile = (fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setFiles(prev => prev.filter(file => file.id !== fileId));
    if (hasAnalysis) onReset();
  };

  const removeSelected = () => {
    setFiles(prev => prev.filter(file => !selectedIds.has(file.id)));
    setSelectedIds(new Set());
    if (hasAnalysis) onReset();
  };

  const toggleSelected = (fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const readyCount = files.filter(f => f.status === "ready").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const readyIds = files
    .filter(file => file.status === "ready")
    .map(file => file.id);
  const selectedReadyIds = Array.from(selectedIds).filter(id =>
    readyIds.includes(id)
  );
  const allReadySelected =
    readyIds.length > 0 && selectedReadyIds.length === readyIds.length;

  return (
    <div className="space-y-4">
      <FileDropZone
        files={files}
        onFilesSelected={newFiles => {
          setFiles(prev => [...prev, ...newFiles]);
          setSelectedIds(new Set());
          if (hasAnalysis) onReset();
        }}
        onRemoveFile={idx => removeFile(files[idx]!.id)}
        disabled={disabled}
        hideFileList
        maxFileSizeBytes={maxFileSizeBytes}
      />

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className={cn(k.caption, "font-semibold text-foreground")}>
                Files in queue
              </span>
              <div className="flex items-center gap-1">
                {readyCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0 gap-0.5 text-muted-foreground"
                  >
                    {readyCount} ready
                  </Badge>
                )}
                {uploadingCount > 0 && (
                  <Badge
                    variant="default"
                    className="text-xs px-1.5 py-0 gap-0.5 bg-blue-500/15 text-blue-600 border-blue-500/20"
                  >
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />{" "}
                    {uploadingCount}
                  </Badge>
                )}
                {successCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0 gap-0.5 text-primary border-primary/20"
                  >
                    <CheckCircle className="w-2.5 h-2.5" /> {successCount}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0 gap-0.5 text-red-500 border-red-500/20"
                  >
                    <XCircle className="w-2.5 h-2.5" /> {errorCount}
                  </Badge>
                )}
              </div>
            </div>
            <span className={cn(k.muted, "text-xs tabular-nums")}>
              {files.length} file{files.length !== 1 ? "s" : ""} ·{" "}
              {formatFileSize(totalSize)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/25 bg-muted/10 px-3 py-2.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    allReadySelected ? new Set() : new Set(readyIds)
                  )
                }
                className="text-xs font-semibold text-primary/80 kb-duotone-text-hover transition-colors"
              >
                {allReadySelected ? "Clear selection" : "Select all ready"}
              </button>
              {selectedReadyIds.length > 0 && (
                <span className={cn(k.muted, "text-xs")}>
                  {selectedReadyIds.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeSelected}
                  disabled={disabled}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove selected
                </Button>
              )}
              {selectedReadyIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAnalyzeFiles(selectedReadyIds)}
                  disabled={disabled}
                  className="gap-1.5"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Check selected
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={onAnalyzeAll}
                disabled={!canAnalyze || disabled}
                className="gap-1.5"
              >
                {disabled ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                Check all
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {files.map(f => {
              const fi = getFileIcon(f.file.name);
              const Icon = fi.icon;
              const isSelected = selectedIds.has(f.id);
              const isReady = f.status === "ready";

              return (
                <div
                  key={f.id}
                  className={cn(
                    "rounded-lg border transition-all",
                    isSelected &&
                      isReady &&
                      "ring-1 ring-primary/20 border-primary/30",
                    f.status === "error"
                      ? "border-red-500/20 bg-red-500/5"
                      : f.status === "success"
                        ? "border-primary/20 bg-primary/5"
                        : f.status === "uploading"
                          ? "border-blue-500/20 bg-blue-500/5"
                          : "border-border/25 bg-card kb-duotone-border-hover"
                  )}
                >
                  <div className="flex items-center gap-2.5 px-3 py-2 group">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isReady || disabled}
                      onChange={() => toggleSelected(f.id)}
                      className="h-4 w-4 rounded border-border/40 bg-background text-primary focus:ring-primary/30"
                    />

                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                        fi.bg
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", fi.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {f.file.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(k.muted, "text-xs")}>
                          {formatFileSize(f.file.size)}
                        </span>
                        {f.error && (
                          <span className="text-xs text-red-500">
                            · {f.error}
                          </span>
                        )}
                        {f.status === "uploading" && (
                          <span className="text-xs text-blue-500 flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />{" "}
                            uploading…
                          </span>
                        )}
                        {f.status === "success" && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> done
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {isReady && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAnalyzeFiles([f.id])}
                          disabled={disabled}
                          className="h-8 gap-1 px-2"
                        >
                          <ArrowRight className="h-3 w-3" />
                          Check
                        </Button>
                      )}

                      {f.status !== "uploading" && (
                        <button
                          type="button"
                          onClick={() => removeFile(f.id)}
                          className="p-1 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className={cn(k.muted, "px-1 text-xs leading-5")}>
            Use the queue to process one PDF at a time or select multiple files
            for a bulk check. Shared document settings apply to the files you
            check next.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Text input section ───────────────────────────────────────────────────────

function TextInputSection({
  form,
  setForm,
  hasAnalysis,
  onReset,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  hasAnalysis: boolean;
  onReset: () => void;
}) {
  const wordCount = form.content.trim()
    ? form.content.trim().split(/\s+/).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Document content
          </p>
          <p className={cn(k.muted, "mt-1 max-w-2xl leading-5")}>
            Paste the exact copy you want reviewed. Keeping it focused on one
            policy, article, or SOP usually produces cleaner results.
          </p>
        </div>
      </div>

      <textarea
        data-testid="kb-ingest-textarea"
        value={form.content}
        onChange={e => {
          setForm((f: any) => ({ ...f, content: e.target.value }));
          if (hasAnalysis) onReset();
        }}
        placeholder={
          "Paste your document content here…\n\nSOPs, policies, FAQs, runbooks, training materials…"
        }
        className={cn(
          "w-full min-h-88 px-4 py-4 text-sm leading-relaxed rounded-2xl resize-none",
          "bg-muted/10 border border-border/30",
          "text-foreground placeholder:text-muted-foreground/40",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30",
          "transition-all"
        )}
        autoFocus
      />
      {form.content.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-between px-1",
            k.muted,
            "text-xs"
          )}
        >
          <span>{wordCount} words</span>
          <span>{form.content.length.toLocaleString()} characters</span>
        </div>
      )}
    </div>
  );
}

// ── URL input section ────────────────────────────────────────────────────────

function UrlInputSection({
  form,
  setForm,
  onAnalyze,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Page link
        </p>
        <p className={cn(k.muted, "max-w-2xl leading-5")}>
          Use a direct article or documentation URL. We will read the page and
          present the results back to you before anything is added.
        </p>
      </div>

      <div className="rounded-2xl border border-border/30 bg-muted/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Web address
            </p>
            <Input
              value={form.url}
              onChange={e =>
                setForm((f: any) => ({ ...f, url: e.target.value }))
              }
              placeholder="https://docs.example.com/article"
              className="mt-2 h-11"
              onKeyDown={e => e.key === "Enter" && onAnalyze()}
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className={cn(k.inset, "flex items-start gap-3 p-4")}>
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className={cn(k.muted, "leading-5")}>
          The page content will be checked for quality, relevance, and safety
          before it reaches the domain library.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — ANALYZING
// ══════════════════════════════════════════════════════════════════════════════

function AnalyzingPhase({
  pipeline,
}: {
  pipeline: ReturnType<typeof useIngestPipeline>;
}) {
  const { stages } = pipeline;

  return (
    <div className={cn(k.card, "p-8")}>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Checking your content
        </h3>
        <p className={cn(k.muted, "mt-1")}>
          This usually takes a few seconds. Nothing is added yet.
        </p>
      </div>

      <div className="space-y-3 max-w-md mx-auto">
        {ANALYSIS_STAGES.map((stage, i) => {
          const status = stages[i];
          const Icon = stage.icon;
          const isDone = status === "done";
          const isActive = status === "active";
          const isRejected = status === "rejected";
          const isIdle = status === "idle";

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3, ease: EASE }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
                isDone && "border-emerald-500/20 bg-emerald-500/4",
                isActive &&
                  "border-primary/30 bg-primary/8 ring-1 ring-primary/15",
                isRejected && "border-red-500/20 bg-red-500/4",
                isIdle && "border-border/25 opacity-40"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  isDone && "bg-emerald-500/15",
                  isActive && "bg-primary/15",
                  isRejected && "bg-red-500/15",
                  isIdle && "bg-muted"
                )}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : isRejected ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Icon className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isDone && "text-emerald-700 dark:text-emerald-400",
                    isActive && "text-primary",
                    isRejected && "text-red-600 dark:text-red-400",
                    isIdle && "text-muted-foreground/60"
                  )}
                >
                  {isActive ? stage.activeLabel : stage.label}
                </p>
                <p className={cn(k.muted, "text-xs")}>{stage.desc}</p>
              </div>
              {isDone && (
                <Badge variant="success" className="text-xs shrink-0">
                  Done
                </Badge>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <p className={cn(k.muted, "text-xs animate-pulse")}>
          {stages.filter(s => s === "done").length} of {ANALYSIS_STAGES.length}{" "}
          stages complete
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — REVIEW (Report Card)
// ══════════════════════════════════════════════════════════════════════════════

function ReviewPhase({
  pipeline,
  showAccessControls,
  showTags,
}: {
  pipeline: ReturnType<typeof useIngestPipeline>;
  showAccessControls: boolean;
  showTags: boolean;
}) {
  const {
    mode,
    form,
    setForm,
    files,
    analysis,
    handleIngest,
    handleRedactAndIngest,
    handleAnalyze,
    startFresh,
    isIngesting,
    isRedacting,
    isAnalyzing,
    hasCriticalPII,
    batchSummary,
    uploadableFiles,
    toggleFileApproval,
  } = pipeline;

  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [dupeOverride, setDupeOverride] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const isBatch = batchSummary != null && batchSummary.total > 1;
  const selectedFile = useMemo(
    () =>
      selectedFileId
        ? (files.find(f => f.id === selectedFileId) ?? null)
        : null,
    [files, selectedFileId]
  );

  if (!analysis) return null;

  const { validate, interpret, decide } = analysis;
  const confidence = Math.round(analysis.overallConfidence * 100);
  const relevance = Math.round(decide.relevanceScore * 100);
  const quality = Math.round(validate.qualityScore);
  const hasPII = validate.piiDetected;
  const contactInfoCategories = validate.contactInfoCategories ?? [];
  const hasContactInfo =
    validate.contactInfoDetected === true && contactInfoCategories.length > 0;
  const hasDupes = (decide.duplicates?.length ?? 0) > 0;
  const hasExactDupe =
    decide.duplicates?.some(d => d.matchType === "exact") ?? false;
  const hasLowQuality = validate.qualityScore !== undefined && quality < 40;
  const duplicatePreview = decide.duplicates
    .slice(0, 2)
    .map(d => `“${d.title}”`)
    .join(", ");
  const classification = getClassificationDetails(form.classification);
  const accessSummary = summarizeAccessPolicy(form);
  const missingAclForSensitiveDoc =
    showAccessControls &&
    (form.classification === "restricted" ||
      form.classification === "privileged") &&
    parsePrincipalList(form.allowedGroups).length === 0;

  const recMap: Record<
    string,
    {
      label: string;
      color: string;
      bg: string;
      icon: LucideIcon;
    }
  > = {
    ingest: {
      label: "Looks good to add",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      icon: CheckCircle,
    },
    review: {
      label: "Please review before adding",
      color: "text-primary",
      bg: "bg-primary/10",
      icon: AlertTriangle,
    },
    reject: {
      label: "Do not add this yet",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      icon: XCircle,
    },
  };
  const recCfg = recMap[decide.recommendation] ?? {
    label: "Unknown",
    color: "text-muted-foreground",
    bg: "bg-muted",
    icon: Eye,
  };
  const batchRecCfg =
    isBatch && batchSummary
      ? uploadableFiles.length === 0
        ? {
            label: "No files are ready to add",
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-500/10",
            icon: XCircle,
            reasoning:
              "Every analyzed file is currently excluded. Re-include a reviewed file or start over with different content.",
          }
        : batchSummary.flagged > 0 || batchSummary.rejected > 0
          ? {
              label: "Some files need review before upload",
              color: "text-primary",
              bg: "bg-primary/10",
              icon: AlertTriangle,
              reasoning: `${uploadableFiles.length} of ${batchSummary.total} files are approved for upload. Excluded files will stay out of this run unless you re-include them.`,
            }
          : {
              label: "All files are ready to add",
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-500/10",
              icon: CheckCircle,
              reasoning: `All ${batchSummary.total} analyzed files are approved for upload.`,
            }
      : null;
  const activeRecCfg = batchRecCfg ?? recCfg;
  const RecIcon = activeRecCfg.icon;

  return (
    <div className="space-y-4">
      <div className={cn(k.card, "p-6")}>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              activeRecCfg.bg
            )}
          >
            <RecIcon className={cn("w-5 h-5", activeRecCfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              {isBatch ? "Batch review" : "Our recommendation"}
            </p>
            <h3 className={cn("text-lg font-bold mt-1", activeRecCfg.color)}>
              {activeRecCfg.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              {batchRecCfg?.reasoning ?? decide.reasoning}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {isBatch && batchSummary ? (
                <>
                  <StatPill
                    label="Approved"
                    value={`${uploadableFiles.length}/${batchSummary.total}`}
                  />
                  <StatPill label="Flagged" value={`${batchSummary.flagged}`} />
                  <StatPill
                    label="Rejected"
                    value={`${batchSummary.rejected}`}
                  />
                </>
              ) : (
                <>
                  <StatPill label="How sure" value={`${confidence}%`} />
                  <StatPill label="Fit" value={`${relevance}%`} />
                  <StatPill label="Quality" value={`${quality}/100`} />
                  {showAccessControls ? (
                    <StatPill label="Protection" value={classification.label} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Extracted metadata (auto-detected from document content) ── */}
      {!isBatch &&
        interpret.extractedMetadata &&
        (interpret.extractedMetadata.sourceId ||
          interpret.extractedMetadata.detectedTitle ||
          interpret.extractedMetadata.sourceUrl) && (
          <div className={cn(k.card, "p-4")}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h4 className={cn(k.heading, "font-semibold")}>
                Detected metadata
              </h4>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Auto
              </span>
            </div>
            <div className="space-y-1.5">
              {interpret.extractedMetadata.sourceId && (
                <DetailRow
                  label="Source ID"
                  value={interpret.extractedMetadata.sourceId}
                />
              )}
              {interpret.extractedMetadata.sourceSystem && (
                <DetailRow
                  label="Source system"
                  value={interpret.extractedMetadata.sourceSystem}
                />
              )}
              {interpret.extractedMetadata.detectedTitle && (
                <DetailRow
                  label="Title (from content)"
                  value={
                    interpret.extractedMetadata.detectedTitle.length > 60
                      ? interpret.extractedMetadata.detectedTitle.slice(0, 57) +
                        "…"
                      : interpret.extractedMetadata.detectedTitle
                  }
                />
              )}
              {interpret.extractedMetadata.environment && (
                <DetailRow
                  label="Environment"
                  value={interpret.extractedMetadata.environment}
                />
              )}
              {interpret.extractedMetadata.systemName && (
                <DetailRow
                  label="System"
                  value={interpret.extractedMetadata.systemName}
                />
              )}
              {interpret.extractedMetadata.sourceUrl && (
                <div className="flex items-center justify-between">
                  <span className={cn(k.muted, "text-xs")}>Source URL</span>
                  <a
                    href={interpret.extractedMetadata.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 truncate max-w-[60%]"
                  >
                    {interpret.extractedMetadata.sourceSystem || "Open"}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
              {interpret.extractedMetadata.author && (
                <DetailRow
                  label="Author"
                  value={interpret.extractedMetadata.author}
                />
              )}
              {interpret.extractedMetadata.publishDate && (
                <DetailRow
                  label="Date"
                  value={interpret.extractedMetadata.publishDate}
                />
              )}
              {interpret.extractedMetadata.version && (
                <DetailRow
                  label="Version"
                  value={interpret.extractedMetadata.version}
                />
              )}
              {interpret.extractedMetadata.sectionsFound.length > 0 && (
                <div className="pt-1">
                  <p className={cn(k.label, "text-xs mb-1")}>
                    Document sections
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {interpret.extractedMetadata.sectionsFound.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* ── Bento layout: batch vs single-file ── */}
      {isBatch && batchSummary ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* ── Left: Batch overview ── */}
          <div className={cn(k.card, "p-5 lg:col-span-2 space-y-4")}>
            <p className={cn(k.label)}>{batchSummary.total} files analyzed</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-2.5">
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {batchSummary.passed}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600/80 dark:text-emerald-400/80">
                  Pass
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-primary/5 border border-primary/15 p-2.5">
                <span className="text-xl font-extrabold text-primary tabular-nums">
                  {batchSummary.flagged}
                </span>
                <span className="text-[10px] font-semibold text-primary/80">
                  Flag
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-red-500/5 border border-red-500/15 p-2.5">
                <span className="text-xl font-extrabold text-destructive tabular-nums">
                  {batchSummary.rejected}
                </span>
                <span className="text-[10px] font-semibold text-destructive/80">
                  Reject
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <DetailRow
                label="Avg quality"
                value={`${Math.round(batchSummary.avgQuality)}/100`}
              />
              <DetailRow
                label="Avg confidence"
                value={`${Math.round(batchSummary.avgConfidence * 100)}%`}
              />
              <DetailRow
                label="Avg relevance"
                value={`${Math.round(batchSummary.avgRelevance * 100)}%`}
              />
            </div>
            {(batchSummary.piiFileCount > 0 ||
              batchSummary.duplicateFileCount > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {batchSummary.piiFileCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    {batchSummary.piiFileCount} with PII
                  </Badge>
                )}
                {batchSummary.duplicateFileCount > 0 && (
                  <Badge variant="warning" className="text-xs">
                    {batchSummary.duplicateFileCount} duplicate
                    {batchSummary.duplicateFileCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">
              <strong>{uploadableFiles.length}</strong> of {batchSummary.total}{" "}
              will be uploaded.
            </p>
          </div>

          {/* ── Right: File inspector ── */}
          <div
            className={cn(
              k.card,
              "lg:col-span-3 overflow-hidden flex flex-col"
            )}
          >
            <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
              <p className={cn(k.label)}>Files</p>
              {selectedFileId && (
                <button
                  type="button"
                  onClick={() => setSelectedFileId(null)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-52 divide-y divide-border/30">
              {files
                .filter(f => f.analysisStatus)
                .map(f => {
                  const q = f.analysis?.validate.qualityScore;
                  const isSelected = selectedFileId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setSelectedFileId(isSelected ? null : f.id)
                      }
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors",
                        isSelected
                          ? "bg-primary/5 border-l-2 border-primary"
                          : "hover:bg-muted/50 border-l-2 border-transparent"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          f.analysisStatus === "passed" && "bg-emerald-500",
                          f.analysisStatus === "flagged" && "bg-primary/80",
                          f.analysisStatus === "rejected" && "bg-red-500",
                          f.analysisStatus === "error" && "bg-red-500",
                          (f.analysisStatus === "pending" ||
                            f.analysisStatus === "analyzing") &&
                            "bg-muted-foreground/30"
                        )}
                      />
                      <span className="flex-1 truncate font-medium text-foreground">
                        {f.file.name}
                      </span>
                      {q != null && (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {Math.round(q)}
                        </span>
                      )}
                      {(f.analysisStatus === "flagged" ||
                        f.analysisStatus === "rejected") && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => {
                            e.stopPropagation();
                            toggleFileApproval(f.id);
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              toggleFileApproval(f.id);
                            }
                          }}
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors",
                            f.analysisStatus === "flagged"
                              ? "text-primary bg-primary/10 hover:bg-primary/20"
                              : "text-red-700 bg-red-500/10 hover:bg-red-500/20"
                          )}
                        >
                          {f.analysisStatus === "flagged"
                            ? "Exclude"
                            : "Include"}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* ── Selected file detail ── */}
            {selectedFile?.analysis && (
              <div className="border-t border-border/40 p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0",
                        selectedFile.analysisStatus === "passed" &&
                          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        selectedFile.analysisStatus === "flagged" &&
                          "bg-primary/10 text-primary",
                        selectedFile.analysisStatus === "rejected" &&
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {selectedFile.analysisStatus}
                    </span>
                    <h4 className="text-sm font-semibold truncate">
                      {selectedFile.file.name}
                    </h4>
                  </div>
                  {(selectedFile.analysisStatus === "flagged" ||
                    selectedFile.analysisStatus === "rejected") && (
                    <button
                      type="button"
                      onClick={() => toggleFileApproval(selectedFile.id)}
                      className={cn(
                        "text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0",
                        selectedFile.analysisStatus === "flagged"
                          ? "text-primary bg-primary/10 hover:bg-primary/20"
                          : "text-red-700 bg-red-500/10 hover:bg-red-500/20"
                      )}
                    >
                      {selectedFile.analysisStatus === "flagged"
                        ? "Exclude"
                        : "Include"}
                    </button>
                  )}
                </div>

                {selectedFile.analysisNote && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedFile.analysisNote}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      v: Math.round(
                        selectedFile.analysis.validate.qualityScore
                      ),
                      l: "Quality",
                      s: "/100",
                    },
                    {
                      v: Math.round(
                        selectedFile.analysis.overallConfidence * 100
                      ),
                      l: "Confidence",
                      s: "%",
                    },
                    {
                      v: Math.round(
                        selectedFile.analysis.decide.relevanceScore * 100
                      ),
                      l: "Relevance",
                      s: "%",
                    },
                  ].map(m => (
                    <div
                      key={m.l}
                      className="text-center rounded-lg bg-background/60 py-1.5"
                    >
                      <div className="text-base font-bold text-foreground tabular-nums">
                        {m.v}
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {m.s}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.l}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <DetailRow
                    label="Type"
                    value={
                      selectedFile.analysis.interpret.detectedType || "General"
                    }
                  />
                  <DetailRow
                    label="Team"
                    value={selectedFile.analysis.interpret.department || "—"}
                  />
                  <DetailRow
                    label="Words"
                    value={selectedFile.analysis.validate.wordCount.toLocaleString()}
                  />
                  {selectedFile.analysis.validate.piiDetected && (
                    <DetailRow
                      label="PII"
                      value={selectedFile.analysis.validate.piiCategories.join(
                        ", "
                      )}
                      valueColor="text-red-500"
                    />
                  )}
                  {selectedFile.analysis.decide.duplicates.length > 0 && (
                    <DetailRow
                      label="Duplicates"
                      value={`${selectedFile.analysis.decide.duplicates.length} match${selectedFile.analysis.decide.duplicates.length > 1 ? "es" : ""}`}
                      valueColor="text-primary"
                    />
                  )}
                  {selectedFile.analysis.validate.issues.length > 0 && (
                    <div className="pt-1">
                      <p className={cn(k.label, "text-xs mb-1")}>Issues</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedFile.analysis.validate.issues
                          .slice(0, 3)
                          .map((issue, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {issue}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Per-file extracted metadata */}
                {selectedFile.analysis.interpret.extractedMetadata &&
                  (selectedFile.analysis.interpret.extractedMetadata.sourceId ||
                    selectedFile.analysis.interpret.extractedMetadata
                      .detectedTitle) && (
                    <div className="space-y-1.5 border-t border-border/30 pt-2">
                      <p className={cn(k.label, "text-xs")}>
                        Detected metadata
                      </p>
                      {selectedFile.analysis.interpret.extractedMetadata
                        .sourceId && (
                        <DetailRow
                          label="Source ID"
                          value={
                            selectedFile.analysis.interpret.extractedMetadata
                              .sourceId
                          }
                        />
                      )}
                      {selectedFile.analysis.interpret.extractedMetadata
                        .detectedTitle && (
                        <DetailRow
                          label="Title"
                          value={
                            selectedFile.analysis.interpret.extractedMetadata
                              .detectedTitle.length > 50
                              ? selectedFile.analysis.interpret.extractedMetadata.detectedTitle.slice(
                                  0,
                                  47
                                ) + "…"
                              : selectedFile.analysis.interpret
                                  .extractedMetadata.detectedTitle
                          }
                        />
                      )}
                      {selectedFile.analysis.interpret.extractedMetadata
                        .environment && (
                        <DetailRow
                          label="Environment"
                          value={
                            selectedFile.analysis.interpret.extractedMetadata
                              .environment
                          }
                        />
                      )}
                      {selectedFile.analysis.interpret.extractedMetadata
                        .systemName && (
                        <DetailRow
                          label="System"
                          value={
                            selectedFile.analysis.interpret.extractedMetadata
                              .systemName
                          }
                        />
                      )}
                    </div>
                  )}

                {selectedFile.analysis.decide.reasoning && (
                  <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-2">
                    {selectedFile.analysis.decide.reasoning}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Single-file: warnings + metadata + summary + edit ── */}
          {(hasPII ||
            hasDupes ||
            hasLowQuality ||
            missingAclForSensitiveDoc ||
            validate.issues.length > 0) && (
            <div
              className={cn(
                k.card,
                "p-4 border",
                hasCriticalPII
                  ? "border-red-500/20 bg-red-500/3"
                  : "border-primary/15 bg-primary/3"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={cn(
                    "w-5 h-5 mt-0.5 shrink-0",
                    hasCriticalPII ? "text-red-500" : "text-primary"
                  )}
                />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    Things to check before adding
                  </h4>
                  <div className="mt-2 space-y-2">
                    {hasPII && (
                      <p className="text-sm text-foreground/85">
                        {hasCriticalPII
                          ? "Sensitive personal information was found and must be removed before this can be added."
                          : "Personal information was found. Review it carefully before adding."}
                        {validate.piiCategories.length > 0 &&
                          ` Found: ${validate.piiCategories.join(", ")}.`}
                      </p>
                    )}
                    {hasDupes && (
                      <p className="text-sm text-foreground/85">
                        {hasExactDupe
                          ? "This file is an exact duplicate of content already in the domain library"
                          : "This looks similar to content already in the domain library"}
                        {duplicatePreview
                          ? `, including ${duplicatePreview}`
                          : ""}
                        .
                        {decide.duplicates.length > 2 &&
                          ` and ${decide.duplicates.length - 2} more.`}
                      </p>
                    )}
                    {hasLowQuality && (
                      <p className="text-sm text-foreground/85">
                        The content quality looks low, so answers may be
                        incomplete or hard to trust without edits.
                      </p>
                    )}
                    {missingAclForSensitiveDoc && (
                      <p className="text-sm text-foreground/85">
                        This document is marked{" "}
                        {classification.label.toLowerCase()}, but it still uses
                        normal domain access. Add an allow-list before indexing
                        legal or restricted content.
                      </p>
                    )}
                    {validate.issues.slice(0, 3).map((issue, i) => (
                      <p key={i} className="text-sm text-foreground/85">
                        {issue}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasContactInfo && !hasPII && (
            <div
              data-testid="kb-ingest-routine-contact-card"
              className={cn(
                k.card,
                "p-4 border border-primary/15 bg-primary/3"
              )}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    Routine contact details found
                  </h4>
                  <p className={cn(k.muted, "mt-1 leading-5")}>
                    {contactInfoCategories.join(", ")} were detected, but they
                    are treated as routine contact details here, not sensitive
                    personal data. They will not block ingestion.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={cn(k.card, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className={cn(k.heading, "font-semibold")}>
                  What we found
                </h4>
              </div>
              <div className="space-y-2">
                <DetailRow
                  label="Type"
                  value={interpret.detectedType || "General"}
                />
                <DetailRow label="Team" value={interpret.department || "—"} />
                <DetailRow label="Language" value={interpret.language || "—"} />
                <DetailRow
                  label="Length"
                  value={`${validate.wordCount.toLocaleString()} words`}
                />
              </div>
            </div>

            <div className={cn(k.card, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h4 className={cn(k.heading, "font-semibold")}>
                  Before you add it
                </h4>
              </div>
              <div className="space-y-2">
                <DetailRow
                  label="Classification"
                  value={classification.label}
                />
                {showAccessControls ? (
                  <DetailRow
                    label="Access"
                    value={accessSummary}
                    valueColor="text-foreground"
                  />
                ) : null}
                <DetailRow
                  label="Sensitive info"
                  value={hasPII ? "Needs review" : "Not found"}
                  valueColor={hasPII ? "text-red-500" : "text-emerald-500"}
                />
                {hasContactInfo && (
                  <DetailRow
                    label="Contact details"
                    value={contactInfoCategories.join(", ")}
                    valueColor="text-primary"
                  />
                )}
                <DetailRow
                  label="Similar content"
                  value={
                    hasDupes
                      ? `${decide.duplicates.length} possible match${decide.duplicates.length > 1 ? "es" : ""}`
                      : "None found"
                  }
                  valueColor={hasDupes ? "text-primary" : "text-emerald-500"}
                />
                <DetailRow label="How sure" value={`${confidence}%`} />
                <DetailRow label="Quality" value={`${quality}/100`} />
                <DetailRow label="Search fit" value={`${relevance}%`} />
                {showTags && interpret.tags.length > 0 && (
                  <div className="pt-1">
                    <p className={cn(k.label, "text-xs mb-1")}>
                      Suggested tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {interpret.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {interpret.summary && (
            <div className={cn(k.card, "p-4")}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className={cn(k.heading, "font-semibold")}>
                  Plain-language summary
                </h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {interpret.summary}
              </p>
            </div>
          )}

          {/* ── Edit before ingest (for "review" recommendation, text mode) ── */}
          {decide.recommendation === "review" && mode === "text" && (
            <div
              className={cn(k.card, "overflow-hidden border border-primary/15")}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/10">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Edit before adding
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Fix quality issues on a working copy — the original stays
                      untouched until you approve.
                    </p>
                  </div>
                </div>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setEditDraft(form.content);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                    Open Editor
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={isAnalyzing}
                      onClick={() => {
                        setForm(prev => ({ ...prev, content: editDraft }));
                        setIsEditing(false);
                        // Re-analyze with updated content
                        setTimeout(() => handleAnalyze(), 0);
                      }}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Save &amp; Re-Analyze
                    </Button>
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Editing a working copy ·{" "}
                      {editDraft.split(/\s+/).filter(Boolean).length} words
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => setEditDraft(form.content)}
                    >
                      Reset to original
                    </button>
                  </div>
                  <textarea
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    className={cn(
                      k.input,
                      "min-h-50 max-h-100 text-sm leading-relaxed font-mono resize-y w-full"
                    )}
                  />
                  {validate.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {validate.issues.slice(0, 4).map((issue, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={startFresh} className="text-sm gap-2">
          <RotateCw className="w-4 h-4" />
          Start Over
        </Button>

        <div className="flex items-center gap-2">
          {isBatch && batchSummary ? (
            <Button
              data-testid="kb-ingest-submit"
              onClick={handleIngest}
              disabled={isIngesting || uploadableFiles.length === 0}
              size="lg"
              className="text-sm font-bold gap-2 min-w-50"
            >
              {isIngesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {uploadableFiles.length > 0
                ? `Add ${uploadableFiles.length} of ${batchSummary.total} to Domain`
                : "No files approved to add"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : decide.recommendation === "reject" ? (
            <Button
              variant="destructive"
              onClick={startFresh}
              className="text-sm gap-2"
            >
              <XCircle className="w-4 h-4" />
              Do Not Add This
            </Button>
          ) : hasExactDupe && !dupeOverride ? (
            <Button
              variant="outline"
              onClick={() => setDupeOverride(true)}
              size="lg"
              className="text-sm font-bold gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <AlertTriangle className="w-4 h-4" />
              This exact file already exists — Add anyway?
            </Button>
          ) : hasPII ? (
            <>
              <Button
                onClick={handleRedactAndIngest}
                disabled={isRedacting || isIngesting}
                size="lg"
                className="text-sm font-bold gap-2 min-w-50"
              >
                {isRedacting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Remove Sensitive Info &amp; Add
                <ArrowRight className="w-4 h-4" />
              </Button>
              {!hasCriticalPII && (
                <Button
                  variant="outline"
                  onClick={handleIngest}
                  disabled={isIngesting || isRedacting}
                  size="lg"
                  className="text-sm gap-2"
                >
                  {isIngesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  Add Anyway
                </Button>
              )}
            </>
          ) : (
            <Button
              data-testid="kb-ingest-submit"
              onClick={handleIngest}
              disabled={isIngesting}
              size="lg"
              className="text-sm font-bold gap-2 min-w-50"
            >
              {isIngesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Add to Domain
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — PROCESSING
// ══════════════════════════════════════════════════════════════════════════════

function ProcessingPhase({
  pipeline,
}: {
  pipeline: ReturnType<typeof useIngestPipeline>;
}) {
  const { mode, files } = pipeline;

  // Elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmtTime =
    elapsed < 60
      ? `${elapsed}s`
      : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  // Per-file progress for multi-file uploads
  const isFileMode = mode === "file" && files.length > 0;
  const doneCount = files.filter(f => f.status === "success").length;
  const errCount = files.filter(f => f.status === "error").length;
  const totalCount = files.length;
  const educationalSteps = KNOWLEDGE_PIPELINE_STAGES.filter(
    stage => stage !== "completed"
  );

  return (
    <div className={cn(k.card, "p-8")}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Database className="w-7 h-7 text-primary animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Adding your content
        </h3>
        <p className={cn(k.muted, "mt-1")}>
          {mode === "file"
            ? "We’re preparing your files so people can search them."
            : mode === "url"
              ? "We’re reading the page and preparing it for search."
              : "We’re preparing this content so people can search it."}
        </p>
        <p className={cn(k.muted, "text-xs mt-1 tabular-nums")}>
          Time so far: {fmtTime}
        </p>
      </div>

      {/* Per-file progress for multi-file uploads */}
      {isFileMode && (
        <div className="mt-6 max-w-sm mx-auto">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  errCount > 0 ? "bg-primary/80" : "bg-primary"
                )}
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.round(((doneCount + errCount) / totalCount) * 100)}%`,
                }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {doneCount + errCount}/{totalCount}
            </span>
          </div>

          {/* File list with status */}
          <div className="space-y-1.5">
            {files.map((f, i) => {
              const fi = getFileIcon(f.file.name);
              const FIcon = fi.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all",
                    f.status === "success" &&
                      "border-emerald-500/20 bg-emerald-500/4",
                    f.status === "error" && "border-red-500/20 bg-red-500/4",
                    f.status === "uploading" &&
                      "border-primary/20 bg-primary/8",
                    f.status === "ready" && "border-border/40 opacity-40"
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded flex items-center justify-center shrink-0",
                      fi.bg
                    )}
                  >
                    <FIcon className={cn("w-3.5 h-3.5", fi.color)} />
                  </div>
                  <span className="text-xs font-medium text-foreground truncate flex-1">
                    {f.file.name}
                  </span>
                  {f.status === "uploading" && (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  )}
                  {f.status === "success" && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  {f.status === "error" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs text-red-500 max-w-24 truncate">
                        {(f as any).error
                          ? humanizeError((f as any).error)
                          : "Failed"}
                      </span>
                    </div>
                  )}
                  {f.status === "ready" && (
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generic pipeline stages for non-file modes */}
      {!isFileMode && (
        <div className="mt-6 max-w-sm mx-auto space-y-3">
          {educationalSteps.map((stage, i) => (
            <div key={stage} className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.3, duration: 0.2 }}
              >
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </motion.div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {PIPELINE_STAGE_COPY[stage].fullLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PIPELINE_STAGE_COPY[stage].whyItMatters}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — COMPLETE
// ══════════════════════════════════════════════════════════════════════════════

function CompletePhase({
  pipeline,
  onNavigate,
  valueStreamId,
  showAccessControls,
}: {
  pipeline: ReturnType<typeof useIngestPipeline>;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
  valueStreamId?: string;
  showAccessControls: boolean;
}) {
  const {
    lastIngestResult,
    startFresh,
    syncTrackedIngest,
    markTrackedIngestManualCheck,
  } = pipeline;
  const trackedJobId = lastIngestResult?.jobId;
  const fallbackJobsQ = trpc.knowledge.listJobs.useQuery(
    valueStreamId ? { limit: 25, offset: 0, valueStreamId } : undefined,
    {
      enabled:
        Boolean(valueStreamId) && !trackedJobId && !!lastIngestResult?.title,
      retry: false,
      refetchInterval: query => {
        const title = lastIngestResult?.title;
        if (!title) return false;
        const jobs = query.state.data?.jobs ?? [];
        const match = jobs.find(job => job.title === title);
        if (!match) return JOB_WS_FALLBACK_POLL_MS;
        return ["completed", "failed"].includes(match.status)
          ? false
          : JOB_WS_FALLBACK_POLL_MS;
      },
      refetchOnWindowFocus: true,
    }
  );
  const jobDetailQ = trpc.knowledge.getJob.useQuery(
    valueStreamId
      ? { jobId: trackedJobId ?? "", valueStreamId }
      : { jobId: trackedJobId ?? "" },
    {
      enabled: Boolean(trackedJobId && valueStreamId),
      retry: false,
      refetchInterval: query => {
        if (query.state.error) return false;
        const status =
          query.state.data?.job?.status ?? lastIngestResult?.status;
        return status &&
          ["completed", "failed", "manual_check"].includes(status)
          ? false
          : JOB_WS_FALLBACK_POLL_MS;
      },
      refetchOnWindowFocus: true,
    }
  );

  const suggestMut = trpc.gemini.suggestQuestions.useMutation();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const recoveredJob = useMemo(() => {
    const title = lastIngestResult?.title?.trim();
    if (trackedJobId || !title) return undefined;
    return fallbackJobsQ.data?.jobs.find(job => job.title === title);
  }, [fallbackJobsQ.data?.jobs, lastIngestResult?.title, trackedJobId]);
  const liveJob = jobDetailQ.data?.job ?? recoveredJob;
  const inferredLegacyComplete =
    !trackedJobId &&
    !recoveredJob &&
    (!!lastIngestResult?.documentId || (lastIngestResult?.chunkCount ?? 0) > 0);
  const isLegacyUntracked =
    !trackedJobId && !recoveredJob && !inferredLegacyComplete;
  const shouldEscalateToManualCheck =
    !!trackedJobId &&
    !liveJob &&
    jobDetailQ.isError &&
    jobDetailQ.failureCount >= 2 &&
    lastIngestResult?.status !== "manual_check";

  useEffect(() => {
    if (!shouldEscalateToManualCheck) return;
    markTrackedIngestManualCheck(jobDetailQ.error?.message);
  }, [
    shouldEscalateToManualCheck,
    markTrackedIngestManualCheck,
    jobDetailQ.error?.message,
  ]);

  const liveStatus =
    liveJob?.status ??
    lastIngestResult?.status ??
    (inferredLegacyComplete
      ? "completed"
      : isLegacyUntracked
        ? "manual_check"
        : trackedJobId
          ? "queued"
          : undefined);
  const isCompleted = liveStatus === "completed";
  const isFailed = liveStatus === "failed";
  const needsManualCheck = liveStatus === "manual_check";
  const openDocumentId = liveJob?.documentId || lastIngestResult?.documentId;
  const completedDocumentQ = trpc.knowledge.getDocument.useQuery(
    valueStreamId
      ? { documentId: openDocumentId ?? "", valueStreamId }
      : { documentId: openDocumentId ?? "" },
    {
      enabled: Boolean(isCompleted && valueStreamId && openDocumentId),
      retry: false,
      refetchOnWindowFocus: true,
    }
  );
  const completedClassification =
    liveJob?.classification ?? lastIngestResult?.classification ?? "internal";
  const completedAccessControl =
    liveJob?.accessControl ?? lastIngestResult?.accessControl;
  const completedClassificationMeta = getDocumentClassificationMeta(
    completedClassification
  );
  const completedAccessSummary = summarizeAccessControl(
    completedAccessControl,
    {
      emptyLabel: "Uses normal domain access",
      userLabels: pipeline.currentUserId
        ? { [pipeline.currentUserId]: "You" }
        : undefined,
    }
  );
  const isSensitiveResult = isSensitiveDocumentClassification(
    completedClassification
  );
  const resolvedTitle =
    liveJob?.title || lastIngestResult?.title || "this upload";
  const completedDocumentStatus: DocumentStatus | undefined = isCompleted
    ? (completedDocumentQ.data?.status ?? "pending_review")
    : undefined;
  const isSearchableResult = isSearchableDocumentStatus(
    completedDocumentStatus ?? ""
  );
  const completionState = isCompleted
    ? isSearchableResult
      ? "ready"
      : completedDocumentStatus === "archived"
        ? "archived"
        : "pending_review"
    : needsManualCheck
      ? "manual_check"
      : isFailed
        ? "failed"
        : "processing";
  const errorText = humanizePipelineError(
    liveJob?.error ?? (isFailed ? lastIngestResult?.message : undefined),
    liveJob?.failedAtStage
  );

  useEffect(() => {
    if (liveJob) syncTrackedIngest(liveJob);
  }, [liveJob, syncTrackedIngest]);

  useEffect(() => {
    if (!isCompleted || !resolvedTitle) {
      setSuggestions([]);
      return;
    }
    const content = lastIngestResult?.suggestionSeed || resolvedTitle;
    suggestMut.mutate(
      { title: resolvedTitle, content, count: 5, valueStreamId },
      { onSuccess: d => setSuggestions(d.questions) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCompleted,
    resolvedTitle,
    lastIngestResult?.suggestionSeed,
    valueStreamId,
  ]);

  const StatusIcon =
    completionState === "ready"
      ? CheckCircle
      : completionState === "pending_review"
        ? Gavel
        : completionState === "archived"
          ? BookOpen
          : needsManualCheck
            ? Workflow
            : isFailed
              ? AlertTriangle
              : Loader2;
  const statusIconClass =
    completionState === "ready"
      ? "text-emerald-500"
      : completionState === "pending_review"
        ? "text-primary"
        : completionState === "archived"
          ? "text-slate-500"
          : needsManualCheck
            ? "text-primary"
            : isFailed
              ? "text-red-500"
              : "text-primary animate-spin";
  const statusShellClass =
    completionState === "ready"
      ? "bg-emerald-500/15"
      : completionState === "pending_review"
        ? "bg-primary/12"
        : completionState === "archived"
          ? "bg-slate-500/12"
          : needsManualCheck
            ? "bg-primary/12"
            : isFailed
              ? "bg-red-500/12"
              : "bg-primary/10";
  const statusBadgeLabel =
    completionState === "ready"
      ? completedDocumentStatus === "published"
        ? "Published"
        : "Indexed"
      : completionState === "pending_review"
        ? "Waiting for review"
        : completionState === "archived"
          ? "Archived"
          : needsManualCheck
            ? "Needs a check"
            : isFailed
              ? "Not completed"
              : "In progress";
  const heading =
    completionState === "ready"
      ? "Added and ready to use"
      : completionState === "pending_review"
        ? "Added and waiting for review"
        : completionState === "archived"
          ? "Added, but not live"
          : needsManualCheck
            ? "Please check the status"
            : isFailed
              ? "We couldn’t add this yet"
              : "Still adding your content";
  const description =
    completionState === "ready"
      ? `“${resolvedTitle}” is ${completedDocumentStatus === "published" ? "published" : "indexed"} in this domain and ready to ground answers.`
      : completionState === "pending_review"
        ? `“${resolvedTitle}” was added to this domain, but it will not ground answers until a reviewer approves and publishes it.`
        : completionState === "archived"
          ? `“${resolvedTitle}” is archived right now, so it will not appear in grounded answers until it is restored.`
          : needsManualCheck
            ? trackedJobId
              ? `We could not confirm the latest status for “${resolvedTitle}”. Open Processing Status to see whether it finished or needs attention.`
              : `“${resolvedTitle}” was added before live tracking was available here. Open Processing Status to confirm the final result.`
            : isFailed
              ? `“${resolvedTitle}” stopped before it finished. Review the details below, then try again when you are ready.`
              : `“${resolvedTitle}” is still being prepared. It is not ready to use yet.`;
  const nextSteps =
    completionState === "ready"
      ? []
      : completionState === "pending_review"
        ? [
            "Open Review Queue to approve and publish this document.",
            "Use the Library to inspect the document while it waits for review.",
          ]
        : completionState === "archived"
          ? [
              "Open the Library to restore or update this document before using it in answers.",
            ]
          : needsManualCheck
            ? [
                "Open Processing Status and confirm whether this finished or failed.",
                "Do not test this content until the status is final.",
              ]
            : isFailed
              ? [
                  "Open Processing Status to see the full error details.",
                  "Fix the content or source issue, then try again.",
                ]
              : [
                  "You can leave this page and come back later.",
                  "Wait until the status changes before using this content in answers.",
                ];
  const navigateToDocument = () => {
    if (!onNavigate || !openDocumentId) return;
    try {
      window.sessionStorage.setItem("kb-focus-document-id", openDocumentId);
    } catch {
      /* noop */
    }
    onNavigate("library", openDocumentId);
  };

  return (
    <div className={cn(k.card, "p-8")}>
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
            statusShellClass
          )}
        >
          <StatusIcon className={cn("w-8 h-8", statusIconClass)} />
        </motion.div>

        <h3 className="text-xl font-bold text-foreground">{heading}</h3>
        <p className={cn(k.muted, "mt-2 max-w-2xl mx-auto")}>{description}</p>

        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              isCompleted &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              needsManualCheck &&
                "border-primary/25 bg-primary/10 text-primary",
              isFailed &&
                "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
              !isCompleted &&
                !needsManualCheck &&
                !isFailed &&
                "border-primary/20 kb-duotone-fill"
            )}
          >
            {statusBadgeLabel}
          </Badge>
        </div>

        {nextSteps.length > 0 && (
          <div className="mt-6 mx-auto max-w-2xl rounded-2xl border border-border/30 bg-muted/20 px-4 py-4 text-left">
            <p className="text-sm font-semibold text-foreground">
              What to do next
            </p>
            <div className="mt-3 space-y-2">
              {nextSteps.map(step => (
                <div key={step} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground/85">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isFailed && errorText && (
          <div className="mt-4 mx-auto max-w-2xl rounded-2xl border border-red-500/15 bg-red-500/4 px-4 py-3 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500/70">
              What Went Wrong
            </p>
            <p className="mt-2 text-sm text-foreground/85">{errorText}</p>
          </div>
        )}

        {jobDetailQ.isError && !isFailed && !needsManualCheck && (
          <div className="mt-4 mx-auto max-w-xl rounded-2xl border border-border/30 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Live status is temporarily unavailable. Use Processing Status if
            this page does not refresh.
          </div>
        )}

        {completionState === "ready" &&
          (suggestions.length > 0 || suggestMut.isPending) && (
            <div className="mt-6 text-left max-w-lg mx-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 text-center">
                {suggestMut.isPending
                  ? "Preparing sample questions..."
                  : "Try these questions"}
              </p>
              {suggestMut.isPending ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (onNavigate) {
                          onNavigate("validate", "test");
                          setTimeout(() => {
                            const testInput =
                              document.querySelector<HTMLTextAreaElement>(
                                'textarea[placeholder*="Ask"], textarea[placeholder*="question"], input[placeholder*="Ask"], input[placeholder*="question"]'
                              ) ??
                              document.querySelector<HTMLInputElement>(
                                'input[placeholder*="Search"]'
                              );
                            if (testInput) {
                              const nativeSetter =
                                Object.getOwnPropertyDescriptor(
                                  window.HTMLTextAreaElement.prototype,
                                  "value"
                                )?.set ??
                                Object.getOwnPropertyDescriptor(
                                  window.HTMLInputElement.prototype,
                                  "value"
                                )?.set;
                              nativeSetter?.call(testInput, q);
                              testInput.dispatchEvent(
                                new Event("input", { bubbles: true })
                              );
                              testInput.focus();
                            }
                          }, 400);
                        }
                      }}
                      className="px-3 py-2 text-xs text-left rounded-xl border border-border/25 bg-muted/30 kb-duotone-bg-hover-soft kb-duotone-border-hover-strong text-foreground/80 kb-duotone-text-hover transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        {isCompleted && showAccessControls && (
          <div
            data-testid="kb-ingest-security-summary"
            className="mt-6 mx-auto max-w-2xl rounded-2xl border border-border/30 bg-muted/20 px-4 py-4 text-left"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Security and access
                </p>
                <p className={cn(k.muted, "mt-1 leading-5")}>
                  This document kept the sensitivity and access settings you
                  chose at intake.
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0",
                  completedClassificationMeta.tone === "sensitive" &&
                    "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400",
                  completedClassificationMeta.tone === "caution" &&
                    "border-primary/20 bg-primary/8 text-primary",
                  completedClassificationMeta.tone === "info" &&
                    "border-primary/20 bg-primary/8 text-primary",
                  completedClassificationMeta.tone === "neutral" &&
                    "border-border/40 bg-background text-foreground"
                )}
              >
                {completedClassificationMeta.label}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/25 bg-background/70 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Classification
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {completedClassificationMeta.label}
                </p>
                <p className={cn(k.muted, "mt-1 leading-5")}>
                  {completedClassificationMeta.description}
                </p>
              </div>
              <div className="rounded-xl border border-border/25 bg-background/70 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Access
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {completedAccessSummary}
                </p>
                <p className={cn(k.muted, "mt-1 leading-5")}>
                  {hasExplicitAccessControl(completedAccessControl)
                    ? "Named groups now gate retrieval and grounded answers for this document."
                    : "No extra document ACL was added beyond the current domain boundary."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {onNavigate && completionState === "pending_review" && (
            <>
              <Button
                data-testid="kb-ingest-open-review"
                variant="ghost-primary"
                onClick={() => onNavigate("govern", "review")}
                className="text-sm gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                Open Review Queue
              </Button>
              <Button
                data-testid="kb-ingest-open-library"
                variant="ghost-primary"
                onClick={() => onNavigate("library")}
                className="text-sm gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Open Library
              </Button>
            </>
          )}
          {onNavigate && completionState === "ready" && isSensitiveResult && (
            <>
              <Button
                data-testid="kb-ingest-open-library"
                variant="ghost-primary"
                onClick={() => onNavigate("library")}
                className="text-sm gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Open Library
              </Button>
              {(liveJob?.documentId || lastIngestResult?.documentId) && (
                <Button
                  data-testid="kb-ingest-open-document"
                  variant="ghost-primary"
                  onClick={navigateToDocument}
                  className="text-sm gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Open Document
                </Button>
              )}
              <Button
                data-testid="kb-ingest-test-retrieval"
                variant="ghost"
                onClick={() => onNavigate("validate", "test")}
                className="text-sm gap-2 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
              >
                <FlaskConical className="w-4 h-4" />
                Test Retrieval
              </Button>
            </>
          )}
          {onNavigate && completionState === "ready" && !isSensitiveResult && (
            <>
              <Button
                data-testid="kb-ingest-open-library"
                variant="ghost-primary"
                onClick={() => onNavigate("library")}
                className="text-sm gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Open Library
              </Button>
              <Button
                variant="ghost"
                onClick={() => onNavigate("validate", "test")}
                className="text-sm gap-2 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
              >
                <FlaskConical className="w-4 h-4" />
                Try Sample Questions
              </Button>
            </>
          )}
          {onNavigate && !isCompleted && (
            <Button
              variant="ghost-primary"
              onClick={() => onNavigate("pipelines")}
              className="text-sm gap-2"
            >
              <Workflow className="w-4 h-4" />
              Check Processing Status
            </Button>
          )}
          <Button
            variant="outline"
            onClick={startFresh}
            className="text-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Add More Content
          </Button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE JOBS FEED — expandable list with stage progress & retry
// ══════════════════════════════════════════════════════════════════════════════

function PipelineJobsFeed({
  onNavigate,
  valueStreamId,
}: {
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
  valueStreamId?: string;
}) {
  const { notify } = useNotifications();
  const [pollCount, setPollCount] = useState(0);

  // Adaptive polling: fast when jobs are active, backs off when idle
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    valueStreamId ? { valueStreamId } : undefined,
    {
      enabled: Boolean(valueStreamId),
      refetchInterval: query => {
        const jobs = query.state.data?.jobs ?? [];
        const hasActive = jobs.some(
          (j: any) => !["completed", "failed"].includes(j.status)
        );
        if (hasActive) return JOB_WS_FALLBACK_POLL_MS;
        if (pollCount > 30) return false; // stop polling after ~60s idle
        return Math.min(
          JOB_WS_FALLBACK_POLL_MS * Math.pow(1.25, Math.min(pollCount, 8)),
          JOB_IDLE_POLL_MAX_MS
        );
      },
      refetchOnWindowFocus: true,
    }
  );

  // Track consecutive idle polls
  useEffect(() => {
    const jobs = jobsQ.data?.jobs ?? [];
    const hasActive = jobs.some(
      (j: any) => !["completed", "failed"].includes(j.status)
    );
    if (hasActive) {
      setPollCount(0);
    } else {
      setPollCount(c => c + 1);
    }
  }, [jobsQ.dataUpdatedAt, jobsQ.data?.jobs]);

  const jobs = jobsQ.data?.jobs ?? [];
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const jobDetailQ = trpc.knowledge.getJob.useQuery(
    valueStreamId
      ? { jobId: expandedJob!, valueStreamId }
      : { jobId: expandedJob! },
    {
      enabled: Boolean(expandedJob && valueStreamId),
      refetchInterval: query =>
        query.state.error ? false : JOB_WS_FALLBACK_POLL_MS,
      retry: false,
    }
  );

  const reprocessMut = trpc.knowledge.reprocessDocument.useMutation({
    onSuccess: () => {
      notify({
        title: "Reprocessing started",
        description: "The document is being re-ingested through the pipeline.",
        severity: "success",
        group: "pipeline",
      });
      jobsQ.refetch();
    },
    onError: e =>
      notify({
        title: "Reprocess failed",
        description: e.message,
        severity: "error",
        group: "pipeline",
      }),
  });

  const activeJobs = jobs.filter(
    (j: any) => !["completed", "failed"].includes(j.status)
  );
  const recentJobs = jobs
    .filter((j: any) => ["completed", "failed"].includes(j.status))
    .slice(0, 8);
  const completedCount = jobs.filter(
    (j: any) => j.status === "completed"
  ).length;
  const failedCount = jobs.filter((j: any) => j.status === "failed").length;

  if (jobs.length === 0 && !jobsQ.isLoading) return null;

  return (
    <div className="space-y-3">
      {/* Header with stats and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <h3 className={cn(k.heading, "font-semibold")}>Pipeline Jobs</h3>
          {activeJobs.length > 0 && (
            <Badge variant="default" className="text-xs">
              {activeJobs.length} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Summary stats */}
          <div className="flex items-center gap-3">
            {completedCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                {completedCount} completed
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <XCircle className="w-3 h-3" />
                {failedCount} failed
              </span>
            )}
          </div>
          <button
            onClick={() => jobsQ.refetch()}
            disabled={jobsQ.isFetching}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
            title="Refresh jobs"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", jobsQ.isFetching && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div className="space-y-1.5">
          {activeJobs.map((job: any) => (
            <JobRow
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onToggle={() =>
                setExpandedJob(expandedJob === job.id ? null : job.id)
              }
              detail={expandedJob === job.id ? jobDetailQ.data : null}
              onNavigate={onNavigate}
              onRetry={documentId => reprocessMut.mutate({ documentId })}
              isRetrying={reprocessMut.isPending}
            />
          ))}
        </div>
      )}

      {/* Recent completed / failed */}
      {recentJobs.length > 0 && (
        <div className="space-y-1.5">
          {activeJobs.length > 0 && (
            <p className={cn(k.label, "text-xs mt-2")}>Recent</p>
          )}
          {recentJobs.map((job: any) => (
            <JobRow
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onToggle={() =>
                setExpandedJob(expandedJob === job.id ? null : job.id)
              }
              detail={expandedJob === job.id ? jobDetailQ.data : null}
              onNavigate={onNavigate}
              onRetry={documentId => reprocessMut.mutate({ documentId })}
              isRetrying={reprocessMut.isPending}
            />
          ))}
        </div>
      )}

      {jobsQ.isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

// ── Job row ──────────────────────────────────────────────────────────────────

function JobRow({
  job,
  expanded,
  onToggle,
  detail,
  onNavigate,
  onRetry,
  isRetrying,
}: {
  job: any;
  expanded: boolean;
  onToggle: () => void;
  detail: any;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
  onRetry?: (documentId: string) => void;
  isRetrying?: boolean;
}) {
  const meta = JOB_STATUS_META[job.status] ?? JOB_STATUS_META.queued;
  const StatusIcon = meta?.Icon ?? Clock;
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isTerminal = isCompleted || isFailed;
  const stagesCompleted = detail?.stagesCompleted ?? [];
  const failedAtStage = detail?.job?.failedAtStage ?? null;
  const hasDocument = !!job.documentId;
  const canReAdd = isFailed && !hasDocument && !!onNavigate;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        expanded
          ? "border-primary/20 bg-primary/8 dark:bg-primary/12"
          : isFailed
            ? "border-red-500/15 hover:border-red-500/25"
            : "border-border/25 kb-duotone-border-hover-soft"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
      >
        <StatusIcon
          className={cn(
            "w-4 h-4 shrink-0",
            meta?.color ?? "text-muted-foreground",
            isPipelineProcessingStatus(job.status) && "animate-spin"
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {job.title || job.id?.slice(0, 8)}
          </p>
          <p className={cn(k.muted, "text-xs")}>
            {job.sourceType} &middot;{" "}
            {getPipelineStatusLabel(job.status, {
              failedAtStage,
              tone: "compact",
            })}
            {job.chunkCount > 0 && ` \u00B7 ${job.chunkCount} chunks`}
            {job.processingTimeMs > 0 &&
              ` \u00B7 ${(job.processingTimeMs / 1000).toFixed(1)}s`}
          </p>
        </div>

        {/* Inline quick actions (visible without expanding) */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          {isCompleted && hasDocument && onNavigate && (
            <button
              onClick={() => onNavigate("library", job.documentId)}
              className="p-1.5 rounded-lg kb-duotone-icon-hover"
              title="View in Library"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {isFailed && hasDocument && onRetry && (
            <button
              onClick={() => onRetry(job.documentId)}
              disabled={isRetrying}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
              title="Retry — reprocess document"
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {canReAdd && (
            <button
              onClick={() => onNavigate?.("ingest")}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
              title="Add Again"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              {/* Stage progress */}
              <div className="flex items-center gap-1">
                {KNOWLEDGE_PIPELINE_STAGES.map((stage, i) => {
                  const isDone =
                    stagesCompleted.includes(stage) ||
                    job.status === "completed";
                  const isCurrent = job.status === stage;
                  const isStageFailed = isFailed && failedAtStage === stage;
                  return (
                    <div key={stage} className="flex items-center gap-1 flex-1">
                      <Badge
                        variant={
                          isStageFailed
                            ? "destructive"
                            : isDone
                              ? "default"
                              : isCurrent
                                ? "outline"
                                : "secondary"
                        }
                        className={cn(
                          "flex-1 justify-center text-xs py-1 rounded-md",
                          isCurrent && "ring-1 ring-primary/30",
                          isStageFailed && "ring-1 ring-red-500/30"
                        )}
                      >
                        {isStageFailed && <XCircle className="w-2.5 h-2.5" />}
                        {isDone && !isStageFailed && (
                          <CheckCircle className="w-2.5 h-2.5" />
                        )}
                        {isCurrent && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        )}
                        {getPipelineStatusLabel(stage, { tone: "compact" })}
                      </Badge>
                      {i < KNOWLEDGE_PIPELINE_STAGES.length - 1 && (
                        <div
                          className={cn(
                            "w-2 h-px",
                            isDone ? "bg-primary/40" : "bg-border"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <PipelineCoachCards
                className="mt-3"
                status={job.status}
                failedAtStage={failedAtStage}
                error={detail?.job?.error}
              />

              {/* Metadata row */}
              <div
                className={cn("mt-2 grid grid-cols-3 gap-2 text-xs", k.mono)}
              >
                <div>
                  <span className="font-semibold">ID:</span>{" "}
                  {job.id?.slice(0, 12)}
                </div>
                <div>
                  <span className="font-semibold">Created:</span>{" "}
                  {job.createdAt
                    ? new Date(job.createdAt).toLocaleTimeString()
                    : "\u2014"}
                </div>
                {job.documentId && (
                  <div>
                    <span className="font-semibold">Doc:</span>{" "}
                    {job.documentId?.slice(0, 12)}
                  </div>
                )}
              </div>

              {/* Error detail for failed jobs */}
              {isFailed && detail?.job?.error && (
                <div className="mt-2 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                          {humanizePipelineError(
                            detail.job.error,
                            failedAtStage
                          )}
                        </p>
                        {failedAtStage && (
                          <p className="text-xs text-red-500/60 mt-0.5">
                            Stopped during{" "}
                            {getPipelineStatusLabel(failedAtStage, {
                              tone: "full",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(detail.job.error)
                      }
                      className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition-colors shrink-0"
                      title="Copy error"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                {isCompleted && hasDocument && onNavigate && (
                  <button
                    onClick={() => onNavigate("library", job.documentId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary kb-duotone-bg-hover rounded-lg transition-colors"
                  >
                    <BookOpen className="w-3 h-3" />
                    View in Library
                  </button>
                )}
                {isCompleted && hasDocument && onNavigate && (
                  <button
                    onClick={() => onNavigate("validate", "test")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                  >
                    <FlaskConical className="w-3 h-3" />
                    Test Retrieval
                  </button>
                )}
                {isFailed && hasDocument && onRetry && (
                  <button
                    onClick={() => onRetry(job.documentId)}
                    disabled={isRetrying}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {isRetrying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCw className="w-3 h-3" />
                    )}
                    Retry
                  </button>
                )}
                {canReAdd && (
                  <button
                    onClick={() => onNavigate?.("ingest")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                    Add Again
                  </button>
                )}
                {isFailed && !detail?.job?.error && (
                  <span className="flex-1 text-right text-xs text-red-500/60 truncate ml-2">
                    Pipeline failed
                  </span>
                )}
                {!isTerminal && (
                  <span className="flex-1 text-right text-xs text-muted-foreground/50 animate-pulse">
                    Processing…
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

/** Stat pill */
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/80">
      <span className={cn(k.label, "text-xs")}>{label}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  );
}

/** Detail row */
function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(k.muted, "text-xs")}>{label}</span>
      <span
        className={cn("text-xs font-semibold", valueColor || "text-foreground")}
      >
        {value}
      </span>
    </div>
  );
}
