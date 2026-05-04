/**
 * Executive Dashboard Charts — Recharts components
 * Reusable chart widgets for the Enterprise Hub admin dashboard.
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { cn, textColor, COSTCO_BLUE, COSTCO_RED } from "@hki/ui";
import { a } from "./theme";

// ── Color palette ────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  blue: COSTCO_BLUE,
  violet: "color-mix(in srgb, var(--primary) 72%, white)",
  emerald: "color-mix(in srgb, var(--primary) 88%, white)",
  amber: "var(--warning)",
  rose: COSTCO_RED,
  sky: "color-mix(in srgb, var(--primary) 84%, white)",
  indigo: "color-mix(in srgb, var(--primary) 68%, var(--destructive) 32%)",
  brand: COSTCO_BLUE,
  brandRed: COSTCO_RED,
} as const;

const PIE_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
  CHART_COLORS.sky,
  CHART_COLORS.indigo,
];

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueLabel }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        a.card,
        "rounded-lg px-3 py-2 shadow-xl shadow-primary/5 text-xs transition-shadow"
      )}
    >
      {label && <p className="font-medium text-foreground/80 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">
            {p.name || valueLabel || "Value"}
          </span>
          <span className="font-semibold text-foreground ml-auto tabular-nums">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Confidence Trend — Column chart from recent traces
// ═════════════════════════════════════════════════════════════════════════════

interface ConfidenceChartProps {
  traces: Array<{
    confidence: number;
    timestamp: Date | string;
    query: string;
  }>;
}

function confidenceBarColor(confidence: number) {
  if (confidence >= 85) return CHART_COLORS.blue;
  if (confidence >= 70) return CHART_COLORS.sky;
  if (confidence >= 50) return CHART_COLORS.amber;
  return CHART_COLORS.rose;
}

export function ConfidenceAreaChart({ traces }: ConfidenceChartProps) {
  const data = useMemo(() => {
    return [...traces]
      .reverse()
      .slice(-20)
      .map((t, i) => ({
        idx: i + 1,
        confidence: Math.round((t.confidence ?? 0) * 100),
        query: typeof t.query === "string" ? t.query.slice(0, 40) : "",
        fill: confidenceBarColor(Math.round((t.confidence ?? 0) * 100)),
      }));
  }, [traces]);

  if (data.length === 0) {
    return <EmptyChart label="No confidence data yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        barCategoryGap="26%"
        margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
      >
        <CartesianGrid
          vertical={false}
          strokeDasharray="2 6"
          stroke="currentColor"
          strokeOpacity={0.06}
        />
        <XAxis
          dataKey="idx"
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
          tickFormatter={v => `${v}%`}
          tickLine={false}
        />
        <Tooltip
          content={<ChartTooltip valueLabel="Confidence" />}
          labelFormatter={(value, payload) => {
            const query = payload?.[0]?.payload?.query;
            return query ? `Trace ${value} · ${query}` : `Trace ${value}`;
          }}
        />
        <Bar
          dataKey="confidence"
          name="Confidence"
          radius={[5, 5, 0, 0]}
          barSize={10}
        >
          {data.map(entry => (
            <Cell key={entry.idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tool Performance — Horizontal bar chart
// ═════════════════════════════════════════════════════════════════════════════

interface ToolStatsData {
  toolName: string;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
}

export function ToolPerformanceChart({ tools }: { tools: ToolStatsData[] }) {
  const data = useMemo(() => {
    return tools.slice(0, 8).map(t => ({
      name: t.toolName.replace(/^(knowledge_|search_|hki_)/, ""),
      calls: t.totalCalls,
      successPct: Math.round(t.successRate * 100),
      avgMs: t.avgDurationMs,
    }));
  }, [tools]);

  if (data.length === 0) {
    return <EmptyChart label="No tool execution data yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          strokeOpacity={0.06}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
          width={80}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          dataKey="calls"
          fill={CHART_COLORS.blue}
          radius={[0, 4, 4, 0]}
          name="Calls"
          barSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Ingestion Timeline — Area chart from jobs
// ═════════════════════════════════════════════════════════════════════════════

interface JobData {
  status: string;
  chunkCount: number;
  createdAt: string;
  department: string;
}

export function IngestionTimelineChart({ jobs }: { jobs: JobData[] }) {
  const data = useMemo(() => {
    if (!jobs.length) return [];
    let completed = 0;
    let failed = 0;
    for (const j of jobs) {
      if (j.status === "completed") completed++;
      else if (j.status === "failed") failed++;
    }
    return [
      { name: "Completed", value: completed, fill: CHART_COLORS.brand },
      { name: "Failed", value: failed, fill: CHART_COLORS.brandRed },
    ].filter(d => d.value > 0);
  }, [jobs]);

  if (data.length === 0) {
    return <EmptyChart label="No ingestion activity yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={4}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueLabel="Jobs" />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Department Distribution — Donut chart from jobs
// ═════════════════════════════════════════════════════════════════════════════

export function DepartmentDonutChart({ jobs }: { jobs: JobData[] }) {
  const data = useMemo(() => {
    if (!jobs.length) return [];
    const counts: Record<string, number> = {};
    for (const j of jobs) {
      const dept = j.department || "Unclassified";
      counts[dept] = (counts[dept] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [jobs]);

  if (data.length === 0) {
    return <EmptyChart label="No department data yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueLabel="Jobs" />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px" }}
          formatter={(value: string) => (
            <span className="text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Resource Usage — Today's usage as mini bar chart
// ═════════════════════════════════════════════════════════════════════════════

interface ResourceData {
  tokensToday: number;
  apiCalls: number;
  knowledgeQueries: number;
  guardrailChecks: number;
}

export function ResourceUsageChart({ data }: { data: ResourceData }) {
  const chartData = [
    { name: "Tokens", value: data.tokensToday, fill: CHART_COLORS.blue },
    { name: "API Calls", value: data.apiCalls, fill: CHART_COLORS.violet },
    {
      name: "KB Queries",
      value: data.knowledgeQueries,
      fill: CHART_COLORS.amber,
    },
    {
      name: "Guardrails",
      value: data.guardrailChecks,
      fill: CHART_COLORS.emerald,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          strokeOpacity={0.06}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
        <Tooltip content={<ChartTooltip valueLabel="Count" />} />
        <Bar dataKey="value" name="Today" radius={[4, 4, 0, 0]} barSize={32}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center px-2 pb-2">
      <div
        className={cn(
          a.inset,
          "relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/70 bg-background/78 px-5 text-center"
        )}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-primary/12" />
        <div className="pointer-events-none absolute inset-x-10 bottom-4 h-10 rounded-full bg-primary/8 blur-2xl" />
        <div
          className={cn(
            a.iconPrimary,
            "relative z-10 flex h-10 w-10 items-center justify-center rounded-xl"
          )}
        >
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="relative z-10 mt-3 space-y-1">
          <p className="text-xs font-semibold text-foreground/88">{label}</p>
          <p
            className={cn(
              "mx-auto max-w-56 text-[11px] leading-relaxed",
              a.microText
            )}
          >
            This view will populate as new platform activity arrives.
          </p>
        </div>
      </div>
    </div>
  );
}
