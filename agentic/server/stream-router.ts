/**
 * Stream Router — query-to-stream routing for multi-stream users.
 *
 * When a user has access to multiple value streams and hasn't pinned a
 * specific one, this module selects the most relevant stream for a given
 * query by scoring each stream's profile (name + description + system
 * prompt) against the query's terms using TF-IDF-style matching.
 *
 * Design choices:
 *   - Pure keyword scoring: zero external API calls, sub-millisecond
 *   - Stream profiles cached in Redis (TTL 5 min); DB is the fallback
 *   - Graceful degradation at every layer — returns null on any failure
 *     so callers can apply their own default logic
 *
 * Usage:
 *   import { routeToStream } from "./stream-router";
 *
 *   const result = await routeToStream("What are controlled substance FIFO policies?", ["pharmacy", "logistics"]);
 *   // → { streamId: "pharmacy", confidence: 0.67, scoredStreams: [...] }
 */

import Redis from "ioredis";
import { inArray } from "drizzle-orm";
import { getDb } from "./db";
import { valueStreams } from "../drizzle/schema";
import { createLogger } from "./_core/logger";

const log = createLogger("stream-router");

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScoredStream {
  streamId: string;
  /** Fraction of query terms matched in this stream's profile (0.0–1.0). */
  score: number;
}

export interface StreamRoutingResult {
  /** The stream we believe is most relevant for the query. */
  streamId: string;
  /** Normalised confidence: best stream's score / sum of all scores (0.0–1.0). */
  confidence: number;
  /** All candidate streams ranked by score, for debugging / telemetry. */
  scoredStreams: ScoredStream[];
}

interface StreamProfile {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
}

// ── Redis client ───────────────────────────────────────────────────────────────
// A dedicated cache client — separate from the pub/sub clients in websocket.ts.
// Gracefully disabled when REDIS_URL is not set.

const PROFILE_CACHE_PREFIX = "stream:profiles:";
const PROFILE_CACHE_TTL_S = 300; // 5 minutes — profiles rarely change

let _redis: Redis | null = null;
let _redisInitialised = false;

function getRedis(): Redis | null {
  if (_redisInitialised) return _redis;
  _redisInitialised = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    _redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
      commandTimeout: 1_500,
      // Don't queue commands while disconnected — fail fast so we fall through to DB.
      enableOfflineQueue: false,
    });
    _redis.connect().catch(err => {
      log.warn({ err: err?.message }, "StreamRouter: Redis connect failed — running without cache");
    });
    _redis.on("error", () => {
      // Suppress ioredis error events; connect failures are expected when Redis is optional.
    });
  } catch (err) {
    log.warn({ err }, "StreamRouter: Redis init failed");
    _redis = null;
  }

  return _redis;
}

// ── Profile loading ────────────────────────────────────────────────────────────

async function loadProfiles(streamIds: string[]): Promise<StreamProfile[]> {
  if (streamIds.length === 0) return [];

  const sortedIds = [...streamIds].sort();
  const cacheKey = `${PROFILE_CACHE_PREFIX}${sortedIds.join(",")}`;
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as StreamProfile[];
    } catch {
      // Redis miss/error — fall through to DB
    }
  }

  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: valueStreams.id,
      name: valueStreams.name,
      description: valueStreams.description,
      systemPrompt: valueStreams.systemPrompt,
    })
    .from(valueStreams)
    .where(inArray(valueStreams.id, sortedIds));

  const profiles: StreamProfile[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    systemPrompt: r.systemPrompt ?? null,
  }));

  if (redis && profiles.length > 0) {
    try {
      await redis.setex(cacheKey, PROFILE_CACHE_TTL_S, JSON.stringify(profiles));
    } catch {
      // Non-fatal: cache write failed
    }
  }

  return profiles;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Common English stop words filtered out before term matching.
 * Keeping this list tight: we only remove words with zero domain signal.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "used",
  "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "up", "about", "into", "through", "during",
  "what", "which", "who", "that", "this", "these", "those",
  "i", "we", "you", "they", "he", "she", "it", "me", "us",
  "my", "our", "your", "their",
  "how", "when", "where", "why",
  "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "no", "not", "only", "same", "so", "than", "too", "very",
  "just", "but", "if", "or", "because", "as", "until", "while", "and",
  "get", "make", "know", "think", "see", "come", "go",
]);

/** Tokenise text: lowercase, split on non-alphanumeric, drop stop words and short tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Score a stream profile against a set of query terms.
 *
 * Score = (matching query terms) / (total query terms)
 *
 * Using a Set for the profile vocabulary ensures O(1) lookup and avoids
 * inflating scores for streams with very long system prompts.
 */
export function scoreStream(queryTerms: string[], profile: StreamProfile): number {
  if (queryTerms.length === 0) return 0;

  const profileText = [
    profile.name,
    profile.description ?? "",
    profile.systemPrompt ?? "",
  ].join(" ");

  const profileTermSet = new Set(tokenize(profileText));
  if (profileTermSet.size === 0) return 0;

  let matches = 0;
  for (const term of queryTerms) {
    if (profileTermSet.has(term)) matches++;
  }

  return matches / queryTerms.length;
}

// ── Confidence threshold ───────────────────────────────────────────────────────

/**
 * Minimum raw score the best candidate must reach for us to trust the routing.
 * Below this the query is too generic ("what is the policy?") to meaningfully
 * distinguish streams. Callers should fall back to their own default.
 */
export const ROUTING_CONFIDENCE_THRESHOLD = 0.15;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Route a free-text query to the most relevant stream from a set of candidates.
 *
 * Returns null when:
 *   - Only one candidate stream (nothing to choose between)
 *   - No candidate scores above ROUTING_CONFIDENCE_THRESHOLD
 *   - DB or Redis is unavailable (safe degradation)
 *
 * Callers should apply their own fallback (first scope, global, etc.) on null.
 *
 * @param query             The raw user query string.
 * @param candidateStreamIds Stream IDs the router may choose from.
 */
export async function routeToStream(
  query: string,
  candidateStreamIds: string[],
): Promise<StreamRoutingResult | null> {
  if (candidateStreamIds.length <= 1) return null;

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return null;

  let profiles: StreamProfile[];
  try {
    profiles = await loadProfiles(candidateStreamIds);
  } catch (err) {
    log.warn({ err }, "StreamRouter: profile load failed, skipping routing");
    return null;
  }

  if (profiles.length === 0) return null;

  const scored: ScoredStream[] = profiles
    .map(p => ({ streamId: p.id, score: scoreStream(queryTerms, p) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (best.score < ROUTING_CONFIDENCE_THRESHOLD) {
    log.debug(
      { queryPrefix: query.slice(0, 80), bestScore: best.score },
      "StreamRouter: low confidence, not routing",
    );
    return null;
  }

  // Normalise confidence: best score as share of total signal
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  const confidence = totalScore > 0 ? best.score / totalScore : best.score;

  log.debug(
    {
      queryPrefix: query.slice(0, 80),
      chosen: best.streamId,
      confidence: confidence.toFixed(2),
      candidates: scored.map(s => `${s.streamId}:${s.score.toFixed(2)}`),
    },
    "StreamRouter: routed",
  );

  return {
    streamId: best.streamId,
    confidence: Math.round(confidence * 1000) / 1000,
    scoredStreams: scored,
  };
}
