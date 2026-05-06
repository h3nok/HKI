/**
 * TransformCanvas — Center card of the Knowledge Studio.
 *
 * Structured sections with elevation:
 *   1. Card header with icon + title
 *   2. Pipeline stepper bar (own bordered zone)
 *   3. Content preview (recessed inset zone)
 *   4. AI Summary card (elevated when present)
 *   5. Agent Huddle section (bordered bottom zone)
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Eye,
  Gavel,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Globe,
  Upload,
  MessageSquare,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn, EmptyState } from "@hki/ui";
import type { PreIngestAnalysis } from "@shared/knowledge-types";
import { k } from "../../theme";
import { STAGES } from "./types";
import type { StageStatus, IngestFormState } from "./types";
import type { FlowStep } from "./useIngestPipeline";

// ── Agent Huddle ─────────────────────────────────────────────────────────────

interface HuddleEntry {
  agent: string;
  icon: LucideIcon;
  message: string;
  severity: "info" | "success" | "warning" | "error";
}

function buildHuddles(a: PreIngestAnalysis): HuddleEntry[] {
  const h: HuddleEntry[] = [];

  h.push({
    agent: "Validator",
    icon: ShieldCheck,
    message: a.validate.piiDetected
      ? `PII detected (${a.validate.piiCategories.join(", ")}). Blocking.`
      : `Quality ${Math.round(a.validate.qualityScore)}/100 — ${a.validate.wordCount} words, ${a.validate.readabilityGrade}.`,
    severity: a.validate.piiDetected
      ? "error"
      : a.validate.qualityScore >= 60
        ? "success"
        : "warning",
  });

  h.push({
    agent: "Interpreter",
    icon: Eye,
    message: `Classified as "${a.interpret.detectedType}" → ${a.interpret.department}. ${a.interpret.tags.length} tags, ${a.interpret.entities.length} entities.`,
    severity: a.interpret.confidence >= 0.6 ? "success" : "info",
  });

  const dupeCount = a.decide.duplicates?.length ?? 0;
  if (dupeCount > 0) {
    const best = a.decide.duplicates[0]!;
    h.push({
      agent: "Decider",
      icon: Gavel,
      message: `Duplicate alert: "${best.title}" is ${Math.round(best.similarity * 100)}% similar.`,
      severity: "warning",
    });
  }

  h.push({
    agent: "Decider",
    icon: Gavel,
    message:
      a.decide.recommendation === "ingest"
        ? `Approved — ${Math.round(a.decide.relevanceScore * 100)}% relevance.`
        : a.decide.recommendation === "review"
          ? `Review needed — ${a.decide.reasoning.slice(0, 80)}${a.decide.reasoning.length > 80 ? "…" : ""}`
          : `Rejected — ${a.decide.reasoning.slice(0, 80)}${a.decide.reasoning.length > 80 ? "…" : ""}`,
    severity:
      a.decide.recommendation === "ingest"
        ? "success"
        : a.decide.recommendation === "review"
          ? "warning"
          : "error",
  });

  return h;
}

const SEV = {
  info: { border: "border-primary/15", bg: "bg-primary/4", dot: "bg-primary" },
  success: {
    border: "border-emerald-500/15",
    bg: "bg-emerald-500/4",
    dot: "bg-emerald-500",
  },
  warning: {
    border: "border-primary/15",
    bg: "bg-primary/4",
    dot: "bg-primary/80",
  },
  error: { border: "border-red-500/15", bg: "bg-red-500/4", dot: "bg-red-500" },
} as const;

// ── Component ────────────────────────────────────────────────────────────────

interface TransformCanvasProps {
  stages: StageStatus[];
  analysis: PreIngestAnalysis | null;
  isAnalyzing: boolean;
  form: IngestFormState;
  mode: string;
  files: Array<{ file: { name: string }; status: string }>;
  flowStep?: FlowStep;
}

export default function TransformCanvas({
  stages,
  analysis,
  isAnalyzing,
  form,
  mode,
  files,
  flowStep = "add",
}: TransformCanvasProps) {
  const huddles = useMemo(
    () => (analysis ? buildHuddles(analysis) : []),
    [analysis]
  );

  const previewText =
    mode === "text" ? form.content : mode === "url" ? form.url : "";
  const hasContent =
    mode === "file"
      ? files.some(f => f.status === "ready")
      : previewText.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Card Header ── */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/30">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
          <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <p className={k.heading}>Intake Well</p>
          <p className={k.caption}>Content flows through AI stages</p>
        </div>
      </div>

      {/* ── Pipeline Stepper Bar (own bordered zone) ── */}
      <div className="mx-4 mt-3">
        <div className={cn(k.inset, "px-4 py-2.5")}>
          <div className="flex items-center">
            {STAGES.map((stage, i) => {
              const status = stages[i]!;
              const isLast = i === STAGES.length - 1;
              return (
                <div
                  key={stage.key}
                  className="flex items-center flex-1 min-w-0"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                        status === "idle" && "bg-muted",
                        status === "active" && "bg-primary shadow-glow-sm",
                        status === "done" && "bg-emerald-500",
                        status === "rejected" && "bg-red-500"
                      )}
                    >
                      {status === "done" ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : status === "rejected" ? (
                        <XCircle className="w-3 h-3 text-white" />
                      ) : status === "active" ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold hidden sm:inline",
                        status === "idle" && "text-muted-foreground/60",
                        status === "active" && "text-primary",
                        status === "done" &&
                          "text-emerald-600 dark:text-emerald-400",
                        status === "rejected" && "text-destructive"
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className="flex-1 mx-2 h-px">
                      <div
                        className={cn(
                          "h-full transition-colors duration-500",
                          status === "done"
                            ? "bg-emerald-400/40"
                            : status === "rejected"
                              ? "bg-red-400/40"
                              : "bg-border"
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content Preview (inset zone) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
        {!hasContent && !analysis ? (
          <div
            className={cn(
              k.inset,
              "flex flex-col items-center justify-center h-full text-center"
            )}
          >
            <EmptyState
              size="sm"
              icon={
                <div className="w-10 h-10 rounded-xl bg-primary/8 dark:bg-primary/12 flex items-center justify-center">
                  {mode === "file" ? (
                    <Upload className="w-5 h-5 text-primary/50" />
                  ) : mode === "url" ? (
                    <Globe className="w-5 h-5 text-primary/50" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary/50" />
                  )}
                </div>
              }
              title={
                flowStep === "add" ? "Add your content" : "Waiting for content"
              }
              description={
                flowStep === "add"
                  ? mode === "file"
                    ? "Drop files into the Source panel on the left. AI will extract text, validate quality, and detect document type."
                    : mode === "url"
                      ? "Enter a URL in the Source panel. The page will be scraped, cleaned, and analyzed by AI agents."
                      : "Paste your content in the Source panel. AI will validate quality, classify the document, and check for duplicates."
                  : "Content will appear here once you add it in the Source panel."
              }
              action={
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50 dark:bg-white/[0.06] border border-border/40">
                  {STAGES.map((s, i) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <s.icon className="w-3 h-3" />
                      <span>{s.label}</span>
                      {i < STAGES.length - 1 && (
                        <span className="text-muted-foreground/70 ml-1">→</span>
                      )}
                    </div>
                  ))}
                </div>
              }
              className="[&_h3]:text-sm [&_p]:text-xs [&_p]:max-w-[260px]"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Text preview in inset zone with floating badges */}
            {mode === "text" && previewText && (
              <div className="relative">
                <div
                  className={cn(
                    k.inset,
                    "p-4 text-xs leading-relaxed max-h-[220px] overflow-y-auto",
                    "text-foreground"
                  )}
                >
                  {previewText.slice(0, 1500)}
                  {previewText.length > 1500 && (
                    <span className="text-muted-foreground">
                      {" "}
                      … ({previewText.length.toLocaleString()} chars)
                    </span>
                  )}
                </div>
                {analysis && (
                  <div className="absolute -top-2.5 right-3 flex items-center gap-1">
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full kb-duotone-fill border border-primary/20 shadow-sm">
                      {analysis.interpret.detectedType}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20 shadow-sm">
                      {analysis.interpret.department}
                    </span>
                    {analysis.validate.piiDetected && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-destructive/10 text-destructive border border-destructive/20 shadow-sm flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> PII
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* File list in inset zone */}
            {mode === "file" && files.length > 0 && (
              <div className={cn(k.inset, "p-3")}>
                <p className={cn(k.heading, "mb-2")}>
                  {files.length} file{files.length !== 1 ? "s" : ""} queued
                </p>
                <div className="space-y-1">
                  {files.slice(0, 8).map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <Upload className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate text-foreground">
                        {f.file.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold ml-auto shrink-0 uppercase",
                          f.status === "ready" && "text-primary",
                          f.status === "uploading" && "text-primary",
                          f.status === "success" && "text-emerald-500",
                          f.status === "error" && "text-destructive"
                        )}
                      >
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* URL preview */}
            {mode === "url" && form.url && (
              <div className={cn(k.inset, "p-4")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-primary truncate font-mono">
                      {form.url}
                    </p>
                    <p className={cn(k.muted, "mt-0.5")}>
                      Will be scraped & chunked
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary — elevated card */}
            {analysis?.interpret.summary && (
              <div
                className={cn(
                  "rounded-xl border border-primary/15 bg-primary/4 p-3.5 shadow-sm",
                  k.glow
                )}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-bold text-primary">AI Summary</p>
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  {analysis.interpret.summary}
                </p>
              </div>
            )}

            {/* Analyzing state */}
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm",
                  k.glow
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary">
                      AI agents analyzing…
                    </p>
                    <p className={cn(k.muted, "mt-0.5 text-primary/60")}>
                      Validate → Interpret → Decide
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ── Agent Huddle (bordered bottom section) ── */}
      <AnimatePresence>
        {huddles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-3 h-3 text-primary" />
                </div>
                <p className={cn(k.label, "text-primary")}>Agent Huddle</p>
              </div>
              <div className="space-y-1.5">
                {huddles.map((h, idx) => {
                  const HIcon = h.icon;
                  const s = SEV[h.severity];
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      className={cn(
                        "flex items-start gap-2 py-1.5 px-2.5 rounded-lg border",
                        s.border,
                        s.bg
                      )}
                    >
                      <div className="flex items-center gap-1.5 shrink-0 mt-px">
                        <div
                          className={cn("w-1.5 h-1.5 rounded-full", s.dot)}
                        />
                        <HIcon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-muted-foreground">
                          {h.agent}:{" "}
                        </span>
                        <span className="text-xs text-foreground">
                          {h.message}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
