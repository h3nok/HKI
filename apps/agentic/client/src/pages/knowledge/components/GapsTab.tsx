import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  FileWarning,
  ArrowRight,
  RefreshCw,
  Trash2,
  SearchX,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { cardCls } from "../types";
import { k, ACCENT } from "../theme";
import type { DocumentSummary } from "@shared/knowledge-types";

interface GapsTabProps {
  docsQ: any;
  statsQ: any;
  streamName?: string;
  streamDescription?: string;
  valueStreamId?: string;
}

export default function GapsTab({
  docsQ,
  statsQ,
  streamName,
  streamDescription,
  valueStreamId,
}: GapsTabProps) {
  const utils = trpc.useUtils();
  const docCount = statsQ.data?.totalDocuments ?? docsQ.data?.total ?? 0;
  const chunkCount = statsQ.data?.totalChunks ?? 0;

  const docs: DocumentSummary[] = docsQ.data?.documents ?? [];
  const staleDocs = docs.filter((doc: DocumentSummary) => {
    const freshnessAt = doc.updatedAt || doc.createdAt;
    if (!freshnessAt) return false;
    const days = Math.floor(
      (Date.now() - new Date(freshnessAt).getTime()) / 86400000
    );
    return days > 90;
  });

  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisDocCount, setAnalysisDocCount] = useState(0);
  const coverageScore =
    typeof analysis?.coverageScore === "number" ? analysis.coverageScore : null;

  const { notify } = useNotifications();
  const latestSnapshotQ = trpc.gemini.listGapSnapshots.useQuery(
    { valueStreamId: valueStreamId ?? "global", limit: 1 },
    {
      enabled: !!valueStreamId,
      retry: false,
      staleTime: 60_000,
    }
  );
  const latestSnapshotId = latestSnapshotQ.data?.snapshots?.[0]?.id;
  const latestSnapshotDetailQ = trpc.gemini.getGapSnapshot.useQuery(
    { snapshotId: latestSnapshotId! },
    {
      enabled: !!latestSnapshotId && !analysis,
      retry: false,
      staleTime: 300_000,
    }
  );

  useEffect(() => {
    if (!analysis && latestSnapshotDetailQ.data) {
      setAnalysis({
        coverageScore: latestSnapshotDetailQ.data.coverageScore,
        coverageLabel: latestSnapshotDetailQ.data.coverageLabel,
        summary: latestSnapshotDetailQ.data.summary,
        strengths: latestSnapshotDetailQ.data.strengths,
        gaps: latestSnapshotDetailQ.data.gaps,
        staleContent: latestSnapshotDetailQ.data.staleContent,
        recommendations: latestSnapshotDetailQ.data.recommendations,
      });
      setAnalysisDocCount(latestSnapshotDetailQ.data.documentCount ?? 0);
    }
  }, [analysis, latestSnapshotDetailQ.data]);

  const refreshMut = trpc.knowledge.refreshDocument.useMutation({
    onSuccess: () => {
      notify({
        title: "Document refreshed",
        severity: "success",
        group: "gaps",
      });
      docsQ.refetch();
    },
    onError: e =>
      notify({
        title: "Refresh failed",
        description: e.message,
        severity: "error",
        group: "gaps",
      }),
  });
  const deleteMut = trpc.knowledge.deleteDocument.useMutation({
    onSuccess: () => {
      notify({ title: "Document deleted", severity: "success", group: "gaps" });
      docsQ.refetch();
    },
    onError: e =>
      notify({
        title: "Delete failed",
        description: e.message,
        severity: "error",
        group: "gaps",
      }),
  });

  const agentGapsQ = trpc.knowledge.getAgentGaps.useQuery(
    { valueStreamId: valueStreamId || undefined, limit: 20 },
    { enabled: !!valueStreamId, refetchInterval: 60_000 }
  );

  const analyzeGapsMut = trpc.gemini.analyzeGaps.useMutation({
    onSuccess: async d => {
      setAnalysis((d as any).analysis);
      setAnalysisDocCount(docCount);
      notify({
        title: "Gap analysis complete",
        severity: "success",
        group: "gaps",
      });
      if (valueStreamId) {
        await Promise.all([
          utils.gemini.listGapSnapshots.invalidate({ valueStreamId }),
          utils.gemini.getGapSnapshot.invalidate(),
        ]);
      }
    },
    onError: e =>
      notify({
        title: "Gemini failed",
        description: e.message,
        severity: "error",
        group: "gaps",
      }),
  });

  const buildMutateArgs = () => ({
    streamName: streamName || "All Domains",
    streamDescription,
    valueStreamId,
    documents: docs.slice(0, 50).map((d: DocumentSummary) => ({
      title: d.title || "Untitled",
      department: d.department,
      documentType: d.documentType,
      chunkCount: d.chunkCount,
      createdAt: d.updatedAt || d.createdAt,
    })),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* ── Coverage Score ── */}
      <div className={cn("p-6", cardCls)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Coverage Analysis
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              How well your domain library covers the agent's needs
            </p>
            {valueStreamId &&
            latestSnapshotQ.data?.snapshots?.[0]?.createdAt ? (
              <p className="text-xs text-muted-foreground/50 mt-1">
                Latest saved snapshot{" "}
                {new Date(
                  latestSnapshotQ.data.snapshots[0].createdAt
                ).toLocaleString()}
              </p>
            ) : valueStreamId ? (
              <p className="text-xs text-muted-foreground/50 mt-1">
                No saved snapshot yet. Run Gemini analysis to generate an
                evidence-based coverage score.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-primary dark:text-primary hover:underline disabled:opacity-50"
            disabled={analyzeGapsMut.isPending}
            onClick={() => analyzeGapsMut.mutate(buildMutateArgs())}
          >
            {analyzeGapsMut.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {analyzeGapsMut.isPending
              ? "Analyzing..."
              : analysis && analysisDocCount === docCount
                ? "Re-analyze"
                : valueStreamId
                  ? "Analyze and save snapshot"
                  : "Analyze with Gemini"}
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Score ring */}
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
                className="dark:stroke-border"
              />
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={
                  coverageScore === null
                    ? "transparent"
                    : coverageScore >= 70
                      ? ACCENT
                      : coverageScore >= 40
                        ? "color-mix(in srgb, var(--primary) 62%, var(--muted-foreground) 38%)"
                        : "#ef4444"
                }
                strokeWidth="3"
                strokeDasharray={
                  coverageScore === null ? "0, 100" : `${coverageScore}, 100`
                }
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {coverageScore === null ? "--" : `${coverageScore}%`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 flex-1">
            {[
              { label: "Documents", value: docCount },
              { label: "Chunks", value: chunkCount },
              { label: "Stale Docs", value: staleDocs.length },
            ].map(s => (
              <div
                key={s.label}
                className="p-3 rounded-xl bg-muted/60 dark:bg-muted/60"
              >
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stale Content ── */}
      {staleDocs.length > 0 && (
        <div className={cn("overflow-hidden", cardCls)}>
          <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-primary" /> Stale Content
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                {staleDocs.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {staleDocs.slice(0, 10).map((doc: any) => {
              const freshnessAt = doc.updatedAt || doc.createdAt;
              const days = Math.floor(
                (Date.now() - new Date(freshnessAt).getTime()) / 86400000
              );
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/60/50 dark:hover:bg-card/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {days} days old &middot; {doc.chunkCount ?? 0} chunks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full text-red-500 bg-red-500/10 uppercase tracking-wider">
                      Stale
                    </span>
                    <button
                      type="button"
                      title="Re-ingest from source"
                      onClick={() => refreshMut.mutate({ documentId: doc.id })}
                      disabled={refreshMut.isPending}
                      className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground/60 kb-duotone-text-hover transition-colors"
                    >
                      <RefreshCw
                        className={cn(
                          "w-3.5 h-3.5",
                          refreshMut.isPending && "animate-spin"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      title="Delete document"
                      onClick={() => {
                        if (
                          window.confirm(`Delete "${doc.title || "Untitled"}"?`)
                        )
                          deleteMut.mutate({ documentId: doc.id });
                      }}
                      disabled={deleteMut.isPending}
                      className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground/60 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Agent-Detected Gaps ── */}
      {(agentGapsQ.data?.total ?? 0) > 0 && (
        <div className={cn("overflow-hidden", cardCls)}>
          <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <SearchX className="w-4 h-4 text-red-500" /> Agent-Detected Gaps
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-500">
                {agentGapsQ.data!.total}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Queries the agent could not answer — add content to fill these
              gaps
            </p>
          </div>
          <div className="divide-y divide-border">
            {agentGapsQ.data!.gaps.map((g, i) => (
              <div key={i} className="px-5 py-3">
                <p className="text-xs font-medium text-foreground truncate">
                  &ldquo;{g.query}&rdquo;
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {g.gapDescription}
                </p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                  {new Date(g.detectedAt).toLocaleString()} &middot; {g.scope}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gemini Analysis Results ── */}
      {analysis ? (
        <div className="space-y-4">
          {analysis.summary && (
            <div className={cn("p-5", cardCls)}>
              <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Gemini
                Assessment
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {analysis.summary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.strengths?.length > 0 && (
              <div className={cn("p-5", cardCls)}>
                <h4 className="text-xs font-bold text-primary dark:text-primary mb-3 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Strengths
                </h4>
                <ul className="space-y-1.5">
                  {analysis.strengths.map((s: string, i: number) => (
                    <li
                      key={i}
                      className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                    >
                      <span className="text-primary mt-0.5">&bull;</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.gaps?.length > 0 && (
              <div className={cn("p-5", cardCls)}>
                <h4 className="text-xs font-bold text-primary mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Gaps Found
                </h4>
                <ul className="space-y-2">
                  {analysis.gaps.map((g: any, i: number) => (
                    <li key={i} className="text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider",
                            g.severity === "high"
                              ? "bg-red-500/10 text-red-500"
                              : g.severity === "medium"
                                ? "bg-primary/10 text-primary"
                                : "bg-blue-500/10 text-blue-500"
                          )}
                        >
                          {g.severity}
                        </span>
                        <span className="font-medium text-foreground">
                          {g.topic}
                        </span>
                      </div>
                      {g.suggestion && (
                        <p className="mt-0.5 ml-13 text-muted-foreground/60">
                          {g.suggestion}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendations?.length > 0 && (
            <div className={cn("p-5", cardCls)}>
              <h4 className="text-xs font-bold text-primary dark:text-primary mb-3 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> Next Steps
              </h4>
              <ol className="space-y-1.5">
                {analysis.recommendations.map((r: string, i: number) => (
                  <li
                    key={i}
                    className="text-[11px] text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary dark:text-primary font-bold shrink-0">
                      {i + 1}.
                    </span>{" "}
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-primary/30 rounded-2xl bg-primary/5 dark:bg-primary/8 p-8 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-primary/40 mx-auto" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Gemini-Powered Gap Detection
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-md mx-auto">
              Analyze your indexed content to find knowledge gaps. Gemini will
              identify missing topics, highlight stale content, and recommend
              next actions.
            </p>
          </div>
          <button
            onClick={() => analyzeGapsMut.mutate(buildMutateArgs())}
            disabled={analyzeGapsMut.isPending}
            className={k.btnPrimary}
          >
            {analyzeGapsMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {analyzeGapsMut.isPending ? "Analyzing..." : "Run Gap Analysis"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
