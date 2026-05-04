'use client';

/**
 * ImpactStat — Animated lifetime impact number with label
 *
 * Uses react-countup for smooth number animation on mount.
 * Designed for "your doc helped X people" moments that make
 * contribution feel meaningful.
 *
 * Usage:
 *   <ImpactStat value={347} label="Conversations helped" icon="💬" />
 *   <ImpactStat value={89} label="Unique users" icon="👥" suffix="people" />
 */

import * as React from 'react';
import CountUp from 'react-countup';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils';

// ── Variants ─────────────────────────────────────────────────────────────────

const impactVariants = cva(
  'flex items-center transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'gap-3 p-3 rounded-xl',
        card: 'flex-col items-center gap-1 p-4 rounded-2xl text-center',
        inline: 'gap-1.5',
      },
      color: {
        neutral: '',
        emerald: '',
        blue: '',
        amber: '',
        purple: '',
      },
    },
    compoundVariants: [
      { variant: 'default', color: 'neutral', className: 'bg-muted' },
      { variant: 'default', color: 'emerald', className: 'bg-emerald-500/8 dark:bg-emerald-400/8' },
      { variant: 'default', color: 'blue', className: 'bg-blue-500/8 dark:bg-blue-400/8' },
      { variant: 'default', color: 'amber', className: 'bg-amber-500/8 dark:bg-amber-400/8' },
      { variant: 'default', color: 'purple', className: 'bg-purple-500/8 dark:bg-purple-400/8' },
      { variant: 'card', color: 'neutral', className: 'bg-neutral-50 dark:bg-neutral-800/50 ring-1 ring-neutral-200 dark:ring-neutral-700' },
      { variant: 'card', color: 'emerald', className: 'bg-emerald-500/5 dark:bg-emerald-400/5 ring-1 ring-emerald-500/15' },
      { variant: 'card', color: 'blue', className: 'bg-blue-500/5 dark:bg-blue-400/5 ring-1 ring-blue-500/15' },
      { variant: 'card', color: 'amber', className: 'bg-amber-500/5 dark:bg-amber-400/5 ring-1 ring-amber-500/15' },
      { variant: 'card', color: 'purple', className: 'bg-purple-500/5 dark:bg-purple-400/5 ring-1 ring-purple-500/15' },
    ],
    defaultVariants: { variant: 'default', color: 'neutral' },
  },
);

// ── Component ────────────────────────────────────────────────────────────────

export interface ImpactStatProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof impactVariants> {
  /** The numeric value to display */
  value: number;
  /** Label describing what the number means */
  label: string;
  /** Emoji or icon string */
  icon?: string;
  /** React node icon (e.g., Lucide icon) — takes priority over emoji icon */
  iconNode?: React.ReactNode;
  /** Suffix after the number (e.g. "hrs", "people") */
  suffix?: string;
  /** Prefix before the number (e.g. "~", "#") */
  prefix?: string;
  /** Animate the number on mount */
  animate?: boolean;
  /** Animation duration in seconds */
  duration?: number;
  /** Format number with locale separators */
  formatNumber?: boolean;
}

export const ImpactStat = React.forwardRef<HTMLDivElement, ImpactStatProps>(
  ({
    value,
    label,
    icon,
    iconNode,
    suffix,
    prefix,
    animate = true,
    duration = 1.5,
    formatNumber = true,
    variant,
    color,
    className,
    ...props
  }, ref) => {
    const formattingFn = (n: number) => formatNumber ? n.toLocaleString() : String(n);

    const isCard = variant === 'card';
    const isInline = variant === 'inline';

    return (
      <div ref={ref} className={cn(impactVariants({ variant, color }), className)} {...props}>
        {/* Icon */}
        {(icon || iconNode) && !isInline && (
          <span className={cn(isCard ? 'text-2xl' : 'text-lg', 'shrink-0 select-none')}>
            {iconNode ?? icon}
          </span>
        )}

        {/* Value + label */}
        <div className={cn(isCard ? 'space-y-0.5' : 'min-w-0', isInline && 'flex items-baseline gap-1')}>
          <p className={cn(
            'font-bold tabular-nums text-foreground',
            isCard ? 'text-2xl' : isInline ? 'text-sm' : 'text-lg',
          )}>
            {prefix}
            {animate ? (
              <CountUp end={value} duration={duration} formattingFn={formattingFn as (n: number) => string} />
            ) : (
              formatNumber ? value.toLocaleString() : value
            )}
            {suffix && <span className="text-[0.65em] font-medium text-muted-foreground ml-0.5">{suffix}</span>}
          </p>
          <p className={cn(
            'text-muted-foreground',
            isCard ? 'text-[10px] font-medium uppercase tracking-wider' : isInline ? 'text-[11px]' : 'text-[10px] leading-tight',
          )}>
            {isInline && (icon || iconNode) && <span className="mr-0.5">{iconNode ?? icon}</span>}
            {label}
          </p>
        </div>
      </div>
    );
  },
);

ImpactStat.displayName = 'ImpactStat';
