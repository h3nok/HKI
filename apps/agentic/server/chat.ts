import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  conversations,
  messages,
  thoughtTraceSteps,
  toolExecutions,
  valueStreams,
  type User,
} from "../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { broadcastThoughtTrace } from "./websocket";
import { hasPermission } from "./auth/rbac";
import type { Role } from "./auth/rbac";
import {
  signRequestJwtWithEnvelope,
  type HkiRequestEnvelope,
} from "./auth/sign-request-jwt";
import { ORCHESTRATOR_URL } from "./service-client";
import { createLogger } from "./_core/logger";
import {
  assertAuthorizedChatScope,
  canAccessChatScope,
  getAllowedChatScopes,
  resolveRequestedChatScope,
} from "./_core/chat-scope-auth";
import { isKbHermeticIsolationEnabled } from "./_core/env";

const log = createLogger("chat");

const METADATA_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

async function getGoogleIdToken(audience: string): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") return null;
  try {
    const res = await fetch(
      `${METADATA_URL}?audience=${encodeURIComponent(audience)}`,
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface OrchestratorTraceEvent {
  type: string;
  step: number;
  content: string;
  agent?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface OrchestratorResponse {
  message_id: string;
  content: string;
  confidence: number;
  agent_used: string;
  tool_calls: Array<{
    tool_call_id: string;
    name: string;
    output: any;
    error?: string;
    duration_ms: number;
  }>;
  trace: OrchestratorTraceEvent[];
  citations: Array<{
    source: string;
    title?: string;
    chunk_text?: string;
    score?: number;
    url?: string;
    source_url?: string;
    preview?: string;
    highlight?: string;
    document_id?: string;
    chunk_id?: string;
    page_or_section?: string;
  }>;
  guardrails: {
    passed: boolean;
    input_violations: any[];
    output_violations: any[];
    score: number;
  };
  response_metadata?: Record<string, any>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringSetting(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "string") return value[key] as string;
  }
  return undefined;
}

function readNumberSetting(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "number") return value[key] as number;
  }
  return undefined;
}

function readBooleanSetting(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "boolean") return value[key] as boolean;
  }
  return undefined;
}

function readStringArraySetting(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): string[] | undefined {
  for (const key of keys) {
    if (Array.isArray(value?.[key])) {
      return (value[key] as unknown[])
        .map(item => String(item).trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

function readRiskOverrides(
  value: Record<string, unknown> | undefined
): Record<string, "low" | "medium" | "high"> {
  const raw =
    asObject(value?.riskOverrides) ?? asObject(value?.risk_overrides) ?? {};
  const normalized: Record<string, "low" | "medium" | "high"> = {};
  for (const [toolName, risk] of Object.entries(raw)) {
    if (risk === "low" || risk === "medium" || risk === "high") {
      normalized[toolName] = risk;
    }
  }
  return normalized;
}

function extractFinalResponseMetadata(
  events: OrchestratorTraceEvent[]
): Record<string, any> {
  for (let idx = events.length - 1; idx >= 0; idx -= 1) {
    const event = events[idx];
    if (
      (event.type === "final_response" || event.type === "response_metadata") &&
      event.metadata
    ) {
      return event.metadata;
    }
  }
  return {};
}

function isLegacyFinalResponsePreview(event: OrchestratorTraceEvent): boolean {
  return event.type === "final_response" && !event.metadata;
}

function accumulateLiveResponseContent(
  currentContent: string,
  event: OrchestratorTraceEvent
): string {
  if (event.type === "final_response_chunk") {
    return `${currentContent}${event.content || ""}`;
  }
  if (isLegacyFinalResponsePreview(event)) {
    return event.content || currentContent;
  }
  return currentContent;
}

function extractLiveResponseChunk(
  currentContent: string,
  event: OrchestratorTraceEvent
): string {
  if (event.type === "final_response_chunk") {
    return event.content || "";
  }
  if (isLegacyFinalResponsePreview(event)) {
    const fullContent = event.content || "";
    if (currentContent && fullContent.startsWith(currentContent)) {
      return fullContent.slice(currentContent.length);
    }
    return fullContent;
  }
  return "";
}

function shouldPersistTraceEvent(event: OrchestratorTraceEvent): boolean {
  return (
    event.type !== "final_response_chunk" &&
    event.type !== "response_metadata" &&
    !isLegacyFinalResponsePreview(event)
  );
}

function buildHkiEnvelopeTraceEvent(
  envelope: HkiRequestEnvelope,
  step = 0
): OrchestratorTraceEvent {
  const boundary = envelope.boundary.stream_id || envelope.boundary.scope;
  return {
    type: "hki_envelope",
    step,
    content: `HKI envelope sealed for ${boundary}`,
    metadata: {
      hki_envelope: envelope,
      summary: {
        issuer: envelope.issuer,
        audience: envelope.audience,
        org_id: envelope.organization.id,
        scope: envelope.boundary.scope,
        scopes: envelope.boundary.scopes,
        stream_id: envelope.boundary.stream_id,
        ttl_seconds: envelope.ttl_seconds,
        token_material: envelope.token_material,
      },
    },
    timestamp: envelope.issued_at,
  };
}

function queueTraceEventForPersistence(
  event: OrchestratorTraceEvent,
  pendingTraceRows: Array<{
    id: string;
    messageId: string;
    scope: string;
    step: number;
    type: string;
    content: string;
    metadata?: string;
  }>,
  assistantMessageId: string,
  activeScope: string
) {
  if (!shouldPersistTraceEvent(event)) return;
  pendingTraceRows.push({
    id: nanoid(),
    messageId: assistantMessageId,
    scope: activeScope,
    step: event.step ?? 0,
    type: event.type as any,
    content: event.content,
    metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
  });
}

function broadcastTraceEvent(
  conversationId: string,
  event: OrchestratorTraceEvent
) {
  broadcastThoughtTrace(conversationId, {
    type: event.type as any,
    step: event.step,
    content: event.content,
    metadata: event.metadata,
    timestamp: new Date(event.timestamp ?? Date.now()),
  });
}

function buildAssistantProvenance(
  metadata?: Record<string, any> | null
): Record<string, unknown> | null {
  const raw = asObject(metadata);
  if (!raw) return null;

  const provenance: Record<string, unknown> = {};
  for (const key of [
    "agent",
    "model",
    "model_tier",
    "routing_reason",
    "scope",
    "scopes",
    "enabled_tools",
    "plan_id",
  ]) {
    if (raw[key] !== undefined) provenance[key] = raw[key];
  }

  const promptStack = asObject(raw.prompt_stack);
  if (promptStack) provenance.prompt_stack = promptStack;

  const executionPolicy = asObject(raw.execution_policy);
  if (executionPolicy) provenance.execution_policy = executionPolicy;

  return Object.keys(provenance).length > 0 ? provenance : null;
}

async function callOrchestrator(
  payload: {
    conversation_id: string;
    message: string;
    user_id: string;
    history: Array<{ role: string; content: string }>;
    scope?: string;
    scopes?: string[];
  },
  authToken?: string
): Promise<OrchestratorResponse> {
  const idToken = await getGoogleIdToken(ORCHESTRATOR_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  if (authToken) {
    headers["X-Service-Auth"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${ORCHESTRATOR_URL}/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000), // 120s timeout — LLM calls can be slow
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Orchestrator error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as OrchestratorResponse;
}

/**
 * Stream orchestrator response via SSE — yields trace events in real-time.
 * Each event is broadcast to WebSocket as it arrives instead of waiting
 * for the full response.
 */
async function* callOrchestratorStream(
  payload: {
    conversation_id: string;
    message: string;
    user_id: string;
    history: Array<{ role: string; content: string }>;
    scope?: string;
    scopes?: string[];
  },
  authToken?: string
): AsyncGenerator<OrchestratorTraceEvent> {
  const idToken = await getGoogleIdToken(ORCHESTRATOR_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  if (authToken) {
    headers["X-Service-Auth"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${ORCHESTRATOR_URL}/v1/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Orchestrator stream error ${response.status}: ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("Orchestrator returned no stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const event = JSON.parse(data) as OrchestratorTraceEvent;
          yield event;
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Stream Config Loader ────────────────────────────────────────────────
// Reads the value stream's agent definition from the DB and returns it
// as orchestrator config overrides. Cached per-request (not global) so
// config changes take effect on the next message.

interface StreamAgentConfig {
  system_prompt?: string;
  enabled_tools?: string[];
  retrieval_strategy?: string;
  guardrail_config?: Record<string, boolean>;
  memory_config?: { enabled: boolean; similarity_threshold: number };
  knowledge_config?: Record<string, unknown>;
  llm_api_key?: string;
  execution_policy?: {
    model?: string;
    model_tier?: "auto" | "fast" | "smart" | "thinking";
    enable_planning?: boolean;
    retrieval_strategy?: string;
    budgets?: {
      max_turns?: number;
      max_tool_calls?: number;
      max_tokens?: number;
    };
    tool_permissions?: {
      approval_mode?: "never" | "sensitive_only" | "always";
      sensitive_tools?: string[];
      require_approval_tools?: string[];
      approved_tools?: string[];
      deny_tools?: string[];
      risk_overrides?: Record<string, "low" | "medium" | "high">;
    };
    memory?: {
      enabled?: boolean;
      max_semantic_facts?: number;
      max_episodes?: number;
      max_procedures?: number;
      include_rules?: boolean;
      store_episodes?: boolean;
      consolidate_after_episodes?: number;
    };
    guardrail_config?: Record<string, boolean>;
  };
}

type InterventionAction = "retry" | "retry_modified" | "skip" | "abort";

type InterventionResume = {
  planId: string;
  failedStepId?: string;
  action: InterventionAction;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  userNote?: string;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map(value => value?.trim()).filter(Boolean) as string[])
  );
}

function applyInterventionGrantToStreamConfig(
  streamConfig: StreamAgentConfig | null,
  intervention?: InterventionResume
): StreamAgentConfig | null {
  if (
    !intervention ||
    !["retry", "retry_modified"].includes(intervention.action) ||
    !intervention.toolName
  ) {
    return streamConfig;
  }

  const baseConfig = streamConfig ?? {};
  const basePolicy = baseConfig.execution_policy ?? {};
  const baseToolPermissions = basePolicy.tool_permissions ?? {};
  const approvedTools = uniqueStrings([
    ...(baseToolPermissions.approved_tools ?? []),
    intervention.toolName,
  ]);

  return {
    ...baseConfig,
    execution_policy: {
      ...basePolicy,
      tool_permissions: {
        ...baseToolPermissions,
        approved_tools: approvedTools,
      },
    },
  };
}

function formatToolArguments(
  value: Record<string, unknown> | undefined
): string {
  if (!value || Object.keys(value).length === 0) return "none";
  try {
    return JSON.stringify(value);
  } catch {
    return "unavailable";
  }
}

function buildInterventionResumePrompt(input: InterventionResume): string {
  const toolLabel = input.toolName ? `\`${input.toolName}\`` : "the gated tool";
  const note = input.userNote?.trim()
    ? `\nUser note: ${input.userNote.trim()}`
    : "";

  if (input.action === "abort") {
    return `Abort plan ${input.planId}. Do not run ${toolLabel}. Summarize that the gated action was stopped and no further tool action was taken.${note}`;
  }

  if (input.action === "skip") {
    return `Continue plan ${input.planId} by skipping ${toolLabel}. Do not run the gated tool. Provide the best answer from already available context and clearly state what was skipped.${note}`;
  }

  return [
    `Human approval granted for ${toolLabel} in plan ${input.planId}.`,
    input.failedStepId ? `Resume failed step ${input.failedStepId}.` : "",
    `Use this approval only for the approved tool and continue the paused task.`,
    `Approved arguments: ${formatToolArguments(input.toolArguments)}.`,
    note,
  ]
    .filter(Boolean)
    .join(" ");
}

function isLocalGatewayUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  }
}

const USING_LOCAL_LITELLM = isLocalGatewayUrl(process.env.LLM_GATEWAY_URL);
const ENTERPRISE_RUNTIME_SCOPE =
  process.env.HKI_ENTERPRISE_RUNTIME_SCOPE ||
  process.env.HKI_DEV_RUNTIME_SCOPE ||
  "enterprise";

function normalizeApiKey(raw?: string | null): string | null {
  const key = raw?.trim();
  if (!key) return null;
  if (/^replace[_-]?with/i.test(key) || /^your[_-]?api[_-]?key/i.test(key)) {
    return null;
  }
  if (key === "sk-1234" && !USING_LOCAL_LITELLM) return null;
  return key;
}

function getDownstreamScopes(activeScope: string): string[] {
  return [getDownstreamRuntimeScope(activeScope)];
}

function getDownstreamRuntimeScope(activeScope: string): string {
  if (activeScope === "global" && isKbHermeticIsolationEnabled()) {
    return ENTERPRISE_RUNTIME_SCOPE;
  }
  return activeScope;
}

async function loadStreamConfig(
  scope: string
): Promise<StreamAgentConfig | null> {
  if (!scope || scope === "global") return null;
  const db = await getDb();
  if (!db) return null;

  try {
    const [stream] = await db
      .select({
        systemPrompt: valueStreams.systemPrompt,
        retrievalStrategy: valueStreams.retrievalStrategy,
        enabledTools: valueStreams.enabledTools,
        guardrailConfig: valueStreams.guardrailConfig,
        memoryConfig: valueStreams.memoryConfig,
        knowledgeConfig: valueStreams.knowledgeConfig,
        llmApiKey: valueStreams.llmApiKey,
      })
      .from(valueStreams)
      .where(eq(valueStreams.id, scope))
      .limit(1);

    if (!stream) return null;

    const config: StreamAgentConfig = {};
    let parsedGuardrails: Record<string, boolean> | null = null;
    let parsedMemory: Record<string, unknown> | null = null;
    let parsedKnowledge: Record<string, unknown> | null = null;
    if (stream.systemPrompt) config.system_prompt = stream.systemPrompt;
    if (stream.retrievalStrategy)
      config.retrieval_strategy = stream.retrievalStrategy;
    if (stream.enabledTools) {
      try {
        config.enabled_tools = JSON.parse(stream.enabledTools);
      } catch {
        /* skip */
      }
    }
    if (stream.guardrailConfig) {
      try {
        parsedGuardrails = JSON.parse(stream.guardrailConfig);
        if (parsedGuardrails) {
          config.guardrail_config = parsedGuardrails;
        }
      } catch {
        /* skip */
      }
    }
    if (stream.memoryConfig) {
      try {
        parsedMemory = JSON.parse(stream.memoryConfig);
        config.memory_config = parsedMemory as any;
      } catch {
        /* skip */
      }
    }
    if (stream.knowledgeConfig) {
      try {
        parsedKnowledge = JSON.parse(stream.knowledgeConfig);
        if (parsedKnowledge) {
          config.knowledge_config = parsedKnowledge;
        }
      } catch {
        /* skip */
      }
    }
    const streamKey = normalizeApiKey(stream.llmApiKey);
    if (streamKey) config.llm_api_key = streamKey;

    const parsedKnowledgeRecord = asObject(parsedKnowledge);
    const parsedGuardrailsRecord = asObject(parsedGuardrails);
    const parsedMemoryRecord = asObject(parsedMemory);
    const embeddedExecutionPolicy =
      asObject(parsedKnowledgeRecord?.executionPolicy) ??
      asObject(parsedKnowledgeRecord?.execution_policy);
    const embeddedBudgets = asObject(embeddedExecutionPolicy?.budgets);
    const embeddedToolPermissions =
      asObject(embeddedExecutionPolicy?.toolPermissions) ??
      asObject(embeddedExecutionPolicy?.tool_permissions);
    const embeddedMemory = asObject(embeddedExecutionPolicy?.memory);

    const modelOverride =
      readStringSetting(parsedKnowledgeRecord, "model") ??
      readStringSetting(embeddedExecutionPolicy, "model");
    const modelTier = (readStringSetting(
      parsedKnowledgeRecord,
      "modelTier",
      "model_tier"
    ) ??
      readStringSetting(embeddedExecutionPolicy, "modelTier", "model_tier")) as
      | "auto"
      | "fast"
      | "smart"
      | "thinking"
      | undefined;
    const enablePlanning =
      readBooleanSetting(
        parsedKnowledgeRecord,
        "enablePlanning",
        "enable_planning"
      ) ??
      readBooleanSetting(
        embeddedExecutionPolicy,
        "enablePlanning",
        "enable_planning"
      );
    const maxTurns =
      readNumberSetting(parsedKnowledgeRecord, "maxTurns", "max_turns") ??
      readNumberSetting(embeddedBudgets, "maxTurns", "max_turns");
    const maxToolCalls =
      readNumberSetting(
        parsedKnowledgeRecord,
        "maxToolCalls",
        "max_tool_calls"
      ) ?? readNumberSetting(embeddedBudgets, "maxToolCalls", "max_tool_calls");
    const maxTokens =
      readNumberSetting(parsedKnowledgeRecord, "maxTokens", "max_tokens") ??
      readNumberSetting(embeddedBudgets, "maxTokens", "max_tokens");

    const executionPolicy: NonNullable<StreamAgentConfig["execution_policy"]> =
      {
        ...(modelOverride ? { model: modelOverride } : {}),
        ...(modelTier ? { model_tier: modelTier } : {}),
        ...(enablePlanning !== undefined
          ? { enable_planning: enablePlanning }
          : {}),
        retrieval_strategy:
          config.retrieval_strategy ??
          readStringSetting(
            embeddedExecutionPolicy,
            "retrievalStrategy",
            "retrieval_strategy"
          ),
        budgets: {
          ...(maxTurns !== undefined ? { max_turns: maxTurns } : {}),
          ...(maxToolCalls !== undefined
            ? { max_tool_calls: maxToolCalls }
            : {}),
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        },
        tool_permissions: {
          approval_mode: (readStringSetting(
            parsedGuardrailsRecord,
            "approvalMode",
            "approval_mode"
          ) ??
            readStringSetting(
              embeddedToolPermissions,
              "approvalMode",
              "approval_mode"
            ) ??
            "sensitive_only") as "never" | "sensitive_only" | "always",
          sensitive_tools: readStringArraySetting(
            parsedGuardrailsRecord,
            "sensitiveTools",
            "sensitive_tools"
          ) ??
            readStringArraySetting(
              embeddedToolPermissions,
              "sensitiveTools",
              "sensitive_tools"
            ) ?? ["get_member_info"],
          require_approval_tools:
            readStringArraySetting(
              parsedGuardrailsRecord,
              "requireApprovalTools",
              "require_approval_tools"
            ) ??
            readStringArraySetting(
              embeddedToolPermissions,
              "requireApprovalTools",
              "require_approval_tools"
            ) ??
            [],
          deny_tools:
            readStringArraySetting(
              parsedGuardrailsRecord,
              "denyTools",
              "deny_tools"
            ) ??
            readStringArraySetting(
              embeddedToolPermissions,
              "denyTools",
              "deny_tools"
            ) ??
            [],
          risk_overrides: readRiskOverrides(embeddedToolPermissions),
        },
        memory: {
          ...(readBooleanSetting(parsedMemoryRecord, "enabled") !== undefined
            ? { enabled: readBooleanSetting(parsedMemoryRecord, "enabled") }
            : readBooleanSetting(embeddedMemory, "enabled") !== undefined
              ? { enabled: readBooleanSetting(embeddedMemory, "enabled") }
              : {}),
          ...(readNumberSetting(
            parsedMemoryRecord,
            "maxSemanticFacts",
            "max_semantic_facts"
          ) !== undefined
            ? {
                max_semantic_facts: readNumberSetting(
                  parsedMemoryRecord,
                  "maxSemanticFacts",
                  "max_semantic_facts"
                ),
              }
            : readNumberSetting(
                  embeddedMemory,
                  "maxSemanticFacts",
                  "max_semantic_facts"
                ) !== undefined
              ? {
                  max_semantic_facts: readNumberSetting(
                    embeddedMemory,
                    "maxSemanticFacts",
                    "max_semantic_facts"
                  ),
                }
              : {}),
          ...(readNumberSetting(
            parsedMemoryRecord,
            "maxEpisodes",
            "max_episodes"
          ) !== undefined
            ? {
                max_episodes: readNumberSetting(
                  parsedMemoryRecord,
                  "maxEpisodes",
                  "max_episodes"
                ),
              }
            : readNumberSetting(
                  embeddedMemory,
                  "maxEpisodes",
                  "max_episodes"
                ) !== undefined
              ? {
                  max_episodes: readNumberSetting(
                    embeddedMemory,
                    "maxEpisodes",
                    "max_episodes"
                  ),
                }
              : {}),
          ...(readNumberSetting(
            parsedMemoryRecord,
            "maxProcedures",
            "max_procedures"
          ) !== undefined
            ? {
                max_procedures: readNumberSetting(
                  parsedMemoryRecord,
                  "maxProcedures",
                  "max_procedures"
                ),
              }
            : readNumberSetting(
                  embeddedMemory,
                  "maxProcedures",
                  "max_procedures"
                ) !== undefined
              ? {
                  max_procedures: readNumberSetting(
                    embeddedMemory,
                    "maxProcedures",
                    "max_procedures"
                  ),
                }
              : {}),
          ...(readBooleanSetting(
            parsedMemoryRecord,
            "includeRules",
            "include_rules"
          ) !== undefined
            ? {
                include_rules: readBooleanSetting(
                  parsedMemoryRecord,
                  "includeRules",
                  "include_rules"
                ),
              }
            : readBooleanSetting(
                  embeddedMemory,
                  "includeRules",
                  "include_rules"
                ) !== undefined
              ? {
                  include_rules: readBooleanSetting(
                    embeddedMemory,
                    "includeRules",
                    "include_rules"
                  ),
                }
              : {}),
          ...(readBooleanSetting(
            parsedMemoryRecord,
            "storeEpisodes",
            "store_episodes"
          ) !== undefined
            ? {
                store_episodes: readBooleanSetting(
                  parsedMemoryRecord,
                  "storeEpisodes",
                  "store_episodes"
                ),
              }
            : readBooleanSetting(
                  embeddedMemory,
                  "storeEpisodes",
                  "store_episodes"
                ) !== undefined
              ? {
                  store_episodes: readBooleanSetting(
                    embeddedMemory,
                    "storeEpisodes",
                    "store_episodes"
                  ),
                }
              : {}),
          ...(readNumberSetting(
            parsedMemoryRecord,
            "consolidateAfterEpisodes",
            "consolidate_after_episodes"
          ) !== undefined
            ? {
                consolidate_after_episodes: readNumberSetting(
                  parsedMemoryRecord,
                  "consolidateAfterEpisodes",
                  "consolidate_after_episodes"
                ),
              }
            : readNumberSetting(
                  embeddedMemory,
                  "consolidateAfterEpisodes",
                  "consolidate_after_episodes"
                ) !== undefined
              ? {
                  consolidate_after_episodes: readNumberSetting(
                    embeddedMemory,
                    "consolidateAfterEpisodes",
                    "consolidate_after_episodes"
                  ),
                }
              : {}),
        },
        guardrail_config: parsedGuardrails ?? {},
      };

    config.execution_policy = executionPolicy;
    return config;
  } catch (err) {
    log.error({ err, scope }, "Failed to load stream config");
    return null;
  }
}

// In-memory store for dev mode when no DB
const mockConversations = new Map<
  string,
  { id: string; userId: number; title: string; scope: string; messages: any[] }
>();

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type GatewayFailureKind =
  | "policy_blocked"
  | "auth_failed"
  | "gateway_unavailable"
  | "timeout"
  | "unknown";

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return `${error.name}: ${error.message}${
      cause ? ` ${stringifyError(cause)}` : ""
    }`;
  }

  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function redactErrorDetails(details: string): string {
  return details
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9._-]+\b/g, "sk-[redacted]");
}

function classifyGatewayFailure(error: unknown): {
  kind: GatewayFailureKind;
  detail: string;
} {
  const detail = redactErrorDetails(stringifyError(error)).slice(0, 2000);
  const normalizedMessage = detail.toLowerCase();

  if (
    normalizedMessage.includes("504") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("upstream")
  ) {
    return { kind: "timeout", detail };
  }

  if (
    normalizedMessage.includes("vpc_service_controls") ||
    normalizedMessage.includes("security_policy_violated") ||
    normalizedMessage.includes("vpc service controls") ||
    normalizedMessage.includes(
      "request is prohibited by organization's policy"
    ) ||
    normalizedMessage.includes("permission_denied") ||
    normalizedMessage.includes("403") ||
    normalizedMessage.includes("forbidden")
  ) {
    return { kind: "policy_blocked", detail };
  }

  if (
    normalizedMessage.includes("401") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("invalid api key") ||
    normalizedMessage.includes("authentication")
  ) {
    return { kind: "auth_failed", detail };
  }

  if (
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("connection refused") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("orchestrator returned no stream body")
  ) {
    return { kind: "gateway_unavailable", detail };
  }

  return { kind: "unknown", detail };
}

function getAssistantFailureMessage(error: unknown): string {
  const failure = classifyGatewayFailure(error);

  switch (failure.kind) {
    case "policy_blocked":
      return "The model gateway reached Vertex AI, but Google policy blocked this environment from calling the configured model. Ask a platform admin to allow the gateway credentials/project under VPC Service Controls or point this domain to an approved LLM gateway, then retry.";
    case "auth_failed":
      return "The model gateway rejected the platform credentials. Update the LLM gateway API key or service authentication configuration, then retry.";
    case "gateway_unavailable":
      return "The orchestrator or model gateway is unavailable from this environment. Start the local services or update ORCHESTRATOR_URL and LLM_GATEWAY_URL, then retry.";
    case "timeout":
      return "I hit an upstream timeout before I could finish. Please try again.";
    default:
      return "I ran into a platform error while generating the response. The trace envelope has the gateway details for the platform team.";
  }
}

function buildGatewayFailureTraceEvent(
  error: unknown,
  step: number,
  failureContent: string
): OrchestratorTraceEvent {
  const failure = classifyGatewayFailure(error);

  return {
    type: "tool_result",
    step,
    content: "Model gateway needs platform attention.",
    metadata: {
      result: {
        tool_call_id: `model-gateway-${step}`,
        name: "model_gateway",
        output: null,
        error: failureContent,
        duration_ms: 0,
      },
      failure_kind: failure.kind,
      failure_detail: failure.detail,
    },
    timestamp: new Date().toISOString(),
  };
}

async function processConversationMessageStream({
  db,
  user,
  conversationId,
  inputContent,
  assistantMessageId,
  activeScope,
  downstreamScopes,
  intervention,
}: {
  db: DbClient;
  user: User;
  conversationId: string;
  inputContent: string;
  assistantMessageId: string;
  activeScope: string;
  downstreamScopes: string[];
  intervention?: InterventionResume;
}): Promise<void> {
  const traceEvents: OrchestratorTraceEvent[] = [];
  let finalContent = "";
  let liveResponseContent = "";

  const pendingTraceRows: Array<{
    id: string;
    messageId: string;
    scope: string;
    step: number;
    type: string;
    content: string;
    metadata?: string;
  }> = [];
  const pendingToolRows: Array<{
    id: string;
    messageId: string;
    scope: string;
    toolName: string;
    input: string;
    status: string;
    output: string;
    error?: string;
    completedAt: Date;
  }> = [];

  try {
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(20);
    history.reverse();

    const downstreamScope = getDownstreamRuntimeScope(activeScope);
    const { token: authToken, envelope } = await signRequestJwtWithEnvelope(
      user,
      downstreamScope,
      downstreamScopes
    );
    const hkiEnvelopeEvent = buildHkiEnvelopeTraceEvent(envelope);
    traceEvents.push(hkiEnvelopeEvent);
    broadcastTraceEvent(conversationId, hkiEnvelopeEvent);
    queueTraceEventForPersistence(
      hkiEnvelopeEvent,
      pendingTraceRows,
      assistantMessageId,
      activeScope
    );

    const streamConfig = applyInterventionGrantToStreamConfig(
      await loadStreamConfig(activeScope),
      intervention
    );
    const streamPayload = {
      conversation_id: conversationId,
      message: inputContent,
      user_id: String(user.id),
      org_id: user.orgId || "default",
      history: history
        .filter(message => message.id !== assistantMessageId)
        .map((message: any) => ({
          role: message.role,
          content: message.content,
        })),
      scope: downstreamScope,
      scopes: downstreamScopes,
      ...(streamConfig ? { stream_config: streamConfig } : {}),
    };

    for await (const event of callOrchestratorStream(
      streamPayload,
      authToken
    )) {
      traceEvents.push(event);

      if (
        event.type === "final_response_chunk" ||
        isLegacyFinalResponsePreview(event)
      ) {
        const liveResponseChunk = extractLiveResponseChunk(
          liveResponseContent,
          event
        );
        liveResponseContent = accumulateLiveResponseContent(
          liveResponseContent,
          event
        );
        broadcastThoughtTrace(conversationId, {
          type: "final_response_chunk" as any,
          step: event.step,
          content: liveResponseChunk,
          metadata: event.metadata,
          timestamp: new Date(event.timestamp ?? Date.now()),
        });
      } else if (
        event.type !== "final_response" &&
        event.type !== "response_metadata"
      ) {
        broadcastThoughtTrace(conversationId, {
          type: event.type as any,
          step: event.step,
          content: event.content,
          metadata: event.metadata,
          timestamp: new Date(event.timestamp ?? Date.now()),
        });
      }

      if (shouldPersistTraceEvent(event)) {
        queueTraceEventForPersistence(
          event,
          pendingTraceRows,
          assistantMessageId,
          activeScope
        );
      }

      if (event.type === "tool_result" && event.metadata?.result) {
        const toolResult = event.metadata.result as any;
        pendingToolRows.push({
          id: toolResult.tool_call_id || nanoid(),
          messageId: assistantMessageId,
          scope: activeScope,
          toolName: toolResult.name || "unknown",
          input: JSON.stringify({ tool: toolResult.name }),
          status: toolResult.error ? "error" : "success",
          output: JSON.stringify(toolResult.output),
          error: toolResult.error || undefined,
          completedAt: new Date(),
        });
      }

      if (event.type === "final_response") {
        finalContent = event.content;
      }
    }

    if (!finalContent && liveResponseContent) {
      finalContent = liveResponseContent;
    }
    if (!finalContent) {
      finalContent =
        "I didn't receive a final response from the upstream agent. Please try again.";
    }

    const citations: any[] = [];
    const toolCalls: any[] = [];
    let guardrails: any = null;
    let confidence: number | null = null;
    const finalResponseMetadata = extractFinalResponseMetadata(traceEvents);
    const messageProvenance = buildAssistantProvenance(finalResponseMetadata);

    const pendingCalls: Array<{
      tool_call_id: string;
      name: string;
      arguments: Record<string, any>;
    }> = [];

    for (const event of traceEvents) {
      if (event.type === "knowledge_retrieval" && event.metadata?.citations) {
        citations.push(...event.metadata.citations);
      }
      if (event.type === "tool_call" && event.metadata?.tool) {
        pendingCalls.push({
          tool_call_id:
            event.metadata.tool_call_id || `tc-${pendingCalls.length}`,
          name: event.metadata.tool,
          arguments: event.metadata.arguments || {},
        });
      }
      if (event.type === "tool_result" && event.metadata?.result) {
        const result = event.metadata.result;
        const matchIdx = result.tool_call_id
          ? pendingCalls.findIndex(c => c.tool_call_id === result.tool_call_id)
          : -1;
        const call =
          matchIdx >= 0
            ? pendingCalls.splice(matchIdx, 1)[0]
            : pendingCalls.shift();
        toolCalls.push({
          tool_call_id:
            result.tool_call_id ||
            call?.tool_call_id ||
            `tc-${toolCalls.length}`,
          name: result.name || call?.name || "unknown",
          arguments: call?.arguments || {},
          output: result.output,
          error: result.error || null,
          duration_ms: result.duration_ms || event.metadata.duration_ms || 0,
        });
      }
      if (event.type === "guardrail" && event.metadata?.report) {
        guardrails = event.metadata.report;
      }
      if (
        (event.type === "final_response" ||
          event.type === "response_metadata") &&
        event.metadata?.confidence != null &&
        event.metadata.confidence > 0
      ) {
        confidence = event.metadata.confidence;
      }
    }

    await db
      .update(messages)
      .set({
        content: finalContent,
        toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
        citations: citations.length > 0 ? JSON.stringify(citations) : null,
        confidence: confidence ?? 0,
        guardrails: guardrails ? JSON.stringify(guardrails) : null,
        provenance: messageProvenance
          ? JSON.stringify(messageProvenance)
          : null,
      })
      .where(eq(messages.id, assistantMessageId));

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    try {
      if (pendingTraceRows.length > 0) {
        await db.insert(thoughtTraceSteps).values(pendingTraceRows as any);
      }
      if (pendingToolRows.length > 0) {
        await db.insert(toolExecutions).values(pendingToolRows as any);
      }
    } catch (persistError) {
      log.error(
        { err: persistError, conversationId, assistantMessageId },
        "Trace/tool persistence failed (response preserved)"
      );
    }

    broadcastThoughtTrace(conversationId, {
      type: "final_response" as any,
      step: traceEvents.length + 1,
      content: finalContent,
      timestamp: new Date(),
    });
  } catch (error) {
    const failureContent = getAssistantFailureMessage(error);
    const failureTraceEvent = buildGatewayFailureTraceEvent(
      error,
      traceEvents.length + 1,
      failureContent
    );

    log.error(
      { err: error, conversationId, assistantMessageId, activeScope },
      "Background orchestrator processing failed"
    );

    try {
      await db
        .update(messages)
        .set({
          content: failureContent,
          toolCalls: null,
          citations: null,
          confidence: 0,
          guardrails: null,
          provenance: null,
        })
        .where(eq(messages.id, assistantMessageId));

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      await db.insert(thoughtTraceSteps).values([
        ...(pendingTraceRows as any[]),
        {
          id: nanoid(),
          messageId: assistantMessageId,
          scope: activeScope,
          step: failureTraceEvent.step,
          type: failureTraceEvent.type as any,
          content: failureTraceEvent.content,
          metadata: failureTraceEvent.metadata
            ? JSON.stringify(failureTraceEvent.metadata)
            : undefined,
        },
      ]);

      await db.insert(toolExecutions).values([
        ...(pendingToolRows as any[]),
        {
          id: `model-gateway-${assistantMessageId}`,
          messageId: assistantMessageId,
          scope: activeScope,
          toolName: "model_gateway",
          input: JSON.stringify({
            conversationId,
            scope: activeScope,
          }),
          status: "error",
          output: JSON.stringify(null),
          error: failureContent,
          completedAt: new Date(),
        },
      ]);
    } catch (persistError) {
      log.error(
        { err: persistError, conversationId, assistantMessageId },
        "Failed to persist assistant error state"
      );
    }

    broadcastThoughtTrace(conversationId, {
      type: failureTraceEvent.type as any,
      step: failureTraceEvent.step,
      content: failureTraceEvent.content,
      metadata: failureTraceEvent.metadata,
      timestamp: new Date(),
    });

    broadcastThoughtTrace(conversationId, {
      type: "final_response" as any,
      step: failureTraceEvent.step + 1,
      content: failureContent,
      timestamp: new Date(),
    });
  }
}

export const chatRouter = router({
  // Get all tasks for the current user (ownership + stream access enforced)
  getTasks: protectedProcedure
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const userId = input.userId ?? ctx.user.id;
      if (userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot list another user's conversations",
        });
      }
      const db = await getDb();
      const allowedScopes = await getAllowedChatScopes(ctx.user, db);
      if (!db) {
        return Array.from(mockConversations.values())
          .filter(
            c =>
              c.userId === userId && canAccessChatScope(c.scope, allowedScopes)
          )
          .map(c => ({
            id: c.id,
            userId: c.userId,
            title: c.title,
            scope: c.scope,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
      }
      const conversationRows = await db
        .select({
          id: conversations.id,
          userId: conversations.userId,
          title: conversations.title,
          scope: conversations.scope,
          isPinned: conversations.isPinned,
          projectId: conversations.projectId,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
          lastMessage: sql<string | null>`(
            SELECT SUBSTRING(m.content, 1, 120)
            FROM messages m
            WHERE m.conversationId = conversations.id
              AND m.role = 'assistant'
              AND m.content != 'Thinking...'
            ORDER BY m.createdAt DESC
            LIMIT 1
          )`,
          messageCount: sql<number>`(
            SELECT COUNT(*)
            FROM messages m
            WHERE m.conversationId = conversations.id
          )`,
        })
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt));

      return conversationRows.filter(conversation =>
        canAccessChatScope(conversation.scope, allowedScopes)
      );
    }),

  // Get a single task with messages (ownership + stream access enforced)
  getTask: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        const conv = mockConversations.get(input.conversationId);
        if (!conv) {
          return {
            conversation: { id: input.conversationId, title: "New Chat" },
            messages: [],
          };
        }
        if (conv.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Conversation not found",
          });
        }
        const allowedScopes = await getAllowedChatScopes(
          ctx.user,
          db,
          (conv as any).scope
        );
        assertAuthorizedChatScope(
          (conv as any).scope,
          allowedScopes,
          "Conversation not found"
        );
        return {
          conversation: {
            id: conv.id,
            title: conv.title,
            scope: (conv as any).scope,
          },
          messages: conv.messages,
        };
      }
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }
      if (conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conversation.scope
      );
      assertAuthorizedChatScope(
        conversation.scope,
        allowedScopes,
        "Conversation not found"
      );

      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt);

      return {
        conversation,
        messages: conversationMessages,
      };
    }),

  // Create a new task (always for current user)
  createTask: protectedProcedure
    .input(
      z.object({
        userId: z.number().optional(), // ignored; use ctx.user.id for enterprise isolation
        title: z.string().optional(),
        projectId: z.string().optional(), // auto-assign to project (inherits active context)
        scope: z.string().optional(), // active value stream scope from client
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!hasPermission(ctx.user.role as Role, "chat:write")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create conversations",
        });
      }
      const userId = ctx.user.id;
      const db = await getDb();
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        input.scope
      );
      const scope = resolveRequestedChatScope(input.scope, allowedScopes);
      const id = nanoid();
      if (!db) {
        mockConversations.set(id, {
          id,
          userId,
          title: input.title || "New Conversation",
          scope,
          messages: [],
        });
        return { id, scope };
      }
      await db.insert(conversations).values({
        id,
        userId,
        title: input.title || "New Conversation",
        scope,
        ...(input.projectId ? { projectId: input.projectId } : {}),
      });

      return { id, scope };
    }),

  // Delete a task (ownership enforced)
  deleteTask: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!hasPermission(ctx.user.role as Role, "chat:delete")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete conversations",
        });
      }
      const db = await getDb();

      if (!db) {
        const conv = mockConversations.get(input.conversationId);
        if (
          conv &&
          (conv.userId !== ctx.user.id ||
            !canAccessChatScope(
              (conv as any).scope,
              await getAllowedChatScopes(ctx.user, db, (conv as any).scope)
            ))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Conversation not found",
          });
        }
        mockConversations.delete(input.conversationId);
        return { success: true };
      }

      const [conversation] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conversation.scope
      );
      assertAuthorizedChatScope(
        conversation.scope,
        allowedScopes,
        "Conversation not found"
      );

      // Use a transaction for atomic cascade delete — no orphaned rows on failure
      const pool = (db as any)._.session?.client;
      if (pool && typeof pool.promise === "function") {
        // mysql2 pool transaction via raw connection
        const conn = await pool.promise().getConnection();
        try {
          await conn.beginTransaction();
          const innerDb = (await import("drizzle-orm/mysql2")).drizzle({
            client: conn,
          });

          // Collect message IDs for batch deletes
          const conversationMessages = await innerDb
            .select({ id: messages.id })
            .from(messages)
            .where(eq(messages.conversationId, input.conversationId));

          const messageIds = conversationMessages.map(m => m.id);

          if (messageIds.length > 0) {
            await innerDb
              .delete(toolExecutions)
              .where(inArray(toolExecutions.messageId, messageIds));
            await innerDb
              .delete(thoughtTraceSteps)
              .where(inArray(thoughtTraceSteps.messageId, messageIds));
          }
          await innerDb
            .delete(messages)
            .where(eq(messages.conversationId, input.conversationId));
          await innerDb
            .delete(conversations)
            .where(eq(conversations.id, input.conversationId));

          await conn.commit();
        } catch (txError) {
          await conn.rollback();
          throw txError;
        } finally {
          conn.release();
        }
      } else {
        // Fallback: batch deletes without explicit transaction (e.g. test environment)
        const conversationMessages = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId));

        const messageIds = conversationMessages.map(m => m.id);

        if (messageIds.length > 0) {
          await db
            .delete(toolExecutions)
            .where(inArray(toolExecutions.messageId, messageIds));
          await db
            .delete(thoughtTraceSteps)
            .where(inArray(thoughtTraceSteps.messageId, messageIds));
        }
        await db
          .delete(messages)
          .where(eq(messages.conversationId, input.conversationId));
        await db
          .delete(conversations)
          .where(eq(conversations.id, input.conversationId));
      }

      return { success: true };
    }),

  // Rename a task (ownership enforced)
  renameTask: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        title: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        const conv = mockConversations.get(input.conversationId);
        if (!conv || conv.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Conversation not found",
          });
        }
        conv.title = input.title;
        return { success: true };
      }
      const [conversation] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conversation.scope
      );
      assertAuthorizedChatScope(
        conversation.scope,
        allowedScopes,
        "Conversation not found"
      );
      await db
        .update(conversations)
        .set({ title: input.title })
        .where(eq(conversations.id, input.conversationId));
      return { success: true };
    }),

  // Pin/unpin a task (ownership enforced)
  pinTask: protectedProcedure
    .input(z.object({ conversationId: z.string(), isPinned: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        // Dev mode: no-op for pin since mock doesn't have isPinned
        return { success: true, isPinned: input.isPinned };
      }
      const [conversation] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conversation.scope
      );
      assertAuthorizedChatScope(
        conversation.scope,
        allowedScopes,
        "Conversation not found"
      );
      await db
        .update(conversations)
        .set({ isPinned: input.isPinned ? 1 : 0 })
        .where(eq(conversations.id, input.conversationId));
      return { success: true, isPinned: input.isPinned };
    }),

  // Send a message and get agent response
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string(),
        scope: z.string().optional(), // active scope override (falls back to conversation's stored scope)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // ── Dev mode (no DB) — relay to orchestrator, store in memory ──
      if (!db) {
        // RBAC check even in dev mode
        if (!hasPermission(ctx.user.role as Role, "chat:write")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to send messages",
          });
        }
        const existingConversation = mockConversations.get(
          input.conversationId
        );
        const requestedScope = existingConversation
          ? (existingConversation as any).scope
          : input.scope;
        const allowedScopes = await getAllowedChatScopes(
          ctx.user,
          db,
          requestedScope
        );
        const activeScope = resolveRequestedChatScope(
          requestedScope,
          allowedScopes
        );
        const conv = existingConversation || {
          id: input.conversationId,
          userId: ctx.user.id,
          title: "New Chat",
          scope: activeScope,
          messages: [] as any[],
        };
        if (conv.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Conversation not found",
          });
        }
        mockConversations.set(input.conversationId, conv);

        // Existing conversations are scope-sticky.
        const downstreamScopes = getDownstreamScopes(activeScope);

        const userMessageId = nanoid();
        const assistantMessageId = nanoid();
        const userCreatedAt = new Date();
        conv.messages.push({
          id: userMessageId,
          role: "user",
          content: input.content,
          createdAt: userCreatedAt,
        });

        const devToolCalls: any[] = [];
        let devFinalMetadata: Record<string, any> = {};
        const devPendingCalls: Array<{
          tool_call_id: string;
          name: string;
          arguments: Record<string, any>;
        }> = [];

        let devFinalContent = "";
        let devLiveResponseContent = "";

        try {
          const downstreamScope = getDownstreamRuntimeScope(activeScope);
          const { token: devAuthToken, envelope } =
            await signRequestJwtWithEnvelope(
              ctx.user,
              downstreamScope,
              downstreamScopes
            );
          broadcastTraceEvent(
            input.conversationId,
            buildHkiEnvelopeTraceEvent(envelope)
          );
          const streamConfig = await loadStreamConfig(activeScope);
          const streamPayload = {
            conversation_id: input.conversationId,
            message: input.content,
            user_id: String(ctx.user.id),
            org_id: ctx.user.orgId || "default",
            history: conv.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
            })),
            scope: downstreamScope,
            scopes: downstreamScopes,
            ...(streamConfig ? { stream_config: streamConfig } : {}),
          };

          for await (const event of callOrchestratorStream(
            streamPayload,
            devAuthToken
          )) {
            if (
              event.type === "final_response_chunk" ||
              isLegacyFinalResponsePreview(event)
            ) {
              const liveResponseChunk = extractLiveResponseChunk(
                devLiveResponseContent,
                event
              );
              devLiveResponseContent = accumulateLiveResponseContent(
                devLiveResponseContent,
                event
              );
              broadcastThoughtTrace(input.conversationId, {
                type: "final_response_chunk" as any,
                step: event.step,
                content: liveResponseChunk,
                metadata: event.metadata,
                timestamp: new Date(event.timestamp ?? Date.now()),
              });
            } else if (event.type === "final_response") {
              devFinalContent = event.content;
              if (event.metadata) {
                devFinalMetadata = event.metadata;
              }
            } else if (event.type === "response_metadata") {
              if (event.metadata) {
                devFinalMetadata = event.metadata;
              }
            } else {
              broadcastThoughtTrace(input.conversationId, {
                type: event.type as any,
                step: event.step,
                content: event.content,
                metadata: event.metadata,
                timestamp: new Date(event.timestamp ?? Date.now()),
              });
            }
            if (event.type === "tool_call" && event.metadata?.tool) {
              devPendingCalls.push({
                tool_call_id:
                  event.metadata.tool_call_id || `tc-${devPendingCalls.length}`,
                name: event.metadata.tool,
                arguments: event.metadata.arguments || {},
              });
            }
            if (event.type === "tool_result" && event.metadata?.result) {
              const result = event.metadata.result;
              // Fix #2: Match by tool_call_id first, fall back to positional shift
              const matchIdx = result.tool_call_id
                ? devPendingCalls.findIndex(
                    c => c.tool_call_id === result.tool_call_id
                  )
                : -1;
              const call =
                matchIdx >= 0
                  ? devPendingCalls.splice(matchIdx, 1)[0]
                  : devPendingCalls.shift();
              devToolCalls.push({
                tool_call_id:
                  result.tool_call_id ||
                  call?.tool_call_id ||
                  `tc-${devToolCalls.length}`,
                name: result.name || call?.name || "unknown",
                arguments: call?.arguments || {},
                output: result.output,
                error: result.error || null,
                duration_ms: result.duration_ms || 0,
              });
            }
          }
        } catch (error) {
          const failureContent = getAssistantFailureMessage(error);
          const failureTraceEvent = buildGatewayFailureTraceEvent(
            error,
            1,
            failureContent
          );

          log.error(
            {
              err: error,
              conversationId: input.conversationId,
              assistantMessageId,
              activeScope,
            },
            "Dev orchestrator processing failed"
          );

          conv.messages.push({
            id: assistantMessageId,
            role: "assistant",
            content: failureContent,
            toolCalls: null,
            provenance: null,
            createdAt: new Date(userCreatedAt.getTime() + 1000),
          });

          broadcastThoughtTrace(input.conversationId, {
            type: failureTraceEvent.type as any,
            step: failureTraceEvent.step,
            content: failureTraceEvent.content,
            metadata: failureTraceEvent.metadata,
            timestamp: new Date(),
          });

          broadcastThoughtTrace(input.conversationId, {
            type: "final_response" as any,
            step: failureTraceEvent.step + 1,
            content: failureContent,
            timestamp: new Date(),
          });

          return { messageId: assistantMessageId, content: failureContent };
        }

        const finalContent =
          devFinalContent ||
          devLiveResponseContent ||
          "I didn't receive a final response from the upstream agent. Please try again.";
        const devProvenance = buildAssistantProvenance(devFinalMetadata);
        conv.messages.push({
          id: assistantMessageId,
          role: "assistant",
          content: finalContent,
          toolCalls:
            devToolCalls.length > 0 ? JSON.stringify(devToolCalls) : null,
          provenance: devProvenance ? JSON.stringify(devProvenance) : null,
          createdAt: new Date(userCreatedAt.getTime() + 1000),
        });

        broadcastThoughtTrace(input.conversationId, {
          type: "final_response" as any,
          step: 999,
          content: finalContent,
          timestamp: new Date(),
        });

        return { messageId: assistantMessageId, content: finalContent };
      }

      // ── Auth & RBAC ──
      if (!hasPermission(ctx.user.role as Role, "chat:write")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to send messages",
        });
      }

      const [conversation] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }

      // ── Scope validation: ensure user still has access to conversation's stream ──
      const conversationScope = conversation.scope;
      const allowedScopesForCheck = await getAllowedChatScopes(
        ctx.user,
        db,
        conversationScope
      );
      assertAuthorizedChatScope(
        conversationScope,
        allowedScopesForCheck,
        "You no longer have access to this conversation's value stream"
      );

      // Existing conversations are scope-sticky. The dropdown only applies
      // when creating a new conversation.
      const requestedScope = conversation.scope;
      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        requestedScope
      );
      const activeScope = resolveRequestedChatScope(
        requestedScope,
        allowedScopes
      );
      const downstreamScopes = getDownstreamScopes(activeScope);

      // ── Persist user message ──
      const userMessageId = nanoid();
      const userCreatedAt = new Date();
      await db.insert(messages).values({
        id: userMessageId,
        conversationId: input.conversationId,
        scope: activeScope,
        role: "user",
        content: input.content,
        createdAt: userCreatedAt,
      });

      // ── Create placeholder assistant message ──
      const assistantMessageId = nanoid();
      const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1000);
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId: input.conversationId,
        scope: activeScope,
        role: "assistant",
        content: "Thinking...",
        createdAt: assistantCreatedAt,
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      void processConversationMessageStream({
        db,
        user: ctx.user,
        conversationId: input.conversationId,
        inputContent: input.content,
        assistantMessageId,
        activeScope,
        downstreamScopes,
      });

      return {
        messageId: assistantMessageId,
        content: "Thinking...",
      };
    }),

  respondToIntervention: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        planId: z.string().min(1),
        failedStepId: z.string().optional(),
        action: z.enum(["retry", "retry_modified", "skip", "abort"]),
        toolName: z.string().trim().min(1).optional(),
        toolArguments: z.record(z.string(), z.unknown()).optional(),
        userNote: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!hasPermission(ctx.user.role as Role, "chat:write")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to respond to interventions",
        });
      }

      if (
        ["retry", "retry_modified"].includes(input.action) &&
        !input.toolName
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approval response is missing the gated tool name",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Intervention resume requires the database-backed stack",
        });
      }

      const [conversation] = await db
        .select({ userId: conversations.userId, scope: conversations.scope })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Conversation not found",
        });
      }

      const allowedScopes = await getAllowedChatScopes(
        ctx.user,
        db,
        conversation.scope
      );
      assertAuthorizedChatScope(
        conversation.scope,
        allowedScopes,
        "You no longer have access to this conversation's value stream"
      );

      const activeScope = resolveRequestedChatScope(
        conversation.scope,
        allowedScopes
      );
      const downstreamScopes = getDownstreamScopes(activeScope);
      const intervention: InterventionResume = {
        planId: input.planId,
        failedStepId: input.failedStepId,
        action: input.action,
        toolName: input.toolName,
        toolArguments: input.toolArguments,
        userNote: input.userNote,
      };
      const resumePrompt = buildInterventionResumePrompt(intervention);

      const userMessageId = nanoid();
      const userCreatedAt = new Date();
      await db.insert(messages).values({
        id: userMessageId,
        conversationId: input.conversationId,
        scope: activeScope,
        role: "user",
        content: resumePrompt,
        createdAt: userCreatedAt,
      });

      const assistantMessageId = nanoid();
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId: input.conversationId,
        scope: activeScope,
        role: "assistant",
        content: "Thinking...",
        createdAt: new Date(userCreatedAt.getTime() + 1000),
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      void processConversationMessageStream({
        db,
        user: ctx.user,
        conversationId: input.conversationId,
        inputContent: resumePrompt,
        assistantMessageId,
        activeScope,
        downstreamScopes,
        intervention,
      });

      return {
        messageId: assistantMessageId,
        content: "Thinking...",
      };
    }),

  // Get thought trace for a message (ownership enforced via conversation)
  getThoughtTrace: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      const [msg] = await db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      const [conv] = await db
        .select({ userId: conversations.userId })
        .from(conversations)
        .where(eq(conversations.id, msg.conversationId))
        .limit(1);
      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Message not found",
        });
      }
      return await db
        .select()
        .from(thoughtTraceSteps)
        .where(eq(thoughtTraceSteps.messageId, input.messageId))
        .orderBy(thoughtTraceSteps.step);
    }),

  // Get tool executions for a message (ownership enforced)
  getToolExecutions: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      const [msg] = await db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);
      if (!msg)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      const [conv] = await db
        .select({ userId: conversations.userId })
        .from(conversations)
        .where(eq(conversations.id, msg.conversationId))
        .limit(1);
      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Message not found",
        });
      }
      return await db
        .select()
        .from(toolExecutions)
        .where(eq(toolExecutions.messageId, input.messageId))
        .orderBy(toolExecutions.startedAt);
    }),
});
