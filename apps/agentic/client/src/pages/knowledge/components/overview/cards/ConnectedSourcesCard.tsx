import { Network } from "lucide-react";
import {
  SurfaceCard,
  IconBadge,
  CardFooter,
  IllustrationEmptyState,
} from "../OverviewPrimitives";
import { SegBar } from "../ChartPrimitives";
import type { ConnectedSourcesCardModel } from "../OverviewPage";
import { DisconnectedPlugIllustration } from "./ModularIllustrations";
import type { ChipTone } from "../OverviewPrimitives";

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

  const segments = [
    { label: "Active", value: data.activeCount, tone: "success" as const },
    { label: "Lagging", value: data.laggingCount, tone: "warning" as const },
    { label: "Errors", value: data.errorCount, tone: "critical" as const },
    { label: "Paused", value: data.pausedCount, tone: "neutral" as const },
  ];

  return (
    <SurfaceCard variant="raised" className="flex h-full flex-col px-5 py-5">
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
        <div className="mt-5 flex-1 flex flex-col justify-center">
          <SegBar segments={segments} />
        </div>
      ) : (
        <div className="mt-4">
          <IllustrationEmptyState
            illustration={<DisconnectedPlugIllustration />}
            title="No sources connected"
            description="Connect Google Drive, SharePoint, or other tools to automatically keep your domain library up to date."
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
