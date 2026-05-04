import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Plus,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FlaskConical,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";
import { cardCls } from "../types";
import { k } from "../theme";
import type {
  EvaluationReport,
  CaseResult,
  MetricResult,
  MetricName,
  MetricSummary,
} from "@shared/knowledge-types";

// ── Metric display helpers ──────────────────────────────────────────────────

const METRIC_LABELS: Record<string, { label: string; description: string }> = {
  context_relevance: {
    label: "Context Relevance",
    description: "How relevant is the retrieved context to the query?",
  },
  faithfulness: {
    label: "Faithfulness",
    description: "Is the generated answer grounded in the context?",
  },
  answer_relevance: {
    label: "Answer Relevance",
    description: "Does the answer address the original query?",
  },
  context_precision: {
    label: "Context Precision",
    description: "Are the top-ranked chunks actually useful?",
  },
};

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-primary";
  if (score >= 0.5) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 0.8) return "bg-primary";
  if (score >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

// ── Case form row ───────────────────────────────────────────────────────────

interface CaseFormData {
  id: string;
  query: string;
  expectedAnswer: string;
  retrievedContexts: string;
  generatedAnswer: string;
}

function emptyCaseForm(): CaseFormData {
  return {
    id: crypto.randomUUID().slice(0, 8),
    query: "",
    expectedAnswer: "",
    retrievedContexts: "",
    generatedAnswer: "",
  };
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EvaluationTab() {
  const [cases, setCases] = useState<CaseFormData[]>([emptyCaseForm()]);
  const [suiteName, setSuiteName] = useState("");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [quickQuery, setQuickQuery] = useState("");
  const { notify } = useNotifications();

  const evaluateMut = trpc.knowledge.evaluateSuite.useMutation({
    onSuccess: data => {
      setReport(data);
      notify({
        title: `Evaluation complete`,
        description: `${data.totalCases} case(s) evaluated`,
        severity: "success",
        group: "eval",
      });
    },
    onError: e =>
      notify({
        title: "Evaluation failed",
        description: e.message,
        severity: "error",
        group: "eval",
      }),
  });

  const quickMut = trpc.knowledge.evaluateSingle.useMutation({
    onSuccess: data => {
      setReport(data);
      notify({
        title: "Quick evaluation complete",
        severity: "success",
        group: "eval",
      });
    },
    onError: e =>
      notify({
        title: "Evaluation failed",
        description: e.message,
        severity: "error",
        group: "eval",
      }),
  });

  const addCase = () => setCases(prev => [...prev, emptyCaseForm()]);
  const removeCase = (id: string) =>
    setCases(prev => prev.filter(c => c.id !== id));
  const updateCase = (id: string, field: keyof CaseFormData, value: string) => {
    setCases(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRunSuite = () => {
    const validCases = cases.filter(c => c.query.trim());
    if (!validCases.length)
      return notify({ title: "Add at least one query", severity: "warning" });
    evaluateMut.mutate({
      suiteName: suiteName || undefined,
      cases: validCases.map(c => ({
        id: c.id,
        query: c.query,
        expectedAnswer: c.expectedAnswer || undefined,
        retrievedContexts: c.retrievedContexts
          ? c.retrievedContexts.split("\n").filter(Boolean)
          : undefined,
        generatedAnswer: c.generatedAnswer || undefined,
      })),
    });
  };

  const handleQuickEval = () => {
    if (!quickQuery.trim())
      return notify({ title: "Enter a query", severity: "warning" });
    quickMut.mutate({ query: quickQuery });
  };

  const isRunning = evaluateMut.isPending || quickMut.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── Quick single-query evaluation ── */}
      <div className={cn("overflow-hidden", cardCls)}>
        <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Quick Evaluation
          </h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground/60">
            Run a quick RAGAS-style evaluation on a single query to test
            retrieval quality.
          </p>
          <div className="flex gap-2">
            <input
              value={quickQuery}
              onChange={e => setQuickQuery(e.target.value)}
              placeholder="What is HKI's return policy?"
              className={cn(k.input, "text-xs flex-1")}
              onKeyDown={e => e.key === "Enter" && handleQuickEval()}
            />
            <button
              onClick={handleQuickEval}
              disabled={isRunning}
              className={k.btnPrimary}
            >
              {quickMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Evaluate
            </button>
          </div>
        </div>
      </div>

      {/* ── Test suite builder ── */}
      <div className={cn("overflow-hidden", cardCls)}>
        <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Test Suite
          </h3>
          <div className="flex items-center gap-2">
            <input
              value={suiteName}
              onChange={e => setSuiteName(e.target.value)}
              placeholder="Suite name (optional)"
              className={cn(k.input, "text-xs w-48")}
            />
            <button onClick={addCase} className={k.btnSecondary}>
              <Plus className="w-3 h-3" /> Add Case
            </button>
            <button
              onClick={handleRunSuite}
              disabled={isRunning}
              className={k.btnPrimary}
            >
              {evaluateMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run Suite
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {cases.map((c, i) => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Case {i + 1}
                </span>
                {cases.length > 1 && (
                  <button
                    onClick={() => removeCase(c.id)}
                    className="p-1 rounded text-muted-foreground/60 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                value={c.query}
                onChange={e => updateCase(c.id, "query", e.target.value)}
                placeholder="Query *"
                className={cn(k.input, "text-xs")}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={c.expectedAnswer}
                  onChange={e =>
                    updateCase(c.id, "expectedAnswer", e.target.value)
                  }
                  placeholder="Expected answer (optional)"
                  className={cn(k.input, "text-xs")}
                />
                <input
                  value={c.generatedAnswer}
                  onChange={e =>
                    updateCase(c.id, "generatedAnswer", e.target.value)
                  }
                  placeholder="Generated answer (optional)"
                  className={cn(k.input, "text-xs")}
                />
              </div>
              <textarea
                value={c.retrievedContexts}
                onChange={e =>
                  updateCase(c.id, "retrievedContexts", e.target.value)
                }
                placeholder="Retrieved contexts (one per line, optional)"
                rows={2}
                className={cn(k.input, "text-xs resize-none")}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Results ── */}
      {report && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={cn("p-5", cardCls)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {report.suiteName || "Evaluation Report"}
                </h3>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {report.totalCases} case(s) · {report.evalTimeMs.toFixed(0)}ms
                  {report.estimatedCostUsd != null &&
                    report.estimatedCostUsd > 0 && (
                      <span className="ml-2">
                        · ${report.estimatedCostUsd.toFixed(4)}
                      </span>
                    )}
                  {report.llmJudgeCalls != null && report.llmJudgeCalls > 0 && (
                    <span className="ml-2">
                      · {report.llmJudgeCalls} judge call
                      {report.llmJudgeCalls > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Metric summary bars with confidence intervals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.summary).map(([metric, score]) => {
                const meta = METRIC_LABELS[metric] ?? {
                  label: metric,
                  description: "",
                };
                const numScore = typeof score === "number" ? score : 0;
                const stats = report.statistics?.[metric];
                return (
                  <div
                    key={metric}
                    className="p-3 rounded-xl bg-muted/60 dark:bg-muted/60"
                    title={meta.description}
                  >
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1">
                      {meta.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          scoreColor(numScore)
                        )}
                      >
                        {(numScore * 100).toFixed(0)}%
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-black/5 dark:bg-muted/60 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            scoreBg(numScore)
                          )}
                          style={{ width: `${numScore * 100}%` }}
                        />
                      </div>
                    </div>
                    {/* Confidence interval + stddev */}
                    {stats && stats.n >= 2 && (
                      <p className="text-xs text-muted-foreground/50 mt-1 tabular-nums">
                        CI: [{(stats.ciLower * 100).toFixed(0)}–
                        {(stats.ciUpper * 100).toFixed(0)}%]
                        {" · "}σ {(stats.stddev * 100).toFixed(1)}%
                        {stats.avgLatencyMs > 0 &&
                          ` · ${stats.avgLatencyMs.toFixed(0)}ms`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-case results */}
          {report.caseResults.map((result: CaseResult) => {
            const avgScore = result.metrics.length
              ? result.metrics.reduce(
                  (sum: number, m: MetricResult) => sum + m.score,
                  0
                ) / result.metrics.length
              : 0;
            return (
              <div
                key={result.caseId}
                className={cn("overflow-hidden", cardCls)}
              >
                <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {result.query}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {avgScore >= 0.8 ? (
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    ) : avgScore >= 0.5 ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        scoreColor(avgScore)
                      )}
                    >
                      {(avgScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="px-5 py-3 flex gap-4">
                  {result.metrics.map(m => (
                    <div key={m.name} className="text-center">
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          scoreColor(m.score)
                        )}
                      >
                        {(m.score * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
                        {METRIC_LABELS[m.name]?.label ?? m.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
