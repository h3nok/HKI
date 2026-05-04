/**
 * JourneyProgressBar — Compact sidebar widget showing onboarding progress
 *
 * Displays a slim progress bar + text showing N/6 steps complete.
 * Pulses the current step indicator. Collapses to just the ring when
 * the sidebar is collapsed.
 */

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { cn } from "@hki/ui";
import { k, ACCENT } from "../theme";
import type { JourneyProgress } from "../hooks/useJourneyProgress";

const TOTAL_STEPS = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

interface JourneyProgressBarProps {
  journey: JourneyProgress;
  collapsed?: boolean;
}

export default function JourneyProgressBar({
  journey,
  collapsed = false,
}: JourneyProgressBarProps) {
  const { doneCount, currentStep } = journey;
  const pct = (doneCount / TOTAL_STEPS) * 100;
  const allDone = doneCount >= TOTAL_STEPS;

  if (collapsed) {
    // Compact ring view
    return (
      <div className="flex flex-col items-center px-2 py-2">
        <div className="relative w-8 h-8">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            className="-rotate-90"
          >
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              strokeWidth="2.5"
              className="stroke-muted/30"
            />
            <motion.circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              stroke={allDone ? "#16A34A" : ACCENT}
              strokeDasharray={2 * Math.PI * 13}
              initial={{ strokeDashoffset: 2 * Math.PI * 13 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 13 * (1 - pct / 100) }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-foreground tabular-nums">
            {doneCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("px-4 py-3")}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {allDone ? (
            <Sparkles className="w-3 h-3 text-amber-500" />
          ) : (
            <Circle className="w-3 h-3 text-primary" />
          )}
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            {allDone ? "Complete" : "Journey"}
          </span>
        </div>
        <span className={cn(k.mono, "text-xs font-bold text-foreground")}>
          {doneCount}/{TOTAL_STEPS}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: allDone
              ? "linear-gradient(90deg, #16A34A, #059669)"
              : `linear-gradient(90deg, ${ACCENT}, ${ACCENT}CC)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>

      {/* Current step hint */}
      {currentStep && !allDone && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-1.5 flex items-center gap-1.5"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-xs text-muted-foreground truncate">
            Next: {currentStep.label}
          </span>
        </motion.div>
      )}

      {allDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-1.5 flex items-center gap-1"
        >
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Agent is ready
          </span>
        </motion.div>
      )}
    </div>
  );
}
