import { Library } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  isSearchableDocumentStatus,
  type DocumentSummary,
} from "@shared/knowledge-types";
import { SegBar } from "./ChartPrimitives";
import StatusCard, { type CardStatus } from "./StatusCard";

export default function ContentCard({
  selectedStream,
  onNavigate,
}: {
  selectedStream?: string;
  onNavigate: () => void;
}) {
  const docsQ = trpc.knowledge.listDocuments.useQuery(
    selectedStream
      ? { valueStreamId: selectedStream, limit: 100 }
      : { limit: 100 },
    { retry: false, staleTime: 10_000, refetchInterval: 30_000 }
  );
  const docs = useMemo(
    () => (docsQ.data?.documents as DocumentSummary[]) ?? [],
    [docsQ.data]
  );
  const total = docsQ.data?.total ?? docs.length;

  const liveCount = docs.filter(d =>
    isSearchableDocumentStatus(d.status)
  ).length;
  const reviewCount = docs.filter(d => d.status === "pending_review").length;
  const pendingCount = docs.filter(d =>
    ["pending", "processing"].includes(d.status)
  ).length;
  const archivedCount = docs.filter(d => d.status === "archived").length;
  const missingDeptCount = docs.filter(d => !d.department?.trim()).length;
  const trackedCount = Math.max(
    total,
    liveCount + reviewCount + pendingCount + archivedCount
  );

  const status: CardStatus =
    liveCount > 0 ? "ok" : pendingCount > 0 || total > 0 ? "warn" : "neutral";

  const primaryValue =
    trackedCount > 0
      ? `${liveCount} / ${trackedCount}`
      : docsQ.isLoading
        ? "…"
        : "0";

  const secondary =
    [
      reviewCount > 0 && `${reviewCount} awaiting review`,
      pendingCount > 0 && `${pendingCount} processing`,
      archivedCount > 0 && `${archivedCount} archived`,
      missingDeptCount > 0 && `${missingDeptCount} missing labels`,
    ]
      .filter(Boolean)
      .join(" · ") ||
    (total > 0
      ? "Content uploaded but not searchable yet"
      : "No documents yet — use Add Content to start indexing");

  return (
    <StatusCard
      icon={Library}
      title="Your Content"
      status={status}
      primaryValue={primaryValue}
      primaryLabel="docs live"
      secondaryText={secondary}
      actionLabel="View library"
      onAction={onNavigate}
    >
      <SegBar
        hideLegend
        segments={[
          { label: "Live", value: liveCount, tone: "positive" },
          {
            label: "Review",
            value: reviewCount,
            tone: reviewCount > 0 ? "warning" : "neutral",
          },
          {
            label: "Processing",
            value: pendingCount,
            tone: pendingCount > 0 ? "warning" : "neutral",
          },
          { label: "Archived", value: archivedCount, tone: "neutral" },
        ]}
      />
    </StatusCard>
  );
}
