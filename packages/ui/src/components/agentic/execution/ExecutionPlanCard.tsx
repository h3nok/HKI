import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Target, Loader2, Check, X, Pause } from 'lucide-react';
import { cn } from '../../../utils';
import { ExecutionStepRow, type ExecutionStepData } from './ExecutionStepRow';

export type PlanStatus =
  | 'planning'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type ExecutionPlanData = {
  planId: string;
  goal: string;
  status: PlanStatus;
  totalSteps: number;
  completedSteps: number;
  steps: ExecutionStepData[];
  replanned?: boolean;
};

type ExecutionPlanCardProps = {
  plan: ExecutionPlanData;
  className?: string;
  defaultExpanded?: boolean;
};

const PLAN_STATUS_CONFIG: Record<
  PlanStatus,
  { icon: typeof Check; colorClass: string; bgClass: string; borderColorClass: string; label: string }
> = {
  planning: {
    icon: Loader2,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderColorClass: 'border-primary/20',
    label: 'Planning',
  },
  executing: {
    icon: Loader2,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderColorClass: 'border-primary/20',
    label: 'Executing',
  },
  paused: {
    icon: Pause,
    colorClass: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderColorClass: 'border-amber-500/20',
    label: 'Needs input',
  },
  completed: {
    icon: Check,
    colorClass: 'text-emerald-600 dark:text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderColorClass: 'border-emerald-500/20',
    label: 'Completed',
  },
  failed: {
    icon: X,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderColorClass: 'border-destructive/20',
    label: 'Failed',
  },
  aborted: {
    icon: X,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50',
    borderColorClass: 'border-border',
    label: 'Aborted',
  },
};

export function ExecutionPlanCard({
  plan,
  className,
  defaultExpanded = true,
}: ExecutionPlanCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = PLAN_STATUS_CONFIG[plan.status] || PLAN_STATUS_CONFIG.planning;
  const StatusIcon = config.icon;
  const isSpinning = plan.status === 'planning' || plan.status === 'executing';
  const progress = plan.totalSteps > 0 ? plan.completedSteps / plan.totalSteps : 0;

  // Determine progress ring color
  const progressColor =
    plan.status === 'completed'
      ? 'var(--success, #16a34a)'
      : plan.status === 'failed'
        ? 'var(--destructive)'
        : 'var(--primary, #005DAA)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl overflow-hidden shadow-lg border transition-all',
        config.borderColorClass,
        'bg-card',
        className
      )}
      data-component="ExecutionPlanCard"
    >
      {/* Background Underglow based on status */}
      <AnimatePresence>
        {isSpinning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none opacity-[0.03] bg-primary animate-pulse"
          />
        )}
      </AnimatePresence>

      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors relative z-10 hover:bg-black/5 dark:hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-expanded={expanded}
        aria-label={`${plan.goal}: ${config.label}. ${plan.completedSteps} of ${plan.totalSteps} steps.`}
      >
        {/* Plan icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border',
            config.bgClass,
            config.borderColorClass
          )}
        >
          <Target className={cn('w-5 h-5', config.colorClass)} />
        </div>

        {/* Goal + status */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[14px] font-bold truncate tracking-wide text-foreground/90 uppercase"
            >
              {plan.goal}
            </span>
            {plan.replanned && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-bold uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20"
              >
                Replanned
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn('w-3.5 h-3.5', isSpinning && 'animate-spin', config.colorClass)}
            />
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', config.colorClass)}>
              {config.label}
            </span>
            <span
              className="text-[11px] font-medium tracking-wide text-muted-foreground/70"
            >
              · {plan.completedSteps}/{plan.totalSteps} steps
            </span>
          </div>
        </div>

        {/* Progress ring */}
        <div className="relative w-10 h-10 shrink-0 pointer-events-none">
          {/* Subtle gradient glow behind the ring if spinning in primary state */}
          {isSpinning && (
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          )}
          <svg className="w-10 h-10 -rotate-90 relative z-10" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              strokeWidth="2.5"
              stroke="var(--muted)"
              opacity={0.3}
            />
            <motion.circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              stroke={progressColor}
              strokeDasharray={2 * Math.PI * 13}
              initial={{ strokeDashoffset: 2 * Math.PI * 13 }}
              animate={{
                strokeDashoffset: 2 * Math.PI * 13 * (1 - progress),
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground/80 z-20"
          >
            {Math.round(progress * 100)}
          </span>
        </div>

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="w-5 h-5 shrink-0 text-muted-foreground/60 ml-1" />
        ) : (
          <ChevronDown className="w-5 h-5 shrink-0 text-muted-foreground/60 ml-1" />
        )}
      </button>

      {/* Steps — expandable */}
      <AnimatePresence initial={false}>
        {expanded && plan.steps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-muted/30 border-t border-border/50 relative z-10"
          >
            <div className="px-3 pb-4 pt-2 space-y-1">
              {plan.steps.map((step, i) => (
                <ExecutionStepRow
                  key={step.stepId}
                  step={step}
                  index={i}
                  total={plan.steps.length}
                  isActive={
                    step.status === 'executing' || step.status === 'verifying'
                  }
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
