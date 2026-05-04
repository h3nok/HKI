import { motion } from "framer-motion";
import { cn, HkiCard } from "@hki/ui";
import { TrendingUp, BarChart3, Zap, Activity } from "lucide-react";
import { a, type AdminTone } from "../theme";
import {
  ConfidenceAreaChart,
  ToolPerformanceChart,
  IngestionTimelineChart,
  ResourceUsageChart,
} from "../DashboardCharts";

interface DashboardChartsGridProps {
  traces: any[];
  toolStats: any[];
  ingestionData: any;
  resourceData: any;
}

// #7 — Chart config with question-style titles
const CHART_CONFIG = [
  {
    key: "confidence",
    title: "How is agent quality trending?",
    subtitle: "Response confidence scores · Last 24 hours",
    icon: TrendingUp,
    tone: "primary" as AdminTone,
  },
  {
    key: "tools",
    title: "Which tools are agents using?",
    subtitle: "Top tools by call volume · Last 24 hours",
    icon: BarChart3,
    tone: "primary" as AdminTone,
  },
  {
    key: "ingestion",
    title: "Is the knowledge pipeline healthy?",
    subtitle: "Ingestion job completion · Last 7 days",
    icon: Activity,
    tone: "warning" as AdminTone,
  },
  {
    key: "resources",
    title: "What are we consuming today?",
    subtitle: "Platform resource utilization · Today",
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
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
              <HkiCard
                elevation="raised"
                size="md"
                interactive={false}
                className={cn(a.card, "overflow-hidden h-full flex flex-col")}
              >
                <div className={cn(a.cardHeader, "px-4 pt-3 pb-2 flex items-center gap-3")}>
                  <div
                    className={cn(
                      a.metricIcon,
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      ICON_TONE[chart.tone]
                    )}
                  >
                    <ChartIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground dark:text-foreground/78 truncate">
                      {chart.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {chart.subtitle}
                    </p>
                  </div>
                </div>
                <div className="px-2 pb-2 flex-1">{chartComponents[i]}</div>
              </HkiCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
