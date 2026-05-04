import { Check, Minus, TriangleAlert } from "lucide-react";
import { cn } from "@hki/ui";
import { SegBar, type Tone } from "./ChartPrimitives";

export interface OverviewVisualItem {
  label: string;
  value: number;
  tone?: Tone;
  valueLabel?: string;
}

const TONE_FRAME: Record<Tone, string> = {
  brand: "border-primary/14",
  success: "border-primary/14",
  positive: "border-primary/12",
  warning: "border-border/40 bg-secondary/5",
  critical: "border-border/40 bg-secondary/10",
  neutral: "border-border/45",
};

const TONE_INDICATOR: Record<Tone, string> = {
  brand: "bg-primary",
  success: "bg-primary",
  positive: "bg-primary/80",
  warning: "bg-secondary/80",
  critical: "bg-secondary",
  neutral: "bg-muted-foreground/50",
};

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-primary",
  success: "text-primary",
  positive: "text-primary",
  warning: "text-secondary",
  critical: "text-secondary",
  neutral: "text-muted-foreground",
};

function toneFillColor(tone: Tone) {
  switch (tone) {
    case "brand":
      return "var(--primary)";
    case "success":
      return "color-mix(in srgb, var(--primary) 88%, white)";
    case "positive":
      return "color-mix(in srgb, var(--primary) 76%, white)";
    case "warning":
      return "color-mix(in srgb, var(--primary) 84%, var(--secondary) 16%)";
    case "critical":
      return "color-mix(in srgb, var(--primary) 68%, var(--secondary) 32%)";
    case "neutral":
    default:
      return "color-mix(in srgb, var(--muted-foreground) 34%, var(--background))";
  }
}

function LegendToken({
  item,
  compact = false,
}: {
  item: OverviewVisualItem;
  compact?: boolean;
}) {
  const tone = item.tone ?? "neutral";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]"
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: toneFillColor(tone) }}
      />
      <span className="text-muted-foreground">{item.label}</span>
      <span
        className={cn("font-semibold tabular-nums ml-auto", TONE_TEXT[tone])}
      >
        {item.valueLabel ?? item.value}
      </span>
    </div>
  );
}

function OverviewBarRow({
  item,
  total,
}: {
  item: OverviewVisualItem;
  total: number;
}) {
  const tone = item.tone ?? "neutral";
  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;

  return (
    <div className="space-y-1.5 rounded-2xl border border-border/40 bg-background/72 px-3 py-2.5 dark:bg-card/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: toneFillColor(tone) }}
          />
          <span className="truncate text-[11px] font-semibold text-foreground/85">
            {item.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-right">
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              TONE_TEXT[tone]
            )}
          >
            {item.valueLabel ?? item.value}
          </span>
          <span className="w-8 text-[10px] tabular-nums text-muted-foreground/70">
            {pct}%
          </span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted/18">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: toneFillColor(tone),
          }}
        />
      </div>
    </div>
  );
}

export function ColumnBreakdownSummary({
  items,
  compact = false,
  className,
}: {
  items: OverviewVisualItem[];
  compact?: boolean;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        {items.map(item => {
          const tone = item.tone ?? "neutral";

          return (
            <div
              key={item.label}
              className="rounded-[14px] border border-border/35 bg-background/70 px-2.5 py-2 dark:bg-card/65"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: toneFillColor(tone) }}
                />
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/78">
                  {item.label}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-sm font-black tabular-nums",
                  TONE_TEXT[tone]
                )}
              >
                {item.valueLabel ?? item.value}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-[18px] border border-border/40 bg-background/72 px-3 py-3 dark:bg-card/70">
        <SegBar
          segments={items.map(item => ({
            label: item.label,
            value: item.value,
            tone: item.tone,
          }))}
          hideLegend
        />
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <OverviewBarRow key={item.label} item={item} total={total} />
        ))}
      </div>
    </div>
  );
}

export function DonutBreakdownSummary({
  items,
  label,
  sublabel,
  compact = false,
  className,
}: {
  items: OverviewVisualItem[];
  label: string | number;
  sublabel: string;
  compact?: boolean;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 lg:grid-cols-[8.5rem_minmax(0,1fr)]",
        className
      )}
    >
      <div className="rounded-[22px] border border-border/45 bg-background/76 px-4 py-4 dark:bg-card/72">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
          {sublabel}
        </p>
        <p className="mt-1 text-[2rem] font-black leading-none tracking-tighter text-foreground">
          {label}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {total > 0 ? `${total} tracked states` : "No freshness data"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-[18px] border border-border/40 bg-background/72 px-3 py-3 dark:bg-card/70">
          <SegBar
            segments={items.map(item => ({
              label: item.label,
              value: item.value,
              tone: item.tone,
            }))}
            hideLegend
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(item => (
            <OverviewBarRow key={item.label} item={item} total={total} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DualMeterSummary({
  items,
  compact = false,
  className,
}: {
  items: Array<OverviewVisualItem & { value: number }>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", className)}>
      {items.map(item => {
        const pct = Math.round(Math.max(0, Math.min(item.value, 1)) * 100);
        const tone = item.tone ?? "neutral";

        return (
          <div
            key={item.label}
            className={cn(
              "relative rounded-[18px] border bg-background/78 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] dark:bg-card/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              TONE_FRAME[tone],
              compact ? "px-2.5 py-2.5" : "px-3 py-3"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">
                  {item.label}
                </p>
                <p
                  className={cn(
                    compact ? "mt-1 text-lg" : "mt-1.5 text-[1.6rem]",
                    "font-black leading-none tracking-tighter tabular-nums",
                    TONE_TEXT[tone]
                  )}
                >
                  {item.valueLabel ?? `${pct}%`}
                </p>
              </div>
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  TONE_INDICATOR[tone]
                )}
              />
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted/18">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: toneFillColor(tone),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GateCheckSummary({
  passed,
  blocked,
  total,
  compact = false,
  className,
}: {
  passed: number;
  blocked: number;
  total: number;
  compact?: boolean;
  className?: string;
}) {
  const pending = Math.max(total - passed - blocked, 0);
  const columns = Math.min(total, 6);
  const cells = Array.from({ length: total }, (_, index) => {
    if (index < passed) return "passed" as const;
    if (index < passed + blocked) return "blocked" as const;
    return "pending" as const;
  });

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells.map((state, index) => (
          <div
            key={`${state}-${index}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              state === "passed" &&
                "border-primary/20 bg-primary/10 text-primary",
              state === "blocked" &&
                "border-secondary/20 bg-primary/10 text-secondary",
              state === "pending" &&
                "border-border/40 bg-background/70 text-muted-foreground dark:bg-card/70"
            )}
          >
            {state === "passed" ? (
              <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            ) : state === "blocked" ? (
              <TriangleAlert className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            ) : (
              <Minus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <LegendToken
          item={{ label: "Passed", value: passed, tone: "brand" }}
          compact={compact}
        />
        <LegendToken
          item={{ label: "Blocked", value: blocked, tone: "critical" }}
          compact={compact}
        />
        {pending > 0 && (
          <LegendToken
            item={{ label: "Pending", value: pending, tone: "neutral" }}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
}
