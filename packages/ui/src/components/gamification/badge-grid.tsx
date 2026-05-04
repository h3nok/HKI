'use client';

/**
 * BadgeGrid — Displays a collection of achievement badges
 *
 * Renders earned and locked badges in a responsive grid.
 * Supports grouping by category and filtering by tier.
 *
 * Usage:
 *   <BadgeGrid badges={badges} />
 *   <BadgeGrid badges={badges} columns={5} groupByCategory />
 */

import * as React from 'react';
import { cn } from '../../utils';
import { AchievementBadge } from './achievement-badge';
import type { AchievementBadgeData, BadgeTier } from './types';

export interface BadgeGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of badge data */
  badges: AchievementBadgeData[];
  /** Grid column count (default responsive) */
  columns?: 3 | 4 | 5 | 6;
  /** Badge size */
  size?: 'sm' | 'default' | 'lg';
  /** Group badges by their category field */
  groupByCategory?: boolean;
  /** Only show earned badges */
  earnedOnly?: boolean;
  /** Filter to specific tiers */
  tiers?: BadgeTier[];
  /** Show count summary above grid */
  showSummary?: boolean;
}

const COL_CLASSES: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

export const BadgeGrid = React.forwardRef<HTMLDivElement, BadgeGridProps>(
  ({ badges, columns = 5, size, groupByCategory, earnedOnly, tiers, showSummary, className, ...props }, ref) => {
    let filtered = badges;
    if (earnedOnly) filtered = filtered.filter(b => !!b.earnedAt);
    if (tiers?.length) filtered = filtered.filter(b => tiers.includes(b.tier));

    // Sort: earned first, then by tier weight
    const TIER_WEIGHT: Record<BadgeTier, number> = { diamond: 0, gold: 1, silver: 2, bronze: 3, secret: 4 };
    const sorted = [...filtered].sort((a, b) => {
      const aEarned = a.earnedAt ? 0 : 1;
      const bEarned = b.earnedAt ? 0 : 1;
      if (aEarned !== bEarned) return aEarned - bEarned;
      return (TIER_WEIGHT[a.tier] ?? 5) - (TIER_WEIGHT[b.tier] ?? 5);
    });

    const earnedCount = sorted.filter(b => !!b.earnedAt).length;
    const totalCount = sorted.length;

    if (groupByCategory) {
      const groups = new Map<string, AchievementBadgeData[]>();
      for (const badge of sorted) {
        const cat = badge.category || 'General';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(badge);
      }

      return (
        <div ref={ref} className={cn('space-y-6', className)} {...props}>
          {showSummary && <BadgeSummary earned={earnedCount} total={totalCount} />}
          {Array.from(groups.entries()).map(([category, catBadges]) => (
            <div key={category}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
                <span className="ml-1.5 text-[10px] font-medium text-muted-foreground normal-case tracking-normal">
                  {catBadges.filter(b => !!b.earnedAt).length}/{catBadges.length}
                </span>
              </h4>
              <div className={cn('grid gap-2', COL_CLASSES[columns])}>
                {catBadges.map((badge, i) => (
                  <AchievementBadge key={badge.key} badge={badge} size={size} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        {showSummary && <BadgeSummary earned={earnedCount} total={totalCount} />}
        <div className={cn('grid gap-2', COL_CLASSES[columns])}>
          {sorted.map((badge, i) => (
            <AchievementBadge key={badge.key} badge={badge} size={size} index={i} />
          ))}
        </div>
      </div>
    );
  },
);

BadgeGrid.displayName = 'BadgeGrid';

// ── Summary bar ──────────────────────────────────────────────────────────────

function BadgeSummary({ earned, total }: { earned: number; total: number }) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-foreground tabular-nums">
        {earned}<span className="text-muted-foreground font-medium">/{total}</span>
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
