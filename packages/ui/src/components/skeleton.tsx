'use client';

import * as React from 'react';

import { cn } from '../utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-card/20 backdrop-blur-sm pointer-events-none',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-linear-to-r from-transparent via-primary/10 dark:via-primary/5 to-transparent shadow-[0_0_20px_rgba(var(--primary),0.2)]" />
    </div>
  );
}

export { Skeleton };
