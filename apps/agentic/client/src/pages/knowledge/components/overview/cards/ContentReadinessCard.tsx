import { Library } from "lucide-react";
import { SurfaceCard, IconBadge, CardFooter } from "../OverviewPrimitives";
import { MiniColumnChart, type Tone } from "../ChartPrimitives";
import type { ContentReadinessCardModel } from "../OverviewPage";

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

  const items: Array<{ label: string; value: number; tone: Tone }> = [
    { label: "Live", value: data.liveCount, tone: "brand" },
    {
      label: "Pending",
      value: data.pendingReviewCount,
      tone: "warning",
    },
    { label: "Ready", value: data.readyToPublishCount, tone: "positive" },
    { label: "Processing", value: data.processingCount, tone: "neutral" },
    { label: "Archived", value: data.archivedCount, tone: "neutral" },
    ...(data.missingLabelsCount > 0
      ? [
          {
            label: "Gaps",
            value: data.missingLabelsCount,
            tone: "critical" as Tone,
          },
        ]
      : []),
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge
          icon={Library}
          tone={statusTone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Content Readiness
        </h3>

        <span className="hidden xl:block h-5 w-px bg-border/50" />

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
                    className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {dept.label}
                    <span className="font-bold tabular-nums text-foreground">
                      {dept.value}
                    </span>
                  </span>
                ))}
                {remainingDepartmentCount > 0 && (
                  <span className="inline-flex items-center rounded-md bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    +{remainingDepartmentCount} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex-1 flex flex-col justify-center">
        <MiniColumnChart items={items} barAreaH={120} />
      </div>

      <div className="mt-3 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
