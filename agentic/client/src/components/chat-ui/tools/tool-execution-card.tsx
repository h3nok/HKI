import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@hki/ui';
import { Badge } from '@/components/ui/badge';
import { cn } from '@hki/ui';

export interface ToolExecutionCardProps {
  toolName: string;
  description?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, any>;
  output?: any;
  error?: string;
  duration?: number;
  timestamp: string;
  children?: React.ReactNode;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'var(--muted-foreground)',
    bgColor: 'var(--muted)',
    borderColor: 'var(--border)',
    label: 'Queued',
  },
  running: {
    icon: Loader2,
    color: 'var(--primary)',
    bgColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--primary) 30%, var(--border))',
    label: 'Executing',
  },
  success: {
    icon: CheckCircle2,
    color: 'var(--success, #16a34a)',
    bgColor: 'color-mix(in srgb, var(--success, #16a34a) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--success, #16a34a) 30%, var(--border))',
    label: 'Complete',
  },
  error: {
    icon: XCircle,
    color: 'var(--secondary)',
    bgColor: 'color-mix(in srgb, var(--secondary) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--secondary) 30%, var(--border))',
    label: 'Failed',
  },
};

export function ToolExecutionCard({
  toolName,
  description,
  status,
  input,
  output,
  error,
  duration,
  timestamp,
  children,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'error');
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const handleCopy = async (text: string, isInput: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isInput) {
        setCopiedInput(true);
        setTimeout(() => setCopiedInput(false), 2000);
      } else {
        setCopiedOutput(true);
        setTimeout(() => setCopiedOutput(false), 2000);
      }
    } catch {
      console.warn('[Clipboard] writeText failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border overflow-hidden relative"
      style={{
        background: 'var(--card)',
        borderColor: config.borderColor,
        boxShadow: status === 'running'
          ? '0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent), 0 4px 16px -4px color-mix(in srgb, var(--primary) 15%, transparent)'
          : '0 2px 8px -4px color-mix(in srgb, var(--neutral-900) 8%, transparent)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Running State - Duotone Animated Gradient */}
      {status === 'running' && (
        <>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--secondary) 5%, transparent) 100%)',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Duotone activity pulse indicator - Primary to Secondary */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--primary) 30%, var(--secondary) 70%, transparent 100%)',
            }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-3.5 relative z-10"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Toggle tool execution details`}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
      >
        {/* Tool Icon with Status */}
        <div
          className="relative rounded-xl p-2.5 transition-all duration-200"
          style={{
            background: config.bgColor,
          }}
        >
          <Wrench
            className="h-4 w-4"
            style={{ color: config.color }}
          />
          {status === 'running' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--primary)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: 'var(--primary)' }}
              />
            </span>
          )}
          {status === 'success' && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--success, #16a34a)' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4
              className="font-semibold text-sm"
              style={{ color: 'var(--foreground)' }}
            >
              {toolName}
            </h4>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: config.bgColor,
                color: config.color,
              }}
            >
              {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="h-3 w-3" />}
              {status === 'error' && <XCircle className="h-3 w-3" />}
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {description && (
              <span className="truncate max-w-[200px]">{description}</span>
            )}
            {description && <span className="text-muted-foreground dark:text-muted-foreground">•</span>}
            <time>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
            {duration !== undefined && (
              <>
                <span className="text-muted-foreground dark:text-muted-foreground">•</span>
                <span>{duration}ms</span>
              </>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </Button>
      </div>

      {/* Expanded Content with AnimatePresence */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-0 space-y-3 border-t border-border mt-2">
              {/* Input */}
              {input && (
                <div className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 -ml-2 font-medium text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInput(!showInput);
                      }}
                    >
                      <Code className="mr-1.5 h-3 w-3" />
                      Input Parameters
                      <motion.div
                        animate={{ rotate: showInput ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                      </motion.div>
                    </Button>

                    {showInput && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(JSON.stringify(input, null, 2), true)}
                        >
                          {copiedInput ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  <AnimatePresence>
                    {showInput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="relative group overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-muted/50 rounded-lg -z-10" />
                        <pre className="overflow-x-auto rounded-lg border border-border p-3 text-xs font-mono text-muted-foreground bg-background max-h-[200px] scrollbar-thin">
                          {JSON.stringify(input, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Output */}
              {output && status === 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 -ml-2 font-medium text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOutput(!showOutput);
                      }}
                    >
                      <Code className="mr-1.5 h-3 w-3" />
                      Result Output
                      <motion.div
                        animate={{ rotate: showOutput ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                      </motion.div>
                    </Button>

                    {showOutput && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopy(JSON.stringify(output, null, 2), false)}
                        >
                          {copiedOutput ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  <AnimatePresence>
                    {showOutput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="relative group overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-muted/50 rounded-lg -z-10" />
                        <pre className="overflow-x-auto rounded-lg border border-border p-3 text-xs font-mono text-muted-foreground bg-background max-h-[300px] scrollbar-thin">
                          {JSON.stringify(output, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Error */}
              {error && status === 'error' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                  <div className="flex items-center gap-2 mb-1 font-medium text-red-700 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5" />
                    Error Execution Failed
                  </div>
                  <p className="pl-5.5 opacity-90">{error}</p>
                </div>
              )}

              {/* Custom Content (e.g. Map) */}
              {children && (
                <div className="pt-2">
                  {children}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
