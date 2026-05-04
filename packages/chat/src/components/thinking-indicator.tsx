'use client';

import { Bot } from 'lucide-react';
import { cn } from '@hki/ui';

export interface ThinkingIndicatorProps {
  /** Custom message to display */
  message?: string;
  /** Additional class names */
  className?: string;
}

export function ThinkingIndicator({
  message = 'Thinking...',
  className,
}: ThinkingIndicatorProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>

      {/* Thinking bubble */}
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
        {/* Animated dots */}
        <div className="flex gap-1">
          <span 
            className="h-2 w-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span 
            className="h-2 w-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span 
            className="h-2 w-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}
