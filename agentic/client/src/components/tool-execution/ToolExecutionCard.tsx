/**
 * Tool Execution Card
 * Visual representation of tool calls with status, input/output, and timeline
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Copy,
  RefreshCw,
  AlertCircle,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@hki/ui';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────────── */

export interface ToolExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input: Record<string, any>;
  output?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // ms
}

interface ToolExecutionCardProps {
  execution: ToolExecution;
  onRetry?: (id: string) => void;
}

/* ── Status Config ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  ToolExecution['status'],
  { icon: LucideIcon; label: string; color: string; bgColor: string }
> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  running: {
    icon: RefreshCw,
    label: 'Running',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  success: {
    icon: CheckCircle2,
    label: 'Success',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  error: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

/* ── Component ────────────────────────────────────────────────── */

export default function ToolExecutionCard({
  execution,
  onRetry,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = STATUS_CONFIG[execution.status];
  const StatusIcon = config.icon;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border transition-all',
        'bg-card border-black/[0.06] dark:border-white/[0.06]',
        isExpanded && 'shadow-sm'
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors rounded-t-xl"
      >
        {/* Tool icon */}
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            config.bgColor
          )}
        >
          <Wrench className={cn('w-4 h-4', config.color)} />
        </div>

        {/* Tool name & status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {execution.name}
            </h4>
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                config.bgColor,
                config.color
              )}
            >
              <StatusIcon
                className={cn(
                  'w-3 h-3',
                  execution.status === 'running' && 'animate-spin'
                )}
              />
              {config.label}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {execution.duration
              ? `${formatDuration(execution.duration)}`
              : execution.status === 'running'
              ? 'In progress...'
              : 'Queued'}
          </p>
        </div>

        {/* Expand indicator */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform shrink-0',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-black/[0.04] dark:border-white/[0.04]"
          >
            <div className="p-4 space-y-4">
              {/* Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Input
                  </label>
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(execution.input, null, 2), 'Input')
                    }
                    className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-muted text-[11px] leading-relaxed overflow-x-auto border border-black/[0.04] dark:border-white/[0.04]">
                  <code className="text-foreground">
                    {JSON.stringify(execution.input, null, 2)}
                  </code>
                </pre>
              </div>

              {/* Output */}
              {execution.output && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Output
                    </label>
                    <button
                      onClick={() =>
                        handleCopy(
                          JSON.stringify(execution.output, null, 2),
                          'Output'
                        )
                      }
                      className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-emerald-500/5 text-[11px] leading-relaxed overflow-x-auto border border-emerald-500/20">
                    <code className="text-emerald-700 dark:text-emerald-400">
                      {JSON.stringify(execution.output, null, 2)}
                    </code>
                  </pre>
                </div>
              )}

              {/* Error */}
              {execution.error && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <label className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                      Error
                    </label>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                      {execution.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>
                  <span className="font-semibold">Started:</span>{' '}
                  {execution.startTime.toLocaleTimeString()}
                </div>
                {execution.endTime && (
                  <div>
                    <span className="font-semibold">Ended:</span>{' '}
                    {execution.endTime.toLocaleTimeString()}
                  </div>
                )}
                {execution.duration && (
                  <div>
                    <span className="font-semibold">Duration:</span>{' '}
                    {formatDuration(execution.duration)}
                  </div>
                )}
              </div>

              {/* Actions */}
              {execution.status === 'error' && onRetry && (
                <button
                  onClick={() => onRetry(execution.id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Tool Call
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
