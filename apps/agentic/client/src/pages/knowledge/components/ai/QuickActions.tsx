/**
 * QuickActions — Inline analysis cards for knowledge pages.
 *
 * Replaces generic sidebar prompts with focused, one-click analysis steps.
 * Each action triggers a Gemini mutation and shows results inline.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Target,
  FileSearch,
  TrendingUp,
  Loader2,
  ChevronDown,
  X,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import { k } from "../../theme";

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  /** Accent color class for the icon bg */
  accent: string;
  /** Accent color class for the icon itself */
  iconColor: string;
  /** Called when the user clicks the action */
  onExecute: () => Promise<QuickActionResult>;
}

export interface QuickActionResult {
  title: string;
  summary: string;
  score?: number;
  scoreLabel?: string;
  items?: {
    label: string;
    severity?: "high" | "medium" | "low";
    detail?: string;
  }[];
  recommendations?: string[];
}

// ── Severity badge ───────────────────────────────────────────────────────────

const SEV_STYLE = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
} as const;

// ── Single Action Card ───────────────────────────────────────────────────────

function ActionCard({ action }: { action: QuickAction }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const execute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await action.onExecute();
      setResult(res);
      setExpanded(true);
    } catch (e: any) {
      setError(e?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const Icon = action.icon;

  return (
    <div className={cn(k.card, "overflow-hidden transition-all")}>
      {/* Action trigger */}
      <button
        onClick={result ? () => setExpanded(!expanded) : execute}
        disabled={loading}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
          "hover:bg-black/3 dark:hover:bg-white/3",
          "disabled:opacity-70 disabled:cursor-wait",
          "group"
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
            action.accent
          )}
        >
          {loading ? (
            <Loader2 className={cn("w-4 h-4 animate-spin", action.iconColor)} />
          ) : (
            <Icon className={cn("w-4 h-4", action.iconColor)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(k.heading, "leading-tight")}>{action.label}</p>
          <p className={cn(k.muted, "leading-snug")}>{action.description}</p>
        </div>
        {result && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        )}
        {!result && !loading && (
          <div
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
              "kb-duotone-chip-reactive"
            )}
          >
            <Sparkles className="w-3 h-3 inline -mt-px mr-0.5" /> Run
          </div>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/8 border border-destructive/15 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto p-0.5 hover:bg-destructive/10 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Result panel */}
      <AnimatePresence>
        {result && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
              {/* Score badge */}
              {result.score != null && (
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black tabular-nums",
                      result.score >= 75
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : result.score >= 50
                          ? "bg-primary/10 text-primary"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}
                  >
                    {result.score}
                  </div>
                  <div>
                    <p className={k.heading}>
                      {result.scoreLabel || "Coverage Score"}
                    </p>
                    <p className={cn(k.muted, "leading-relaxed")}>
                      {result.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary (no score) */}
              {result.score == null && result.summary && (
                <p className="text-sm text-foreground leading-relaxed">
                  {result.summary}
                </p>
              )}

              {/* Items (gaps, categories, etc.) */}
              {result.items && result.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className={cn(k.label, "px-0.5")}>
                    {result.score != null ? "Gaps Identified" : "Results"}
                  </p>
                  {result.items.slice(0, 6).map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-2 px-3 py-2 rounded-lg",
                        k.inset
                      )}
                    >
                      {item.severity && (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-xs font-bold uppercase border shrink-0 mt-0.5",
                            SEV_STYLE[item.severity]
                          )}
                        >
                          {item.severity}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {item.label}
                        </p>
                        {item.detail && (
                          <p className={cn(k.muted, "leading-relaxed")}>
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="space-y-1">
                  <p className={cn(k.label, "px-0.5 flex items-center gap-1")}>
                    <Lightbulb className="w-3 h-3" /> Next Steps
                  </p>
                  {result.recommendations.slice(0, 4).map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1">
                      <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">
                        {rec}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Re-run button */}
              <button
                onClick={execute}
                disabled={loading}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  "kb-duotone-accent-text kb-duotone-bg-hover disabled:opacity-50"
                )}
              >
                <Sparkles className="w-3 h-3" />
                {loading ? "Running…" : "Re-run"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Quick Actions Bar ────────────────────────────────────────────────────────

export interface QuickActionsBarProps {
  actions: QuickAction[];
  className?: string;
}

export default function QuickActionsBar({
  actions,
  className,
}: QuickActionsBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <p className={cn(k.heading, "text-primary")}>Guided Analysis</p>
      </div>
      <div
        className={cn(
          "grid gap-2",
          actions.length === 1
            ? "grid-cols-1"
            : actions.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 lg:grid-cols-3"
        )}
      >
        {actions.map(action => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}

// ── Pre-built action factories ───────────────────────────────────────────────

export const AI_ACTIONS = {
  gapAnalysis: (opts: {
    streamName: string;
    streamDescription?: string;
    valueStreamId?: string;
    documents?: {
      title: string;
      department?: string;
      documentType?: string;
      chunkCount?: number;
    }[];
    mutate: (input: any) => Promise<any>;
  }): QuickAction => ({
    id: "gap-analysis",
    icon: Target,
    label: "Run Gap Analysis",
    description:
      "Create a versioned coverage snapshot and identify missing topics",
    accent: "bg-primary/10 dark:bg-primary/15",
    iconColor: "text-primary",
    onExecute: async () => {
      const { analysis } = await opts.mutate({
        streamName: opts.streamName,
        streamDescription: opts.streamDescription,
        valueStreamId: opts.valueStreamId,
        documents: opts.documents?.slice(0, 100),
      });
      return {
        title: "Gap Snapshot",
        summary: analysis.summary || "Analysis complete",
        score: analysis.coverageScore,
        scoreLabel: analysis.coverageLabel || "Coverage",
        items: (analysis.gaps || []).map((g: any) => ({
          label: g.topic,
          severity: g.severity,
          detail: g.suggestion,
        })),
        recommendations: analysis.recommendations || [],
      };
    },
  }),

  ingestionPlan: (opts: {
    streamName: string;
    streamDescription?: string;
    existingDocCount?: number;
    mutate: (input: any) => Promise<any>;
  }): QuickAction => ({
    id: "ingestion-plan",
    icon: FileSearch,
    label: "Plan My Ingestion",
    description: "AI suggests what content to ingest based on your domain",
    accent: "bg-violet-500/10 dark:bg-violet-500/15",
    iconColor: "text-violet-500",
    onExecute: async () => {
      const { plan } = await opts.mutate({
        streamName: opts.streamName,
        streamDescription: opts.streamDescription,
        existingDocCount: opts.existingDocCount,
      });
      return {
        title: "Ingestion Plan",
        summary: plan.summary || "Plan generated",
        items: [
          ...(plan.categories || []).map((c: any) => ({
            label: c.name,
            severity: c.priority as "high" | "medium" | "low",
            detail: `${c.description}${c.estimatedDocs ? ` (~${c.estimatedDocs} docs)` : ""}`,
          })),
        ],
        recommendations: plan.quickWins || [],
      };
    },
  }),

  healthCheck: (opts: {
    page: string;
    pageData?: Record<string, unknown>;
    mutate: (input: any) => Promise<any>;
  }): QuickAction => ({
    id: "health-check",
    icon: TrendingUp,
    label: "AI Health Summary",
    description: "Get an AI-powered assessment of your domain library health",
    accent: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconColor: "text-emerald-500",
    onExecute: async () => {
      const { answer } = await opts.mutate({
        page: opts.page,
        question:
          "Give me a brief health assessment of my domain library. What's working well and what needs attention? Be specific with numbers.",
        pageData: opts.pageData,
      });
      return {
        title: "Health Assessment",
        summary: answer,
      };
    },
  }),
};
