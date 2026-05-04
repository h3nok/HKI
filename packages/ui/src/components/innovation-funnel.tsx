/**
 * Innovation Funnel Component
 *
 * Visualizes the innovation stage-gate funnel with initiative counts.
 */

import * as React from "react";
import { cn } from "../utils";

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  color: string;
  icon?: React.ReactNode;
}

export interface InnovationFunnelProps extends React.HTMLAttributes<HTMLDivElement> {
  stages: FunnelStage[];
  showCounts?: boolean;
  showLabels?: boolean;
  onStageClick?: (stageId: string) => void;
  orientation?: "horizontal" | "vertical";
}

const InnovationFunnel = React.forwardRef<HTMLDivElement, InnovationFunnelProps>(
  (
    {
      className,
      stages,
      showCounts = true,
      showLabels = true,
      onStageClick,
      orientation = "horizontal",
      ...props
    },
    ref
  ) => {
    const totalCount = stages.reduce((sum, stage) => sum + stage.count, 0);
    const maxCount = Math.max(...stages.map(s => s.count), 1);

    if (orientation === "vertical") {
      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {stages.map((stage) => {
            const widthPercent = (stage.count / maxCount) * 100;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3",
                  onStageClick && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={() => onStageClick?.(stage.id)}
              >
                {showLabels && (
                  <div className="w-20 text-sm font-medium text-gray-600 text-right shrink-0">
                    {stage.label}
                  </div>
                )}
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg flex items-center justify-end px-3 transition-all duration-300"
                    style={{
                      width: `${Math.max(widthPercent, 10)}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    {showCounts && (
                      <span className="text-sm font-semibold text-white">
                        {stage.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Horizontal orientation (default)
    return (
      <div ref={ref} className={cn("flex items-end gap-1", className)} {...props}>
        {stages.map((stage) => {
          const heightPercent = totalCount > 0
            ? (stage.count / maxCount) * 100
            : 20;
          const minHeight = 40;
          const maxHeight = 120;
          const actualHeight = Math.max(
            minHeight,
            (heightPercent / 100) * maxHeight
          );

          return (
            <div
              key={stage.id}
              className={cn(
                "flex flex-col items-center gap-2 flex-1",
                onStageClick && "cursor-pointer group"
              )}
              onClick={() => onStageClick?.(stage.id)}
            >
              <div
                className={cn(
                  "w-full rounded-t-lg transition-all duration-300",
                  onStageClick && "group-hover:opacity-80"
                )}
                style={{
                  height: `${actualHeight}px`,
                  backgroundColor: stage.color,
                }}
              >
                {showCounts && (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {stage.count}
                    </span>
                  </div>
                )}
              </div>
              {showLabels && (
                <span className="text-xs font-medium text-gray-600 text-center">
                  {stage.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);
InnovationFunnel.displayName = "InnovationFunnel";

/**
 * Default stage configuration for innovation funnel
 */
const DEFAULT_FUNNEL_STAGES: Omit<FunnelStage, "count">[] = [
  { id: "INTAKE", label: "Intake", color: "#6366f1" },
  { id: "TRIAGE", label: "Triage", color: "#8b5cf6" },
  { id: "EXPLORE", label: "Explore", color: "#0ea5e9" },
  { id: "PILOT", label: "Pilot", color: "#f59e0b" },
  { id: "SCALE", label: "Scale", color: "#10b981" },
  { id: "OPERATE", label: "Operate", color: "#22c55e" },
];

export { InnovationFunnel, DEFAULT_FUNNEL_STAGES };
