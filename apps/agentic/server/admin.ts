/** Admin-only CRUD for value streams and user management. */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  managerProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { createLogger } from "./_core/logger";
import { getDb } from "./db";
import {
  users,
  valueStreams,
  userValueStreams,
  knowledgeCollections,
  knowledgeInvites,
  knowledgeJourneyProgress,
  accessRequests,
  auditLog,
  featureFlagOverrides,
  featureFlagPresets,
} from "../drizzle/schema";
import { nanoid } from "nanoid";
import { eq, and, asc, desc, sql, like, or, inArray } from "drizzle-orm";
import {
  sendInviteEmail,
  sendAccessApprovedEmail,
  sendAccessDeniedEmail,
  sendAccessRequestSubmittedEmail,
} from "./email";
import {
  DEFAULT_STANDARD_ROLE,
  ROLE_HIERARCHY,
  hasKnowledgeManageAccess,
  type Role,
} from "@shared/access-control";
import {
  FEATURE_FLAG_DEFINITIONS,
  FEATURE_FLAG_PRESETS,
  createFeatureFlagPresetSnapshot,
  getFeatureFlagDefinition,
  getFeatureFlagPreset,
  isFeatureFlagKey,
  isFeatureFlagPresetKey,
  type FeatureFlagKey,
  type FeatureFlagPresetKey,
  type FeatureFlagSnapshot,
} from "@shared/feature-flags";
import {
  DEFAULT_GUARDRAILS,
  DEFAULT_KNOWLEDGE_CONFIG,
  DEFAULT_MEMORY,
  normalizeKnowledgeConfig,
} from "@shared/value-streams";
import {
  evaluateFeatureFlagsForUser,
  requireFeatureEnabledForUser,
} from "./_core/feature-flags";
import { getSyntheticUserReasons } from "./_core/synthetic-cleanup";
import {
  KNOWLEDGE_PIPELINE_URL,
  VECTOR_STORE_URL,
  serviceJsonTyped,
} from "./service-client";
import type {
  GraphStats,
  IngestionJob,
  JobListResponse,
  StoreStats,
} from "../shared/knowledge-types";

type AdminKnowledgeOpsSummary = {
  documents: number;
  chunks: number;
  entities: number;
  relationships: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
};

type AdminKnowledgeStreamSummary = AdminKnowledgeOpsSummary & {
  valueStreamId: string;
  name: string;
  jobs: IngestionJob[];
  partialFailure: boolean;
};

function emptyAdminKnowledgeOpsSummary(): AdminKnowledgeOpsSummary {
  return {
    documents: 0,
    chunks: 0,
    entities: 0,
    relationships: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  };
}

function summarizeAdminKnowledgeJobs(
  jobs: IngestionJob[]
): Pick<
  AdminKnowledgeOpsSummary,
  "totalJobs" | "activeJobs" | "completedJobs" | "failedJobs"
> {
  let activeJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  for (const job of jobs) {
    if (job.status === "failed") {
      failedJobs += 1;
      continue;
    }
    if (job.status === "completed") {
      completedJobs += 1;
      continue;
    }
    activeJobs += 1;
  }

  return {
    totalJobs: jobs.length,
    activeJobs,
    completedJobs,
    failedJobs,
  };
}

function buildAdminKnowledgeStreamContext(
  ctx: { user: { id: number; role?: string | null } },
  valueStreamId: string
) {
  return {
    ...ctx,
    scopes: [valueStreamId],
    isGlobalScope: false,
  };
}

function readStoreDocumentCount(stats?: StoreStats | null): number {
  const raw =
    stats?.totalDocuments ??
    (typeof stats?.["documents"] === "number" ? stats["documents"] : 0);
  return Number(raw || 0);
}

function readStoreChunkCount(stats?: StoreStats | null): number {
  const raw =
    stats?.totalChunks ??
    (typeof stats?.["chunks"] === "number" ? stats["chunks"] : 0);
  return Number(raw || 0);
}

function readGraphEntityCount(stats?: GraphStats | null): number {
  const raw =
    stats?.totalEntities ??
    stats?.entityCount ??
    (typeof stats?.["entities"] === "number" ? stats["entities"] : 0);
  return Number(raw || 0);
}

function readGraphRelationshipCount(stats?: GraphStats | null): number {
  return Number(stats?.relationships || 0);
}

// ── Simple in-memory rate limiter for public endpoints ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per window per IP/email

function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again in a minute.",
    });
  }
}

// Periodic cleanup of expired rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  });
}, 5 * 60_000).unref();

// ── Audit log helper ──
type AuditLogWriter = Pick<
  NonNullable<Awaited<ReturnType<typeof getDb>>>,
  "insert"
>;

async function writeAuditLog(
  db: AuditLogWriter,
  actor: { id: number; email?: string | null },
  action: string,
  targetType: string,
  targetId: string | number,
  detail?: string
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: actor.id,
      actorEmail: actor.email || "unknown",
      action,
      targetType,
      targetId: String(targetId),
      detail: detail || null,
    });
  } catch (err) {
    log.error(
      { err, action, targetType, targetId },
      "Failed to write audit log"
    );
  }
}

const log = createLogger("admin");
const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeFeatureFlagPresetName(value: string): string {
  return value.trim().slice(0, 128);
}

function normalizeFeatureFlagPresetDescription(
  value?: string | null
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, 2000) : null;
}

function normalizeFeatureFlagPresetOverrides(
  value?: Record<string, boolean>
): FeatureFlagSnapshot {
  const overrides: Partial<Record<FeatureFlagKey, boolean>> = {};

  for (const [featureKey, enabled] of Object.entries(value ?? {})) {
    if (isFeatureFlagKey(featureKey) && typeof enabled === "boolean") {
      overrides[featureKey] = enabled;
    }
  }

  return createFeatureFlagPresetSnapshot(overrides);
}

function parseFeatureFlagPresetOverrides(
  value: string | null | undefined
): FeatureFlagSnapshot {
  if (!value) {
    return createFeatureFlagPresetSnapshot();
  }

  try {
    const parsed = JSON.parse(value);
    return normalizeFeatureFlagPresetOverrides(
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, boolean>)
        : undefined
    );
  } catch {
    return createFeatureFlagPresetSnapshot();
  }
}

function serializeFeatureFlagPresetOverrides(
  snapshot: FeatureFlagSnapshot
): string {
  return JSON.stringify(snapshot);
}

async function ensureFeatureFlagPresetsSeeded(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: string
): Promise<void> {
  const existingPresets = await db
    .select({ sourceTemplateKey: featureFlagPresets.sourceTemplateKey })
    .from(featureFlagPresets)
    .where(eq(featureFlagPresets.orgId, orgId));

  const existingTemplateKeys = new Set(
    existingPresets
      .map(row => row.sourceTemplateKey)
      .filter(
        (value): value is FeatureFlagPresetKey =>
          typeof value === "string" && isFeatureFlagPresetKey(value)
      )
  );

  const missingTemplates = FEATURE_FLAG_PRESETS.filter(
    preset => !existingTemplateKeys.has(preset.key)
  );

  if (missingTemplates.length === 0) {
    return;
  }

  await db.insert(featureFlagPresets).values(
    missingTemplates.map(preset => ({
      id: nanoid(21),
      orgId,
      sourceTemplateKey: preset.key,
      name: preset.label,
      description: preset.description,
      overrides: serializeFeatureFlagPresetOverrides(
        createFeatureFlagPresetSnapshot(preset.overrides)
      ),
      createdBy: null,
      updatedBy: null,
    }))
  );
}

function mapFeatureFlagPresetRow(row: {
  id: string;
  sourceTemplateKey: string | null;
  name: string;
  description: string | null;
  overrides: string;
  updatedAt: Date;
  updatedBy: number | null;
}): {
  id: string;
  sourceTemplateKey: FeatureFlagPresetKey | null;
  name: string;
  description: string;
  overrides: FeatureFlagSnapshot;
  updatedAt: string;
  updatedBy: number | null;
} {
  const sourceTemplateKey =
    row.sourceTemplateKey && isFeatureFlagPresetKey(row.sourceTemplateKey)
      ? row.sourceTemplateKey
      : null;

  return {
    id: row.id,
    sourceTemplateKey,
    name: row.name,
    description: row.description ?? "",
    overrides: parseFeatureFlagPresetOverrides(row.overrides),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  };
}

async function persistFeatureFlagOverride(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  options: {
    orgId: string;
    featureKey: FeatureFlagKey;
    enabled: boolean;
    updatedBy: number;
  }
): Promise<void> {
  const definition = getFeatureFlagDefinition(options.featureKey);

  if (options.enabled === definition.defaultEnabled) {
    await db
      .delete(featureFlagOverrides)
      .where(
        and(
          eq(featureFlagOverrides.orgId, options.orgId),
          eq(featureFlagOverrides.featureKey, options.featureKey)
        )
      );
    return;
  }

  await db
    .insert(featureFlagOverrides)
    .values({
      orgId: options.orgId,
      featureKey: options.featureKey,
      enabled: options.enabled ? 1 : 0,
      updatedBy: options.updatedBy,
    })
    .onDuplicateKeyUpdate({
      set: {
        enabled: options.enabled ? 1 : 0,
        updatedBy: options.updatedBy,
      },
    });
}

function safeParseAuditDetail(
  detail: string | null
): Record<string, unknown> | null {
  if (!detail) return null;

  try {
    const parsed = JSON.parse(detail);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function requireAdminFeatureFlag(options: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  user: { role: Role; valueStreams: string | null; orgId?: string | null };
  key: FeatureFlagKey;
  message: string;
}): Promise<void> {
  await requireFeatureEnabledForUser({
    db: options.db,
    user: options.user,
    key: options.key,
    message: options.message,
  });
}

function normalizeStreamRef(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function ensureManagerHasStreamAccess(
  ctx: { user: { role: string }; scopes?: string[]; isGlobalScope?: boolean },
  valueStreamId: string
): void {
  const scopes =
    ctx.user.role === "admin"
      ? ["global"]
      : ((ctx.user as { valueStreams?: string | null }).valueStreams
          ?.split(",")
          .map(scope => scope.trim())
          .filter(Boolean) ?? []);
  if (
    ctx.user.role === "admin" ||
    scopes.includes("global") ||
    scopes.includes(valueStreamId)
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You can only manage access for your assigned value streams",
  });
}

async function resolveValueStream(
  db: Awaited<ReturnType<typeof getDb>>,
  valueStreamRef: string
): Promise<{ id: string; name: string } | null> {
  if (!db) return null;

  const normalized = normalizeStreamRef(valueStreamRef);
  if (!normalized) return null;

  const [byId] = await db
    .select({ id: valueStreams.id, name: valueStreams.name })
    .from(valueStreams)
    .where(eq(valueStreams.id, normalized))
    .limit(1);
  if (byId) return byId;

  const rows = await db
    .select({ id: valueStreams.id, name: valueStreams.name })
    .from(valueStreams);

  return (
    rows.find(stream => normalizeStreamRef(stream.name) === normalized) ?? null
  );
}

function requestMatchesValueStream(
  requestValueStream: string | null | undefined,
  stream: { id: string; name: string }
): boolean {
  const requested = normalizeStreamRef(requestValueStream);
  if (!requested) return true;
  return (
    requested === normalizeStreamRef(stream.id) ||
    requested === normalizeStreamRef(stream.name)
  );
}

async function getScopedStreamMatchers(
  db: Awaited<ReturnType<typeof getDb>>,
  scopes: string[]
): Promise<Set<string>> {
  const matchers = new Set(scopes.map(normalizeStreamRef).filter(Boolean));
  if (!db || scopes.length === 0) return matchers;

  const rows = await db
    .select({ id: valueStreams.id, name: valueStreams.name })
    .from(valueStreams)
    .where(inArray(valueStreams.id, scopes));

  for (const row of rows) {
    matchers.add(normalizeStreamRef(row.id));
    matchers.add(normalizeStreamRef(row.name));
  }

  return matchers;
}

function normalizeEmailAddress(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !EMAIL_ADDRESS_RE.test(normalized)) return null;
  return normalized;
}

function parseAssignedStreams(value?: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(value.split(",").map(normalizeStreamRef).filter(Boolean))
  );
}

async function syncUserStreamAssignments(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number
): Promise<string[]> {
  const assignments = await db
    .select({ valueStreamId: userValueStreams.valueStreamId })
    .from(userValueStreams)
    .where(eq(userValueStreams.userId, userId));

  const streamIds = assignments.map(assignment => assignment.valueStreamId);
  await db
    .update(users)
    .set({ valueStreams: streamIds.length > 0 ? streamIds.join(",") : null })
    .where(eq(users.id, userId));

  return streamIds;
}

function parseFallbackReviewerEmails(): string[] {
  return Array.from(
    new Set(
      (process.env.KNOWLEDGE_ACCESS_REQUEST_RECIPIENTS || "")
        .split(",")
        .map(value => normalizeEmailAddress(value))
        .filter((value): value is string => !!value)
    )
  );
}

type AccessRequestReviewer = {
  email: string;
  name?: string | null;
  source: "admin" | "stream_manager" | "fallback";
};

function uniqueReviewers(
  reviewers: AccessRequestReviewer[]
): AccessRequestReviewer[] {
  const byEmail = new Map<string, AccessRequestReviewer>();
  for (const reviewer of reviewers) {
    if (!byEmail.has(reviewer.email)) {
      byEmail.set(reviewer.email, reviewer);
      continue;
    }

    const existing = byEmail.get(reviewer.email)!;
    if (!existing.name && reviewer.name) {
      byEmail.set(reviewer.email, reviewer);
    }
  }
  return Array.from(byEmail.values());
}

async function listAccessRequestReviewers(
  db: Awaited<ReturnType<typeof getDb>>,
  streamId?: string | null
): Promise<AccessRequestReviewer[]> {
  if (!db) return [];

  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      valueStreams: users.valueStreams,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, 1),
        or(eq(users.role, "admin"), eq(users.role, "manager"))
      )
    );

  const reviewers = rows.flatMap((row): AccessRequestReviewer[] => {
    const email = normalizeEmailAddress(row.email);
    if (!email) return [];

    if (row.role === "admin") {
      return [{ email, name: row.name, source: "admin" as const }];
    }

    if (!streamId) return [];
    const assignedStreams = parseAssignedStreams(row.valueStreams);
    if (!assignedStreams.includes(streamId)) return [];

    return [{ email, name: row.name, source: "stream_manager" as const }];
  });

  const fallbacks: AccessRequestReviewer[] = parseFallbackReviewerEmails().map(
    email => ({
      email,
      source: "fallback" as const,
    })
  );

  return uniqueReviewers([...reviewers, ...fallbacks]);
}

const runtimeExecutionPolicySchema = z.object({
  model: z.string().max(128).optional(),
  modelTier: z.enum(["auto", "fast", "smart", "thinking"]).optional(),
  enablePlanning: z.boolean().optional(),
  retrievalStrategy: z.enum(["semantic", "hybrid", "graph"]).optional(),
  budgets: z
    .object({
      maxTurns: z.number().int().min(1).max(50).optional(),
      maxToolCalls: z.number().int().min(1).max(50).optional(),
      maxTokens: z.number().int().min(256).max(200000).optional(),
    })
    .optional(),
  toolPermissions: z
    .object({
      approvalMode: z.enum(["never", "sensitive_only", "always"]).optional(),
      sensitiveTools: z.array(z.string().max(64)).max(20).optional(),
      requireApprovalTools: z.array(z.string().max(64)).max(20).optional(),
      denyTools: z.array(z.string().max(64)).max(20).optional(),
      riskOverrides: z
        .record(z.string().max(64), z.enum(["low", "medium", "high"]))
        .optional(),
    })
    .optional(),
  memory: z
    .object({
      enabled: z.boolean().optional(),
      maxSemanticFacts: z.number().int().min(0).max(50).optional(),
      maxEpisodes: z.number().int().min(0).max(50).optional(),
      maxProcedures: z.number().int().min(0).max(50).optional(),
      includeRules: z.boolean().optional(),
      storeEpisodes: z.boolean().optional(),
      consolidateAfterEpisodes: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

const knowledgeConfigSchema = z.object({
  chunkSize: z.number().min(128).max(4096),
  chunkOverlap: z.number().min(0).max(512),
  chunkStrategy: z.enum(["sentence", "fixed", "sliding_window"]),
  similarityThreshold: z.number().min(0).max(1),
  bm25Weight: z.number().min(0).max(1),
  vectorWeight: z.number().min(0).max(1),
  maxResults: z.number().min(1).max(100),
  maxDocSizeMb: z.number().min(1).max(500),
  allowedFileTypes: z.array(z.string().max(16)).max(20),
  enableReranking: z.boolean().optional(),
  executionPolicy: runtimeExecutionPolicySchema.optional(),
});

export const adminRouter = router({
  // ── Access Requests ──

  submitAccessRequest: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().max(255),
        department: z.string().min(1).max(255),
        valueStream: z.string().max(255).optional(),
        justification: z.string().min(10).max(5000),
        managerEmail: z.string().email().max(255).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Rate limit by email to prevent spam
      checkRateLimit(`access-req:${input.email.toLowerCase()}`);

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      try {
        const stream = input.valueStream
          ? await resolveValueStream(db, input.valueStream)
          : null;

        await db.insert(accessRequests).values({
          name: input.name,
          email: input.email,
          department: input.department,
          valueStream: input.valueStream || null,
          justification: input.justification,
          managerEmail: input.managerEmail || null,
        });

        const reviewers = await listAccessRequestReviewers(db, stream?.id);
        if (reviewers.length === 0) {
          log.warn(
            {
              requesterEmail: input.email,
              requestedStream: input.valueStream || null,
            },
            "submitAccessRequest saved without notification recipients"
          );
        } else {
          const baseUrl = process.env.BASE_URL || "http://localhost:9001";
          const reviewUrl = stream?.id
            ? `${baseUrl}/knowledge?stream=${encodeURIComponent(stream.id)}`
            : `${baseUrl}/knowledge`;
          const requestedStreamLabel =
            stream?.name || input.valueStream?.trim() || undefined;

          void Promise.allSettled(
            reviewers.map(reviewer =>
              sendAccessRequestSubmittedEmail({
                to: reviewer.email,
                reviewerName: reviewer.name || undefined,
                requesterName: input.name,
                requesterEmail: input.email,
                department: input.department,
                streamName: requestedStreamLabel,
                justification: input.justification,
                managerEmail: input.managerEmail || undefined,
                reviewUrl,
              })
            )
          )
            .then(results => {
              results.forEach((result, index) => {
                const reviewer = reviewers[index];
                if (!reviewer) return;
                if (result.status === "rejected") {
                  log.error(
                    { err: result.reason, reviewerEmail: reviewer.email },
                    "submitAccessRequest reviewer email failed"
                  );
                  return;
                }
                if (result.value === false) {
                  log.warn(
                    { reviewerEmail: reviewer.email },
                    "submitAccessRequest reviewer email not delivered"
                  );
                }
              });
            })
            .catch(err => {
              log.error(
                { err },
                "submitAccessRequest reviewer email dispatch failed"
              );
            });
        }

        return { success: true };
      } catch (err) {
        log.error({ err }, "submitAccessRequest DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit access request. Please try again.",
        });
      }
    }),

  listAccessRequests: managerProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "denied"]).optional(),
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const rows = await db
          .select()
          .from(accessRequests)
          .orderBy(desc(accessRequests.createdAt));

        let scopedRows = rows;
        if (input?.status) {
          scopedRows = scopedRows.filter(row => row.status === input.status);
        }

        if (input?.valueStreamId) {
          const stream = await resolveValueStream(db, input.valueStreamId);
          if (!stream) return [];
          ensureManagerHasStreamAccess(ctx, stream.id);
          return scopedRows.filter(row =>
            requestMatchesValueStream(row.valueStream, stream)
          );
        }

        if (ctx.isGlobalScope || (ctx.scopes ?? []).includes("global")) {
          return scopedRows;
        }

        const matchers = await getScopedStreamMatchers(db, ctx.scopes ?? []);
        return scopedRows.filter(row => {
          const requested = normalizeStreamRef(row.valueStream);
          return !requested || matchers.has(requested);
        });
      } catch (err) {
        log.error({ err }, "listAccessRequests DB error");
        return [];
      }
    }),

  decideAccessRequest: managerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        decision: z.enum(["approved", "denied"]),
        valueStreamId: z.string().min(1).max(64),
        role: z.enum(["manager", "operator", "viewer"]).optional(),
        note: z.string().max(500).optional(),
        expiresInDays: z.number().int().min(1).max(90).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const stream = await resolveValueStream(db, input.valueStreamId);
      if (!stream) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Value stream not found",
        });
      }
      ensureManagerHasStreamAccess(ctx, stream.id);

      const [requestRecord] = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, input.id))
        .limit(1);

      if (!requestRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Access request not found",
        });
      }
      if (requestRecord.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Access request is already ${requestRecord.status}`,
        });
      }
      if (!requestMatchesValueStream(requestRecord.valueStream, stream)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Access request targets a different value stream",
        });
      }

      const reviewedBy =
        ctx.user.email || ctx.user.name || String(ctx.user.id || "manager");

      if (input.decision === "denied") {
        await db
          .update(accessRequests)
          .set({
            status: "denied",
            reviewedBy,
          })
          .where(eq(accessRequests.id, input.id));

        // Notify the requester of denial
        sendAccessDeniedEmail({
          to: requestRecord.email,
          streamName: stream.name,
          note: input.note || undefined,
        }).catch(err =>
          log.error({ err }, "decideAccessRequest denial email failed")
        );

        await writeAuditLog(
          db,
          ctx.user,
          "access_deny",
          "access_request",
          input.id,
          JSON.stringify({
            requesterEmail: requestRecord.email,
            stream: stream.name,
            note: input.note || null,
          })
        );

        return { success: true, status: "denied" as const };
      }

      const [existingInvite] = await db
        .select()
        .from(knowledgeInvites)
        .where(
          sql`${knowledgeInvites.email} = ${requestRecord.email} AND ${knowledgeInvites.valueStreamId} = ${stream.id} AND ${knowledgeInvites.status} = 'pending'`
        )
        .limit(1);

      let inviteId = existingInvite?.id ?? "";
      let inviteCode = existingInvite?.inviteCode ?? "";
      let expiresAt = existingInvite?.expiresAt ?? null;

      if (!existingInvite) {
        inviteId = nanoid(16);
        inviteCode = nanoid(8).toUpperCase();
        const days = input.expiresInDays ?? 14;
        expiresAt = new Date(Date.now() + days * 86400000);

        await db.insert(knowledgeInvites).values({
          id: inviteId,
          valueStreamId: stream.id,
          email: requestRecord.email,
          inviteCode,
          role: input.role ?? "viewer",
          status: "pending",
          note: input.note ?? null,
          createdBy: ctx.user.id,
          expiresAt,
        });
      }

      await db
        .update(accessRequests)
        .set({
          status: "approved",
          reviewedBy,
        })
        .where(eq(accessRequests.id, input.id));

      // Notify the requester with their invite code
      sendAccessApprovedEmail({
        to: requestRecord.email,
        inviteCode,
        streamName: stream.name,
        role: input.role ?? "viewer",
        note: input.note || undefined,
      }).catch(err =>
        log.error({ err }, "decideAccessRequest approval email failed")
      );

      await writeAuditLog(
        db,
        ctx.user,
        "access_approve",
        "access_request",
        input.id,
        JSON.stringify({
          requesterEmail: requestRecord.email,
          stream: stream.name,
          inviteCode,
          role: input.role ?? "viewer",
        })
      );

      return {
        success: true,
        status: "approved" as const,
        inviteId,
        inviteCode,
        email: requestRecord.email,
        valueStreamId: stream.id,
        valueStreamName: stream.name,
        expiresAt: expiresAt?.toISOString?.() ?? null,
      };
    }),

  // ── Value Streams ──

  listValueStreams: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    try {
      // Prefer full schema, but gracefully fall back when DB migrations
      // for newly added billing columns have not been applied yet.
      let streams: any[] = [];
      try {
        streams = await db
          .select()
          .from(valueStreams)
          .orderBy(asc(valueStreams.name));
      } catch (err: any) {
        log.warn(
          { err },
          "listValueStreams falling back to legacy stream shape"
        );

        const legacyStreams = await db
          .select({
            id: valueStreams.id,
            name: valueStreams.name,
            description: valueStreams.description,
            icon: valueStreams.icon,
            sampleQuestions: valueStreams.sampleQuestions,
            isActive: valueStreams.isActive,
          })
          .from(valueStreams)
          .orderBy(asc(valueStreams.name));

        streams = legacyStreams.map(s => ({
          ...s,
          systemPrompt: null,
          retrievalStrategy: "hybrid",
          enabledTools: null,
          guardrailConfig: null,
          memoryConfig: null,
          knowledgeConfig: null,
          llmApiKey: null,
          monthlyTokenBudget: null,
          monthlyTokenUsed: 0,
          billingPeriod: null,
        }));
      }

      // Single query: count users per stream via GROUP BY (avoids N+1)
      const counts = await db
        .select({
          valueStreamId: userValueStreams.valueStreamId,
          count: sql<number>`count(*)`,
        })
        .from(userValueStreams)
        .groupBy(userValueStreams.valueStreamId);

      const countMap = new Map(
        counts.map(c => [c.valueStreamId, Number(c.count)])
      );

      return streams.map(stream => ({
        ...stream,
        userCount: countMap.get(stream.id) ?? 0,
      }));
    } catch (err) {
      log.error({ err }, "listValueStreams DB error");
      const detail =
        err instanceof Error ? err.message : "Unknown database error";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to load value streams: ${detail}`,
      });
    }
  }),

  knowledgeOperationsSummary: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        aggregate: emptyAdminKnowledgeOpsSummary(),
        streams: [] as AdminKnowledgeStreamSummary[],
        recentActiveJobs: [] as IngestionJob[],
        partialFailures: 0,
      };
    }

    const streams = await db
      .select({
        id: valueStreams.id,
        name: valueStreams.name,
      })
      .from(valueStreams)
      .where(eq(valueStreams.isActive, 1))
      .orderBy(asc(valueStreams.name));

    const activeStreams = streams.filter(stream => stream.id !== "global");
    if (activeStreams.length === 0) {
      return {
        aggregate: emptyAdminKnowledgeOpsSummary(),
        streams: [] as AdminKnowledgeStreamSummary[],
        recentActiveJobs: [] as IngestionJob[],
        partialFailures: 0,
      };
    }

    const streamSummaries = await Promise.all(
      activeStreams.map(async stream => {
        const streamCtx = buildAdminKnowledgeStreamContext(ctx, stream.id);
        const [storeStatsResult, graphStatsResult, jobsResult] =
          await Promise.allSettled([
            serviceJsonTyped<StoreStats>(
              `${VECTOR_STORE_URL}/v1/stats`,
              streamCtx
            ),
            serviceJsonTyped<GraphStats>(
              `${VECTOR_STORE_URL}/v1/graph/stats`,
              streamCtx
            ),
            serviceJsonTyped<JobListResponse>(
              `${KNOWLEDGE_PIPELINE_URL}/v1/jobs?limit=100&offset=0`,
              streamCtx
            ),
          ]);

        const storeStats =
          storeStatsResult.status === "fulfilled"
            ? storeStatsResult.value
            : null;
        const graphStats =
          graphStatsResult.status === "fulfilled"
            ? graphStatsResult.value
            : null;
        const jobs =
          jobsResult.status === "fulfilled"
            ? (jobsResult.value.jobs ?? [])
            : [];
        const jobSummary = summarizeAdminKnowledgeJobs(jobs);

        return {
          valueStreamId: stream.id,
          name: stream.name,
          documents: readStoreDocumentCount(storeStats),
          chunks: readStoreChunkCount(storeStats),
          entities: readGraphEntityCount(graphStats),
          relationships: readGraphRelationshipCount(graphStats),
          ...jobSummary,
          jobs,
          partialFailure:
            storeStatsResult.status === "rejected" ||
            graphStatsResult.status === "rejected" ||
            jobsResult.status === "rejected",
        } satisfies AdminKnowledgeStreamSummary;
      })
    );

    const aggregate = streamSummaries.reduce<AdminKnowledgeOpsSummary>(
      (totals, stream) => ({
        documents: totals.documents + stream.documents,
        chunks: totals.chunks + stream.chunks,
        entities: totals.entities + stream.entities,
        relationships: totals.relationships + stream.relationships,
        totalJobs: totals.totalJobs + stream.totalJobs,
        activeJobs: totals.activeJobs + stream.activeJobs,
        completedJobs: totals.completedJobs + stream.completedJobs,
        failedJobs: totals.failedJobs + stream.failedJobs,
      }),
      emptyAdminKnowledgeOpsSummary()
    );

    const recentActiveJobs = streamSummaries
      .flatMap(stream =>
        stream.jobs
          .filter(job => !["completed", "failed"].includes(job.status))
          .map(job => ({
            ...job,
            streamId: job.streamId ?? stream.valueStreamId,
          }))
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 12);

    return {
      aggregate,
      streams: streamSummaries,
      recentActiveJobs,
      partialFailures: streamSummaries.filter(stream => stream.partialFailure)
        .length,
    };
  }),

  listFeatureFlagPresets: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }

    const orgId = ctx.user.orgId || "default";
    await ensureFeatureFlagPresetsSeeded(db, orgId);

    const rows = await db
      .select({
        id: featureFlagPresets.id,
        sourceTemplateKey: featureFlagPresets.sourceTemplateKey,
        name: featureFlagPresets.name,
        description: featureFlagPresets.description,
        overrides: featureFlagPresets.overrides,
        updatedAt: featureFlagPresets.updatedAt,
        updatedBy: featureFlagPresets.updatedBy,
      })
      .from(featureFlagPresets)
      .where(eq(featureFlagPresets.orgId, orgId))
      .orderBy(asc(featureFlagPresets.createdAt));

    return rows.map(mapFeatureFlagPresetRow);
  }),

  listFeatureFlags: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }

    const orgId = ctx.user.orgId || "default";
    const overrides = await db
      .select({
        featureKey: featureFlagOverrides.featureKey,
        enabled: featureFlagOverrides.enabled,
        updatedAt: featureFlagOverrides.updatedAt,
        updatedBy: featureFlagOverrides.updatedBy,
      })
      .from(featureFlagOverrides)
      .where(eq(featureFlagOverrides.orgId, orgId));

    const { entries } = evaluateFeatureFlagsForUser({
      user: ctx.user,
      overrides,
    });

    const overrideMap = new Map(
      overrides.map(override => [override.featureKey, override])
    );

    return FEATURE_FLAG_DEFINITIONS.map(definition => {
      const evaluated = entries.find(entry => entry.key === definition.key)!;
      const override = overrideMap.get(definition.key);

      return {
        ...evaluated,
        updatedAt: override?.updatedAt?.toISOString?.() ?? null,
        updatedBy: override?.updatedBy ?? null,
      };
    });
  }),

  listFeatureFlagAuditEvents: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(25).default(8),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";
      const rows = await db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          actorEmail: auditLog.actorEmail,
          targetId: auditLog.targetId,
          detail: auditLog.detail,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(
          and(
            inArray(auditLog.action, [
              "feature_flag_override_set",
              "feature_flag_override_reset",
              "feature_flag_preset_create",
              "feature_flag_preset_apply",
              "feature_flag_preset_update",
              "feature_flag_preset_delete",
            ]),
            like(auditLog.detail, `%\"orgId\":\"${orgId}\"%`)
          )
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(input?.limit ?? 8);

      return rows.map(row => {
        const detail = safeParseAuditDetail(row.detail);

        if (
          row.action === "feature_flag_preset_create" ||
          row.action === "feature_flag_preset_apply" ||
          row.action === "feature_flag_preset_update" ||
          row.action === "feature_flag_preset_delete"
        ) {
          const templateKey =
            typeof detail?.sourceTemplateKey === "string" &&
            isFeatureFlagPresetKey(detail.sourceTemplateKey)
              ? detail.sourceTemplateKey
              : isFeatureFlagPresetKey(row.targetId)
                ? row.targetId
                : null;
          const preset = templateKey ? getFeatureFlagPreset(templateKey) : null;
          const appliedCount = Object.keys(
            (detail?.overrides as Record<string, unknown> | undefined) ?? {}
          ).length;

          const kind =
            row.action === "feature_flag_preset_create"
              ? ("preset-create" as const)
              : row.action === "feature_flag_preset_update"
                ? ("preset-update" as const)
                : row.action === "feature_flag_preset_delete"
                  ? ("preset-delete" as const)
                  : ("preset-apply" as const);

          const description =
            row.action === "feature_flag_preset_create"
              ? `Created preset with ${appliedCount} rollout selections.`
              : row.action === "feature_flag_preset_update"
                ? `Updated preset definition with ${appliedCount} rollout selections.`
                : row.action === "feature_flag_preset_delete"
                  ? "Deleted custom preset."
                  : `Applied deployment preset with ${appliedCount} explicit rollout controls.`;

          return {
            id: row.id,
            kind,
            title: detail?.label ?? preset?.label ?? row.targetId,
            description,
            actorEmail: row.actorEmail,
            targetId: row.targetId,
            createdAt: row.createdAt.toISOString(),
          };
        }

        const definition = isFeatureFlagKey(row.targetId)
          ? getFeatureFlagDefinition(row.targetId)
          : null;
        const enabled = detail?.enabled;

        return {
          id: row.id,
          kind:
            row.action === "feature_flag_override_reset"
              ? ("reset" as const)
              : ("override" as const),
          title: definition?.label ?? row.targetId,
          description:
            row.action === "feature_flag_override_reset"
              ? "Reset to the platform default posture."
              : `Forced ${enabled ? "on" : "off"} for this organization.`,
          actorEmail: row.actorEmail,
          targetId: row.targetId,
          createdAt: row.createdAt.toISOString(),
        };
      });
    }),

  setFeatureFlagOverride: adminProcedure
    .input(
      z.object({
        featureKey: z.string().min(1).max(128),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isFeatureFlagKey(input.featureKey)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown feature flag",
        });
      }

      const definition = getFeatureFlagDefinition(input.featureKey);
      if (!definition.adminEditable) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This feature flag cannot be changed by admins",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";

      await persistFeatureFlagOverride(db, {
        orgId,
        featureKey: input.featureKey,
        enabled: input.enabled,
        updatedBy: ctx.user.id,
      });

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_override_set",
        "feature_flag",
        input.featureKey,
        JSON.stringify({
          orgId,
          enabled: input.enabled,
          defaultEnabled: definition.defaultEnabled,
        })
      );

      return { success: true } as const;
    }),

  updateFeatureFlagPreset: adminProcedure
    .input(
      z.object({
        presetId: z.string().min(1).max(64),
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000).optional().nullable(),
        overrides: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";
      const [existingPreset] = await db
        .select({
          id: featureFlagPresets.id,
          sourceTemplateKey: featureFlagPresets.sourceTemplateKey,
        })
        .from(featureFlagPresets)
        .where(
          and(
            eq(featureFlagPresets.id, input.presetId),
            eq(featureFlagPresets.orgId, orgId)
          )
        )
        .limit(1);

      if (!existingPreset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature flag preset not found",
        });
      }

      const normalizedName = normalizeFeatureFlagPresetName(input.name);
      const normalizedDescription = normalizeFeatureFlagPresetDescription(
        input.description
      );
      const overrides = normalizeFeatureFlagPresetOverrides(input.overrides);

      await db
        .update(featureFlagPresets)
        .set({
          name: normalizedName,
          description: normalizedDescription,
          overrides: serializeFeatureFlagPresetOverrides(overrides),
          updatedBy: ctx.user.id,
        })
        .where(
          and(
            eq(featureFlagPresets.id, input.presetId),
            eq(featureFlagPresets.orgId, orgId)
          )
        );

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_preset_update",
        "feature_flag_preset",
        input.presetId,
        JSON.stringify({
          orgId,
          label: normalizedName,
          sourceTemplateKey: existingPreset.sourceTemplateKey,
          overrides,
        })
      );

      return {
        success: true,
        presetId: input.presetId,
      } as const;
    }),

  deleteFeatureFlagPreset: adminProcedure
    .input(
      z.object({
        presetId: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";
      const [existingPreset] = await db
        .select({
          id: featureFlagPresets.id,
          name: featureFlagPresets.name,
          sourceTemplateKey: featureFlagPresets.sourceTemplateKey,
        })
        .from(featureFlagPresets)
        .where(
          and(
            eq(featureFlagPresets.id, input.presetId),
            eq(featureFlagPresets.orgId, orgId)
          )
        )
        .limit(1);

      if (!existingPreset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature flag preset not found",
        });
      }

      if (existingPreset.sourceTemplateKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Template presets cannot be deleted",
        });
      }

      await db
        .delete(featureFlagPresets)
        .where(
          and(
            eq(featureFlagPresets.id, input.presetId),
            eq(featureFlagPresets.orgId, orgId)
          )
        );

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_preset_delete",
        "feature_flag_preset",
        input.presetId,
        JSON.stringify({
          orgId,
          label: existingPreset.name,
          sourceTemplateKey: existingPreset.sourceTemplateKey,
        })
      );

      return {
        success: true,
        presetId: input.presetId,
      } as const;
    }),

  createFeatureFlagPreset: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000).optional().nullable(),
        overrides: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";
      const presetId = nanoid(16);
      const normalizedName = normalizeFeatureFlagPresetName(input.name);
      const normalizedDescription = normalizeFeatureFlagPresetDescription(
        input.description
      );
      const overrides = normalizeFeatureFlagPresetOverrides(input.overrides);

      await db.insert(featureFlagPresets).values({
        id: presetId,
        orgId,
        sourceTemplateKey: null,
        name: normalizedName,
        description: normalizedDescription,
        overrides: serializeFeatureFlagPresetOverrides(overrides),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_preset_create",
        "feature_flag_preset",
        presetId,
        JSON.stringify({
          orgId,
          label: normalizedName,
          overrides,
        })
      );

      return {
        success: true,
        presetId,
      } as const;
    }),

  applyFeatureFlagPreset: adminProcedure
    .input(
      z.object({
        presetId: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";
      const [presetRow] = await db
        .select({
          id: featureFlagPresets.id,
          sourceTemplateKey: featureFlagPresets.sourceTemplateKey,
          name: featureFlagPresets.name,
          overrides: featureFlagPresets.overrides,
        })
        .from(featureFlagPresets)
        .where(
          and(
            eq(featureFlagPresets.id, input.presetId),
            eq(featureFlagPresets.orgId, orgId)
          )
        )
        .limit(1);

      if (!presetRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature flag preset not found",
        });
      }

      const overrides = parseFeatureFlagPresetOverrides(presetRow.overrides);

      for (const featureKey of FEATURE_FLAG_DEFINITIONS.map(
        definition => definition.key
      )) {
        await persistFeatureFlagOverride(db, {
          orgId,
          featureKey,
          enabled: overrides[featureKey],
          updatedBy: ctx.user.id,
        });
      }

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_preset_apply",
        "feature_flag_preset",
        input.presetId,
        JSON.stringify({
          orgId,
          label: presetRow.name,
          sourceTemplateKey: presetRow.sourceTemplateKey,
          overrides,
        })
      );

      return {
        success: true,
        presetId: input.presetId,
      } as const;
    }),

  resetFeatureFlagOverride: adminProcedure
    .input(
      z.object({
        featureKey: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isFeatureFlagKey(input.featureKey)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown feature flag",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId || "default";

      await db
        .delete(featureFlagOverrides)
        .where(
          and(
            eq(featureFlagOverrides.orgId, orgId),
            eq(featureFlagOverrides.featureKey, input.featureKey)
          )
        );

      await writeAuditLog(
        db,
        ctx.user,
        "feature_flag_override_reset",
        "feature_flag",
        input.featureKey,
        JSON.stringify({ orgId })
      );

      return { success: true } as const;
    }),

  createValueStream: adminProcedure
    .input(
      z.object({
        id: z
          .string()
          .min(1)
          .max(64)
          .regex(
            /^[a-z0-9-]+$/,
            "ID must be lowercase alphanumeric with dashes"
          ),
        name: z.string().min(1).max(128),
        description: z.string().max(500).optional(),
        icon: z.string().max(8).optional(),
        sampleQuestions: z.array(z.string().max(200)).max(5).optional(),
        // Agent definition
        systemPrompt: z.string().max(4000).optional(),
        retrievalStrategy: z.enum(["semantic", "hybrid", "graph"]).optional(),
        enabledTools: z.array(z.string().max(64)).max(20).optional(),
        guardrailConfig: z
          .object({
            inputValidation: z.boolean(),
            outputValidation: z.boolean(),
            piiDetection: z.boolean(),
            toxicityFilter: z.boolean(),
          })
          .optional(),
        memoryConfig: z
          .object({
            enabled: z.boolean(),
            similarityThreshold: z.number().min(0).max(1),
          })
          .optional(),
        knowledgeConfig: knowledgeConfigSchema.optional(),
        llmApiKey: z.string().max(256).optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      try {
        const [existing] = await db
          .select({ id: valueStreams.id })
          .from(valueStreams)
          .where(eq(valueStreams.id, input.id))
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Value stream "${input.id}" already exists`,
          });
        }

        await db.insert(valueStreams).values({
          id: input.id,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? "🏢",
          sampleQuestions: input.sampleQuestions
            ? JSON.stringify(input.sampleQuestions)
            : null,
          systemPrompt: input.systemPrompt ?? null,
          retrievalStrategy: input.retrievalStrategy ?? "hybrid",
          enabledTools: input.enabledTools
            ? JSON.stringify(input.enabledTools)
            : null,
          guardrailConfig: input.guardrailConfig
            ? JSON.stringify(input.guardrailConfig)
            : null,
          memoryConfig: input.memoryConfig
            ? JSON.stringify(input.memoryConfig)
            : null,
          knowledgeConfig: input.knowledgeConfig
            ? JSON.stringify(input.knowledgeConfig)
            : null,
          llmApiKey: input.llmApiKey?.trim() ? input.llmApiKey.trim() : null,
          isActive: 1,
        });

        return { id: input.id, name: input.name };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "createValueStream DB error");
        const detail =
          err instanceof Error ? err.message : "Unknown database error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create value stream: ${detail}`,
        });
      }
    }),

  // ── Self-Service Provisioning ──────────────────────────────────────────
  // Managers and admins can provision a Knowledge Base for their team.
  // Atomically: creates value stream + default collection + assigns the
  // creator to the new stream.

  provisionKnowledgeBase: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(128),
        description: z.string().max(500).optional(),
        icon: z.string().max(8).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!hasKnowledgeManageAccess(ctx.user.role as Role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only knowledge managers can provision a knowledge base",
        });
      }

      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Derive a URL-friendly stream ID from the name
      const baseId = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
      if (!baseId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name must contain at least one alphanumeric character",
        });

      // Ensure uniqueness by appending a short suffix if needed
      let streamId = baseId;
      const [existing] = await db
        .select({ id: valueStreams.id })
        .from(valueStreams)
        .where(eq(valueStreams.id, streamId))
        .limit(1);
      if (existing) {
        streamId = `${baseId}-${nanoid(4)}`;
      }

      try {
        // 1. Create value stream with safe defaults
        await db.insert(valueStreams).values({
          id: streamId,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? "📚",
          retrievalStrategy: "hybrid",
          guardrailConfig: JSON.stringify(DEFAULT_GUARDRAILS),
          memoryConfig: JSON.stringify(DEFAULT_MEMORY),
          knowledgeConfig: JSON.stringify(
            normalizeKnowledgeConfig(DEFAULT_KNOWLEDGE_CONFIG)
          ),
          isActive: 1,
        });

        // 2. Create default "General" collection
        const collId = nanoid(16);
        await db.insert(knowledgeCollections).values({
          id: collId,
          valueStreamId: streamId,
          name: "General",
          department: "general",
          defaultDocType: "general",
          isActive: 1,
        });

        // 3. Assign creator to the new stream
        await db.insert(userValueStreams).values({
          userId: ctx.user.id,
          valueStreamId: streamId,
        });

        // 4. Update denormalized users.valueStreams column
        const assignments = await db
          .select({ valueStreamId: userValueStreams.valueStreamId })
          .from(userValueStreams)
          .where(eq(userValueStreams.userId, ctx.user.id));
        const streamList = assignments.map(a => a.valueStreamId).join(",");
        const userUpdates = {
          valueStreams: streamList || null,
        };

        await db
          .update(users)
          .set(userUpdates)
          .where(eq(users.id, ctx.user.id));

        return { id: streamId, name: input.name, collectionId: collId };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "provisionKnowledgeBase DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to provision knowledge base",
        });
      }
    }),

  updateValueStream: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(500).optional(),
        icon: z.string().max(8).optional(),
        isActive: z.boolean().optional(),
        sampleQuestions: z.array(z.string().max(200)).max(5).optional(),
        // Agent definition
        systemPrompt: z.string().max(4000).optional().nullable(),
        retrievalStrategy: z.enum(["semantic", "hybrid", "graph"]).optional(),
        enabledTools: z.array(z.string().max(64)).max(20).optional(),
        guardrailConfig: z
          .object({
            inputValidation: z.boolean(),
            outputValidation: z.boolean(),
            piiDetection: z.boolean(),
            toxicityFilter: z.boolean(),
          })
          .optional(),
        memoryConfig: z
          .object({
            enabled: z.boolean(),
            similarityThreshold: z.number().min(0).max(1),
          })
          .optional(),
        knowledgeConfig: knowledgeConfigSchema.optional(),
        // Self-service billing: per-stream LLM key + token budget
        llmApiKey: z.string().max(256).optional().nullable(),
        monthlyTokenBudget: z.number().int().min(0).optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      try {
        const [existing] = await db
          .select({ id: valueStreams.id })
          .from(valueStreams)
          .where(eq(valueStreams.id, input.id))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Value stream "${input.id}" not found`,
          });
        }

        const set: Record<string, unknown> = {};
        if (input.name !== undefined) set.name = input.name;
        if (input.description !== undefined)
          set.description = input.description;
        if (input.icon !== undefined) set.icon = input.icon;
        if (input.isActive !== undefined) set.isActive = input.isActive ? 1 : 0;
        if (input.sampleQuestions !== undefined)
          set.sampleQuestions = JSON.stringify(input.sampleQuestions);
        if (input.systemPrompt !== undefined)
          set.systemPrompt = input.systemPrompt;
        if (input.retrievalStrategy !== undefined)
          set.retrievalStrategy = input.retrievalStrategy;
        if (input.enabledTools !== undefined)
          set.enabledTools = JSON.stringify(input.enabledTools);
        if (input.guardrailConfig !== undefined)
          set.guardrailConfig = JSON.stringify(input.guardrailConfig);
        if (input.memoryConfig !== undefined)
          set.memoryConfig = JSON.stringify(input.memoryConfig);
        if (input.knowledgeConfig !== undefined)
          set.knowledgeConfig = JSON.stringify(input.knowledgeConfig);
        if (input.llmApiKey !== undefined) {
          const trimmed = input.llmApiKey?.trim();
          set.llmApiKey = trimmed ? trimmed : null;
        }
        if (input.monthlyTokenBudget !== undefined)
          set.monthlyTokenBudget = input.monthlyTokenBudget;

        if (Object.keys(set).length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No fields to update",
          });
        }

        await db
          .update(valueStreams)
          .set(set)
          .where(eq(valueStreams.id, input.id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "updateValueStream DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update value stream",
        });
      }
    }),

  /** Cascade-deletes all user assignments for this stream */
  deleteValueStream: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      if (input.id === "global") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the global scope",
        });
      }

      // Remove assignments first
      await db
        .delete(userValueStreams)
        .where(eq(userValueStreams.valueStreamId, input.id));

      // Also clear from users.valueStreams text column
      // (This is a denormalized field — we update it for affected users)
      const affectedUsers = await db
        .select({ id: users.id, valueStreams: users.valueStreams })
        .from(users);

      for (const u of affectedUsers) {
        if (u.valueStreams && u.valueStreams.includes(input.id)) {
          const updated =
            u.valueStreams
              .split(",")
              .map(s => s.trim())
              .filter(s => s !== input.id)
              .join(",") || null;
          await db
            .update(users)
            .set({ valueStreams: updated })
            .where(eq(users.id, u.id));
        }
      }

      await db.delete(valueStreams).where(eq(valueStreams.id, input.id));
      return { success: true };
    }),

  // ── Users ──

  listUsers: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { users: [], total: 0 };

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      let query = db
        .select()
        .from(users)
        .orderBy(asc(users.name), desc(users.lastSignedIn));

      // Apply search filter
      if (input?.search) {
        const term = `%${input.search}%`;
        query = query.where(
          or(
            like(users.name, term),
            like(users.email, term),
            like(users.department, term)
          )
        ) as any;
      }

      // Count must respect the same search filter
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(users);
      if (input?.search) {
        const term = `%${input.search}%`;
        countQuery = countQuery.where(
          or(
            like(users.name, term),
            like(users.email, term),
            like(users.department, term)
          )
        ) as any;
      }
      const [countRow] = await countQuery;
      const total = Number(countRow?.count ?? 0);

      const userList = await (query as any).limit(limit).offset(offset);

      // Batch-fetch value stream assignments for all users (single query, avoids N+1)
      const userIds = userList.map((u: any) => u.id);
      const allAssignments =
        userIds.length > 0
          ? await db
              .select({
                userId: userValueStreams.userId,
                valueStreamId: userValueStreams.valueStreamId,
              })
              .from(userValueStreams)
              .where(inArray(userValueStreams.userId, userIds))
          : [];

      const assignmentsByUser = new Map<number, string[]>();
      for (const a of allAssignments) {
        const list = assignmentsByUser.get(a.userId) || [];
        list.push(a.valueStreamId);
        assignmentsByUser.set(a.userId, list);
      }

      const results = userList.map((u: any) => ({
        id: u.id,
        openId: u.openId,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        isActive: u.isActive,
        loginMethod: u.loginMethod,
        valueStreams: u.valueStreams,
        assignedStreams: assignmentsByUser.get(u.id) || [],
        lastSignedIn: u.lastSignedIn,
        createdAt: u.createdAt,
      }));

      return { users: results, total };
    }),

  listManagedUsers: managerProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db || !input?.valueStreamId) return { users: [] };

      const stream = await resolveValueStream(db, input.valueStreamId);
      if (!stream) return { users: [] };
      ensureManagerHasStreamAccess(ctx, stream.id);

      const term = input.search ? `%${input.search}%` : null;
      const filters = [eq(userValueStreams.valueStreamId, stream.id)];
      if (term) {
        filters.push(
          or(
            like(users.name, term),
            like(users.email, term),
            like(users.department, term)
          ) as any
        );
      }

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          department: users.department,
          isActive: users.isActive,
          lastSignedIn: users.lastSignedIn,
          assignedAt: userValueStreams.assignedAt,
        })
        .from(userValueStreams)
        .innerJoin(users, eq(users.id, userValueStreams.userId))
        .where(and(...filters))
        .orderBy(asc(users.name), desc(users.lastSignedIn));

      return {
        users: rows.map(row => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          department: row.department,
          isActive: row.isActive,
          lastSignedIn: row.lastSignedIn,
          assignedAt: row.assignedAt,
          valueStreamId: stream.id,
          valueStreamName: stream.name,
        })),
      };
    }),

  /** Update a user's role */
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["admin", "manager", "operator", "viewer"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Prevent self-demotion
      if (input.userId === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot demote yourself",
        });
      }

      // Fetch current role for audit trail
      const [target] = await db
        .select({ role: users.role, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target)
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const previousRole = target.role;

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      await writeAuditLog(
        db,
        ctx.user,
        "role_change",
        "user",
        input.userId,
        JSON.stringify({
          previousRole,
          newRole: input.role,
          targetEmail: target.email,
        })
      );

      return { success: true };
    }),

  updateManagedUserAccess: managerProcedure
    .input(
      z
        .object({
          userId: z.number().int().positive(),
          valueStreamId: z.string().min(1).max(64),
          role: z.enum(["manager", "operator", "viewer"]).optional(),
          revoke: z.boolean().optional(),
        })
        .refine(input => input.role !== undefined || input.revoke === true, {
          message: "Provide a role update or revoke the assignment",
        })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const stream = await resolveValueStream(db, input.valueStreamId);
      if (!stream) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Value stream not found",
        });
      }
      ensureManagerHasStreamAccess(ctx, stream.id);

      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify your own access from the team screen",
        });
      }

      const [target] = await db
        .select({
          id: users.id,
          role: users.role,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const [assignment] = await db
        .select({ valueStreamId: userValueStreams.valueStreamId })
        .from(userValueStreams)
        .where(
          and(
            eq(userValueStreams.userId, input.userId),
            eq(userValueStreams.valueStreamId, stream.id)
          )
        )
        .limit(1);

      if (!assignment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not assigned to this value stream",
        });
      }

      if (target.role === "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admins can modify another platform admin",
        });
      }

      if (input.revoke) {
        await db
          .delete(userValueStreams)
          .where(
            and(
              eq(userValueStreams.userId, input.userId),
              eq(userValueStreams.valueStreamId, stream.id)
            )
          );

        const remainingStreams = await syncUserStreamAssignments(
          db,
          input.userId
        );
        if (
          target.role !== "admin" &&
          remainingStreams.length === 0 &&
          target.role !== DEFAULT_STANDARD_ROLE
        ) {
          await db
            .update(users)
            .set({ role: DEFAULT_STANDARD_ROLE })
            .where(eq(users.id, input.userId));
        }

        await writeAuditLog(
          db,
          ctx.user,
          "stream_access_revoke",
          "user",
          input.userId,
          JSON.stringify({
            targetEmail: target.email,
            valueStreamId: stream.id,
            valueStreamName: stream.name,
          })
        );

        return {
          success: true,
          revoked: true,
          remainingStreams,
          role:
            remainingStreams.length === 0 && target.role !== "admin"
              ? DEFAULT_STANDARD_ROLE
              : target.role,
        };
      }

      const nextRole = input.role as Role;
      if (
        ROLE_HIERARCHY[nextRole] > ROLE_HIERARCHY.manager &&
        ctx.user.role !== "admin"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admins can grant platform admin access",
        });
      }

      await db
        .update(users)
        .set({ role: nextRole })
        .where(eq(users.id, input.userId));
      await syncUserStreamAssignments(db, input.userId);

      await writeAuditLog(
        db,
        ctx.user,
        "stream_access_role_change",
        "user",
        input.userId,
        JSON.stringify({
          previousRole: target.role,
          newRole: nextRole,
          targetEmail: target.email,
          valueStreamId: stream.id,
          valueStreamName: stream.name,
        })
      );

      return {
        success: true,
        revoked: false,
        role: nextRole,
      };
    }),

  /** Replaces all existing stream assignments for the user */
  assignValueStreams: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        valueStreamIds: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Clear existing assignments
      await db
        .delete(userValueStreams)
        .where(eq(userValueStreams.userId, input.userId));

      // Batch insert new assignments (single query)
      if (input.valueStreamIds.length > 0) {
        await db.insert(userValueStreams).values(
          input.valueStreamIds.map(streamId => ({
            userId: input.userId,
            valueStreamId: streamId,
          }))
        );
      }

      // Also update the denormalized text column
      const vsText =
        input.valueStreamIds.length > 0 ? input.valueStreamIds.join(",") : null;

      await db
        .update(users)
        .set({ valueStreams: vsText })
        .where(eq(users.id, input.userId));

      await writeAuditLog(
        db,
        ctx.user,
        "stream_assign",
        "user",
        input.userId,
        JSON.stringify({ streams: input.valueStreamIds })
      );

      return { success: true };
    }),

  toggleUserActive: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate yourself",
        });
      }

      const [user] = await db
        .select({ isActive: users.isActive, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const newIsActive = !user.isActive;

      await db
        .update(users)
        .set({ isActive: newIsActive ? 1 : 0 })
        .where(eq(users.id, input.userId));

      // When deactivating: revoke all pending invites created by this user
      // and remove stream assignments to prevent orphaned access
      if (!newIsActive) {
        await db
          .update(knowledgeInvites)
          .set({ status: "revoked" })
          .where(
            and(
              eq(knowledgeInvites.createdBy, input.userId),
              eq(knowledgeInvites.status, "pending")
            )
          );
      }

      await writeAuditLog(
        db,
        ctx.user,
        newIsActive ? "user_activate" : "user_deactivate",
        "user",
        input.userId,
        JSON.stringify({ targetEmail: user.email })
      );

      return { success: true, isActive: newIsActive };
    }),

  setUserActive: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      if (input.userId === ctx.user.id && !input.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate yourself",
        });
      }

      const [user] = await db
        .select({ isActive: users.isActive, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const currentIsActive = Boolean(user.isActive);
      if (currentIsActive === input.isActive) {
        return { success: true, isActive: currentIsActive, changed: false };
      }

      await db
        .update(users)
        .set({ isActive: input.isActive ? 1 : 0 })
        .where(eq(users.id, input.userId));

      if (!input.isActive) {
        await db
          .update(knowledgeInvites)
          .set({ status: "revoked" })
          .where(
            and(
              eq(knowledgeInvites.createdBy, input.userId),
              eq(knowledgeInvites.status, "pending")
            )
          );
      }

      await writeAuditLog(
        db,
        ctx.user,
        input.isActive ? "user_activate" : "user_deactivate",
        "user",
        input.userId,
        JSON.stringify({ targetEmail: user.email })
      );

      return { success: true, isActive: input.isActive, changed: true };
    }),

  deleteSyntheticUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your current session user",
        });
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          openId: users.openId,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const syntheticReasons = getSyntheticUserReasons(user);
      if (syntheticReasons.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only synthetic test users can be deleted via this operation",
        });
      }

      await db.transaction(async tx => {
        await tx
          .update(knowledgeInvites)
          .set({ createdBy: null })
          .where(eq(knowledgeInvites.createdBy, input.userId));

        await tx
          .update(knowledgeInvites)
          .set({ acceptedBy: null })
          .where(eq(knowledgeInvites.acceptedBy, input.userId));

        await tx
          .delete(userValueStreams)
          .where(eq(userValueStreams.userId, input.userId));

        await tx
          .delete(knowledgeJourneyProgress)
          .where(eq(knowledgeJourneyProgress.userId, input.userId));

        await tx.delete(users).where(eq(users.id, input.userId));

        await writeAuditLog(
          tx,
          ctx.user,
          "user_delete",
          "user",
          input.userId,
          JSON.stringify({
            syntheticReasons,
            targetEmail: user.email,
            targetOpenId: user.openId,
          })
        );
      });

      return { success: true, deleted: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Knowledge Collections CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  listCollections: managerProcedure
    .input(z.object({ valueStreamId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      await requireAdminFeatureFlag({
        db,
        user: ctx.user,
        key: "release.knowledge.library.collections",
        message: "Knowledge collections are disabled for this deployment",
      });

      try {
        let query = db.select().from(knowledgeCollections);
        if (input.valueStreamId) {
          ensureManagerHasStreamAccess(ctx, input.valueStreamId);
          query = query.where(
            eq(knowledgeCollections.valueStreamId, input.valueStreamId)
          ) as any;
        } else if (ctx.user.role !== "admin") {
          const scopedStreamIds = (ctx.user.valueStreams ?? "")
            .split(",")
            .map(scope => scope.trim())
            .filter(scope => scope && scope !== "global");

          if (scopedStreamIds.length === 0) {
            return [];
          }

          query = query.where(
            inArray(knowledgeCollections.valueStreamId, scopedStreamIds)
          ) as any;
        }
        return await (query as any).orderBy(asc(knowledgeCollections.name));
      } catch (err) {
        log.error({ err }, "listCollections DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load collections",
        });
      }
    }),

  createCollection: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().min(1),
        name: z.string().min(1).max(128),
        description: z.string().max(500).optional(),
        department: z.string().max(64).optional(),
        defaultDocType: z
          .enum([
            "general",
            "sop",
            "policy",
            "faq",
            "training",
            "product",
            "report",
          ])
          .optional(),
        autoTags: z.array(z.string().max(64)).max(10).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await requireAdminFeatureFlag({
        db,
        user: ctx.user,
        key: "release.knowledge.library.collections",
        message: "Knowledge collections are disabled for this deployment",
      });

      try {
        // Verify parent stream exists
        const [stream] = await db
          .select({ id: valueStreams.id })
          .from(valueStreams)
          .where(eq(valueStreams.id, input.valueStreamId))
          .limit(1);

        if (!stream) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Value stream "${input.valueStreamId}" not found`,
          });
        }

        ensureManagerHasStreamAccess(ctx, stream.id);

        const id = nanoid(16);
        await db.insert(knowledgeCollections).values({
          id,
          valueStreamId: input.valueStreamId,
          name: input.name,
          description: input.description ?? null,
          department: input.department ?? null,
          defaultDocType: input.defaultDocType ?? "general",
          autoTags: input.autoTags ? JSON.stringify(input.autoTags) : null,
          isActive: 1,
        });

        return { id, name: input.name };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "createCollection DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create collection",
        });
      }
    }),

  updateCollection: managerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(500).optional().nullable(),
        department: z.string().max(64).optional().nullable(),
        defaultDocType: z
          .enum([
            "general",
            "sop",
            "policy",
            "faq",
            "training",
            "product",
            "report",
          ])
          .optional(),
        autoTags: z.array(z.string().max(64)).max(10).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await requireAdminFeatureFlag({
        db,
        user: ctx.user,
        key: "release.knowledge.library.collections",
        message: "Knowledge collections are disabled for this deployment",
      });

      try {
        const [existing] = await db
          .select({
            id: knowledgeCollections.id,
            valueStreamId: knowledgeCollections.valueStreamId,
          })
          .from(knowledgeCollections)
          .where(eq(knowledgeCollections.id, input.id))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Collection "${input.id}" not found`,
          });
        }

        ensureManagerHasStreamAccess(ctx, existing.valueStreamId);

        const set: Record<string, unknown> = {};
        if (input.name !== undefined) set.name = input.name;
        if (input.description !== undefined)
          set.description = input.description;
        if (input.department !== undefined) set.department = input.department;
        if (input.defaultDocType !== undefined)
          set.defaultDocType = input.defaultDocType;
        if (input.autoTags !== undefined)
          set.autoTags = JSON.stringify(input.autoTags);
        if (input.isActive !== undefined) set.isActive = input.isActive ? 1 : 0;

        if (Object.keys(set).length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No fields to update",
          });
        }

        await db
          .update(knowledgeCollections)
          .set(set)
          .where(eq(knowledgeCollections.id, input.id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "updateCollection DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update collection",
        });
      }
    }),

  deleteCollection: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      await requireAdminFeatureFlag({
        db,
        user: ctx.user,
        key: "release.knowledge.library.collections",
        message: "Knowledge collections are disabled for this deployment",
      });

      try {
        const [existing] = await db
          .select({
            id: knowledgeCollections.id,
            valueStreamId: knowledgeCollections.valueStreamId,
          })
          .from(knowledgeCollections)
          .where(eq(knowledgeCollections.id, input.id))
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Collection "${input.id}" not found`,
          });
        }

        ensureManagerHasStreamAccess(ctx, existing.valueStreamId);

        await db
          .delete(knowledgeCollections)
          .where(eq(knowledgeCollections.id, input.id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "deleteCollection DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete collection",
        });
      }
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Knowledge Invites
  // ═══════════════════════════════════════════════════════════════════════════

  listInvites: managerProcedure
    .input(z.object({ valueStreamId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        let query = db.select().from(knowledgeInvites);
        if (input.valueStreamId) {
          ensureManagerHasStreamAccess(ctx, input.valueStreamId);
          query = query.where(
            eq(knowledgeInvites.valueStreamId, input.valueStreamId)
          ) as any;
        } else if (
          !ctx.isGlobalScope &&
          !(ctx.scopes ?? []).includes("global")
        ) {
          const scopes = (ctx.scopes ?? []).filter(Boolean);
          if (scopes.length === 0) return [];
          query = query.where(
            inArray(knowledgeInvites.valueStreamId, scopes)
          ) as any;
        }
        return await (query as any).orderBy(desc(knowledgeInvites.createdAt));
      } catch (err) {
        log.error({ err }, "listInvites DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load invites",
        });
      }
    }),

  createInvite: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["manager", "operator", "viewer"]).optional(),
        note: z.string().max(500).optional(),
        expiresInDays: z.number().int().min(1).max(90).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      try {
        ensureManagerHasStreamAccess(ctx, input.valueStreamId);

        const ALLOWED_DOMAIN =
          process.env.INVITE_ALLOWED_DOMAIN || "hki.com";
        if (!input.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Only @${ALLOWED_DOMAIN} email addresses can be invited`,
          });
        }

        const [stream] = await db
          .select({ id: valueStreams.id, name: valueStreams.name })
          .from(valueStreams)
          .where(eq(valueStreams.id, input.valueStreamId))
          .limit(1);
        if (!stream)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Value stream not found",
          });

        // Check for existing pending invite for this email+stream
        const [existing] = await db
          .select({ id: knowledgeInvites.id })
          .from(knowledgeInvites)
          .where(
            sql`${knowledgeInvites.email} = ${input.email} AND ${knowledgeInvites.valueStreamId} = ${input.valueStreamId} AND ${knowledgeInvites.status} = 'pending'`
          )
          .limit(1);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Pending invite already exists for ${input.email}`,
          });
        }

        const id = nanoid(16);
        // Generate 8-char URL-safe invite code
        const inviteCode = nanoid(8).toUpperCase();
        const days = input.expiresInDays ?? 14;
        const expiresAt = new Date(Date.now() + days * 86400000);

        await db.insert(knowledgeInvites).values({
          id,
          valueStreamId: input.valueStreamId,
          email: input.email,
          inviteCode,
          role: input.role ?? DEFAULT_STANDARD_ROLE,
          status: "pending",
          note: input.note ?? null,
          createdBy: ctx.user.id,
          expiresAt,
        });

        // Fire-and-forget email — don't block the response on delivery
        sendInviteEmail({
          to: input.email,
          inviteCode,
          streamName: stream.name,
          role: input.role ?? DEFAULT_STANDARD_ROLE,
          inviterName: ctx.user.name || ctx.user.email || undefined,
          expiresAt: expiresAt.toISOString(),
          note: input.note || undefined,
        }).catch(err => log.error({ err }, "createInvite email send failed"));

        return {
          id,
          inviteCode,
          email: input.email,
          streamName: stream.name,
          expiresAt: expiresAt.toISOString(),
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "createInvite DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create invite",
        });
      }
    }),

  revokeInvite: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      try {
        const [invite] = await db
          .select({
            id: knowledgeInvites.id,
            status: knowledgeInvites.status,
            valueStreamId: knowledgeInvites.valueStreamId,
          })
          .from(knowledgeInvites)
          .where(eq(knowledgeInvites.id, input.id))
          .limit(1);
        if (!invite)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invite not found",
          });
        if (invite.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot revoke invite with status "${invite.status}"`,
          });
        }
        ensureManagerHasStreamAccess(ctx, invite.valueStreamId);

        await db
          .update(knowledgeInvites)
          .set({ status: "revoked" })
          .where(eq(knowledgeInvites.id, input.id));
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "revokeInvite DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revoke invite",
        });
      }
    }),

  // Any authenticated user can accept — not admin-only
  acceptInvite: protectedProcedure
    .input(z.object({ inviteCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      try {
        const [invite] = await db
          .select()
          .from(knowledgeInvites)
          .where(
            eq(knowledgeInvites.inviteCode, input.inviteCode.toUpperCase())
          )
          .limit(1);

        if (!invite)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invalid invite code",
          });
        if (invite.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invite is ${invite.status}`,
          });
        }
        if (new Date(invite.expiresAt) < new Date()) {
          await db
            .update(knowledgeInvites)
            .set({ status: "expired" })
            .where(eq(knowledgeInvites.id, invite.id));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invite has expired",
          });
        }

        // Verify the accepting user's email matches the invite target
        const userEmail = ctx.user.email || "";
        const inviteEmail = invite.email || "";
        if (
          inviteEmail &&
          userEmail.toLowerCase() !== inviteEmail.toLowerCase()
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invite was sent to a different email address",
          });
        }

        await db
          .update(knowledgeInvites)
          .set({
            status: "accepted",
            acceptedBy: ctx.user.id,
            acceptedAt: new Date(),
          })
          .where(eq(knowledgeInvites.id, invite.id));

        // Upgrade role if invite grants higher privileges
        const roleRank: Record<string, number> = {
          admin: 4,
          manager: 3,
          operator: 2,
          viewer: 1,
        };
        const currentRank = roleRank[ctx.user.role] || 1;
        const inviteRank = roleRank[invite.role] || 1;

        if (inviteRank > currentRank) {
          await db
            .update(users)
            .set({ role: invite.role })
            .where(eq(users.id, ctx.user.id));
        }

        // Upsert stream assignment
        await db
          .insert(userValueStreams)
          .values({
            userId: ctx.user.id,
            valueStreamId: invite.valueStreamId,
          })
          .onDuplicateKeyUpdate({ set: { assignedAt: new Date() } });

        // Update denormalized users.valueStreams so scope takes effect immediately
        const assignments = await db
          .select({ valueStreamId: userValueStreams.valueStreamId })
          .from(userValueStreams)
          .where(eq(userValueStreams.userId, ctx.user.id));
        const streamList = assignments.map(a => a.valueStreamId).join(",");
        await db
          .update(users)
          .set({ valueStreams: streamList || null })
          .where(eq(users.id, ctx.user.id));

        return {
          success: true,
          valueStreamId: invite.valueStreamId,
          role: invite.role,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        log.error({ err }, "acceptInvite DB error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to accept invite",
        });
      }
    }),
});
