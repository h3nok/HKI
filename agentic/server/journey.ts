/**
 * Knowledge Journey Progress — tRPC Router
 *
 * Enterprise-grade step tracking for the 8-step knowledge setup journey.
 * Handles progress persistence, completion tracking, and next-step recommendations.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { knowledgeJourneyProgress } from "../drizzle/schema";
import { requireAuthorizedStreamId } from "./_core/value-stream-access";

// ── Journey Step IDs ─────────────────────────────────────────────────────────
const JOURNEY_STEPS = [
  "gap-analysis",
  "organize",
  "connect",
  "run",
  "browse",
  "analyze",
  "test",
  "iterate",
] as const;

type JourneyStep = (typeof JOURNEY_STEPS)[number];

function resolveJourneyStreamId(
  ctx: Parameters<typeof requireAuthorizedStreamId>[0],
  requestedStreamId?: string | null
): string {
  return requireAuthorizedStreamId(ctx, requestedStreamId, {
    allowGlobalSelection: false,
    missingSelectionMessage:
      "Select a value stream before using the Knowledge journey",
  });
}

// ── Helper: Get or Create Journey ───────────────────────────────────────────
async function getOrCreateJourney(
  userId: number,
  valueStreamId: string,
  orgId: string
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable",
    });

  const [existing] = await db
    .select()
    .from(knowledgeJourneyProgress)
    .where(
      and(
        eq(knowledgeJourneyProgress.userId, userId),
        eq(knowledgeJourneyProgress.valueStreamId, valueStreamId)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new journey starting at step 1
  await db.insert(knowledgeJourneyProgress).values({
    userId,
    valueStreamId,
    orgId,
    currentStep: "add",
    completedSteps: "[]",
    completionTimestamps: "{}",
    dismissedBanners: "[]",
    journeyDismissed: 0,
  });

  const [created] = await db
    .select()
    .from(knowledgeJourneyProgress)
    .where(
      and(
        eq(knowledgeJourneyProgress.userId, userId),
        eq(knowledgeJourneyProgress.valueStreamId, valueStreamId)
      )
    )
    .limit(1);

  return created;
}

// ── Helper: Calculate Next Step ─────────────────────────────────────────────
function getNextStep(completedSteps: string[]): JourneyStep | null {
  for (const step of JOURNEY_STEPS) {
    if (!completedSteps.includes(step)) {
      return step;
    }
  }
  return null; // All steps complete
}

// ── tRPC Router ──────────────────────────────────────────────────────────────
export const journeyRouter = router({
  /**
   * Get current journey progress for the active value stream
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        valueStreamId: z
          .string()
          .min(1, "Select a value stream before using the Knowledge journey"),
      })
    )
    .query(async ({ ctx, input }) => {
      const valueStreamId = resolveJourneyStreamId(ctx, input.valueStreamId);
      const journey = await getOrCreateJourney(
        ctx.user.id,
        valueStreamId,
        ctx.user.orgId
      );

      if (!journey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journey",
        });
      }

      const completedSteps = JSON.parse(journey.completedSteps) as string[];
      const completionTimestamps = JSON.parse(
        journey.completionTimestamps
      ) as Record<string, string>;
      const dismissedBanners = JSON.parse(journey.dismissedBanners) as string[];

      const nextStep = getNextStep(completedSteps);
      const progress = (completedSteps.length / JOURNEY_STEPS.length) * 100;

      return {
        currentStep: journey.currentStep,
        nextStep,
        completedSteps,
        completionTimestamps,
        dismissedBanners,
        journeyDismissed: journey.journeyDismissed === 1,
        progress: Math.round(progress),
        totalSteps: JOURNEY_STEPS.length,
        lastActiveAt: journey.lastActiveAt,
      };
    }),

  /**
   * Mark a step as complete and advance to the next step
   */
  completeStep: protectedProcedure
    .input(
      z.object({
        valueStreamId: z
          .string()
          .min(1, "Select a value stream before using the Knowledge journey"),
        stepId: z.enum(JOURNEY_STEPS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const valueStreamId = resolveJourneyStreamId(ctx, input.valueStreamId);
      const journey = await getOrCreateJourney(
        ctx.user.id,
        valueStreamId,
        ctx.user.orgId
      );

      if (!journey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journey",
        });
      }

      const completedSteps = JSON.parse(journey.completedSteps) as string[];
      const completionTimestamps = JSON.parse(
        journey.completionTimestamps
      ) as Record<string, string>;

      // Idempotent: don't re-add if already completed
      if (!completedSteps.includes(input.stepId)) {
        completedSteps.push(input.stepId);
        completionTimestamps[input.stepId] = new Date().toISOString();
      }

      const nextStep = getNextStep(completedSteps);

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await db
        .update(knowledgeJourneyProgress)
        .set({
          currentStep: nextStep ?? input.stepId,
          completedSteps: JSON.stringify(completedSteps),
          completionTimestamps: JSON.stringify(completionTimestamps),
          lastActiveAt: new Date(),
        })
        .where(eq(knowledgeJourneyProgress.id, journey.id));

      return {
        success: true,
        nextStep,
        progress: Math.round(
          (completedSteps.length / JOURNEY_STEPS.length) * 100
        ),
      };
    }),

  /**
   * Dismiss a next-step banner (prevent re-showing)
   */
  dismissBanner: protectedProcedure
    .input(
      z.object({
        valueStreamId: z
          .string()
          .min(1, "Select a value stream before using the Knowledge journey"),
        bannerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const valueStreamId = resolveJourneyStreamId(ctx, input.valueStreamId);
      const journey = await getOrCreateJourney(
        ctx.user.id,
        valueStreamId,
        ctx.user.orgId
      );

      if (!journey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journey",
        });
      }

      const dismissedBanners = JSON.parse(journey.dismissedBanners) as string[];

      if (!dismissedBanners.includes(input.bannerId)) {
        dismissedBanners.push(input.bannerId);
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await db
        .update(knowledgeJourneyProgress)
        .set({
          dismissedBanners: JSON.stringify(dismissedBanners),
          lastActiveAt: new Date(),
        })
        .where(eq(knowledgeJourneyProgress.id, journey.id));

      return { success: true };
    }),

  /**
   * Permanently dismiss the entire journey (opt-out)
   */
  dismissJourney: protectedProcedure
    .input(
      z.object({
        valueStreamId: z
          .string()
          .min(1, "Select a value stream before using the Knowledge journey"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const valueStreamId = resolveJourneyStreamId(ctx, input.valueStreamId);
      const journey = await getOrCreateJourney(
        ctx.user.id,
        valueStreamId,
        ctx.user.orgId
      );

      if (!journey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journey",
        });
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await db
        .update(knowledgeJourneyProgress)
        .set({
          journeyDismissed: 1,
          lastActiveAt: new Date(),
        })
        .where(eq(knowledgeJourneyProgress.id, journey.id));

      return { success: true };
    }),

  /**
   * Reset journey progress (admin/testing)
   */
  resetJourney: protectedProcedure
    .input(
      z.object({
        valueStreamId: z
          .string()
          .min(1, "Select a value stream before using the Knowledge journey"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const valueStreamId = resolveJourneyStreamId(ctx, input.valueStreamId);
      const journey = await getOrCreateJourney(
        ctx.user.id,
        valueStreamId,
        ctx.user.orgId
      );

      if (!journey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journey",
        });
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await db
        .update(knowledgeJourneyProgress)
        .set({
          currentStep: "gap-analysis",
          completedSteps: "[]",
          completionTimestamps: "{}",
          dismissedBanners: "[]",
          journeyDismissed: 0,
          lastActiveAt: new Date(),
        })
        .where(eq(knowledgeJourneyProgress.id, journey.id));

      return { success: true };
    }),
});
