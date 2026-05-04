'use client';

import { ArrowDown } from 'lucide-react';
import { cn } from '@hki/ui';

export interface ScrollToBottomButtonProps {
  onClick: () => void;
  className?: string;
}

export function ScrollToBottomButton({
  onClick,
  className,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2',
        'flex items-center gap-2 rounded-full',
        'bg-background border border-border shadow-lg',
        'px-4 py-2 text-sm text-muted-foreground',
        'transition-all hover:bg-accent hover:text-foreground',
        'animate-in fade-in slide-in-from-bottom-2',
        className
      )}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4" />
      <span>New messages</span>
    </button>
  );
}
