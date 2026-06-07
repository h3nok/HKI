/**
 * Server-side ingestion job watcher.
 *
 * Polls the knowledge-pipeline-service for a specific job's status and pushes
 * updates to connected WebSocket clients via broadcastJobUpdate. Stops when the
 * job reaches a terminal state (completed | failed | cancelled) or after the
 * max-watch deadline.
 *
 * Why server-side polling instead of client-side:
 *   - One poll per job instead of N polls (one per connected browser tab).
 *   - Pushes to the user's `/ws/jobs` channel — no client-side timers needed.
 *   - Falls back gracefully: if no WS client is connected the polling still runs
 *     so the cache is warm by the time the user navigates to the Pipelines tab.
 */

import { broadcastJobUpdate } from "./websocket";
import { KNOWLEDGE_PIPELINE_URL } from "./service-client";
import { signRequestJwt } from "./auth/sign-request-jwt";
import { createLogger } from "./_core/logger";
import type { User } from "../drizzle/schema";

const log = createLogger("job-watcher");

// Terminal statuses — stop polling once reached.
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "expired",
]);

export function isTerminalJobStatus(
  status: string | null | undefined
): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized.length > 0 && TERMINAL_STATUSES.has(normalized);
}

// Poll interval schedule (ms). Starts fast, slows down over time.
// Rationale: most text/URL ingestions complete in < 30s; large PDFs take longer.
const POLL_SCHEDULE_MS = [2_000, 3_000, 5_000, 10_000, 15_000, 30_000];

// Maximum time to watch a single job (10 min).
const MAX_WATCH_MS = 10 * 60 * 1_000;

// ── Active watcher registry ──
// Prevents duplicate watchers for the same job and enables status queries.
const activeWatchers = new Map<
  string,
  { userId: number; startedAt: number; lastStatus: string }
>();

/** Return a snapshot of all currently active job watchers. */
export function getActiveWatchers(): Array<{
  jobId: string;
  userId: number;
  startedAt: number;
  lastStatus: string;
  elapsedMs: number;
}> {
  const now = Date.now();
  return Array.from(activeWatchers.entries()).map(([jobId, w]) => ({
    jobId,
    userId: w.userId,
    startedAt: w.startedAt,
    lastStatus: w.lastStatus,
    elapsedMs: now - w.startedAt,
  }));
}

/** Stop watching a specific job (e.g. user cancelled or navigated away). */
export function stopJobWatcher(jobId: string): boolean {
  return activeWatchers.delete(jobId);
}

/**
 * Start watching a job in the background (fire-and-forget).
 *
 * @param jobId   The pipeline service job ID returned by an ingest endpoint.
 * @param userId  The numeric BFF user ID (used to route WS broadcasts).
 * @param user    The full user record (needed to mint a service JWT).
 * @param scope   The single value-stream scope for this job.
 */
export function startJobWatcher(
  jobId: string,
  userId: number,
  user: User,
  scope: string
): void {
  // Prevent duplicate watchers for the same job
  if (activeWatchers.has(jobId)) {
    log.info({ jobId }, "Job watcher already active, skipping duplicate");
    return;
  }

  activeWatchers.set(jobId, {
    userId,
    startedAt: Date.now(),
    lastStatus: "pending",
  });

  // Fire-and-forget — intentionally not awaited by callers.
  watchJob(jobId, userId, user, scope)
    .catch(err => {
      log.warn({ err, jobId }, "Job watcher terminated unexpectedly");
    })
    .finally(() => {
      activeWatchers.delete(jobId);
    });
}

async function watchJob(
  jobId: string,
  userId: number,
  user: User,
  scope: string
): Promise<void> {
  const deadline = Date.now() + MAX_WATCH_MS;
  let pollIdx = 0;
  let lastStatus = "";
  let isFirstPoll = true;

  while (Date.now() < deadline) {
    // Check if watcher was externally stopped (via stopJobWatcher)
    if (!activeWatchers.has(jobId)) {
      log.info({ jobId }, "Job watcher stopped externally");
      return;
    }

    if (!isFirstPoll) {
      const intervalMs = POLL_SCHEDULE_MS[pollIdx] ?? 30_000;
      await sleep(intervalMs);
    }
    isFirstPoll = false;

    try {
      const token = await signRequestJwt(user, scope, [scope]);
      const resp = await fetch(`${KNOWLEDGE_PIPELINE_URL}/v1/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Service-Auth": `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8_000),
      });

      if (resp.status === 404) {
        log.info({ jobId }, "Job poll returned 404; treating job as expired");
        broadcastJobUpdate(userId, {
          id: jobId,
          status: "expired",
          stream_id: scope,
          error:
            "Job record is no longer available. It may have been cleaned up after retention TTL.",
        });
        return;
      }

      if (!resp.ok) {
        // Service temporarily unavailable — keep retrying but don't advance schedule.
        log.warn(
          { jobId, status: resp.status },
          "Job poll returned non-OK, retrying"
        );
        continue;
      }

      const job = (await resp.json()) as Record<string, unknown>;
      const currentStatus = String(job.status ?? "");

      if (currentStatus !== lastStatus) {
        lastStatus = currentStatus;
        // Update registry
        const entry = activeWatchers.get(jobId);
        if (entry) entry.lastStatus = currentStatus;
        broadcastJobUpdate(userId, job);
        log.info(
          { jobId, status: currentStatus },
          "Job status change broadcast"
        );
      }

      if (isTerminalJobStatus(currentStatus)) {
        log.info(
          { jobId, status: currentStatus },
          "Job reached terminal state, stopping watcher"
        );
        return;
      }
    } catch (err: any) {
      if (err?.name === "TimeoutError") {
        log.warn({ jobId }, "Job poll timed out, retrying");
      } else {
        log.warn({ err, jobId }, "Job poll error, retrying");
      }
    }

    // Advance through the backoff schedule.
    pollIdx = Math.min(pollIdx + 1, POLL_SCHEDULE_MS.length - 1);
  }

  log.warn({ jobId }, "Job watcher exceeded max watch duration");
  // Broadcast a timeout status so clients know the watcher gave up
  broadcastJobUpdate(userId, {
    id: jobId,
    status: "timeout",
    stream_id: scope,
    error:
      "Job monitoring exceeded 10-minute limit. The job may still be processing — check the Pipelines tab.",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
