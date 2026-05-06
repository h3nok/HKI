import { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  ConnectionLineType,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@hki/ui";
import { Activity } from "lucide-react";
import {
  StageNode,
  PIPELINE_STAGES,
  STATUS_TO_STAGE_INDEX,
  type StageData,
  type StageStatus,
} from "./StageNode";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineJob {
  id: string;
  title: string;
  status: string;
  source_type?: string;
  chunk_count?: number;
  processing_time_ms?: number;
  created_at?: string;
}

interface PipelineGraphProps {
  /** The most recent / selected job to visualize */
  job: PipelineJob | null;
  /** Loading state */
  isLoading?: boolean;
}

// ── Node types registry ──────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  stage: StageNode,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildNodesAndEdges(job: PipelineJob | null) {
  const activeIdx = job ? (STATUS_TO_STAGE_INDEX[job.status] ?? -1) : -1;
  const isFailed = job?.status === "failed";

  const nodes = PIPELINE_STAGES.map((stage, i) => {
    let status: StageStatus = "idle";
    if (job) {
      if (isFailed && i === 0) status = "failed";
      else if (i < activeIdx) status = "completed";
      else if (i === activeIdx)
        status = isFailed
          ? "failed"
          : job.status === "completed"
            ? "completed"
            : "active";
    }

    const data: StageData = {
      label: stage.label,
      icon: stage.icon,
      status,
      duration:
        status === "completed" && job?.processing_time_ms
          ? `${(job.processing_time_ms / PIPELINE_STAGES.length / 1000).toFixed(1)}s`
          : undefined,
      detail: [
        stage.detail,
        status === "completed" && i === 6 && job?.chunk_count
          ? `${job.chunk_count} chunks ready for retrieval`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    };

    return {
      id: `stage-${i}`,
      type: "stage",
      position: { x: i * 180, y: 0 },
      data: data as unknown as Record<string, unknown>,
      draggable: false,
      selectable: false,
    };
  });

  const edges: Edge[] = PIPELINE_STAGES.slice(0, -1).map((_, i) => {
    const sourceStatus = (nodes[i].data as unknown as StageData).status;
    const isCompletedEdge = sourceStatus === "completed";

    return {
      id: `e-${i}-${i + 1}`,
      source: `stage-${i}`,
      target: `stage-${i + 1}`,
      type: ConnectionLineType.SmoothStep,
      animated: sourceStatus === "active",
      style: {
        stroke: isCompletedEdge
          ? "hsl(var(--primary))"
          : "hsl(var(--muted-foreground) / 0.3)",
        strokeWidth: isCompletedEdge ? 2.5 : 2,
        opacity: isCompletedEdge ? 0.7 : 0.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: isCompletedEdge
          ? "hsl(var(--primary))"
          : "hsl(var(--muted-foreground) / 0.3)",
      },
    };
  });

  return { nodes, edges };
}

// ── Component ────────────────────────────────────────────────────────────────

export function PipelineGraph({ job, isLoading }: PipelineGraphProps) {
  const { nodes, edges } = useMemo(() => buildNodesAndEdges(job), [job]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2 px-5 pt-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-center justify-around py-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="w-16 h-16 rounded-2xl" />
                <Skeleton className="w-12 h-3 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> How Content Becomes
          Searchable
          {job && (
            <span className="text-xs font-normal text-muted-foreground/60 ml-auto truncate max-w-50">
              {job.title || "Untitled"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="w-full h-55">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            zoomOnPinch={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          />
        </div>
      </CardContent>
    </Card>
  );
}
