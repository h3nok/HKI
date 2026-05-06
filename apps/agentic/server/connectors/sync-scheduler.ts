/**
 * Connector Sync Scheduler
 *
 * Periodically checks for connectors that are due for sync based on
 * their syncIntervalMinutes and lastSyncAt. Uses Redis SETNX for
 * distributed locking to prevent duplicate syncs across BFF pods.
 *
 * Backoff: failed connectors are skipped for exponentially increasing
 * intervals based on consecutiveErrors (2^errors minutes, capped at 24h).
 *
 * Circuit breaker: connectors with >= 5 consecutive errors are auto-paused
 * by the sync worker (google-drive-sync.ts). The scheduler skips paused
 * connectors entirely.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  knowledgeConnectors,
  knowledgeConnectorSyncs,
} from "../../drizzle/schema";
import { signRequestJwt } from "../auth/sign-request-jwt";
import { executeGoogleDriveSync } from "./google-drive-sync";
import { createLogger } from "../_core/logger";
import { parseGoogleDriveConnectorCredentials } from "./connector-credentials";
import { resolvePersistedConnectorStreamId } from "./stream-access";

const log = createLogger("sync-scheduler");

const SCHEDULER_INTERVAL_MS = 60_000;
const LOCK_TTL_SECONDS = 300;
const LOCK_PREFIX = "sync:lock:";
const MAX_BACKOFF_MINUTES = 1440;
const LOCK_RENEWAL_INTERVAL_MS = Math.max(
  30_000,
  Math.floor((LOCK_TTL_SECONDS * 1000) / 2)
);

let _redis: any = null;
let _redisAttempted = false;
let _intervalHandle: ReturnType<typeof setInterval> | null = null;
let _running = false;

async function getRedis(): Promise<any> {
  if (_redis) return _redis;
  if (_redisAttempted) return null;
  _redisAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.info(
      "No REDIS_URL — sync scheduler using in-process locking (single-pod)"
    );
    return null;
  }

  try {
    const { default: Redis } = await import("ioredis");
    _redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    _redis.on("error", (err: any) => log.error({ err }, "Redis client error"));
    await _redis.connect();
    log.info("Sync scheduler connected to Redis for distributed locking");
    return _redis;
  } catch (err) {
    log.info({ err }, "Redis unavailable — using in-process locking");
    _redis = null;
    return null;
  }
}

const _inProcessLocks = new Set<string>();
const _inProcessLockTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function refreshInProcessLock(connectorId: string): void {
  const existing = _inProcessLockTimeouts.get(connectorId);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    _inProcessLocks.delete(connectorId);
    _inProcessLockTimeouts.delete(connectorId);
  }, LOCK_TTL_SECONDS * 1000);
  _inProcessLockTimeouts.set(connectorId, timeout);
}

async function acquireLock(connectorId: string): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}${connectorId}`;

  try {
    const redis = await getRedis();
    if (redis) {
      const result = await redis.set(
        lockKey,
        Date.now().toString(),
        "EX",
        LOCK_TTL_SECONDS,
        "NX"
      );
      return result === "OK";
    }
  } catch {
    /* fall through to in-process */
  }

  if (_inProcessLocks.has(connectorId)) return false;
  _inProcessLocks.add(connectorId);
  refreshInProcessLock(connectorId);
  return true;
}

function startLockHeartbeat(connectorId: string): () => void {
  const interval = setInterval(async () => {
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.expire(`${LOCK_PREFIX}${connectorId}`, LOCK_TTL_SECONDS);
        return;
      }
    } catch (err) {
      log.warn({ err, connectorId }, "Failed to renew sync lock TTL");
      return;
    }

    if (_inProcessLocks.has(connectorId)) {
      refreshInProcessLock(connectorId);
    }
  }, LOCK_RENEWAL_INTERVAL_MS);

  return () => clearInterval(interval);
}

async function releaseLock(connectorId: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (redis) {
      await redis.del(`${LOCK_PREFIX}${connectorId}`);
      return;
    }
  } catch {
    /* fall through */
  }
  const timeout = _inProcessLockTimeouts.get(connectorId);
  if (timeout) clearTimeout(timeout);
  _inProcessLockTimeouts.delete(connectorId);
  _inProcessLocks.delete(connectorId);
}

function calculateBackoffMinutes(consecutiveErrors: number): number {
  if (consecutiveErrors <= 0) return 0;
  return Math.min(Math.pow(2, consecutiveErrors), MAX_BACKOFF_MINUTES);
}

async function getDevUser() {
  return {
    id: 0,
    openId: "sync-scheduler",
    name: "Sync Scheduler",
    email: "scheduler@system",
    role: "admin" as const,
    orgId: "default",
    department: null,
    pngId: null,
    valueStreams: null,
    loginMethod: "system",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

async function tick(): Promise<void> {
  if (_running) return; // Skip if previous tick is still running
  _running = true;

  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // Find all active connectors with a sync interval configured
    const connectors = await db
      .select({
        id: knowledgeConnectors.id,
        type: knowledgeConnectors.type,
        status: knowledgeConnectors.status,
        syncIntervalMinutes: knowledgeConnectors.syncIntervalMinutes,
        lastSyncAt: knowledgeConnectors.lastSyncAt,
        lastSyncToken: knowledgeConnectors.lastSyncToken,
        consecutiveErrors: knowledgeConnectors.consecutiveErrors,
        credentialsEncrypted: knowledgeConnectors.credentialsEncrypted,
        config: knowledgeConnectors.config,
        orgId: knowledgeConnectors.orgId,
        createdBy: knowledgeConnectors.createdBy,
        streamId: knowledgeConnectors.streamId,
      })
      .from(knowledgeConnectors)
      .where(eq(knowledgeConnectors.status, "active"));

    for (const connector of connectors) {
      if (!connector.syncIntervalMinutes) continue;

      // Calculate when the next sync is due
      const lastSync = connector.lastSyncAt
        ? new Date(connector.lastSyncAt).getTime()
        : 0;
      const intervalMs = connector.syncIntervalMinutes * 60_000;
      const backoffMs =
        calculateBackoffMinutes(connector.consecutiveErrors ?? 0) * 60_000;
      const nextDueAt = lastSync + intervalMs + backoffMs;

      if (now.getTime() < nextDueAt) continue; // Not due yet

      // Acquire distributed lock
      const locked = await acquireLock(connector.id);
      if (!locked) continue; // Another pod is handling this
      const stopLockHeartbeat = startLockHeartbeat(connector.id);

      try {
        log.info(
          {
            connectorId: connector.id,
            type: connector.type,
            intervalMin: connector.syncIntervalMinutes,
            lastSync: connector.lastSyncAt,
            errors: connector.consecutiveErrors,
          },
          "Triggering scheduled sync"
        );

        const connectorStreamId = resolvePersistedConnectorStreamId(connector);
        if (!connectorStreamId) {
          await db
            .update(knowledgeConnectors)
            .set({
              status: "paused",
              consecutiveErrors: (connector.consecutiveErrors ?? 0) + 1,
              lastErrorAt: now,
              lastErrorMessage:
                "Connector is missing a non-global value stream assignment",
              updatedAt: now,
            })
            .where(eq(knowledgeConnectors.id, connector.id));

          log.error(
            { connectorId: connector.id },
            "Paused connector sync without explicit stream ownership"
          );
          stopLockHeartbeat();
          await releaseLock(connector.id);
          continue;
        }

        // Create sync record
        const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await db.insert(knowledgeConnectorSyncs).values({
          id: syncId,
          connectorId: connector.id,
          orgId: connector.orgId,
          streamId: connectorStreamId,
          status: "running",
          startedAt: now,
          filesDiscovered: 0,
          filesProcessed: 0,
          filesFailed: 0,
          filesSkipped: 0,
          bytesDownloaded: 0,
          apiCalls: 0,
          rateLimitHits: 0,
        });

        if (
          connector.type === "google_drive" &&
          connector.credentialsEncrypted
        ) {
          const credentials = parseGoogleDriveConnectorCredentials(
            connector.credentialsEncrypted
          );
          const config = connector.config ? JSON.parse(connector.config) : {};
          const systemUser = await getDevUser();
          const authToken = await signRequestJwt(
            systemUser as any,
            connectorStreamId,
            [connectorStreamId]
          );

          executeGoogleDriveSync({
            connectorId: connector.id,
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
              streamId: connectorStreamId,
            },
            authToken,
            department: "google-drive",
            lastSyncToken: connector.lastSyncToken,
          })
            .catch(err =>
              log.error(
                { err, connectorId: connector.id },
                "Scheduled sync failed"
              )
            )
            .finally(async () => {
              stopLockHeartbeat();
              await releaseLock(connector.id);
            });
        } else {
          stopLockHeartbeat();
          await releaseLock(connector.id);
        }
      } catch (err) {
        log.error(
          { err, connectorId: connector.id },
          "Error dispatching scheduled sync"
        );
        stopLockHeartbeat();
        await releaseLock(connector.id);
      }
    }
  } catch (err) {
    log.error({ err }, "Scheduler tick failed");
  } finally {
    _running = false;
  }
}

export function startSyncScheduler(): void {
  if (_intervalHandle) return;

  log.info(
    { intervalMs: SCHEDULER_INTERVAL_MS },
    "Starting connector sync scheduler"
  );
  _intervalHandle = setInterval(tick, SCHEDULER_INTERVAL_MS);

  // Run first tick after a short delay to let the server fully start
  setTimeout(tick, 5_000);
}

export async function stopSyncScheduler(): Promise<void> {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }

  if (_redis) {
    await _redis.quit().catch(() => {});
    _redis = null;
  }

  log.info("Sync scheduler stopped");
}
