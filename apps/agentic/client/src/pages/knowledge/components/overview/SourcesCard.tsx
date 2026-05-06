import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { SegBar } from "./ChartPrimitives";
import StatusCard, { type CardStatus } from "./StatusCard";
import { formatRelativeTime } from "./utils";

export default function SourcesCard({ onNavigate }: { onNavigate: () => void }) {
  const connectorsQ = trpc.connectors.list.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const connectors = useMemo(() => connectorsQ.data ?? [], [connectorsQ.data]);

  const activeCount  = connectors.filter(c => c.status === "active").length;
  const pausedCount  = connectors.filter(c => c.status === "paused").length;
  const errorCount   = connectors.filter(
    c => c.status === "error" || c.consecutiveErrors >= 3
  ).length;
  const laggingCount = connectors.filter(c => {
    if (c.status !== "active") return false;
    if (!c.lastSyncAt) return true;
    const mins = Math.floor((Date.now() - new Date(c.lastSyncAt).getTime()) / 60_000);
    return mins > c.syncIntervalMinutes * 2;
  }).length;
  const latestSync = connectors
    .filter(c => c.lastSyncAt)
    .sort((a, b) =>
      new Date(b.lastSyncAt as string).getTime() - new Date(a.lastSyncAt as string).getTime()
    )[0];
  const latestSyncLabel = latestSync?.lastSyncAt
    ? formatRelativeTime(latestSync.lastSyncAt)
    : "No sync yet";
  const total = connectors.length;

  const status: CardStatus =
    errorCount > 0   ? "error"
    : laggingCount > 0 ? "warn"
    : total > 0        ? "ok"
    : "neutral";

  const secondary = total > 0
    ? [
        errorCount > 0   && `${errorCount} need attention`,
        laggingCount > 0 && `${laggingCount} behind`,
        pausedCount > 0  && `${pausedCount} paused`,
        `last sync ${latestSyncLabel}`,
      ].filter(Boolean).join(" · ")
    : "Connect Drive, SharePoint, or APIs";

  return (
    <StatusCard
      icon={RefreshCw}
      title="Connected Sources"
      status={status}
      primaryValue={total > 0 ? activeCount : "—"}
      primaryLabel={total > 0 ? `of ${total} source${total === 1 ? "" : "s"} active` : "no sources connected"}
      secondaryText={secondary}
      actionLabel="Manage sources"
      onAction={onNavigate}
    >
      {total > 0 && (
        <SegBar
          hideLegend
          segments={[
            { label: "Working", value: activeCount,  tone: "positive" },
            { label: "Behind",  value: laggingCount, tone: "warning" },
            { label: "Errors",  value: errorCount,   tone: "critical" },
            { label: "Paused",  value: pausedCount,  tone: "neutral" },
          ]}
        />
      )}
    </StatusCard>
  );
}
