import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn, textColor, HkiCard } from "@hki/ui";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { a } from "../theme";
import type { RouterOutputs } from "@/lib/trpc";

type KnowledgeOpsSummary = RouterOutputs["admin"]["knowledgeOperationsSummary"];
export type KnowledgeOpsJob = KnowledgeOpsSummary["recentActiveJobs"][number];

interface KBStat {
  label: string;
  rawValue: number | string;
  displayValue?: string | number;
  sub: string;
  icon: React.ElementType;
}

interface KnowledgeStatsGridProps {
  stats: KBStat[];
  jobs?: KnowledgeOpsJob[];
  isLoading: boolean;
  summary?: string;
  scopeControl?: ReactNode;
  actionLabel?: string;
  onExplore: () => void;
}

export function KnowledgeStatsGrid({
  stats,
  jobs = [],
  isLoading,
  summary,
  scopeControl,
  actionLabel = "Manage",
  onExplore,
}: KnowledgeStatsGridProps) {
  const activeJobs = jobs
    .filter(j => !["completed", "failed"].includes(j.status))
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="flex flex-col"
    >
      <HkiCard
        interactive={false}
        elevation="raised"
        className={cn(a.card, "relative isolate overflow-hidden")}
      >
        <div className="relative z-10 flex flex-col lg:flex-row">
          <div
            className={cn(a.dataPanel, "flex flex-1 flex-col backdrop-blur-sm")}
          >
            <div
              className={cn(
                a.cardHeader,
                "flex flex-col gap-3 px-5 pt-4 pb-3 lg:flex-row lg:items-start lg:justify-between"
              )}
            >
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-foreground">
                  Knowledge Operations
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {summary ?? "Indexing, graph coverage, and ingestion status."}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between lg:w-auto lg:justify-end">
                {scopeControl}
                <button
                  onClick={onExplore}
                  className={cn(
                    a.toolbarButton,
                    "inline-flex items-center justify-center gap-1 self-start rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
                  )}
                >
                  {actionLabel} <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3">
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className={cn(
                    a.metricCard,
                    "admin-knowledge-kpi-card",
                    "group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-xl px-5 py-4 transition-all duration-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        a.metricIcon,
                        a.iconPrimary,
                        "admin-knowledge-kpi-icon",
                        "w-8 h-8 rounded-[0.625rem] flex items-center justify-center"
                      )}
                    >
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <span className={a.metricLabel}>{stat.label}</span>
                  </div>
                  <div className="space-y-1">
                    <p className={cn(a.metricValue, "tabular-nums")}>
                      {isLoading
                        ? "..."
                        : "displayValue" in stat
                          ? stat.displayValue
                          : stat.rawValue}
                    </p>
                    <span className="block text-[10px] text-muted-foreground">
                      {stat.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeJobs.length > 0 && (
            <div
              className={cn(
                a.dataPanel,
                "flex min-h-35 flex-1 flex-col gap-3 p-5 backdrop-blur-sm lg:min-h-0 lg:max-w-md"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-foreground">
                  Active Pipeline Jobs
                </h3>
                <span
                  className={cn(
                    a.pillPrimary,
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  )}
                >
                  <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  {activeJobs.length} active
                </span>
              </div>

              <div className="space-y-2">
                {activeJobs.map((job: KnowledgeOpsJob) => (
                  <div
                    key={job.id}
                    className={cn(
                      a.previewRow,
                      "flex items-center justify-between p-3 rounded-xl group transition-all"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          a.iconPrimary,
                          "w-8 h-8 rounded-lg flex items-center justify-center"
                        )}
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            textColor.heading,
                            "dark:text-foreground/78"
                          )}
                        >
                          {job.documentType || "Ingestion Job"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {job.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-medium text-primary">
                        0%
                      </div>
                      <div className="w-20 h-1 rounded-full bg-muted mt-1 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `0%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </HkiCard>
    </motion.div>
  );
}
