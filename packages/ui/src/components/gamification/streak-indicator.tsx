'use client';

/**
 * StreakIndicator — Shows current streak with flame animation
 *
 * Compact display for sidebars/headers. Shows flame icon, day count,
 * multiplier badge, and progress toward the next streak badge.
 *
 * Usage:
 *   <StreakIndicator streak={streakData} />
 *   <StreakIndicator streak={streakData} variant="compact" />
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Flame, Shield } from 'lucide-react';
import { cn } from '../../utils';
import type { StreakData } from './types';

// ── Variants ─────────────────────────────────────────────────────────────────

const streakVariants = cva(
  'flex items-center transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'gap-2.5 px-3 py-2 rounded-xl',
        compact: 'gap-1.5 px-2 py-1 rounded-lg',
        inline: 'gap-1',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

// ── Flame color by streak length ─────────────────────────────────────────────

function getFlameColor(days: number): string {
  if (days >= 30) return 'text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]';
  if (days >= 14) return 'text-orange-400';
  if (days >= 7) return 'text-amber-500';
  if (days >= 3) return 'text-amber-400';
  return 'text-muted-foreground';
}

function getMultiplierColor(multiplier: number): string {
  if (multiplier >= 2.0) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30';
  if (multiplier >= 1.5) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30';
  if (multiplier > 1.0) return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 ring-yellow-500/30';
  return 'bg-muted text-neutral-500 ring-neutral-200 dark:ring-neutral-700';
}

// ── Component ────────────────────────────────────────────────────────────────

export interface StreakIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof streakVariants> {
  /** Streak data */
  streak: StreakData;
  /** Show progress bar toward next badge */
  showProgress?: boolean;
  /** Show the multiplier badge */
  showMultiplier?: boolean;
  /** Show shield indicator */
  showShield?: boolean;
}

export const StreakIndicator = React.forwardRef<HTMLDivElement, StreakIndicatorProps>(
  ({ streak, variant, showProgress = true, showMultiplier = true, showShield, className, ...props }, ref) => {
    const isActive = streak.current > 0;
    const flameColor = getFlameColor(streak.current);

    if (variant === 'inline') {
      return (
        <span
          ref={ref}
          className={cn(streakVariants({ variant }), className)}
          title={`${streak.current}-day streak`}
          {...props}
        >
          <Flame className={cn('w-3.5 h-3.5', flameColor, isActive && 'animate-pulse')} />
          <span className="text-xs font-bold tabular-nums text-foreground">
            {streak.current}
          </span>
        </span>
      );
    }

    if (variant === 'compact') {
      return (
        <div
          ref={ref}
          className={cn(
            streakVariants({ variant }),
            isActive
              ? 'bg-amber-500/8 dark:bg-amber-400/8'
              : 'bg-muted',
            className,
          )}
          {...props}
        >
          <Flame className={cn('w-3.5 h-3.5 shrink-0', flameColor, isActive && 'animate-pulse')} />
          <span className="text-xs font-bold tabular-nums text-foreground">
            {streak.current}
          </span>
          {showMultiplier && streak.multiplier > 1 && (
            <span className={cn(
              'px-1 py-0.5 text-[8px] font-bold rounded ring-1 tabular-nums',
              getMultiplierColor(streak.multiplier),
            )}>
              {streak.multiplier.toFixed(1)}x
            </span>
          )}
        </div>
      );
    }

    // Default: full display
    const progressPct = streak.daysToNextBadge > 0
      ? Math.max(5, Math.round(((streak.current % 30) / (streak.current % 30 + streak.daysToNextBadge)) * 100))
      : 100;

    return (
      <div
        ref={ref}
        className={cn(
          streakVariants({ variant }),
          'flex-col items-stretch',
          isActive
            ? 'bg-amber-500/5 dark:bg-amber-400/5 ring-1 ring-amber-500/10'
            : 'bg-neutral-50 dark:bg-neutral-800/50 ring-1 ring-neutral-200 dark:ring-neutral-700',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5">
          <Flame className={cn('w-5 h-5 shrink-0', flameColor, isActive && 'animate-pulse')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {streak.current}-day streak
              </span>
              {showMultiplier && streak.multiplier > 1 && (
                <span className={cn(
                  'px-1.5 py-0.5 text-[9px] font-bold rounded-md ring-1 tabular-nums',
                  getMultiplierColor(streak.multiplier),
                )}>
                  {streak.multiplier.toFixed(1)}x
                </span>
              )}
              {showShield && streak.shieldAvailable && (
                <Shield className="w-3 h-3 text-cyan-500" aria-label="Streak shield available" />
              )}
            </div>
            {showProgress && streak.daysToNextBadge > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {streak.daysToNextBadge} more days for <span className="font-semibold">{streak.nextBadgeName}</span>
              </p>
            )}
          </div>
        </div>

        {showProgress && streak.daysToNextBadge > 0 && (
          <div className="h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>
    );
  },
);

StreakIndicator.displayName = 'StreakIndicator';
