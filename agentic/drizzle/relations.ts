import { relations } from "drizzle-orm";
import {
  users,
  valueStreams,
  userValueStreams,
  projects,
  conversations,
  messages,
  thoughtTraceSteps,
  toolExecutions,
  knowledgeContributions,
  knowledgeProfiles,
  knowledgeBadges,
  knowledgeDocumentImpact,
  knowledgeStreamScores,
} from "./schema";

// ── User relations ────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  projects: many(projects),
  valueStreamAssignments: many(userValueStreams),
}));

// ── Value Stream relations ────────────────────────────────────────────────
export const valueStreamsRelations = relations(valueStreams, ({ many }) => ({
  userAssignments: many(userValueStreams),
}));

// ── User ↔ Value Stream join table ───────────────────────────────────────
export const userValueStreamsRelations = relations(userValueStreams, ({ one }) => ({
  user: one(users, {
    fields: [userValueStreams.userId],
    references: [users.id],
  }),
  valueStream: one(valueStreams, {
    fields: [userValueStreams.valueStreamId],
    references: [valueStreams.id],
  }),
}));

// ── Project relations ─────────────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

// ── Conversation relations ────────────────────────────────────────────────
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

// ── Message relations ─────────────────────────────────────────────────────
export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  thoughtTraceSteps: many(thoughtTraceSteps),
  toolExecutions: many(toolExecutions),
}));

// ── Thought Trace Step relations ──────────────────────────────────────────
export const thoughtTraceStepsRelations = relations(thoughtTraceSteps, ({ one }) => ({
  message: one(messages, {
    fields: [thoughtTraceSteps.messageId],
    references: [messages.id],
  }),
}));

// ── Tool Execution relations ──────────────────────────────────────────────
export const toolExecutionsRelations = relations(toolExecutions, ({ one }) => ({
  message: one(messages, {
    fields: [toolExecutions.messageId],
    references: [messages.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// GAMIFICATION RELATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const knowledgeContributionsRelations = relations(knowledgeContributions, ({ one }) => ({
  user: one(users, { fields: [knowledgeContributions.userId], references: [users.id] }),
  valueStream: one(valueStreams, { fields: [knowledgeContributions.valueStreamId], references: [valueStreams.id] }),
}));

export const knowledgeProfilesRelations = relations(knowledgeProfiles, ({ one }) => ({
  user: one(users, { fields: [knowledgeProfiles.userId], references: [users.id] }),
}));

export const knowledgeBadgesRelations = relations(knowledgeBadges, ({ one }) => ({
  user: one(users, { fields: [knowledgeBadges.userId], references: [users.id] }),
}));

export const knowledgeDocumentImpactRelations = relations(knowledgeDocumentImpact, ({ one }) => ({
  uploader: one(users, { fields: [knowledgeDocumentImpact.uploaderId], references: [users.id] }),
  valueStream: one(valueStreams, { fields: [knowledgeDocumentImpact.valueStreamId], references: [valueStreams.id] }),
}));

export const knowledgeStreamScoresRelations = relations(knowledgeStreamScores, ({ one }) => ({
  valueStream: one(valueStreams, { fields: [knowledgeStreamScores.valueStreamId], references: [valueStreams.id] }),
}));
