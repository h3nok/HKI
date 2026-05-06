/**
 * Executive Dashboard Charts — Recharts components
 * Reusable chart widgets for the Control Plane admin dashboard.
 */

import {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Line,
  LabelList,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { cn, HKI_IRIS } from "@hki/ui";
import { DASHBOARD_TARGETS } from "./dashboardSignals";
import { a } from "./theme";

// ── Color palette ────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  blue: HKI_IRIS,
  violet: "color-mix(in srgb, var(--primary) 68%, var(--foreground) 12%)",
  emerald: "color-mix(in srgb, var(--primary) 82%, var(--success) 18%)",
  slate: "color-mix(in srgb, var(--primary) 54%, var(--muted-foreground) 46%)",
  rose: "color-mix(in srgb, var(--destructive) 76%, var(--foreground) 24%)",
  sky: "color-mix(in srgb, var(--primary) 78%, white)",
  indigo: "color-mix(in srgb, var(--primary) 58%, var(--foreground) 42%)",
  brand: HKI_IRIS,
  brandRed: "color-mix(in srgb, var(--destructive) 74%, var(--foreground) 26%)",
} as const;

const PIE_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.emerald,
  CHART_COLORS.slate,
  CHART_COLORS.rose,
  CHART_COLORS.sky,
  CHART_COLORS.indigo,
];

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCompact(value: number) {
  return compactNumber.format(Math.round(value));
}

function formatMs(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function toDate(value: Date | string | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDay(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function ResponsivePlot({
  height,
  children,
}: {
  height: number;
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      const nextSize = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };

      setSize(previous => {
        if (nextSize.width <= 1 || nextSize.height <= 1) return null;
        if (
          previous?.width === nextSize.width &&
          previous.height === nextSize.height
        ) {
          return previous;
        }
        return nextSize;
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Recharts can warn when animated ancestors report unstable layout during
  // mount; passing measured dimensions avoids that reload path.
  return (
    <div
      ref={containerRef}
      className="min-w-0 w-full"
      style={{ height, minHeight: height }}
    >
      {size
        ? cloneElement(children, {
            width: size.width,
            height: size.height,
          })
        : null}
    </div>
  );
}

function ChartStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "primary" | "positive" | "warning" | "critical" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? a.pillPositive
      : tone === "warning"
        ? a.pillWarning
        : tone === "critical"
          ? a.pillCritical
          : tone === "primary"
            ? a.pillPrimary
            : a.inset;

  return (
    <div className={cn(toneClass, "min-w-0 rounded-lg px-2 py-1.5")}>
      <p className="truncate text-[9px] font-semibold uppercase tracking-normal text-muted-foreground/75">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueLabel }: any) {
  if (!active || !payload?.length) return null;
  const metadata = payload[0]?.payload?.tooltip;
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
      {Array.isArray(metadata) && metadata.length > 0 && (
        <div className="mt-1 border-t border-border/50 pt-1">
          {metadata.map((item: { label: string; value: string }) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="ml-auto font-semibold text-foreground tabular-nums">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
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
  if (confidence >= 50) return CHART_COLORS.slate;
  return CHART_COLORS.rose;
}

export function ConfidenceAreaChart({ traces }: ConfidenceChartProps) {
  const { data, avgConfidence, lowConfidenceCount, currentConfidence } =
    useMemo(() => {
      const rows = [...traces]
        .reverse()
        .slice(-24)
        .map((t, i, items) => {
          const confidence = Math.round((t.confidence ?? 0) * 100);
          const window = items
            .slice(Math.max(0, i - 4), i + 1)
            .map(item => Math.round((item.confidence ?? 0) * 100));
          const date = toDate(t.timestamp);
          return {
            idx: i + 1,
            label: date
              ? date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : `T${i + 1}`,
            confidence,
            rolling: Math.round(average(window)),
            query: typeof t.query === "string" ? t.query.slice(0, 48) : "",
            fill: confidenceBarColor(confidence),
            tooltip: [
              {
                label: "Rolling avg",
                value: `${Math.round(average(window))}%`,
              },
              { label: "Target", value: "80%" },
            ],
          };
        });
      const scores = rows.map(row => row.confidence);
      return {
        data: rows,
        avgConfidence: Math.round(average(scores)),
        lowConfidenceCount: rows.filter(row => row.confidence < 65).length,
        currentConfidence: rows.at(-1)?.confidence ?? 0,
      };
    }, [traces]);

  if (data.length === 0) {
    return <EmptyChart label="No confidence data yet" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="grid grid-cols-3 gap-1.5 px-2">
        <ChartStat
          label="Current"
          value={`${currentConfidence}%`}
          tone={
            currentConfidence >= 80
              ? "positive"
              : currentConfidence >= 65
                ? "warning"
                : "critical"
          }
        />
        <ChartStat
          label="Average"
          value={`${avgConfidence}%`}
          tone={avgConfidence >= 80 ? "positive" : "primary"}
        />
        <ChartStat
          label="Low"
          value={`${lowConfidenceCount}`}
          tone={lowConfidenceCount > 0 ? "warning" : "positive"}
        />
      </div>
      <ResponsivePlot height={185}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 10, bottom: 0, left: -18 }}
        >
          <defs>
            <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={CHART_COLORS.blue}
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor={CHART_COLORS.blue}
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="2 6"
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={18}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.18}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.18}
            tickFormatter={v => `${v}%`}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip valueLabel="Confidence" />}
            labelFormatter={(value, payload) => {
              const query = payload?.[0]?.payload?.query;
              return query ? `${value} · ${query}` : value;
            }}
          />
          <ReferenceLine
            y={80}
            stroke="var(--success)"
            strokeOpacity={0.45}
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="confidence"
            name="Confidence"
            stroke={CHART_COLORS.blue}
            strokeWidth={2.5}
            fill="url(#confidenceFill)"
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="rolling"
            name="Rolling avg"
            stroke={CHART_COLORS.indigo}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
        </AreaChart>
      </ResponsivePlot>
    </div>
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
  const { data, topTool, avgSuccess, avgDuration } = useMemo(() => {
    const rows = tools.slice(0, 8).map(t => {
      const successPct = Math.round(t.successRate * 100);
      return {
        name: t.toolName.replace(/^(knowledge_|search_|hki_)/, "").slice(0, 18),
        calls: t.totalCalls,
        successPct,
        successLabel: `${successPct}%`,
        avgMs: t.avgDurationMs,
        fill:
          successPct >= 96
            ? CHART_COLORS.emerald
            : successPct >= 85
              ? CHART_COLORS.blue
              : successPct >= 70
                ? CHART_COLORS.slate
                : CHART_COLORS.rose,
        tooltip: [
          { label: "Success", value: `${successPct}%` },
          { label: "Avg duration", value: formatMs(t.avgDurationMs) },
        ],
      };
    });
    return {
      data: rows,
      topTool: rows[0]?.name ?? "-",
      avgSuccess: Math.round(average(rows.map(row => row.successPct))),
      avgDuration: Math.round(average(rows.map(row => row.avgMs))),
    };
  }, [tools]);

  if (data.length === 0) {
    return <EmptyChart label="No tool execution data yet" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="grid grid-cols-3 gap-1.5 px-2">
        <ChartStat label="Top tool" value={topTool} tone="primary" />
        <ChartStat
          label="Avg success"
          value={`${avgSuccess}%`}
          tone={avgSuccess >= 90 ? "positive" : "warning"}
        />
        <ChartStat
          label="Avg speed"
          value={formatMs(avgDuration)}
          tone={avgDuration <= 2000 ? "positive" : "warning"}
        />
      </div>
      <ResponsivePlot height={190}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 38, bottom: 4, left: 4 }}
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
            strokeOpacity={0.16}
            tickLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.18}
            tickLine={false}
            width={86}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="calls" radius={[0, 6, 6, 0]} name="Calls" barSize={14}>
            {data.map(entry => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="successLabel"
              position="right"
              className="fill-muted-foreground text-[10px] font-semibold"
            />
          </Bar>
        </BarChart>
      </ResponsivePlot>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Ingestion Timeline — Area chart from jobs
// ═════════════════════════════════════════════════════════════════════════════

interface JobData {
  status: string;
  chunkCount?: number;
  chunks?: number;
  createdAt?: string;
  department?: string;
}

export function IngestionTimelineChart({ jobs }: { jobs: JobData[] }) {
  const { data, completed, failed, active, chunks } = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return {
        key: dayKey(date),
        day: shortDay(date),
        completed: 0,
        failed: 0,
        active: 0,
        chunks: 0,
      };
    });
    const dayMap = new Map(days.map(day => [day.key, day]));
    let completedCount = 0;
    let failedCount = 0;
    let activeCount = 0;
    let chunkCount = 0;

    for (const job of jobs) {
      const status = String(job.status ?? "").toLowerCase();
      if (status === "completed") completedCount++;
      else if (status === "failed") failedCount++;
      else activeCount++;

      const chunksForJob = Number(job.chunkCount ?? job.chunks ?? 0);
      chunkCount += Number.isFinite(chunksForJob) ? chunksForJob : 0;

      const date = toDate(job.createdAt);
      if (!date) continue;
      const bucket = dayMap.get(dayKey(date));
      if (!bucket) continue;
      if (status === "completed") bucket.completed++;
      else if (status === "failed") bucket.failed++;
      else bucket.active++;
      bucket.chunks += Number.isFinite(chunksForJob) ? chunksForJob : 0;
    }

    return {
      data: days,
      completed: completedCount,
      failed: failedCount,
      active: activeCount,
      chunks: chunkCount,
    };
  }, [jobs]);

  if (jobs.length === 0) {
    return <EmptyChart label="No ingestion activity yet" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="grid grid-cols-4 gap-1.5 px-2">
        <ChartStat label="Done" value={`${completed}`} tone="positive" />
        <ChartStat label="Active" value={`${active}`} tone="primary" />
        <ChartStat
          label="Failed"
          value={`${failed}`}
          tone={failed > 0 ? "critical" : "positive"}
        />
        <ChartStat
          label="Chunks"
          value={formatCompact(chunks)}
          tone="neutral"
        />
      </div>
      <ResponsivePlot height={185}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 10, bottom: 0, left: -18 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 5"
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.18}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.18}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip valueLabel="Jobs" />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px" }}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            stackId="jobs"
            fill={CHART_COLORS.emerald}
            radius={[0, 0, 4, 4]}
          />
          <Bar
            dataKey="active"
            name="Active"
            stackId="jobs"
            fill={CHART_COLORS.blue}
          />
          <Bar
            dataKey="failed"
            name="Failed"
            stackId="jobs"
            fill={CHART_COLORS.rose}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsivePlot>
    </div>
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
    <ResponsivePlot height={200}>
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
    </ResponsivePlot>
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
  const { chartData, tokenPressure, projectedTokens, maxValue } =
    useMemo(() => {
      const now = new Date();
      const elapsedHours =
        now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      const projected =
        data.tokensToday > 0
          ? Math.round(data.tokensToday / clamp(elapsedHours / 24, 1 / 24, 1))
          : 0;
      const values = [
        data.apiCalls,
        data.knowledgeQueries,
        data.guardrailChecks,
        data.tokensToday,
      ];
      const max = Math.max(1, ...values);
      return {
        projectedTokens: projected,
        tokenPressure: clamp(
          (projected / DASHBOARD_TARGETS.dailyTokenBudget) * 100
        ),
        maxValue: max,
        chartData: [
          {
            name: "API",
            value: data.apiCalls,
            label: formatCompact(data.apiCalls),
            fill: CHART_COLORS.violet,
          },
          {
            name: "KB",
            value: data.knowledgeQueries,
            label: formatCompact(data.knowledgeQueries),
            fill: CHART_COLORS.slate,
          },
          {
            name: "Guard",
            value: data.guardrailChecks,
            label: formatCompact(data.guardrailChecks),
            fill: CHART_COLORS.emerald,
          },
          {
            name: "Tokens",
            value: data.tokensToday,
            label: formatCompact(data.tokensToday),
            fill: CHART_COLORS.blue,
          },
        ],
      };
    }, [data]);

  const gaugeColor =
    tokenPressure >= 100
      ? CHART_COLORS.rose
      : tokenPressure >= 78
        ? CHART_COLORS.slate
        : CHART_COLORS.blue;

  return (
    <div className="grid min-w-0 gap-3 pt-2 md:grid-cols-[0.95fr_1.2fr]">
      <div
        className={cn(
          a.inset,
          "relative min-h-52 overflow-hidden rounded-xl px-3 py-3"
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          Token runway
        </p>
        <div className="relative mt-1 h-36">
          <ResponsivePlot height={144}>
            <RadialBarChart
              cx="50%"
              cy="78%"
              innerRadius="72%"
              outerRadius="104%"
              barSize={12}
              data={[
                { name: "Budget", value: tokenPressure, fill: gaugeColor },
              ]}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} background />
            </RadialBarChart>
          </ResponsivePlot>
          <div className="absolute inset-x-0 bottom-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {Math.round(tokenPressure)}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatCompact(projectedTokens)} projected
            </p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatCompact(data.tokensToday)} used</span>
          <span>{formatCompact(DASHBOARD_TARGETS.dailyTokenBudget)} plan</span>
        </div>
      </div>

      <div className="min-h-52 min-w-0">
        <ResponsivePlot height={208}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 10, bottom: 0, left: -18 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 5"
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              strokeOpacity={0.18}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              strokeOpacity={0.18}
              tickLine={false}
              tickFormatter={formatCompact}
              domain={[0, maxValue]}
            />
            <Tooltip content={<ChartTooltip valueLabel="Count" />} />
            <Bar
              dataKey="value"
              name="Today"
              radius={[5, 5, 0, 0]}
              barSize={26}
            >
              {chartData.map(entry => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="label"
                position="top"
                className="fill-muted-foreground text-[10px] font-semibold"
              />
            </Bar>
          </BarChart>
        </ResponsivePlot>
      </div>
    </div>
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
