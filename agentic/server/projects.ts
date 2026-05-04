import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { projects, conversations } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hasPermission, type Role } from "./auth/rbac";
import {
  assertAuthorizedChatScope,
  getAllowedChatScopes,
} from "./_core/chat-scope-auth";

function requirePermission(
  role: string,
  permission: Parameters<typeof hasPermission>[1]
) {
  if (!hasPermission(role as Role, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Missing permission: ${permission}`,
    });
  }
}

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.user.id))
      .orderBy(asc(projects.sortOrder), asc(projects.name));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        emoji: z.string().max(8).optional(),
        color: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.user.role, "chat:write");
      const db = await getDb();
      if (!db) {
        return { id: nanoid(), name: input.name, emoji: input.emoji ?? "📁" };
      }

      const id = nanoid();
      await db.insert(projects).values({
        id,
        userId: ctx.user.id,
        name: input.name,
        emoji: input.emoji ?? "📁",
        color: input.color ?? null,
      });

      return { id, name: input.name, emoji: input.emoji ?? "📁" };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: true };

      const [project] = await db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }

      await db
        .update(projects)
        .set({ name: input.name })
        .where(eq(projects.id, input.projectId));

      return { success: true };
    }),

  updateEmoji: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        emoji: z.string().max(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: true };

      const [project] = await db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }

      await db
        .update(projects)
        .set({ emoji: input.emoji })
        .where(eq(projects.id, input.projectId));

      return { success: true };
    }),

  /** Conversations are unlinked, not deleted */
  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.user.role, "chat:delete");
      const db = await getDb();
      if (!db) return { success: true };

      const [project] = await db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }

      // Unlink conversations (set projectId to null)
      await db
        .update(conversations)
        .set({ projectId: null })
        .where(eq(conversations.projectId, input.projectId));

      // Delete the project
      await db.delete(projects).where(eq(projects.id, input.projectId));

      return { success: true };
    }),

  moveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        projectId: z.string().nullable(), // null = remove from project
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: true };

      // Verify conversation ownership
      const [conv] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conv.scope
      );
      assertAuthorizedChatScope(
        conv.scope,
        allowedScopes,
        "Conversation not found"
      );

      // If moving to a project, verify project ownership
      if (input.projectId) {
        const [project] = await db
          .select({ userId: projects.userId })
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1);

        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Project not found",
          });
        }
      }

      await db
        .update(conversations)
        .set({ projectId: input.projectId })
        .where(eq(conversations.id, input.conversationId));

      return { success: true };
    }),
});
