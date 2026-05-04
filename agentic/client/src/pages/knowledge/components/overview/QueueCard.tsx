import { ClipboardList } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import type { ReviewRecord } from "@shared/knowledge-types";
import { k } from "../../theme";
import StatusCard, { type CardStatus } from "./StatusCard";
import { formatRelativeTime } from "./utils";

export default function QueueCard({
  selectedStream,
  onNavigate,
}: {
  selectedStream?: string;
  onNavigate: () => void;
}) {
  const reviewPendingQ = trpc.knowledge.reviewListPending.useQuery(
    selectedStream ? { limit: 100, valueStreamId: selectedStream } : undefined,
    {
      retry: false,
      staleTime: 15_000,
      refetchInterval: 30_000,
      enabled: Boolean(selectedStream),
    }
  );
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    selectedStream ? { valueStreamId: selectedStream } : undefined,
    {
      retry: false,
      enabled: Boolean(selectedStream),
    }
  );

  const pendingReviews = useMemo(() => {
    const all = (reviewPendingQ.data as ReviewRecord[]) ?? [];
    return all.filter(r =>
      selectedStream ? r.streamId === selectedStream : true
    );
  }, [reviewPendingQ.data, selectedStream]);

  const jobs = useMemo(() => {
    const all = (jobsQ.data?.jobs ?? []) as any[];
    return all.filter(j =>
      selectedStream ? j.streamId === selectedStream : true
    );
  }, [jobsQ.data, selectedStream]);

  const activeJobs = jobs.filter(
    j => !["completed", "failed"].includes(j.status)
  ).length;
  const failedJobs = jobs.filter(j => j.status === "failed").length;
  const pendingCount = pendingReviews.length;

  const oldestPending = [...pendingReviews].sort(
    (a, b) =>
      new Date(a.submittedAt ?? a.createdAt).getTime() -
      new Date(b.submittedAt ?? b.createdAt).getTime()
  )[0];
  const oldestPendingLabel = oldestPending
    ? formatRelativeTime(oldestPending.submittedAt ?? oldestPending.createdAt)
    : "Queue clear";

  const status: CardStatus =
    failedJobs > 0 ? "error" : pendingCount > 0 ? "warn" : "ok";

  const secondary =
    [
      activeJobs > 0 && `${activeJobs} running`,
      failedJobs > 0 && `${failedJobs} failed`,
      pendingCount > 0 && `oldest ${oldestPendingLabel}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Queue clear";

  return (
    <StatusCard
      icon={ClipboardList}
      title="Review Queue"
      status={status}
      primaryValue={pendingCount}
      primaryLabel="waiting for review"
      secondaryText={secondary}
      actionLabel="Review content"
      onAction={onNavigate}
    >
      <div className="flex gap-2">
        {[
          {
            label: "Running",
            value: activeJobs,
            tone: activeJobs > 0 ? k.statusWarningBadge : k.statusNeutralBadge,
          },
          {
            label: "Failed",
            value: failedJobs,
            tone: failedJobs > 0 ? k.statusCriticalBadge : k.statusNeutralBadge,
          },
        ].map(m => (
          <div
            key={m.label}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border",
              m.tone
            )}
          >
            <span className="font-bold tabular-nums">{m.value}</span>
            <span className="text-[10px] opacity-70">{m.label}</span>
          </div>
        ))}
      </div>
    </StatusCard>
  );
}
