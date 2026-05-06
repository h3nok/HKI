import { Brain } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  SurfaceCard,
  IconBadge,
  CardFooter,
  IllustrationEmptyState,
} from "../OverviewPrimitives";
import type { AnswerTrustCardModel } from "../OverviewPage";
import { EmptyMeasurementIllustration } from "./ModularIllustrations";

export function AnswerTrustCard({ data }: { data: AnswerTrustCardModel }) {
  const hasTrustData = data.trustScore !== null;
  const score = data.trustScore ?? 0;
  const statusTone = !hasTrustData
    ? "neutral"
    : score >= 80
      ? "brand"
      : score >= 55
        ? "warning"
        : "danger";

  const radarData = [
    { dimension: "Retrieval", score: data.retrievalScore },
    { dimension: "Coverage", score: data.coverageScore },
    { dimension: "Depth", score: Math.min(data.avgChunksPerSearch * 20, 100) },
    { dimension: "Trust", score },
    {
      dimension: "Accuracy",
      score: Math.round((score + data.retrievalScore) / 2),
    },
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
      {/* ── Single-row header: icon · title · stats · badge ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge
          icon={Brain}
          tone={statusTone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Answer Quality
        </h3>

        {hasTrustData && (
          <>
            <span className="hidden sm:block h-5 w-px bg-border/50" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-primary">
                  {score}%
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  quality
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.retrievalScore}%
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  retrieval
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.coverageScore > 0 ? `${data.coverageScore}%` : "—"}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  coverage
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.avgChunksPerSearch > 0
                    ? data.avgChunksPerSearch.toFixed(1)
                    : "—"}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  chunks/q
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                · {data.lastCheckedLabel}
              </span>
            </div>
          </>
        )}
      </div>

      {hasTrustData ? (
        <div className="relative mt-3 flex-1" style={{ minHeight: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
              <PolarGrid
                stroke="var(--border)"
                strokeOpacity={0.5}
                gridType="polygon"
              />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="score"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.18}
                strokeWidth={1.5}
                animationDuration={700}
                animationEasing="ease-out"
                dot={{
                  r: 3,
                  fill: "var(--primary)",
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 5,
                  fill: "var(--primary)",
                  strokeWidth: 0,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  boxShadow: "none",
                  padding: "6px 10px",
                }}
                itemStyle={{ color: "var(--popover-foreground)" }}
                formatter={value => [`${value}%`, "Score"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 flex-1">
          <IllustrationEmptyState
            illustration={<EmptyMeasurementIllustration />}
            title="Not measured yet"
            description="Ask a few questions, then run a gap analysis or evaluation to populate answer-quality signals."
            tone="neutral"
          />
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
