/**
 * Gemini AI Helper — server-side LLM calls for admin features.
 *
 * Routes through the LiteLLM proxy (same as orchestrator) so we get:
 * - Model routing (Gemini Flash for fast tasks, Pro for complex)
 * - Rate limiting / quota management
 * - No API keys on the client
 *
 * Key resolution: stream-scoped llmApiKey → global LLM_API_KEY fallback.
 * If neither exists, routes degrade to deterministic fallbacks so KB
 * self-service still works before model credentials are configured.
 *
 * Used by: StreamsPage "Generate with Gemini", Knowledge "Plan with Gemini",
 *          Gaps "Analyze with Gemini"
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Role } from "@shared/access-control";
import type { FeatureFlagKey } from "@shared/feature-flags";
import {
  adminProcedure,
  knowledgeReadProcedure,
  managerProcedure,
  router,
} from "./_core/trpc";
import { getDb } from "./db";
import { knowledgeGapSnapshots, valueStreams } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createLogger } from "./_core/logger";
import {
  isFeatureEnabledForUser,
  loadFeatureFlagOverrides,
} from "./_core/feature-flags";
import {
  buildSnakeBody,
  ORCHESTRATOR_URL,
  serviceJsonTyped,
} from "./service-client";
import {
  buildContextAwareQuestions,
  filterHighQualityQuestions,
} from "./_core/question-suggestions";
import {
  requireAuthorizedStreamId,
  resolveAuthorizedStreamId,
} from "./_core/value-stream-access";

const log = createLogger("gemini");

const LLM_GATEWAY_URL =
  process.env.LLM_GATEWAY_URL || "http://localhost:4000/v1";
const LLM_API_KEY =
  process.env.LLM_API_KEY ||
  process.env.LITELLM_API_KEY ||
  process.env.LITELLM_KEY ||
  "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-pro";

type ServiceAuthContext = {
  user: any;
  scopes?: string[];
  isGlobalScope?: boolean;
};

function resolveGeminiKnowledgeStreamId(
  ctx: Parameters<typeof requireAuthorizedStreamId>[0],
  requestedStreamId: string | undefined,
  missingSelectionMessage: string
): string {
  return requireAuthorizedStreamId(ctx, requestedStreamId, {
    allowGlobalSelection: false,
    missingSelectionMessage,
  });
}

async function requireGeminiFeature(options: {
  ctx: {
    user: { role: Role; valueStreams: string | null; orgId?: string | null };
  };
  key: FeatureFlagKey;
  message: string;
}): Promise<void> {
  const db = await getDb();
  const rawOverrides =
    db && typeof db.select === "function"
      ? await loadFeatureFlagOverrides(
          db,
          options.ctx.user.orgId ?? "default"
        ).catch(() => [])
      : [];
  const overrides = Array.isArray(rawOverrides) ? rawOverrides : [];

  if (
    isFeatureEnabledForUser({
      user: options.ctx.user,
      key: options.key,
      overrides,
    })
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: options.message,
  });
}

// ── Stream-aware API key resolution ──────────────────────────────────────────

function isLocalGatewayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  }
}

const USING_LOCAL_LITELLM = isLocalGatewayUrl(LLM_GATEWAY_URL);

function normalizeApiKey(raw?: string | null): string | null {
  const key = raw?.trim();
  if (!key) return null;
  // Ignore obvious placeholders, but keep the local LiteLLM master key.
  if (/^replace[_-]?with/i.test(key) || /^your[_-]?api[_-]?key/i.test(key)) {
    return null;
  }
  if (key === "sk-1234" && !USING_LOCAL_LITELLM) return null;
  return key;
}

function shouldUseDevelopmentFallback(err: unknown): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const message = String(
    err instanceof Error ? err.message : err
  ).toLowerCase();
  return (
    message.includes("vpc service controls") ||
    message.includes("security_policy_violated") ||
    message.includes("organization's policy") ||
    message.includes("vertex ai is blocked") ||
    message.includes("no connected db") ||
    message.includes(
      "gemini request failed. check litellm proxy configuration."
    )
  );
}

function shouldUseProductionOrchestratorFallback(err: unknown): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (!process.env.ORCHESTRATOR_URL) return false;
  if (process.env.ENABLE_GEMINI_ORCHESTRATOR_FALLBACK === "false") {
    return false;
  }
  const message = String(
    err instanceof Error ? err.message : err
  ).toLowerCase();
  return (
    message.includes("llm gateway transient failure") ||
    message.includes("llm gateway request failed or timed out") ||
    message.includes(
      "llm gateway authentication failed (iap/identity token)"
    ) ||
    message.includes("unable to parse jwt") ||
    message.includes("identity token")
  );
}

interface OrchestratorCompletionResponse {
  content: string;
  model: string;
  finishReason?: string | null;
  usage?: Record<string, number> | null;
  mode: string;
  fallbackUsed: boolean;
}

async function callGeminiViaOrchestrator(
  ctx: ServiceAuthContext,
  route: string,
  messages: GeminiMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    apiKey?: string | null;
  } = {}
): Promise<string> {
  const response = await serviceJsonTyped<OrchestratorCompletionResponse>(
    `${ORCHESTRATOR_URL}/v1/llm/complete`,
    ctx,
    {
      method: "POST",
      body: buildSnakeBody({
        messages,
        model: GEMINI_MODEL,
        temperature: opts.temperature ?? 0.4,
        maxTokens: opts.maxTokens ?? 2048,
        apiKey: opts.apiKey,
        fallbackToVertexDirect: true,
      }),
    }
  );

  log.warn(
    {
      route,
      mode: response.mode,
      fallbackUsed: response.fallbackUsed,
      orchestratorUrl: ORCHESTRATOR_URL,
    },
    "Gemini route completed via orchestrator fallback"
  );

  return response.content ?? "";
}

async function tryCallGemini(
  route: string,
  ctx: ServiceAuthContext,
  messages: GeminiMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    apiKey?: string | null;
  } = {}
): Promise<string | null> {
  if (!normalizeApiKey(opts.apiKey ?? LLM_API_KEY)) {
    log.info(
      { route, gatewayUrl: LLM_GATEWAY_URL },
      "Skipping Gemini route because no stream or platform LLM key is configured"
    );
    return null;
  }

  try {
    return await callGemini(messages, opts);
  } catch (err) {
    if (shouldUseProductionOrchestratorFallback(err)) {
      try {
        return await callGeminiViaOrchestrator(ctx, route, messages, opts);
      } catch (fallbackErr) {
        log.error(
          { route, err: fallbackErr, orchestratorUrl: ORCHESTRATOR_URL },
          "Orchestrator Gemini fallback failed"
        );
      }
    }
    if (shouldUseDevelopmentFallback(err)) {
      log.warn(
        { route, err, gatewayUrl: LLM_GATEWAY_URL },
        "Using deterministic development fallback for Gemini route"
      );
      return null;
    }
    throw err;
  }
}

const STOPWORDS = new Set([
  "about",
  "after",
  "before",
  "their",
  "there",
  "these",
  "those",
  "which",
  "where",
  "when",
  "what",
  "with",
  "from",
  "into",
  "than",
  "then",
  "they",
  "have",
  "does",
  "this",
  "that",
  "your",
  "will",
  "would",
  "could",
  "should",
  "must",
  "more",
  "need",
  "document",
  "documents",
  "knowledge",
  "stream",
  "agent",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(value: string, limit: number = 6): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter(word => word.length >= 4 && !STOPWORDS.has(word))
    )
  ).slice(0, limit);
}

function coverageLabelFromScore(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 40) return "Moderate";
  return "Low";
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function buildFallbackPersona(params: {
  streamName: string;
  domainHint: string;
}): string {
  return `You are the ${params.streamName} enterprise assistant for HKI. You help employees find accurate answers, explain policies and procedures, summarize internal knowledge, and recommend next steps within the ${params.domainHint} domain.

Use a concise, practical tone. Prefer grounded answers based on available knowledge and clearly say when required information is missing. Ask clarifying questions when a request is ambiguous, high risk, or missing operational context. Cite concrete document names, systems, or process areas whenever possible.

Do not invent policy, compliance guidance, or operational facts. Escalate when the request involves legal interpretation, HR sensitivity, pricing commitments, safety incidents, or actions that require manager approval. If you are uncertain, say what is unknown and what source or team should verify it.

Prioritize employee usefulness: provide direct answers first, then short steps, caveats, and follow-up checks. Keep outputs structured and easy to scan.`;
}

function buildFallbackIngestionPlan(input: {
  streamName: string;
  streamDescription?: string;
  existingDocCount?: number;
  existingTopics?: string[];
}) {
  const existingTopics = input.existingTopics ?? [];
  return {
    summary: `Start with high-trust operational content for ${input.streamName}, then expand into FAQs, exception handling, and reporting content once core procedures are covered.`,
    categories: [
      {
        name: "Policies and SOPs",
        description:
          "Canonical operating procedures, policies, and decision rules.",
        suggestedSources: [
          "Department SOP library",
          "Policy wiki or SharePoint",
          "Manager playbooks",
        ],
        priority: "high",
        estimatedDocs: Math.max(12, input.existingDocCount ?? 0),
      },
      {
        name: "Operational FAQs",
        description:
          "Repeat employee questions, escalation guidance, and edge cases.",
        suggestedSources: [
          "Support tickets",
          "Slack or Teams FAQ posts",
          "Training decks",
        ],
        priority: "high",
        estimatedDocs: 15,
      },
      {
        name: "Systems and Reporting",
        description:
          "Dashboards, metric definitions, and tool workflows tied to day-to-day execution.",
        suggestedSources: [
          "BI dashboard documentation",
          "Reporting runbooks",
          "System job aids",
        ],
        priority: "medium",
        estimatedDocs: 10,
      },
      ...(existingTopics.length > 0
        ? [
            {
              name: "Topic-Specific Coverage",
              description: `Deepen coverage for existing themes: ${existingTopics.join(", ")}.`,
              suggestedSources: [
                "Subject matter expert notes",
                "Process-specific manuals",
              ],
              priority: "medium",
              estimatedDocs: Math.max(8, existingTopics.length * 3),
            },
          ]
        : []),
    ],
    quickWins: [
      "Upload the top 10 SOPs most frequently referenced by managers.",
      "Add one FAQ document that covers common exceptions and escalation paths.",
      "Index one recent training deck to seed terminology and process language.",
    ],
    gaps: [
      input.streamDescription
        ? `Validate coverage against the stream description: ${input.streamDescription}.`
        : "Confirm which workflows are most business-critical before bulk ingestion.",
      "Capture unwritten tribal knowledge from subject matter experts.",
    ],
  };
}

function buildFallbackGapAnalysis(input: {
  streamName: string;
  streamDescription?: string;
  documents?: {
    title: string;
    department?: string;
    documentType?: string;
    chunkCount?: number;
    createdAt?: string;
  }[];
  recentQueries?: string[];
}) {
  const documents = input.documents ?? [];
  const recentQueries = input.recentQueries ?? [];
  const corpus = normalizeText(
    documents
      .map(
        doc => `${doc.title} ${doc.department ?? ""} ${doc.documentType ?? ""}`
      )
      .join(" ")
  );
  const uniqueDepartments = new Set(
    documents.map(doc => doc.department?.trim()).filter(Boolean)
  );
  const uniqueTypes = new Set(
    documents.map(doc => doc.documentType?.trim()).filter(Boolean)
  );
  const totalChunks = documents.reduce(
    (sum, doc) => sum + (doc.chunkCount ?? 0),
    0
  );
  let matchedQueries = 0;

  const gaps = recentQueries
    .map(query => {
      const keywords = extractKeywords(query, 4);
      const matched =
        keywords.length === 0 ||
        keywords.some(keyword => corpus.includes(keyword));
      if (matched) {
        matchedQueries += 1;
        return null;
      }
      return {
        topic: query,
        severity: documents.length === 0 ? "high" : "medium",
        suggestion:
          "Add a document or FAQ that directly answers this recurring question.",
      };
    })
    .filter(Boolean)
    .slice(0, 5) as { topic: string; severity: string; suggestion: string }[];

  if (documents.length === 0) {
    gaps.unshift({
      topic: `${input.streamName} core operating guidance`,
      severity: "high",
      suggestion:
        "Index foundational SOPs, policy documents, and playbooks first.",
    });
  }

  if (uniqueDepartments.size <= 1 && documents.length > 3) {
    gaps.push({
      topic: "Cross-functional coverage",
      severity: "medium",
      suggestion:
        "Add documents from adjacent teams to reduce single-department blind spots.",
    });
  }

  const staleContent = documents
    .filter(doc => {
      if (!doc.createdAt) return false;
      const ageMs = Date.now() - new Date(doc.createdAt).getTime();
      return Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 365;
    })
    .slice(0, 5)
    .map(doc => doc.title);

  const scoreBase =
    (documents.length > 0 ? 20 : 0) +
    Math.min(
      20,
      totalChunks > 0 ? Math.round(Math.log2(totalChunks + 1) * 4) : 0
    ) +
    Math.min(15, uniqueDepartments.size * 5) +
    Math.min(15, uniqueTypes.size * 5) +
    (recentQueries.length > 0
      ? Math.round((matchedQueries / recentQueries.length) * 20)
      : 10) +
    (gaps.length === 0 && documents.length > 0 ? 10 : 0);
  const coverageScore = Math.max(0, Math.min(100, scoreBase));

  const strengths = [
    documents.length > 0
      ? `${documents.length} documents are already indexed for ${input.streamName}.`
      : null,
    totalChunks > 0
      ? `${totalChunks} chunks are available for retrieval.`
      : null,
    uniqueDepartments.size > 1
      ? `Coverage spans ${uniqueDepartments.size} departments.`
      : null,
    uniqueTypes.size > 1 ? `Multiple document types are represented.` : null,
    recentQueries.length > 0 && matchedQueries > 0
      ? `${matchedQueries} of ${recentQueries.length} recent questions appear aligned with indexed content.`
      : null,
  ].filter(Boolean) as string[];

  const recommendations = [
    gaps[0]
      ? `Close the top gap: ${gaps[0].topic}.`
      : "Continue expanding coverage in adjacent operational scenarios.",
    staleContent.length > 0
      ? "Review older documents for accuracy and superseded guidance."
      : "Add recent revisions or playbooks to keep answers current.",
    recentQueries.length > 0
      ? "Use recent employee questions to prioritize the next content uploads."
      : "Collect sample employee questions to validate real retrieval needs.",
  ];

  const coverageLabel = coverageLabelFromScore(coverageScore);
  const summary =
    documents.length === 0
      ? `${input.streamName} has no indexed content yet, so coverage is currently low. Start with core SOPs, policies, and exception-handling guidance before expanding into FAQs and reporting.`
      : `${input.streamName} has a usable local content baseline, but the current snapshot still shows ${gaps.length} notable gap${gaps.length === 1 ? "" : "s"}. Coverage improves fastest by aligning new uploads to unresolved employee questions and stale content.`;

  return {
    coverageScore,
    coverageLabel,
    summary,
    strengths,
    gaps,
    staleContent,
    recommendations,
  };
}

function buildFallbackPageAssist(input: {
  page: string;
  question: string;
  pageData?: Record<string, unknown>;
}): string {
  const pageKeys = Object.keys(input.pageData ?? {});
  const countHints = pageKeys
    .map(key => {
      const value = input.pageData?.[key];
      if (Array.isArray(value)) return `\`${key}\`: ${value.length}`;
      if (typeof value === "number") return `\`${key}\`: ${value}`;
      return null;
    })
    .filter(Boolean)
    .slice(0, 4) as string[];

  const steps = [
    `Use the current **${input.page}** context before making changes.`,
    pageKeys.length > 0
      ? `Focus on the fields currently present in state: ${pageKeys
          .slice(0, 6)
          .map(key => `\`${key}\``)
          .join(", ")}.`
      : "Reload the page section that contains the data you want to inspect.",
    input.question.toLowerCase().includes("next")
      ? "Prioritize missing content, validation gaps, and stale documents before broad expansion."
      : "If the page data does not answer the question directly, inspect the underlying collection, documents, or latest pipeline status.",
  ];

  return [
    "Local assistant fallback is active because the local LiteLLM path cannot reach Vertex AI from this environment.",
    countHints.length > 0
      ? `I can still use the live page context I received: ${countHints.join(", ")}.`
      : "I did not receive enough structured page metrics to answer this precisely.",
    steps.map(step => `- ${step}`).join("\n"),
  ].join("\n\n");
}

function buildFallbackSnapshotDiff(params: {
  currentGaps: { topic: string; severity: string; suggestion: string }[];
  previousGaps: { topic: string; severity: string; suggestion: string }[];
  currentStrengths: string[];
  previousStrengths: string[];
  currentScore: number;
  previousScore: number;
}) {
  const currentMap = new Map(
    params.currentGaps.map(gap => [normalizeText(gap.topic), gap] as const)
  );
  const previousMap = new Map(
    params.previousGaps.map(gap => [normalizeText(gap.topic), gap] as const)
  );

  const resolved = params.previousGaps
    .filter(gap => !currentMap.has(normalizeText(gap.topic)))
    .map(gap => ({
      topic: gap.topic,
      previousSeverity: gap.severity,
    }));

  const newGaps = params.currentGaps
    .filter(gap => !previousMap.has(normalizeText(gap.topic)))
    .map(gap => ({
      topic: gap.topic,
      severity: gap.severity,
    }));

  const persisted = params.currentGaps
    .filter(gap => previousMap.has(normalizeText(gap.topic)))
    .map(gap => {
      const previous = previousMap.get(normalizeText(gap.topic))!;
      const currentRank = severityRank(gap.severity);
      const previousRank = severityRank(previous.severity);
      return {
        topic: gap.topic,
        severity: gap.severity,
        severityChange:
          currentRank > previousRank
            ? "escalated"
            : currentRank < previousRank
              ? "deescalated"
              : "unchanged",
      };
    });

  const currentStrengthSet = new Set(
    params.currentStrengths.map(normalizeText)
  );
  const previousStrengthSet = new Set(
    params.previousStrengths.map(normalizeText)
  );
  const newStrengths = params.currentStrengths.filter(
    strength => !previousStrengthSet.has(normalizeText(strength))
  );
  const lostStrengths = params.previousStrengths.filter(
    strength => !currentStrengthSet.has(normalizeText(strength))
  );
  const scoreDelta = params.currentScore - params.previousScore;

  return {
    resolved,
    newGaps,
    persisted,
    newStrengths,
    lostStrengths,
    summary:
      scoreDelta > 0
        ? `Coverage improved by ${scoreDelta} points. ${resolved.length} gap${resolved.length === 1 ? "" : "s"} were resolved and ${newGaps.length} new gap${newGaps.length === 1 ? "" : "s"} appeared.`
        : scoreDelta < 0
          ? `Coverage dropped by ${Math.abs(scoreDelta)} points. ${newGaps.length} new gap${newGaps.length === 1 ? "" : "s"} appeared and ${persisted.length} persisted from the prior run.`
          : `Coverage score is unchanged. ${persisted.length} gap${persisted.length === 1 ? "" : "s"} persisted between runs.`,
  };
}

function buildFallbackQuestions(input: {
  title: string;
  content: string;
  count?: number;
}): string[] {
  return buildContextAwareQuestions({
    title: input.title,
    content: input.content,
    count: input.count,
  });
}

async function resolveApiKey(
  valueStreamId?: string | null
): Promise<string | null> {
  if (valueStreamId) {
    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select({ llmApiKey: valueStreams.llmApiKey })
          .from(valueStreams)
          .where(eq(valueStreams.id, valueStreamId))
          .limit(1);
        const streamKey = normalizeApiKey(rows[0]?.llmApiKey);
        if (streamKey) {
          log.info({ valueStreamId }, "Using stream-scoped LLM key");
          return streamKey;
        }
      }
    } catch (e) {
      log.warn(
        { valueStreamId, err: e },
        "Failed to resolve stream LLM key, falling back to global"
      );
    }
  }

  const globalKey = normalizeApiKey(LLM_API_KEY);
  if (globalKey) return globalKey;

  log.info(
    { valueStreamId },
    "No stream or platform LLM key configured; Gemini routes will use deterministic fallbacks"
  );
  return null;
}

// ── Core LLM call ───────────────────────────────────────────────────────────

interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callGemini(
  messages: GeminiMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    apiKey?: string | null;
  } = {}
): Promise<string> {
  const effectiveKey = opts.apiKey ?? LLM_API_KEY;
  let response: Response;

  try {
    response = await fetch(`${LLM_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 2048,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    log.error(
      { err, gatewayUrl: LLM_GATEWAY_URL },
      "LLM gateway request failed before receiving a response"
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "LLM gateway request failed or timed out.",
    });
  }

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    const errLower = String(err || "").toLowerCase();
    const isGatewayAuthError =
      response.status === 401 || response.status === 403;
    const isRetryableGatewayError =
      response.status === 429 || response.status >= 500;
    const isVpcPolicyError =
      errLower.includes("vpcservicecontrols") ||
      errLower.includes("vpc service controls") ||
      errLower.includes("security_policy_violated") ||
      errLower.includes("organization's policy");
    const isLocalConfigError = errLower.includes("no connected db");
    const isIapAuthError =
      isGatewayAuthError &&
      (errLower.includes("iap") ||
        errLower.includes("unable to parse jwt") ||
        errLower.includes("identity token"));

    log.error(
      { status: response.status, err, gatewayUrl: LLM_GATEWAY_URL },
      "LLM gateway error"
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: isIapAuthError
        ? "LLM gateway authentication failed (IAP/identity token). API key alone is not sufficient for this gateway URL."
        : isVpcPolicyError
          ? "Local LiteLLM reached Vertex AI, but the request was blocked by VPC Service Controls."
          : isLocalConfigError
            ? "LiteLLM proxy is running but not fully initialized (no connected db)."
            : isGatewayAuthError
              ? "LLM request rejected — check the API key configured for this stream."
              : isRetryableGatewayError
                ? `LLM gateway transient failure (${response.status}).`
                : "Gemini request failed. Check LiteLLM proxy configuration.",
    });
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
}

// ── tRPC Router ─────────────────────────────────────────────────────────────

export const geminiRouter = router({
  /**
   * Generate a system prompt / agent persona from a domain description.
   * Used on the StreamsPage Agent tab "Generate with Gemini" button.
   */
  generatePersona: adminProcedure
    .input(
      z.object({
        streamName: z.string().min(1),
        streamDescription: z.string().max(1000).optional(),
        domain: z.string().max(500).optional(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveAuthorizedStreamId(
        ctx,
        input.valueStreamId
      );
      const apiKey = await resolveApiKey(resolvedStreamId ?? undefined);
      const domainHint =
        input.domain || input.streamDescription || input.streamName;

      const content = await tryCallGemini(
        "generatePersona",
        ctx,
        [
          {
            role: "system",
            content: `You are an expert at writing system prompts for AI assistants deployed in enterprise retail environments.

Your output should be a complete system prompt (persona) that will be injected as the system message for an LLM-based agent. The prompt should:
1. Define a clear identity and expertise area
2. Set behavioral guidelines (tone, formality, when to escalate)
3. Include domain-specific rules (e.g. compliance, safety, citations)
4. Specify what the agent should NOT do (guardrails baked into the prompt)
5. Be 200-400 words

Output ONLY the system prompt text. No markdown fences, no explanations, no preamble.`,
          },
          {
            role: "user",
            content: `Generate a system prompt for an AI agent in the "${input.streamName}" business domain.

Domain context: ${domainHint}

The agent serves employees at a large retail/warehouse company. It has access to a knowledge base of documents and domain-specific tools.`,
          },
        ],
        { apiKey }
      );

      return {
        persona:
          content?.trim() ??
          buildFallbackPersona({
            streamName: input.streamName,
            domainHint,
          }),
      };
    }),

  /**
   * Suggest an ingestion plan for a value stream's knowledge base.
   * Used on the Knowledge Sources tab "Plan with Gemini" button.
   */
  suggestIngestionPlan: managerProcedure
    .input(
      z.object({
        streamName: z.string().min(1),
        streamDescription: z.string().max(1000).optional(),
        existingDocCount: z.number().int().min(0).optional(),
        existingTopics: z.array(z.string()).max(20).optional(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveGeminiKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before planning ingestion"
      );
      const apiKey = await resolveApiKey(resolvedStreamId);
      const context = [
        `Value stream: ${input.streamName}`,
        input.streamDescription
          ? `Description: ${input.streamDescription}`
          : "",
        input.existingDocCount != null
          ? `Currently indexed: ${input.existingDocCount} documents`
          : "",
        input.existingTopics?.length
          ? `Existing topics: ${input.existingTopics.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const content = await tryCallGemini(
        "suggestIngestionPlan",
        ctx,
        [
          {
            role: "system",
            content: `You are a knowledge management consultant helping build an enterprise knowledge base for an AI agent.

Given a business domain, suggest what documents and content sources should be ingested. Be specific and actionable.

Output a JSON object with this structure (and nothing else):
{
  "summary": "One-sentence overview of the knowledge strategy",
  "categories": [
    {
      "name": "Category name",
      "description": "What this covers",
      "suggestedSources": ["Source 1", "Source 2"],
      "priority": "high" | "medium" | "low",
      "estimatedDocs": 10
    }
  ],
  "quickWins": ["Immediately actionable item 1", "Item 2"],
  "gaps": ["Known gap that needs SME input"]
}

Output ONLY valid JSON. No markdown fences.`,
          },
          {
            role: "user",
            content: `Create an ingestion plan for:\n${context}`,
          },
        ],
        { temperature: 0.3, maxTokens: 2048, apiKey }
      );

      if (!content) {
        return { plan: buildFallbackIngestionPlan(input) };
      }

      // Parse the JSON response (LLM may wrap in markdown fences)
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, "");
      }

      try {
        const plan = JSON.parse(cleaned);
        return { plan };
      } catch {
        // If JSON parsing fails, return the raw text as a fallback
        return {
          plan: { summary: cleaned, categories: [], quickWins: [], gaps: [] },
        };
      }
    }),

  /**
   * Analyze knowledge coverage gaps for a value stream.
   * Used on the Knowledge Gaps tab "Analyze with Gemini" button.
   */
  analyzeGaps: managerProcedure
    .input(
      z.object({
        streamName: z.string().min(1),
        streamDescription: z.string().max(1000).optional(),
        valueStreamId: z.string().optional(), // Required at runtime; persisted snapshots stay stream-scoped
        documents: z
          .array(
            z.object({
              title: z.string(),
              department: z.string().optional(),
              documentType: z.string().optional(),
              chunkCount: z.number().optional(),
              createdAt: z.string().optional(),
            })
          )
          .max(100)
          .optional(),
        recentQueries: z.array(z.string().max(500)).max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireGeminiFeature({
        ctx,
        key: "release.knowledge.validate.gaps",
        message: "Gap analysis is disabled for this deployment",
      });

      const resolvedStreamId = resolveGeminiKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before analyzing knowledge gaps"
      );
      const apiKey = await resolveApiKey(resolvedStreamId);
      const docSummary = input.documents?.length
        ? input.documents
            .map(
              d =>
                `- "${d.title}" (${d.documentType || "general"}, dept=${d.department || "unset"}, ${d.chunkCount || "?"} chunks${d.createdAt ? `, created ${d.createdAt}` : ""})`
            )
            .join("\n")
        : "No documents indexed yet.";

      const querySummary = input.recentQueries?.length
        ? input.recentQueries.map(q => `- "${q}"`).join("\n")
        : "No recent queries available.";

      const content = await tryCallGemini(
        "analyzeGaps",
        ctx,
        [
          {
            role: "system",
            content: `You are a knowledge base auditor for an enterprise AI platform. Analyze the current state of a knowledge base and identify gaps.

Output a JSON object with this structure (and nothing else):
{
  "coverageScore": 0-100,
  "coverageLabel": "Low" | "Moderate" | "Good" | "Excellent",
  "summary": "2-3 sentence assessment",
  "strengths": ["What's well covered"],
  "gaps": [
    {
      "topic": "Missing topic",
      "severity": "high" | "medium" | "low",
      "suggestion": "What to do about it"
    }
  ],
  "staleContent": ["Documents that may need updating"],
  "recommendations": ["Top 3 next actions"]
}

Output ONLY valid JSON. No markdown fences.`,
          },
          {
            role: "user",
            content: `Analyze the knowledge base for the "${input.streamName}" domain.
${input.streamDescription ? `Domain: ${input.streamDescription}` : ""}

Indexed documents:
${docSummary}

Recent user queries:
${querySummary}`,
          },
        ],
        { temperature: 0.2, maxTokens: 2048, apiKey }
      );

      let analysis: {
        coverageScore: number;
        coverageLabel: string;
        summary: string;
        strengths: string[];
        gaps: { topic: string; severity: string; suggestion: string }[];
        staleContent: string[];
        recommendations: string[];
      };

      if (!content) {
        analysis = buildFallbackGapAnalysis(input);
      } else {
        let cleaned = content.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned
            .replace(/^```(?:json)?\s*/, "")
            .replace(/\s*```$/, "");
        }

        try {
          analysis = JSON.parse(cleaned);
        } catch {
          analysis = {
            coverageScore: 0,
            coverageLabel: "Unknown",
            summary: cleaned,
            strengths: [],
            gaps: [],
            staleContent: [],
            recommendations: [],
          };
        }
      }

      // ── Auto-persist snapshot for the selected stream ────────────────────
      let snapshotId: string | null = null;
      if (ctx.user?.id) {
        try {
          const db = await getDb();
          if (db) {
            snapshotId = randomUUID();
            await db.insert(knowledgeGapSnapshots).values({
              id: snapshotId,
              valueStreamId: resolvedStreamId,
              orgId: ctx.user.orgId ?? "default",
              createdBy: ctx.user.id,
              coverageScore: Math.round(analysis.coverageScore ?? 0),
              coverageLabel: analysis.coverageLabel ?? "Unknown",
              documentCount: input.documents?.length ?? 0,
              chunkCount:
                input.documents?.reduce((s, d) => s + (d.chunkCount ?? 0), 0) ??
                0,
              summary: analysis.summary ?? "",
              strengths: JSON.stringify(analysis.strengths ?? []),
              gaps: JSON.stringify(analysis.gaps ?? []),
              staleContent: JSON.stringify(analysis.staleContent ?? []),
              recommendations: JSON.stringify(analysis.recommendations ?? []),
            });
          }
        } catch (e) {
          log.error({ err: e }, "Failed to persist gap snapshot");
          snapshotId = null;
        }
      }

      return { analysis, snapshotId };
    }),

  /**
   * Context-aware AI assistant for any Knowledge page.
   * Each page sends its key + optional data snapshot; Gemini
   * answers with page-specific guidance.
   */
  pageAssist: managerProcedure
    .input(
      z.object({
        page: z.string().min(1),
        question: z.string().min(1).max(2000),
        pageData: z.record(z.string(), z.unknown()).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .max(10)
          .optional(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveAuthorizedStreamId(
        ctx,
        input.valueStreamId
      );
      const apiKey = await resolveApiKey(resolvedStreamId ?? undefined);
      // The client sends rich live context in pageData — use it as the source of truth.
      // No hardcoded page knowledge here; everything is driven by what the UI passes in.
      const dataContext = input.pageData
        ? `\n\n---\n## Live page context (sent from the UI)\n\`\`\`json\n${JSON.stringify(input.pageData, null, 2)}\n\`\`\`\n---`
        : "";

      const messages: GeminiMessage[] = [
        {
          role: "system",
          content: `You are Gemini, an AI assistant embedded inside a Knowledge Base management platform.

The user is currently on the **${input.page}** page. You have been given a live snapshot of the current page state in the context block below — use it to give specific, grounded answers. Never fabricate numbers or facts not present in the context.

### How to respond
- Be concise and practical (2-4 short paragraphs or a short list)
- Use markdown: **bold** for key terms, bullet lists for steps, \`code\` for field names
- Reference actual numbers from the context (e.g. "you have 42 documents indexed")
- If asked for steps, give them in order with clear actions
- If the context doesn't have enough information to answer, say so and suggest where to look
- Never repeat the context back verbatim — synthesize it into useful guidance${dataContext}`,
        },
      ];

      // Append conversation history if provided
      if (input.history?.length) {
        for (const msg of input.history) {
          messages.push({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          });
        }
      }

      messages.push({ role: "user", content: input.question });

      const answer = await tryCallGemini("pageAssist", ctx, messages, {
        temperature: 0.3,
        maxTokens: 1024,
        apiKey,
      });

      return {
        answer:
          answer?.trim() ??
          buildFallbackPageAssist({
            page: input.page,
            question: input.question,
            pageData: input.pageData,
          }),
      };
    }),

  // ── Gap Snapshot History ────────────────────────────────────────────────────

  /**
   * List all gap analysis snapshots for a value stream, newest first.
   * Returns lightweight rows (no full JSON blobs) for the timeline view.
   */
  listGapSnapshots: knowledgeReadProcedure
    .input(
      z.object({
        valueStreamId: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const valueStreamId = resolveGeminiKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing gap analysis history"
      );
      const db = await getDb();
      if (!db) return { snapshots: [] };
      try {
        const rows = await db
          .select({
            id: knowledgeGapSnapshots.id,
            coverageScore: knowledgeGapSnapshots.coverageScore,
            coverageLabel: knowledgeGapSnapshots.coverageLabel,
            documentCount: knowledgeGapSnapshots.documentCount,
            chunkCount: knowledgeGapSnapshots.chunkCount,
            summary: knowledgeGapSnapshots.summary,
            note: knowledgeGapSnapshots.note,
            createdAt: knowledgeGapSnapshots.createdAt,
          })
          .from(knowledgeGapSnapshots)
          .where(
            and(
              eq(knowledgeGapSnapshots.valueStreamId, valueStreamId!),
              eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
            )
          )
          .orderBy(desc(knowledgeGapSnapshots.createdAt))
          .limit(input.limit);

        return {
          snapshots: rows.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          })),
        };
      } catch (err) {
        log.warn(
          { err, valueStreamId },
          "listGapSnapshots failed — returning empty snapshot list"
        );
        return { snapshots: [] };
      }
    }),

  /**
   * Get a single gap snapshot with full JSON detail (gaps, strengths, etc.)
   */
  getGapSnapshot: knowledgeReadProcedure
    .input(z.object({ snapshotId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      const rows = await db
        .select()
        .from(knowledgeGapSnapshots)
        .where(
          and(
            eq(knowledgeGapSnapshots.id, input.snapshotId),
            eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
          )
        )
        .limit(1);

      if (!rows.length)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found",
        });

      const r = rows[0]!;
      resolveGeminiKnowledgeStreamId(
        ctx,
        r.valueStreamId,
        "Snapshot is not linked to an explicit value stream"
      );
      return {
        ...r,
        strengths: JSON.parse(r.strengths) as string[],
        gaps: JSON.parse(r.gaps) as {
          topic: string;
          severity: string;
          suggestion: string;
        }[],
        staleContent: JSON.parse(r.staleContent) as string[],
        recommendations: JSON.parse(r.recommendations) as string[],
        createdAt: r.createdAt.toISOString(),
      };
    }),

  /**
   * Add or update a user annotation note on a snapshot.
   */
  annotateGapSnapshot: managerProcedure
    .input(
      z.object({
        snapshotId: z.string().min(1),
        note: z.string().max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      const rows = await db
        .select({
          id: knowledgeGapSnapshots.id,
          valueStreamId: knowledgeGapSnapshots.valueStreamId,
        })
        .from(knowledgeGapSnapshots)
        .where(
          and(
            eq(knowledgeGapSnapshots.id, input.snapshotId),
            eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
          )
        )
        .limit(1);

      if (!rows.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found",
        });
      }

      resolveGeminiKnowledgeStreamId(
        ctx,
        rows[0]!.valueStreamId,
        "Snapshot is not linked to an explicit value stream"
      );

      await db
        .update(knowledgeGapSnapshots)
        .set({ note: input.note || null })
        .where(
          and(
            eq(knowledgeGapSnapshots.id, input.snapshotId),
            eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
          )
        );

      return { ok: true };
    }),

  /**
   * Compare two gap analysis snapshots using Gemini for semantic matching.
   *
   * This is the industry-standard approach (Google, AWS, Azure):
   * - Server-side diff, not client-side string matching
   * - LLM-powered semantic gap matching (same gap may be phrased differently)
   * - Structured diff response: added, resolved, persisted, summary
   */
  compareSnapshots: managerProcedure
    .input(
      z.object({
        currentSnapshotId: z.string().min(1),
        previousSnapshotId: z.string().min(1),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });

      // Fetch both snapshots
      const [currentRows, previousRows] = await Promise.all([
        db
          .select()
          .from(knowledgeGapSnapshots)
          .where(
            and(
              eq(knowledgeGapSnapshots.id, input.currentSnapshotId),
              eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
            )
          )
          .limit(1),
        db
          .select()
          .from(knowledgeGapSnapshots)
          .where(
            and(
              eq(knowledgeGapSnapshots.id, input.previousSnapshotId),
              eq(knowledgeGapSnapshots.orgId, ctx.user.orgId ?? "default")
            )
          )
          .limit(1),
      ]);

      if (!currentRows.length || !previousRows.length)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both snapshots not found",
        });

      const current = currentRows[0]!;
      const previous = previousRows[0]!;

      const requestedStreamId = input.valueStreamId
        ? resolveGeminiKnowledgeStreamId(
            ctx,
            input.valueStreamId,
            "Select a value stream before comparing gap snapshots"
          )
        : null;
      const currentStreamId = resolveGeminiKnowledgeStreamId(
        ctx,
        current.valueStreamId,
        "Snapshot is not linked to an explicit value stream"
      );
      const previousStreamId = resolveGeminiKnowledgeStreamId(
        ctx,
        previous.valueStreamId,
        "Snapshot is not linked to an explicit value stream"
      );

      if (currentStreamId !== previousStreamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Snapshots from different value streams cannot be compared",
        });
      }
      if (
        requestedStreamId &&
        (currentStreamId !== requestedStreamId ||
          previousStreamId !== requestedStreamId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Snapshots do not belong to the selected value stream",
        });
      }

      const effectiveStreamId = requestedStreamId || currentStreamId;
      const apiKey = await resolveApiKey(effectiveStreamId);

      const currentGaps = JSON.parse(current.gaps) as {
        topic: string;
        severity: string;
        suggestion: string;
      }[];
      const previousGaps = JSON.parse(previous.gaps) as {
        topic: string;
        severity: string;
        suggestion: string;
      }[];
      const currentStrengths = JSON.parse(current.strengths) as string[];
      const previousStrengths = JSON.parse(previous.strengths) as string[];

      // Use Gemini to semantically match gaps between runs
      const diffContent = await tryCallGemini(
        "compareSnapshots",
        ctx,
        [
          {
            role: "system",
            content: `You are a knowledge base auditor comparing two gap analysis reports. Semantically match gaps between runs — the same gap may be phrased differently across runs.

Output a JSON object with this EXACT structure (nothing else):
{
  "resolved": [{"topic": "gap that was in previous but is now addressed", "previousSeverity": "high|medium|low"}],
  "newGaps": [{"topic": "gap that appeared in current but not in previous", "severity": "high|medium|low"}],
  "persisted": [{"topic": "gap present in both runs (use current phrasing)", "severity": "high|medium|low", "severityChange": "escalated|deescalated|unchanged"}],
  "newStrengths": ["strength in current but not in previous"],
  "lostStrengths": ["strength in previous but not in current"],
  "summary": "2-3 sentence analysis of what changed and whether coverage is improving"
}

Rules:
- Match gaps SEMANTICALLY, not by exact string. "Missing HR policies" and "No HR documentation" are the same gap.
- Every gap from both runs must appear in exactly one category (resolved, newGaps, or persisted).
- Output ONLY valid JSON. No markdown fences.`,
          },
          {
            role: "user",
            content: `Compare these two gap analysis reports:

PREVIOUS RUN (${previous.createdAt.toISOString()}):
- Score: ${previous.coverageScore}% (${previous.coverageLabel})
- Documents: ${previous.documentCount}, Chunks: ${previous.chunkCount}
- Gaps: ${JSON.stringify(previousGaps)}
- Strengths: ${JSON.stringify(previousStrengths)}

CURRENT RUN (${current.createdAt.toISOString()}):
- Score: ${current.coverageScore}% (${current.coverageLabel})
- Documents: ${current.documentCount}, Chunks: ${current.chunkCount}
- Gaps: ${JSON.stringify(currentGaps)}
- Strengths: ${JSON.stringify(currentStrengths)}`,
          },
        ],
        { temperature: 0.1, maxTokens: 2048, apiKey }
      );

      let diff: {
        resolved: { topic: string; previousSeverity: string }[];
        newGaps: { topic: string; severity: string }[];
        persisted: {
          topic: string;
          severity: string;
          severityChange: string;
        }[];
        newStrengths: string[];
        lostStrengths: string[];
        summary: string;
      };

      if (!diffContent) {
        diff = buildFallbackSnapshotDiff({
          currentGaps,
          previousGaps,
          currentStrengths,
          previousStrengths,
          currentScore: current.coverageScore,
          previousScore: previous.coverageScore,
        });
      } else {
        let cleaned = diffContent.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned
            .replace(/^```(?:json)?\s*/, "")
            .replace(/\s*```$/, "");
        }

        try {
          diff = JSON.parse(cleaned);
        } catch {
          diff = {
            resolved: [],
            newGaps: [],
            persisted: [],
            newStrengths: [],
            lostStrengths: [],
            summary: cleaned,
          };
        }
      }

      return {
        diff,
        scoreChange: current.coverageScore - previous.coverageScore,
        currentScore: current.coverageScore,
        previousScore: previous.coverageScore,
        currentLabel: current.coverageLabel,
        previousLabel: previous.coverageLabel,
        currentDate: current.createdAt.toISOString(),
        previousDate: previous.createdAt.toISOString(),
        currentDocs: current.documentCount,
        previousDocs: previous.documentCount,
      };
    }),

  suggestQuestions: managerProcedure
    .input(
      z.object({
        title: z.string().max(500),
        content: z.string().max(8000),
        count: z.number().int().min(1).max(10).optional(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveAuthorizedStreamId(
        ctx,
        input.valueStreamId
      );
      const apiKey = await resolveApiKey(resolvedStreamId ?? undefined);
      const n = input.count ?? 5;
      const fallbackQuestions = buildFallbackQuestions(input);
      let raw: string | null = null;
      try {
        raw = await tryCallGemini(
          "suggestQuestions",
          ctx,
          [
            {
              role: "system",
              content: [
                `You generate sample questions that can be answered by searching a knowledge base document. Output exactly ${n} questions as a JSON array of strings.`,
                "Each question must sound like a natural employee question about the business content, not a question about the document itself.",
                "Ground every question in the provided content. Ignore article IDs, URLs, sys_kb_id values, and system-generated titles unless they are essential to the meaning.",
                "Avoid meta patterns like 'What guidance does this document provide?' or 'When should teams use this KB article?'.",
                "Prefer questions about required steps, approvals, eligibility, exceptions, deadlines, and escalation triggers.",
                "No numbering, no markdown, no explanations — just the JSON array.",
              ].join(" "),
            },
            {
              role: "user",
              content: `Document title: "${input.title}"\n\nContent (first 6000 chars):\n${input.content.slice(0, 6000)}`,
            },
          ],
          { temperature: 0.4, maxTokens: 1024, apiKey }
        );
      } catch (err) {
        log.warn(
          { err, valueStreamId: resolvedStreamId },
          "Question suggestion generation failed; using deterministic fallback"
        );
        return { questions: fallbackQuestions };
      }

      if (!raw) {
        return { questions: fallbackQuestions };
      }

      try {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) return { questions: fallbackQuestions };
        const parsed = JSON.parse(match[0]);
        const generatedQuestions = Array.isArray(parsed)
          ? filterHighQualityQuestions(
              parsed.filter((item): item is string => typeof item === "string"),
              n
            )
          : [];

        if (generatedQuestions.length >= n) {
          return { questions: generatedQuestions.slice(0, n) };
        }

        return {
          questions: filterHighQualityQuestions(
            [...generatedQuestions, ...fallbackQuestions],
            n
          ),
        };
      } catch {
        return { questions: fallbackQuestions };
      }
    }),
});
