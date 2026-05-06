/** Governance & Observability — platform-wide stats, traces, tool analytics. */

import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  conversations,
  messages,
  thoughtTraceSteps,
  toolExecutions,
  valueStreams,
} from "../drizzle/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import { createLogger } from "./_core/logger";
import { ANALYTICS_URL, serviceJson } from "./service-client";
import { ENV } from "./_core/env";

const log = createLogger("governance");

// ── LLM Gateway (same config as gemini.ts) ──────────────────────────────────
const LLM_GATEWAY_URL =
  process.env.LLM_GATEWAY_URL || "http://localhost:4000/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "sk-1234";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-pro";

// ── In-memory summary cache (5 min TTL) ─────────────────────────────────────
let summaryCache: { text: string; generatedAt: string } | null = null;
let summaryCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanSnippet(text: string | null | undefined, max = 200): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function humanizeToolName(name: string): string {
  return name
    .replace(/^(knowledge_|search_|hki_)/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function generateTraceTitle(params: {
  userQuery?: string | null;
  assistantContent?: string | null;
  toolNames: string[];
}): string {
  const user = cleanSnippet(params.userQuery);
  if (user) return user;

  const assistant = cleanSnippet(params.assistantContent, 140);
  if (assistant) return assistant;

  if (params.toolNames.length > 0) {
    return `Tool workflow: ${humanizeToolName(params.toolNames[0])}`;
  }

  return "Automated assistant response";
}

export const governanceRouter = router({
  // ── Executive Summary (LLM-powered) ───────────────────────────────────────

  /**
   * AI-generated executive summary for the Admin Dashboard banner.
   * Aggregates platform stats, feeds them to Gemini, caches result for 5 min.
   */
  executiveSummary: adminProcedure.query(async () => {
    // Return cached result if fresh
    if (summaryCache && Date.now() < summaryCacheExpiry) {
      return summaryCache;
    }

    const db = await getDb();

    // ── 1. Gather metrics ────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let metrics: Record<string, unknown> = {};

    if (db) {
      try {
        const [convRow] = await db
          .select({ total: count() })
          .from(conversations);

        const [msgRow] = await db
          .select({
            total: count(),
            avgConf: sql<number>`COALESCE(AVG(${messages.confidence}), 0)`,
          })
          .from(messages);

        const [toolRow] = await db
          .select({ total: count() })
          .from(toolExecutions);

        const [todayMsgRow] = await db
          .select({ total: count() })
          .from(messages)
          .where(gte(messages.createdAt, todayStart));

        const [todayToolRow] = await db
          .select({ total: count() })
          .from(toolExecutions)
          .where(gte(toolExecutions.startedAt, todayStart));

        const [grRow] = await db
          .select({ blocks: count() })
          .from(messages)
          .where(
            and(
              eq(messages.role, "assistant"),
              sql`JSON_VALID(${messages.guardrails}) AND JSON_EXTRACT(${messages.guardrails}, '$.passed') = false`
            )
          );

        metrics = {
          totalConversations: Number(convRow?.total ?? 0),
          totalMessages: Number(msgRow?.total ?? 0),
          avgConfidencePct: Math.round(Number(msgRow?.avgConf ?? 0)),
          totalToolCalls: Number(toolRow?.total ?? 0),
          guardrailBlocks: Number(grRow?.blocks ?? 0),
          messagesToday: Number(todayMsgRow?.total ?? 0),
          toolCallsToday: Number(todayToolRow?.total ?? 0),
        };
      } catch (err) {
        log.error({ err }, "executiveSummary DB error");
      }
    }

    // ── 2. Call Gemini ────────────────────────────────────────────────────
    const fallback = {
      text: "Platform metrics are being collected. Summary will be available shortly.",
      generatedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${LLM_GATEWAY_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          messages: [
            {
              role: "system",
              content: `You are an executive AI analyst for the Hermetic enterprise platform. Given the following platform metrics as JSON, generate a concise 2-sentence executive summary. Be specific with numbers. Mention any anomalies or trends worth noting. Keep the tone professional and data-driven. Output plain text only, no markdown, no bullet points.`,
            },
            {
              role: "user",
              content: `Platform metrics snapshot:\n${JSON.stringify(metrics, null, 2)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 256,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        log.error({ status: response.status }, "executiveSummary LLM error");
        return fallback;
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim() || fallback.text;

      const result = { text, generatedAt: new Date().toISOString() };

      // Cache the result
      summaryCache = result;
      summaryCacheExpiry = Date.now() + CACHE_TTL_MS;

      return result;
    } catch (err) {
      log.error({ err }, "executiveSummary LLM call failed");
      return fallback;
    }
  }),

  // ── Aggregate statistics ──────────────────────────────────────────────────

  /**
   * Platform-wide stats: total conversations, messages, avg confidence,
   * guardrail violation count, etc.
   */
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgConfidence: 0,
        guardrailBlocks: 0,
        totalToolCalls: 0,
        toolErrorRate: 0,
      };
    }

    try {
      const [convRow] = await db.select({ total: count() }).from(conversations);

      const [msgRow] = await db
        .select({
          total: count(),
          avgConf: sql<number>`COALESCE(AVG(${messages.confidence}), 0)`,
        })
        .from(messages)
        .where(eq(messages.role, "assistant"));

      // guardrail violations — guardrails column is JSON text: {passed: bool, ...}
      const [grRow] = await db
        .select({ blocks: count() })
        .from(messages)
        .where(
          and(
            eq(messages.role, "assistant"),
            sql`JSON_EXTRACT(${messages.guardrails}, '$.passed') = false`
          )
        );

      const [toolRow] = await db
        .select({
          total: count(),
          errors: sql<number>`SUM(CASE WHEN ${toolExecutions.status} = 'error' THEN 1 ELSE 0 END)`,
        })
        .from(toolExecutions);

      const totalTools = Number(toolRow?.total ?? 0);
      const toolErrors = Number(toolRow?.errors ?? 0);

      return {
        totalConversations: Number(convRow?.total ?? 0),
        totalMessages: Number(msgRow?.total ?? 0),
        avgConfidence: Math.round(Number(msgRow?.avgConf ?? 0)) / 100,
        guardrailBlocks: Number(grRow?.blocks ?? 0),
        totalToolCalls: totalTools,
        toolErrorRate: totalTools > 0 ? toolErrors / totalTools : 0,
      };
    } catch (err) {
      log.error({ err }, "stats DB error");
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgConfidence: 0,
        guardrailBlocks: 0,
        totalToolCalls: 0,
        toolErrorRate: 0,
      };
    }
  }),

  // ── Recent Traces ─────────────────────────────────────────────────────────

  /**
   * Recent assistant messages with their tool calls, confidence, guardrails.
   * Returns last N traces ordered by newest first.
   */
  recentTraces: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(20) })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const limit = input?.limit ?? 20;
        // Get recent assistant messages (these are the "traces")
        const recentMsgs = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            content: messages.content,
            confidence: messages.confidence,
            guardrails: messages.guardrails,
            toolCalls: messages.toolCalls,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.role, "assistant"))
          .orderBy(desc(messages.createdAt))
          .limit(limit);

        // For each message, find the preceding user message (the query)
        const traces = await Promise.all(
          recentMsgs.map(async msg => {
            // Get user query that preceded this response
            const [userMsg] = await db
              .select({ content: messages.content })
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, msg.conversationId),
                  eq(messages.role, "user"),
                  sql`${messages.createdAt} <= ${msg.createdAt}`
                )
              )
              .orderBy(desc(messages.createdAt))
              .limit(1);

            // Get tool executions for this message
            const tools = await db
              .select({
                toolName: toolExecutions.toolName,
                status: toolExecutions.status,
                startedAt: toolExecutions.startedAt,
                completedAt: toolExecutions.completedAt,
              })
              .from(toolExecutions)
              .where(eq(toolExecutions.messageId, msg.id));

            // Parse guardrails JSON
            let grParsed = { input: "pass", output: "pass" };
            try {
              if (msg.guardrails) {
                const gr = JSON.parse(msg.guardrails);
                grParsed = {
                  input: gr.input_violations?.length > 0 ? "flagged" : "pass",
                  output:
                    gr.output_violations?.length > 0
                      ? "flagged"
                      : gr.passed === false
                        ? "blocked"
                        : "pass",
                };
              }
            } catch {
              /* ignore parse errors */
            }

            // Compute latency from tool executions
            const latencyMs = tools.reduce((sum, t) => {
              if (t.startedAt && t.completedAt) {
                return sum + (t.completedAt.getTime() - t.startedAt.getTime());
              }
              return sum;
            }, 0);

            return {
              id: msg.id,
              query: generateTraceTitle({
                userQuery: userMsg?.content,
                assistantContent: msg.content,
                toolNames: tools.map(t => t.toolName),
              }),
              confidence: (msg.confidence ?? 0) / 100,
              latency: latencyMs / 1000, // seconds
              tools: tools.map(t => t.toolName),
              guardrails: grParsed,
              timestamp: msg.createdAt,
            };
          })
        );

        return traces;
      } catch (err) {
        log.error({ err }, "recentTraces DB error");
        return [];
      }
    }),

  // ── Tool Statistics ───────────────────────────────────────────────────────

  /**
   * Per-tool aggregated stats: call count, success rate, avg duration, errors.
   * Used by Memory Inspector's Procedural tab and Governance overview.
   */
  toolStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    try {
      const rows = await db
        .select({
          toolName: toolExecutions.toolName,
          total: count(),
          successes: sql<number>`SUM(CASE WHEN ${toolExecutions.status} = 'success' THEN 1 ELSE 0 END)`,
          errors: sql<number>`SUM(CASE WHEN ${toolExecutions.status} = 'error' THEN 1 ELSE 0 END)`,
          avgDurationMs: sql<number>`AVG(TIMESTAMPDIFF(MICROSECOND, ${toolExecutions.startedAt}, ${toolExecutions.completedAt})) / 1000`,
        })
        .from(toolExecutions)
        .groupBy(toolExecutions.toolName)
        .orderBy(sql`count(*) DESC`);

      return rows.map(r => ({
        toolName: r.toolName,
        totalCalls: Number(r.total),
        successRate:
          Number(r.total) > 0 ? Number(r.successes) / Number(r.total) : 0,
        errorCount: Number(r.errors),
        avgDurationMs: Math.round(Number(r.avgDurationMs ?? 0)),
      }));
    } catch (err) {
      log.error({ err }, "toolStats DB error");
      return [];
    }
  }),

  // ── Activity Feed (cross-user) ────────────────────────────────────────────

  /**
   * Recent platform activity: messages sent, tool executions, guardrail events.
   * Used by Admin Dashboard's Activity Feed panel.
   */
  activityFeed: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(50).default(10) })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const limit = input?.limit ?? 10;
        // Recent tool executions
        const recentTools = await db
          .select({
            id: toolExecutions.id,
            toolName: toolExecutions.toolName,
            status: toolExecutions.status,
            startedAt: toolExecutions.startedAt,
          })
          .from(toolExecutions)
          .orderBy(desc(toolExecutions.startedAt))
          .limit(limit);

        // Recent assistant messages (guardrail events)
        const recentAssistant = await db
          .select({
            id: messages.id,
            content: messages.content,
            guardrails: messages.guardrails,
            toolCalls: messages.toolCalls,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.role, "assistant"))
          .orderBy(desc(messages.createdAt))
          .limit(limit);

        // Merge into a unified activity feed
        type FeedItem = {
          id: string;
          type: "tool_call" | "guardrail" | "agent_response";
          action: string;
          detail: string;
          time: string;
        };

        const feed: FeedItem[] = [];

        for (const t of recentTools) {
          feed.push({
            id: `tool-${t.id}`,
            type: "tool_call",
            action: "Tool execution",
            detail: `${t.toolName} — ${t.status}`,
            time: t.startedAt?.toISOString() ?? new Date().toISOString(),
          });
        }

        for (const m of recentAssistant) {
          // Check for guardrail violations
          try {
            if (m.guardrails) {
              const gr = JSON.parse(m.guardrails);
              if (
                !gr.passed ||
                gr.input_violations?.length > 0 ||
                gr.output_violations?.length > 0
              ) {
                feed.push({
                  id: `gr-${m.id}`,
                  type: "guardrail",
                  action: "Guardrail triggered",
                  detail:
                    [
                      ...(gr.input_violations ?? []),
                      ...(gr.output_violations ?? []),
                    ]
                      .slice(0, 2)
                      .join(", ") || "Violation detected",
                  time: m.createdAt.toISOString(),
                });
                continue; // don't double-count
              }
            }
          } catch {
            /* ignore */
          }

          // Count tools from toolCalls JSON
          let toolCount = 0;
          try {
            if (m.toolCalls) toolCount = JSON.parse(m.toolCalls).length;
          } catch {
            /* ignore */
          }

          feed.push({
            id: `msg-${m.id}`,
            type: "agent_response",
            action: "Agent invocation",
            detail:
              toolCount > 0
                ? `${toolCount} tool${toolCount > 1 ? "s" : ""} called`
                : m.content.slice(0, 60),
            time: m.createdAt.toISOString(),
          });
        }

        // Sort by time DESC and take limit
        feed.sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
        return feed.slice(0, limit);
      } catch (err) {
        log.error({ err }, "activityFeed DB error");
        return [];
      }
    }),

  // ── Resource Metrics ──────────────────────────────────────────────────────

  /**
   * Aggregate resource usage: message counts, approximate token usage,
   * tool call counts, knowledge queries.
   * Used by Admin Dashboard's Resource Utilization panel.
   */
  resourceMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        tokensToday: 0,
        apiCalls: 0,
        knowledgeQueries: 0,
        guardrailChecks: 0,
      };
    }

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Approximate token count: SUM(LENGTH(content)) / 4 (rough 4-char-per-token heuristic)
      const [tokenRow] = await db
        .select({
          charSum: sql<number>`COALESCE(SUM(LENGTH(${messages.content})), 0)`,
          msgCount: count(),
        })
        .from(messages)
        .where(gte(messages.createdAt, todayStart));

      // Tool calls today
      const [toolRow] = await db
        .select({ total: count() })
        .from(toolExecutions)
        .where(gte(toolExecutions.startedAt, todayStart));

      // Knowledge queries = tool executions where toolName contains 'knowledge' or 'search'
      const [kqRow] = await db
        .select({ total: count() })
        .from(toolExecutions)
        .where(
          and(
            gte(toolExecutions.startedAt, todayStart),
            sql`${toolExecutions.toolName} LIKE '%search%' OR ${toolExecutions.toolName} LIKE '%knowledge%'`
          )
        );

      // Guardrail checks = all assistant messages today (each gets guardrail checked)
      const [grRow] = await db
        .select({ total: count() })
        .from(messages)
        .where(
          and(
            eq(messages.role, "assistant"),
            gte(messages.createdAt, todayStart)
          )
        );

      const approxTokens = Math.round(Number(tokenRow?.charSum ?? 0) / 4);

      return {
        tokensToday: approxTokens,
        apiCalls: Number(tokenRow?.msgCount ?? 0),
        knowledgeQueries: Number(kqRow?.total ?? 0),
        guardrailChecks: Number(grRow?.total ?? 0),
      };
    } catch (err) {
      log.error({ err }, "resourceMetrics DB error");
      return {
        tokensToday: 0,
        apiCalls: 0,
        knowledgeQueries: 0,
        guardrailChecks: 0,
      };
    }
  }),

  tokenUsage: adminProcedure
    .input(
      z
        .object({
          orgId: z.string().optional(),
          days: z.number().int().min(1).max(90).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const orgId = input?.orgId;
      const db = await getDb();
      if (!db) {
        return { streams: [], analytics: null };
      }

      const streams = await db
        .select({ id: valueStreams.id, name: valueStreams.name, icon: valueStreams.icon })
        .from(valueStreams);

      try {
        const params = new URLSearchParams({ days: String(days) });
        if (orgId) params.set("org_id", orgId);
        const analyticsData = await serviceJson(
          `${ANALYTICS_URL}/v1/events/usage?${params}`,
          ctx
        );
        return { streams, analytics: analyticsData, costPerMillion: ENV.costPerMillion };
      } catch (err) {
        log.warn({ err }, "Analytics service unavailable — returning DB-only data");
        return { streams, analytics: null, costPerMillion: ENV.costPerMillion };
      }
    }),
});
