import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  HermeticEmptyState,
  cn,
} from "@hki/ui";
import { AlertCircle, Eye, Loader2 } from "lucide-react";
import type {
  SearchResult,
  ShadowRetrievalComparison,
} from "@shared/knowledge-types";

import { k } from "../theme";
import {
  formatRetrievalScore,
  getRetrievalScoreTone,
  isNormalizedRetrievalScore,
} from "../types";

function getShadowResultTitle(result: SearchResult): string {
  const metadataTitle =
    typeof result.metadata?.title === "string" ? result.metadata.title : null;
  return result.citation?.documentTitle || metadataTitle || result.documentId;
}

function getShadowResultPreview(result: SearchResult): string {
  const preview = result.citation?.highlight || result.content || "";
  const normalized = preview.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }
  return `${normalized.slice(0, 157).trim()}...`;
}

interface ShadowSnapshotCardProps {
  label: string;
  snapshot: ShadowRetrievalComparison["baseline"];
  showSelectedDocumentStatus: boolean;
}

function ShadowSnapshotCard({
  label,
  snapshot,
  showSelectedDocumentStatus,
}: ShadowSnapshotCardProps) {
  const results = snapshot.search.results.slice(0, 3);

  return (
    <div className="space-y-3 rounded-lg border border-border/30 bg-background/70 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className={cn("mt-1", k.muted)}>
            {snapshot.search.totalResults} total result
            {snapshot.search.totalResults === 1 ? "" : "s"} in{" "}
            {snapshot.search.searchTimeMs}ms.
          </p>
        </div>
        {showSelectedDocumentStatus ? (
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              snapshot.includesSelectedDocument
                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                : "border-border/40 bg-background/80 text-muted-foreground"
            )}
          >
            {snapshot.includesSelectedDocument
              ? "Selected doc included"
              : "Selected doc absent"}
          </Badge>
        ) : null}
      </div>

      {snapshot.answer?.answer ? (
        <div className="rounded-md border border-border/30 bg-muted/25 px-2.5 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            Answer preview
          </p>
          <p className="mt-1 text-sm text-foreground/85">
            {snapshot.answer.answer}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/40 bg-muted/20 px-2.5 py-2 text-sm text-muted-foreground">
          No grounded answer preview was generated for this snapshot.
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
            Top retrieved chunks
          </p>
          <div className="space-y-2">
            {results.map(result => {
              const scoreScale = result.scoreScale;
              const scoreTone = getRetrievalScoreTone(
                result.score ?? 0,
                scoreScale
              );

              return (
                <div
                  key={`${label}-${result.chunkId}`}
                  className="rounded-md border border-border/30 bg-muted/20 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {getShadowResultTitle(result)}
                    </p>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                        scoreTone === "high"
                          ? "bg-primary/10 text-primary"
                          : scoreTone === "medium"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/60 text-muted-foreground"
                      )}
                      title={
                        isNormalizedRetrievalScore(
                          result.score ?? 0,
                          scoreScale
                        )
                          ? "Normalized retrieval score"
                          : "Raw keyword rank score"
                      }
                    >
                      {formatRetrievalScore(result.score ?? 0, scoreScale)}
                    </span>
                  </div>
                  <p className={cn("mt-1", k.muted)}>
                    {getShadowResultPreview(result) || "No preview available."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/40 bg-muted/20 px-2.5 py-2 text-sm text-muted-foreground">
          No chunks were retrieved for this snapshot.
        </div>
      )}
    </div>
  );
}

export interface ShadowRetrievalPanelProps {
  comparison: ShadowRetrievalComparison | null;
  query: string;
  isLoading: boolean;
  errorMessage?: string | null;
  onRun: () => void;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  baselineLabel?: string;
  shadowLabel?: string;
  className?: string;
}

export default function ShadowRetrievalPanel({
  comparison,
  query,
  isLoading,
  errorMessage,
  onRun,
  title = "Shadow retrieval",
  description = "Compare the current published retrieval against a shadow run that includes pending-review content.",
  emptyTitle = "No shadow comparison yet",
  emptyDescription = "Run a compare to see whether pending-review content changes retrieval or answer quality.",
  baselineLabel = "Current retrieval",
  shadowLabel = "Shadow retrieval",
  className,
}: ShadowRetrievalPanelProps) {
  const showSelectedDocumentStatus = comparison?.selectedDocumentId != null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/30 bg-muted/20 px-3 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
          <p className={cn("mt-1", k.muted)}>{description}</p>
          {query ? (
            <p className={cn("mt-1", k.muted)}>Probe query: {query}</p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onRun}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          {isLoading ? "Running" : comparison ? "Re-run" : "Run"}
        </Button>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {comparison ? (
        <>
          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm text-foreground/85">
            {comparison.summary}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <ShadowSnapshotCard
              label={baselineLabel}
              snapshot={comparison.baseline}
              showSelectedDocumentStatus={showSelectedDocumentStatus}
            />
            <ShadowSnapshotCard
              label={shadowLabel}
              snapshot={comparison.shadow}
              showSelectedDocumentStatus={showSelectedDocumentStatus}
            />
          </div>
        </>
      ) : isLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-border/30 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Building the published and pending-inclusive retrieval snapshots.
        </div>
      ) : (
        <HermeticEmptyState
          icon={<Eye className="h-7 w-7 text-primary/50" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </div>
  );
}
