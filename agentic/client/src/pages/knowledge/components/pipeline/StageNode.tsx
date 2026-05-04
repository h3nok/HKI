import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  cn,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@hki/ui";
import {
  Upload,
  FileSearch,
  Sparkles,
  Brain,
  Scissors,
  Binary,
  Database,
  CheckCircle,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// ── Stage metadata ───────────────────────────────────────────────────────────

export type StageStatus = "idle" | "active" | "completed" | "failed";

export interface StageData {
  label: string;
  icon: LucideIcon;
  status: StageStatus;
  duration?: string;
  detail?: string;
  progress?: number;
}

export const PIPELINE_STAGES = [
  {
    label: "Upload",
    icon: Upload,
    detail: "Receive the source and queue the job",
  },
  {
    label: "Read",
    icon: FileSearch,
    detail: "Pull usable text out of the source",
  },
  {
    label: "Clean Up",
    icon: Sparkles,
    detail: "Remove formatting noise and normalize the text",
  },
  {
    label: "Key Facts",
    icon: Brain,
    detail: "Look for titles, dates, and important topics",
  },
  {
    label: "Sections",
    icon: Scissors,
    detail: "Break the content into answerable sections",
  },
  {
    label: "Search",
    icon: Binary,
    detail: "Turn each section into a searchable representation",
  },
  {
    label: "Catalog",
    icon: Database,
    detail: "Store the sections so the agent can find them later",
  },
  {
    label: "Ready",
    icon: CheckCircle,
    detail: "This content can now support live answers",
  },
] as const;

/** Map backend JobStatus → index into PIPELINE_STAGES */
export const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  queued: 0,
  extracting: 1,
  cleaning: 2,
  enriching: 3,
  chunking: 4,
  embedding: 5,
  indexing: 6,
  completed: 7,
  failed: -1,
};

// ── Badge variant mapping ────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<
  StageStatus,
  "secondary" | "success" | "destructive" | "outline"
> = {
  idle: "outline",
  active: "secondary",
  completed: "success",
  failed: "destructive",
};

// ── Component ────────────────────────────────────────────────────────────────

function StageNodeInner({ data }: NodeProps) {
  const d = data as unknown as StageData;
  const Icon = d.icon;
  const isActive = d.status === "active";
  const isCompleted = d.status === "completed";
  const isFailed = d.status === "failed";
  const isIdle = d.status === "idle";

  const tooltipText = [d.label, d.duration && `${d.duration}`, d.detail]
    .filter(Boolean)
    .join(" · ");

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-2 cursor-default">
            {/* Node circle */}
            <div
              className={cn(
                "relative w-16 h-16 rounded-2xl flex items-center justify-center",
                "ring-2 transition-all duration-300",
                isIdle &&
                  "ring-border dark:ring-border bg-muted/60 dark:bg-muted/60",
                isActive &&
                  "ring-primary/50 bg-primary/10 dark:bg-primary/10 shadow-lg shadow-primary/15",
                isCompleted && "ring-primary/25 bg-primary/5 dark:bg-primary/5",
                isFailed && "ring-red-500/40 bg-red-500/5"
              )}
            >
              {isActive ? (
                <Loader2 className="w-7 h-7 animate-spin text-primary dark:text-primary" />
              ) : isCompleted ? (
                <div className="relative">
                  <Icon className="w-7 h-7 text-primary" />
                  <CheckCircle className="absolute -bottom-1.5 -right-1.5 w-4 h-4 text-primary bg-white dark:bg-card rounded-full" />
                </div>
              ) : isFailed ? (
                <div className="relative">
                  <Icon className="w-7 h-7 text-red-500" />
                  <XCircle className="absolute -bottom-1.5 -right-1.5 w-4 h-4 text-red-500 bg-white dark:bg-card rounded-full" />
                </div>
              ) : (
                <Icon className="w-7 h-7 text-muted-foreground/50 dark:text-muted-foreground" />
              )}

              {/* Pulse indicator for active */}
              {isActive && (
                <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/10 pointer-events-none" />
              )}
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                isIdle && "text-muted-foreground/50 dark:text-muted-foreground",
                isActive && "text-primary dark:text-primary",
                isCompleted && "text-muted-foreground/60",
                isFailed && "text-red-500"
              )}
            >
              {d.label}
            </span>

            {/* Duration badge */}
            {d.duration && (
              <Badge
                variant={STATUS_BADGE_VARIANT[d.status]}
                className={cn(
                  "text-xs px-2 py-0.5 font-mono",
                  d.status === "completed" && "bg-primary text-white",
                  d.status === "active" && "bg-blue-500 text-white",
                  d.status === "failed" && "bg-red-500 text-white",
                  d.status === "idle" &&
                    "border-border/30 dark:border-border/30 text-muted-foreground dark:text-muted-foreground"
                )}
              >
                {d.duration}
              </Badge>
            )}

            {/* Handles (invisible, used by React Flow edges) */}
            <Handle
              type="target"
              position={Position.Left}
              className="w-0! h-0! border-0! bg-transparent!"
            />
            <Handle
              type="source"
              position={Position.Right}
              className="w-0! h-0! border-0! bg-transparent!"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const StageNode = memo(StageNodeInner);
