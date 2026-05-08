/**
 * AgentPlanCard — Explain-Before-Action (Defensive Principle #5)
 *
 * Renders a preview of the agent's planned actions BEFORE execution.
 * The user can Approve, Edit, or Reject the plan.
 *
 * This surfaces when the agent emits a tool_request. Instead of silently
 * executing, the plan is shown with expected impact so the user can make
 * an informed decision.
 *
 * Defensive principles:
 *  - Explicit intent: user sees what the agent WILL do
 *  - Continuous control: approve / edit / reject
 *  - Scoped autonomy: user decides scope of execution
 */

import { useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  CheckCircle2,
  XCircle,
  Edit3,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@hki/ui";

// ── Types ───────────────────────────────────────────────────────────────

export interface PlannedStep {
  id: string;
  toolName: string;
  description: string;
  /** What the agent expects will happen */
  expectedImpact?: string;
  /** Risk level for the step */
  risk: "low" | "medium" | "high";
  arguments?: Record<string, unknown>;
}

export interface AgentPlanCardProps {
  steps: PlannedStep[];
  title?: string;
  /** Called when user approves the plan */
  onApprove: () => void;
  /** Called when user rejects the plan */
  onReject: () => void;
  /** Called when user wants to edit the plan */
  onEdit?: () => void;
  /** Whether the plan is currently executing */
  isExecuting?: boolean;
  className?: string;
}

// ── Risk config ─────────────────────────────────────────────────────────

const riskConfig = {
  low: {
    color: "var(--success, #16a34a)",
    bgColor: "color-mix(in srgb, var(--success, #16a34a) 10%, transparent)",
    label: "Low Risk",
  },
  medium: {
    color: "var(--primary)",
    bgColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
    label: "Medium",
  },
  high: {
    color: "var(--destructive)",
    bgColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    label: "High Risk",
  },
};

// ── Component ───────────────────────────────────────────────────────────

export function AgentPlanCard({
  steps,
  title = "Proposed Action Plan",
  onApprove,
  onReject,
  onEdit,
  isExecuting = false,
  className,
}: AgentPlanCardProps) {
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = useCallback((id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const highestRisk = steps.reduce(
    (max, s) => {
      const order = { low: 0, medium: 1, high: 2 };
      return order[s.risk] > order[max] ? s.risk : max;
    },
    "low" as PlannedStep["risk"]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      role="group"
      aria-label={title}
      data-highest-risk={highestRisk}
      data-executing={isExecuting ? "true" : "false"}
      className={cn("rounded-xl border overflow-hidden", className)}
      style={{
        background: "var(--card)",
        borderColor: `color-mix(in srgb, var(--primary) 30%, var(--border))`,
        boxShadow:
          "0 0 0 1px color-mix(in srgb, var(--primary) 10%, transparent), 0 4px 16px -4px color-mix(in srgb, var(--neutral-900) 8%, transparent)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center gap-3 p-3.5 transition-colors"
        style={{
          background: "color-mix(in srgb, var(--primary) 5%, transparent)",
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
          }}
        >
          <Zap className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1 text-left">
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h4>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {steps.length} step{steps.length !== 1 ? "s" : ""} •{" "}
            <span style={{ color: riskConfig[highestRisk].color }}>
              {riskConfig[highestRisk].label}
            </span>
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
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
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-2 space-y-1.5"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {steps.map((step, index) => {
                const risk = riskConfig[step.risk];
                const isOpen = expandedSteps.has(step.id);

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    data-risk={step.risk}
                    className="rounded-lg border transition-colors mt-1.5"
                    style={{
                      background: isOpen
                        ? "color-mix(in srgb, var(--muted) 30%, transparent)"
                        : "transparent",
                      borderColor: "var(--border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-2.5 p-2.5 text-left"
                    >
                      {/* Step number */}
                      <span
                        className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0"
                        style={{ background: risk.bgColor, color: risk.color }}
                      >
                        {index + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {step.toolName}
                          </span>
                          {step.risk !== "low" && (
                            <AlertTriangle
                              className="w-3 h-3 shrink-0"
                              style={{ color: risk.color }}
                            />
                          )}
                        </div>
                        <p
                          className="text-[11px] truncate"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {step.description}
                        </p>
                      </div>

                      <ChevronRight
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform",
                          isOpen && "rotate-90"
                        )}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    </button>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 space-y-2">
                            {step.expectedImpact && (
                              <div
                                className="flex items-start gap-2 p-2 rounded-md text-xs"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--primary) 5%, transparent)",
                                  border:
                                    "1px dashed color-mix(in srgb, var(--primary) 20%, var(--border))",
                                }}
                              >
                                <ArrowRight
                                  className="w-3 h-3 mt-0.5 shrink-0"
                                  style={{ color: "var(--primary)" }}
                                />
                                <span
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  <strong
                                    style={{ color: "var(--foreground)" }}
                                  >
                                    Expected:{" "}
                                  </strong>
                                  {step.expectedImpact}
                                </span>
                              </div>
                            )}
                            {step.arguments &&
                              Object.keys(step.arguments).length > 0 && (
                                <pre className="text-[11px] p-2 rounded-md overflow-x-auto bg-muted text-muted-foreground">
                                  {JSON.stringify(step.arguments, null, 2)}
                                </pre>
                              )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div
              className="flex items-center gap-2 p-3.5"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={onApprove}
                disabled={isExecuting}
                aria-label={
                  isExecuting ? "Plan is executing" : "Approve and run plan"
                }
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isExecuting && "opacity-50 cursor-not-allowed"
                )}
                style={{
                  background: "var(--primary)",
                  color: "white",
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isExecuting ? "Executing..." : "Approve & Run"}
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={isExecuting}
                  aria-label="Edit proposed plan"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "transparent",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={onReject}
                disabled={isExecuting}
                aria-label="Reject proposed plan"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:
                    "color-mix(in srgb, var(--destructive) 10%, transparent)",
                  color: "var(--destructive)",
                }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
