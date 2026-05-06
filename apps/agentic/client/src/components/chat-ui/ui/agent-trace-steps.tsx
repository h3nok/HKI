/**
 * AgentTraceSteps — Inline collapsible trace steps shown in the chat flow.
 *
 * Renders the agent's reasoning process (routing, thinking, tool calls,
 * reflection) as a compact, animated timeline directly below the thinking
 * indicator. Gives users visible evidence that the agent is *working*,
 * not just waiting.
 *
 * Two modes:
 *   • Streaming: steps appear one-by-one with slide-in animation
 *   • Completed: collapsed by default, expandable on click
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  GitBranch,
  Brain,
  Wrench,
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Clock,
  Database,
  Layers,
} from "lucide-react";
import type { TraceStep } from "../hooks/use-streaming-state";

// ── Step type → icon + label mapping ─────────────────────────────────────

const STEP_CONFIG: Record<
  string,
  { icon: typeof Brain; label: string; color: string }
> = {
  guardrail: { icon: Shield, label: "Safety check", color: "text-emerald-500" },
  routing: { icon: GitBranch, label: "Agent routing", color: "text-blue-500" },
  prompt_stack: { icon: Layers, label: "Prompt stack", color: "text-sky-500" },
  memory_recall: {
    icon: Database,
    label: "Memory recall",
    color: "text-violet-500",
  },
  thinking: { icon: Brain, label: "Reasoning", color: "text-primary" },
  planning: { icon: Sparkles, label: "Planning", color: "text-cyan-500" },
  tool_call: { icon: Wrench, label: "Tool call", color: "text-primary" },
  tool_result: {
    icon: CheckCircle2,
    label: "Tool result",
    color: "text-emerald-500",
  },
  knowledge_retrieval: {
    icon: BookOpen,
    label: "Knowledge search",
    color: "text-indigo-500",
  },
  reflecting: {
    icon: Sparkles,
    label: "Synthesizing",
    color: "text-purple-500",
  },
  memory_store: {
    icon: Database,
    label: "Memory update",
    color: "text-violet-400",
  },
  cache_hit: { icon: Clock, label: "Cache hit", color: "text-green-500" },
};

const DEFAULT_CONFIG = {
  icon: Brain,
  label: "Working",
  color: "text-muted-foreground",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatStepContent(step: TraceStep): string {
  const { type, content, metadata } = step;

  // Provide richer descriptions for specific event types
  if (type === "tool_call" && metadata?.tool) {
    return `Calling ${metadata.tool.replace(/_/g, " ")}`;
  }
  if (type === "tool_result" && metadata?.duration_ms) {
    const dur = Math.round(metadata.duration_ms);
    return `${content} (${dur}ms)`;
  }
  if (type === "routing" && metadata?.routed_to) {
    return `Routing to ${metadata.routed_to} agent`;
  }
  if (type === "guardrail" && metadata?.report) {
    return metadata.report.passed
      ? "Input validated — safe to proceed"
      : "Input flagged by safety check";
  }
  if (type === "memory_recall" && metadata?.total_memories != null) {
    return `Recalled ${metadata.total_memories} relevant memories`;
  }
  if (type === "prompt_stack" && metadata?.summary) {
    const source = String(
      metadata.summary.domain_prompt_source || "runtime"
    ).replace(/_/g, " ");
    return `Prepared layered prompt stack (${source})`;
  }

  return content;
}

// ── Components ───────────────────────────────────────────────────────────

interface AgentTraceStepsProps {
  steps: TraceStep[];
  /** Whether the agent is still streaming (steps appearing live) */
  isStreaming: boolean;
  className?: string;
}

export function AgentTraceSteps({
  steps,
  isStreaming,
  className = "",
}: AgentTraceStepsProps) {
  // Filter out internal/noise steps for a cleaner inline view
  const visibleSteps = useMemo(
    () =>
      steps.filter(
        s => s.type !== "final_response" && s.type !== "memory_store"
      ),
    [steps]
  );

  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-collapse when streaming ends (user can re-expand)
  const wasStreamingRef = useMemo(() => ({ current: isStreaming }), []);
  if (wasStreamingRef.current && !isStreaming && visibleSteps.length > 0) {
    wasStreamingRef.current = false;
    // Don't auto-collapse — keep expanded so user sees the full trace
  }

  if (visibleSteps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`w-full ${className}`}
    >
      {/* Header — toggle collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-muted-foreground transition-colors mb-1 select-none"
      >
        <motion.span
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="w-3 h-3" />
        </motion.span>
        <span>
          {isStreaming
            ? `Agent working — ${visibleSteps.length} step${visibleSteps.length !== 1 ? "s" : ""}…`
            : `${visibleSteps.length} reasoning step${visibleSteps.length !== 1 ? "s" : ""}`}
        </span>
        {isStreaming && (
          <span className="relative flex h-1.5 w-1.5 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
        )}
      </button>

      {/* Steps timeline */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col pl-1 border-l border-border/40 ml-1 space-y-0.5">
              {visibleSteps.map((step, i) => (
                <TraceStepRow
                  key={`${step.type}-${i}`}
                  step={step}
                  index={i}
                  isLast={i === visibleSteps.length - 1}
                  isStreaming={isStreaming}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Single step row ──────────────────────────────────────────────────────

function TraceStepRow({
  step,
  index,
  isLast,
  isStreaming,
}: {
  step: TraceStep;
  index: number;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const config = STEP_CONFIG[step.type] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const label = formatStepContent(step);

  // Show a subtle "in progress" state for the last step during streaming
  const isActive = isLast && isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.03 }}
      className={`flex items-center gap-2 py-0.5 pl-3 text-[12px] ${
        isActive ? "text-foreground/80" : "text-muted-foreground/70"
      }`}
    >
      <Icon
        className={`w-3 h-3 shrink-0 ${isActive ? config.color : "text-muted-foreground/50"}`}
      />
      <span className={`truncate ${isActive ? "font-medium" : ""}`}>
        {label}
      </span>
      {isActive && (
        <span className="relative flex h-1 w-1 ml-0.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
          <span className="relative inline-flex rounded-full h-1 w-1 bg-current" />
        </span>
      )}
    </motion.div>
  );
}
