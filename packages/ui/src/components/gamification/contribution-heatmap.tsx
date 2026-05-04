'use client';

/**
 * ContributionHeatmap — GitHub-style contribution calendar
 *
 * Shows daily contribution activity as a color-coded grid.
 * Darker = more contributions. Hover shows exact count + date.
 *
 * Usage:
 *   <ContributionHeatmap data={contributionsByDate} />
 *   <ContributionHeatmap data={data} weeks={26} colorScale="emerald" />
 */

import * as React from 'react';
import { cn } from '../../utils';

// ── Color scales ─────────────────────────────────────────────────────────────

const COLOR_SCALES = {
  emerald: [
    'bg-muted',       // 0
    'bg-emerald-200 dark:bg-emerald-900/60',     // 1
    'bg-emerald-400 dark:bg-emerald-700',        // 2-3
    'bg-emerald-500 dark:bg-emerald-600',        // 4-6
    'bg-emerald-600 dark:bg-emerald-500',        // 7+
  ],
  blue: [
    'bg-muted',
    'bg-blue-200 dark:bg-blue-900/60',
    'bg-blue-400 dark:bg-blue-700',
    'bg-blue-500 dark:bg-blue-600',
    'bg-blue-600 dark:bg-blue-500',
  ],
  amber: [
    'bg-muted',
    'bg-amber-200 dark:bg-amber-900/60',
    'bg-amber-400 dark:bg-amber-700',
    'bg-amber-500 dark:bg-amber-600',
    'bg-amber-600 dark:bg-amber-500',
  ],
} as const;

type ColorScaleName = keyof typeof COLOR_SCALES;

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// ── Component ────────────────────────────────────────────────────────────────

export interface ContributionHeatmapProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Map of ISO date string (YYYY-MM-DD) to contribution count */
  data: Record<string, number>;
  /** Number of weeks to show (default 26 = ~6 months) */
  weeks?: number;
  /** Color scale name */
  colorScale?: ColorScaleName;
  /** Cell size in pixels */
  cellSize?: number;
  /** Show day labels on the left */
  showDayLabels?: boolean;
  /** Show month labels on top */
  showMonthLabels?: boolean;
}

export const ContributionHeatmap = React.forwardRef<HTMLDivElement, ContributionHeatmapProps>(
  ({
    data,
    weeks = 26,
    colorScale = 'emerald',
    cellSize = 12,
    showDayLabels = true,
    showMonthLabels = true,
    className,
    ...props
  }, ref) => {
    const colors = COLOR_SCALES[colorScale];

    // Build grid: weeks × 7 days, starting from `weeks` ago
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) + (7 - today.getDay()));

    const grid: { date: string; count: number; dayOfWeek: number }[][] = [];
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < weeks; w++) {
      const week: typeof grid[0] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);
        const iso = cellDate.toISOString().split('T')[0] ?? '';
        const month = cellDate.getMonth();

        if (month !== lastMonth && showMonthLabels) {
          monthLabels.push({
            label: cellDate.toLocaleString('default', { month: 'short' }),
            weekIndex: w,
          });
          lastMonth = month;
        }

        week.push({
          date: iso,
          count: data[iso] ?? 0,
          dayOfWeek: d,
        });
      }
      grid.push(week);
    }

    const gap = 2;
    const totalDays = data ? Object.values(data).reduce((a, b) => a + (b > 0 ? 1 : 0), 0) : 0;
    const totalContributions = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;

    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        <div className="flex items-start gap-1">
          {/* Day labels */}
          {showDayLabels && (
            <div className="flex flex-col shrink-0" style={{ gap, paddingTop: showMonthLabels ? 16 : 0 }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-[8px] font-medium text-muted-foreground leading-none text-right pr-1"
                  style={{ height: cellSize }}
                >
                  <span className="flex items-center h-full">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="overflow-x-auto">
            {/* Month labels */}
            {showMonthLabels && (
              <div className="flex relative" style={{ height: 14, marginBottom: 2 }}>
                {monthLabels.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-[8px] font-medium text-muted-foreground"
                    style={{ left: m.weekIndex * (cellSize + gap) }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            )}

            {/* Cells */}
            <div className="flex" style={{ gap }}>
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap }}>
                  {week.map((cell) => {
                    const level = getLevel(cell.count);
                    const isFuture = new Date(cell.date) > today;
                    return (
                      <div
                        key={cell.date}
                        className={cn(
                          'rounded-[2px] transition-colors group relative',
                          isFuture ? 'bg-transparent' : colors[level],
                        )}
                        style={{ width: cellSize, height: cellSize }}
                        title={isFuture ? '' : `${cell.date}: ${cell.count} contribution${cell.count !== 1 ? 's' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            <span className="font-bold text-foreground">{totalContributions}</span> contributions across{' '}
            <span className="font-bold text-foreground">{totalDays}</span> active days
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-muted-foreground">Less</span>
            {colors.map((c, i) => (
              <div key={i} className={cn('rounded-[2px]', c)} style={{ width: cellSize, height: cellSize }} />
            ))}
            <span className="text-[8px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    );
  },
);

ContributionHeatmap.displayName = 'ContributionHeatmap';
