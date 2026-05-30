import { ClipboardList } from "lucide-react";
import {
  SurfaceCard,
  IconBadge,
  InlineMetric,
  CardFooter,
  IllustrationEmptyState,
} from "../OverviewPrimitives";
import type { ReviewQueueCardModel } from "../OverviewPage";
import { InboxIllustration } from "./ModularIllustrations";
import type { ChipTone } from "../OverviewPrimitives";

export function ReviewQueueCard({ data }: { data: ReviewQueueCardModel }) {
  const tone: ChipTone =
    data.failedCount > 0
      ? "danger"
      : data.pendingCount > 0
        ? "warning"
        : data.readyToPublishCount > 0
          ? "brand"
          : "success";
  const hasItems =
    data.pendingCount > 0 ||
    data.readyToPublishCount > 0 ||
    data.runningCount > 0 ||
    data.failedCount > 0;

  return (
    <SurfaceCard
      variant={
        data.failedCount > 0
          ? "danger"
          : data.pendingCount > 0
            ? "warning"
            : "raised"
      }
      className="flex h-full flex-col gap-4 px-5 py-5"
    >
      {/* ── Single-row header: icon · title · stats · badge ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge
          icon={ClipboardList}
          tone={tone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Review Queue
        </h3>

        {hasItems && (
          <>
            <span className="hidden sm:block h-5 w-px bg-border/50" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.pendingCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  pending
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-primary">
                  {data.readyToPublishCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  ready
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.runningCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  running
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-base font-black tabular-nums tracking-tight text-foreground">
                  {data.failedCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  failed
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground/75">
                {data.pendingCount > 0
                  ? `· oldest ${data.oldestPendingLabel}`
                  : data.readyToPublishCount > 0
                    ? `· ${data.readyToPublishCount} ready to publish`
                    : null}
              </span>
            </div>
          </>
        )}
      </div>

      {hasItems ? (
        <div className="grid gap-3 md:grid-cols-4">
          <InlineMetric
            label="Pending"
            value={data.pendingCount}
            tone={data.pendingCount > 0 ? "warning" : "neutral"}
          />
          <InlineMetric
            label="Ready"
            value={data.readyToPublishCount}
            tone={data.readyToPublishCount > 0 ? "brand" : "neutral"}
          />
          <InlineMetric
            label="Running"
            value={data.runningCount}
            tone={data.runningCount > 0 ? "brand" : "neutral"}
          />
          <InlineMetric
            label="Failed"
            value={data.failedCount}
            tone={data.failedCount > 0 ? "danger" : "neutral"}
          />
        </div>
      ) : (
        <IllustrationEmptyState
          illustration={<InboxIllustration />}
          title="Queue is clear"
          description="Nothing is waiting for review or publishing right now. New submissions will appear here."
          tone="success"
        />
      )}

      <CardFooter action={data.action} />
    </SurfaceCard>
  );
}
