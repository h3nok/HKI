/**
 * ReasoningCard - Agent Chain-of-Thought Display
 *
 * Shows agent's reasoning process with:
 * - Step-by-step thought display with animated timeline
 * - Collapsible reasoning chain with spring physics
 * - Branded step indicators with confidence bars
 * - CSS variable theming for light/dark mode
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  Lightbulb,
  Target,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "../../../utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ReasoningStep {
  id: string;
  type: "observation" | "thought" | "decision" | "conclusion";
  content: string;
  confidence?: number; // 0-1
}

export interface ReasoningCardProps {
  steps: ReasoningStep[];
  title?: string;
  isExpanded?: boolean;
  /** Show animated confidence micro-bars */
  showConfidence?: boolean;
  className?: string;
}

// ============================================================================
// BRAND COLORS
// ============================================================================

const HKI_IRIS = "#005DAA";

// ============================================================================
// CONFIG
// ============================================================================

const stepConfig = {
  observation: {
    icon: Target,
    label: "Observation",
    color: "var(--info, #0284c7)",
    accentHex: "#0284c7",
  },
  thought: {
    icon: Brain,
    label: "Thought",
    color: `var(--primary, ${HKI_IRIS})`,
    accentHex: HKI_IRIS,
  },
  decision: {
    icon: Lightbulb,
    label: "Decision",
    color: "var(--warning, #d97706)",
    accentHex: "#d97706",
  },
  conclusion: {
    icon: CheckCircle2,
    label: "Conclusion",
    color: "var(--success, #16a34a)",
    accentHex: "#16a34a",
  },
};

// ============================================================================
// CONFIDENCE BAR — micro-visualization
// ============================================================================

function ConfidenceMicroBar({
  value,
  color,
  delay,
}: {
  value: number;
  color: string;
  delay: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1 w-12 rounded-full overflow-hidden"
        style={{ background: "var(--muted, #e5e7eb)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{
            duration: 0.5,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </div>
      <span
        className="text-[9px] font-bold tabular-nums"
        style={{ color, opacity: 0.8 }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReasoningCard({
  steps,
  title = "Agent Reasoning",
  isExpanded: defaultExpanded = false,
  showConfidence = true,
  className = "",
}: ReasoningCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Summary: dominant step type
  const conclusionStep = steps.find((s) => s.type === "conclusion");
  const avgConfidence =
    steps.filter((s) => s.confidence !== undefined).length > 0
      ? steps.reduce((sum, s) => sum + (s.confidence ?? 0), 0) /
        steps.filter((s) => s.confidence !== undefined).length
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl overflow-hidden", className)}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow:
          "0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3.5 transition-colors group"
        style={{
          background: isExpanded
            ? `color-mix(in srgb, var(--primary, ${HKI_IRIS}) 4%, var(--card))`
            : "transparent",
        }}
        aria-expanded={isExpanded}
        aria-label={`${title}: ${steps.length} reasoning steps`}
      >
        {/* Icon container with subtle gradient */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, var(--primary, ${HKI_IRIS}) 15%, transparent), color-mix(in srgb, var(--primary, ${HKI_IRIS}) 8%, transparent))`,
            border: `1px solid color-mix(in srgb, var(--primary, ${HKI_IRIS}) 20%, var(--border))`,
          }}
        >
          <Brain
            className="w-4 h-4"
            style={{ color: `var(--primary, ${HKI_IRIS})` }}
          />
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h4
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {title}
            </h4>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {steps.length} step{steps.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Collapsed summary */}
          {!isExpanded && conclusionStep && (
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              {conclusionStep.content}
            </p>
          )}
        </div>

        {/* Confidence pill (collapsed only) */}
        {!isExpanded && avgConfidence !== undefined && (
          <span
            className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background:
                avgConfidence >= 0.8
                  ? "color-mix(in srgb, var(--success, #16a34a) 12%, transparent)"
                  : avgConfidence >= 0.5
                    ? "color-mix(in srgb, var(--warning, #d97706) 12%, transparent)"
                    : "color-mix(in srgb, var(--destructive) 12%, transparent)",
              color:
                avgConfidence >= 0.8
                  ? "var(--success, #16a34a)"
                  : avgConfidence >= 0.5
                    ? "var(--warning, #d97706)"
                    : "var(--destructive)",
            }}
          >
            {Math.round(avgConfidence * 100)}%
          </span>
        )}

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0"
        >
          <ChevronDown
            className="w-4 h-4"
            style={{ color: "var(--muted-foreground)" }}
          />
        </motion.div>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.2 },
            }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3.5 pt-1 space-y-0"
              style={{
                borderTop: "1px solid var(--border)",
              }}
            >
              {steps.map((step, index) => {
                const config = stepConfig[step.type];
                const Icon = config.icon;
                const isLast = index === steps.length - 1;
                const isConclusion = step.type === "conclusion";

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: index * 0.06,
                      duration: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="relative flex gap-3"
                    style={{
                      paddingLeft: 2,
                      paddingTop: index === 0 ? 8 : 0,
                    }}
                  >
                    {/* Timeline track */}
                    <div className="flex flex-col items-center shrink-0">
                      {/* Node */}
                      <motion.div
                        className="flex items-center justify-center w-7 h-7 rounded-lg z-10"
                        style={{
                          background: isConclusion
                            ? `color-mix(in srgb, ${config.color} 20%, var(--card))`
                            : `color-mix(in srgb, ${config.color} 12%, var(--card))`,
                          border: `1.5px solid color-mix(in srgb, ${config.color} 35%, var(--border))`,
                          boxShadow: isConclusion
                            ? `0 0 8px color-mix(in srgb, ${config.color} 15%, transparent)`
                            : "none",
                        }}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: index * 0.06,
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: config.color }}
                        />
                      </motion.div>

                      {/* Connector line */}
                      {!isLast && (
                        <motion.div
                          className="w-[1.5px] flex-1 min-h-[12px]"
                          style={{
                            background: `linear-gradient(to bottom, color-mix(in srgb, ${config.color} 30%, var(--border)), color-mix(in srgb, var(--border) 100%, transparent))`,
                          }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{
                            delay: index * 0.06 + 0.15,
                            duration: 0.25,
                          }}
                          style-origin="top"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className={cn(
                        "flex-1 pb-3",
                        isConclusion && "rounded-lg px-2.5 py-2 -ml-0.5",
                      )}
                      style={
                        isConclusion
                          ? {
                              background: `color-mix(in srgb, ${config.color} 5%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${config.color} 15%, var(--border))`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: config.color }}
                        >
                          {config.label}
                        </span>
                        {isConclusion && (
                          <ArrowRight
                            className="w-3 h-3"
                            style={{
                              color: config.color,
                              opacity: 0.6,
                            }}
                          />
                        )}
                      </div>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--foreground)" }}
                      >
                        {step.content}
                      </p>
                      {showConfidence && step.confidence !== undefined && (
                        <div className="mt-1.5">
                          <ConfidenceMicroBar
                            value={step.confidence}
                            color={config.color}
                            delay={index * 0.06 + 0.2}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// INLINE REASONING — branded callout
// ============================================================================

export function InlineReasoning({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-2.5 p-3 rounded-xl", className)}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--primary, ${HKI_IRIS}) 4%, var(--card)), color-mix(in srgb, var(--primary, ${HKI_IRIS}) 2%, var(--card)))`,
        border: `1px solid color-mix(in srgb, var(--primary, ${HKI_IRIS}) 18%, var(--border))`,
        boxShadow: `0 1px 4px color-mix(in srgb, var(--primary, ${HKI_IRIS}) 6%, transparent)`,
      }}
    >
      <div
        className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 mt-0.5"
        style={{
          background: `color-mix(in srgb, var(--primary, ${HKI_IRIS}) 12%, transparent)`,
        }}
      >
        <Sparkles
          className="w-3 h-3"
          style={{ color: `var(--primary, ${HKI_IRIS})` }}
        />
      </div>
      <p
        className="text-xs italic leading-relaxed"
        style={{
          color: `color-mix(in srgb, var(--foreground) 85%, var(--primary, ${HKI_IRIS}))`,
        }}
      >
        {content}
      </p>
    </motion.div>
  );
}
