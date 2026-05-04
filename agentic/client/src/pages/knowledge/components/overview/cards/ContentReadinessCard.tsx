import { Library } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from "recharts";
import { SurfaceCard, IconBadge, CardFooter } from "../OverviewPrimitives";
import type { ContentReadinessCardModel } from "../OverviewPage";

const COSTCO_BLUE = "#0066B2";

export function ContentReadinessCard({
  data,
}: {
  data: ContentReadinessCardModel;
}) {
  const total = Math.max(data.trackedCount, 1);
  const livePct = total > 0 ? Math.round((data.liveCount / total) * 100) : 0;
  const statusTone =
    data.liveCount > 0
      ? "brand"
      : data.pendingReviewCount > 0
        ? "warning"
        : data.readyToPublishCount > 0
          ? "brand"
        : "neutral";
  const visibleDepartments = data.topDepartments.slice(0, 2);
  const remainingDepartmentCount = Math.max(
    data.topDepartments.length - visibleDepartments.length,
    0
  );

  const barData = [
    { name: "Live", value: data.liveCount },
    { name: "Pending Review", value: data.pendingReviewCount },
    { name: "Ready", value: data.readyToPublishCount },
    { name: "Processing", value: data.processingCount },
    { name: "Archived", value: data.archivedCount },
    ...(data.missingLabelsCount > 0
      ? [{ name: "Gaps", value: data.missingLabelsCount }]
      : []),
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
      {/* ── Single-row header: icon · title · stats · depts · badge ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Icon + title */}
        <IconBadge
          icon={Library}
          tone={statusTone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Content Readiness
        </h3>

        {/* Separator */}
        <span className="hidden xl:block h-5 w-px bg-border/50" />

        {/* Inline stats — large font, same baseline as title */}
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-primary">
              {data.liveCount}/{total}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              searchable
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {livePct}%
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              live
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.pendingReviewCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              pending
            </span>
          </span>
          {data.readyToPublishCount > 0 && (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums tracking-tight text-primary">
                {data.readyToPublishCount}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                ready
              </span>
            </span>
          )}
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.processingCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              processing
            </span>
          </span>
          {data.missingLabelsCount > 0 && (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                {data.missingLabelsCount}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                gaps
              </span>
            </span>
          )}

          {visibleDepartments.length > 0 && (
            <>
              <span className="hidden lg:block h-4 w-px bg-border/40" />
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleDepartments.map(dept => (
                  <span
                    key={dept.label}
                    className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {dept.label}
                    <span className="font-bold tabular-nums text-foreground">
                      {dept.value}
                    </span>
                  </span>
                ))}
                {remainingDepartmentCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-border/35 bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    +{remainingDepartmentCount} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Distribution chart — fills remaining height ── */}
      <div className="mt-4 flex-1" style={{ minHeight: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={barData}
            margin={{ top: 20, right: 4, left: -4, bottom: 0 }}
            barCategoryGap="18%"
          >
            <defs>
              <linearGradient id="cr-bar-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COSTCO_BLUE} stopOpacity={0.92} />
                <stop
                  offset="100%"
                  stopColor={COSTCO_BLUE}
                  stopOpacity={0.55}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeOpacity={0.25}
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: 11,
                fontWeight: 600,
              }}
              dy={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.18 }}
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
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
              animationBegin={150}
              fill="url(#cr-bar-g)"
            >
              <LabelList
                dataKey="value"
                position="top"
                style={{
                  fill: "var(--foreground)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                offset={8}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
