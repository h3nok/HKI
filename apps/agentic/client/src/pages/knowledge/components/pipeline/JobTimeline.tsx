import { cn, Badge, Progress, Skeleton } from "@hki/ui";
import { CheckCircle, XCircle, Loader2, Clock, FileText } from "lucide-react";
import { PIPELINE_STAGES, STATUS_TO_STAGE_INDEX } from "./StageNode";
import type { PipelineJob } from "./PipelineGraph";
import { getPipelineStatusLabel } from "../../pipelineCopy";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getProgressPercent(status: string): number {
  if (status === "completed") return 100;
  if (status === "failed") return 0;
  const idx = STATUS_TO_STAGE_INDEX[status] ?? 0;
  return Math.round((idx / (PIPELINE_STAGES.length - 1)) * 100);
}

function getStageLabel(status: string): string {
  return getPipelineStatusLabel(status, { tone: "compact" });
}

// ── Single job row ───────────────────────────────────────────────────────────

interface JobRowProps {
  job: PipelineJob;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function JobRow({ job, isSelected, onSelect }: JobRowProps) {
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isActive = !isCompleted && !isFailed;
  const progress = getProgressPercent(job.status);

  return (
    <button
      onClick={() => onSelect(job.id)}
      className={cn(
        "w-full text-left p-3 rounded-xl transition-all duration-150",
        "hover:bg-muted/60/50 dark:hover:bg-card/50",
        isSelected && "bg-muted/60 dark:bg-muted/60 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
        ) : isFailed ? (
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">
              {job.title || "Untitled"}
            </span>
            <Badge
              variant={
                isCompleted ? "success" : isFailed ? "destructive" : "secondary"
              }
              className={cn(
                "text-xs px-1.5 py-0 h-4 uppercase tracking-wider shrink-0",
                isCompleted && "bg-primary text-white",
                isFailed && "bg-red-500 text-white",
                isActive && "bg-blue-500 text-white"
              )}
            >
              {getStageLabel(job.status)}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <Progress
              value={progress}
              className="h-1 flex-1"
              indicatorClassName={cn(
                isCompleted && "bg-primary",
                isFailed && "bg-red-500",
                isActive && "bg-primary"
              )}
            />
            <span className="text-xs text-muted-foreground/60 font-mono w-7 text-right shrink-0">
              {progress}%
            </span>
          </div>
        </div>

        {/* Timing */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {job.source_type && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0 h-4 font-mono text-muted-foreground dark:text-muted-foreground border-border/30 dark:border-border/30"
            >
              {job.source_type}
            </Badge>
          )}
          {job.processing_time_ms != null && job.processing_time_ms > 0 && (
            <span className="text-xs text-muted-foreground/60 font-mono">
              {(job.processing_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {job.chunk_count != null && job.chunk_count > 0 && (
            <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
              <FileText className="w-2.5 h-2.5" /> {job.chunk_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Job list ─────────────────────────────────────────────────────────────────

interface JobTimelineProps {
  jobs: PipelineJob[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  isLoading?: boolean;
}

export function JobTimeline({
  jobs,
  selectedJobId,
  onSelectJob,
  isLoading,
}: JobTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="w-4 h-4 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-1 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="w-8 h-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground/60">
          No ingestion jobs yet
        </p>
        <p className="text-xs text-muted-foreground/50 dark:text-muted-foreground mt-0.5">
          Upload content to watch the pipeline turn it into answerable knowledge
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 max-h-[460px] overflow-y-auto">
      {jobs.slice(0, 25).map(job => (
        <JobRow
          key={job.id}
          job={job}
          isSelected={selectedJobId === job.id}
          onSelect={onSelectJob}
        />
      ))}
    </div>
  );
}
