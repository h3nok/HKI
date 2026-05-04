import {
  bigint,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
  tinyint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  pngId: varchar("pngId", { length: 32 }),
  role: mysqlEnum("role", ["admin", "manager", "operator", "viewer"])
    .default("viewer")
    .notNull(),
  department: varchar("department", { length: 128 }),
  /** Org ID for multi-tenant isolation. Derived from Google hd claim. */
  orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
  /** Comma-separated value-stream scopes (e.g. "pharmacy,optical"). Null = global. */
  valueStreams: text("valueStreams"),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Value Streams ─────────────────────────────────────────────────────────────
// Canonical list of business domains. Each user may be assigned to one or more.
export const valueStreams = mysqlTable("valueStreams", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. "pharmacy", "fresh-foods"
  name: varchar("name", { length: 128 }).notNull(), // Display name
  description: text("description"),
  icon: varchar("icon", { length: 8 }).default("🏢").notNull(),
  /** JSON array of sample questions shown on the chat welcome screen, e.g. '["What are today\'s fill rates?","Show controlled substance audit"]' */
  sampleQuestions: text("sampleQuestions"),

  // ── Agent Definition ───────────────────────────────────────────────────────
  /** System prompt / persona for the agent operating within this stream */
  systemPrompt: text("systemPrompt"),
  /** Retrieval strategy: 'semantic' | 'hybrid' | 'graph' */
  retrievalStrategy: varchar("retrievalStrategy", { length: 16 }).default(
    "hybrid"
  ),
  /** JSON array of enabled tool IDs, e.g. '["search_knowledge","search_products"]' */
  enabledTools: text("enabledTools"),
  /** JSON object of guardrail flags, e.g. '{"inputValidation":true,"piiDetection":true,...}' */
  guardrailConfig: text("guardrailConfig"),
  /** JSON object of memory config, e.g. '{"enabled":true,"similarityThreshold":0.85}' */
  memoryConfig: text("memoryConfig"),
  /** JSON object of knowledge config (chunking, search tuning, ingestion rules) */
  knowledgeConfig: text("knowledgeConfig"),

  // ── Self-Service Billing ────────────────────────────────────────────────────
  /** Encrypted LiteLLM API key for per-stream billing. Empty = platform default. */
  llmApiKey: text("llmApiKey"),
  /** Monthly token budget. NULL = unlimited. */
  monthlyTokenBudget: int("monthlyTokenBudget"),
  /** Tokens used in the current billing month (reset monthly). */
  monthlyTokenUsed: int("monthlyTokenUsed").default(0),
  /** YYYY-MM string of the current billing period for auto-reset. */
  billingPeriod: varchar("billingPeriod", { length: 7 }),

  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Join table: user ↔ value-stream (many-to-many)
// NOTE: FKs removed from schema to work around drizzle-kit 0.31.x ER_DROP_INDEX_FK bug.
// Relations still work via relations.ts; FK constraints are added manually in Makefile db-push.
export const userValueStreams = mysqlTable(
  "userValueStreams",
  {
    userId: int("userId").notNull(),
    valueStreamId: varchar("valueStreamId", { length: 64 }).notNull(),
    assignedAt: timestamp("assignedAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [primaryKey({ columns: [table.userId, table.valueStreamId] })]
);

export type ValueStream = typeof valueStreams.$inferSelect;
export type InsertValueStream = typeof valueStreams.$inferInsert;
export type UserValueStream = typeof userValueStreams.$inferSelect;

// ── Knowledge Collections ────────────────────────────────────────────────────
// Links a value stream to a subset of the knowledge base (by department/tags).
// When a user queries within a stream, retrieval is scoped to the stream's collections.
export const knowledgeCollections = mysqlTable(
  "knowledgeCollections",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    /** Maps to the 'department' field on ingested documents — used as a filter at search time */
    department: varchar("department", { length: 64 }),
    /** Default document type for content ingested through this collection */
    defaultDocType: varchar("defaultDocType", { length: 32 }).default(
      "general"
    ),
    /** JSON array of tags auto-applied when ingesting through this collection */
    autoTags: text("autoTags"),
    isActive: tinyint("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_kc_stream").on(table.valueStreamId),
    index("idx_kc_org").on(table.orgId),
  ]
);

export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type InsertKnowledgeCollection =
  typeof knowledgeCollections.$inferInsert;

// ── Knowledge Invites ────────────────────────────────────────────────────────
// Invite a value stream's knowledge curator via email + invite code.
// Once accepted, the curator gains manager-level access to the stream's KB.
export const knowledgeInvites = mysqlTable(
  "knowledgeInvites",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    /** Email address of the invitee */
    email: varchar("email", { length: 320 }).notNull(),
    /** Short invite code (8 chars, URL-safe) */
    inviteCode: varchar("inviteCode", { length: 16 }).notNull().unique(),
    /** Role granted upon acceptance */
    role: mysqlEnum("inviteRole", ["manager", "operator", "viewer"])
      .default("manager")
      .notNull(),
    status: mysqlEnum("inviteStatus", [
      "pending",
      "accepted",
      "expired",
      "revoked",
    ])
      .default("pending")
      .notNull(),
    /** Optional personal note from the inviter */
    note: text("note"),
    createdBy: int("createdBy").references(() => users.id),
    acceptedBy: int("acceptedBy").references(() => users.id),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_ki_stream").on(table.valueStreamId),
    index("idx_ki_email").on(table.email),
    index("idx_ki_code").on(table.inviteCode),
  ]
);

export type KnowledgeInvite = typeof knowledgeInvites.$inferSelect;
export type InsertKnowledgeInvite = typeof knowledgeInvites.$inferInsert;

// ── Knowledge Attestations ───────────────────────────────────────────────────
// Records that a user has read and attested to the Agent Success Playbook
// for a given value stream. One record per user per stream.
export const knowledgeAttestations = mysqlTable(
  "knowledgeAttestations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    valueStreamId: varchar("valueStreamId", { length: 64 }).notNull(),
    attestedAt: timestamp("attestedAt")
      .$defaultFn(() => new Date())
      .notNull(),
    /** User's display name at time of attestation */
    userName: varchar("userName", { length: 256 }),
    /** User's email at time of attestation */
    userEmail: varchar("userEmail", { length: 320 }),
  },
  table => [
    index("idx_ka_user_stream").on(table.userId, table.valueStreamId),
    index("idx_ka_stream").on(table.valueStreamId),
  ]
);

export type KnowledgeAttestation = typeof knowledgeAttestations.$inferSelect;
export type InsertKnowledgeAttestation =
  typeof knowledgeAttestations.$inferInsert;

// Projects for organizing conversations into folders
export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  valueStreamId: varchar("valueStreamId", { length: 64 }).references(
    () => valueStreams.id,
    { onDelete: "set null" }
  ),
  name: varchar("name", { length: 200 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).default("📁").notNull(),
  color: varchar("color", { length: 32 }), // CSS color for visual grouping
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Conversations for chat history
export const conversations = mysqlTable(
  "conversations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("projectId", { length: 64 }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    /** Value stream scope this conversation belongs to (e.g. 'halpr', 'global'). Sticky — set at creation. */
    scope: varchar("scope", { length: 64 }).default("global").notNull(),
    title: text("title"),
    isPinned: tinyint("isPinned").default(0).notNull(),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_conversations_userId_updatedAt").on(
      table.userId,
      table.updatedAt
    ),
    index("idx_conversations_projectId").on(table.projectId),
  ]
);

// Messages within conversations
export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 64 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).default("global").notNull(),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    thoughtTrace: text("thoughtTrace"), // JSON string
    toolCalls: text("toolCalls"), // JSON string
    citations: text("citations"), // JSON string
    confidence: int("confidence"), // 0-100
    guardrails: text("guardrails"), // JSON string — {passed, input_violations, output_violations, score}
    provenance: text("provenance"), // JSON string — model/prompt/policy provenance
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_messages_conversationId_createdAt").on(
      table.conversationId,
      table.createdAt
    ),
    index("idx_messages_scope_createdAt").on(table.scope, table.createdAt),
  ]
);

// Thought trace steps for real-time display
export const thoughtTraceSteps = mysqlTable(
  "thoughtTraceSteps",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    messageId: varchar("messageId", { length: 64 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).default("global").notNull(),
    step: int("step").default(0).notNull(),
    type: mysqlEnum("type", [
      "thinking",
      "planning",
      "executing",
      "reflecting",
      "routing",
      "tool_call",
      "tool_result",
      "guardrail",
      "handoff",
      "memory_recall",
      "memory_store",
      "prompt_stack",
      "knowledge_retrieval",
      "cache_hit",
      "final_response",
      "suggested_follow_ups",
      // Execution engine events
      "plan_generated",
      "step_started",
      "step_verifying",
      "step_verified",
      "step_failed",
      "replanning",
      "human_escalation",
      "rollback",
      "scratchpad_update",
    ]).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"), // JSON string
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_thoughtTraceSteps_messageId_step").on(
      table.messageId,
      table.step
    ),
    index("idx_thoughtTraceSteps_scope").on(table.scope),
  ]
);

// Tool executions
export const toolExecutions = mysqlTable(
  "toolExecutions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    messageId: varchar("messageId", { length: 64 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).default("global").notNull(),
    toolName: varchar("toolName", { length: 128 }).notNull(),
    input: text("input").notNull(), // JSON string
    output: text("output"), // JSON string
    status: mysqlEnum("status", [
      "pending",
      "running",
      "success",
      "error",
    ]).notNull(),
    error: text("error"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("idx_toolExecutions_messageId").on(table.messageId),
    index("idx_toolExecutions_scope").on(table.scope),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export type ThoughtTraceStep = typeof thoughtTraceSteps.$inferSelect;
export type InsertThoughtTraceStep = typeof thoughtTraceSteps.$inferInsert;

export type ToolExecution = typeof toolExecutions.$inferSelect;
export type InsertToolExecution = typeof toolExecutions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// GAMIFICATION — Contributions, Badges, Streaks, Impact
// ═══════════════════════════════════════════════════════════════════════════════

/** Every action a user takes in the knowledge base generates a contribution event. */
export const knowledgeContributions = mysqlTable(
  "knowledgeContributions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    valueStreamId: varchar("valueStreamId", { length: 64 }).references(
      () => valueStreams.id,
      { onDelete: "set null" }
    ),
    action: mysqlEnum("contributionAction", [
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
      "citation",
    ]).notNull(),
    documentId: varchar("documentId", { length: 64 }),
    points: int("points").notNull().default(0),
    multiplier: int("multiplier").notNull().default(100), // stored as int × 100 (e.g. 150 = 1.5x)
    metadata: text("metadata"), // JSON — action-specific context
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_kcontrib_user").on(table.userId),
    index("idx_kcontrib_user_date").on(table.userId, table.createdAt),
    index("idx_kcontrib_stream").on(table.valueStreamId),
  ]
);

/** Aggregated per-user gamification state — streaks, totals, points. */
export const knowledgeProfiles = mysqlTable("knowledgeProfiles", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalPoints: int("totalPoints").notNull().default(0),
  currentStreak: int("currentStreak").notNull().default(0),
  longestStreak: int("longestStreak").notNull().default(0),
  lastContributionDate: varchar("lastContributionDate", { length: 10 }), // YYYY-MM-DD
  streakShieldAvailable: tinyint("streakShieldAvailable").default(1).notNull(),
  totalUploads: int("totalUploads").notNull().default(0),
  totalReviews: int("totalReviews").notNull().default(0),
  totalCitations: int("totalCitations").notNull().default(0),
  totalUsersHelped: int("totalUsersHelped").notNull().default(0),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Earned badges — one row per user per badge. */
export const knowledgeBadges = mysqlTable(
  "knowledgeBadges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeKey: varchar("badgeKey", { length: 100 }).notNull(),
    tier: mysqlEnum("badgeTier", [
      "bronze",
      "silver",
      "gold",
      "diamond",
      "secret",
    ]).notNull(),
    metadata: text("metadata"), // JSON — context of how it was earned
    earnedAt: timestamp("earnedAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_kbadges_user").on(table.userId),
    index("idx_kbadges_key").on(table.badgeKey),
  ]
);

/** Per-document lifetime impact tracking — citation counts, users helped. */
export const knowledgeDocumentImpact = mysqlTable(
  "knowledgeDocumentImpact",
  {
    documentId: varchar("documentId", { length: 64 }).primaryKey(),
    uploaderId: int("uploaderId").references(() => users.id, {
      onDelete: "set null",
    }),
    valueStreamId: varchar("valueStreamId", { length: 64 }).references(
      () => valueStreams.id,
      { onDelete: "set null" }
    ),
    citationCount: int("citationCount").notNull().default(0),
    uniqueUsersHelped: int("uniqueUsersHelped").notNull().default(0),
    positiveRate: int("positiveRate").notNull().default(0), // 0–100
    lastCitedAt: timestamp("lastCitedAt"),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_kdocimp_uploader").on(table.uploaderId),
    index("idx_kdocimp_stream").on(table.valueStreamId),
  ]
);

/** Materialized stream-level leaderboard scores — refreshed periodically. */
export const knowledgeStreamScores = mysqlTable("knowledgeStreamScores", {
  valueStreamId: varchar("valueStreamId", { length: 64 })
    .primaryKey()
    .references(() => valueStreams.id, { onDelete: "cascade" }),
  compositeScore: int("compositeScore").notNull().default(0), // 0–100
  coverageScore: int("coverageScore").notNull().default(0),
  qualityScore: int("qualityScore").notNull().default(0),
  freshnessScore: int("freshnessScore").notNull().default(0),
  contributorCount: int("contributorCount").notNull().default(0),
  activityScore: int("activityScore").notNull().default(0),
  rank: int("rank").notNull().default(0),
  teamBadges: text("teamBadges"), // JSON array of badge keys
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeContribution = typeof knowledgeContributions.$inferSelect;
export type InsertKnowledgeContribution =
  typeof knowledgeContributions.$inferInsert;
export type KnowledgeProfile = typeof knowledgeProfiles.$inferSelect;
export type InsertKnowledgeProfile = typeof knowledgeProfiles.$inferInsert;
export type KnowledgeBadge = typeof knowledgeBadges.$inferSelect;
export type InsertKnowledgeBadge = typeof knowledgeBadges.$inferInsert;
export type KnowledgeDocumentImpact =
  typeof knowledgeDocumentImpact.$inferSelect;
export type InsertKnowledgeDocumentImpact =
  typeof knowledgeDocumentImpact.$inferInsert;
export type KnowledgeStreamScore = typeof knowledgeStreamScores.$inferSelect;
export type InsertKnowledgeStreamScore =
  typeof knowledgeStreamScores.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// Knowledge Connectors — External source sync (Google Drive, SharePoint, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export const knowledgeConnectors = mysqlTable(
  "knowledgeConnectors",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    streamId: varchar("streamId", { length: 64 }).notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", [
      "google_drive",
      "sharepoint",
      "s3",
      "confluence",
      "notion",
    ]).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["active", "paused", "error", "revoked"])
      .default("active")
      .notNull(),
    // OAuth credentials (encrypted)
    credentialsEncrypted: text("credentialsEncrypted").notNull(),
    credentialsVersion: int("credentialsVersion").default(1).notNull(),
    // Sync configuration
    config: text("config").notNull(), // JSON: {folderId, folderName, includeSubfolders, mimeTypes}
    // Sync state
    syncIntervalMinutes: int("syncIntervalMinutes").default(30).notNull(),
    lastSyncAt: timestamp("lastSyncAt"),
    lastSyncToken: varchar("lastSyncToken", { length: 255 }), // Drive changes.list page token
    lastSyncStats: text("lastSyncStats"), // JSON: {filesProcessed, filesFailed, bytesDownloaded, durationMs}
    // Error tracking
    lastErrorAt: timestamp("lastErrorAt"),
    lastErrorMessage: text("lastErrorMessage"),
    consecutiveErrors: int("consecutiveErrors").default(0).notNull(),
    // Metadata
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_connectors_org").on(table.orgId),
    index("idx_connectors_stream").on(table.streamId),
    index("idx_connectors_user").on(table.createdBy),
    index("idx_connectors_status").on(table.status),
    index("idx_connectors_type").on(table.type),
    index("idx_connectors_sync").on(table.status, table.lastSyncAt),
  ]
);

export const knowledgeConnectorSyncs = mysqlTable(
  "knowledgeConnectorSyncs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    connectorId: varchar("connectorId", { length: 64 })
      .notNull()
      .references(() => knowledgeConnectors.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    streamId: varchar("streamId", { length: 64 }).notNull(),
    // Sync run details
    startedAt: timestamp("startedAt")
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completedAt"),
    status: mysqlEnum("status", ["running", "completed", "failed", "partial"])
      .default("running")
      .notNull(),
    // Stats
    filesDiscovered: int("filesDiscovered").default(0).notNull(),
    filesProcessed: int("filesProcessed").default(0).notNull(),
    filesFailed: int("filesFailed").default(0).notNull(),
    filesSkipped: int("filesSkipped").default(0).notNull(),
    bytesDownloaded: bigint("bytesDownloaded", { mode: "number" })
      .default(0)
      .notNull(),
    // Error log
    errors: text("errors"), // JSON array of failed files
    // Performance
    durationMs: int("durationMs"),
    apiCalls: int("apiCalls").default(0).notNull(),
    rateLimitHits: int("rateLimitHits").default(0).notNull(),
  },
  table => [
    index("idx_syncs_connector").on(table.connectorId),
    index("idx_syncs_org").on(table.orgId),
    index("idx_syncs_stream").on(table.streamId),
    index("idx_syncs_status").on(table.status),
    index("idx_syncs_time").on(table.startedAt),
  ]
);

export type KnowledgeConnector = typeof knowledgeConnectors.$inferSelect;
export type InsertKnowledgeConnector = typeof knowledgeConnectors.$inferInsert;
export type KnowledgeConnectorSync =
  typeof knowledgeConnectorSyncs.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════════
// Knowledge Gap Snapshots — versioned gap analysis history
// Each run of "Analyze with Gemini" is persisted as an immutable snapshot.
// Enables coverage trend tracking, before/after diffs, and audit trail.
// ═══════════════════════════════════════════════════════════════════════════════

export const knowledgeGapSnapshots = mysqlTable(
  "knowledgeGapSnapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // ── Scores (0–100 ints for efficient trend queries) ──────────────────────
    coverageScore: int("coverageScore").notNull(),
    coverageLabel: varchar("coverageLabel", { length: 32 }).notNull(), // "Low"|"Moderate"|"Good"|"Excellent"

    // ── Context at time of run ────────────────────────────────────────────────
    documentCount: int("documentCount").notNull().default(0), // docs indexed at run time
    chunkCount: int("chunkCount").notNull().default(0), // chunks indexed at run time

    // ── Full Gemini output (JSON) ─────────────────────────────────────────────
    summary: text("summary").notNull(),
    strengths: text("strengths").notNull(), // JSON: string[]
    gaps: text("gaps").notNull(), // JSON: {topic,severity,suggestion}[]
    staleContent: text("staleContent").notNull(), // JSON: string[]
    recommendations: text("recommendations").notNull(), // JSON: string[]

    // ── Optional user annotation ──────────────────────────────────────────────
    note: text("note"), // Free-text note added by the user after reviewing

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_gap_snapshots_stream").on(table.valueStreamId),
    index("idx_gap_snapshots_org").on(table.orgId),
    index("idx_gap_snapshots_time").on(table.valueStreamId, table.createdAt),
  ]
);

export type KnowledgeGapSnapshot = typeof knowledgeGapSnapshots.$inferSelect;
export type InsertKnowledgeGapSnapshot =
  typeof knowledgeGapSnapshots.$inferInsert;
export type InsertKnowledgeConnectorSync =
  typeof knowledgeConnectorSyncs.$inferInsert;

// ── Knowledge Journey Progress ───────────────────────────────────────────────
// Tracks user progress through the 8-step knowledge setup journey.
// Enterprise-grade: per-user, per-stream, with audit trail and dismissal tracking.
export const knowledgeJourneyProgress = mysqlTable(
  "knowledgeJourneyProgress",
  {
    id: int("id").autoincrement().primaryKey(),

    // ── Scope ─────────────────────────────────────────────────────────────────
    userId: int("userId").notNull(),
    valueStreamId: varchar("valueStreamId", { length: 64 }).notNull(),
    orgId: varchar("orgId", { length: 128 }).notNull(),

    // ── Progress State ────────────────────────────────────────────────────────
    /** Current active step ID (e.g., 'gap-analysis', 'connect', 'test') */
    currentStep: varchar("currentStep", { length: 64 }).notNull(),
    /** JSON array of completed step IDs, e.g., '["gap-analysis","organize","connect"]' */
    completedSteps: text("completedSteps").notNull().default("[]"),
    /** JSON object of step completion timestamps, e.g., '{"gap-analysis":"2026-02-19T10:30:00Z",...}' */
    completionTimestamps: text("completionTimestamps").notNull().default("{}"),

    // ── Dismissal Tracking ────────────────────────────────────────────────────
    /** JSON array of dismissed next-step banner IDs to prevent re-showing */
    dismissedBanners: text("dismissedBanners").notNull().default("[]"),
    /** Whether the user has permanently dismissed the journey (opted out) */
    journeyDismissed: tinyint("journeyDismissed").default(0).notNull(),

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    /** Last time the user interacted with any journey step */
    lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    // Composite unique constraint: one journey per user per stream
    index("idx_journey_user_stream").on(table.userId, table.valueStreamId),
    index("idx_journey_org").on(table.orgId),
    index("idx_journey_active").on(table.lastActiveAt),
  ]
);

export type KnowledgeJourneyProgress =
  typeof knowledgeJourneyProgress.$inferSelect;
export type InsertKnowledgeJourneyProgress =
  typeof knowledgeJourneyProgress.$inferInsert;

// ── Maintained Eval Suites ─────────────────────────────────────────────────
// Stream-scoped saved regression suites used by the Validate workspace.
export const knowledgeEvalSuites = mysqlTable(
  "knowledgeEvalSuites",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    origin: mysqlEnum("origin", ["curated", "generated", "fallback", "manual"])
      .default("manual")
      .notNull(),
    basedOnSnapshotId: varchar("basedOnSnapshotId", { length: 64 }),
    cases: text("cases").notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedBy: int("updatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_kb_eval_suites_stream").on(table.valueStreamId),
    index("idx_kb_eval_suites_org").on(table.orgId),
    index("idx_kb_eval_suites_time").on(table.valueStreamId, table.updatedAt),
    index("idx_kb_eval_suites_name").on(table.valueStreamId, table.name),
  ]
);

// ── Agent E2E Evaluation Runs ───────────────────────────────────────────────
// Stores full-chat orchestrator evaluations used for release readiness.
export const knowledgeAgentEvalRuns = mysqlTable(
  "knowledgeAgentEvalRuns",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    suiteName: varchar("suiteName", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["running", "completed", "failed"])
      .default("running")
      .notNull(),
    totalCases: int("totalCases").default(0).notNull(),
    passedCases: int("passedCases").default(0).notNull(),
    passRate: int("passRate").default(0).notNull(),
    averageConfidence: int("averageConfidence").default(0).notNull(),
    averageGuardrailScore: int("averageGuardrailScore").default(0).notNull(),
    averageTraceSteps: int("averageTraceSteps").default(0).notNull(),
    passed: tinyint("passed").default(0).notNull(),
    results: text("results").notNull(),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("idx_agent_eval_stream").on(table.valueStreamId),
    index("idx_agent_eval_org").on(table.orgId),
    index("idx_agent_eval_status").on(table.status),
    index("idx_agent_eval_time").on(table.valueStreamId, table.createdAt),
  ]
);

export const knowledgeReleases = mysqlTable(
  "knowledgeReleases",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    valueStreamId: varchar("valueStreamId", { length: 64 })
      .notNull()
      .references(() => valueStreams.id, { onDelete: "cascade" }),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 128 }).notNull(),
    notes: text("notes"),
    status: mysqlEnum("status", [
      "candidate",
      "promoted",
      "superseded",
      "rolled_back",
    ])
      .default("candidate")
      .notNull(),
    basedOnEvalRunId: varchar("basedOnEvalRunId", { length: 64 }).references(
      () => knowledgeAgentEvalRuns.id,
      { onDelete: "set null" }
    ),
    snapshot: text("snapshot"),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    promotedAt: timestamp("promotedAt"),
    rolledBackAt: timestamp("rolledBackAt"),
  },
  table => [
    index("idx_kb_releases_stream").on(table.valueStreamId),
    index("idx_kb_releases_org").on(table.orgId),
    index("idx_kb_releases_status").on(table.status),
    index("idx_kb_releases_time").on(table.valueStreamId, table.createdAt),
  ]
);

export type KnowledgeEvalSuite = typeof knowledgeEvalSuites.$inferSelect;
export type InsertKnowledgeEvalSuite = typeof knowledgeEvalSuites.$inferInsert;
export type KnowledgeAgentEvalRun = typeof knowledgeAgentEvalRuns.$inferSelect;
export type InsertKnowledgeAgentEvalRun =
  typeof knowledgeAgentEvalRuns.$inferInsert;
export type KnowledgeRelease = typeof knowledgeReleases.$inferSelect;
export type InsertKnowledgeRelease = typeof knowledgeReleases.$inferInsert;

// ─── Access Requests ───────────────────────────────────────────────────────────
export const accessRequests = mysqlTable(
  "accessRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    department: varchar("department", { length: 255 }).notNull(),
    valueStream: varchar("valueStream", { length: 255 }),
    justification: text("justification").notNull(),
    managerEmail: varchar("managerEmail", { length: 255 }),
    status: mysqlEnum("status", ["pending", "approved", "denied"])
      .default("pending")
      .notNull(),
    reviewedBy: varchar("reviewedBy", { length: 255 }),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_accessRequests_status").on(table.status),
    index("idx_accessRequests_email").on(table.email),
    index("idx_accessRequests_createdAt").on(table.createdAt),
    index("idx_accessRequests_status_createdAt").on(
      table.status,
      table.createdAt
    ),
  ]
);

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

// ─── Feature Flag Overrides ──────────────────────────────────────────────────
/** Org-scoped admin overrides for UI feature availability. */
export const featureFlagOverrides = mysqlTable(
  "featureFlagOverrides",
  {
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    featureKey: varchar("featureKey", { length: 128 }).notNull(),
    enabled: tinyint("enabled").notNull(),
    updatedBy: int("updatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.orgId, table.featureKey] }),
    index("idx_featureFlagOverrides_featureKey").on(table.featureKey),
    index("idx_featureFlagOverrides_updatedBy").on(table.updatedBy),
  ]
);

export type FeatureFlagOverride = typeof featureFlagOverrides.$inferSelect;
export type InsertFeatureFlagOverride =
  typeof featureFlagOverrides.$inferInsert;

// ─── Feature Flag Presets ───────────────────────────────────────────────────
/** Org-scoped rollout presets that admins can edit and apply. */
export const featureFlagPresets = mysqlTable(
  "featureFlagPresets",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    orgId: varchar("orgId", { length: 128 }).default("default").notNull(),
    sourceTemplateKey: varchar("sourceTemplateKey", { length: 64 }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    overrides: text("overrides").notNull(), // JSON string of featureKey -> boolean
    createdBy: int("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: int("updatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("idx_featureFlagPresets_orgId").on(table.orgId),
    index("idx_featureFlagPresets_sourceTemplateKey").on(
      table.sourceTemplateKey
    ),
    index("idx_featureFlagPresets_updatedBy").on(table.updatedBy),
  ]
);

export type FeatureFlagPreset = typeof featureFlagPresets.$inferSelect;
export type InsertFeatureFlagPreset = typeof featureFlagPresets.$inferInsert;

// ─── Audit Log ─────────────────────────────────────────────────────────────────
/** Immutable log of admin/manager actions for governance and compliance. */
export const auditLog = mysqlTable(
  "auditLog",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").notNull(),
    actorEmail: varchar("actorEmail", { length: 255 }).notNull(),
    /** e.g. role_change, user_deactivate, user_activate, invite_create, access_approve, access_deny */
    action: varchar("action", { length: 64 }).notNull(),
    /** e.g. user, invite, access_request */
    targetType: varchar("targetType", { length: 64 }).notNull(),
    targetId: varchar("targetId", { length: 255 }).notNull(),
    /** JSON or free-text detail (old role → new role, reason, etc.) */
    detail: text("detail"),
    createdAt: timestamp("createdAt")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("idx_auditLog_action").on(table.action),
    index("idx_auditLog_targetType_targetId").on(
      table.targetType,
      table.targetId
    ),
    index("idx_auditLog_createdAt").on(table.createdAt),
    index("idx_auditLog_actorId").on(table.actorId),
  ]
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
