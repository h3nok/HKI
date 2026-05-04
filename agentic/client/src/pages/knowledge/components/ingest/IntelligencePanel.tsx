/**
 * IntelligencePanel — Right card of the Knowledge Studio.
 *
 * Structured sections with elevation:
 *   1. Card header with icon + title
 *   2. Confidence ring (inset card)
 *   3. Pipeline status (bordered section)
 *   4. Scrollable insights: tags, duplicates, relevance, issues (each in own zone)
 *   5. Action footer (bordered top)
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Upload,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Brain,
  FileCheck,
  FileX,
  FileWarning,
} from "lucide-react";
import { cn, Button, Badge, Progress } from "@hki/ui";
import type {
  PreIngestAnalysis,
  DuplicateMatch,
} from "@shared/knowledge-types";
import { k } from "../../theme";
import { STAGES } from "./types";
import type { StageStatus } from "./types";
import type { FlowStep, BatchAnalysisSummary } from "./useIngestPipeline";

// ── Confidence Ring SVG ──────────────────────────────────────────────────────

function ConfidenceRing({
  value,
  size = 64,
}: {
  value: number;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="text-black/5 dark:text-white/5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        className="transition-all duration-700"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-bold fill-foreground"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

interface IntelligencePanelProps {
  stages: StageStatus[];
  analysis: PreIngestAnalysis | null;
  isAnalyzing: boolean;
  isIngesting: boolean;
  hasAnalysis: boolean;
  analysisApproved: boolean;
  canAnalyze: boolean;
  mode: string;
  fileCount: number;
  onAnalyze: () => void;
  onIngest: () => void;
  onReset: () => void;
  flowStep?: FlowStep;
  batchSummary?: BatchAnalysisSummary | null;
  uploadableCount?: number;
}

const STEP_GUIDANCE: Record<FlowStep, string> = {
  add: "Add content in the Source panel to begin analysis",
  analyze: "Hit Analyze to run AI quality checks and classification",
  review: "Review the results below — approve or revise before ingesting",
  ingest: "Content is being processed through the pipeline…",
  track: "Ingestion complete — content is indexed and searchable",
};

export default function IntelligencePanel({
  stages,
  analysis,
  isAnalyzing,
  isIngesting,
  hasAnalysis,
  analysisApproved,
  canAnalyze,
  mode,
  fileCount,
  onAnalyze,
  onIngest,
  onReset,
  flowStep = "add",
  batchSummary,
  uploadableCount,
}: IntelligencePanelProps) {
  const pipelineActive = stages.some(s => s !== "idle");

  return (
    <div className="flex flex-col h-full">
      {/* ── Card Header ── */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/30">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Brain className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className={k.heading}>The Strategist</p>
          <p className={k.caption}>AI analysis & decisions</p>
        </div>
      </div>

      {/* ── Confidence (inset card) ── */}
      <div className="px-3 pt-3">
        <div className={cn(k.inset, "p-3", analysis && k.glow)}>
          <div className="flex items-center gap-3">
            <ConfidenceRing value={analysis?.overallConfidence ?? 0} />
            <div className="flex-1 min-w-0">
              <p className={k.heading}>
                {!pipelineActive
                  ? "Ready"
                  : isAnalyzing
                    ? "Analyzing…"
                    : analysis?.overallPass
                      ? "Approved"
                      : "Needs Review"}
              </p>
              <p className={cn(k.muted, "mt-0.5")}>
                {analysis
                  ? `${Math.round(analysis.overallConfidence * 100)}% confidence`
                  : STEP_GUIDANCE[flowStep]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline Status (bordered section) ── */}
      <div className="px-3 pt-3">
        <div className={cn(k.inset, "p-2.5")}>
          <p className={cn(k.label, "px-0.5 mb-1.5")}>Pipeline</p>
          <div className="space-y-0.5">
            {STAGES.map((stage, i) => {
              const status = stages[i]!;
              return (
                <div
                  key={stage.key}
                  className="flex items-center gap-2 py-1 px-1"
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      status === "idle" && "bg-muted",
                      status === "active" && "bg-primary/15",
                      status === "done" && "bg-emerald-500/15",
                      status === "rejected" && "bg-destructive/15"
                    )}
                  >
                    {status === "done" ? (
                      <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    ) : status === "rejected" ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : status === "active" ? (
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    ) : (
                      <stage.icon className="w-3 h-3 text-muted-foreground/50" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold flex-1",
                      status === "done" &&
                        "text-emerald-700 dark:text-emerald-300",
                      status === "rejected" && "text-destructive",
                      status === "active" && "text-primary",
                      status === "idle" && "text-muted-foreground/60"
                    )}
                  >
                    {stage.label}
                  </span>
                  {analysis && i === 0 && status === "done" && (
                    <span className={k.mono}>
                      {Math.round(analysis.validate.qualityScore)}
                    </span>
                  )}
                  {analysis &&
                    i === 2 &&
                    status !== "idle" &&
                    status !== "active" && (
                      <Badge
                        variant={
                          analysis.decide.recommendation === "ingest"
                            ? "success"
                            : analysis.decide.recommendation === "reject"
                              ? "destructive"
                              : "warning"
                        }
                        className="text-xs px-1.5 py-0 h-5"
                      >
                        {analysis.decide.recommendation}
                      </Badge>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable Insights ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pt-3 space-y-2.5">
        {/* Entities & Tags */}
        <AnimatePresence>
          {analysis && analysis.interpret.tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className={cn(k.inset, "p-2.5")}>
                <p className={cn(k.label, "mb-1.5")}>Extracted</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="default" className="text-xs">
                    {analysis.interpret.detectedType}
                  </Badge>
                  <Badge variant="accent" className="text-xs">
                    {analysis.interpret.department}
                  </Badge>
                  {analysis.interpret.tags.slice(0, 5).map((t: string) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Relevance bar */}
        {analysis && (
          <div className={cn(k.inset, "p-2.5")}>
            <p className={cn(k.label, "mb-1.5")}>Relevance</p>
            <div className="flex items-center gap-2">
              <Progress
                value={analysis.decide.relevanceScore * 100}
                className="flex-1 h-2"
                indicatorClassName={cn(
                  analysis.decide.relevanceScore >= 0.7
                    ? "bg-emerald-500"
                    : analysis.decide.relevanceScore >= 0.4
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
              />
              <span className={k.mono}>
                {Math.round(analysis.decide.relevanceScore * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Batch analysis summary (multi-file) */}
        {batchSummary && batchSummary.total > 1 && (
          <div className={cn(k.inset, "p-2.5")}>
            <p className={cn(k.label, "mb-2")}>
              Batch Analysis — {batchSummary.total} files
            </p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <FileCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {batchSummary.passed}
                </span>
                <span className={k.muted}>passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileWarning className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {batchSummary.flagged}
                </span>
                <span className={k.muted}>flagged</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileX className="w-3 h-3 text-red-500" />
                <span className="text-xs font-bold text-destructive">
                  {batchSummary.rejected}
                </span>
                <span className={k.muted}>rejected</span>
              </div>
            </div>
            {batchSummary.pending > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">
                  {batchSummary.pending} still analyzing…
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={k.muted}>Avg quality</span>
                <span className={k.mono}>
                  {Math.round(batchSummary.avgQuality)}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={k.muted}>Avg confidence</span>
                <span className={k.mono}>
                  {Math.round(batchSummary.avgConfidence * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={k.muted}>Avg relevance</span>
                <span className={k.mono}>
                  {Math.round(batchSummary.avgRelevance * 100)}%
                </span>
              </div>
              {batchSummary.piiFileCount > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-destructive font-semibold">
                    {batchSummary.piiFileCount} file
                    {batchSummary.piiFileCount !== 1 ? "s" : ""} with PII
                  </span>
                </div>
              )}
              {batchSummary.duplicateFileCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Copy className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {batchSummary.duplicateFileCount} potential duplicate
                    {batchSummary.duplicateFileCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Duplicate warnings */}
        <AnimatePresence>
          {analysis &&
            analysis.decide.duplicates &&
            analysis.decide.duplicates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/4 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Copy className="w-3 h-3 text-amber-600" />
                    <p
                      className={cn(
                        k.label,
                        "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      Duplicates
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {analysis.decide.duplicates.map(
                      (dup: DuplicateMatch, idx: number) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-card/60 dark:bg-card/50 border border-amber-500/10 p-2"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {dup.title}
                            </p>
                            <span className="text-xs font-bold text-amber-600 tabular-nums shrink-0">
                              {Math.round(dup.similarity * 100)}%
                            </span>
                          </div>
                          {dup.chunkPreview && (
                            <p className={cn(k.muted, "mt-0.5 line-clamp-2")}>
                              {dup.chunkPreview}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Validation issues */}
        {analysis && analysis.validate.issues.length > 0 && (
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/4 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <p className={cn(k.label, "text-amber-700 dark:text-amber-400")}>
                Issues
              </p>
            </div>
            <div className="space-y-0.5">
              {analysis.validate.issues.map((issue: string, idx: number) => (
                <p
                  key={idx}
                  className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed"
                >
                  {issue}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* PII warning */}
        {analysis && analysis.validate.piiDetected && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-destructive">PII Detected</p>
            </div>
            <p className={cn(k.muted, "mt-0.5 text-destructive/80")}>
              {analysis.validate.piiCategories.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* ── Action Footer (bordered) ── */}
      <div className="border-t border-border/30 px-4 py-3 space-y-1.5">
        {/* Step 1: Analyze — shown for all modes before analysis */}
        {!hasAnalysis && (
          <Button
            onClick={onAnalyze}
            disabled={isAnalyzing || !canAnalyze}
            className="w-full"
            size="sm"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {isAnalyzing
              ? "Analyzing…"
              : mode === "file"
                ? `Analyze ${fileCount || ""} File${fileCount !== 1 ? "s" : ""}`
                : "Analyze Content"}
          </Button>
        )}
        {/* Step 2a: Approved — proceed to ingest */}
        {hasAnalysis && analysisApproved && (
          <Button
            onClick={onIngest}
            disabled={isIngesting || (mode === "file" && uploadableCount === 0)}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            {isIngesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {isIngesting
              ? mode === "file"
                ? "Uploading…"
                : "Ingesting…"
              : mode === "file"
                ? `Upload ${uploadableCount ?? fileCount} of ${fileCount} File${fileCount !== 1 ? "s" : ""}`
                : "Confirm & Ingest"}
          </Button>
        )}
        {/* Step 2b: Rejected — try again */}
        {hasAnalysis && !analysisApproved && (
          <Button
            variant="ghost"
            onClick={onReset}
            className="w-full"
            size="sm"
          >
            <RefreshCw className="w-3 h-3" /> Try different content
          </Button>
        )}
        {/* Skip analysis shortcut for files */}
        {!hasAnalysis && !isAnalyzing && mode === "file" && canAnalyze && (
          <Button
            variant="ghost"
            onClick={onIngest}
            disabled={isIngesting}
            className="w-full"
            size="sm"
          >
            <Upload className="w-3 h-3" /> Skip analysis & upload directly
          </Button>
        )}
      </div>
    </div>
  );
}
