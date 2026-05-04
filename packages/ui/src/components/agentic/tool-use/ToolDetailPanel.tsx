/**
 * ToolDetailPanel Component
 * 
 * Category: tool-use
 * Priority: P0 (Core)
 * Complexity: Medium
 * 
 * Displays detailed information about tool executions including
 * input parameters, output results, errors, and timing.
 */

import React, { useState } from 'react';
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Code,
} from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type ToolExecutionStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolDetailPanelProps {
  /** Name of the tool being executed */
  toolName: string;
  /** Description of what the tool does */
  description?: string;
  /** Current execution status */
  status: ToolExecutionStatus;
  /** Input parameters passed to the tool */
  input?: Record<string, unknown>;
  /** Output returned by the tool */
  output?: Record<string, unknown> | string | number | boolean | null;
  /** Error message if execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** When the execution started */
  timestamp: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const statusConfig: Record<ToolExecutionStatus, {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
}> = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    label: 'Running',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Error',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const ToolDetailPanel: React.FC<ToolDetailPanelProps> = ({
  toolName,
  description,
  status,
  input,
  output,
  error,
  duration,
  timestamp,
  className,
  defaultExpanded,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? status === 'error');
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div 
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
      data-component="ToolDetailPanel"
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-start gap-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Tool Icon */}
        <div className={cn('rounded-lg p-2', config.bg)}>
          <Wrench className={cn('h-4 w-4', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{toolName}</h4>
            <span 
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
                config.bg,
                config.color
              )}
            >
              <StatusIcon
                className={cn(
                  'h-3 w-3',
                  status === 'running' && 'animate-spin'
                )}
              />
              {config.label}
            </span>
          </div>

          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <time>{new Date(timestamp).toLocaleTimeString()}</time>
            {duration !== undefined && (
              <>
                <span>•</span>
                <span>{duration}ms</span>
              </>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <button 
          type="button"
          className="h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-gray-100"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Input */}
          {input && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-1 font-medium text-xs text-gray-600 hover:text-gray-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInput(!showInput);
                }}
              >
                <Code className="h-3 w-3" />
                Input
                {showInput ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              {showInput && (
                <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs border border-gray-200">
                  {JSON.stringify(input, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Output */}
          {output && status === 'success' && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-1 font-medium text-xs text-gray-600 hover:text-gray-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOutput(!showOutput);
                }}
              >
                <Code className="h-3 w-3" />
                Output
                {showOutput ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              {showOutput && (
                <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs border border-gray-200">
                  {JSON.stringify(output, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {error && status === 'error' && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-900 border border-red-200">
              <p className="font-medium">Error:</p>
              <p className="mt-1">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ToolDetailPanel.displayName = 'ToolDetailPanel';

export default ToolDetailPanel;
