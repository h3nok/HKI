import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieClearOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  publicProcedure,
  protectedProcedure,
  scopedProcedure,
  router,
} from "./_core/trpc";
import { chatRouter } from "./chat";
import { mediaRouter } from "./media";
import { projectsRouter } from "./projects";
import { adminRouter } from "./admin";
import { knowledgeRouter } from "./knowledge";
import { geminiRouter } from "./gemini";
import { gamificationRouter } from "./gamification";
import { connectorsRouter } from "./connectors";
import { journeyRouter } from "./journey";
import { governanceRouter } from "./governance";
import { getDb } from "./db";
import { featureFlagOverrides, valueStreams } from "../drizzle/schema";
import { asc, eq } from "drizzle-orm";
import { buildViewerFeatureContext } from "./_core/feature-flags";
import { z } from "zod";
import { createLogger } from "./_core/logger";
import { DEBUG_FEATURE_FLAG_KEYS } from "@shared/feature-flags";
import {
  clearDebugSessionCookie,
  DEFAULT_DEBUG_SESSION_MINUTES,
  getDebugSessionState,
  issueDebugSession,
  MAX_DEBUG_SESSION_MINUTES,
  MIN_DEBUG_SESSION_MINUTES,
} from "./_core/debug-session";

const log = createLogger("auth-router");

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    // Public: returns user or null — must not throw on unauthenticated requests
    me: publicProcedure.query(opts => opts.ctx.user),
    viewerContext: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;

      const db = await getDb();
      const overrides = db
        ? await db
            .select({
              featureKey: featureFlagOverrides.featureKey,
              enabled: featureFlagOverrides.enabled,
            })
            .from(featureFlagOverrides)
            .where(eq(featureFlagOverrides.orgId, ctx.user.orgId || "default"))
        : [];

      const viewerContext = buildViewerFeatureContext({
        user: ctx.user,
        overrides,
      });

      const debugSession =
        ctx.user.role === "admin"
          ? await getDebugSessionState({
              req: ctx.req,
              expectedUserId: ctx.user.id,
              expectedOrgId: ctx.user.orgId || "default",
            })
          : {
              active: false,
              startedAt: null,
              expiresAt: null,
              minutesRemaining: 0,
              durationMinutes: null,
              reason: "missing" as const,
            };

      if (ctx.user.role !== "admin" || !debugSession.active) {
        for (const key of DEBUG_FEATURE_FLAG_KEYS) {
          viewerContext.flags[key] = false;
        }
      }

      if (
        debugSession.reason === "expired" ||
        debugSession.reason === "invalid"
      ) {
        clearDebugSessionCookie(ctx.req, ctx.res);
      }

      return {
        ...viewerContext,
        debugSession: {
          active: debugSession.active,
          startedAt: debugSession.startedAt,
          expiresAt: debugSession.expiresAt,
          minutesRemaining: debugSession.minutesRemaining,
          durationMinutes: debugSession.durationMinutes,
        },
      };
    }),
    startDebugSession: adminProcedure
      .input(
        z
          .object({
            durationMinutes: z
              .number()
              .int()
              .min(MIN_DEBUG_SESSION_MINUTES)
              .max(MAX_DEBUG_SESSION_MINUTES)
              .default(DEFAULT_DEBUG_SESSION_MINUTES),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.user.orgId || "default";
        const debugSession = await issueDebugSession({
          req: ctx.req,
          res: ctx.res,
          userId: ctx.user.id,
          orgId,
          durationMinutes: input?.durationMinutes,
        });

        log.info(
          {
            userId: ctx.user.id,
            orgId,
            durationMinutes: debugSession.durationMinutes,
          },
          "Debug session activated"
        );

        return {
          success: true,
          debugSession,
        } as const;
      }),
    stopDebugSession: protectedProcedure.mutation(({ ctx }) => {
      clearDebugSessionCookie(ctx.req, ctx.res);
      log.info(
        { userId: ctx.user.id, orgId: ctx.user.orgId || "default" },
        "Debug session cleared"
      );
      return {
        success: true,
      } as const;
    }),
    // Public: allow logout even with expired/invalid sessions
    logout: publicProcedure.mutation(({ ctx }) => {
      clearDebugSessionCookie(ctx.req, ctx.res);
      for (const cookieOptions of getSessionCookieClearOptions(ctx.req)) {
        ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      }
      return {
        success: true,
      } as const;
    }),
  }),

  // Chat router for agentic conversations
  chat: chatRouter,

  // Projects router for organizing conversations
  projects: projectsRouter,

  // Media router for file uploads & voice transcription
  media: mediaRouter,

  // Scope: RBAC-filtered value streams — returns only streams the user is assigned to
  scope: router({
    /** List active value streams for the current user (RBAC-filtered) */
    listStreams: scopedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: valueStreams.id,
          name: valueStreams.name,
          description: valueStreams.description,
          icon: valueStreams.icon,
          isActive: valueStreams.isActive,
          sampleQuestions: valueStreams.sampleQuestions,
          retrievalStrategy: valueStreams.retrievalStrategy,
          enabledTools: valueStreams.enabledTools,
          guardrailConfig: valueStreams.guardrailConfig,
          memoryConfig: valueStreams.memoryConfig,
          knowledgeConfig: valueStreams.knowledgeConfig,
        })
        .from(valueStreams)
        .where(eq(valueStreams.isActive, 1))
        .orderBy(asc(valueStreams.name));

      // Admins see everything; others see only their assigned streams
      if (ctx.isGlobalScope) return rows;
      return rows.filter(r => r.id === "global" || ctx.scopes.includes(r.id));
    }),
  }),

  // Admin router for value-stream & user management (admin-only)
  admin: adminRouter,

  // Knowledge self-service — manager+ auth (ingestion, documents, search, stats)
  knowledge: knowledgeRouter,

  // Gemini AI helpers — persona generation, gap analysis, ingestion planning
  gemini: geminiRouter,

  // Gamification — contributions, badges, streaks, leaderboard
  gamification: gamificationRouter,

  // Knowledge Connectors — external source sync (Drive, SharePoint, DBs, etc.)
  connectors: connectorsRouter,

  // Knowledge Journey — step-by-step onboarding progress tracking
  journey: journeyRouter,

  // Governance — platform-wide stats, traces, tool analytics, activity feed
  governance: governanceRouter,
});

export type AppRouter = typeof appRouter;
