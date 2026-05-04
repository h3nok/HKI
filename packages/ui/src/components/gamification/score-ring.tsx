'use client';

/**
 * ScoreRing — Circular progress ring for scores and percentages
 *
 * Reusable SVG ring indicator. Supports color thresholds, labels,
 * and size variants. Usable for coverage scores, quality scores,
 * health indicators across the platform.
 *
 * Usage:
 *   <ScoreRing value={87} />
 *   <ScoreRing value={42} size="lg" label="Coverage" thresholds={{ good: 70, warn: 40 }} />
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils';

// ── Variants ─────────────────────────────────────────────────────────────────

const ringContainerVariants = cva('relative shrink-0', {
  variants: {
    size: {
      sm: 'w-14 h-14',
      default: 'w-20 h-20',
      lg: 'w-28 h-28',
      xl: 'w-36 h-36',
    },
  },
  defaultVariants: { size: 'default' },
});

const valueVariants = cva('font-bold tabular-nums text-foreground', {
  variants: {
    size: {
      sm: 'text-sm',
      default: 'text-lg',
      lg: 'text-2xl',
      xl: 'text-3xl',
    },
  },
  defaultVariants: { size: 'default' },
});

const labelVariants = cva('font-medium text-muted-foreground uppercase tracking-wider', {
  variants: {
    size: {
      sm: 'text-[6px]',
      default: 'text-[8px]',
      lg: 'text-[10px]',
      xl: 'text-xs',
    },
  },
  defaultVariants: { size: 'default' },
});

// ── Component ────────────────────────────────────────────────────────────────

export interface ScoreRingThresholds {
  /** Score >= this is green */
  good?: number;
  /** Score >= this is amber, below is red */
  warn?: number;
}

export interface ScoreRingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof ringContainerVariants> {
  /** Score value 0–100 */
  value: number;
  /** Optional label below the number */
  label?: string;
  /** Show percentage sign */
  showPercent?: boolean;
  /** Color thresholds (defaults: good=70, warn=40) */
  thresholds?: ScoreRingThresholds;
  /** Override stroke color */
  color?: string;
  /** Track (background) stroke width */
  trackWidth?: number;
  /** Active stroke width */
  strokeWidth?: number;
}

export const ScoreRing = React.forwardRef<HTMLDivElement, ScoreRingProps>(
  ({
    value,
    label,
    showPercent = true,
    thresholds = { good: 70, warn: 40 },
    color,
    trackWidth = 3,
    strokeWidth = 3,
    size,
    className,
    ...props
  }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));
    const goodThreshold = thresholds.good ?? 70;
    const warnThreshold = thresholds.warn ?? 40;

    const strokeColor = color ?? (
      clamped >= goodThreshold ? '#10b981'
        : clamped >= warnThreshold ? '#f59e0b'
          : '#ef4444'
    );

    return (
      <div ref={ref} className={cn(ringContainerVariants({ size }), className)} {...props}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Track */}
          <path
            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth={trackWidth}
            className="text-neutral-200 dark:text-neutral-700"
          />
          {/* Active */}
          <path
            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${clamped}, 100`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={valueVariants({ size })}>
            {Math.round(clamped)}{showPercent && <span className="text-[0.6em] opacity-60">%</span>}
          </span>
          {label && <span className={labelVariants({ size })}>{label}</span>}
        </div>
      </div>
    );
  },
);

ScoreRing.displayName = 'ScoreRing';
