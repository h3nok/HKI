/**
 * Badge Catalog — Canonical registry of all achievement badges
 *
 * These are constant definitions, not data. They define what badges
 * exist in the system and the criteria for earning each one.
 * Badge checks run server-side after every contribution event.
 *
 * Check functions receive the user's KnowledgeProfile and return
 * true if the badge should be awarded.
 */

import type { KnowledgeProfile } from "../../drizzle/schema";

// ── Types ────────────────────────────────────────────────────────────────────

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond" | "secret";

export interface BadgeDefinition {
  key: string;
  name: string;
  icon: string;
  tier: BadgeTier;
  category: string;
  description: string;
  flavorText: string;
  check: (profile: KnowledgeProfile) => boolean;
}

// ── Point Values ─────────────────────────────────────────────────────────────

export const CONTRIBUTION_POINTS: Record<string, number> = {
  upload: 10,
  review: 8,
  approve: 3,
  reject: 5,
  update: 12,
  fill_gap: 20,
  fix_contradiction: 15,
  test_query: 2,
  report_error: 5,
  invite: 3,
  citation: 1,
};

// ── Streak Multiplier ────────────────────────────────────────────────────────

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.8;
  if (streakDays >= 7) return 1.5;
  if (streakDays >= 3) return 1.2;
  return 1.0;
}

// ── Badge Catalog ────────────────────────────────────────────────────────────

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ── Contributor ──────────────────────────────────────────────────────────
  {
    key: "first_upload",
    name: "First Upload",
    icon: "🌱",
    tier: "bronze",
    category: "Contributor",
    description: "Upload your first document",
    flavorText: "Every knowledge base starts with a single document",
    check: (p) => p.totalUploads >= 1,
  },
  {
    key: "library_builder",
    name: "Library Builder",
    icon: "📚",
    tier: "silver",
    category: "Contributor",
    description: "Upload 10 documents",
    flavorText: "Building a foundation of knowledge",
    check: (p) => p.totalUploads >= 10,
  },
  {
    key: "knowledge_architect",
    name: "Knowledge Architect",
    icon: "🏗️",
    tier: "gold",
    category: "Contributor",
    description: "Upload 50 documents",
    flavorText: "Shaping how your team understands the world",
    check: (p) => p.totalUploads >= 50,
  },
  {
    key: "living_encyclopedia",
    name: "Living Encyclopedia",
    icon: "📖",
    tier: "diamond",
    category: "Contributor",
    description: "Upload 200 documents",
    flavorText: "Your contributions define this domain",
    check: (p) => p.totalUploads >= 200,
  },

  // ── Curation ────────────────────────────────────────────────────────────
  {
    key: "first_review",
    name: "First Review",
    icon: "👁️",
    tier: "bronze",
    category: "Curation",
    description: "Review your first document",
    flavorText: "Fresh eyes make better knowledge",
    check: (p) => p.totalReviews >= 1,
  },
  {
    key: "gatekeeper",
    name: "Gatekeeper",
    icon: "🛡️",
    tier: "silver",
    category: "Curation",
    description: "Review 25 documents",
    flavorText: "Trusted guardian of knowledge quality",
    check: (p) => p.totalReviews >= 25,
  },
  {
    key: "quality_czar",
    name: "Quality Czar",
    icon: "⚖️",
    tier: "diamond",
    category: "Curation",
    description: "Review 100 documents",
    flavorText: "Your reviews make everyone better",
    check: (p) => p.totalReviews >= 100,
  },

  // ── Impact ──────────────────────────────────────────────────────────────
  {
    key: "first_citation",
    name: "First Citation",
    icon: "💬",
    tier: "bronze",
    category: "Impact",
    description: "Your document cited in an agent response",
    flavorText: "Your knowledge is already helping people",
    check: (p) => p.totalCitations >= 1,
  },
  {
    key: "crowd_favorite",
    name: "Crowd Favorite",
    icon: "❤️",
    tier: "silver",
    category: "Impact",
    description: "Documents cited 100+ times",
    flavorText: "The people have spoken",
    check: (p) => p.totalCitations >= 100,
  },
  {
    key: "knowledge_hero",
    name: "Knowledge Hero",
    icon: "🦸",
    tier: "gold",
    category: "Impact",
    description: "Documents cited 1,000+ times",
    flavorText: "A thousand conversations improved",
    check: (p) => p.totalCitations >= 1000,
  },
  {
    key: "hall_of_fame",
    name: "Hall of Fame",
    icon: "🏛️",
    tier: "diamond",
    category: "Impact",
    description: "Documents cited 10,000+ times",
    flavorText: "Your work has become institutional knowledge",
    check: (p) => p.totalCitations >= 10000,
  },

  // ── Streaks ─────────────────────────────────────────────────────────────
  {
    key: "getting_started",
    name: "Getting Started",
    icon: "🔥",
    tier: "bronze",
    category: "Streak",
    description: "3-day contribution streak",
    flavorText: "Momentum is building",
    check: (p) => p.longestStreak >= 3,
  },
  {
    key: "on_a_roll",
    name: "On a Roll",
    icon: "⚡",
    tier: "silver",
    category: "Streak",
    description: "7-day contribution streak",
    flavorText: "A week of dedication",
    check: (p) => p.longestStreak >= 7,
  },
  {
    key: "unstoppable",
    name: "Unstoppable",
    icon: "🚀",
    tier: "gold",
    category: "Streak",
    description: "30-day contribution streak",
    flavorText: "A month of excellence",
    check: (p) => p.longestStreak >= 30,
  },
  {
    key: "relentless",
    name: "Relentless",
    icon: "💫",
    tier: "diamond",
    category: "Streak",
    description: "90-day contribution streak",
    flavorText: "Three months. Unwavering.",
    check: (p) => p.longestStreak >= 90,
  },

  // ── Points ──────────────────────────────────────────────────────────────
  {
    key: "first_hundred",
    name: "First Hundred",
    icon: "💯",
    tier: "bronze",
    category: "Points",
    description: "Earn 100 total points",
    flavorText: "The journey of a thousand points starts here",
    check: (p) => p.totalPoints >= 100,
  },
  {
    key: "point_machine",
    name: "Point Machine",
    icon: "⚙️",
    tier: "silver",
    category: "Points",
    description: "Earn 500 total points",
    flavorText: "A well-oiled contribution machine",
    check: (p) => p.totalPoints >= 500,
  },
  {
    key: "grandmaster",
    name: "Grandmaster",
    icon: "🎖️",
    tier: "gold",
    category: "Points",
    description: "Earn 2,000 total points",
    flavorText: "Mastery through persistence",
    check: (p) => p.totalPoints >= 2000,
  },

  // ── Secret ──────────────────────────────────────────────────────────────
  {
    key: "night_owl",
    name: "Night Owl",
    icon: "🦉",
    tier: "secret",
    category: "Secret",
    description: "Upload a document after midnight",
    flavorText: "Knowledge never sleeps",
    check: () => false, // checked via event metadata, not profile
  },
  {
    key: "polyglot",
    name: "Polyglot",
    icon: "🌍",
    tier: "secret",
    category: "Secret",
    description: "Contribute to 3+ different streams",
    flavorText: "Cross-domain knowledge architect",
    check: () => false, // checked via contribution query, not profile
  },
];

/** Look up a badge definition by key */
export function getBadgeDefinition(key: string): BadgeDefinition | undefined {
  return BADGE_CATALOG.find((b) => b.key === key);
}

/** Get all badges a profile qualifies for (profile-checkable only) */
export function checkBadges(profile: KnowledgeProfile): BadgeDefinition[] {
  return BADGE_CATALOG.filter((b) => b.check(profile));
}
