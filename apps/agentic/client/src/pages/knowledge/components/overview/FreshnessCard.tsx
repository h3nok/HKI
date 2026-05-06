import { CalendarClock } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { DocumentSummary } from "@shared/knowledge-types";
import { SegBar } from "./ChartPrimitives";
import StatusCard, { type CardStatus } from "./StatusCard";
import { getFreshness } from "../../types";

export default function FreshnessCard({
  selectedStream,
  onNavigate,
}: {
  selectedStream?: string;
  onNavigate: () => void;
}) {
  const docsQ = trpc.knowledge.listDocuments.useQuery(
    selectedStream ? { valueStreamId: selectedStream, limit: 100 } : { limit: 100 },
    { retry: false, staleTime: 10_000, refetchInterval: 60_000 }
  );
  const docs = useMemo(
    () => (docsQ.data?.documents as DocumentSummary[]) ?? [],
    [docsQ.data]
  );

  const freshness = useMemo(() => {
    const buckets = { current: 0, review: 0, stale: 0 };
    for (const doc of docs) {
      const f = getFreshness(doc.updatedAt || doc.createdAt || null);
      if (f.label === "Current")    buckets.current++;
      else if (f.label === "Review") buckets.review++;
      else if (f.label === "Stale")  buckets.stale++;
    }
    return buckets;
  }, [docs]);

  const missingDeptCount = docs.filter(d => !d.department?.trim()).length;
  const trackedCount = freshness.current + freshness.review + freshness.stale;

  const status: CardStatus =
    freshness.stale > 0  ? "warn"
    : freshness.review > 0 ? "warn"
    : freshness.current > 0 ? "ok"
    : "neutral";

  const secondary = [
    freshness.review > 0  && `${freshness.review} check soon`,
    freshness.stale > 0   && `${freshness.stale} stale`,
    missingDeptCount > 0  && `${missingDeptCount} missing labels`,
  ].filter(Boolean).join(" · ")
    || (freshness.current > 0 ? "All content up to date" : "No freshness data yet");

  return (
    <StatusCard
      icon={CalendarClock}
      title="Freshness"
      status={status}
      primaryValue={freshness.current}
      primaryLabel={`of ${trackedCount} docs current`}
      secondaryText={secondary}
      actionLabel="View freshness"
      onAction={onNavigate}
    >
      <SegBar
        hideLegend
        emptyMessage=""
        segments={[
          { label: "Current",    value: freshness.current, tone: "positive" },
          { label: "Check soon", value: freshness.review,  tone: "warning" },
          { label: "Stale",      value: freshness.stale,   tone: "critical" },
        ]}
      />
    </StatusCard>
  );
}
