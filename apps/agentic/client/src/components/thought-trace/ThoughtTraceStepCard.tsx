/**
 * Enhanced Thought Trace Step
 * Expandable step cards with detailed metadata, timing, and status.
 *
 * Supports all 16+ event types from the orchestrator WebSocket stream.
 * Unknown types fall back to a generic "Activity" config.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Route,
  Wrench,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronDown,
  AlertCircle,
  Zap,
  Shield,
  Database,
  BookOpen,
  Save,
  ArrowRightLeft,
  Activity,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";

/* ── Types ────────────────────────────────────────────────────── */

/** Accept all known orchestrator event types + string fallback for forward-compat */
export type ThoughtTraceStepType =
  | "thinking"
  | "planning"
  | "executing"
  | "reflecting"
  | "routing"
  | "tool_call"
  | "tool_result"
  | "guardrail"
  | "prompt_stack"
  | "handoff"
  | "memory_recall"
  | "memory_store"
  | "knowledge_retrieval"
  | "cache_hit"
  | "final_response"
  | "suggested_follow_ups"
  | "plan_generated"
  | "step_started"
  | "step_verifying"
  | "step_verified"
  | "step_failed"
  | "replanning"
  | "human_escalation"
  | "rollback"
  | "scratchpad_update"
  | (string & {}); // Forward-compat: accepts any string without breaking type narrowing

export interface ThoughtTraceStep {
  id: string;
  type: ThoughtTraceStepType;
  title: string;
  content: string;
  status: "pending" | "running" | "complete" | "error";
  metadata?: Record<string, any>;
  timestamp: Date;
  duration?: number; // ms
  agentName?: string;
}

interface ThoughtTraceStepCardProps {
  step: ThoughtTraceStep;
  index: number;
  isLatest?: boolean;
}

/* ── Step Type Config ─────────────────────────────────────────── */

type StepTypeConfig = {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
};

/** Known event type → icon/color mapping */
const STEP_TYPE_CONFIG: Record<string, StepTypeConfig> = {
  thinking: {
    icon: Brain,
    label: "Thinking",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  planning: {
    icon: Route,
    label: "Planning",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  executing: {
    icon: Wrench,
    label: "Executing",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  reflecting: {
    icon: MessageSquare,
    label: "Reflecting",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  routing: {
    icon: Zap,
    label: "Routing",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  prompt_stack: {
    icon: Layers,
    label: "Prompt Stack",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  // ── Extended event types from orchestrator ───────────────────
  tool_call: {
    icon: Wrench,
    label: "Calling Tool",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  tool_result: {
    icon: CheckCircle2,
    label: "Tool Result",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  guardrail: {
    icon: Shield,
    label: "Safety Check",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
  knowledge_retrieval: {
    icon: Database,
    label: "Knowledge Search",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  memory_recall: {
    icon: BookOpen,
    label: "Memory Recall",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  memory_store: {
    icon: Save,
    label: "Storing Memory",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  handoff: {
    icon: ArrowRightLeft,
    label: "Agent Handoff",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  cache_hit: {
    icon: Zap,
    label: "Cache Hit",
    color: "text-lime-500",
    bgColor: "bg-lime-500/10",
  },
  final_response: {
    icon: MessageSquare,
    label: "Final Response",
    color: "text-emerald-600",
    bgColor: "bg-emerald-600/10",
  },
  plan_generated: {
    icon: Route,
    label: "Plan Ready",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  step_started: {
    icon: Loader2,
    label: "Step Running",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  step_verifying: {
    icon: Shield,
    label: "Verifying",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  step_verified: {
    icon: CheckCircle2,
    label: "Step Verified",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  step_failed: {
    icon: AlertCircle,
    label: "Step Failed",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  replanning: {
    icon: Route,
    label: "Replanning",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  human_escalation: {
    icon: AlertCircle,
    label: "Needs Decision",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  rollback: {
    icon: ArrowRightLeft,
    label: "Rolling Back",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
  scratchpad_update: {
    icon: Save,
    label: "Working Memory",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

/** Fallback config for unknown event types — prevents crashes from new orchestrator events */
const FALLBACK_STEP_CONFIG: StepTypeConfig = {
  icon: Activity,
  label: "Activity",
  color: "text-muted-foreground",
  bgColor: "bg-muted",
};

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-muted-foreground",
  },
  running: {
    icon: Loader2,
    label: "Running",
    color: "text-blue-500",
  },
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    color: "text-emerald-500",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    color: "text-red-500",
  },
};

/* ── Component ────────────────────────────────────────────────── */

export default function ThoughtTraceStepCard({
  step,
  index,
  isLatest = false,
}: ThoughtTraceStepCardProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);
  const typeConfig = STEP_TYPE_CONFIG[step.type] || FALLBACK_STEP_CONFIG;
  const statusConfig = STATUS_CONFIG[step.status];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-xl border transition-all",
        "bg-card border-black/[0.06] dark:border-white/[0.06]",
        isExpanded &&
          "shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]",
        step.status === "running" && "ring-2 ring-blue-500/20"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors rounded-t-xl"
      >
        {/* Step number & type icon */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
              {index + 1}
            </span>
          </div>
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              typeConfig.bgColor
            )}
          >
            <TypeIcon className={cn("w-4 h-4", typeConfig.color)} />
          </div>
        </div>

        {/* Title & agent */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-foreground truncate">
              {step.title}
            </h4>
            <span
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-semibold rounded-md",
                typeConfig.bgColor,
                typeConfig.color
              )}
            >
              {typeConfig.label}
            </span>
          </div>
          {step.agentName && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {step.agentName}
            </p>
          )}
        </div>

        {/* Status & duration */}
        <div className="flex items-center gap-2 shrink-0">
          {step.duration && (
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
              {formatDuration(step.duration)}
            </span>
          )}
          <div className={cn("flex items-center gap-1", statusConfig.color)}>
            <StatusIcon
              className={cn(
                "w-3.5 h-3.5",
                step.status === "running" && "animate-spin"
              )}
            />
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-black/[0.04] dark:border-white/[0.04]"
          >
            <div className="p-4 space-y-3">
              {/* Content */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Details
                </label>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {step.content}
                </p>
              </div>

              {/* Metadata */}
              {step.metadata && Object.keys(step.metadata).length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Metadata
                  </label>
                  <div className="space-y-1.5">
                    {Object.entries(step.metadata).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start gap-2 text-[10px]"
                      >
                        <span className="font-semibold text-muted-foreground min-w-[80px] capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="text-foreground flex-1">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {step.timestamp.toLocaleTimeString()}
                </div>
                {step.duration && (
                  <div>
                    <span className="font-semibold">Duration:</span>{" "}
                    {formatDuration(step.duration)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Thought Trace Timeline ───────────────────────────────────── */

interface ThoughtTraceTimelineProps {
  steps: ThoughtTraceStep[];
  title?: string;
}

export function ThoughtTraceTimeline({
  steps,
  title = "Thought Process",
}: ThoughtTraceTimelineProps) {
  const totalDuration = steps.reduce(
    (acc, step) => acc + (step.duration || 0),
    0
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">{steps.length} steps</span>
          {totalDuration > 0 && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-foreground tabular-nums">
                {totalDuration < 1000
                  ? `${totalDuration}ms`
                  : `${(totalDuration / 1000).toFixed(2)}s`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <ThoughtTraceStepCard
            key={step.id}
            step={step}
            index={index}
            isLatest={index === steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export { ThoughtTraceStepCard };
