import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Globe,
  FileText,
  Clock,
  CheckCircle,
  Loader2,
  X,
  Activity,
  Sparkles,
  RefreshCw,
  File,
  Plug,
  Zap,
  Database,
  ChevronRight,
  Search,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  fireConfetti,
  useNotifications,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";
import {
  type IngestMode,
  DOC_TYPES,
  JOB_STATUS_META,
  cardCls,
  surfaceCls,
} from "../types";
import { k, ACCENT } from "../theme";
import { PipelineGraph, JobTimeline, type PipelineJob } from "./pipeline";
import FileDropZone, { type SelectedFile } from "./upload/FileDropZone";
import {
  ConnectorCatalog,
  ActiveConnectors,
  GoogleDriveSetup,
  SOURCE_TYPES,
  type SourceTypeDefinition,
} from "./connectors";

// ── View modes ───────────────────────────────────────────────────────────────

type SourceView = "connected" | "catalog" | "manual" | "google_drive_setup";

// ── Props ────────────────────────────────────────────────────────────────────

interface SourcesTabProps {
  jobsQ: any;
  streamName?: string;
  valueStreamId?: string;
}

export default function SourcesTab({
  jobsQ,
  streamName,
  valueStreamId,
}: SourcesTabProps) {
  const [view, setView] = useState<SourceView>("connected");
  const [mode, setMode] = useState<IngestMode>("text");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [form, setForm] = useState({
    content: "",
    url: "",
    title: "",
    department: "",
    documentType: "general",
    tags: "",
  });
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [ingestionPlan, setIngestionPlan] = useState<any>(null);
  const utils = trpc.useUtils();

  // ── Connector queries ──
  const connectorsQ = trpc.connectors.list.useQuery();

  // ── Mutations ──
  const { notify } = useNotifications();
  const planMut = trpc.gemini.suggestIngestionPlan.useMutation({
    onSuccess: (d: any) => {
      setIngestionPlan(d.plan);
      notify({
        title: "Ingestion plan generated",
        severity: "success",
        group: "ingest",
      });
    },
    onError: (e: any) =>
      notify({
        title: "Gemini failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      }),
  });

  const contributeMut = trpc.gamification.recordContribution.useMutation({
    onSuccess: result => {
      if (result.newBadges && result.newBadges.length > 0) {
        fireConfetti();
        for (const badge of result.newBadges) {
          toast.success(`${badge.icon} Badge Unlocked: ${badge.name}`, {
            description: badge.flavorText,
            duration: 5000,
          });
        }
      }
      utils.gamification.getProfile.invalidate();
      utils.gamification.getHeatmap.invalidate();
      utils.gamification.getLeaderboard.invalidate();
    },
  });

  const ingestTextMut = trpc.knowledge.ingestText.useMutation({
    onSuccess: d => {
      notify({
        title: "Text ingested",
        description: `${d.chunkCount ?? 0} chunks indexed`,
        severity: "success",
        group: "ingest",
      });
      setForm(f => ({
        ...f,
        content: "",
        title: "",
        department: "",
        tags: "",
      }));
      utils.knowledge.listJobs.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      contributeMut.mutate({
        action: "upload",
        valueStreamId: valueStreamId || undefined,
        documentId: d.documentId ?? undefined,
        metadata: { source: "text", chunks: d.chunkCount ?? 0 },
      });
    },
    onError: e =>
      notify({
        title: "Ingestion failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      }),
  });

  const ingestUrlMut = trpc.knowledge.ingestUrl.useMutation({
    onSuccess: d => {
      notify({
        title: "URL ingested",
        description: `${d.chunkCount ?? 0} chunks indexed`,
        severity: "success",
        group: "ingest",
      });
      setForm(f => ({ ...f, url: "", title: "", department: "", tags: "" }));
      utils.knowledge.listJobs.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      contributeMut.mutate({
        action: "upload",
        valueStreamId: valueStreamId || undefined,
        documentId: d.documentId ?? undefined,
        metadata: { source: "url", url: form.url, chunks: d.chunkCount ?? 0 },
      });
    },
    onError: e =>
      notify({
        title: "URL crawl failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      }),
  });

  const uploadFileMut = trpc.knowledge.uploadFile.useMutation({
    onSuccess: d => {
      notify({
        title: "File ingested",
        description: `${d.chunkCount ?? 0} chunks indexed`,
        severity: "success",
        group: "ingest",
      });
      setFiles(prev =>
        prev.map(f =>
          f.status === "uploading" ? { ...f, status: "success" as const } : f
        )
      );
      utils.knowledge.listJobs.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      contributeMut.mutate({
        action: "upload",
        valueStreamId: valueStreamId || undefined,
        documentId: d.documentId ?? undefined,
        metadata: { source: "file", chunks: d.chunkCount ?? 0 },
      });
    },
    onError: e => {
      notify({
        title: "File upload failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      });
      setFiles(prev =>
        prev.map(f =>
          f.status === "uploading"
            ? { ...f, status: "error" as const, error: e.message }
            : f
        )
      );
    },
  });

  const createConnectorMut = trpc.connectors.create.useMutation({
    onSuccess: () => {
      notify({
        title: "Connector created",
        severity: "success",
        group: "connector",
      });
      connectorsQ.refetch();
      setView("connected");
    },
    onError: e =>
      notify({
        title: "Connector failed",
        description: e.message,
        severity: "error",
        group: "connector",
      }),
  });

  const handleIngest = useCallback(() => {
    const tags = form.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    const meta = {
      title: form.title || undefined,
      department: form.department || undefined,
      documentType: form.documentType,
      tags: tags.length ? tags : undefined,
    };
    if (mode === "file") {
      const ready = files.filter(f => f.status === "ready");
      if (!ready.length)
        return notify({
          title: "No files ready to upload",
          severity: "warning",
        });
      setFiles(prev =>
        prev.map(f =>
          f.status === "ready" ? { ...f, status: "uploading" as const } : f
        )
      );
      for (const sf of ready) {
        uploadFileMut.mutate({
          fileBase64: sf.base64,
          filename: sf.file.name,
          contentType: sf.file.type,
          streamId: valueStreamId || undefined,
          ...meta,
        });
      }
    } else if (mode === "text") {
      if (!form.content.trim())
        return notify({ title: "Content is required", severity: "warning" });
      ingestTextMut.mutate({
        content: form.content,
        streamId: valueStreamId || undefined,
        ...meta,
      });
    } else {
      if (!form.url.trim())
        return notify({ title: "URL is required", severity: "warning" });
      ingestUrlMut.mutate({
        url: form.url,
        streamId: valueStreamId || undefined,
        ...meta,
      });
    }
  }, [
    mode,
    form,
    files,
    ingestTextMut,
    ingestUrlMut,
    uploadFileMut,
    notify,
    valueStreamId,
  ]);

  const handleSelectSource = useCallback(
    (source: SourceTypeDefinition) => {
      // Manual sources switch to manual view
      if (source.category === "manual") {
        setView("manual");
        if (source.id === "file_upload") setMode("file");
        else if (source.id === "text_paste") setMode("text");
        else setMode("url");
        return;
      }
      // Google Drive has a dedicated OAuth setup flow
      if (source.id === "google_drive") {
        setView("google_drive_setup");
        return;
      }
      // Other connector sources — create a placeholder connector
      if (source.connectorType) {
        createConnectorMut.mutate({
          type: source.connectorType as any,
          name: `${source.name} — ${streamName || "Knowledge"}`,
          config: {
            streamId: valueStreamId || undefined,
            streamName: streamName || undefined,
          },
          syncIntervalMinutes: 30,
        });
      } else {
        notify({
          title: `${source.name} connector coming soon`,
          description: "Use Manual mode for now",
          severity: "info",
        });
      }
    },
    [createConnectorMut, notify, streamName, valueStreamId]
  );

  const isIngesting =
    ingestTextMut.isPending ||
    ingestUrlMut.isPending ||
    uploadFileMut.isPending;
  const jobs: PipelineJob[] = useMemo(
    () => (jobsQ.data?.jobs ?? []) as PipelineJob[],
    [jobsQ.data]
  );
  const connectors = connectorsQ.data ?? [];
  const connectorTypeIds = connectors.map(c => c.type);

  // Stats
  const stats = useMemo(() => {
    const activeJobs = jobs.filter(
      j => j.status !== "completed" && j.status !== "failed"
    ).length;
    const failedJobs = jobs.filter(j => j.status === "failed").length;
    const totalDocs = connectors.reduce(
      (sum, c) =>
        sum +
        ((c as any).documentsIngested ||
          (c as any).lastSyncStats?.documentsIngested ||
          0),
      0
    );
    return { activeJobs, failedJobs, totalDocs };
  }, [jobs, connectors]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* ══════════════════════════════════════════════════════════════════════
          Stats Banner
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cn(cardCls, "p-4")}>
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {connectors.length}
            </span>
          </div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
            Connected Sources
          </div>
        </div>

        <div className={cn(cardCls, "p-4")}>
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {stats.activeJobs}
            </span>
          </div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
            Active Jobs
          </div>
        </div>

        <div className={cn(cardCls, "p-4")}>
          <div className="flex items-center justify-between mb-2">
            <Database className="w-4 h-4 text-violet-500" />
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {stats.totalDocs.toLocaleString()}
            </span>
          </div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
            Documents Ingested
          </div>
        </div>

        <div className={cn(cardCls, "p-4")}>
          <div className="flex items-center justify-between mb-2">
            <AlertCircle
              className={cn(
                "w-4 h-4",
                stats.failedJobs > 0 ? "text-red-500" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                stats.failedJobs > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {stats.failedJobs}
            </span>
          </div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
            Failed Jobs
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Sidebar Navigation + Content
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <button
            onClick={() => setView("connected")}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
              view === "connected"
                ? "kb-duotone-surface-active kb-duotone-shadow-soft"
                : "border-border/30 dark:border-border/30 bg-card dark:bg-card/90 kb-duotone-border-hover"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                view === "connected"
                  ? "kb-duotone-chip"
                  : "bg-muted dark:bg-muted/60 text-muted-foreground/60"
              )}
            >
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-semibold mb-0.5",
                  view === "connected" ? "text-primary" : "text-foreground"
                )}
              >
                Connected
              </div>
              <div className="text-xs text-muted-foreground/60">
                {connectors.length} active{" "}
                {connectors.length === 1 ? "source" : "sources"}
              </div>
            </div>
            {connectors.length > 0 && (
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {connectors.length}
              </div>
            )}
          </button>

          <button
            onClick={() => setView("catalog")}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
              view === "catalog"
                ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10 shadow-md shadow-blue-500/5"
                : "border-border/30 dark:border-border/30 bg-card dark:bg-card/90 hover:border-blue-500/20"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                view === "catalog"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "bg-muted dark:bg-muted/60 text-muted-foreground/60"
              )}
            >
              <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-semibold mb-0.5",
                  view === "catalog"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-foreground"
                )}
              >
                Add Source
              </div>
              <div className="text-xs text-muted-foreground/60">
                {SOURCE_TYPES.filter(s => s.available).length} available
              </div>
            </div>
          </button>

          <button
            onClick={() => setView("manual")}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
              view === "manual"
                ? "border-violet-500/40 bg-violet-500/5 dark:bg-violet-500/10 shadow-md shadow-violet-500/5"
                : "border-border/30 dark:border-border/30 bg-card dark:bg-card/90 hover:border-violet-500/20"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                view === "manual"
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                  : "bg-muted dark:bg-muted/60 text-muted-foreground/60"
              )}
            >
              <Upload className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-semibold mb-0.5",
                  view === "manual"
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-foreground"
                )}
              >
                Manual Upload
              </div>
              <div className="text-xs text-muted-foreground/60">
                File, Text, or URL
              </div>
            </div>
          </button>

          {/* Job Monitor - collapsible */}
          {jobs.length > 0 && (
            <div className={cn(cardCls, "p-3 mt-4")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-foreground">
                    Recent Jobs
                  </span>
                </div>
                <button
                  onClick={() => utils.knowledge.listJobs.invalidate()}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <RefreshCw
                    className={cn(
                      "w-3 h-3 text-muted-foreground/60",
                      jobsQ.isFetching && "animate-spin"
                    )}
                  />
                </button>
              </div>
              <div className="space-y-1.5">
                {jobs.slice(0, 5).map(job => {
                  const statusMeta =
                    JOB_STATUS_META[job.status] || JOB_STATUS_META.queued;
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                        selectedJobId === job.id
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "hover:bg-muted"
                      )}
                    >
                      <statusMeta.Icon
                        className={cn(
                          "w-3 h-3 shrink-0",
                          statusMeta.color,
                          job.status !== "completed" &&
                            job.status !== "failed" &&
                            "animate-spin"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {job.title ||
                            (job as any).sourceRef ||
                            `Job ${job.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-muted-foreground/60 capitalize">
                          {job.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {/* ── Connected Sources ── */}
            {view === "connected" && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveConnectors
                  connectors={connectors as any}
                  isLoading={connectorsQ.isLoading}
                  onRefresh={() => connectorsQ.refetch()}
                />

                {/* Quick-connect CTA */}
                {connectors.length === 0 && !connectorsQ.isLoading && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Quick Connect Popular Sources
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {SOURCE_TYPES.filter(s => s.popular && s.available).map(
                        source => (
                          <button
                            key={source.id}
                            onClick={() => handleSelectSource(source)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border transition-all",
                              "border-border/30 dark:border-border/30 bg-card dark:bg-card/90",
                              "kb-duotone-border-hover-strong kb-duotone-shadow-hover",
                              "active:scale-[0.98]"
                            )}
                          >
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                                source.bgColor
                              )}
                            >
                              {source.icon}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate">
                                {source.name}
                              </div>
                              <div className="text-xs text-muted-foreground/60 capitalize">
                                {source.category.replace("_", " ")}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Connector Catalog ── */}
            {view === "catalog" && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ConnectorCatalog
                  onSelectSource={handleSelectSource}
                  activeConnectorTypes={connectorTypeIds}
                />
              </motion.div>
            )}

            {/* ── Google Drive Setup ── */}
            {view === "google_drive_setup" && (
              <motion.div
                key="gdrive"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <GoogleDriveSetup
                  streamName={streamName}
                  streamId={valueStreamId}
                  onBack={() => setView("catalog")}
                  onConnected={() => {
                    notify({
                      title: "Google Drive connected",
                      severity: "success",
                      group: "connector",
                    });
                    connectorsQ.refetch();
                    setView("connected");
                  }}
                />
              </motion.div>
            )}

            {/* ── Manual Ingest ── */}
            {view === "manual" && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(cardCls, "overflow-hidden")}>
                  <div className="border-b border-border/30 dark:border-border/30 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
                        <Upload className="w-4 h-4 text-violet-500" /> Manual
                        Upload
                      </h3>
                      <p className="text-xs text-muted-foreground/60">
                        Direct ingestion for quick content additions
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-0.5 p-0.5 rounded-lg",
                        surfaceCls
                      )}
                    >
                      {[
                        { key: "file" as const, icon: File, label: "File" },
                        { key: "text" as const, icon: FileText, label: "Text" },
                        { key: "url" as const, icon: Globe, label: "URL" },
                      ].map(m => (
                        <button
                          key={m.key}
                          onClick={() => setMode(m.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                            mode === m.key
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground dark:hover:text-foreground"
                          )}
                        >
                          <m.icon className="w-3 h-3" />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Upload Zone */}
                    {mode === "file" ? (
                      <FileDropZone
                        files={files}
                        onFilesSelected={newFiles =>
                          setFiles(prev => [...prev, ...newFiles])
                        }
                        onRemoveFile={idx =>
                          setFiles(prev => prev.filter((_, i) => i !== idx))
                        }
                        disabled={isIngesting}
                      />
                    ) : mode === "text" ? (
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={form.content}
                          onChange={e =>
                            setForm(f => ({ ...f, content: e.target.value }))
                          }
                          placeholder="Paste text content to ingest into the knowledge base..."
                          rows={8}
                          className={cn(
                            k.input,
                            "resize-none text-sm leading-relaxed"
                          )}
                          style={{ fontFamily: FONT_FAMILY.mono }}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          URL <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          <input
                            value={form.url}
                            onChange={e =>
                              setForm(f => ({ ...f, url: e.target.value }))
                            }
                            placeholder="https://docs.example.com/page"
                            className={cn(k.input, "flex-1")}
                          />
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          Title
                        </label>
                        <input
                          value={form.title}
                          onChange={e =>
                            setForm(f => ({ ...f, title: e.target.value }))
                          }
                          placeholder="Auto-detected if empty"
                          className={k.input}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          Department
                        </label>
                        <input
                          value={form.department}
                          onChange={e =>
                            setForm(f => ({ ...f, department: e.target.value }))
                          }
                          placeholder="e.g. Pharmacy, Logistics"
                          className={k.input}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          Document Type
                        </label>
                        <select
                          value={form.documentType}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              documentType: e.target.value,
                            }))
                          }
                          className={k.input}
                        >
                          {DOC_TYPES.map(t => (
                            <option key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-2">
                          Tags{" "}
                          <span className="text-muted-foreground/60">
                            (comma-separated)
                          </span>
                        </label>
                        <input
                          value={form.tags}
                          onChange={e =>
                            setForm(f => ({ ...f, tags: e.target.value }))
                          }
                          placeholder="e.g. policy, 2025, compliance"
                          className={k.input}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/30 dark:border-border/30">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        disabled={planMut.isPending}
                        onClick={() =>
                          planMut.mutate({
                            streamName: streamName || "General",
                            valueStreamId,
                          })
                        }
                      >
                        {planMut.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {planMut.isPending ? "Planning..." : "Plan with Gemini"}
                      </button>
                      <button
                        onClick={handleIngest}
                        disabled={
                          isIngesting ||
                          (mode === "file"
                            ? !files.some(f => f.status === "ready")
                            : mode === "text"
                              ? !form.content.trim()
                              : !form.url.trim())
                        }
                        className={k.btnPrimary}
                      >
                        {isIngesting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Processing…
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            {mode === "file"
                              ? `Upload ${files.filter(f => f.status === "ready").length} File(s)`
                              : mode === "text"
                                ? "Ingest Text"
                                : "Crawl & Ingest"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gemini Ingestion Plan */}
                {ingestionPlan && ingestionPlan.categories?.length > 0 && (
                  <div className="mt-6 border border-primary/20 rounded-xl bg-primary/5 dark:bg-primary/8 overflow-hidden">
                    <div className="border-b border-primary/20 px-5 py-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Gemini
                        Ingestion Plan
                      </h4>
                      <button
                        onClick={() => setIngestionPlan(null)}
                        className="p-1 rounded kb-duotone-bg-hover text-muted-foreground/60 hover:text-foreground dark:hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      {ingestionPlan.summary && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {ingestionPlan.summary}
                        </p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ingestionPlan.categories.map((cat: any, i: number) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl border border-border/30 dark:border-border/30 bg-card"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground">
                                {cat.name}
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 text-xs font-bold rounded uppercase",
                                  cat.priority === "high"
                                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                    : cat.priority === "medium"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                )}
                              >
                                {cat.priority}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/60 mb-3">
                              {cat.description}
                            </p>
                            {cat.suggestedSources?.length > 0 && (
                              <ul className="space-y-1">
                                {cat.suggestedSources.map(
                                  (src: string, j: number) => (
                                    <li
                                      key={j}
                                      className="text-[11px] text-muted-foreground flex items-start gap-2"
                                    >
                                      <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                      {src}
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                      {ingestionPlan.quickWins?.length > 0 && (
                        <div className="pt-3 border-t border-primary/20">
                          <h5 className="text-xs font-bold text-primary dark:text-primary uppercase tracking-wider mb-2">
                            Quick Wins
                          </h5>
                          <ul className="space-y-1.5">
                            {ingestionPlan.quickWins.map(
                              (w: string, i: number) => (
                                <li
                                  key={i}
                                  className="text-xs text-muted-foreground flex items-start gap-2"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                  {w}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Selected Job Detail (Pipeline Graph) ── */}
            {selectedJobId && jobs.find(j => j.id === selectedJobId) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <PipelineGraph
                  job={jobs.find(j => j.id === selectedJobId) ?? null}
                  isLoading={jobsQ.isLoading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
