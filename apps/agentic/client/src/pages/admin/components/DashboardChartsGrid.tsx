import { motion } from "framer-motion";
import { cn, HermeticCard } from "@hki/ui";
import { TrendingUp, BarChart3, Zap, Activity } from "lucide-react";
import { a, type AdminTone } from "../theme";
import {
  ConfidenceAreaChart,
  ToolPerformanceChart,
  IngestionTimelineChart,
  ResourceUsageChart,
} from "../DashboardCharts";
import type { RouterOutputs } from "@/lib/trpc";
import type { KnowledgeOpsJob } from "./KnowledgeStatsGrid";

type RecentTrace = RouterOutputs["governance"]["recentTraces"][number];
type ToolStat = RouterOutputs["governance"]["toolStats"][number];
type ResourceMetrics = RouterOutputs["governance"]["resourceMetrics"];

interface DashboardChartsGridProps {
  traces: RecentTrace[];
  toolStats: ToolStat[];
  ingestionData: KnowledgeOpsJob[];
  resourceData: ResourceMetrics | null | undefined;
}

// #7 — Chart config with question-style titles
const CHART_CONFIG = [
  {
    key: "confidence",
    title: "Agent Quality",
    subtitle: "Confidence trend with 80% target · recent traces",
    icon: TrendingUp,
    tone: "primary" as AdminTone,
  },
  {
    key: "tools",
    title: "Tool Performance",
    subtitle: "Usage, success rate, and average speed",
    icon: BarChart3,
    tone: "primary" as AdminTone,
  },
  {
    key: "ingestion",
    title: "Pipeline Health",
    subtitle: "Completed, active, and failed ingestion jobs",
    icon: Activity,
    tone: "warning" as AdminTone,
  },
  {
    key: "resources",
    title: "Resource Runway",
    subtitle: "Token budget pressure and daily usage",
    icon: Zap,
    tone: "warning" as AdminTone,
  },
] as const;

const ICON_TONE: Record<AdminTone, string> = {
  primary: a.iconPrimary,
  positive: a.iconPositive,
  warning: a.iconWarning,
  critical: a.iconCritical,
  neutral: a.iconNeutral,
};

export function DashboardChartsGrid({
  traces,
  toolStats,
  ingestionData,
  resourceData,
}: DashboardChartsGridProps) {
  const chartComponents = [
    <ConfidenceAreaChart traces={traces} />,
    <ToolPerformanceChart tools={toolStats} />,
    <IngestionTimelineChart jobs={ingestionData} />,
    <ResourceUsageChart data={resourceData} />,
  ];

  return (
    <div>
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 h-full">
        {CHART_CONFIG.map((chart, i) => {
          const ChartIcon = chart.icon;
          return (
            <motion.div
              key={chart.key}
              className="h-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.38 + i * 0.02 }}
            >
              <HermeticCard
                elevation="raised"
                size="md"
                interactive={false}
                className={cn(
                  a.card,
                  "min-w-0 rounded-xl overflow-hidden h-full flex flex-col"
                )}
              >
                <div
                  className={cn(
                    a.cardHeader,
                    "px-4 pt-3 pb-2 flex items-center gap-3"
                  )}
                >
                  <div
                    className={cn(
                      a.metricIcon,
                      "w-8 h-8 rounded-[0.625rem] flex items-center justify-center shrink-0",
                      ICON_TONE[chart.tone]
                    )}
                  >
                    <ChartIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {chart.title}
                    </h3>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {chart.subtitle}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 px-2 pb-2 flex-1">
                  {chartComponents[i]}
                </div>
              </HermeticCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
