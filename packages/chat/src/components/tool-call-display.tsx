'use client';

import { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@hki/ui';
import type { ToolRequestMessage, ToolResponseMessage } from '../types';

export interface ToolCallDisplayProps {
  request: ToolRequestMessage;
  response?: ToolResponseMessage;
  className?: string;
}

export function ToolCallDisplay({
  request,
  response,
  className,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isLoading = !response;
  const hasError = response?.error;
  
  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
    if (hasError) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusColor = () => {
    if (isLoading) return 'border-primary/50';
    if (hasError) return 'border-destructive/50';
    return 'border-green-500/50';
  };

  return (
    <div 
      className={cn(
        'rounded-lg border-2 bg-muted/30',
        getStatusColor(),
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium text-foreground">
          {request.toolName}
        </span>
        {getStatusIcon()}
        {response?.durationMs && (
          <span className="text-xs text-muted-foreground">
            {response.durationMs}ms
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Input */}
          <div>
            <span className="text-xs font-medium text-muted-foreground">Input</span>
            <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs text-foreground">
              {JSON.stringify(request.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {response && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {hasError ? 'Error' : 'Output'}
              </span>
              <pre 
                className={cn(
                  'mt-1 overflow-x-auto rounded p-2 text-xs',
                  hasError 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-background text-foreground'
                )}
              >
                {hasError 
                  ? response.error 
                  : JSON.stringify(response.output, null, 2)
                }
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
