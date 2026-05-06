import { CalendarClock } from "lucide-react";
import { SurfaceCard, IconBadge, CardFooter } from "../OverviewPrimitives";
import { SegBar } from "../ChartPrimitives";
import type { ContentCurrencyCardModel } from "../OverviewPage";
import type { ChipTone } from "../OverviewPrimitives";

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

  const segments = [
    { label: "Current", value: data.currentCount, tone: "success" as const },
    { label: "Review", value: data.reviewCount, tone: "positive" as const },
    { label: "Stale", value: data.staleCount, tone: "warning" as const },
    { label: "Unknown", value: data.unknownCount, tone: "neutral" as const },
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
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

      <div className="mt-5 flex-1 flex flex-col justify-center">
        <SegBar segments={segments} emptyMessage="No content tracked yet." />
      </div>

      <div className="mt-3 pt-3 border-t border-border/20">
        <CardFooter action={data.action} />
      </div>
    </SurfaceCard>
  );
}
