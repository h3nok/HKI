/**
 * Knowledge Connectors Router
 *
 * CRUD + sync operations for external data source connectors.
 * Supports: Google Drive, SharePoint, S3, Confluence, Notion,
 * databases (PostgreSQL, MySQL, BigQuery), lakehouses (Snowflake, Databricks),
 * REST APIs, and more.
 *
 * Auth: manager+ role (knowledge curators)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { eq, and, desc } from "drizzle-orm";
import type { Role } from "@shared/access-control";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { managerProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  knowledgeConnectors,
  knowledgeConnectorSyncs,
} from "../drizzle/schema";
import { createLogger } from "./_core/logger";
import {
  isFeatureEnabledForUser,
  loadFeatureFlagOverrides,
} from "./_core/feature-flags";
import {
  parseConnectorCredentials,
  parseGoogleDriveConnectorCredentials,
  storeConnectorCredentials,
} from "./connectors/connector-credentials";
import {
  ensureConnectorAccess,
  getConnectorStreamId,
  isConnectorVisibleToUser,
  normalizeConnectorConfigStream,
  parseConnectorConfig,
  requirePersistedConnectorStreamId,
} from "./connectors/stream-access";

const log = createLogger("connectors");

async function revokeGoogleConnectorToken(
  connectorId: string,
  storedCredentials: string
): Promise<void> {
  try {
    const credentials = parseConnectorCredentials(storedCredentials);
    const tokenToRevoke =
      typeof credentials.refresh_token === "string" && credentials.refresh_token
        ? credentials.refresh_token
        : typeof credentials.access_token === "string"
          ? credentials.access_token
          : "";

    if (!tokenToRevoke) return;

    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: tokenToRevoke }).toString(),
    });

    if (!response.ok) {
      log.warn(
        {
          connectorId,
          status: response.status,
          statusText: response.statusText,
        },
        "Google token revocation failed"
      );
    }
  } catch (err) {
    log.warn({ err, connectorId }, "Failed to revoke Google connector token");
  }
}

// ── Connector Type Registry ──────────────────────────────────────────────────

export const CONNECTOR_TYPES = [
  "google_drive",
  "sharepoint",
  "s3",
  "confluence",
  "notion",
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

const CONNECTORS_FEATURE_KEY = "release.knowledge.ingest.connectors";
const CONNECTOR_TYPE_FEATURE_KEYS: Partial<
  Record<ConnectorType, FeatureFlagKey>
> = {
  google_drive: "release.connectors.googleDrive",
};
const MIN_CONNECTOR_SYNC_INTERVAL_MINUTES = 15;
const MAX_CONNECTORS_PER_STREAM = 5;
const MANUAL_SYNC_COOLDOWN_MINUTES = 5;

function ensureConnectorFeatureEnabled(options: {
  user: { role: Role; valueStreams: string | null; orgId?: string | null };
  overrides: Array<{ featureKey: string; enabled: boolean | number | null }>;
  type?: ConnectorType;
}): void {
  if (
    !isFeatureEnabledForUser({
      user: options.user,
      key: CONNECTORS_FEATURE_KEY,
      overrides: options.overrides,
    })
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Connectors are disabled for this deployment",
    });
  }

  const typeFeatureKey = options.type
    ? CONNECTOR_TYPE_FEATURE_KEYS[options.type]
    : undefined;
  if (
    typeFeatureKey &&
    !isFeatureEnabledForUser({
      user: options.user,
      key: typeFeatureKey,
      overrides: options.overrides,
    })
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This connector type is disabled for this deployment",
    });
  }
}

function isConnectorTypeEnabled(options: {
  user: { role: Role; valueStreams: string | null; orgId?: string | null };
  overrides: Array<{ featureKey: string; enabled: boolean | number | null }>;
  type: ConnectorType;
}): boolean {
  if (
    !isFeatureEnabledForUser({
      user: options.user,
      key: CONNECTORS_FEATURE_KEY,
      overrides: options.overrides,
    })
  ) {
    return false;
  }

  const typeFeatureKey = CONNECTOR_TYPE_FEATURE_KEYS[options.type];
  if (!typeFeatureKey) return true;

  return isFeatureEnabledForUser({
    user: options.user,
    key: typeFeatureKey,
    overrides: options.overrides,
  });
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const connectorConfigSchema = z.object({
  // Google Drive
  folderId: z.string().optional(),
  folderName: z.string().optional(),
  folderUrl: z.string().optional(),
  includeSubfolders: z.boolean().optional(),
  streamId: z.string().optional(),
  streamName: z.string().optional(),
  // SharePoint
  siteUrl: z.string().optional(),
  libraryName: z.string().optional(),
  // S3
  bucket: z.string().optional(),
  prefix: z.string().optional(),
  region: z.string().optional(),
  // Confluence
  spaceKey: z.string().optional(),
  baseUrl: z.string().optional(),
  // Notion
  databaseId: z.string().optional(),
  // Database connectors
  connectionString: z.string().optional(),
  query: z.string().optional(),
  table: z.string().optional(),
  schema: z.string().optional(),
  // Lakehouse
  warehouse: z.string().optional(),
  catalog: z.string().optional(),
  // API
  endpoint: z.string().optional(),
  method: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // Shared
  mimeTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().optional(),
  schedule: z.string().optional(),
});

function requireConnectorStreamId(config: Record<string, unknown>): string {
  const streamId =
    typeof config.streamId === "string" ? config.streamId.trim() : "";

  if (!streamId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a value stream for this connector",
    });
  }

  return streamId;
}

async function ensureConnectorQuota(options: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  orgId: string;
  streamId: string;
  excludeConnectorId?: string;
}) {
  const rows = await options.db
    .select({ id: knowledgeConnectors.id })
    .from(knowledgeConnectors)
    .where(
      and(
        eq(knowledgeConnectors.orgId, options.orgId),
        eq(knowledgeConnectors.streamId, options.streamId)
      )
    );

  const activeCount = rows.filter(
    row => row.id !== options.excludeConnectorId
  ).length;
  if (activeCount >= MAX_CONNECTORS_PER_STREAM) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Each value stream can have up to ${MAX_CONNECTORS_PER_STREAM} connectors. Remove or reuse an existing connector first.`,
    });
  }
}

function enforceManualSyncGuardrails(connector: {
  status: string;
  lastSyncAt: Date | null;
}) {
  if (connector.status === "paused") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Resume this connector before running a manual sync",
    });
  }

  if (connector.status === "revoked") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reconnect this connector before running a manual sync",
    });
  }

  if (!connector.lastSyncAt) {
    return;
  }

  const minutesSinceLastSync = Math.floor(
    (Date.now() - connector.lastSyncAt.getTime()) / 60_000
  );
  if (minutesSinceLastSync < MANUAL_SYNC_COOLDOWN_MINUTES) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Manual sync is limited to once every ${MANUAL_SYNC_COOLDOWN_MINUTES} minutes per connector.`,
    });
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

export const connectorsRouter = router({
  /** List all connectors for the current org */
  list: managerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const orgId = ctx.user.orgId ?? "default";
    const overrides = await loadFeatureFlagOverrides(db, orgId);

    if (
      !isFeatureEnabledForUser({
        user: ctx.user,
        key: CONNECTORS_FEATURE_KEY,
        overrides,
      })
    ) {
      return [];
    }

    try {
      const rows = await db
        .select()
        .from(knowledgeConnectors)
        .where(eq(knowledgeConnectors.orgId, orgId))
        .orderBy(desc(knowledgeConnectors.createdAt));

      return rows
        .filter(row => isConnectorVisibleToUser(ctx, row.config))
        .filter(row =>
          isConnectorTypeEnabled({
            user: ctx.user,
            overrides,
            type: row.type,
          })
        )
        .map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          status: r.status,
          syncIntervalMinutes: r.syncIntervalMinutes,
          lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
          lastSyncStats: r.lastSyncStats ? JSON.parse(r.lastSyncStats) : null,
          lastErrorAt: r.lastErrorAt?.toISOString() ?? null,
          lastErrorMessage: r.lastErrorMessage,
          consecutiveErrors: r.consecutiveErrors,
          config: parseConnectorConfig(r.config),
          createdAt: r.createdAt.toISOString(),
        }));
    } catch (err) {
      log.warn({ err, orgId }, "connectors.list failed — returning empty list");
      return [];
    }
  }),

  /** Create a new connector */
  create: managerProcedure
    .input(
      z.object({
        type: z.enum(CONNECTOR_TYPES),
        name: z.string().min(1).max(128),
        config: connectorConfigSchema,
        syncIntervalMinutes: z
          .number()
          .min(MIN_CONNECTOR_SYNC_INTERVAL_MINUTES)
          .max(1440)
          .default(30),
        credentials: z.string().default("{}"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const overrides = await loadFeatureFlagOverrides(
        db,
        ctx.user.orgId ?? "default"
      );
      ensureConnectorFeatureEnabled({
        user: ctx.user,
        overrides,
        type: input.type,
      });

      // Per-type config validation — reject empty/invalid configs
      const cfg = input.config;
      const missing = (field: string) =>
        new TRPCError({
          code: "BAD_REQUEST",
          message: `${input.type} connector requires '${field}' in config`,
        });

      switch (input.type) {
        case "google_drive":
          if (!cfg.folderId && !cfg.folderUrl)
            throw missing("folderId or folderUrl");
          break;
        case "sharepoint":
          if (!cfg.siteUrl) throw missing("siteUrl");
          if (!cfg.libraryName) throw missing("libraryName");
          break;
        case "s3":
          if (!cfg.bucket) throw missing("bucket");
          break;
        case "confluence":
          if (!cfg.baseUrl) throw missing("baseUrl");
          if (!cfg.spaceKey) throw missing("spaceKey");
          break;
        case "notion":
          if (!cfg.databaseId) throw missing("databaseId");
          break;
      }

      const normalizedConfig = normalizeConnectorConfigStream(
        ctx,
        input.config,
        {
          defaultToFirstScoped: false,
        }
      );
      const streamId = requireConnectorStreamId(normalizedConfig);
      let parsedCredentials: Record<string, unknown>;
      try {
        parsedCredentials = JSON.parse(input.credentials) as Record<
          string,
          unknown
        >;
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connector credentials must be valid JSON",
        });
      }

      const id = nanoid(21);
      const orgId = ctx.user.orgId ?? "default";
      await ensureConnectorQuota({ db, orgId, streamId });
      const storedCredentials = storeConnectorCredentials(parsedCredentials);

      await db.insert(knowledgeConnectors).values({
        id,
        orgId,
        streamId,
        createdBy: ctx.user.id,
        type: input.type,
        name: input.name,
        status: "active",
        credentialsEncrypted: storedCredentials.value,
        credentialsVersion: storedCredentials.version,
        config: JSON.stringify(normalizedConfig),
        syncIntervalMinutes: input.syncIntervalMinutes,
        consecutiveErrors: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { id, status: "active" as const };
    }),

  /** Update connector config / status */
  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(128).optional(),
        config: connectorConfigSchema.optional(),
        syncIntervalMinutes: z
          .number()
          .min(MIN_CONNECTOR_SYNC_INTERVAL_MINUTES)
          .max(1440)
          .optional(),
        status: z.enum(["active", "paused"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const orgId = ctx.user.orgId ?? "default";
      const [existingConnector] = await db
        .select({
          id: knowledgeConnectors.id,
          type: knowledgeConnectors.type,
          streamId: knowledgeConnectors.streamId,
          config: knowledgeConnectors.config,
        })
        .from(knowledgeConnectors)
        .where(
          and(
            eq(knowledgeConnectors.id, input.id),
            eq(knowledgeConnectors.orgId, orgId)
          )
        )
        .limit(1);

      if (!existingConnector) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector not found",
        });
      }

      const overrides = await loadFeatureFlagOverrides(db, orgId);
      ensureConnectorFeatureEnabled({
        user: ctx.user,
        overrides,
        type: existingConnector.type,
      });

      ensureConnectorAccess(ctx, existingConnector.config);

      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.config) {
        const normalizedConfig = normalizeConnectorConfigStream(
          ctx,
          input.config,
          {
            defaultToFirstScoped: false,
          }
        );
        const streamId = requireConnectorStreamId(normalizedConfig);
        await ensureConnectorQuota({
          db,
          orgId,
          streamId,
          excludeConnectorId: input.id,
        });
        updates.config = JSON.stringify(normalizedConfig);
        updates.streamId = streamId;
      }
      if (input.syncIntervalMinutes)
        updates.syncIntervalMinutes = input.syncIntervalMinutes;
      if (input.status) updates.status = input.status;
      updates.updatedAt = new Date();

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      await db
        .update(knowledgeConnectors)
        .set(updates)
        .where(
          and(
            eq(knowledgeConnectors.id, input.id),
            eq(knowledgeConnectors.orgId, orgId)
          )
        );

      return { success: true };
    }),

  /** Delete a connector */
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const orgId = ctx.user.orgId ?? "default";
      const [connector] = await db
        .select({
          id: knowledgeConnectors.id,
          type: knowledgeConnectors.type,
          credentialsEncrypted: knowledgeConnectors.credentialsEncrypted,
          config: knowledgeConnectors.config,
        })
        .from(knowledgeConnectors)
        .where(
          and(
            eq(knowledgeConnectors.id, input.id),
            eq(knowledgeConnectors.orgId, orgId)
          )
        )
        .limit(1);

      if (!connector) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector not found",
        });
      }

      const overrides = await loadFeatureFlagOverrides(db, orgId);
      ensureConnectorFeatureEnabled({
        user: ctx.user,
        overrides,
        type: connector.type,
      });

      ensureConnectorAccess(ctx, connector.config);

      if (connector.type === "google_drive" && connector.credentialsEncrypted) {
        await revokeGoogleConnectorToken(
          input.id,
          connector.credentialsEncrypted
        );
      }

      await db
        .delete(knowledgeConnectors)
        .where(
          and(
            eq(knowledgeConnectors.id, input.id),
            eq(knowledgeConnectors.orgId, orgId)
          )
        );

      return { success: true };
    }),

  /** Trigger an immediate sync for a connector */
  triggerSync: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const orgId = ctx.user.orgId ?? "default";
      const syncId = nanoid(21);

      // Fetch connector config
      const [connector] = await db
        .select()
        .from(knowledgeConnectors)
        .where(
          and(
            eq(knowledgeConnectors.id, input.id),
            eq(knowledgeConnectors.orgId, orgId)
          )
        )
        .limit(1);

      if (!connector) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector not found",
        });
      }

      const overrides = await loadFeatureFlagOverrides(db, orgId);
      ensureConnectorFeatureEnabled({
        user: ctx.user,
        overrides,
        type: connector.type,
      });

      ensureConnectorAccess(ctx, connector.config);
      enforceManualSyncGuardrails(connector);

      const [runningSync] = await db
        .select({ id: knowledgeConnectorSyncs.id })
        .from(knowledgeConnectorSyncs)
        .where(
          and(
            eq(knowledgeConnectorSyncs.connectorId, input.id),
            eq(knowledgeConnectorSyncs.orgId, orgId),
            eq(knowledgeConnectorSyncs.status, "running")
          )
        )
        .limit(1);

      if (runningSync) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A sync is already running for this connector",
        });
      }

      const connectorStreamId = requirePersistedConnectorStreamId(connector);

      // Create sync record
      await db.insert(knowledgeConnectorSyncs).values({
        id: syncId,
        connectorId: input.id,
        orgId,
        streamId: connectorStreamId,
        status: "running",
        startedAt: new Date(),
        filesDiscovered: 0,
        filesProcessed: 0,
        filesFailed: 0,
        filesSkipped: 0,
        bytesDownloaded: 0,
        apiCalls: 0,
        rateLimitHits: 0,
      });

      // Get auth token for pipeline calls
      const authToken = await (
        await import("./auth/sign-request-jwt")
      ).signRequestJwt(ctx.user, connectorStreamId, [connectorStreamId]);

      // ── Google Drive: use the dedicated sync worker ──
      if (connector.type === "google_drive" && connector.credentialsEncrypted) {
        try {
          const credentials = parseGoogleDriveConnectorCredentials(
            connector.credentialsEncrypted
          );
          const config = connector.config ? JSON.parse(connector.config) : {};

          // Import and fire the sync worker (runs in background)
          const { executeGoogleDriveSync } =
            await import("./connectors/google-drive-sync");

          // Reset consecutive errors on manual trigger
          await db
            .update(knowledgeConnectors)
            .set({
              consecutiveErrors: 0,
              status: "active",
            })
            .where(eq(knowledgeConnectors.id, input.id));

          executeGoogleDriveSync({
            connectorId: input.id,
            syncId,
            credentials: {
              access_token: credentials.access_token,
              refresh_token: credentials.refresh_token ?? null,
              expiry_date: credentials.expiry_date ?? null,
            },
            config: {
              folderId: config.folderId ?? null,
              folderName: config.folderName ?? "Entire Drive",
              includeSubfolders: config.includeSubfolders ?? true,
              mimeTypes: config.mimeTypes,
              streamId: connectorStreamId,
            },
            authToken: await authToken,
            department: "google-drive",
            lastSyncToken: connector.lastSyncToken,
          }).catch(err => {
            log.error({ err }, "Google Drive sync failed");
          });
        } catch (err) {
          log.error({ err }, "Failed to start Google Drive sync");
          await db
            .update(knowledgeConnectorSyncs)
            .set({
              status: "failed",
              completedAt: new Date(),
              errors: JSON.stringify([
                `Failed to parse connector credentials: ${err}`,
              ]),
            })
            .where(eq(knowledgeConnectorSyncs.id, syncId));
        }
      } else {
        // ── Generic URL-based connector: call pipeline /v1/ingest/url ──
        try {
          const { KNOWLEDGE_PIPELINE_URL: PIPELINE_URL, getGoogleIdToken } =
            await import("./service-client");
          const configParsed = parseConnectorConfig(connector.config);

          const idToken = await getGoogleIdToken(PIPELINE_URL);
          const pipelineHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Service-Auth": `Bearer ${await authToken}`,
          };
          if (idToken) {
            pipelineHeaders["Authorization"] = `Bearer ${idToken}`;
          } else {
            pipelineHeaders["Authorization"] = `Bearer ${await authToken}`;
          }
          const resp = await fetch(`${PIPELINE_URL}/v1/ingest/url`, {
            method: "POST",
            headers: pipelineHeaders,
            body: JSON.stringify({
              url: configParsed.url || configParsed.siteUrl || "",
              title: connector.name,
              department: "connector-sync",
              document_type: connector.type,
              stream_id: connectorStreamId,
              metadata: {
                connector_id: connector.id,
                sync_id: syncId,
                connector_type: connector.type,
              },
            }),
          });

          if (!resp.ok) {
            await db
              .update(knowledgeConnectorSyncs)
              .set({
                status: "failed",
                completedAt: new Date(),
                errors: JSON.stringify([`Pipeline returned ${resp.status}`]),
              })
              .where(eq(knowledgeConnectorSyncs.id, syncId));
          }
        } catch (err) {
          log.error({ err }, "Pipeline trigger failed");
        }
      }

      return { syncId, status: "running" as const };
    }),

  /** Get sync history for a connector */
  syncHistory: managerProcedure
    .input(
      z.object({
        connectorId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const orgId = ctx.user.orgId ?? "default";
      const [connector] = await db
        .select({
          id: knowledgeConnectors.id,
          type: knowledgeConnectors.type,
          config: knowledgeConnectors.config,
        })
        .from(knowledgeConnectors)
        .where(
          and(
            eq(knowledgeConnectors.id, input.connectorId),
            eq(knowledgeConnectors.orgId, orgId)
          )
        )
        .limit(1);

      if (!connector) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector not found",
        });
      }

      const overrides = await loadFeatureFlagOverrides(db, orgId);
      ensureConnectorFeatureEnabled({
        user: ctx.user,
        overrides,
        type: connector.type,
      });

      ensureConnectorAccess(ctx, connector.config);

      const rows = await db
        .select()
        .from(knowledgeConnectorSyncs)
        .where(
          and(
            eq(knowledgeConnectorSyncs.connectorId, input.connectorId),
            eq(knowledgeConnectorSyncs.orgId, orgId)
          )
        )
        .orderBy(desc(knowledgeConnectorSyncs.startedAt))
        .limit(input.limit);

      return rows.map(r => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        filesDiscovered: r.filesDiscovered,
        filesProcessed: r.filesProcessed,
        filesFailed: r.filesFailed,
        filesSkipped: r.filesSkipped,
        bytesDownloaded: Number(r.bytesDownloaded),
        errors: r.errors ? JSON.parse(r.errors) : null,
        durationMs: r.durationMs,
        apiCalls: r.apiCalls,
        rateLimitHits: r.rateLimitHits,
      }));
    }),
});
