'use client';

/**
 * AchievementBadge — Platform-wide achievement badge primitive
 *
 * Renders a single badge with tier-based visual treatment (glow, ring, color).
 * Locked badges show a lock icon. Earned badges show the emoji icon with
 * a hover tooltip containing flavor text and earned date.
 *
 * Usage:
 *   <AchievementBadge badge={badge} />
 *   <AchievementBadge badge={badge} size="lg" animate />
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Lock } from 'lucide-react';
import { cn } from '../../utils';
import type { AchievementBadgeData, BadgeTier } from './types';

// ── Tier visual mapping ──────────────────────────────────────────────────────

const TIER_STYLES: Record<BadgeTier, { ring: string; bg: string; glow: string; text: string }> = {
  bronze:  { ring: 'ring-amber-700/40',  bg: 'bg-amber-900/10 dark:bg-amber-400/10',  glow: '', text: 'text-amber-700 dark:text-amber-400' },
  silver:  { ring: 'ring-slate-400/50',   bg: 'bg-slate-400/10 dark:bg-slate-300/10',  glow: '', text: 'text-slate-500 dark:text-slate-300' },
  gold:    { ring: 'ring-yellow-400/60',  bg: 'bg-yellow-400/10 dark:bg-yellow-300/10', glow: 'shadow-[0_0_12px_rgba(250,204,21,0.2)]', text: 'text-yellow-600 dark:text-yellow-300' },
  diamond: { ring: 'ring-cyan-400/60',    bg: 'bg-cyan-400/10 dark:bg-cyan-300/10',    glow: 'shadow-[0_0_16px_rgba(34,211,238,0.25)]', text: 'text-cyan-500 dark:text-cyan-300' },
  secret:  { ring: 'ring-purple-400/50',  bg: 'bg-purple-400/10 dark:bg-purple-300/10', glow: 'shadow-[0_0_12px_rgba(168,85,247,0.2)]', text: 'text-purple-500 dark:text-purple-300' },
};

const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', secret: '🔮',
};

// ── CVA variants ─────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'relative flex flex-col items-center rounded-2xl border transition-all duration-200 cursor-default select-none',
  {
    variants: {
      size: {
        sm: 'p-2 gap-0.5',
        default: 'p-3 gap-1',
        lg: 'p-4 gap-1.5',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

const iconVariants = cva('leading-none', {
  variants: {
    size: {
      sm: 'text-lg',
      default: 'text-2xl',
      lg: 'text-3xl',
    },
  },
  defaultVariants: { size: 'default' },
});

const lockVariants = cva('text-[#9a9995] dark:text-white/40', {
  variants: {
    size: {
      sm: 'w-4 h-4',
      default: 'w-5 h-5',
      lg: 'w-6 h-6',
    },
  },
  defaultVariants: { size: 'default' },
});

const nameVariants = cva('font-bold text-center leading-tight', {
  variants: {
    size: {
      sm: 'text-[8px]',
      default: 'text-[10px]',
      lg: 'text-xs',
    },
  },
  defaultVariants: { size: 'default' },
});

// ── Component ────────────────────────────────────────────────────────────────

export interface AchievementBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Badge data including tier, icon, earned status */
  badge: AchievementBadgeData;
  /** Animate entrance (stagger-friendly with index) */
  animate?: boolean;
  /** Stagger index for entrance animation */
  index?: number;
  /** Show tooltip on hover */
  showTooltip?: boolean;
}

export const AchievementBadge = React.forwardRef<HTMLDivElement, AchievementBadgeProps>(
  ({ badge, size, animate, index = 0, showTooltip = true, className, ...props }, ref) => {
    const earned = !!badge.earnedAt;
    const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;

    return (
      <div
        ref={ref}
        className={cn(
          badgeVariants({ size }),
          'group',
          earned
            ? cn(tier.bg, 'border-transparent ring-1', tier.ring, tier.glow, 'hover:scale-105')
            : 'bg-[#f5f4f1] dark:bg-white/5 border-dashed border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20',
          className,
        )}
        role="img"
        aria-label={earned ? `${badge.name} — ${badge.flavorText}` : 'Locked badge'}
        {...props}
      >
        {/* Icon or Lock */}
        <span className={iconVariants({ size })}>
          {earned ? badge.icon : <Lock className={lockVariants({ size })} />}
        </span>

        {/* Name */}
        <span className={cn(
          nameVariants({ size }),
          earned ? 'text-[#1a1a19] dark:text-[#E6EDF3]' : 'text-[#7a7975] dark:text-white/50',
        )}>
          {badge.name}
        </span>

        {/* Tier indicator */}
        {earned && (
          <span className="text-[8px] leading-none">{TIER_LABEL[badge.tier]}</span>
        )}

        {/* Hover tooltip */}
        {earned && showTooltip && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
            <div className="px-3 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] leading-relaxed max-w-[200px] text-center shadow-lg whitespace-normal">
              <p className="font-bold">{badge.name}</p>
              <p className="opacity-70 mt-0.5 italic">&ldquo;{badge.flavorText}&rdquo;</p>
              {badge.earnedAt && (
                <p className="opacity-50 mt-1 text-[8px]">
                  Earned {new Date(badge.earnedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 mx-auto -mt-1" />
          </div>
        )}
      </div>
    );
  },
);

AchievementBadge.displayName = 'AchievementBadge';

export { badgeVariants as achievementBadgeVariants, TIER_STYLES, TIER_LABEL };
