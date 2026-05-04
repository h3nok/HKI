import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  MessageCircleQuestion,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k, ACCENT } from "../theme";
import {
  formatRetrievalScore,
  getRetrievalScoreTone,
  isNormalizedRetrievalScore,
} from "../types";
import type {
  SearchResponse,
  SearchMode,
  GeneratedAnswer,
  DocumentSummary,
} from "@shared/knowledge-types";

interface AskTabProps {
  streamName?: string;
  streamDescription?: string;
  valueStreamId?: string;
  docsQ: any;
  statsQ: any;
}

export default function AskTab({
  streamName,
  streamDescription,
  valueStreamId,
  docsQ,
  statsQ,
}: AskTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<any>(null);
  const [showGaps, setShowGaps] = useState(false);
  const { notify } = useNotifications();

  // ── Search + Generate in one shot ──
  const searchMut = trpc.knowledge.search.useMutation({
    onSuccess: d => {
      setResults(d);
      setAnswer(null);
      setFeedback(null);
      // Auto-generate answer if we got results
      if ((d.results ?? []).length > 0) {
        generateMut.mutate({
          valueStreamId,
          query,
          chunks: (d.results ?? []).map(r => ({
            content: r.content || "",
            score: r.score ?? 0,
            scoreScale: r.scoreScale ?? (r as any).score_scale,
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
          })),
        });
      }
    },
    onError: e =>
      notify({
        title: "Search failed",
        description: e.message,
        severity: "error",
        group: "ask",
      }),
  });

  const generateMut = trpc.knowledge.generateAnswer.useMutation({
    onSuccess: d => setAnswer(d),
    onError: e =>
      notify({
        title: "Generation failed",
        description: e.message,
        severity: "error",
        group: "ask",
      }),
  });

  const feedbackMut = trpc.knowledge.chunkFeedback.useMutation({
    onError: e => console.warn("Feedback failed:", e.message),
  });

  const analyzeGapsMut = trpc.gemini.analyzeGaps.useMutation({
    onSuccess: d => {
      setGapAnalysis((d as any).analysis);
      setShowGaps(true);
      notify({
        title: "Gap analysis complete",
        severity: "success",
        group: "ask",
      });
    },
    onError: e =>
      notify({
        title: "Gemini failed",
        description: e.message,
        severity: "error",
        group: "ask",
      }),
  });

  const handleAsk = () => {
    if (!query.trim()) return;
    setResults(null);
    setAnswer(null);
    setFeedback(null);
    searchMut.mutate({
      query,
      mode: "hybrid" as SearchMode,
      valueStreamId,
    });
  };

  const handleFeedback = (signal: "up" | "down") => {
    setFeedback(signal);
    notify({
      title: signal === "up" ? "Thanks!" : "Thanks — we'll improve",
      severity: signal === "up" ? "success" : "info",
    });
    if (answer && results?.results?.length && query) {
      feedbackMut.mutate({
        valueStreamId,
        signal,
        query,
        answer: answer.answer,
        chunkIds: results.results.map((_, i) => `chunk-${i}`),
        documentIds: results.results.map(r =>
          String(r.metadata?.document_id || "")
        ),
        confidence: answer.confidence,
        evalScore: 0,
      });
    }
  };

  const handleRunGapAnalysis = () => {
    const docs: DocumentSummary[] = docsQ.data?.documents ?? [];
    analyzeGapsMut.mutate({
      streamName: streamName || "All Streams",
      streamDescription,
      valueStreamId,
      documents: docs.slice(0, 50).map((d: DocumentSummary) => ({
        title: d.title || "Untitled",
        department: d.department,
        documentType: d.documentType,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt,
      })),
    });
  };

  const isSearching = searchMut.isPending;
  const isGenerating = generateMut.isPending;
  const isThinking = isSearching || isGenerating;

  const docCount = statsQ.data?.totalDocuments ?? 0;
  const chunkCount = statsQ.data?.totalChunks ?? 0;

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-200px)]">
      {/* Standard chatbot width container */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl mx-auto space-y-5"
      >
        {/* ── Search bar — the main event ── */}
        <div className={cn(k.card, "p-5")}>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <MessageCircleQuestion className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAsk()}
                placeholder="Ask a question to test your knowledge base..."
                className={cn(k.input, "pl-10 py-3 text-sm")}
                autoFocus
              />
            </div>
            <button
              onClick={handleAsk}
              disabled={!query.trim() || isThinking}
              className={cn(k.btnPrimary, "px-5 py-3")}
            >
              {isThinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Ask
            </button>
          </div>
          <p className={cn("text-xs mt-2", k.muted)}>
            Searches your knowledge base, retrieves relevant chunks, and
            generates a grounded answer with Gemini.
          </p>
        </div>

        {/* ── Thinking state ── */}
        {isThinking && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="relative">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
            <span className={cn("text-xs", k.muted)}>
              {isSearching
                ? "Searching knowledge base..."
                : "Generating answer with Gemini..."}
            </span>
          </div>
        )}

        {/* ── Answer card ── */}
        <AnimatePresence>
          {answer && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(k.card, "overflow-hidden")}
            >
              {/* Confidence header */}
              <div
                className={cn(
                  k.cardHeader,
                  "flex items-center justify-between"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9">
                    <svg width={36} height={36} className="-rotate-90">
                      <circle
                        cx={18}
                        cy={18}
                        r={15}
                        fill="none"
                        strokeWidth={2.5}
                        className="stroke-black/5 dark:stroke-white/6"
                      />
                      <circle
                        cx={18}
                        cy={18}
                        r={15}
                        fill="none"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        stroke={
                          answer.confidence >= 0.8
                            ? ACCENT
                            : answer.confidence >= 0.5
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                        strokeDasharray={2 * Math.PI * 15}
                        strokeDashoffset={
                          2 * Math.PI * 15 * (1 - answer.confidence)
                        }
                      />
                    </svg>
                    <span
                      className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums",
                        answer.confidence >= 0.8
                          ? "text-primary"
                          : answer.confidence >= 0.5
                            ? "text-amber-500"
                            : "text-red-500"
                      )}
                    >
                      {Math.round(answer.confidence * 100)}%
                    </span>
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold", k.heading)}>
                      AI Answer
                    </p>
                    <p className={cn("text-xs", k.muted)}>
                      {answer.confidence >= 0.8
                        ? "High confidence — well supported"
                        : answer.confidence >= 0.5
                          ? "Moderate — partially supported"
                          : "Low — may need more content"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFeedback("up")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      feedback === "up"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/40 kb-duotone-text-hover"
                    )}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFeedback("down")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      feedback === "down"
                        ? "bg-red-500/15 text-red-500"
                        : "text-muted-foreground/40 hover:text-red-500"
                    )}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Answer body */}
              <div className="p-5">
                {answer.answer ? (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {answer.answer}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">
                      No answer could be generated. {answer.error}
                    </span>
                  </div>
                )}

                {/* Citations */}
                {answer.citations?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-black/4 dark:border-white/4">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider mb-2",
                        k.muted
                      )}
                    >
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {answer.citations.map(c => (
                        <span
                          key={c.index}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-muted/50 text-muted-foreground"
                        >
                          <BookOpen className="w-2.5 h-2.5" />[{c.index}]{" "}
                          {c.title}
                          {c.score > 0 && (
                            <span
                              className="text-primary font-bold ml-0.5"
                              title={
                                isNormalizedRetrievalScore(
                                  c.score,
                                  c.scoreScale ?? (c as any).score_scale
                                )
                                  ? "Normalized retrieval score"
                                  : "Raw keyword rank score"
                              }
                            >
                              {formatRetrievalScore(
                                c.score,
                                c.scoreScale ?? (c as any).score_scale
                              )}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Retrieved chunks (collapsed by default) ── */}
        {results && !isThinking && (results.results ?? []).length > 0 && (
          <details className="group">
            <summary
              className={cn(
                "text-[11px] font-medium cursor-pointer select-none",
                k.muted,
                "hover:text-foreground dark:hover:text-white"
              )}
            >
              {results.results!.length} chunks retrieved
              {results.searchTimeMs != null && (
                <span className="ml-1 tabular-nums">
                  ({results.searchTimeMs.toFixed(0)}ms)
                </span>
              )}
            </summary>
            <div className="mt-2 space-y-1.5">
              {(results.results ?? []).map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-black/2 dark:bg-card/90"
                >
                  <span className="w-5 h-5 rounded-md kb-duotone-fill text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground">
                      {String(r.metadata?.title || "Untitled")}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
                      {r.content}
                    </p>
                  </div>
                  {r.score != null && (
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums shrink-0",
                        getRetrievalScoreTone(
                          r.score,
                          r.scoreScale ?? (r as any).score_scale
                        ) === "high"
                          ? "text-primary"
                          : getRetrievalScoreTone(
                                r.score,
                                r.scoreScale ?? (r as any).score_scale
                              ) === "medium"
                            ? "text-amber-500"
                            : "text-muted-foreground/60"
                      )}
                      title={
                        isNormalizedRetrievalScore(
                          r.score,
                          r.scoreScale ?? (r as any).score_scale
                        )
                          ? "Normalized retrieval score"
                          : "Raw keyword rank score"
                      }
                    >
                      {formatRetrievalScore(
                        r.score,
                        r.scoreScale ?? (r as any).score_scale
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── No results ── */}
        {results && !isThinking && (results.results ?? []).length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Search className="w-8 h-8 text-muted-foreground/55 dark:text-muted-foreground/45 mx-auto" />
            <p className={cn("text-sm font-medium", k.heading)}>
              No results found
            </p>
            <p className={cn("text-xs", k.muted)}>
              Your knowledge base may not have content related to this query
              yet.
            </p>
          </div>
        )}

        {/* ── Divider ── */}
        <div className="h-px bg-black/4 dark:bg-muted/40" />

        {/* ── Gap Analysis section ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={cn("text-sm font-semibold", k.heading)}>
                Gap Analysis
              </h3>
              <p className={cn("text-[11px] mt-0.5", k.muted)}>
                {docCount} docs · {chunkCount} chunks — let Gemini find what's
                missing
              </p>
            </div>
            <button
              onClick={handleRunGapAnalysis}
              disabled={analyzeGapsMut.isPending}
              className={k.btnSecondary}
            >
              {analyzeGapsMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {analyzeGapsMut.isPending
                ? "Analyzing..."
                : gapAnalysis
                  ? "Re-analyze"
                  : "Analyze Gaps"}
            </button>
          </div>

          <AnimatePresence>
            {gapAnalysis && showGaps && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                {/* Coverage score */}
                {gapAnalysis.coverageScore != null && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/2 dark:bg-card/90">
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          strokeWidth="3"
                          className="stroke-black/5 dark:stroke-white/6"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          strokeWidth="3"
                          strokeLinecap="round"
                          stroke={
                            gapAnalysis.coverageScore >= 70
                              ? ACCENT
                              : gapAnalysis.coverageScore >= 40
                                ? "#f59e0b"
                                : "#ef4444"
                          }
                          strokeDasharray={`${2 * Math.PI * 16}`}
                          strokeDashoffset={`${2 * Math.PI * 16 * (1 - gapAnalysis.coverageScore / 100)}`}
                        />
                      </svg>
                      <span
                        className={cn(
                          "absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums",
                          k.heading
                        )}
                      >
                        {gapAnalysis.coverageScore}%
                      </span>
                    </div>
                    <div>
                      <p className={cn("text-xs font-semibold", k.heading)}>
                        Coverage Score
                      </p>
                      <p className={cn("text-xs", k.muted)}>
                        {gapAnalysis.summary ||
                          "Based on your current documents"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Strengths + Gaps side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gapAnalysis.strengths?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-primary dark:text-primary uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Strengths
                      </p>
                      {gapAnalysis.strengths.map((s: string, i: number) => (
                        <p
                          key={i}
                          className={cn("text-[11px] leading-relaxed", k.muted)}
                        >
                          • {s}
                        </p>
                      ))}
                    </div>
                  )}
                  {gapAnalysis.gaps?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Gaps
                      </p>
                      {gapAnalysis.gaps.map((g: any, i: number) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span
                            className={cn(
                              "px-1 py-0.5 text-[8px] font-bold rounded uppercase shrink-0 mt-0.5",
                              g.severity === "high"
                                ? "bg-red-500/10 text-red-500"
                                : g.severity === "medium"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-blue-500/10 text-blue-500"
                            )}
                          >
                            {g.severity}
                          </span>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed",
                              k.muted
                            )}
                          >
                            {g.topic}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {gapAnalysis.recommendations?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-primary dark:text-primary uppercase tracking-wider flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> Next Steps
                    </p>
                    {gapAnalysis.recommendations.map((r: string, i: number) => (
                      <p
                        key={i}
                        className={cn("text-[11px] leading-relaxed", k.muted)}
                      >
                        <span className="text-primary dark:text-primary font-bold">
                          {i + 1}.
                        </span>{" "}
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state for gap analysis */}
          {!gapAnalysis && !analyzeGapsMut.isPending && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-primary/20 bg-primary/2 dark:bg-primary/4">
              <Sparkles className="w-5 h-5 text-primary/40 shrink-0" />
              <p className={cn("text-[11px]", k.muted)}>
                Click "Analyze Gaps" to have Gemini review your knowledge base
                and identify missing topics, stale content, and recommendations.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
