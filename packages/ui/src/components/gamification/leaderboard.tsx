'use client';

/**
 * Leaderboard — Ranked contributor list with avatars, points, streaks
 *
 * Platform-wide leaderboard primitive. Can be used for stream-level,
 * org-wide, or time-scoped (weekly/monthly/all-time) rankings.
 *
 * Usage:
 *   <Leaderboard entries={entries} />
 *   <Leaderboard entries={entries} highlight="user-123" maxEntries={10} />
 */

import * as React from 'react';
import { Flame, Trophy, Medal } from 'lucide-react';
import { cn } from '../../utils';
import type { LeaderboardEntry } from './types';

// ── Rank styling ─────────────────────────────────────────────────────────────

const RANK_STYLES: Record<number, { icon: typeof Trophy; color: string; bg: string }> = {
  1: { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10 ring-1 ring-yellow-500/20' },
  2: { icon: Medal,  color: 'text-slate-400',  bg: 'bg-slate-400/10 ring-1 ring-slate-400/20' },
  3: { icon: Medal,  color: 'text-amber-700',  bg: 'bg-amber-700/10 ring-1 ring-amber-700/20' },
};

// ── Component ────────────────────────────────────────────────────────────────

export interface LeaderboardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ranked entries */
  entries: LeaderboardEntry[];
  /** Highlight a specific user (e.g. current user) */
  highlight?: string;
  /** Maximum entries to show */
  maxEntries?: number;
  /** Column header for the primary metric */
  metricLabel?: string;
  /** Show streak column */
  showStreak?: boolean;
  /** Show badge count column */
  showBadges?: boolean;
  /** Show impact (conversations helped) column */
  showImpact?: boolean;
  /** Time period label */
  periodLabel?: string;
}

export const Leaderboard = React.forwardRef<HTMLDivElement, LeaderboardProps>(
  ({
    entries,
    highlight,
    maxEntries = 10,
    metricLabel = 'Points',
    showStreak = true,
    showBadges = true,
    showImpact = false,
    periodLabel,
    className,
    ...props
  }, ref) => {
    const visible = entries.slice(0, maxEntries);

    return (
      <div ref={ref} className={cn('overflow-hidden', className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Contributor
          </span>
          <div className="flex items-center gap-4">
            {showStreak && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-12 text-center">
                Streak
              </span>
            )}
            {showBadges && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-12 text-center">
                Badges
              </span>
            )}
            {showImpact && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 text-center">
                Impact
              </span>
            )}
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 text-right">
              {metricLabel}
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {visible.map((entry) => {
            const isHighlighted = entry.userId === highlight;
            const rankStyle = RANK_STYLES[entry.rank];
            const RankIcon = rankStyle?.icon;

            return (
              <div
                key={entry.userId}
                className={cn(
                  'flex items-center justify-between px-4 py-3 transition-colors',
                  isHighlighted
                    ? 'bg-blue-50/50 dark:bg-blue-500/5 ring-1 ring-inset ring-blue-500/10'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30',
                )}
              >
                {/* Left: rank + avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank */}
                  <div className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-lg shrink-0',
                    rankStyle?.bg ?? 'bg-muted',
                  )}>
                    {RankIcon ? (
                      <RankIcon className={cn('w-3.5 h-3.5', rankStyle.color)} />
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-700 ring-1 ring-black/5">
                    {entry.avatar ?? entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  {/* Name + top badges */}
                  <div className="min-w-0">
                    <p className={cn(
                      'text-xs font-semibold truncate',
                      isHighlighted ? 'text-blue-600 dark:text-blue-400' : 'text-foreground',
                    )}>
                      {entry.name}
                      {isHighlighted && <span className="text-[9px] ml-1 opacity-50">(you)</span>}
                    </p>
                    {entry.topBadges && entry.topBadges.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {entry.topBadges.slice(0, 3).map((icon, i) => (
                          <span key={i} className="text-[10px]">{icon}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: metrics */}
                <div className="flex items-center gap-4 shrink-0">
                  {showStreak && (
                    <div className="w-12 flex items-center justify-center gap-1">
                      {entry.streak > 0 && (
                        <>
                          <Flame className={cn(
                            'w-3 h-3',
                            entry.streak >= 14 ? 'text-orange-500' : entry.streak >= 7 ? 'text-amber-500' : 'text-amber-400',
                          )} />
                          <span className="text-[11px] font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
                            {entry.streak}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {showBadges && (
                    <span className="w-12 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                      {entry.badgeCount}
                    </span>
                  )}
                  {showImpact && (
                    <span className="w-16 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                      {entry.conversationsHelped.toLocaleString()}
                    </span>
                  )}
                  <span className="w-16 text-right text-xs font-bold tabular-nums text-foreground">
                    {entry.points.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Period footer */}
        {periodLabel && (
          <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 text-center">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
              {periodLabel}
            </span>
          </div>
        )}
      </div>
    );
  },
);

Leaderboard.displayName = 'Leaderboard';
