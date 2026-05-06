/**
 * GapCoverageDiff — server-side semantic diff for gap analysis
 *
 * Industry-standard approach (Google, AWS, Azure):
 * - Server-side diff via `compareSnapshots` tRPC mutation
 * - Gemini-powered semantic matching (same gap phrased differently = matched)
 * - Structured diff: resolved, new, persisted, strength changes
 * - Trend micro-bar strip + compact run history
 *
 * Data flow:
 * 1. listGapSnapshots → lightweight rows for trend + history
 * 2. "Show diff" → compareSnapshots mutation → Gemini semantic match
 * 3. Structured diff response renders resolved/new/persisted categories
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../theme";
import { cardCls } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GapCoverageDiffProps {
  valueStreamId: string;
  /** Current analysis result (the one being displayed right now) */
  currentAnalysis: {
    coverageScore: number;
    gaps: { topic: string; severity: string }[];
    strengths: string[];
  };
}

interface SnapshotRow {
  id: string;
  coverageScore: number;
  coverageLabel: string;
  documentCount: number;
  chunkCount: number;
  summary: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreColor(score: number) {
  if (score >= 75) return "text-primary dark:text-primary";
  if (score >= 50) return "text-primary";
  return "text-red-600 dark:text-red-400";
}

function deltaBadgeClasses(delta: number) {
  if (delta > 0)
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (delta < 0)
    return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  return "bg-muted text-muted-foreground border-border/30";
}

// ── Trend Bars ───────────────────────────────────────────────────────────────

function TrendBarStrip({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  return (
    <div className="flex h-10 items-end gap-1.5 rounded-[14px] border border-border/45 bg-background/72 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] dark:bg-card/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {scores.map((score, i) => {
        const heightPct = Math.max(
          24,
          Math.round(((score - min) / range) * 100)
        );
        const isCurrent = i === scores.length - 1;
        const barTone =
          score >= 75
            ? "bg-primary/90"
            : score >= 50
              ? "bg-primary/85"
              : "bg-red-500/80";

        return (
          <div
            key={`${score}-${i}`}
            className="relative flex h-full w-2.5 items-end overflow-hidden rounded-full bg-muted/22"
            aria-hidden
          >
            <motion.div
              className={cn(
                "absolute inset-x-0 bottom-0 rounded-full",
                barTone,
                isCurrent &&
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.8),0_10px_16px_-12px_rgba(0,93,170,0.46)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_18px_-14px_rgba(0,93,170,0.58)]"
              )}
              initial={{ height: 0, opacity: 0.72 }}
              animate={{ height: `${heightPct}%`, opacity: 1 }}
              transition={{
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.04,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GapCoverageDiff({
  valueStreamId,
  currentAnalysis,
}: GapCoverageDiffProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  // Fetch snapshot history
  const snapshotsQ = trpc.gemini.listGapSnapshots.useQuery(
    { valueStreamId, limit: 10 },
    { enabled: !!valueStreamId, staleTime: 30_000 }
  );

  // Server-side semantic diff (Gemini-powered)
  const compareMut = trpc.gemini.compareSnapshots.useMutation();

  const snapshots: SnapshotRow[] = useMemo(
    () => snapshotsQ.data?.snapshots ?? [],
    [snapshotsQ.data]
  );

  // The previous run is the 2nd snapshot (first is the one just saved)
  const previousRun = snapshots.length >= 2 ? snapshots[1] : null;
  const currentRun = snapshots.length >= 1 ? snapshots[0] : null;
  const delta = previousRun
    ? currentAnalysis.coverageScore - previousRun.coverageScore
    : null;

  // Scores for trend bars (oldest → newest)
  const trendScores = useMemo(
    () => [...snapshots].reverse().map(s => s.coverageScore),
    [snapshots]
  );

  const handleShowDiff = () => {
    if (!currentRun || !previousRun) return;
    setDiffOpen(true);
    compareMut.mutate({
      currentSnapshotId: currentRun.id,
      previousSnapshotId: previousRun.id,
      valueStreamId,
    });
  };

  const handleHideDiff = () => {
    setDiffOpen(false);
    compareMut.reset();
  };

  const diff = compareMut.data?.diff;

  if (!valueStreamId || snapshotsQ.isLoading) return null;
  if (snapshots.length === 0) return null; // truly no history yet

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      {/* ── Delta Banner ────────────────────────────────────────────────── */}
      {delta !== null && previousRun && (
        <div className={cn(cardCls, "p-5 flex items-center gap-4 flex-wrap")}>
          {/* Delta badge */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border font-bold text-base tabular-nums",
              deltaBadgeClasses(delta)
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : delta < 0 ? (
              <ArrowDownRight className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            {delta > 0 ? "+" : ""}
            {delta} pts
          </div>

          {/* Context text */}
          <div className="flex-1 min-w-0">
            <p className={cn("text-base font-semibold", k.heading)}>
              vs. previous run
            </p>
            <p className={cn("text-sm mt-0.5", k.muted)}>
              {previousRun.coverageScore}% → {currentAnalysis.coverageScore}%
              {" · "}
              {formatRelativeDate(previousRun.createdAt)}
              {" · "}
              {previousRun.documentCount} docs
            </p>
          </div>

          {/* Trend bars */}
          {trendScores.length >= 2 && (
            <div className="flex items-center gap-2">
              <span className={cn("text-sm", k.muted)}>Trend</span>
              <TrendBarStrip scores={trendScores} />
            </div>
          )}

          {/* Compare button */}
          {!diffOpen && (
            <button
              onClick={handleShowDiff}
              disabled={compareMut.isPending}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-lg border transition-colors",
                "kb-duotone-chip-border",
                "kb-duotone-bg-hover-soft disabled:opacity-50"
              )}
            >
              {compareMut.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing diff…
                </span>
              ) : (
                "Show diff"
              )}
            </button>
          )}
          {diffOpen && (
            <button
              onClick={handleHideDiff}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-lg border transition-colors",
                "border-border/30 text-muted-foreground",
                "hover:bg-muted"
              )}
            >
              Hide diff
            </button>
          )}
        </div>
      )}

      {/* ── Semantic Diff (Gemini-powered) ───────────────────────────────── */}
      <AnimatePresence>
        {diffOpen && compareMut.isPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                cardCls,
                "p-6 flex items-center justify-center gap-3"
              )}
            >
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className={cn("text-sm", k.muted)}>
                Gemini is semantically comparing gap reports…
              </span>
            </div>
          </motion.div>
        )}

        {diffOpen && diff && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(cardCls, "p-5 space-y-4")}>
              {/* Diff header + summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-primary" />
                  <p className={cn("text-base font-bold", k.heading)}>
                    Semantic Diff
                  </p>
                  <span
                    className={cn(
                      "text-xs px-2.5 py-0.5 rounded-full kb-duotone-fill"
                    )}
                  >
                    Gemini-powered
                  </span>
                </div>
                <p className={cn("text-sm leading-relaxed", k.muted)}>
                  {diff.summary}
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {diff.resolved.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {diff.newGaps.length}
                    </p>
                    <p className="text-sm text-muted-foreground">New</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">
                      {diff.persisted.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Persisted</p>
                  </div>
                </div>
              </div>

              {/* Resolved gaps */}
              {diff.resolved.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Resolved
                  </p>
                  <div className="space-y-2">
                    {diff.resolved.map((g, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-sm text-foreground flex-1 leading-snug">
                          {g.topic}
                        </p>
                        <span className="text-sm text-muted-foreground/60 line-through">
                          {g.previousSeverity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New gaps */}
              {diff.newGaps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> New gaps
                  </p>
                  <div className="space-y-2">
                    {diff.newGaps.map((g, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-lg border",
                          g.severity === "high"
                            ? "bg-red-500/5 border-red-500/10"
                            : g.severity === "medium"
                              ? "bg-primary/5 border-primary/10"
                              : "bg-blue-500/5 border-blue-500/10"
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            "w-4 h-4 shrink-0",
                            g.severity === "high"
                              ? "text-red-500"
                              : g.severity === "medium"
                                ? "text-primary"
                                : "text-blue-500"
                          )}
                        />
                        <p className="text-sm text-foreground flex-1 leading-snug">
                          {g.topic}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded uppercase",
                            g.severity === "high"
                              ? "bg-red-500/10 text-red-500"
                              : g.severity === "medium"
                                ? "bg-primary/10 text-primary"
                                : "bg-blue-500/10 text-blue-500"
                          )}
                        >
                          {g.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Persisted gaps (still open) */}
              {diff.persisted.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Still open
                  </p>
                  <div className="space-y-2">
                    {diff.persisted.map((g, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <Minus className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        <p className="text-sm text-muted-foreground flex-1 leading-snug">
                          {g.topic}
                        </p>
                        {g.severityChange !== "unchanged" && (
                          <span
                            className={cn(
                              "text-sm font-medium flex items-center gap-0.5",
                              g.severityChange === "deescalated"
                                ? "text-emerald-500"
                                : "text-red-500"
                            )}
                          >
                            {g.severityChange === "deescalated" ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingUp className="w-3.5 h-3.5" />
                            )}
                            {g.severityChange}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground/60">
                          {g.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strength changes */}
              {(diff.newStrengths?.length > 0 ||
                diff.lostStrengths?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/30">
                  {diff.newStrengths?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-primary dark:text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> New strengths
                      </p>
                      {diff.newStrengths.map((s, i) => (
                        <p
                          key={i}
                          className="text-sm text-foreground/80 pl-5 leading-snug"
                        >
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                  {diff.lostStrengths?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4" /> Lost strengths
                      </p>
                      {diff.lostStrengths.map((s, i) => (
                        <p
                          key={i}
                          className="text-sm text-muted-foreground/60 pl-5 leading-snug line-through"
                        >
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {diffOpen && compareMut.isError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                cardCls,
                "p-4 flex items-center gap-2 text-red-500"
              )}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">
                Diff failed: {compareMut.error?.message ?? "Unknown error"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compact Run History (collapsible) ───────────────────────────── */}
      {snapshots.length >= 1 && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
          >
            {historyOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
            )}
            <History className="w-4 h-4 text-primary" />
            <span className={cn("text-sm font-semibold flex-1", k.heading)}>
              Run History
            </span>
            <span className={cn("text-sm tabular-nums", k.muted)}>
              {snapshots.length} runs
            </span>
          </button>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/30">
                  {snapshots.map((snap, idx) => {
                    const prev = snapshots[idx + 1];
                    const d = prev
                      ? snap.coverageScore - prev.coverageScore
                      : null;

                    return (
                      <div
                        key={snap.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-sm",
                          idx === 0
                            ? "bg-primary/3"
                            : "hover:bg-black/2 dark:hover:bg-white/2",
                          idx < snapshots.length - 1 &&
                            "border-b border-border/50"
                        )}
                      >
                        {/* Score */}
                        <span
                          className={cn(
                            "w-8 text-center font-bold tabular-nums",
                            scoreColor(snap.coverageScore)
                          )}
                        >
                          {snap.coverageScore}
                        </span>

                        {/* Delta */}
                        <span className="w-12 text-center">
                          {d !== null ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                                d > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : d < 0
                                    ? "text-red-500 dark:text-red-400"
                                    : "text-muted-foreground/60"
                              )}
                            >
                              {d > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : d < 0 ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : (
                                <Minus className="w-3 h-3" />
                              )}
                              {d > 0 ? "+" : ""}
                              {d}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </span>

                        {/* Label */}
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-xs font-medium",
                            snap.coverageScore >= 75
                              ? "kb-duotone-fill"
                              : snap.coverageScore >= 50
                                ? "bg-primary/10 text-primary"
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                          )}
                        >
                          {snap.coverageLabel}
                        </span>

                        {/* Spacer + meta */}
                        <span className="flex-1" />

                        <span className="flex items-center gap-1 text-muted-foreground/60">
                          <FileText className="w-3 h-3" />
                          {snap.documentCount}
                        </span>

                        <span className="flex items-center gap-1 text-muted-foreground/60 min-w-15 justify-end">
                          <Clock className="w-3 h-3" />
                          {formatRelativeDate(snap.createdAt)}
                        </span>

                        {/* Latest badge */}
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium kb-duotone-fill">
                            Current
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
