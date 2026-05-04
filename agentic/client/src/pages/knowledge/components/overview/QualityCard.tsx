import { Brain } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { ScoreBar } from "./ChartPrimitives";
import StatusCard, { type CardStatus } from "./StatusCard";
import { rateSearchScore, rateCoverage, formatRelativeTime } from "./utils";

export default function QualityCard({
  selectedStream,
  onNavigate,
}: {
  selectedStream?: string;
  onNavigate: () => void;
}) {
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  const analyticsQ = trpc.knowledge.analyticsMetrics.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : undefined,
    {
      retry: false,
      refetchInterval: 60_000,
    }
  );
  const gapSnapshotsQ = trpc.gemini.listGapSnapshots.useQuery(
    explicitStreamId
      ? { valueStreamId: explicitStreamId, limit: 1 }
      : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );

  const latestSnapshot = gapSnapshotsQ.data?.snapshots?.[0] ?? null;
  const avgTopScore = analyticsQ.data?.avgTopScore ?? 0;
  const avgFaithfulness = analyticsQ.data?.avgFaithfulness ?? 0;
  const ragasCoverageRate = analyticsQ.data?.ragasCoverageRate ?? 0;
  const coverageScore = latestSnapshot?.coverageScore ?? 0;
  const coverageLastCheck = latestSnapshot?.createdAt ?? null;
  const avgChunksPerSearch = analyticsQ.data?.avgChunksPerSearch ?? 0;

  const retrieval = rateSearchScore(avgTopScore);
  const status: CardStatus =
    retrieval === "good"
      ? "ok"
      : retrieval === "warn"
        ? "warn"
        : retrieval === "bad"
          ? "error"
          : "neutral";

  const primaryValue = avgTopScore ? `${(avgTopScore * 100).toFixed(0)}%` : "—";

  const secondary = [
    coverageScore > 0 && `coverage ${coverageScore}%`,
    avgChunksPerSearch > 0 && `${avgChunksPerSearch.toFixed(1)} chunks/q`,
    ragasCoverageRate > 0 &&
      `${(ragasCoverageRate * 100).toFixed(0)}% RAGAS coverage`,
    avgFaithfulness > 0 && `faithfulness ${avgFaithfulness.toFixed(2)}`,
    coverageLastCheck && `last check ${formatRelativeTime(coverageLastCheck)}`,
    !coverageLastCheck && "no gap analysis yet",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <StatusCard
      icon={Brain}
      title="Answer Quality"
      status={status}
      primaryValue={primaryValue}
      primaryLabel="retrieval relevance"
      secondaryText={secondary || undefined}
      actionLabel="Test answers"
      onAction={onNavigate}
    >
      <div className="space-y-1.5">
        <ScoreBar
          label="Retrieval"
          value={avgTopScore}
          tone={
            status === "ok"
              ? "positive"
              : status === "warn"
                ? "warning"
                : status === "error"
                  ? "critical"
                  : "neutral"
          }
          valueLabel={avgTopScore ? `${(avgTopScore * 100).toFixed(0)}%` : "—"}
        />
        <ScoreBar
          label="Coverage"
          value={coverageScore / 100}
          tone={
            rateCoverage(coverageScore) === "good"
              ? "positive"
              : rateCoverage(coverageScore) === "warn"
                ? "warning"
                : "neutral"
          }
          valueLabel={coverageScore ? `${coverageScore}%` : "—"}
        />
        <ScoreBar
          label="Faithfulness"
          value={avgFaithfulness}
          tone={
            avgFaithfulness >= 0.8
              ? "positive"
              : avgFaithfulness >= 0.6
                ? "warning"
                : avgFaithfulness > 0
                  ? "critical"
                  : "neutral"
          }
          valueLabel={avgFaithfulness ? avgFaithfulness.toFixed(2) : "—"}
        />
      </div>
    </StatusCard>
  );
}
