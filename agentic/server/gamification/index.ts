/**
 * Gamification Router — tRPC procedures for contributions, badges, streaks, leaderboard
 *
 * All writes go through recordContribution() which:
 *   1. Inserts a contribution event
 *   2. Updates the user's profile (points, streak, counters)
 *   3. Checks for newly earned badges
 *   4. Returns any new badges so the client can show celebrations
 *
 * Auth: manager+ role (same as knowledge router)
 */

import { z } from "zod";
import { eq, desc, sql, and, gte, isNull, or } from "drizzle-orm";
import { managerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { resolveAuthorizedStreamId } from "../_core/value-stream-access";
import { requireAuthorizedStreamId } from "../_core/value-stream-access";
import {
  knowledgeContributions,
  knowledgeProfiles,
  knowledgeBadges,
  knowledgeDocumentImpact,
  knowledgeStreamScores,
  users,
  type KnowledgeProfile,
} from "../../drizzle/schema";
import {
  BADGE_CATALOG,
  CONTRIBUTION_POINTS,
  getStreakMultiplier,
  checkBadges,
  getBadgeDefinition,
} from "./badge-catalog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

/** Ensure a profile row exists for a user; return it. */
async function ensureProfile(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number
): Promise<KnowledgeProfile> {
  const existing = await db
    .select()
    .from(knowledgeProfiles)
    .where(eq(knowledgeProfiles.userId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  const now = new Date();
  await db.insert(knowledgeProfiles).values({
    userId,
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastContributionDate: null,
    streakShieldAvailable: 1,
    totalUploads: 0,
    totalReviews: 0,
    totalCitations: 0,
    totalUsersHelped: 0,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select()
    .from(knowledgeProfiles)
    .where(eq(knowledgeProfiles.userId, userId))
    .limit(1);

  return created[0]!;
}

/** Update streak based on last contribution date. Returns new streak count. */
function computeStreak(
  profile: KnowledgeProfile,
  today: string
): { current: number; longest: number } {
  const last = profile.lastContributionDate;
  if (!last) return { current: 1, longest: Math.max(profile.longestStreak, 1) };

  const lastDate = new Date(last);
  const todayDate = new Date(today);
  const diffMs = todayDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    // Same day — no streak change
    return { current: profile.currentStreak, longest: profile.longestStreak };
  }
  if (diffDays === 1) {
    // Consecutive day — extend streak
    const newCurrent = profile.currentStreak + 1;
    return {
      current: newCurrent,
      longest: Math.max(profile.longestStreak, newCurrent),
    };
  }
  // Gap — streak resets
  return { current: 1, longest: profile.longestStreak };
}

/** Check for newly earned badges and insert them. Returns array of new badge keys. */
async function awardNewBadges(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  profile: KnowledgeProfile
): Promise<string[]> {
  // Get already-earned badge keys
  const earned = await db
    .select({ badgeKey: knowledgeBadges.badgeKey })
    .from(knowledgeBadges)
    .where(eq(knowledgeBadges.userId, userId));

  const earnedKeys = new Set(earned.map(b => b.badgeKey));

  // Check which badges the profile now qualifies for
  const qualified = checkBadges(profile);
  const newBadges = qualified.filter(b => !earnedKeys.has(b.key));

  // Insert new badges
  for (const badge of newBadges) {
    await db.insert(knowledgeBadges).values({
      id: generateId(),
      userId,
      badgeKey: badge.key,
      tier: badge.tier,
      metadata: JSON.stringify({ trigger: "profile_check" }),
      earnedAt: new Date(),
    });
  }

  return newBadges.map(b => b.key);
}

// ── Router ───────────────────────────────────────────────────────────────────

export const gamificationRouter = router({
  // ═══════════════════════════════════════════════════════════════════════════
  // Record a contribution — the core write path
  // ═══════════════════════════════════════════════════════════════════════════

  recordContribution: managerProcedure
    .input(
      z.object({
        action: z.enum([
          "upload",
          "review",
          "approve",
          "reject",
          "update",
          "fill_gap",
          "fix_contradiction",
          "test_query",
          "report_error",
          "invite",
        ]),
        valueStreamId: z.string().optional(),
        documentId: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { points: 0, newBadges: [] };

      const userId = ctx.user.id;
      const today = todayISO();
      const resolvedValueStreamId = requireAuthorizedStreamId(
        ctx,
        input.valueStreamId,
        {
          allowGlobalSelection: false,
          missingSelectionMessage:
            "Select a value stream before recording a knowledge contribution",
        }
      );

      // 1. Get/create profile
      const profile = await ensureProfile(db, userId);

      // 2. Compute streak + multiplier
      const { current: newStreak, longest: newLongest } = computeStreak(
        profile,
        today
      );
      const multiplier = getStreakMultiplier(newStreak);
      const basePoints = CONTRIBUTION_POINTS[input.action] ?? 0;
      const earnedPoints = Math.round(basePoints * multiplier);

      // 3. Insert contribution event
      await db.insert(knowledgeContributions).values({
        id: generateId(),
        userId,
        valueStreamId: resolvedValueStreamId ?? null,
        action: input.action,
        documentId: input.documentId ?? null,
        points: earnedPoints,
        multiplier: Math.round(multiplier * 100),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: new Date(),
      });

      // 4. Update profile counters
      const counterUpdate: Record<string, any> = {
        totalPoints: profile.totalPoints + earnedPoints,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastContributionDate: today,
      };

      if (input.action === "upload")
        counterUpdate.totalUploads = profile.totalUploads + 1;
      if (input.action === "review")
        counterUpdate.totalReviews = profile.totalReviews + 1;

      await db
        .update(knowledgeProfiles)
        .set(counterUpdate)
        .where(eq(knowledgeProfiles.userId, userId));

      // 5. Check for new badges
      const updatedProfile = {
        ...profile,
        ...counterUpdate,
      } as KnowledgeProfile;
      const newBadgeKeys = await awardNewBadges(db, userId, updatedProfile);

      // 6. Return results to client
      const newBadges = newBadgeKeys
        .map(getBadgeDefinition)
        .filter(Boolean)
        .map(b => ({
          key: b!.key,
          name: b!.name,
          icon: b!.icon,
          tier: b!.tier,
          flavorText: b!.flavorText,
        }));

      return {
        points: earnedPoints,
        totalPoints: updatedProfile.totalPoints,
        streak: newStreak,
        multiplier,
        newBadges,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Profile — current user's gamification state
  // ═══════════════════════════════════════════════════════════════════════════

  getProfile: managerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const profile = await ensureProfile(db, ctx.user.id);
    const multiplier = getStreakMultiplier(profile.currentStreak);

    // Get earned badges
    const earned = await db
      .select()
      .from(knowledgeBadges)
      .where(eq(knowledgeBadges.userId, ctx.user.id))
      .orderBy(desc(knowledgeBadges.earnedAt));

    const earnedKeys = new Set(earned.map(b => b.badgeKey));

    // Build full badge list with earned status
    const badges = BADGE_CATALOG.map(def => ({
      key: def.key,
      name: def.name,
      icon: def.icon,
      tier: def.tier,
      category: def.category,
      description: def.description,
      flavorText: def.flavorText,
      earnedAt:
        earned.find(e => e.badgeKey === def.key)?.earnedAt?.toISOString() ??
        null,
    }));

    // Compute next streak badge
    const streakBadges = [
      { days: 3, name: "Getting Started" },
      { days: 7, name: "On a Roll" },
      { days: 30, name: "Unstoppable" },
      { days: 90, name: "Relentless" },
    ];
    const nextStreakBadge = streakBadges.find(
      b => profile.currentStreak < b.days
    );

    return {
      ...profile,
      multiplier,
      badges,
      earnedCount: earnedKeys.size,
      totalBadges: BADGE_CATALOG.length,
      streak: {
        current: profile.currentStreak,
        longest: profile.longestStreak,
        shieldAvailable: profile.streakShieldAvailable === 1,
        multiplier,
        daysToNextBadge: nextStreakBadge
          ? nextStreakBadge.days - profile.currentStreak
          : 0,
        nextBadgeName: nextStreakBadge?.name ?? "All earned!",
      },
    };
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Leaderboard — ranked by points within a time window
  // ═══════════════════════════════════════════════════════════════════════════

  getLeaderboard: managerProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().optional(),
          period: z.enum(["week", "month", "all"]).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const limit = input?.limit ?? 10;
      const resolvedValueStreamId = resolveAuthorizedStreamId(
        ctx,
        input?.valueStreamId
      );
      const hasSpecificStreamFilter = Boolean(
        resolvedValueStreamId && resolvedValueStreamId !== "global"
      );
      const hasGlobalFilter = resolvedValueStreamId === "global";

      // For "all time", use the profiles table (pre-aggregated)
      if (
        (!input?.period || input.period === "all") &&
        !resolvedValueStreamId
      ) {
        const rows = await db
          .select({
            userId: knowledgeProfiles.userId,
            name: users.name,
            email: users.email,
            points: knowledgeProfiles.totalPoints,
            streak: knowledgeProfiles.currentStreak,
            totalUploads: knowledgeProfiles.totalUploads,
            totalReviews: knowledgeProfiles.totalReviews,
            totalCitations: knowledgeProfiles.totalCitations,
            totalUsersHelped: knowledgeProfiles.totalUsersHelped,
          })
          .from(knowledgeProfiles)
          .innerJoin(users, eq(knowledgeProfiles.userId, users.id))
          .orderBy(desc(knowledgeProfiles.totalPoints))
          .limit(limit);

        // Get badge counts per user
        const userIds = rows.map(r => r.userId);
        const badgeCounts: Record<number, number> = {};
        if (userIds.length > 0) {
          for (const uid of userIds) {
            const countResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(knowledgeBadges)
              .where(eq(knowledgeBadges.userId, uid));
            badgeCounts[uid] = countResult[0]?.count ?? 0;
          }
        }

        return rows.map((row, i) => ({
          userId: String(row.userId),
          name: row.name ?? row.email ?? "Unknown",
          points: row.points,
          streak: row.streak,
          badgeCount: badgeCounts[row.userId] ?? 0,
          conversationsHelped: row.totalUsersHelped,
          rank: i + 1,
        }));
      }

      // For week/month, aggregate from contributions table
      const now = new Date();
      const sinceDate = new Date(now);
      if (input?.period === "week") sinceDate.setDate(now.getDate() - 7);
      else if (input?.period === "month") sinceDate.setDate(now.getDate() - 30);

      const filters = [] as Array<
        ReturnType<typeof eq> | ReturnType<typeof gte> | ReturnType<typeof or>
      >;
      if (input?.period === "week" || input?.period === "month") {
        filters.push(gte(knowledgeContributions.createdAt, sinceDate));
      }
      if (hasSpecificStreamFilter) {
        filters.push(
          eq(knowledgeContributions.valueStreamId, resolvedValueStreamId!)
        );
      } else if (hasGlobalFilter) {
        filters.push(
          or(
            isNull(knowledgeContributions.valueStreamId),
            eq(knowledgeContributions.valueStreamId, "global")
          )
        );
      }

      const rows = await db
        .select({
          userId: knowledgeContributions.userId,
          name: users.name,
          email: users.email,
          points: sql<number>`SUM(${knowledgeContributions.points})`,
        })
        .from(knowledgeContributions)
        .innerJoin(users, eq(knowledgeContributions.userId, users.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .groupBy(knowledgeContributions.userId, users.name, users.email)
        .orderBy(desc(sql`SUM(${knowledgeContributions.points})`))
        .limit(limit);

      return rows.map((row, i) => ({
        userId: String(row.userId),
        name: row.name ?? row.email ?? "Unknown",
        points: row.points ?? 0,
        streak: 0,
        badgeCount: 0,
        conversationsHelped: 0,
        rank: i + 1,
      }));
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Contributions — paginated history for the current user
  // ═══════════════════════════════════════════════════════════════════════════

  getContributions: managerProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { contributions: [], total: 0 };

      const limit = input?.limit ?? 25;
      const offset = input?.offset ?? 0;

      const rows = await db
        .select()
        .from(knowledgeContributions)
        .where(eq(knowledgeContributions.userId, ctx.user.id))
        .orderBy(desc(knowledgeContributions.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeContributions)
        .where(eq(knowledgeContributions.userId, ctx.user.id));

      return {
        contributions: rows.map(r => ({
          id: r.id,
          action: r.action,
          points: r.points,
          documentId: r.documentId,
          createdAt: r.createdAt.toISOString(),
        })),
        total: countResult[0]?.count ?? 0,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Contribution Heatmap — daily counts for the past N weeks
  // ═══════════════════════════════════════════════════════════════════════════

  getHeatmap: managerProcedure
    .input(
      z.object({ weeks: z.number().int().min(4).max(52).optional() }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return {};

      const weeks = input?.weeks ?? 26;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - weeks * 7);

      const rows = await db
        .select({
          date: sql<string>`DATE(${knowledgeContributions.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(knowledgeContributions)
        .where(
          and(
            eq(knowledgeContributions.userId, ctx.user.id),
            gte(knowledgeContributions.createdAt, sinceDate)
          )
        )
        .groupBy(sql`DATE(${knowledgeContributions.createdAt})`);

      const heatmap: Record<string, number> = {};
      for (const row of rows) {
        if (row.date) heatmap[row.date] = row.count;
      }
      return heatmap;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Use Streak Shield — one-time per streak
  // ═══════════════════════════════════════════════════════════════════════════

  useStreakShield: managerProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false, message: "Database unavailable" };

    const profile = await ensureProfile(db, ctx.user.id);

    if (!profile.streakShieldAvailable) {
      return { success: false, message: "Shield already used this streak" };
    }
    if (profile.currentStreak === 0) {
      return { success: false, message: "No active streak to protect" };
    }

    // Extend lastContributionDate by 1 day to cover the gap
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split("T")[0] ?? "";

    await db
      .update(knowledgeProfiles)
      .set({
        lastContributionDate: yesterdayISO,
        streakShieldAvailable: 0,
      })
      .where(eq(knowledgeProfiles.userId, ctx.user.id));

    return { success: true, message: "Streak shield activated!" };
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Badge Catalog — full list of badges (definitions, not user-specific)
  // ═══════════════════════════════════════════════════════════════════════════

  getBadgeCatalog: managerProcedure.query(() => {
    return BADGE_CATALOG.map(b => ({
      key: b.key,
      name: b.name,
      icon: b.icon,
      tier: b.tier,
      category: b.category,
      description: b.description,
      flavorText: b.flavorText,
    }));
  }),
});
