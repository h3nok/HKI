'use client';

/**
 * Celebration — Confetti burst + achievement toast primitives
 *
 * Platform-wide celebration effects for badge unlocks, milestones,
 * and team achievements. Uses canvas-confetti for lightweight,
 * zero-dependency particle effects.
 *
 * Usage:
 *   fireConfetti();
 *   fireConfetti({ origin: { x: 0.5, y: 0.3 }, particleCount: 80 });
 *
 *   <AchievementToast badge={badge} onDismiss={fn} />
 */

import * as React from 'react';
import confetti from 'canvas-confetti';
import { cn } from '../../utils';
import type { AchievementBadgeData, BadgeTier } from './types';

// ── Confetti presets ─────────────────────────────────────────────────────────

export interface ConfettiOptions {
  /** Burst origin {x: 0–1, y: 0–1} — default: center-top */
  origin?: { x: number; y: number };
  /** Number of particles — default: 80 */
  particleCount?: number;
  /** Spread angle — default: 70 */
  spread?: number;
}

const TIER_COLORS: Record<BadgeTier, string[][]> = {
  bronze:  [['#CD7F32', '#A0522D'], ['#DAA520', '#8B4513']],
  silver:  [['#C0C0C0', '#A8A8A8'], ['#D3D3D3', '#808080']],
  gold:    [['#FFD700', '#FFA500'], ['#FFEC8B', '#DAA520']],
  diamond: [['#00CED1', '#00BFFF'], ['#7FFFD4', '#40E0D0']],
  secret:  [['#9B59B6', '#8E44AD'], ['#BB8FCE', '#6C3483']],
};

/**
 * Fire a confetti burst. Call this imperatively when a badge is unlocked.
 */
export function fireConfetti(options?: ConfettiOptions & { tier?: BadgeTier }) {
  const { origin = { x: 0.5, y: 0.3 }, particleCount = 80, spread = 70, tier } = options ?? {};

  const colors = tier ? TIER_COLORS[tier]?.flat() : ['#10b981', '#0066B2', '#f59e0b', '#7c3aed', '#ef4444'];

  // Main burst
  confetti({
    particleCount,
    spread,
    origin,
    colors,
    ticks: 200,
    gravity: 1.2,
    scalar: 1.1,
    drift: 0,
  });

  // Side bursts for diamond/gold
  if (tier === 'diamond' || tier === 'gold') {
    setTimeout(() => {
      confetti({ particleCount: 30, angle: 60, spread: 50, origin: { x: 0, y: 0.6 }, colors });
      confetti({ particleCount: 30, angle: 120, spread: 50, origin: { x: 1, y: 0.6 }, colors });
    }, 200);
  }
}

/**
 * Fire a star-shaped burst for milestones.
 */
export function fireMilestone() {
  const defaults = {
    spread: 360,
    ticks: 100,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#7B68EE'],
  };

  confetti({ ...defaults, particleCount: 50, scalar: 1.2, shapes: ['star'] });
  confetti({ ...defaults, particleCount: 25, scalar: 0.75, shapes: ['circle'] });
}

// ── Achievement Toast ────────────────────────────────────────────────────────

const TIER_TOAST_STYLES: Record<BadgeTier, { bg: string; ring: string; glow: string }> = {
  bronze:  { bg: 'bg-amber-900/5 dark:bg-amber-400/5', ring: 'ring-amber-700/20', glow: '' },
  silver:  { bg: 'bg-slate-400/5 dark:bg-slate-300/5', ring: 'ring-slate-400/20', glow: '' },
  gold:    { bg: 'bg-yellow-400/8 dark:bg-yellow-300/8', ring: 'ring-yellow-400/30', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.15)]' },
  diamond: { bg: 'bg-cyan-400/8 dark:bg-cyan-300/8', ring: 'ring-cyan-400/30', glow: 'shadow-[0_0_24px_rgba(34,211,238,0.15)]' },
  secret:  { bg: 'bg-purple-400/8 dark:bg-purple-300/8', ring: 'ring-purple-400/30', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
};

export interface AchievementToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The badge that was just unlocked */
  badge: AchievementBadgeData;
  /** Called when user dismisses the toast */
  onDismiss?: () => void;
  /** Auto-fire confetti on mount */
  autoConfetti?: boolean;
}

export const AchievementToast = React.forwardRef<HTMLDivElement, AchievementToastProps>(
  ({ badge, onDismiss, autoConfetti = true, className, ...props }, ref) => {
    const style = TIER_TOAST_STYLES[badge.tier] || TIER_TOAST_STYLES.bronze;

    React.useEffect(() => {
      if (autoConfetti) {
        fireConfetti({ tier: badge.tier });
      }
    }, [autoConfetti, badge.tier]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative p-4 rounded-2xl ring-1 max-w-sm mx-auto',
          style.bg, style.ring, style.glow,
          className,
        )}
        role="alert"
        {...props}
      >
        <div className="text-center space-y-1.5">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            Achievement Unlocked!
          </p>
          <p className="text-3xl select-none">{badge.icon}</p>
          <p className="text-sm font-bold text-foreground">{badge.name}</p>
          <p className="text-xs text-muted-foreground italic">
            &ldquo;{badge.flavorText}&rdquo;
          </p>
        </div>

        {onDismiss && (
          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
            >
              Nice!
            </button>
          </div>
        )}
      </div>
    );
  },
);

AchievementToast.displayName = 'AchievementToast';
