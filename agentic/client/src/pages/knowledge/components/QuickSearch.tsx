/**
 * QuickSearch — Semantic knowledge base search
 *
 * Pure retrieval search — no LLM answer generation.
 * Uses hybrid search (vector + keyword) to find relevant chunks
 * and displays them with relevance scores and source metadata.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  BookOpen,
  FileText,
  ArrowRight,
  Command,
  X,
  Database,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../theme";
import {
  formatRetrievalScore,
  getRetrievalScoreTone,
  getRetrievalScorePercent,
  type KnowledgeTab,
} from "../types";

interface QuickSearchProps {
  onNavigate?: (
    tab: KnowledgeTab,
    section?: "test" | "gaps" | "quality"
  ) => void;
  compact?: boolean;
  valueStreamId?: string;
  streamLabel?: string;
}

export default function QuickSearch({
  onNavigate,
  compact,
  valueStreamId,
  streamLabel,
}: QuickSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotifications();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsExpanded(true);
      }
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const searchMut = trpc.knowledge.search.useMutation({
    onSuccess: d => {
      setResults(d);
    },
    onError: e =>
      notify({
        title: "Search failed",
        description: e.message,
        severity: "error",
        group: "search",
      }),
  });

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setResults(null);
    setIsExpanded(true);
    searchMut.mutate({
      query,
      mode: "hybrid" as any,
      valueStreamId,
      includePending: true,
    });
  }, [query, searchMut, valueStreamId]);

  const handleClear = () => {
    setQuery("");
    setResults(null);
    setIsExpanded(false);
  };

  const isSearching = searchMut.isPending;
  const chunks = results?.results ?? [];
  const hasResults = chunks.length > 0;
  const modeLabel =
    results?.mode === "keyword"
      ? "Keyword search"
      : results?.mode === "vector"
        ? "Vector search"
        : "Hybrid search (vector + keyword)";

  return (
    <div className="w-full">
      {/* Search bar */}
      <div className={cn(k.card, "p-1.5")}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              onFocus={() => setIsExpanded(true)}
              placeholder="Search your knowledge base..."
              className={cn(
                "w-full pl-10 pr-20 py-3 text-sm rounded-xl",
                "border-0 bg-muted/50 dark:bg-muted/30",
                "text-foreground",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/30",
                "transition-all"
              )}
            />
            {!query && !isExpanded && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded border border-border/30 bg-muted text-muted-foreground">
                  <Command className="w-2.5 h-2.5" />K
                </kbd>
              </div>
            )}
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className={cn(k.btnPrimary, "px-5 py-3 rounded-xl")}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
        {streamLabel && (
          <div className="px-1 pt-1">
            <span className="text-xs text-muted-foreground">
              Scoped to {streamLabel}
            </span>
          </div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {isExpanded && (isSearching || results) && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2"
          >
            {isSearching && (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className={cn("text-xs", k.muted)}>
                  Searching knowledge base...
                </span>
              </div>
            )}

            {!isSearching && hasResults && (
              <div className={cn(k.card, "overflow-hidden")}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <div>
                      <p className={cn("text-xs font-semibold", k.heading)}>
                        {chunks.length} result{chunks.length !== 1 ? "s" : ""}{" "}
                        found
                      </p>
                      <p className={cn("text-xs", k.muted)}>
                        {modeLabel} &middot;{" "}
                        {results?.searchTimeMs != null
                          ? `${results.searchTimeMs.toFixed(0)}ms`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate("validate", "test")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Advanced Search
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Chunk results */}
                <div className="divide-y divide-border/50">
                  {chunks.slice(0, compact ? 3 : 8).map((r: any, i: number) => {
                    const citation = r.citation || {};
                    const title =
                      r.title ||
                      citation.document_title ||
                      citation.documentTitle ||
                      "";
                    const docType =
                      r.metadata?.document_type ||
                      r.metadata?.documentType ||
                      "";
                    const dept = r.metadata?.department || "";
                    const highlight = citation.highlight || "";
                    const vectorScore = r.vector_score ?? r.vectorScore ?? 0;
                    const keywordScore = r.keyword_score ?? r.keywordScore ?? 0;

                    return (
                      <div
                        key={r.id || r.chunk_id || i}
                        className="px-5 py-3.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            <RelevanceBar
                              score={r.score ?? 0}
                              scoreScale={r.scoreScale ?? r.score_scale}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            {title && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <FileText className="w-3 h-3 text-muted-foreground/50" />
                                <span className="text-[11px] font-semibold text-foreground truncate">
                                  {title}
                                </span>
                              </div>
                            )}
                            {highlight ? (
                              <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 mb-1.5">
                                {highlight}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {r.content}
                            </p>
                            {/* Metadata tags */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {docType && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                  {docType}
                                </span>
                              )}
                              {dept && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  {dept}
                                </span>
                              )}
                              {vectorScore > 0 && keywordScore > 0 && (
                                <span className="text-xs text-muted-foreground/50">
                                  vector:{" "}
                                  {formatRetrievalScore(
                                    vectorScore,
                                    r.vectorScoreScale ?? r.vector_score_scale
                                  )}{" "}
                                  &middot; keyword:{" "}
                                  {formatRetrievalScore(
                                    keywordScore,
                                    r.keywordScoreScale ?? r.keyword_score_scale
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {chunks.length > (compact ? 3 : 8) && (
                  <div className="px-5 py-2 border-t border-border/30 bg-muted/20 text-center">
                    <button
                      onClick={() => onNavigate?.("validate", "test")}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all {chunks.length} results in Validate
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {!isSearching && results && chunks.length === 0 && (
              <div className={cn(k.card, "p-8 text-center")}>
                <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className={cn("text-sm font-medium", k.heading)}>
                  No results found
                </p>
                <p className={cn("text-xs mt-1", k.muted)}>
                  Try different keywords or{" "}
                  <button
                    onClick={() => onNavigate?.("ingest")}
                    className="text-primary hover:underline"
                  >
                    ingest more documents
                  </button>{" "}
                  into the knowledge base.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RelevanceBar({
  score,
  scoreScale,
}: {
  score: number;
  scoreScale?: "normalized" | "raw_rank";
}) {
  const pct = getRetrievalScorePercent(score, scoreScale);
  const label = formatRetrievalScore(score, scoreScale);
  const tone = getRetrievalScoreTone(score, scoreScale);
  const color =
    tone === "high"
      ? "bg-emerald-500"
      : tone === "medium"
        ? "bg-primary"
        : tone === "low"
          ? "bg-amber-500"
          : "bg-muted-foreground";
  return (
    <div
      className="flex flex-col items-center gap-0.5 w-10"
      title={
        pct == null ? "Raw keyword rank score" : "Normalized retrieval score"
      }
    >
      <span className="text-xs font-bold tabular-nums text-muted-foreground">
        {label}
      </span>
      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        {pct != null && (
          <div
            className={cn("h-full rounded-full transition-all", color)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
