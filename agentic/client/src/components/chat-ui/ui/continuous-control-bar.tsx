/**
 * ContinuousControlBar — Defensive Principle #6
 *
 * Provides pause / cancel / edit / take-over controls that appear above the
 * prompt input while the agent is actively executing. Ensures the user can
 * intervene at any point during an agentic workflow.
 *
 * Renders as a slim bar between the message area and the input capsule.
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Square,
  Edit3,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { cn } from '@hki/ui';

// ── Types ───────────────────────────────────────────────────────────────

export type AgentExecutionPhase =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'generating';

export interface ContinuousControlBarProps {
  /** Current execution phase — hidden when idle */
  phase: AgentExecutionPhase;
  /** Number of steps completed so far */
  stepsCompleted?: number;
  /** Total steps in plan (if known) */
  totalSteps?: number;
  /** Current step description */
  currentStep?: string;
  onPause?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onTakeOver?: () => void;
  className?: string;
}

// ── Phase config ────────────────────────────────────────────────────────

const phaseConfig = {
  idle: { label: '', color: 'transparent' },
  thinking: { label: 'Agent is thinking', color: 'var(--primary)' },
  planning: { label: 'Creating action plan', color: 'var(--warning, #d97706)' },
  executing: { label: 'Executing tools', color: 'var(--primary)' },
  generating: { label: 'Generating response', color: 'var(--success, #16a34a)' },
};

// ── Component ───────────────────────────────────────────────────────────

export function ContinuousControlBar({
  phase,
  stepsCompleted,
  totalSteps,
  currentStep,
  onPause,
  onCancel,
  onEdit,
  onTakeOver,
  className,
}: ContinuousControlBarProps) {
  if (phase === 'idle') return null;

  const config = phaseConfig[phase];
  const progress =
    totalSteps && totalSteps > 0 && stepsCompleted !== undefined
      ? Math.round((stepsCompleted / totalSteps) * 100)
      : undefined;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: 8, height: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn('w-full', className)}
      >
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl"
          style={{
            background: `color-mix(in srgb, ${config.color} 8%, var(--card))`,
            border: `1px solid color-mix(in srgb, ${config.color} 20%, var(--border))`,
          }}
        >
          {/* Spinner + phase label */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: config.color }}>
                {config.label}
              </span>
              {currentStep && (
                <span className="text-[11px] ml-2 truncate" style={{ color: 'var(--muted-foreground)' }}>
                  — {currentStep}
                </span>
              )}
            </div>

            {/* Progress */}
            {progress !== undefined && (
              <span
                className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
                  color: config.color,
                }}
              >
                {stepsCompleted}/{totalSteps}
              </span>
            )}
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {onPause && (
              <ControlButton
                icon={Pause}
                label="Pause"
                onClick={onPause}
                color={config.color}
              />
            )}
            {onEdit && (
              <ControlButton
                icon={Edit3}
                label="Edit plan"
                onClick={onEdit}
                color={config.color}
              />
            )}
            {onTakeOver && (
              <ControlButton
                icon={UserCheck}
                label="Take over"
                onClick={onTakeOver}
                color="var(--primary)"
                variant="primary"
              />
            )}
            {onCancel && (
              <ControlButton
                icon={Square}
                label="Stop"
                onClick={onCancel}
                color="var(--destructive)"
                variant="danger"
              />
            )}
          </div>
        </div>

        {/* Progress bar */}
        {progress !== undefined && (
          <div
            className="h-0.5 mt-0.5 rounded-full overflow-hidden"
            style={{ background: 'var(--muted)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: config.color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Sub-component ───────────────────────────────────────────────────────

function ControlButton({
  icon: Icon,
  label,
  onClick,
  color,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  color: string;
  variant?: 'primary' | 'danger';
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-lg transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{
        width: 28,
        height: 28,
        background: variant
          ? `color-mix(in srgb, ${color} 12%, transparent)`
          : 'transparent',
        color,
      }}
      title={label}
      aria-label={label}
    >
      <Icon className="w-3.5 h-3.5" />
    </motion.button>
  );
}
