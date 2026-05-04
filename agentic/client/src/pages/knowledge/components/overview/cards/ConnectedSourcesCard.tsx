import { Network } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  SurfaceCard,
  IconBadge,
  CardFooter,
  IllustrationEmptyState,
} from "../OverviewPrimitives";
import type { ConnectedSourcesCardModel } from "../OverviewPage";
import { DisconnectedPlugIllustration } from "./ModularIllustrations";
import type { ChipTone } from "../OverviewPrimitives";

const COSTCO_BLUE = "#0066B2";

export function ConnectedSourcesCard({
  data,
}: {
  data: ConnectedSourcesCardModel;
}) {
  const tone: ChipTone =
    data.errorCount > 0
      ? "danger"
      : data.laggingCount > 0
        ? "warning"
        : data.total > 0
          ? "brand"
          : "neutral";

  const barData = [
    { name: "Active", value: data.activeCount },
    { name: "Lagging", value: data.laggingCount },
    { name: "Errors", value: data.errorCount },
    { name: "Paused", value: data.pausedCount },
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
      {/* ── Single-row header: icon · title · stats · badge ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge icon={Network} tone={tone} className="h-9 w-9 shrink-0" />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Connected Sources
        </h3>

        {data.total > 0 && (
          <>
            <span className="hidden sm:block h-5 w-px bg-border/50" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-primary">
                  {data.total}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  total
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.activeCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  active
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.laggingCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  lagging
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.errorCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  errors
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                · {data.latestSyncLabel}
              </span>
            </div>
          </>
        )}
      </div>

      {data.total > 0 ? (
        <div className="mt-4 flex-1" style={{ minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
            >
              <XAxis type="number" hide />
              <defs>
                <linearGradient id="src-bar-g" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor={COSTCO_BLUE}
                    stopOpacity={0.55}
                  />
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
                width={56}
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
              />
              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
                animationDuration={900}
                animationEasing="ease-out"
                barSize={24}
                fill="url(#src-bar-g)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4">
          <IllustrationEmptyState
            illustration={<DisconnectedPlugIllustration />}
            title="No sources connected"
            description="Connect Google Drive, SharePoint, or other tools to automatically keep your knowledge base up to date."
            tone="neutral"
          />
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
