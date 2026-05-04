import { CalendarClock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { SurfaceCard, IconBadge, CardFooter } from "../OverviewPrimitives";
import type { ContentCurrencyCardModel } from "../OverviewPage";
import type { ChipTone } from "../OverviewPrimitives";

const COSTCO_BLUE = "#0066B2";

export function ContentCurrencyCard({
  data,
}: {
  data: ContentCurrencyCardModel;
}) {
  const total =
    data.currentCount + data.reviewCount + data.staleCount + data.unknownCount;
  const currentPercent =
    total > 0 ? Math.round((data.currentCount / total) * 100) : 0;
  const tone: ChipTone =
    data.staleCount > 0
      ? "warning"
      : data.currentCount > 0
        ? "success"
        : "neutral";

  const barData = [
    { name: "Current", value: data.currentCount },
    { name: "Review", value: data.reviewCount },
    { name: "Stale", value: data.staleCount },
    { name: "Unknown", value: data.unknownCount },
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
      {/* ── Single-row header: icon · title · stats ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge
          icon={CalendarClock}
          tone={tone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Content Freshness
        </h3>

        <span className="hidden sm:block h-5 w-px bg-border/50" />

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-primary">
              {currentPercent}%
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              current
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.reviewCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              due
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.staleCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              stale
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.unknownCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              unknown
            </span>
          </span>
        </div>
      </div>

      {/* ── Horizontal bar chart — fills space efficiently ── */}
      <div className="mt-4 flex-1" style={{ minHeight: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
          >
            <XAxis type="number" hide />
            <defs>
              <linearGradient id="fresh-bar-g" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={COSTCO_BLUE} stopOpacity={0.55} />
                <stop
                  offset="100%"
                  stopColor={COSTCO_BLUE}
                  stopOpacity={0.92}
                />
              </linearGradient>
            </defs>
            <YAxis
              type="category"
              dataKey="name"
              width={64}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.625rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                backdropFilter: "blur(8px)",
                padding: "8px 12px",
              }}
              itemStyle={{ color: "var(--popover-foreground)" }}
              cursor={{ fill: "var(--muted)", opacity: 0.15 }}
              formatter={value => {
                const v = Number(value) || 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return [`${v} (${pct}%)`, "Docs"];
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 8, 8, 0]}
              animationDuration={900}
              animationEasing="ease-out"
              barSize={28}
              fill="url(#fresh-bar-g)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Inline legend ── */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {barData.map(item => (
          <div key={item.name} className="inline-flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {item.name}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
