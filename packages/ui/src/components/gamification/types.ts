/**
 * Gamification — Shared Types
 *
 * Platform-wide type definitions for achievement badges, streaks,
 * leaderboards, and contribution tracking. Used across all apps
 * (Knowledge Base, Chat, Admin).
 */

// ── Badge System ─────────────────────────────────────────────────────────────

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'secret';

export interface AchievementBadgeData {
  /** Unique key, e.g. 'first_upload', 'knowledge_hero' */
  key: string;
  /** Display name */
  name: string;
  /** Emoji icon */
  icon: string;
  /** Tier determines visual treatment */
  tier: BadgeTier;
  /** Short description of unlock criteria */
  description: string;
  /** Motivational quote shown on unlock */
  flavorText: string;
  /** ISO date string if earned, null/undefined if locked */
  earnedAt?: string | null;
  /** Optional category for grouping */
  category?: string;
}

// ── Streak System ────────────────────────────────────────────────────────────

export interface StreakData {
  /** Current consecutive days */
  current: number;
  /** All-time longest streak */
  longest: number;
  /** Is the streak shield still available? */
  shieldAvailable: boolean;
  /** Current point multiplier (1.0–2.0) */
  multiplier: number;
  /** Days until next streak badge */
  daysToNextBadge: number;
  /** Name of the next streak badge */
  nextBadgeName: string;
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  /** Unique user ID */
  userId: string;
  /** Display name */
  name: string;
  /** Avatar URL or initials */
  avatar?: string;
  /** Total points */
  points: number;
  /** Current streak days */
  streak: number;
  /** Number of badges earned */
  badgeCount: number;
  /** Lifetime impact: conversations helped */
  conversationsHelped: number;
  /** Rank position (1-indexed) */
  rank: number;
  /** Top 3 badge icons for display */
  topBadges?: string[];
}

// ── Contribution / Impact ────────────────────────────────────────────────────

export interface ImpactData {
  /** Total times documents were cited in agent responses */
  citationCount: number;
  /** Unique users who received answers from your docs */
  uniqueUsersHelped: number;
  /** Estimated hours of manual lookup saved */
  hoursSaved: number;
  /** Percentage of positive feedback on answers */
  positiveRate: number;
  /** Rank among all contributors in this stream */
  streamRank: number;
  /** Total contributors in this stream */
  streamTotal: number;
}

export interface ContributionEvent {
  id: string;
  action: string;
  label: string;
  icon: string;
  points: number;
  timestamp: string;
  documentTitle?: string;
}

// ── Stream Score ─────────────────────────────────────────────────────────────

export interface StreamScore {
  streamId: string;
  streamName: string;
  streamIcon?: string;
  compositeScore: number;
  coverageScore: number;
  qualityScore: number;
  freshnessScore: number;
  contributorCount: number;
  documentCount: number;
  rank: number;
  teamBadges?: string[];
}
