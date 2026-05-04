/**
 * Gamification Primitives — @hki/ui
 *
 * Platform-wide achievement badges, streaks, leaderboards,
 * impact stats, celebrations, and contribution heatmaps.
 * Designed for use across Knowledge Base, Chat, Admin, and
 * any future app that tracks user contributions.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type {
  BadgeTier,
  AchievementBadgeData,
  StreakData,
  LeaderboardEntry,
  ImpactData,
  ContributionEvent,
  StreamScore,
} from './types';

// ── Achievement Badge ────────────────────────────────────────────────────────

export {
  AchievementBadge,
  achievementBadgeVariants,
  TIER_STYLES,
  TIER_LABEL,
} from './achievement-badge';
export type { AchievementBadgeProps } from './achievement-badge';

// ── Badge Grid ───────────────────────────────────────────────────────────────

export { BadgeGrid } from './badge-grid';
export type { BadgeGridProps } from './badge-grid';

// ── Streak Indicator ─────────────────────────────────────────────────────────

export { StreakIndicator } from './streak-indicator';
export type { StreakIndicatorProps } from './streak-indicator';

// ── Score Ring ───────────────────────────────────────────────────────────────

export { ScoreRing } from './score-ring';
export type { ScoreRingProps, ScoreRingThresholds } from './score-ring';

// ── Leaderboard ──────────────────────────────────────────────────────────────

export { Leaderboard } from './leaderboard';
export type { LeaderboardProps } from './leaderboard';

// ── Impact Stat ──────────────────────────────────────────────────────────────

export { ImpactStat } from './impact-stat';
export type { ImpactStatProps } from './impact-stat';

// ── Celebration (Confetti + Toast) ───────────────────────────────────────────

export {
  fireConfetti,
  fireMilestone,
  AchievementToast,
} from './celebration';
export type { ConfettiOptions, AchievementToastProps } from './celebration';

// ── Contribution Heatmap ─────────────────────────────────────────────────────

export { ContributionHeatmap } from './contribution-heatmap';
export type { ContributionHeatmapProps } from './contribution-heatmap';
