/**
 * InsightsTab — Analytics & intelligence dashboard for the knowledge platform.
 *
 * Sections:
 *   1. Health summary — 6 metric cards (events, users, searches, CMOS, ingest, quality)
 *   2. Search Quality — retrieval score, CMOS, chunks per search
 *   3. Ingestion Health — success rate, throughput, avg duration
 *   4. Platform Activity — events by type breakdown, service distribution
 *   5. Smart Recommendations — AI-generated "what needs attention" alerts
 *
 * Pulls from:  trpc.knowledge.analyticsMetrics
 *              trpc.knowledge.stats
 *              trpc.knowledge.serviceHealth
 *              trpc.knowledge.observabilitySummary
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  ShieldCheck,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Search,
  FileText,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../theme";
import { useKB } from "../context/KnowledgeContext";

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const child = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

// ── Metric rating helpers ─────────────────────────────────────────────────────

type Rating = "good" | "warn" | "bad" | "neutral";

function rateSearchScore(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 0.7) return "good";
  if (v >= 0.4) return "warn";
  return "bad";
}

function rateIngestSuccess(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 0.95) return "good";
  if (v >= 0.8) return "warn";
  return "bad";
}

function rateCmos(v: number): Rating {
  if (v === 0) return "neutral";
  if (v <= 2000) return "good";
  if (v <= 4000) return "warn";
  return "bad";
}

function rateRagas(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 0.8) return "good";
  if (v >= 0.6) return "warn";
  return "bad";
}

const RATING_COLORS: Record<
  Rating,
  { text: string; bg: string; ring: string }
> = {
  good: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  warn: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  bad: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/20",
  },
  neutral: {
    text: "text-muted-foreground",
    bg: "bg-black/[0.03] dark:bg-muted/40",
    ring: "ring-border",
  },
};

function TrendIcon({ rating }: { rating: Rating }) {
  if (rating === "good")
    return <ArrowUpRight className="w-3 h-3 text-emerald-500" />;
  if (rating === "bad")
    return <ArrowDownRight className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground/50" />;
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sublabel,
  rating = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  rating?: Rating;
}) {
  const c = RATING_COLORS[rating];
  return (
    <motion.div
      variants={child}
      className={cn(k.card, "px-4 py-4 flex flex-col gap-2 ring-1", c.ring)}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            c.bg
          )}
        >
          <Icon className={cn("w-4 h-4", c.text)} />
        </div>
        <TrendIcon rating={rating} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-medium text-muted-foreground/60">
              {unit}
            </span>
          )}
        </div>
        <p className={cn("text-[11px] font-semibold mt-0.5", c.text)}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">{sublabel}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Bar chart (pure CSS) ──────────────────────────────────────────────────────

function MiniBar({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground w-20 truncate text-right">
            {item.label}
          </span>
          <div className="flex-1 h-5 rounded-md bg-black/3 dark:bg-muted/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn("h-full rounded-md", item.color)}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-muted-foreground w-8">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Service health badge ──────────────────────────────────────────────────────

function ServiceBadge({
  name,
  ok,
  latencyMs,
}: {
  name: string;
  ok: boolean;
  latencyMs: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors",
        ok
          ? "border-emerald-500/20 bg-emerald-500/4"
          : "border-red-500/20 bg-red-500/4"
      )}
    >
      <div
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          ok ? "bg-emerald-500 animate-pulse" : "bg-red-500"
        )}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground capitalize">
          {name.replace(/-/g, " ")}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground/60">
          {ok ? `${latencyMs}ms` : "Unreachable"}
        </p>
      </div>
      {ok ? (
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto shrink-0" />
      )}
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function Recommendation({
  severity,
  title,
  description,
}: {
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}) {
  const cfg = {
    info: {
      icon: Lightbulb,
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/8",
      border: "border-blue-500/15",
    },
    warning: {
      icon: AlertTriangle,
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/8",
      border: "border-amber-500/15",
    },
    critical: {
      icon: XCircle,
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/8",
      border: "border-red-500/15",
    },
  }[severity];

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border",
        cfg.border,
        cfg.bg
      )}
    >
      <cfg.icon className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.text)} />
      <div>
        <p className={cn("text-xs font-semibold", cfg.text)}>{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsightsTab() {
  const { selectedStream } = useKB();
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : undefined;
  const scopedMetricsInput = explicitStreamId
    ? { valueStreamId: explicitStreamId }
    : undefined;
  const analyticsQ = trpc.knowledge.analyticsMetrics.useQuery(
    scopedMetricsInput,
    {
      retry: false,
      staleTime: 30_000,
    }
  );
  const statsQ = trpc.knowledge.stats.useQuery(scopedMetricsInput, {
    retry: false,
    staleTime: 30_000,
  });
  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const obsQ = trpc.knowledge.observabilitySummary.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const a = analyticsQ.data;
  const stats = statsQ.data;
  const services = healthQ.data?.services ?? [];
  const obs = obsQ.data;

  // Derive recommendations
  const recommendations = useMemo(() => {
    const recs: {
      severity: "info" | "warning" | "critical";
      title: string;
      description: string;
    }[] = [];

    if (a) {
      if (a.avgTopScore > 0 && a.avgTopScore < 0.4) {
        recs.push({
          severity: "critical",
          title: "Search quality is low",
          description:
            "Average retrieval score is below 0.4. Consider adding more targeted content or refining document chunking settings.",
        });
      } else if (a.avgTopScore > 0 && a.avgTopScore < 0.7) {
        recs.push({
          severity: "warning",
          title: "Search quality could improve",
          description:
            "Average retrieval score is moderate. Run a gap analysis to find missing topics and add targeted documents.",
        });
      }

      if (a.ingestSuccessRate > 0 && a.ingestSuccessRate < 0.8) {
        recs.push({
          severity: "critical",
          title: "High ingestion failure rate",
          description: `${((1 - a.ingestSuccessRate) * 100).toFixed(0)}% of ingestion jobs are failing. Check the Pipelines tab for errors.`,
        });
      } else if (a.ingestSuccessRate > 0 && a.ingestSuccessRate < 0.95) {
        recs.push({
          severity: "warning",
          title: "Some ingestion failures",
          description: `${((1 - a.ingestSuccessRate) * 100).toFixed(0)}% failure rate. Review failed jobs in Pipelines.`,
        });
      }

      if (a.cmos > 4000) {
        recs.push({
          severity: "warning",
          title: "High context token usage",
          description: `CMOS is ${a.cmos.toLocaleString()} tokens per search. Enable context shaping in Test & Review to optimize.`,
        });
      }
    }

    if (services.some(s => !s.ok)) {
      const down = services.filter(s => !s.ok).map(s => s.name);
      recs.push({
        severity: "critical",
        title: `Service${down.length > 1 ? "s" : ""} down: ${down.join(", ")}`,
        description:
          "One or more backend services are unreachable. Check deployments.",
      });
    }

    if (obs && obs.errorCount > 0) {
      const rate =
        obs.totalTraces > 0
          ? ((obs.errorCount / obs.totalTraces) * 100).toFixed(1)
          : "0";
      if (Number(rate) > 5) {
        recs.push({
          severity: "warning",
          title: `${rate}% LLM operation error rate`,
          description: `${obs.errorCount} errors in ${obs.totalTraces} operations. Check Govern → Compliance for details.`,
        });
      }
    }

    if (recs.length === 0) {
      recs.push({
        severity: "info",
        title: "Everything looks healthy",
        description:
          "All services are running and metrics are within expected ranges. Keep building your knowledge base!",
      });
    }

    return recs;
  }, [a, services, obs]);

  // Event type chart data
  const eventChartItems = useMemo(() => {
    if (!a?.eventsByType) return [];
    const colors = [
      "bg-primary/70",
      "bg-emerald-500/70",
      "bg-amber-500/70",
      "bg-violet-500/70",
      "bg-red-500/60",
      "bg-cyan-500/60",
    ];
    return Object.entries(a.eventsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, value], i) => ({
        label: label.replace("kb.", "").replace("agent.", ""),
        value,
        color: colors[i % colors.length],
      }));
  }, [a?.eventsByType]);

  // Service chart
  const serviceChartItems = useMemo(() => {
    if (!a?.eventsByService) return [];
    const colors = [
      "bg-primary/60",
      "bg-emerald-500/60",
      "bg-amber-500/60",
      "bg-violet-500/60",
    ];
    return Object.entries(a.eventsByService)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, value], i) => ({
        label,
        value,
        color: colors[i % colors.length],
      }));
  }, [a?.eventsByService]);

  const isLoading =
    analyticsQ.isLoading || statsQ.isLoading || healthQ.isLoading;

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="w-full space-y-6"
    >
      {/* ── Header ── */}
      <motion.div
        variants={child}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className={k.display}>Insights & Analytics</h2>
          <p className={cn("mt-1", k.muted)}>
            Platform health, search quality, and usage intelligence
          </p>
        </div>
        <button
          onClick={() => {
            analyticsQ.refetch();
            statsQ.refetch();
            healthQ.refetch();
            obsQ.refetch();
          }}
          disabled={isLoading}
          className={cn(k.btnGhost, "gap-1.5")}
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
          />
          Refresh
        </button>
      </motion.div>

      {/* ── Smart Recommendations ── */}
      <motion.div variants={child} className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span className={k.label}>Recommendations</span>
        </div>
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <Recommendation key={i} {...rec} />
          ))}
        </div>
      </motion.div>

      {/* ── Top-line metrics ── */}
      <motion.div
        variants={child}
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
      >
        <MetricCard
          icon={Activity}
          label="Total Events"
          value={a?.totalEvents?.toLocaleString() ?? "—"}
          rating="neutral"
          sublabel={
            a?.periodStart
              ? `Since ${new Date(a.periodStart).toLocaleDateString()}`
              : undefined
          }
        />
        <MetricCard
          icon={Users}
          label="Active Users"
          value={a?.uniqueUsers ?? "—"}
          rating="neutral"
        />
        <MetricCard
          icon={Search}
          label="Avg Search Score"
          value={a?.avgTopScore ? a.avgTopScore.toFixed(2) : "—"}
          rating={rateSearchScore(a?.avgTopScore ?? 0)}
          sublabel={
            a?.avgTopScore
              ? a.avgTopScore >= 0.7
                ? "Excellent"
                : a.avgTopScore >= 0.4
                  ? "Moderate"
                  : "Low"
              : undefined
          }
        />
        <MetricCard
          icon={ShieldCheck}
          label="Faithfulness"
          value={a?.avgFaithfulness ? a.avgFaithfulness.toFixed(2) : "—"}
          rating={rateRagas(a?.avgFaithfulness ?? 0)}
          sublabel={
            a?.ragasCoverageRate
              ? `${(a.ragasCoverageRate * 100).toFixed(0)}% RAGAS coverage`
              : "Awaiting eval samples"
          }
        />
        <MetricCard
          icon={Zap}
          label="CMOS"
          value={a?.cmos ? a.cmos.toLocaleString() : "—"}
          unit="tokens"
          rating={rateCmos(a?.cmos ?? 0)}
          sublabel="Context tokens per search"
        />
        <MetricCard
          icon={FileText}
          label="Ingest Success"
          value={
            a?.ingestSuccessRate
              ? `${(a.ingestSuccessRate * 100).toFixed(0)}`
              : "—"
          }
          unit="%"
          rating={rateIngestSuccess(a?.ingestSuccessRate ?? 0)}
        />
        <MetricCard
          icon={Clock}
          label="Ingest P95"
          value={
            a?.p95IngestDurationMs
              ? (a.p95IngestDurationMs / 1000).toFixed(1)
              : "—"
          }
          unit="s"
          rating="neutral"
          sublabel="95th percentile latency"
        />
        <MetricCard
          icon={Boxes}
          label="Chunks Indexed"
          value={
            a?.totalChunksIndexed?.toLocaleString() ??
            stats?.totalChunks?.toLocaleString() ??
            "—"
          }
          rating="neutral"
        />
      </motion.div>

      {/* ── Service Health ── */}
      <motion.div variants={child}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className={k.label}>Service Health</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {services.length > 0 ? (
            services.map(svc => (
              <ServiceBadge
                key={svc.name}
                name={svc.name}
                ok={svc.ok}
                latencyMs={svc.latencyMs}
              />
            ))
          ) : (
            <div className={cn(k.card, "px-4 py-8 col-span-3 text-center")}>
              <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
              <p className={k.muted}>Checking services...</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Search Quality + Ingestion Health (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Search Quality */}
        <motion.div variants={child} className={cn(k.card, "overflow-hidden")}>
          <div className={k.cardHeader}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className={k.heading}>Search Quality</span>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Avg Score",
                  value: a?.avgTopScore ? a.avgTopScore.toFixed(3) : "—",
                  desc: "Retrieval relevance",
                  rating: rateSearchScore(a?.avgTopScore ?? 0),
                },
                {
                  label: "Chunks/Search",
                  value: a?.avgChunksPerSearch
                    ? a.avgChunksPerSearch.toFixed(1)
                    : "—",
                  desc: "Avg context size",
                  rating: "neutral" as Rating,
                },
                {
                  label: "CMOS",
                  value: a?.cmos ? a.cmos.toLocaleString() : "—",
                  desc: "Tokens per query",
                  rating: rateCmos(a?.cmos ?? 0),
                },
                {
                  label: "Faithfulness",
                  value: a?.avgFaithfulness
                    ? a.avgFaithfulness.toFixed(2)
                    : "—",
                  desc: a?.ragasSampleCount
                    ? `${a.ragasSampleCount.toLocaleString()} eval samples`
                    : "No RAGAS samples",
                  rating: rateRagas(a?.avgFaithfulness ?? 0),
                },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      RATING_COLORS[m.rating].text
                    )}
                  >
                    {m.value}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground">
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground/60">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Score gauge */}
            {a?.avgTopScore != null && a.avgTopScore > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Retrieval Quality
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      RATING_COLORS[rateSearchScore(a.avgTopScore)].text
                    )}
                  >
                    {a.avgTopScore >= 0.7
                      ? "Excellent"
                      : a.avgTopScore >= 0.4
                        ? "Moderate"
                        : "Needs Improvement"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/4 dark:bg-muted/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(a.avgTopScore * 100, 100)}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      a.avgTopScore >= 0.7
                        ? "bg-emerald-500"
                        : a.avgTopScore >= 0.4
                          ? "bg-amber-500"
                          : "bg-red-500"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Ingestion Health */}
        <motion.div variants={child} className={cn(k.card, "overflow-hidden")}>
          <div className={k.cardHeader}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <span className={k.heading}>Ingestion Health</span>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Success Rate",
                  value: a?.ingestSuccessRate
                    ? `${(a.ingestSuccessRate * 100).toFixed(0)}%`
                    : "—",
                  desc: "Pipeline completion",
                  rating: rateIngestSuccess(a?.ingestSuccessRate ?? 0),
                },
                {
                  label: "Total Jobs",
                  value: a?.totalIngestJobs?.toLocaleString() ?? "—",
                  desc: "Processed documents",
                  rating: "neutral" as Rating,
                },
                {
                  label: "Avg Duration",
                  value: a?.avgIngestDurationMs
                    ? `${(a.avgIngestDurationMs / 1000).toFixed(1)}s`
                    : "—",
                  desc: "Pipeline latency",
                  rating: "neutral" as Rating,
                },
                {
                  label: "P95 Duration",
                  value: a?.p95IngestDurationMs
                    ? `${(a.p95IngestDurationMs / 1000).toFixed(1)}s`
                    : "—",
                  desc: "Tail latency",
                  rating: "neutral" as Rating,
                },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      RATING_COLORS[m.rating].text
                    )}
                  >
                    {m.value}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground">
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground/60">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Success rate gauge */}
            {a?.ingestSuccessRate != null && a.ingestSuccessRate > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pipeline Reliability
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      RATING_COLORS[rateIngestSuccess(a.ingestSuccessRate)].text
                    )}
                  >
                    {a.ingestSuccessRate >= 0.95
                      ? "Healthy"
                      : a.ingestSuccessRate >= 0.8
                        ? "Degraded"
                        : "Critical"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/4 dark:bg-muted/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(a.ingestSuccessRate * 100, 100)}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      a.ingestSuccessRate >= 0.95
                        ? "bg-emerald-500"
                        : a.ingestSuccessRate >= 0.8
                          ? "bg-amber-500"
                          : "bg-red-500"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Platform Activity (event type + service breakdown) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {eventChartItems.length > 0 && (
          <motion.div
            variants={child}
            className={cn(k.card, "overflow-hidden")}
          >
            <div className={k.cardHeader}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" />
                <span className={k.heading}>Events by Type</span>
              </div>
            </div>
            <div className="p-5">
              <MiniBar items={eventChartItems} />
            </div>
          </motion.div>
        )}

        {serviceChartItems.length > 0 && (
          <motion.div
            variants={child}
            className={cn(k.card, "overflow-hidden")}
          >
            <div className={k.cardHeader}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className={k.heading}>Events by Service</span>
              </div>
            </div>
            <div className="p-5">
              <MiniBar items={serviceChartItems} />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── LLM Operations summary ── */}
      {obs && (
        <motion.div variants={child} className={cn(k.card, "overflow-hidden")}>
          <div className={k.cardHeader}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className={k.heading}>LLM Operations</span>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Traces",
                  value: obs.totalTraces?.toLocaleString() ?? "0",
                  icon: Activity,
                  color: "text-blue-500",
                  bg: "bg-blue-500/8",
                },
                {
                  label: "Errors",
                  value: obs.errorCount?.toString() ?? "0",
                  icon: obs.errorCount > 0 ? AlertTriangle : CheckCircle,
                  color:
                    obs.errorCount > 0 ? "text-red-500" : "text-emerald-500",
                  bg: obs.errorCount > 0 ? "bg-red-500/8" : "bg-emerald-500/8",
                },
                {
                  label: "Avg Latency",
                  value: obs.avgDurationMs
                    ? `${obs.avgDurationMs.toFixed(0)}ms`
                    : "—",
                  icon: Clock,
                  color: "text-muted-foreground",
                  bg: "bg-black/3 dark:bg-muted/40",
                },
                {
                  label: "Error Rate",
                  value:
                    obs.totalTraces > 0
                      ? `${((obs.errorCount / obs.totalTraces) * 100).toFixed(1)}%`
                      : "0%",
                  icon: ShieldCheck,
                  color:
                    obs.errorCount > 0 ? "text-amber-500" : "text-emerald-500",
                  bg:
                    obs.errorCount > 0 ? "bg-amber-500/8" : "bg-emerald-500/8",
                },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      s.bg
                    )}
                  >
                    <s.icon className={cn("w-4 h-4", s.color)} />
                  </div>
                  <div>
                    <p className="text-base font-bold tabular-nums text-foreground">
                      {s.value}
                    </p>
                    <p className={k.muted}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
