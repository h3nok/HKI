import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Search,
  FlaskConical,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";
import {
  SEARCH_MODES,
  cardCls,
  formatRetrievalScore,
  getRetrievalScoreTone,
  isNormalizedRetrievalScore,
} from "../types";
import { k } from "../theme";
import RAGEvalCard from "./evaluation/RAGEvalCard";
import type {
  SearchResponse,
  SearchMode,
  GeneratedAnswer,
  RAGEvalResult,
} from "@shared/knowledge-types";

export default function TestTab() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<string>("hybrid");
  const [shapeContext, setShapeContext] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [generatedAnswer, setGeneratedAnswer] =
    useState<GeneratedAnswer | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [evalResult, setEvalResult] = useState<RAGEvalResult | null>(null);
  const { notify } = useNotifications();

  const searchMut = trpc.knowledge.search.useMutation({
    onSuccess: d => {
      setResults(d);
      setGeneratedAnswer(null);
      setFeedback(null);
      setEvalResult(null);
    },
    onError: e =>
      notify({
        title: "Search failed",
        description: e.message,
        severity: "error",
        group: "test",
      }),
  });

  const generateMut = trpc.knowledge.generateAnswer.useMutation({
    onSuccess: d => {
      setGeneratedAnswer(d);
      setFeedback(null);
      setEvalResult(null);
    },
    onError: e =>
      notify({
        title: "Generation failed",
        description: e.message,
        severity: "error",
        group: "test",
      }),
  });

  const evalMut = trpc.knowledge.evaluateRag.useMutation({
    onSuccess: d => setEvalResult(d),
    onError: e =>
      notify({
        title: "Evaluation failed",
        description: e.message,
        severity: "error",
        group: "test",
      }),
  });

  const feedbackMut = trpc.knowledge.chunkFeedback.useMutation({
    onError: e => console.warn("Feedback recording failed:", e.message),
  });

  const handleFeedback = (signal: "up" | "down") => {
    setFeedback(signal);
    if (signal === "up")
      notify({ title: "Thanks for the feedback!", severity: "success" });
    else notify({ title: "Thanks — we'll improve", severity: "info" });

    // Record chunk-level feedback for all contributing chunks
    if (generatedAnswer && results?.results?.length && query) {
      const chunkIds = results.results.map((_, i) => `chunk-${i}`);
      const docIds = results.results.map(r =>
        String(r.metadata?.document_id || "")
      );
      feedbackMut.mutate({
        signal,
        query,
        answer: generatedAnswer.answer,
        chunkIds: chunkIds,
        documentIds: docIds,
        confidence: generatedAnswer.confidence,
        evalScore: evalResult?.overallScore ?? 0,
      });
    }
  };

  const handleEvaluate = () => {
    if (!generatedAnswer?.answer || !results?.results?.length || !query) return;
    evalMut.mutate({
      query,
      answer: generatedAnswer.answer,
      chunks: results.results.map(r => ({
        content: r.content || "",
        score: r.score ?? 0,
        scoreScale: r.scoreScale ?? (r as any).score_scale,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
      })),
      confidence: generatedAnswer.confidence,
    });
  };

  const handleGenerateAnswer = () => {
    if (!results?.results?.length || !query) return;
    generateMut.mutate({
      query,
      chunks: results.results.map(r => ({
        content: r.content || "",
        score: r.score ?? 0,
        scoreScale: r.scoreScale ?? (r as any).score_scale,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
      })),
    });
  };

  const runSearch = () => {
    if (!query.trim()) return;
    searchMut.mutate({
      query,
      mode: searchMode as SearchMode,
      shapeContext,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── Query Panel ── */}
      <div className={cn("overflow-hidden", cardCls)}>
        <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Test Retrieval
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground/60">
            Test the retrieval pipeline end-to-end. Ask a question as if you
            were a user — see what chunks are retrieved and their relevance
            scores.
          </p>

          {/* Search mode selector */}
          <div className="flex gap-2">
            {SEARCH_MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSearchMode(m.value)}
                className={cn(
                  "flex-1 p-2.5 rounded-xl border text-center transition-all",
                  searchMode === m.value ? k.activeTab : k.inactiveTab
                )}
              >
                <span className="text-xs font-semibold text-foreground">
                  {m.label}
                </span>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {m.desc}
                </p>
              </button>
            ))}
          </div>

          {/* Context shaping toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shapeContext}
              onChange={e => setShapeContext(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/40 accent-primary"
            />
            <span className="text-xs text-muted-foreground/80">
              Shape context
              <span className="text-xs text-muted-foreground/50 ml-1">
                (deduplicate &amp; re-rank chunks for LLM consumption)
              </span>
            </span>
          </label>

          {/* Query input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") runSearch();
                }}
                placeholder="Ask a question to test retrieval..."
                className={cn(k.input, "pl-9 py-2.5")}
              />
            </div>
            <button
              onClick={runSearch}
              disabled={!query.trim() || searchMut.isPending}
              className={cn(k.btnPrimary, "px-5 py-2.5")}
            >
              {searchMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Search
            </button>
          </div>
        </div>
      </div>

      {/* ── Generated Answer ── */}
      {results && (results.results ?? []).length > 0 && (
        <div className={cn("overflow-hidden", cardCls)}>
          <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Generated Answer
            </h3>
            {!generatedAnswer && (
              <button
                onClick={handleGenerateAnswer}
                disabled={generateMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {generateMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {generateMut.isPending
                  ? "Generating..."
                  : "Generate with Gemini"}
              </button>
            )}
          </div>

          {generateMut.isPending && (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span className="text-xs text-muted-foreground/60">
                Generating grounded answer...
              </span>
            </div>
          )}

          {generatedAnswer && (
            <div className="p-5 space-y-4">
              {/* Confidence indicator */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10">
                  <svg width={40} height={40} className="-rotate-90">
                    <circle
                      cx={20}
                      cy={20}
                      r={17}
                      fill="none"
                      strokeWidth={3}
                      className="stroke-border"
                    />
                    <circle
                      cx={20}
                      cy={20}
                      r={17}
                      fill="none"
                      strokeWidth={3}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-500",
                        generatedAnswer.confidence >= 0.8
                          ? "stroke-green-500"
                          : generatedAnswer.confidence >= 0.5
                            ? "stroke-amber-500"
                            : "stroke-red-500"
                      )}
                      strokeDasharray={2 * Math.PI * 17}
                      strokeDashoffset={
                        2 * Math.PI * 17 * (1 - generatedAnswer.confidence)
                      }
                    />
                  </svg>
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center text-xs font-bold",
                      generatedAnswer.confidence >= 0.8
                        ? "text-primary"
                        : generatedAnswer.confidence >= 0.5
                          ? "text-amber-500"
                          : "text-red-500"
                    )}
                  >
                    {Math.round(generatedAnswer.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">
                    Confidence
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {generatedAnswer.confidence >= 0.8
                      ? "High — well supported by sources"
                      : generatedAnswer.confidence >= 0.5
                        ? "Moderate — partially supported"
                        : "Low — sources may not fully answer this"}
                  </p>
                </div>
              </div>

              {/* Answer text */}
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {generatedAnswer.answer || (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">
                      No answer could be generated. {generatedAnswer.error}
                    </span>
                  </div>
                )}
              </div>

              {/* Citations */}
              {generatedAnswer.citations.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedAnswer.citations.map(c => (
                      <span
                        key={c.index}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-muted/60 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground"
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

              {/* Feedback */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/30 dark:border-border/30">
                <span className="text-xs text-muted-foreground/60">
                  Was this answer helpful?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFeedback("up")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      feedback === "up"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/60 kb-duotone-text-hover kb-duotone-bg-hover"
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
                        : "text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10"
                    )}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={handleEvaluate}
                    disabled={evalMut.isPending || !!evalResult}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
                  >
                    {evalMut.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ClipboardCheck className="w-3 h-3" />
                    )}
                    {evalMut.isPending
                      ? "Evaluating..."
                      : evalResult
                        ? "Evaluated"
                        : "Evaluate Quality"}
                  </button>
                </div>
              </div>

              {/* RAG Evaluation */}
              {evalMut.isPending && (
                <div className="flex items-center justify-center py-6 gap-2 border-t border-border/30 dark:border-border/30">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span className="text-xs text-muted-foreground/60">
                    Running RAGAS evaluation...
                  </span>
                </div>
              )}
              {evalResult && (
                <div className="pt-3 border-t border-border/30 dark:border-border/30">
                  <RAGEvalCard result={evalResult} />
                </div>
              )}
            </div>
          )}

          {!generatedAnswer && !generateMut.isPending && (
            <div className="text-center py-8 space-y-1">
              <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto" />
              <p className="text-[11px] text-muted-foreground/60">
                Click &ldquo;Generate with Gemini&rdquo; to see how the agent
                would answer this query
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {results.results?.length ?? 0} chunks retrieved
              {results.query && (
                <span className="text-muted-foreground/60 font-normal">
                  {" "}
                  for &ldquo;{results.query}&rdquo;
                </span>
              )}
            </p>
            {results.searchTimeMs != null && (
              <span
                className="text-xs text-muted-foreground/60 px-2 py-0.5 rounded-full bg-muted/60 dark:bg-muted/60"
                style={{ fontFamily: FONT_FAMILY.mono }}
              >
                {results.searchTimeMs.toFixed(0)}ms
              </span>
            )}
          </div>

          {(results.results ?? []).length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border/25 dark:border-border/25 rounded-2xl">
              <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No matching results found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a different query or check the Sources tab.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(results.results ?? []).map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    k.card,
                    "kb-duotone-border-hover transition-colors overflow-hidden"
                  )}
                >
                  <div className="px-4 py-3 flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg kb-duotone-fill text-xs font-bold tabular-nums shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {String(r.metadata?.title || "Untitled")}
                        </p>
                        {!!(
                          r.metadata?.department || r.metadata?.documentType
                        ) && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {!!r.metadata.department && (
                              <span className="px-1.5 py-0.5 text-xs rounded-md bg-muted/60 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground">
                                {String(r.metadata.department)}
                              </span>
                            )}
                            {!!r.metadata.documentType && (
                              <span className="px-1.5 py-0.5 text-xs rounded-md bg-muted/60 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground">
                                {String(r.metadata.documentType)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.score != null && (
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-bold rounded-lg tabular-nums",
                            getRetrievalScoreTone(
                              r.score,
                              r.scoreScale ?? (r as any).score_scale
                            ) === "high"
                              ? "text-primary bg-primary/10"
                              : getRetrievalScoreTone(
                                    r.score,
                                    r.scoreScale ?? (r as any).score_scale
                                  ) === "medium"
                                ? "text-amber-600 bg-amber-500/10"
                                : "text-muted-foreground bg-muted/60"
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
                      {!!r.metadata?.searchMode && (
                        <span className="px-1.5 py-0.5 text-xs rounded-md bg-muted/60 dark:bg-muted/60 text-muted-foreground/60 uppercase tracking-wider">
                          {String(r.metadata.searchMode)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                      {r.content || "\u2014"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
