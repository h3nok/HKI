import { motion } from "framer-motion";
import { Network, ShieldCheck } from "lucide-react";
import { cn, HkiCard } from "@hki/ui";
import { a, type AdminTone } from "../theme";
import type {
  DashboardSignalsSummary,
  ForwardSignal,
} from "../dashboardSignals";

const SIGNAL_TONES: Record<
  AdminTone,
  { pill: string; color: string; fill: string }
> = {
  primary: {
    pill: a.pillPrimary,
    color: "var(--primary)",
    fill: "color-mix(in srgb, var(--primary) 16%, transparent)",
  },
  positive: {
    pill: a.pillPositive,
    color: "var(--success)",
    fill: "color-mix(in srgb, var(--success) 16%, transparent)",
  },
  warning: {
    pill: a.pillWarning,
    color: "var(--warning)",
    fill: "color-mix(in srgb, var(--warning) 16%, transparent)",
  },
  critical: {
    pill: a.pillCritical,
    color: "var(--destructive)",
    fill: "color-mix(in srgb, var(--destructive) 16%, transparent)",
  },
  neutral: {
    pill: a.pillNeutral,
    color: "var(--muted-foreground)",
    fill: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)",
  },
};

const SIGNAL_LABELS: Record<ForwardSignal["key"], string> = {
  readiness: "Launch",
  risk: "Risk",
  slo: "SLO",
  runway: "Cost",
  coverage: "Coverage",
  leverage: "Leverage",
};

const RADAR_CENTER = 120;
const RADAR_RADIUS = 80;
const RADAR_LABEL_RADIUS = 110;

interface ForwardSignalsPanelProps {
  summary: DashboardSignalsSummary;
}

interface SignalRadarRow extends ForwardSignal {
  score: number;
  radarScore: number;
  shortLabel: string;
  color: string;
  badge: string;
  mode: "score" | "pressure";
  hasData: boolean;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function signalMode(signal: ForwardSignal) {
  if (signal.key === "risk" || signal.key === "runway") return "pressure";
  return "score";
}

function radarPoint(
  index: number,
  total: number,
  score: number,
  radius = RADAR_RADIUS
) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const distance = radius * (clampPercent(score) / 100);
  return {
    x: RADAR_CENTER + Math.cos(angle) * distance,
    y: RADAR_CENTER + Math.sin(angle) * distance,
  };
}

function polygonPoints(
  rows: SignalRadarRow[],
  score: (row: SignalRadarRow) => number
) {
  return rows
    .map((row, index) => {
      const point = radarPoint(index, rows.length, score(row));
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function textAnchor(x: number) {
  if (x < RADAR_CENTER - 8) return "end";
  if (x > RADAR_CENTER + 8) return "start";
  return "middle";
}

export function ForwardSignalsPanel({ summary }: ForwardSignalsPanelProps) {
  const rows: SignalRadarRow[] = summary.signals.map(signal => {
    const tone = SIGNAL_TONES[signal.tone];
    const score = clampPercent(signal.progress);
    const mode = signalMode(signal);
    const hasData = signal.tone !== "neutral" && signal.value !== "No data";
    return {
      ...signal,
      score,
      radarScore: hasData ? (mode === "pressure" ? 100 - score : score) : 44,
      shortLabel: SIGNAL_LABELS[signal.key],
      color: tone.color,
      badge: signal.value,
      mode,
      hasData,
    };
  });
  const weakestSignal = rows
    .filter(signal => signal.mode === "score" && signal.hasData)
    .reduce<SignalRadarRow | null>((weakest, signal) => {
      if (!weakest) return signal;
      return signal.radarScore < weakest.radarScore ? signal : weakest;
    }, null);
  const pressureSignal = rows
    .filter(signal => signal.mode === "pressure" && signal.hasData)
    .sort((a, b) => b.score - a.score)[0];
  const evidenceCount = rows.filter(signal => signal.hasData).length;
  const readinessTone: AdminTone =
    summary.readinessScore >= 72 ? "primary" : "warning";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28 }}
    >
      <HkiCard
        elevation="raised"
        size="md"
        interactive={false}
        className={cn(
          a.card,
          "admin-forward-signals-card overflow-hidden rounded-xl"
        )}
      >
        <div
          className={cn(
            a.cardHeader,
            "admin-forward-signals-card__header flex flex-col gap-3 px-4 pt-4 pb-3"
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  a.metricIcon,
                  a.iconPrimary,
                  "flex size-8 items-center justify-center rounded-[0.625rem]"
                )}
              >
                <Network className="size-4" />
              </div>
              <div className="min-w-0">
                <p className={a.sectionEyebrow}>Forward Signals</p>
                <h2 className="text-sm font-medium text-foreground dark:text-foreground/78">
                  Readiness radar
                </h2>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                SIGNAL_TONES[readinessTone].pill,
                "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] tabular-nums"
              )}
            >
              <ShieldCheck className="size-3" />
              {summary.readinessScore}% ready
            </span>
            <span
              className={cn(
                a.inset,
                "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
              )}
            >
              {evidenceCount}/{rows.length} signals
            </span>
          </div>
        </div>

        <div className="admin-forward-signals-card__body px-3 pb-3 pt-2">
          <div
            className={cn(
              a.inset,
              "admin-forward-signals-card__radar-surface relative overflow-hidden rounded-xl px-2.5 py-3"
            )}
          >
            <div className="grid gap-3">
              <div className="admin-forward-signals-card__radar-frame relative mx-auto aspect-square w-full max-w-72 min-w-0 xl:max-w-80">
                <svg
                  viewBox="0 0 240 240"
                  role="img"
                  aria-label="Forward signal readiness radar"
                  className="admin-forward-signals-card__radar h-full w-full overflow-visible"
                >
                  {[25, 50, 72, 100].map(level => (
                    <polygon
                      key={level}
                      points={polygonPoints(rows, () => level)}
                      fill={level === 72 ? "var(--primary)" : "transparent"}
                      fillOpacity={level === 72 ? 0.035 : 0}
                      stroke={level === 72 ? "var(--primary)" : "currentColor"}
                      strokeDasharray={level === 72 ? "4 4" : undefined}
                      strokeOpacity={level === 72 ? 0.4 : 0.14}
                    />
                  ))}
                  {rows.map((row, index) => {
                    const outer = radarPoint(index, rows.length, 100);
                    const label = radarPoint(
                      index,
                      rows.length,
                      RADAR_LABEL_RADIUS
                    );
                    const point = radarPoint(
                      index,
                      rows.length,
                      row.radarScore
                    );
                    return (
                      <g key={row.key}>
                        <line
                          x1={RADAR_CENTER}
                          y1={RADAR_CENTER}
                          x2={outer.x}
                          y2={outer.y}
                          stroke="currentColor"
                          strokeOpacity={0.11}
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={3.3}
                          fill={row.color}
                          opacity={row.hasData ? 1 : 0.42}
                        />
                        <text
                          x={label.x}
                          y={label.y + 3}
                          textAnchor={textAnchor(label.x)}
                          className="fill-muted-foreground text-[10px] font-semibold"
                        >
                          {row.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                  <motion.polygon
                    points={polygonPoints(rows, row => row.radarScore)}
                    fill="var(--primary)"
                    fillOpacity={0.16}
                    stroke="var(--primary)"
                    strokeWidth={1.8}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{
                      transformOrigin: `${RADAR_CENTER}px ${RADAR_CENTER}px`,
                    }}
                  />
                  <circle
                    cx={RADAR_CENTER}
                    cy={RADAR_CENTER}
                    r={31}
                    fill="var(--card)"
                    stroke="var(--border)"
                    strokeOpacity={0.75}
                  />
                  <text
                    x={RADAR_CENTER}
                    y={RADAR_CENTER - 2}
                    textAnchor="middle"
                    className="fill-foreground text-[18px] font-bold tabular-nums"
                  >
                    {summary.readinessScore}%
                  </text>
                  <text
                    x={RADAR_CENTER}
                    y={RADAR_CENTER + 13}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px] font-semibold uppercase"
                  >
                    Ready
                  </text>
                </svg>
                <div className="absolute inset-x-8 bottom-1 h-8 rounded-full bg-primary/8 dark:bg-slate-500/4 blur-2xl" />
              </div>

              <div
                className="admin-forward-signals-card__rows mt-1 flex flex-col gap-1 border-t border-border/50 pt-2"
                role="list"
              >
                {rows.map(row => {
                  const isFocus = weakestSignal?.key === row.key;
                  const isPressure =
                    pressureSignal?.key === row.key && row.score >= 36;
                  return (
                    <div
                      key={row.key}
                      role="listitem"
                      title={`${row.title}: ${row.label}. ${row.detail}`}
                      className={cn(
                        "group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-background/40"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            !row.hasData && "opacity-40"
                          )}
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="truncate text-[11px] font-medium text-foreground/85">
                          {row.shortLabel}
                        </span>
                        {isFocus && (
                          <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">
                            focus
                          </span>
                        )}
                        {isPressure && (
                          <span
                            className={cn(
                              "text-[8px] font-semibold uppercase tracking-[0.14em]",
                              row.tone === "critical"
                                ? "text-destructive/80"
                                : "text-warning/80"
                            )}
                          >
                            pressure
                          </span>
                        )}
                      </div>
                      <div
                        className="relative h-1 min-w-0 overflow-hidden rounded-full bg-border/40"
                        aria-hidden="true"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${row.hasData ? clampPercent(row.radarScore) : 0}%`,
                            backgroundColor: row.color,
                            opacity: row.hasData ? 0.85 : 0,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-right text-[10px] font-semibold tabular-nums",
                          row.hasData
                            ? "text-foreground/80"
                            : "text-muted-foreground/70"
                        )}
                      >
                        {row.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </HkiCard>
    </motion.div>
  );
}
