/**
 * ThoughtTraceTimeline Component
 * 
 * Category: thought-trace
 * Priority: P0 (Core)
 * Complexity: Medium
 * 
 * Displays a timeline of agent reasoning steps with expandable details.
 * Shows step type, status, duration, and metadata.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Search,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type ThoughtTraceStepType = 'reasoning' | 'search' | 'tool_call' | 'result';
export type ThoughtTraceStepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ThoughtTraceStep {
  id: string;
  type: ThoughtTraceStepType;
  title: string;
  description: string;
  status: ThoughtTraceStepStatus;
  timestamp: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface ThoughtTraceTimelineProps {
  /** Array of trace steps to display */
  steps: ThoughtTraceStep[];
  /** Additional CSS classes */
  className?: string;
  /** Whether to auto-expand running/error steps */
  autoExpand?: boolean;
  /** Callback when a step is clicked */
  onStepClick?: (step: ThoughtTraceStep) => void;
}

// ============================================================================
// Constants
// ============================================================================

const stepIcons: Record<ThoughtTraceStepType, React.ElementType> = {
  reasoning: Brain,
  search: Search,
  tool_call: Wrench,
  result: CheckCircle2,
};

const statusIcons: Record<ThoughtTraceStepStatus, React.ElementType> = {
  pending: Clock,
  running: Loader2,
  complete: CheckCircle2,
  error: XCircle,
};

const statusColors: Record<ThoughtTraceStepStatus, string> = {
  pending: 'text-gray-400',
  running: 'text-blue-600',
  complete: 'text-green-600',
  error: 'text-red-600',
};

const statusBorderColors: Record<ThoughtTraceStepStatus, string> = {
  pending: 'border-gray-200',
  running: 'border-blue-500',
  complete: 'border-green-500',
  error: 'border-red-500',
};

const statusBgColors: Record<ThoughtTraceStepStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

// ============================================================================
// Step Component
// ============================================================================

interface TimelineStepProps {
  step: ThoughtTraceStep;
  autoExpand: boolean;
  onStepClick?: ((step: ThoughtTraceStep) => void) | undefined;
}

const TimelineStep: React.FC<TimelineStepProps> = ({ 
  step, 
  autoExpand, 
  onStepClick 
}) => {
  const [isExpanded, setIsExpanded] = useState(
    autoExpand && (step.status === 'running' || step.status === 'error')
  );

  const StepIcon = stepIcons[step.type];
  const StatusIcon = statusIcons[step.status];

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    onStepClick?.(step);
  };

  return (
    <div
      className={cn(
        'group relative border-l-2 pl-4 pb-4 transition-colors',
        statusBorderColors[step.status]
      )}
    >
      {/* Step Header */}
      <div
        className="flex cursor-pointer items-start gap-3 py-2"
        onClick={handleClick}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            statusBgColors[step.status]
          )}
        >
          <StepIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{step.title}</h4>
            <StatusIcon
              className={cn(
                'h-4 w-4',
                statusColors[step.status],
                step.status === 'running' && 'animate-spin'
              )}
            />
          </div>
          <p className="text-xs text-gray-500">{step.description}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <time>{new Date(step.timestamp).toLocaleTimeString()}</time>
            {step.duration !== undefined && (
              <>
                <span>•</span>
                <span>{step.duration}ms</span>
              </>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center rounded hover:bg-gray-100"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && step.metadata && Object.keys(step.metadata).length > 0 && (
        <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="space-y-1">
            <h5 className="font-medium text-xs text-gray-500 uppercase tracking-wide">
              Metadata
            </h5>
            <pre className="overflow-x-auto rounded bg-white p-2 text-xs border border-gray-200">
              {JSON.stringify(step.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ThoughtTraceTimeline: React.FC<ThoughtTraceTimelineProps> = ({
  steps,
  className,
  autoExpand = true,
  onStepClick,
}) => {
  if (steps.length === 0) {
    return (
      <div className={cn('p-4 text-center text-gray-500 text-sm', className)}>
        No trace steps available
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)} data-component="ThoughtTraceTimeline">
      {steps.map((step) => (
        <TimelineStep
          key={step.id}
          step={step}
          autoExpand={autoExpand}
          onStepClick={onStepClick}
        />
      ))}
    </div>
  );
};

ThoughtTraceTimeline.displayName = 'ThoughtTraceTimeline';

export default ThoughtTraceTimeline;
