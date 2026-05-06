/**
 * Data Zone — Complete data management hub
 *
 * Upload files, connect sources, browse connections, and trigger pipelines
 * in a unified, production-ready interface.
 */

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
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Settings,
  ExternalLink,
  Filter,
  MoreVertical,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { k } from "../theme";
import FileDropZone, { type SelectedFile } from "./upload/FileDropZone";
import { SOURCE_TYPES, type SourceTypeDefinition } from "./connectors";

// ── Types ────────────────────────────────────────────────────────────────────

interface DataZoneProps {
  streamName?: string;
  streamId?: string;
}

type ViewMode = "dashboard" | "upload" | "connect" | "browse";

// ── Animation ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (d: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE, delay: d },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function DataZone({ streamName, streamId }: DataZoneProps) {
  const [view, setView] = useState<ViewMode>("dashboard");
  const [mode, setMode] = useState<IngestMode>("file");
  const { notify } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    content: "",
    url: "",
    title: "",
    department: "",
    documentType: "general",
    tags: "",
  });
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [selectedSource, setSelectedSource] =
    useState<SourceTypeDefinition | null>(null);

  const utils = trpc.useUtils();

  // ── Queries ──
  const connectorsQ = trpc.connectors.list.useQuery();
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    streamId ? { limit: 50, valueStreamId: streamId } : undefined,
    {
      enabled: Boolean(streamId),
      refetchInterval: 30000,
    }
  );

  // ── Mutations ──
  const contributeMut = trpc.gamification.recordContribution.useMutation({
    onSuccess: result => {
      if (result.newBadges && result.newBadges.length > 0) {
        fireConfetti();
        for (const badge of result.newBadges) {
          toast.success(`${badge.icon} ${badge.name}`, {
            description: badge.flavorText,
            duration: 5000,
          });
        }
      }
      utils.gamification.getProfile.invalidate();
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
        valueStreamId: streamId || undefined,
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
        valueStreamId: streamId || undefined,
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
        valueStreamId: streamId || undefined,
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
      setView("browse");
    },
    onError: e =>
      notify({
        title: "Connector failed",
        description: e.message,
        severity: "error",
        group: "connector",
      }),
  });

  // ── Handlers ──
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
      streamId: streamId || undefined,
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
          ...meta,
        });
      }
    } else if (mode === "text") {
      if (!form.content.trim())
        return notify({ title: "Content is required", severity: "warning" });
      ingestTextMut.mutate({ content: form.content, ...meta });
    } else {
      if (!form.url.trim())
        return notify({ title: "URL is required", severity: "warning" });
      ingestUrlMut.mutate({ url: form.url, ...meta });
    }
  }, [mode, form, files, ingestTextMut, ingestUrlMut, uploadFileMut]);

  const handleConnectSource = useCallback(
    (source: SourceTypeDefinition) => {
      if (source.category === "manual") {
        setView("upload");
        if (source.id === "file_upload") setMode("file");
        else if (source.id === "text_paste") setMode("text");
        else setMode("url");
        return;
      }

      if (source.connectorType) {
        setSelectedSource(source);
        // For demo: create a placeholder connector
        createConnectorMut.mutate({
          type: source.connectorType as any,
          name: `${source.name} — ${streamName || "Knowledge"}`,
          config: {},
          syncIntervalMinutes: 30,
        });
      } else {
        notify({
          title: `${source.name} connector coming soon`,
          description: "Use Manual upload for now",
          severity: "info",
        });
      }
    },
    [createConnectorMut, streamName]
  );

  // ── Computed ──
  const isIngesting =
    ingestTextMut.isPending ||
    ingestUrlMut.isPending ||
    uploadFileMut.isPending;
  const connectors = connectorsQ.data ?? [];
  const jobs = useMemo(() => jobsQ.data?.jobs ?? [], [jobsQ.data]);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter(
      j => j.status !== "completed" && j.status !== "failed"
    ).length;
    const failedJobs = jobs.filter(j => j.status === "failed").length;
    const totalDocs = jobs.filter(j => j.status === "completed").length;
    const activeConnectors = connectors.filter(
      c => c.status === "active"
    ).length;
    return { activeJobs, failedJobs, totalDocs, activeConnectors };
  }, [jobs, connectors]);

  const filteredSources = useMemo(() => {
    if (!searchQuery) return SOURCE_TYPES.filter(s => s.available);
    const q = searchQuery.toLowerCase();
    return SOURCE_TYPES.filter(
      s =>
        s.available &&
        (s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-200px)]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full space-y-6"
      >
        {/* ══════════════════════════════════════════════════════════════════
            Header
            ══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Data Zone
            </h1>
            <p className="text-sm text-muted-foreground/60">
              Upload files, connect data sources, and manage ingestion pipelines
            </p>
          </div>

          {/* View switcher */}
          <div
            className={cn("flex items-center gap-1 p-1 rounded-xl", surfaceCls)}
          >
            {[
              { key: "dashboard" as const, label: "Dashboard", icon: Activity },
              { key: "upload" as const, label: "Upload", icon: Upload },
              { key: "connect" as const, label: "Connect", icon: Plug },
              { key: "browse" as const, label: "Browse", icon: Database },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  view === v.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground dark:hover:text-foreground"
                )}
              >
                <v.icon className="w-4 h-4" />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
          Content by view
          ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {view === "dashboard" && (
            <DashboardView
              key="dashboard"
              stats={stats}
              connectors={connectors}
              jobs={jobs}
              jobsLoading={jobsQ.isLoading}
              onRefreshJobs={() => jobsQ.refetch()}
              onNavigate={setView}
            />
          )}

          {view === "upload" && (
            <UploadView
              key="upload"
              mode={mode}
              setMode={setMode}
              form={form}
              setForm={setForm}
              files={files}
              setFiles={setFiles}
              isIngesting={isIngesting}
              onIngest={handleIngest}
            />
          )}

          {view === "connect" && (
            <ConnectView
              key="connect"
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sources={filteredSources}
              activeConnectorTypes={connectors.map(c => c.type)}
              onSelectSource={handleConnectSource}
            />
          )}

          {view === "browse" && (
            <BrowseView
              key="browse"
              connectors={connectors}
              isLoading={connectorsQ.isLoading}
              onRefresh={() => connectorsQ.refetch()}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════════════════════

function DashboardView({
  stats,
  connectors,
  jobs,
  jobsLoading,
  onRefreshJobs,
  onNavigate,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="w-5 h-5 text-primary" />}
          value={stats.activeConnectors}
          label="Active Sources"
          accent="blue"
        />
        <StatCard
          icon={<Activity className="w-5 h-5 text-blue-500" />}
          value={stats.activeJobs}
          label="Running Jobs"
          accent="blue"
        />
        <StatCard
          icon={<Database className="w-5 h-5 text-violet-500" />}
          value={stats.totalDocs.toLocaleString()}
          label="Documents"
          accent="violet"
        />
        <StatCard
          icon={
            <AlertCircle
              className={cn(
                "w-5 h-5",
                stats.failedJobs > 0 ? "text-red-500" : "text-muted-foreground"
              )}
            />
          }
          value={stats.failedJobs}
          label="Failed Jobs"
          accent={stats.failedJobs > 0 ? "red" : "slate"}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickActionCard
            icon={<Upload className="w-6 h-6 text-violet-500" />}
            title="Upload Files"
            description="Drag & drop or select files to ingest"
            onClick={() => onNavigate("upload")}
            accent="violet"
          />
          <QuickActionCard
            icon={<Plug className="w-6 h-6 text-blue-500" />}
            title="Connect Source"
            description="Link external data sources"
            onClick={() => onNavigate("connect")}
            accent="blue"
          />
          <QuickActionCard
            icon={<Database className="w-6 h-6 text-primary" />}
            title="Browse Sources"
            description="View and manage connections"
            onClick={() => onNavigate("browse")}
            accent="blue"
          />
        </div>
      </div>

      {/* Recent Jobs */}
      <Card className={cardCls}>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Jobs
          </CardTitle>
          <button
            onClick={onRefreshJobs}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground/60",
                jobsLoading && "animate-spin"
              )}
            />
          </button>
        </CardHeader>
        <CardContent className="pt-0">
          {jobs.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">No jobs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 5).map((job: any) => {
                const statusMeta =
                  JOB_STATUS_META[job.status] || JOB_STATUS_META.queued;
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <statusMeta.Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        statusMeta.color,
                        job.status !== "completed" &&
                          job.status !== "failed" &&
                          "animate-spin"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {job.documentTitle ||
                          job.filename ||
                          `Job ${job.id.slice(0, 8)}`}
                      </div>
                      <div className="text-xs text-muted-foreground/60 capitalize">
                        {job.status} • {job.source || "Unknown"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/60 tabular-nums">
                      {job.chunkCount ?? 0} chunks
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Connectors */}
      {connectors.length > 0 && (
        <Card className={cardCls}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Active Connectors
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {connectors.slice(0, 3).map((conn: any) => (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plug className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {conn.name}
                    </div>
                    <div className="text-xs text-muted-foreground/60 capitalize">
                      {conn.type} • Syncs every {conn.syncIntervalMinutes}m
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-bold",
                      conn.status === "active"
                        ? "kb-duotone-fill"
                        : "bg-muted text-muted-foreground dark:text-muted-foreground"
                    )}
                  >
                    {conn.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD VIEW
// ══════════════════════════════════════════════════════════════════════════════

function UploadView({
  mode,
  setMode,
  form,
  setForm,
  files,
  setFiles,
  isIngesting,
  onIngest,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(cardCls, "overflow-hidden")}>
        <CardHeader className="border-b border-border/30 dark:border-border/30 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 mb-1">
              <Upload className="w-5 h-5 text-violet-500" />
              Manual Upload
            </CardTitle>
            <p className="text-xs text-muted-foreground/60">
              Direct ingestion for quick content additions
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 p-0.5 rounded-lg",
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
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  mode === m.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground dark:text-muted-foreground/60 hover:text-foreground dark:hover:text-foreground"
                )}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* Upload Zone */}
          {mode === "file" ? (
            <FileDropZone
              files={files}
              onFilesSelected={newFiles =>
                setFiles((prev: any) => [...prev, ...newFiles])
              }
              onRemoveFile={idx =>
                setFiles((prev: any) =>
                  prev.filter((_: any, i: number) => i !== idx)
                )
              }
              disabled={isIngesting}
            />
          ) : mode === "text" ? (
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={e =>
                  setForm((f: any) => ({ ...f, content: e.target.value }))
                }
                placeholder="Paste text content to ingest..."
                rows={10}
                className={cn(k.input, "resize-none text-sm leading-relaxed")}
                style={{ fontFamily: FONT_FAMILY.mono }}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                URL <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground/60 shrink-0" />
                <input
                  value={form.url}
                  onChange={e =>
                    setForm((f: any) => ({ ...f, url: e.target.value }))
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
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                Title
              </label>
              <input
                value={form.title}
                onChange={e =>
                  setForm((f: any) => ({ ...f, title: e.target.value }))
                }
                placeholder="Auto-detected if empty"
                className={k.input}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                Department
              </label>
              <input
                value={form.department}
                onChange={e =>
                  setForm((f: any) => ({ ...f, department: e.target.value }))
                }
                placeholder="e.g. Pharmacy, Logistics"
                className={k.input}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                Document Type
              </label>
              <select
                value={form.documentType}
                onChange={e =>
                  setForm((f: any) => ({ ...f, documentType: e.target.value }))
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
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                Tags{" "}
                <span className="text-muted-foreground/60">
                  (comma-separated)
                </span>
              </label>
              <input
                value={form.tags}
                onChange={e =>
                  setForm((f: any) => ({ ...f, tags: e.target.value }))
                }
                placeholder="e.g. policy, 2025, compliance"
                className={k.input}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end pt-3 border-t border-border/30 dark:border-border/30">
            <button
              onClick={onIngest}
              disabled={
                isIngesting ||
                (mode === "file"
                  ? !files.some((f: any) => f.status === "ready")
                  : mode === "text"
                    ? !form.content.trim()
                    : !form.url.trim())
              }
              className={k.btnPrimary}
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {mode === "file"
                    ? `Upload ${files.filter((f: any) => f.status === "ready").length} File(s)`
                    : mode === "text"
                      ? "Ingest Text"
                      : "Crawl & Ingest"}
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONNECT VIEW
// ══════════════════════════════════════════════════════════════════════════════

function ConnectView({
  searchQuery,
  setSearchQuery,
  sources,
  activeConnectorTypes,
  onSelectSource,
}: any) {
  const categories = useMemo(() => {
    const grouped = sources.reduce((acc: any, s: SourceTypeDefinition) => {
      const cat = s.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {});
    return Object.entries(grouped);
  }, [sources]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
        <input
          type="text"
          placeholder="Search connectors by name or type..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all"
        />
      </div>

      {/* Categories */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-8"
      >
        {categories.map(([category, items]: [string, any]) => (
          <div key={category}>
            <h3 className="text-sm font-bold text-foreground mb-3 capitalize flex items-center gap-2">
              {category.replace("_", " ")}
              <span className="text-xs font-normal text-muted-foreground/60">
                ({items.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((source: SourceTypeDefinition) => {
                const isActive = activeConnectorTypes.includes(
                  source.connectorType
                );
                return (
                  <motion.button
                    key={source.id}
                    variants={fadeUp}
                    custom={0}
                    onClick={() => onSelectSource(source)}
                    disabled={isActive}
                    className={cn(
                      "group relative flex flex-col items-start gap-3 p-4 rounded-xl border transition-all text-left",
                      isActive
                        ? "border-primary/40 bg-primary/5 cursor-default"
                        : "border-border/30 dark:border-border/30 bg-card dark:bg-card hover:border-blue-500/40 hover:shadow-md hover:shadow-blue-500/5 active:scale-[0.98]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center text-xl",
                        source.bgColor
                      )}
                    >
                      {source.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate mb-1">
                        {source.name}
                      </div>
                      <p className="text-xs text-muted-foreground/60 line-clamp-2">
                        {source.description}
                      </p>
                    </div>
                    {source.popular && !isActive && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-blue-500/10 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </motion.div>

      {sources.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/60">
            No connectors match your search
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE VIEW
// ══════════════════════════════════════════════════════════════════════════════

function BrowseView({ connectors, isLoading, onRefresh }: any) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/60">
          Loading connectors...
        </p>
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 px-6 rounded-2xl border border-border/30 dark:border-border/30 bg-muted/50 dark:bg-card/30"
      >
        <Database className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No Connectors Yet
        </h3>
        <p className="text-sm text-muted-foreground/60 mb-4">
          Connect your first data source to start ingesting content
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          {connectors.length} Active{" "}
          {connectors.length === 1 ? "Connector" : "Connectors"}
        </h3>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground/60" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((conn: any) => (
          <ConnectorCard key={conn.id} connector={conn} onRefresh={onRefresh} />
        ))}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function StatCard({ icon, value, label, accent }: any) {
  const colorClasses: Record<string, string> = {
    blue: "bg-primary/5 dark:bg-primary/10 border-primary/20",
    violet: "bg-violet-500/5 dark:bg-violet-500/10 border-violet-500/20",
    red: "bg-red-500/5 dark:bg-red-500/10 border-red-500/20",
    slate: "bg-muted/30 dark:bg-muted border-slate-500/20",
  };

  return (
    <div className={cn(cardCls, "p-5", colorClasses[accent])}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-muted/60 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-3xl font-bold text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}

function QuickActionCard({ icon, title, description, onClick, accent }: any) {
  const colorClasses: Record<string, string> = {
    blue: "kb-duotone-border-hover-strong kb-duotone-shadow-hover",
    violet: "hover:border-violet-500/40 hover:shadow-violet-500/5",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-start gap-4 p-5 rounded-xl border text-left transition-all",
        "border-border/30 dark:border-border/30 bg-card dark:bg-card",
        "hover:shadow-md active:scale-[0.98]",
        colorClasses[accent]
      )}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted dark:bg-muted/60 group-hover:scale-105 transition-transform shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground/60">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground/40 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}

function ConnectorCard({ connector, onRefresh }: any) {
  const { notify } = useNotifications();
  return (
    <div className={cn(cardCls, "p-5")}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Plug className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate mb-0.5">
            {connector.name}
          </h4>
          <p className="text-xs text-muted-foreground/60 capitalize">
            {connector.type}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <MoreVertical className="w-4 h-4 text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                notify({ title: "Sync feature coming soon", severity: "info" })
              }
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Sync Now
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                notify({
                  title: "Status control coming soon",
                  severity: "info",
                })
              }
            >
              {connector.status === "active" ? (
                <Pause className="w-3.5 h-3.5 mr-2" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-2" />
              )}
              {connector.status === "active" ? "Pause" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                notify({ title: "Configuration coming soon", severity: "info" })
              }
            >
              <Settings className="w-3.5 h-3.5 mr-2" />
              Configure
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">
            Status
          </div>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-xs font-bold",
              connector.status === "active"
                ? "kb-duotone-fill"
                : "bg-muted text-muted-foreground dark:text-muted-foreground"
            )}
          >
            {connector.status}
          </span>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">
            Documents
          </div>
          <div className="text-sm font-bold text-foreground tabular-nums">
            {connector.documentsCount?.toLocaleString() ?? 0}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">
            Interval
          </div>
          <div className="text-sm font-bold text-foreground">
            {connector.syncIntervalMinutes}m
          </div>
        </div>
      </div>

      {connector.lastSyncAt && (
        <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last sync: {new Date(connector.lastSyncAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
