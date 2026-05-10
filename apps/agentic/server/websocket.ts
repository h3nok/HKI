import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import type { Request as ExpressRequest } from "express";
import { nanoid } from "nanoid";
import Redis from "ioredis";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { conversations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "./_core/logger";
import {
  canAccessChatScope,
  getAllowedChatScopes,
} from "./_core/chat-scope-auth";

const log = createLogger("websocket");

// ── Local connections (this pod only) ────────────────────────────────────
interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  conversationId?: string;
  isAlive?: boolean;
  connectionType?: "trace" | "jobs";
}

const connections = new Map<string, Set<AuthenticatedWebSocket>>();

// ── Job status connections (keyed by userId) ──────────────────────────────
// Separate from trace connections — scoped to the user, not to a conversation.
const jobConnections = new Map<number, Set<AuthenticatedWebSocket>>();
const MAX_JOB_CONNECTIONS_PER_USER = 5;

// ── Heartbeat: detect and clean up dead connections ──────────────────────
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    connections.forEach((conns, conversationId) => {
      conns.forEach(ws => {
        if (ws.isAlive === false) {
          // Didn't respond to last ping — terminate
          conns.delete(ws);
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
      // Clean up empty sets
      if (conns.size === 0) {
        connections.delete(conversationId);
        if (redisSub && redisReady) {
          redisSub
            .unsubscribe(`${CHANNEL_PREFIX}${conversationId}`)
            .catch(() => {});
        }
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

// ── Rate limiting: max connections per conversation ──────────────────────
const MAX_CONNECTIONS_PER_CONVERSATION = 10;

// ── Redis Pub/Sub for cross-pod broadcast ────────────────────────────────
// Two clients needed: one for publishing, one for subscribing.
// A Redis client in subscribe mode cannot issue other commands.
const CHANNEL_PREFIX = "ws:trace:";
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;
let redisReady = false;

function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    log.info("No REDIS_URL — broadcast is local-only (single pod)");
    return;
  }

  try {
    redisPub = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5_000,
      commandTimeout: 2_000,
    });
    redisSub = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5_000,
      commandTimeout: 2_000,
    });

    redisPub.connect().catch(err => {
      log.warn({ err: err.message }, "Redis pub connect failed");
    });
    redisSub.connect().catch(err => {
      log.warn({ err: err.message }, "Redis sub connect failed");
    });

    redisSub.on("ready", () => {
      redisReady = true;
      log.info("Redis Pub/Sub connected — cross-pod broadcast enabled");
    });

    redisSub.on("error", err => {
      if (redisReady) log.warn({ err: err.message }, "Redis sub error");
    });

    redisPub.on("error", err => {
      if (redisReady) log.warn({ err: err.message }, "Redis pub error");
    });

    // Handle incoming messages from other pods
    redisSub.on("messageBuffer", (channelBuf, messageBuf) => {
      const channel = channelBuf.toString();
      const conversationId = channel.slice(CHANNEL_PREFIX.length);
      const conns = connections.get(conversationId);
      if (!conns || conns.size === 0) return;

      const payload = messageBuf.toString();
      conns.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      });
    });
  } catch (err) {
    log.warn({ err }, "Redis init failed — local-only broadcast");
    redisPub = null;
    redisSub = null;
  }
}

export interface ThoughtTraceEvent {
  type:
    | "thinking"
    | "planning"
    | "executing"
    | "reflecting"
    | "routing"
    | "tool_call"
    | "tool_result"
    | "guardrail"
    | "handoff"
    | "memory_recall"
    | "memory_store"
    | "hki_envelope"
    | "knowledge_retrieval"
    | "cache_hit"
    | "final_response_chunk"
    | "final_response"
    | "suggested_follow_ups";
  step: number;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export function setupWebSocket(server: any) {
  // Initialize Redis Pub/Sub for multi-pod support
  initRedis();

  // Start heartbeat monitor
  startHeartbeat();

  // Create WS server without attaching it automatically to the HTTP server
  // This allows us to manually handle the upgrade event and avoid conflicts with Vite
  const wss = new WebSocketServer({ noServer: true });

  // Handle the upgrade event manually — authenticate BEFORE upgrading
  server.on(
    "upgrade",
    async (request: IncomingMessage, socket: any, head: any) => {
      const { pathname, searchParams } = new URL(
        request.url!,
        `http://${request.headers.host}`
      );

      const isJobsChannel = pathname === "/ws/jobs";
      if (pathname !== "/ws" && !isJobsChannel) {
        // Not /ws or /ws/jobs — let other listeners (like Vite HMR) handle it
        return;
      }

      const conversationId = isJobsChannel
        ? null
        : searchParams.get("conversationId");
      if (!isJobsChannel && !conversationId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      // ── Authenticate the WebSocket upgrade request ──
      // Parse session cookie from the upgrade request headers
      let userId: number | undefined;
      let authenticatedUser:
        | { id: number; role?: string | null; valueStreams?: string | null }
        | undefined;
      try {
        const cookieHeader = request.headers.cookie;
        if (!cookieHeader) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        const cookies = parseCookieHeader(cookieHeader || "");
        const sessionCookie = cookies[COOKIE_NAME];
        const session = await sdk.verifySession(sessionCookie);
        if (!session) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        if (ENV.devBypassEnabled) {
          const user = await sdk.authenticateRequest(
            request as unknown as ExpressRequest
          );
          userId = user.id;
          authenticatedUser = user;
        } else {
          // Look up user to get userId for ownership check
          const { getUserByOpenId } = await import("./db");
          const user = await getUserByOpenId(session.openId);
          if (!user) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
          userId = user.id;
          authenticatedUser = user;
        }
      } catch (err) {
        log.warn({ err }, "Auth failed during upgrade");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // ── Authorize: verify user owns the conversation (trace channel only) ──
      if (!isJobsChannel && !ENV.devBypassEnabled) {
        try {
          const db = await getDb();
          if (db) {
            const [conv] = await db
              .select({
                userId: conversations.userId,
                scope: conversations.scope,
              })
              .from(conversations)
              .where(eq(conversations.id, conversationId!))
              .limit(1);
            // If conversation exists, user must own it.
            // If it doesn't exist yet (will be created), allow the connection.
            if (conv) {
              const allowedScopes = await getAllowedChatScopes(
                authenticatedUser || {
                  id: userId!,
                  role: null,
                  valueStreams: null,
                },
                db,
                conv.scope
              );
              if (
                conv.userId !== userId ||
                !canAccessChatScope(conv.scope, allowedScopes)
              ) {
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.destroy();
                return;
              }
            }
          } else {
            socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
            socket.destroy();
            return;
          }
        } catch (err) {
          log.warn({ err }, "Ownership/scope check failed");
          socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
          socket.destroy();
          return;
        }
      }

      // ── Upgrade to WebSocket ──
      wss.handleUpgrade(request, socket, head, (ws: AuthenticatedWebSocket) => {
        ws.userId = userId;
        ws.conversationId = conversationId ?? undefined;
        ws.connectionType = isJobsChannel ? "jobs" : "trace";
        wss.emit("connection", ws, request);
      });
    }
  );

  wss.on("connection", (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    // ── Job status channel ──────────────────────────────────────────────────
    if (ws.connectionType === "jobs") {
      const uid = ws.userId!;
      const existingJobConns = jobConnections.get(uid);
      if (
        existingJobConns &&
        existingJobConns.size >= MAX_JOB_CONNECTIONS_PER_USER
      ) {
        ws.close(1013, "Too many job connections for this user");
        return;
      }
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });
      if (!jobConnections.has(uid)) jobConnections.set(uid, new Set());
      jobConnections.get(uid)!.add(ws);
      ws.on("close", () => {
        const jConns = jobConnections.get(uid);
        if (jConns) {
          jConns.delete(ws);
          if (jConns.size === 0) jobConnections.delete(uid);
        }
      });
      ws.on("error", (error: Error) => {
        log.warn({ err: error.message, userId: uid }, "Job WS error");
      });
      ws.send(JSON.stringify({ type: "connected", channel: "jobs" }));
      return;
    }

    // ── Thought-trace channel ───────────────────────────────────────────────
    const conversationId = ws.conversationId!;

    // Rate limit: max connections per conversation
    const existingConns = connections.get(conversationId);
    if (
      existingConns &&
      existingConns.size >= MAX_CONNECTIONS_PER_CONVERSATION
    ) {
      ws.close(1013, "Too many connections for this conversation");
      return;
    }

    // Mark alive for heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Add connection to the conversation's set
    if (!connections.has(conversationId)) {
      connections.set(conversationId, new Set());
    }
    connections.get(conversationId)!.add(ws);

    // Subscribe to the Redis channel for this conversation (if first local listener)
    if (connections.get(conversationId)!.size === 1 && redisSub && redisReady) {
      redisSub.subscribe(`${CHANNEL_PREFIX}${conversationId}`).catch(() => {});
    }

    // Handle incoming client messages (bidirectional — needed for HITL intervention responses)
    ws.on("message", (raw: Buffer | string) => {
      try {
        const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
        handleClientMessage(conversationId, ws, data);
      } catch {
        // Malformed JSON — ignore
      }
    });

    ws.on("close", () => {
      const conns = connections.get(conversationId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
          connections.delete(conversationId);
          // Unsubscribe when no local listeners remain
          if (redisSub && redisReady) {
            redisSub
              .unsubscribe(`${CHANNEL_PREFIX}${conversationId}`)
              .catch(() => {});
          }
        }
      }
    });

    ws.on("error", (error: Error) => {
      log.error(
        { err: error.message, conversationId },
        "WebSocket connection error"
      );
    });

    // Send initial connection success message
    ws.send(JSON.stringify({ type: "connected", conversationId }));
  });

  return wss;
}

// ── Client → Server message handling (HITL interventions, etc.) ───────────

type InterventionResponsePayload = {
  type: "intervention_response";
  planId: string;
  action: string;
  modifiedArguments?: Record<string, unknown>;
  userNote?: string;
};

function handleClientMessage(
  _conversationId: string,
  ws: AuthenticatedWebSocket,
  data: Record<string, unknown>
) {
  const type = data.type as string;

  if (type === "intervention_response") {
    const payload = data as unknown as InterventionResponsePayload;
    ws.send(
      JSON.stringify({
        type: "error",
        planId: payload.planId,
        action: payload.action,
        message:
          "Intervention responses must use chat.respondToIntervention so approval grants are scoped, persisted, and audited.",
      })
    );
    return;
  }

  if (type === "ping") {
    ws.send(
      JSON.stringify({ type: "pong", timestamp: new Date().toISOString() })
    );
    return;
  }

  // Unknown message type — ignore silently
}

// ── Internal: send to local WebSocket connections only ───────────────────
function sendToLocal(conversationId: string, message: string) {
  const conns = connections.get(conversationId);
  if (!conns || conns.size === 0) return;

  conns.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// ── Internal: publish via Redis (all pods) or fall back to local ─────────
function publish(conversationId: string, message: string) {
  if (redisPub && redisReady) {
    // Redis will deliver to all pods (including this one via the subscriber)
    redisPub
      .publish(`${CHANNEL_PREFIX}${conversationId}`, message)
      .catch(() => {
        // Redis failed — fall back to local delivery
        sendToLocal(conversationId, message);
      });
  } else {
    // No Redis — local-only
    sendToLocal(conversationId, message);
  }
}

// Broadcast thought trace event to all clients listening to a conversation
export function broadcastThoughtTrace(
  conversationId: string,
  event: ThoughtTraceEvent
) {
  const message = JSON.stringify({
    ...event,
    eventType: "thought_trace",
    timestamp: event.timestamp.toISOString(),
  });

  publish(conversationId, message);
}

// Send final response event
export function broadcastFinalResponse(
  conversationId: string,
  messageId: string,
  content: string,
  confidence: number,
  suggestedFollowUps?: string[]
) {
  const message = JSON.stringify({
    type: "final_response",
    messageId,
    content,
    confidence,
    suggestedFollowUps: suggestedFollowUps ?? [],
    timestamp: new Date().toISOString(),
  });

  publish(conversationId, message);
}

// ── Job status broadcast (push to all WS clients for this user) ───────────
// Called by the server-side job watcher after each poll that finds a status
// change. Sends directly to local sockets — no Redis needed since the watcher
// runs on the same pod that accepted the ingest request.
export function broadcastJobUpdate(
  userId: number,
  job: Record<string, unknown>
) {
  const conns = jobConnections.get(userId);
  if (!conns || conns.size === 0) return;
  const message = JSON.stringify({
    type: "job_update",
    job,
    timestamp: new Date().toISOString(),
  });
  conns.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
