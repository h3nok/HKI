import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, SkipForward, XCircle, Check } from 'lucide-react';
import { cn } from '../../../utils';

export type InterventionAction = 'retry' | 'retry_modified' | 'skip' | 'abort';

export type InterventionData = {
  planId: string;
  failedStepId: string;
  error: string;
  context: string;
  completedSteps: string[];
  scratchpadSummary: Record<string, unknown>;
  availableActions: InterventionAction[];
};

type InterventionCardProps = {
  intervention: InterventionData;
  onAction: (action: InterventionAction) => void;
  className?: string;
};

const ACTION_CONFIG: Record<
  InterventionAction,
  {
    icon: typeof Check;
    label: string;
    textColorClass: string;
    bgClass: string;
    borderColorClass: string;
    hoverBgClass: string;
  }
> = {
  retry: {
    icon: RotateCcw,
    label: 'Retry',
    textColorClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderColorClass: 'border-primary/20',
    hoverBgClass: 'hover:bg-primary/20',
  },
  retry_modified: {
    icon: RotateCcw,
    label: 'Approve & Retry',
    textColorClass: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderColorClass: 'border-amber-500/20',
    hoverBgClass: 'hover:bg-amber-500/20',
  },
  skip: {
    icon: SkipForward,
    label: 'Skip & Continue',
    textColorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50',
    borderColorClass: 'border-muted/60',
    hoverBgClass: 'hover:bg-muted/80 hover:text-foreground',
  },
  abort: {
    icon: XCircle,
    label: 'Abort Context',
    textColorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderColorClass: 'border-destructive/20',
    hoverBgClass: 'hover:bg-destructive/20',
  },
};

export function InterventionCard({
  intervention,
  onAction,
  className,
}: InterventionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl overflow-hidden shadow-xl border bg-card/60 backdrop-blur-3xl relative',
        'border-amber-500/30',
        className
      )}
      role="alert"
      aria-label="Agent requests human intervention"
    >
      {/* Ambient Warning Glow */}
      <motion.div
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/20 bg-amber-500/5 relative z-10"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/20 shadow-inner border border-amber-500/30 shrink-0"
        >
          <AlertTriangle
            className="w-4 h-4 text-amber-600 dark:text-amber-500"
            strokeWidth={2.5}
          />
        </motion.div>
        <div className="flex-1 min-w-0">
          <span
            className="text-[13px] font-extrabold uppercase tracking-widest text-foreground"
          >
            Human Intervention Required
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 relative z-10">
        {/* Error message */}
        <p
          className="text-[13px] leading-relaxed font-bold text-destructive/90 pl-3 border-l-2 border-destructive/40"
        >
          {intervention.error}
        </p>

        {/* Context */}
        {intervention.context && (
          <p
            className="text-[12px] leading-relaxed font-medium text-foreground/70"
          >
            {intervention.context}
          </p>
        )}

        {/* Completed steps */}
        {intervention.completedSteps.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-border/40">
            <span
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
            >
              System Operations Trace
            </span>
            <div className="space-y-1.5 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/20">
              {intervention.completedSteps.map((desc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="p-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <Check
                      className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-500"
                      strokeWidth={3}
                    />
                  </div>
                  <span
                    className="text-[12px] font-medium tracking-wide truncate text-foreground/80"
                  >
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="px-5 py-4 flex flex-wrap gap-2.5 bg-muted/10 border-t border-border/40 relative z-10"
      >
        {intervention.availableActions.map((action) => {
          const cfg = ACTION_CONFIG[action];
          if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <button
              key={action}
              onClick={() => onAction(action)}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-extrabold tracking-wider transition-all duration-300 border shadow-sm outline-none focus-visible:ring-2',
                cfg.textColorClass,
                cfg.bgClass,
                cfg.borderColorClass,
                cfg.hoverBgClass
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={2.5} />
              {cfg.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
