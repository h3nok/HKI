import { motion } from 'framer-motion';
import {
  Check,
  Loader2,
  X,
  SkipForward,
  RotateCcw,
  Search,
  Clock,
} from 'lucide-react';
import { cn } from '../../../utils';

export type StepStatus =
  | 'planned'
  | 'executing'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'rolled_back';

export type ExecutionStepData = {
  stepId: string;
  toolName: string;
  description: string;
  status: StepStatus;
  durationMs?: number;
  error?: string | null;
  verification?: {
    passed: boolean;
    schema_valid: boolean;
    reasoning: string;
  } | null;
};

type ExecutionStepRowProps = {
  step: ExecutionStepData;
  index: number;
  total: number;
  isActive?: boolean;
};

const STATUS_CONFIG: Record<
  StepStatus,
  { icon: typeof Check; color: string; bgColor: string; label: string }
> = {
  planned: {
    icon: Clock,
    color: 'var(--muted-foreground)',
    bgColor: 'var(--muted)',
    label: 'Planned',
  },
  executing: {
    icon: Loader2,
    color: 'var(--primary, #005DAA)',
    bgColor: 'color-mix(in srgb, var(--primary, #005DAA) 10%, transparent)',
    label: 'Executing',
  },
  verifying: {
    icon: Search,
    color: 'var(--warning, #d97706)',
    bgColor: 'color-mix(in srgb, var(--warning, #d97706) 10%, transparent)',
    label: 'Verifying',
  },
  succeeded: {
    icon: Check,
    color: 'var(--success, #16a34a)',
    bgColor: 'color-mix(in srgb, var(--success, #16a34a) 10%, transparent)',
    label: 'Done',
  },
  failed: {
    icon: X,
    color: 'var(--destructive)',
    bgColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
    label: 'Failed',
  },
  skipped: {
    icon: SkipForward,
    color: 'var(--muted-foreground)',
    bgColor: 'color-mix(in srgb, var(--muted) 30%, transparent)',
    label: 'Skipped',
  },
  rolled_back: {
    icon: RotateCcw,
    color: 'var(--warning, #d97706)',
    bgColor: 'color-mix(in srgb, var(--warning, #d97706) 10%, transparent)',
    label: 'Rolled back',
  },
};

export function ExecutionStepRow({
  step,
  index,
  total,
  isActive = false,
}: ExecutionStepRowProps) {
  const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.planned;
  const Icon = config.icon;
  const isSpinning = step.status === 'executing' || step.status === 'verifying';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors',
      )}
      style={{
        background: isActive
          ? 'color-mix(in srgb, var(--card) 80%, transparent)'
          : step.status === 'failed'
          ? 'color-mix(in srgb, var(--destructive) 5%, transparent)'
          : 'transparent',
        boxShadow: isActive ? '0 0 0 1px color-mix(in srgb, var(--border) 50%, transparent)' : 'none',
      }}
    >
      {/* Status icon + connector line */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: config.bgColor }}
        >
          <Icon
            className={cn('w-3.5 h-3.5', isSpinning && 'animate-spin')}
            style={{ color: config.color }}
          />
        </div>
        {index < total - 1 && (
          <div
            className="w-px flex-1 min-h-[12px] mt-1"
            style={{
              background: step.status === 'succeeded'
                ? 'color-mix(in srgb, var(--success, #16a34a) 30%, transparent)'
                : 'color-mix(in srgb, var(--border) 50%, transparent)',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[13px] font-medium truncate"
            style={{
              color:
                step.status === 'failed'
                  ? 'var(--destructive)'
                  : 'var(--foreground)',
              opacity: step.status === 'planned' ? 0.7 : 1,
            }}
          >
            {step.description}
          </span>

          {/* Duration badge */}
          {step.durationMs != null && step.durationMs > 0 && (
            <span
              className="text-[11px] tabular-nums shrink-0"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {step.durationMs < 1000
                ? `${Math.round(step.durationMs)}ms`
                : `${(step.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>

        {/* Tool name */}
        <span
          className="text-[11px]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {step.toolName.replace(/_/g, ' ')}
        </span>

        {/* Error message */}
        {step.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[11px] mt-1 leading-tight"
            style={{ color: 'var(--destructive)', opacity: 0.8 }}
          >
            {step.error}
          </motion.p>
        )}

        {/* Verification reasoning (on failure) */}
        {step.verification && !step.verification.passed && step.verification.reasoning && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] mt-0.5 leading-tight"
            style={{ color: 'var(--warning, #d97706)', opacity: 0.8 }}
          >
            {step.verification.reasoning}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
