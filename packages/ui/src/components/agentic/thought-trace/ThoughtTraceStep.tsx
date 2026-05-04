/**
 * ThoughtTraceStep - World-Class Execution Trace Step
 * 
 * Features:
 * - CSS variable theming for light/dark modes
 * - Smooth expand/collapse animations
 * - Real-time status indicators
 * - Semantic type icons
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Brain,
  Search,
  Wrench,
  CheckCircle2,
  Loader2,
  Clock,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface ThoughtTraceStepCardProps {
  type: 'reasoning' | 'search' | 'tool_call' | 'result';
  title: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  timestamp: string;
  duration?: number;
  metadata?: Record<string, any>;
  children?: React.ReactNode;
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const stepIcons = {
  reasoning: Brain,
  search: Search,
  tool_call: Wrench,
  result: CheckCircle2,
};

const statusConfig = {
  pending: {
    color: 'var(--muted-foreground)',
    bgColor: 'color-mix(in srgb, var(--muted) 100%, transparent)',
    borderColor: 'var(--border)',
    label: 'Pending',
  },
  running: {
    color: 'var(--primary)',
    bgColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--primary) 30%, var(--border))',
    label: 'Running',
  },
  complete: {
    color: 'var(--success, #16a34a)',
    bgColor: 'color-mix(in srgb, var(--success, #16a34a) 10%, transparent)',
    borderColor: 'var(--border)',
    label: 'Complete',
  },
  error: {
    color: 'var(--destructive)',
    bgColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--destructive) 30%, var(--border))',
    label: 'Error',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ThoughtTraceStepCard({
  type,
  title,
  description,
  status,
  timestamp,
  duration,
  metadata,
  children,
}: ThoughtTraceStepCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'running' || status === 'error');

  const StepIcon = stepIcons[type] || Brain;
  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-xl border transition-all duration-200"
      style={{
        background: 'var(--card)',
        borderColor: config.borderColor,
        boxShadow: status === 'running'
          ? '0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent), 0 4px 12px -4px color-mix(in srgb, var(--primary) 10%, transparent)'
          : '0 2px 8px -4px color-mix(in srgb, var(--neutral-900) 6%, transparent)',
        opacity: status === 'pending' ? 0.6 : 1,
      }}
    >
      {/* Running state animation */}
      {status === 'running' && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 5%, transparent) 0%, transparent 50%)',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Step Header */}
      <div
        className="flex cursor-pointer items-start gap-3 p-3 relative z-10"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Toggle step details`}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
      >
        {/* Icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{ background: config.bgColor }}
        >
          {status === 'running' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-4 w-4" style={{ color: config.color }} />
            </motion.div>
          ) : (
            <StepIcon className="h-4 w-4" style={{ color: config.color }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-0.5">
            <h4
              className="font-semibold text-sm truncate"
              style={{ color: status === 'running' ? 'var(--primary)' : 'var(--foreground)' }}
            >
              {title}
            </h4>
            {status === 'running' && (
              <span className="flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75"
                  style={{ background: 'var(--primary)' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: 'var(--primary)' }}
                />
              </span>
            )}
          </div>
          <p
            className="text-xs line-clamp-2 leading-relaxed"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {description}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize"
              style={{
                background: config.bgColor,
                color: config.color,
              }}
            >
              {type.replace('_', ' ')}
            </span>
            <span
              className="text-[11px] flex items-center gap-1"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Clock className="w-3 h-3" />
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            {duration !== undefined && (
              <span
                className="text-[11px]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {duration}ms
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <motion.button
          type="button"
          className="p-1.5 rounded-lg transition-colors"
          style={{
            color: 'var(--muted-foreground)',
            background: isExpanded ? 'color-mix(in srgb, var(--muted) 50%, transparent)' : 'transparent',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </motion.button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="mx-3 mb-3 p-3 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--muted) 30%, transparent)',
              }}
            >
              {metadata && Object.keys(metadata).length > 0 && (
                <div className="space-y-1">
                  <h5
                    className="font-medium text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Metadata
                  </h5>
                  <pre
                    className="overflow-x-auto rounded-lg p-2 text-xs font-mono"
                    style={{
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
