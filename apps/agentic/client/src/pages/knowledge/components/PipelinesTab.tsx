/**
 * PipelinesTab — Dedicated pipeline monitoring & job management page.
 *
 * Full-page view of all pipeline jobs with:
 *   - Summary stats (active / completed / failed)
 *   - Status & source-type filters
 *   - Full job list with expandable detail rows
 *   - Cross-tab deep links to Library, Validate, Ingest
 */

import { memo, useDeferredValue, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
  RotateCw,
  BookOpen,
  FlaskConical,
  ExternalLink,
  RefreshCw,
  Filter,
  Plus,
  Search,
  FileText,
  AlertTriangle,
  ArrowRight,
  Copy,
} from "lucide-react";
import { cn, useNotifications, Badge, Button } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k, JOB_POLL_INTERVAL_MS, hasActiveJobs } from "../theme";
import {
  JOB_STATUS_META,
  type KnowledgeTab,
  humanizePipelineError,
} from "../types";
import {
  KNOWLEDGE_PIPELINE_STAGES,
  getPipelineStatusLabel,
  isPipelineProcessingStatus,
} from "../pipelineCopy";
import { PipelineCoachCards } from "./pipeline/PipelineCoachCards";

// ── Constants ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "completed" | "failed";

// ── PipelinesTab ─────────────────────────────────────────────────────────────

interface PipelinesTabProps {
  selectedStream?: string;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

export default function PipelinesTab({
  selectedStream,
  onNavigate,
}: PipelinesTabProps) {
  const { notify } = useNotifications();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // ── Queries ──
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    selectedStream ? { valueStreamId: selectedStream } : undefined,
    {
      enabled: Boolean(selectedStream),
      refetchInterval: query => {
        const jobs = query.state.data?.jobs;
        if (Array.isArray(jobs) && hasActiveJobs(jobs))
          return JOB_POLL_INTERVAL_MS;
        return 15_000; // slower poll when idle
      },
    }
  );

  const jobDetailQ = trpc.knowledge.getJob.useQuery(
    selectedStream
      ? { jobId: expandedJob!, valueStreamId: selectedStream }
      : { jobId: expandedJob! },
    {
      enabled: Boolean(expandedJob && selectedStream),
      refetchInterval: query => (query.state.error ? false : 2000),
      retry: false,
    }
  );

  // Analytics-service metrics — historical success rate, duration.
  // Degrades gracefully when analytics-service is offline.
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : undefined;
  const analyticsQ = trpc.knowledge.analyticsMetrics.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : undefined,
    {
      retry: false,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
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

  const cancelJobMut = trpc.knowledge.cancelJob.useMutation({
    onSuccess: () => {
      notify({
        title: "Job cancelled",
        description: "The running job has been stopped.",
        severity: "success",
        group: "pipeline",
      });
      jobsQ.refetch();
      jobDetailQ.refetch();
    },
    onError: e =>
      notify({
        title: "Cancel failed",
        description: e.message,
        severity: "error",
        group: "pipeline",
      }),
  });

  const jobs = jobsQ.data?.jobs ?? [];
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const isSearchPending = searchQuery !== deferredSearchQuery;

  // ── Derived data ──
  const activeCount = useMemo(
    () =>
      jobs.filter(
        (j: any) => !["completed", "failed", "cancelled"].includes(j.status)
      ).length,
    [jobs]
  );
  const completedCount = useMemo(
    () => jobs.filter((j: any) => j.status === "completed").length,
    [jobs]
  );
  const failedCount = useMemo(
    () => jobs.filter((j: any) => j.status === "failed").length,
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Status filter
    if (statusFilter === "active")
      result = result.filter(
        (j: any) => !["completed", "failed", "cancelled"].includes(j.status)
      );
    else if (statusFilter === "completed")
      result = result.filter((j: any) => j.status === "completed");
    else if (statusFilter === "failed")
      result = result.filter((j: any) => j.status === "failed");

    // Search
    if (normalizedSearchQuery) {
      result = result.filter(
        (j: any) =>
          (j.title || "").toLowerCase().includes(normalizedSearchQuery) ||
          (j.id || "").toLowerCase().includes(normalizedSearchQuery) ||
          (j.sourceType || "").toLowerCase().includes(normalizedSearchQuery)
      );
    }

    return result;
  }, [jobs, normalizedSearchQuery, statusFilter]);

  const handleRetry = useCallback(
    (documentId: string) => reprocessMut.mutate({ documentId }),
    [reprocessMut]
  );
  const handleToggleJob = useCallback((jobId: string) => {
    setExpandedJob(current => (current === jobId ? null : jobId));
  }, []);
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    []
  );

  // ── Empty state ──
  if (jobs.length === 0 && !jobsQ.isLoading) {
    return (
      <motion.div
        key="pipelines"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-5",
              k.inset
            )}
          >
            <Workflow className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <h3 className={cn(k.heading, "text-base mb-2")}>
            No processing activity yet
          </h3>
          <p className={cn(k.subtext, "max-w-sm mb-6")}>
            New content appears here while it is being prepared for the domain
            library. Start by adding some content first.
          </p>
          {onNavigate && (
            <Button onClick={() => onNavigate("ingest")} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Content
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="pipelines"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── Header stats cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="In Progress"
          count={activeCount}
          icon={
            <Loader2
              className={cn(
                "w-5 h-5 text-blue-500",
                activeCount > 0 && "animate-spin"
              )}
            />
          }
          color="blue"
          active={statusFilter === "active"}
          onClick={() =>
            setStatusFilter(statusFilter === "active" ? "all" : "active")
          }
        />
        <StatCard
          label="Ready"
          count={completedCount}
          icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
          color="emerald"
          active={statusFilter === "completed"}
          onClick={() =>
            setStatusFilter(statusFilter === "completed" ? "all" : "completed")
          }
        />
        <StatCard
          label="Needs Attention"
          count={failedCount}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          color="red"
          active={statusFilter === "failed"}
          onClick={() =>
            setStatusFilter(statusFilter === "failed" ? "all" : "failed")
          }
        />
      </div>

      <div className="rounded-2xl border border-border/30 bg-muted/20 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          How status works
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "⏳ In Progress",
              body: "We are still preparing the content, so it is not ready to use yet.",
            },
            {
              title: "✅ Ready",
              body: "The content finished processing and should be available to use.",
            },
            {
              title: "⚠️ Needs Attention",
              body: "Something went wrong. Open the item to see the details or try again.",
            },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-xl border border-border/30 bg-background/80 px-3 py-3"
            >
              <p className="text-xs font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          This page only tracks processing. Review and publish happen in Review
          &amp; Publish.
        </p>
      </div>

      {/* ── Historical metrics from analytics-service ── */}
      {analyticsQ.data && analyticsQ.data.totalIngestJobs > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 px-4 py-2.5 rounded-lg bg-muted/40 border border-border/30 text-sm">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide self-center">
            All-time
          </span>
          <div className="flex items-center gap-1.5">
            <CheckCircle
              className={cn(
                "w-3.5 h-3.5",
                (analyticsQ.data.ingestSuccessRate ?? 0) >= 0.95
                  ? "text-emerald-500"
                  : (analyticsQ.data.ingestSuccessRate ?? 0) >= 0.8
                    ? "text-primary"
                    : "text-red-500"
              )}
            />
            <span className="text-muted-foreground">Success rate</span>
            <span
              className={cn(
                "font-bold tabular-nums",
                (analyticsQ.data.ingestSuccessRate ?? 0) >= 0.95
                  ? "text-emerald-600 dark:text-emerald-400"
                  : (analyticsQ.data.ingestSuccessRate ?? 0) >= 0.8
                    ? "text-primary"
                    : "text-red-600 dark:text-red-400"
              )}
            >
              {((analyticsQ.data.ingestSuccessRate ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Avg duration</span>
            <span className="font-bold tabular-nums text-foreground">
              {analyticsQ.data.avgIngestDurationMs > 0
                ? `${(analyticsQ.data.avgIngestDurationMs / 1000).toFixed(1)}s`
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Total jobs</span>
            <span className="font-bold tabular-nums text-foreground">
              {analyticsQ.data.totalIngestJobs.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Chunks indexed</span>
            <span className="font-bold tabular-nums text-foreground">
              {analyticsQ.data.totalChunksIndexed.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by name, ID, or source..."
            className={cn(k.input, "pl-9")}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {isSearchPending && (
            <span className="text-xs text-muted-foreground">Filtering...</span>
          )}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(k.btnGhost, "text-xs")}
            >
              Clear filter
            </button>
          )}
          <button
            onClick={() => jobsQ.refetch()}
            disabled={jobsQ.isFetching}
            className={cn(k.btnSecondary, "gap-1.5")}
            title="Refresh"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", jobsQ.isFetching && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Job list ── */}
      <div className={cn(k.card, "overflow-hidden")}>
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_100px_100px_60px] gap-3 px-5 py-3 border-b border-border/50 bg-muted/30">
          <span className={cn(k.label, "text-xs")}>Item</span>
          <span className={cn(k.label, "text-xs")}>From</span>
          <span className={cn(k.label, "text-xs")}>Status</span>
          <span className={cn(k.label, "text-xs text-right")}>Time</span>
          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/30">
          {filteredJobs.map((job: any) => (
            <PipelineJobRow
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onToggleJob={handleToggleJob}
              detail={expandedJob === job.id ? jobDetailQ.data : null}
              onNavigate={onNavigate}
              onRetry={handleRetry}
              onCancel={() =>
                cancelJobMut.mutate({
                  jobId: job.id,
                  valueStreamId: job.valueStreamId ?? selectedStream,
                })
              }
              isRetrying={reprocessMut.isPending}
              isCancelling={cancelJobMut.isPending}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <Filter className="w-5 h-5 text-muted-foreground/30 mb-2" />
            <p className={cn(k.subtext)}>No items match your filters</p>
            <button
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className={cn(k.btnGhost, "mt-2")}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {jobsQ.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {/* Quick action — new ingest */}
      {onNavigate && (
        <div className="flex items-center justify-between pt-2">
          <p className={cn(k.muted)}>
            {jobs.length} total item{jobs.length !== 1 ? "s" : ""} in processing
            history
          </p>
          <button
            onClick={() => onNavigate("ingest")}
            className={cn(k.btnSecondary, "gap-1.5")}
          >
            <Plus className="w-3.5 h-3.5" />
            Add More Content
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        k.card,
        "flex items-center gap-4 px-5 py-4 transition-all duration-200",
        "kb-duotone-border-hover",
        active && "ring-2 ring-primary/20 border-primary/30"
      )}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center",
          `bg-${color}-500/10`
        )}
      >
        {icon}
      </div>
      <div className="text-left">
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {count}
        </p>
        <p className={cn(k.muted)}>{label}</p>
      </div>
    </button>
  );
}

// ── Pipeline Job Row ─────────────────────────────────────────────────────────

const PipelineJobRow = memo(function PipelineJobRow({
  job,
  expanded,
  onToggleJob,
  detail,
  onNavigate,
  onRetry,
  onCancel,
  isRetrying,
  isCancelling,
}: {
  job: any;
  expanded: boolean;
  onToggleJob: (jobId: string) => void;
  detail: any;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
  onRetry?: (documentId: string) => void;
  onCancel?: () => void;
  isRetrying?: boolean;
  isCancelling?: boolean;
}) {
  const meta = JOB_STATUS_META[job.status] ?? JOB_STATUS_META.queued;
  const StatusIcon = meta?.Icon ?? Clock;
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";
  const isTerminal = isCompleted || isFailed || isCancelled;
  const stagesCompleted = detail?.stagesCompleted ?? [];
  const failedAtStage = detail?.job?.failedAtStage ?? null;
  const hasDocument = !!job.documentId;
  const canReAdd = isFailed && !hasDocument && !!onNavigate;
  const canCancel = !isTerminal && !!onCancel;

  const statusLabel = getPipelineStatusLabel(job.status, {
    failedAtStage,
    tone: "compact",
  });

  return (
    <div
      className={cn(
        "transition-all",
        expanded
          ? "bg-primary/2 dark:bg-primary/4"
          : isFailed
            ? "bg-red-500/2 hover:bg-red-500/4"
            : "hover:bg-muted/30"
      )}
    >
      {/* Main row — div+role avoids nested <button> (browser/hydration error) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggleJob(job.id)}
        onKeyDown={e =>
          (e.key === "Enter" || e.key === " ") && onToggleJob(job.id)
        }
        className="w-full grid grid-cols-[1fr_120px_100px_100px_60px] gap-3 items-center px-5 py-3 text-left cursor-pointer"
      >
        {/* Job info */}
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon
            className={cn(
              "w-4 h-4 shrink-0",
              meta?.color ?? "text-muted-foreground",
              isPipelineProcessingStatus(job.status) && "animate-spin"
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {job.title || job.id?.slice(0, 12)}
            </p>
            {job.chunkCount > 0 && (
              <p className={cn(k.muted, "text-xs flex items-center gap-1")}>
                <FileText className="w-3 h-3" />
                {job.chunkCount} sections
              </p>
            )}
          </div>
        </div>

        {/* Source type */}
        <div>
          <Badge variant="outline" className="text-xs font-mono">
            {job.sourceType || "—"}
          </Badge>
        </div>

        {/* Status */}
        <div>
          <Badge
            variant={
              isCompleted ? "default" : isFailed ? "destructive" : "secondary"
            }
            className={cn(
              "text-xs",
              isCompleted &&
                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
              !isTerminal && "animate-pulse"
            )}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Duration */}
        <div className="text-right">
          {job.processingTimeMs > 0 ? (
            <span className={cn(k.mono, "text-xs")}>
              {(job.processingTimeMs / 1000).toFixed(1)}s
            </span>
          ) : !isTerminal ? (
            <span className={cn(k.muted, "text-xs animate-pulse")}>
              in progress
            </span>
          ) : (
            <span className={cn(k.muted, "text-xs")}>—</span>
          )}
        </div>

        {/* Expand chevron + quick actions */}
        <div className="flex items-center justify-end gap-1">
          {isCompleted && hasDocument && onNavigate && (
            <button
              onClick={e => {
                e.stopPropagation();
                onNavigate("library", job.documentId);
              }}
              className="p-1.5 rounded-lg kb-duotone-icon-hover"
              title="View in Library"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {isFailed && hasDocument && onRetry && (
            <button
              onClick={e => {
                e.stopPropagation();
                onRetry(job.documentId);
              }}
              disabled={isRetrying}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
              title="Retry"
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
              onClick={e => {
                e.stopPropagation();
                onNavigate?.("ingest");
              }}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
              title="Add Again"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground/40 transition-transform",
              expanded && "rotate-90"
            )}
          />
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1">
              {/* Stage progress */}
              <div className="flex items-center gap-1 mb-3">
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

              {/* Metadata */}
              <div
                className={cn(
                  "grid grid-cols-4 gap-4 text-xs p-3 rounded-lg",
                  k.inset
                )}
              >
                <div>
                  <span className={cn(k.label, "text-xs")}>Job ID</span>
                  <p className={cn(k.mono, "mt-0.5")}>{job.id?.slice(0, 16)}</p>
                </div>
                <div>
                  <span className={cn(k.label, "text-xs")}>Created</span>
                  <p className={cn(k.mono, "mt-0.5")}>
                    {job.createdAt
                      ? new Date(job.createdAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                {job.documentId && (
                  <div>
                    <span className={cn(k.label, "text-xs")}>Document</span>
                    <p className={cn(k.mono, "mt-0.5")}>
                      {job.documentId?.slice(0, 16)}
                    </p>
                  </div>
                )}
                {job.chunkCount > 0 && (
                  <div>
                    <span className={cn(k.label, "text-xs")}>Sections</span>
                    <p className={cn(k.mono, "mt-0.5")}>{job.chunkCount}</p>
                  </div>
                )}
              </div>

              <PipelineCoachCards
                className="mt-3"
                status={job.status}
                failedAtStage={failedAtStage}
                error={detail?.job?.error}
              />

              {/* Error detail for failed jobs */}
              {isFailed && detail?.job?.error && (
                <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
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
                      title="Copy full error"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                {isCompleted && hasDocument && onNavigate && (
                  <button
                    onClick={() => onNavigate("library", job.documentId)}
                    className={cn(k.btnSecondary, "gap-1.5")}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View in Library
                  </button>
                )}
                {isCompleted && hasDocument && onNavigate && (
                  <button
                    onClick={() => onNavigate("validate", "test")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/18 transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    Try Sample Questions
                  </button>
                )}
                {isFailed && hasDocument && onRetry && (
                  <button
                    onClick={() => onRetry(job.documentId)}
                    disabled={isRetrying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-primary bg-primary/10 hover:bg-primary/18 transition-colors disabled:opacity-40"
                  >
                    {isRetrying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="w-3.5 h-3.5" />
                    )}
                    Retry
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCancel?.();
                    }}
                    disabled={isCancelling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/18 transition-colors disabled:opacity-40"
                  >
                    {isCancelling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Cancel Job
                  </button>
                )}
                {canReAdd && (
                  <button
                    onClick={() => onNavigate?.("ingest")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-primary bg-primary/10 hover:bg-primary/18 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Add Again
                  </button>
                )}
                {isFailed && !detail?.job?.error && (
                  <span className="flex items-center gap-1.5 ml-auto text-xs text-red-500/70">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Pipeline failed
                  </span>
                )}
                {!isTerminal && (
                  <span className="flex-1 text-right text-xs text-muted-foreground/50 animate-pulse">
                    Still working…
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}, arePipelineJobRowPropsEqual);

function arePipelineJobRowPropsEqual(
  prev: Readonly<{
    job: any;
    expanded: boolean;
    onToggleJob: (jobId: string) => void;
    detail: any;
    onNavigate?: (tab: KnowledgeTab, section?: string) => void;
    onRetry?: (documentId: string) => void;
    isRetrying?: boolean;
    onCancel?: () => void;
    isCancelling?: boolean;
  }>,
  next: Readonly<{
    job: any;
    expanded: boolean;
    onToggleJob: (jobId: string) => void;
    detail: any;
    onNavigate?: (tab: KnowledgeTab, section?: string) => void;
    onRetry?: (documentId: string) => void;
    isRetrying?: boolean;
    onCancel?: () => void;
    isCancelling?: boolean;
  }>
) {
  return (
    prev.job === next.job &&
    prev.expanded === next.expanded &&
    prev.detail === next.detail &&
    prev.onNavigate === next.onNavigate &&
    prev.onRetry === next.onRetry &&
    prev.onCancel === next.onCancel &&
    prev.onToggleJob === next.onToggleJob &&
    prev.isRetrying === next.isRetrying &&
    prev.isCancelling === next.isCancelling
  );
}
