/**
 * ChartPrimitives — Reusable chart + stat components for the Knowledge Overview.
 *
 * Design principles:
 *   - SVG arcs, not conic-gradient (sharper rendering, animatable)
 *   - Semantic tone system: positive / warning / critical / neutral
 *   - All self-contained; no external chart libs
 *   - Dark-mode aware via CSS vars + Tailwind
 */

import { motion } from "framer-motion";
import { cn } from "@hki/ui";
import { k } from "../../theme";

// ── Tone system ──────────────────────────────────────────────────────────────

export type Tone =
  | "brand"
  | "success"
  | "positive"
  | "warning"
  | "critical"
  | "neutral";

/** Maps to ChartTone for backward compatibility */
export type ChartTone = "good" | "warn" | "bad" | "neutral";

export function legacyToTone(t: ChartTone): Tone {
  if (t === "good") return "success";
  if (t === "warn") return "warning";
  if (t === "bad") return "critical";
  return "neutral";
}

interface ToneConfig {
  stroke: string;
  textCls: string;
  badgeCls: string;
  barCls: string;
  dotCls: string;
}

export const TONE: Record<Tone, ToneConfig> = {
  brand: {
    stroke: "var(--primary)",
    textCls: "text-primary",
    badgeCls: "border border-primary/20 bg-primary/10 text-primary",
    barCls: "bg-primary",
    dotCls: "bg-primary",
  },
  success: {
    stroke: "color-mix(in srgb, var(--primary) 88%, white)",
    textCls: "text-primary",
    badgeCls: "border border-primary/18 bg-primary/10 text-primary",
    barCls: "bg-primary/85",
    dotCls: "bg-primary",
  },
  positive: {
    stroke: "color-mix(in srgb, var(--primary) 82%, white)",
    textCls: "text-primary",
    badgeCls: "border border-primary/14 bg-primary/8 text-primary",
    barCls: "bg-primary/72",
    dotCls: "bg-primary/80",
  },
  warning: {
    stroke:
      "color-mix(in srgb, var(--primary) 72%, var(--muted-foreground) 28%)",
    textCls: k.statusWarningText,
    badgeCls: k.statusWarningBadge,
    barCls: k.statusWarningBar,
    dotCls: k.statusWarningDot,
  },
  critical: {
    stroke: "var(--destructive)",
    textCls: k.statusCriticalText,
    badgeCls: k.statusCriticalBadge,
    barCls: k.statusCriticalBar,
    dotCls: k.statusCriticalDot,
  },
  neutral: {
    stroke: "var(--muted-foreground)",
    textCls: k.statusNeutralText,
    badgeCls: k.statusNeutralBadge,
    barCls: k.statusNeutralBar,
    dotCls: k.statusNeutralDot,
  },
};

// Ordered palette for multi-segment charts (primary scale)
const SEG_PALETTE = [
  "bg-primary",
  "bg-primary/60",
  "bg-primary/38",
  "bg-primary/22",
  "bg-muted-foreground/25",
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

// ── ScoreRing ────────────────────────────────────────────────────────────────

/**
 * SVG arc ring with percentage label, headline, and detail text.
 * Replaces the old conic-gradient RadialGauge.
 */
export function ScoreRing({
  value,
  tone,
  size = 64,
  label,
  headline,
  detail,
  className,
}: {
  value: number; // 0–1
  tone: Tone;
  size?: number;
  label: string;
  headline: string;
  detail: string;
  className?: string;
}) {
  const t = TONE[tone];
  const clamped = Math.max(0, Math.min(value, 1));
  const pct = Math.round(clamped * 100);
  const strokeWidth = 8;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Ring */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted/20 dark:stroke-muted/30"
          />
          {/* Arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke={t.stroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-[13px] font-black tabular-nums leading-none",
              t.textCls
            )}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
          {headline}
        </p>
        <p className={cn(k.muted, "mt-0.5 text-xs leading-snug line-clamp-2")}>
          {detail}
        </p>
      </div>
    </div>
  );
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

/**
 * Labeled single progress bar. For showing individual metric completeness.
 */
export function ScoreBar({
  label,
  value,
  tone,
  valueLabel,
  className,
}: {
  label: string;
  value: number; // 0–1
  tone: Tone;
  valueLabel?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const pct = Math.round(Math.max(0, Math.min(value, 1)) * 100);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {label}
        </span>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums shrink-0",
            t.textCls
          )}
        >
          {valueLabel ?? `${pct}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/25">
        <motion.div
          className={cn("h-full rounded-full", t.barCls)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── SegBar (stacked distribution) ────────────────────────────────────────────

/**
 * Stacked segmented bar with inline legend. Replaces DistributionBar.
 * Segments can optionally carry a `tone` for semantic coloring.
 */
export function SegBar({
  segments,
  emptyMessage = "No data yet.",
  hideLegend = false,
  className,
}: {
  segments: Array<{ label: string; value: number; tone?: Tone; fill?: string }>;
  emptyMessage?: string;
  hideLegend?: boolean;
  className?: string;
}) {
  const visible = segments.filter(s => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return hideLegend ? null : (
      <p className={cn(k.muted, "italic text-xs", className)}>{emptyMessage}</p>
    );
  }

  return (
    <div className={cn(!hideLegend && "space-y-2.5", className)}>
      {/* Bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/20">
        {visible.map((seg, i) => {
          const barCls = seg.tone
            ? TONE[seg.tone].barCls
            : SEG_PALETTE[i % SEG_PALETTE.length];
          return (
            <motion.div
              key={seg.label}
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full",
                barCls
              )}
              initial={{ width: 0 }}
              animate={{ width: `${(seg.value / total) * 100}%` }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />
          );
        })}
      </div>

      {/* Legend — hidden in compact mode */}
      {!hideLegend && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {visible.map((seg, i) => {
            const dotCls = seg.tone
              ? TONE[seg.tone].dotCls
              : SEG_PALETTE[i % SEG_PALETTE.length];
            return (
              <div
                key={seg.label}
                className="flex items-center gap-1.5 min-w-0"
              >
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotCls)}
                />
                <span className="text-xs text-foreground/80 truncate">
                  {seg.label}
                </span>
                <span className="ml-auto text-xs font-semibold tabular-nums text-foreground shrink-0">
                  {seg.value}
                </span>
                <span className="text-[10px] text-muted-foreground/80 tabular-nums shrink-0 w-7 text-right">
                  {Math.round((seg.value / total) * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RankList ──────────────────────────────────────────────────────────────────

/**
 * Ranked horizontal bars. Replaces RankedBars.
 */
export function RankList({
  items,
  emptyMessage = "No data yet.",
  className,
}: {
  items: Array<{ label: string; value: number; tone?: Tone }>;
  emptyMessage?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn(k.muted, "italic text-xs", className)}>{emptyMessage}</p>
    );
  }

  const max = Math.max(...items.map(i => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, i) => {
        const barCls = item.tone
          ? TONE[item.tone].barCls
          : SEG_PALETTE[Math.min(i, SEG_PALETTE.length - 1)];
        return (
          <div
            key={item.label}
            className="grid grid-cols-[1fr_auto] items-center gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground/80 tabular-nums w-3 shrink-0 text-right">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1 min-w-0">
                <span className="text-xs text-foreground/85 truncate block">
                  {item.label}
                </span>
                <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", barCls)}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / max) * 100}%` }}
                    transition={{
                      duration: 0.6,
                      ease: "easeOut",
                      delay: i * 0.05,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-xs font-bold tabular-nums text-foreground">
                {item.value}
              </span>
              {total > 0 && (
                <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                  {Math.round((item.value / total) * 100)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── StatRow ───────────────────────────────────────────────────────────────────

/**
 * Compact key-value grid. Replaces MetricRail.
 */
export function StatRow({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: string | number; tone?: Tone }>;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colCls =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-3"
        : columns === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-2";

  return (
    <div className={cn("grid gap-3", colCls, className)}>
      {items.map(item => {
        const t = TONE[item.tone ?? "neutral"];
        return (
          <div key={item.label} className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/85">
              {item.label}
            </p>
            <p
              className={cn(
                "text-sm font-bold tabular-nums leading-tight",
                t.textCls
              )}
            >
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── BigNum ────────────────────────────────────────────────────────────────────

/**
 * Large single-metric display for KPI highlights.
 */
export function BigNum({
  value,
  label,
  tone = "neutral",
  sub,
  className,
}: {
  value: string | number;
  label: string;
  tone?: Tone;
  sub?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "text-2xl font-black tabular-nums leading-none tracking-tight",
          t.textCls
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/80 tabular-nums">
          {sub}
        </p>
      )}
    </div>
  );
}

// ── RingChart ─────────────────────────────────────────────────────────────────

/**
 * Standalone ring SVG — no side text. Use this for custom card layouts where
 * you want the ring large and positioned next to your own content.
 */
export function RingChart({
  value,
  tone,
  size = 88,
  strokeWidth = 8,
  label,
  className,
}: {
  value: number;
  tone: Tone;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const clamped = Math.max(0, Math.min(value, 1));
  const pct = Math.round(clamped * 100);
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted/20 dark:stroke-muted/25"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={t.stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            t.textCls,
            size >= 80 ? "text-xl" : "text-base"
          )}
        >
          {pct}%
        </span>
        {label && (
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/85 leading-none">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // 0° = 12 o'clock
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, endDeg);
  const i1 = polarToCartesian(cx, cy, innerR, startDeg);
  const i2 = polarToCartesian(cx, cy, innerR, endDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i1.x} ${i1.y}`,
    `Z`,
  ].join(" ");
}

// ── DonutChart ────────────────────────────────────────────────────────────────

/**
 * Multi-segment SVG donut/pie chart for distributions.
 * Each segment fades + scales in from the center.
 */
export function DonutChart({
  segments,
  size = 80,
  thickness = 14,
  label,
  sublabel,
  emptyMessage,
  className,
}: {
  segments: Array<{ label: string; value: number; tone?: Tone; fill?: string }>;
  size?: number;
  thickness?: number;
  label?: string | number;
  sublabel?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const visible = segments.filter(s => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR - thickness;
  const midR = (outerR + innerR) / 2;

  const FALLBACK_FILLS = [
    "var(--primary)",
    "color-mix(in srgb, var(--primary) 72%, var(--muted-foreground) 28%)",
    "var(--destructive)",
    "var(--muted-foreground)",
    "color-mix(in srgb, var(--primary) 55%, var(--background))",
  ];

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "relative shrink-0 flex items-center justify-center",
          className
        )}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          <circle
            cx={cx}
            cy={cy}
            r={midR}
            fill="none"
            strokeWidth={thickness}
            className="stroke-muted/20"
          />
        </svg>
        {emptyMessage && (
          <span className="absolute text-[9px] text-muted-foreground/80 text-center px-1 leading-tight">
            {emptyMessage}
          </span>
        )}
      </div>
    );
  }

  let cumDeg = 0;
  const slices = visible.map((seg, i) => {
    const deg = (seg.value / total) * 360;
    const start = cumDeg;
    const end = cumDeg + Math.max(deg - 1.5, 0.5); // 1.5° gap between segments
    cumDeg += deg;
    const fill = seg.fill
      ? seg.fill
      : seg.tone
        ? TONE[seg.tone].stroke
        : FALLBACK_FILLS[i % FALLBACK_FILLS.length];
    const d =
      deg >= 359 ? undefined : arcPath(cx, cy, outerR, innerR, start, end);
    return { ...seg, fill, d, deg };
  });

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("relative shrink-0", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={midR}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted/15 dark:stroke-muted/20"
        />
        {slices.map((slice, i) =>
          slice.d ? (
            <motion.path
              key={slice.label}
              d={slice.d}
              fill={slice.fill}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
            />
          ) : (
            /* Full circle — single segment = 100% */
            <motion.circle
              key={slice.label}
              cx={cx}
              cy={cy}
              r={midR}
              fill="none"
              strokeWidth={thickness}
              stroke={slice.fill}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          )
        )}
      </svg>
      {/* Center content */}
      {(label !== undefined || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {label !== undefined && (
            <span className="text-sm font-black tabular-nums leading-none text-foreground">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[9px] font-medium text-muted-foreground/85 leading-none mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── MiniColumnChart ───────────────────────────────────────────────────────────

/**
 * Small vertical bar chart — for ranked distributions (e.g. docs by department).
 */
export function MiniColumnChart({
  items,
  barAreaH = 44,
  className,
}: {
  items: Array<{ label: string; value: number; tone?: Tone }>;
  barAreaH?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(i => i.value), 1);

  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      {items.map((item, i) => {
        const barCls = item.tone
          ? TONE[item.tone].barCls
          : SEG_PALETTE[Math.min(i, SEG_PALETTE.length - 1)];
        const heightPct = Math.max((item.value / max) * 100, 4);
        return (
          <div
            key={item.label}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
          >
            <span className="text-[10px] font-bold tabular-nums text-foreground/80 leading-none h-3 flex items-center">
              {item.value}
            </span>
            <div
              className="w-full relative overflow-hidden rounded-t-sm bg-muted/20"
              style={{ height: barAreaH }}
            >
              <motion.div
                className={cn(
                  "absolute bottom-0 inset-x-0 rounded-t-sm",
                  barCls
                )}
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                  delay: i * 0.07,
                }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground/80 truncate w-full text-center leading-none">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── ScoreRingVertical ─────────────────────────────────────────────────────────

/**
 * Vertical variant of ScoreRing — ring on top, labels stacked below.
 * Useful for side-by-side comparisons inside a card.
 */
export function ScoreRingVertical({
  value,
  tone,
  size = 64,
  label,
  headline,
  className,
}: {
  value: number;
  tone: Tone;
  size?: number;
  label: string;
  headline: string;
  className?: string;
}) {
  const t = TONE[tone];
  const clamped = Math.max(0, Math.min(value, 1));
  const pct = Math.round(clamped * 100);
  const strokeWidth = 8;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted/20 dark:stroke-muted/30"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke={t.stroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-[13px] font-black tabular-nums leading-none",
              t.textCls
            )}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-center min-w-0 max-w-full">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 truncate">
          {label}
        </p>
        <p
          className={cn(
            "text-[11px] font-semibold leading-tight",
            t.textCls,
            "truncate"
          )}
        >
          {headline}
        </p>
      </div>
    </div>
  );
}

// ── Backward-compatible re-exports ────────────────────────────────────────────
// Wrap new components so existing OverviewTab call sites compile unchanged.

export function RadialGauge({
  label,
  value,
  tone,
  headline,
  detail,
  className,
}: {
  label: string;
  value: number;
  tone: ChartTone;
  headline: string;
  detail: string;
  className?: string;
}) {
  return (
    <ScoreRing
      value={value}
      tone={legacyToTone(tone)}
      label={label}
      headline={headline}
      detail={detail}
      className={className}
    />
  );
}

export function MetricRail({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: string | number; tone?: ChartTone }>;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <StatRow
      items={items.map(i => ({
        label: i.label,
        value: i.value,
        tone: i.tone ? legacyToTone(i.tone) : "neutral",
      }))}
      columns={columns as 1 | 2 | 3}
      className={className}
    />
  );
}

export function DistributionBar({
  segments,
  emptyMessage,
  className,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <SegBar
      segments={segments.map(s => ({ label: s.label, value: s.value }))}
      emptyMessage={emptyMessage}
      className={className}
    />
  );
}

export function RankedBars({
  items,
  emptyMessage,
  className,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <RankList
      items={items.map(i => ({ label: i.label, value: i.value }))}
      emptyMessage={emptyMessage}
      className={className}
    />
  );
}
