/**
 * Value Stream definitions — shared between client and server.
 *
 * A "value stream" is a business domain (pharmacy, fresh-foods, etc.)
 * that scopes what agents, tools, and data a user can access.
 *
 * All value stream data lives in the database (valueStreams table).
 * This file provides only types and constants — no hardcoded data.
 */

export type RetrievalStrategy = "semantic" | "hybrid" | "graph";
export type RuntimeModelTier = "auto" | "fast" | "smart" | "thinking";
export type RuntimeApprovalMode = "never" | "sensitive_only" | "always";

export interface GuardrailConfig {
  inputValidation: boolean;
  outputValidation: boolean;
  piiDetection: boolean;
  toxicityFilter: boolean;
}

export interface MemoryConfig {
  enabled: boolean;
  similarityThreshold: number;
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  inputValidation: true,
  outputValidation: true,
  piiDetection: true,
  toxicityFilter: true,
};

export const DEFAULT_MEMORY: MemoryConfig = {
  enabled: true,
  similarityThreshold: 0.85,
};

export type ChunkStrategy = "sentence" | "fixed" | "sliding_window";

export interface RuntimeBudgetConfig {
  maxTurns?: number;
  maxToolCalls?: number;
  maxTokens?: number;
}

export interface RuntimeToolPermissionConfig {
  approvalMode?: RuntimeApprovalMode;
  sensitiveTools?: string[];
  requireApprovalTools?: string[];
  denyTools?: string[];
  riskOverrides?: Record<string, "low" | "medium" | "high">;
}

export interface RuntimeMemoryPolicyConfig {
  enabled?: boolean;
  maxSemanticFacts?: number;
  maxEpisodes?: number;
  maxProcedures?: number;
  includeRules?: boolean;
  storeEpisodes?: boolean;
  consolidateAfterEpisodes?: number;
}

export interface RuntimeExecutionPolicyConfig {
  model?: string;
  modelTier?: RuntimeModelTier;
  enablePlanning?: boolean;
  retrievalStrategy?: RetrievalStrategy;
  budgets?: RuntimeBudgetConfig;
  toolPermissions?: RuntimeToolPermissionConfig;
  memory?: RuntimeMemoryPolicyConfig;
}

export interface KnowledgeConfig {
  chunkSize: number;
  chunkOverlap: number;
  chunkStrategy: ChunkStrategy;
  similarityThreshold: number;
  bm25Weight: number;
  vectorWeight: number;
  maxResults: number;
  maxDocSizeMb: number;
  allowedFileTypes: string[];
  /**
   * When true, a post-retrieval LLM reranking pass is applied before
   * results are returned. Improves precision at the cost of ~200–400 ms
   * additional latency. Recommended for high-quality RAG streams where
   * retrieval precision matters more than speed.
   */
  enableReranking?: boolean;
  executionPolicy?: RuntimeExecutionPolicyConfig;
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
  chunkStrategy: "sentence",
  similarityThreshold: 0.85,
  bm25Weight: 0.3,
  vectorWeight: 0.7,
  maxResults: 5,
  maxDocSizeMb: 50,
  allowedFileTypes: ["pdf", "docx", "xlsx", "txt", "csv", "html", "md", "pptx"],
  enableReranking: false,
};

export const DEFAULT_RUNTIME_EXECUTION_POLICY: RuntimeExecutionPolicyConfig = {
  modelTier: "auto",
  enablePlanning: true,
  budgets: {
    maxTurns: 8,
    maxToolCalls: 8,
    maxTokens: 50_000,
  },
  toolPermissions: {
    approvalMode: "sensitive_only",
    sensitiveTools: ["get_member_info"],
    requireApprovalTools: [],
    denyTools: [],
    riskOverrides: {},
  },
  memory: {
    enabled: true,
    maxSemanticFacts: 8,
    maxEpisodes: 3,
    maxProcedures: 3,
    includeRules: true,
    storeEpisodes: true,
    consolidateAfterEpisodes: 5,
  },
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstNumber(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "number") return value[key] as number;
  }
  return undefined;
}

function firstBoolean(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "boolean") return value[key] as boolean;
  }
  return undefined;
}

function firstString(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (typeof value?.[key] === "string") return value[key] as string;
  }
  return undefined;
}

function firstStringArray(
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

function normalizeRiskOverrides(
  value: Record<string, unknown> | undefined
): Record<string, "low" | "medium" | "high"> {
  const raw =
    asRecord(value?.riskOverrides) ?? asRecord(value?.risk_overrides) ?? {};
  const normalized: Record<string, "low" | "medium" | "high"> = {};
  for (const [key, risk] of Object.entries(raw)) {
    if (risk === "low" || risk === "medium" || risk === "high") {
      normalized[key] = risk;
    }
  }
  return normalized;
}

export function normalizeExecutionPolicyConfig(
  value?: Partial<RuntimeExecutionPolicyConfig> | null
): RuntimeExecutionPolicyConfig {
  const rawPolicy = asRecord(value);
  const rawBudgets = asRecord(rawPolicy?.budgets);
  const rawToolPermissions =
    asRecord(rawPolicy?.toolPermissions) ??
    asRecord(rawPolicy?.tool_permissions);
  const rawMemory = asRecord(rawPolicy?.memory);

  return {
    ...DEFAULT_RUNTIME_EXECUTION_POLICY,
    ...(firstString(rawPolicy, "model")
      ? { model: firstString(rawPolicy, "model") }
      : {}),
    modelTier:
      (firstString(rawPolicy, "modelTier", "model_tier") as
        | RuntimeModelTier
        | undefined) ?? DEFAULT_RUNTIME_EXECUTION_POLICY.modelTier,
    enablePlanning:
      firstBoolean(rawPolicy, "enablePlanning", "enable_planning") ??
      DEFAULT_RUNTIME_EXECUTION_POLICY.enablePlanning,
    retrievalStrategy:
      (firstString(rawPolicy, "retrievalStrategy", "retrieval_strategy") as
        | RetrievalStrategy
        | undefined) ?? DEFAULT_RUNTIME_EXECUTION_POLICY.retrievalStrategy,
    budgets: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.budgets,
      ...(firstNumber(rawBudgets, "maxTurns", "max_turns") !== undefined
        ? { maxTurns: firstNumber(rawBudgets, "maxTurns", "max_turns") }
        : {}),
      ...(firstNumber(rawBudgets, "maxToolCalls", "max_tool_calls") !==
      undefined
        ? {
            maxToolCalls: firstNumber(
              rawBudgets,
              "maxToolCalls",
              "max_tool_calls"
            ),
          }
        : {}),
      ...(firstNumber(rawBudgets, "maxTokens", "max_tokens") !== undefined
        ? { maxTokens: firstNumber(rawBudgets, "maxTokens", "max_tokens") }
        : {}),
    },
    toolPermissions: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions,
      approvalMode:
        (firstString(rawToolPermissions, "approvalMode", "approval_mode") as
          | RuntimeApprovalMode
          | undefined) ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.approvalMode,
      sensitiveTools:
        firstStringArray(
          rawToolPermissions,
          "sensitiveTools",
          "sensitive_tools"
        ) ?? DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.sensitiveTools,
      requireApprovalTools:
        firstStringArray(
          rawToolPermissions,
          "requireApprovalTools",
          "require_approval_tools"
        ) ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.requireApprovalTools,
      denyTools:
        firstStringArray(rawToolPermissions, "denyTools", "deny_tools") ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.denyTools,
      riskOverrides: normalizeRiskOverrides(rawToolPermissions),
    },
    memory: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.memory,
      ...(firstBoolean(rawMemory, "enabled") !== undefined
        ? { enabled: firstBoolean(rawMemory, "enabled") }
        : {}),
      ...(firstNumber(rawMemory, "maxSemanticFacts", "max_semantic_facts") !==
      undefined
        ? {
            maxSemanticFacts: firstNumber(
              rawMemory,
              "maxSemanticFacts",
              "max_semantic_facts"
            ),
          }
        : {}),
      ...(firstNumber(rawMemory, "maxEpisodes", "max_episodes") !== undefined
        ? { maxEpisodes: firstNumber(rawMemory, "maxEpisodes", "max_episodes") }
        : {}),
      ...(firstNumber(rawMemory, "maxProcedures", "max_procedures") !==
      undefined
        ? {
            maxProcedures: firstNumber(
              rawMemory,
              "maxProcedures",
              "max_procedures"
            ),
          }
        : {}),
      ...(firstBoolean(rawMemory, "includeRules", "include_rules") !== undefined
        ? {
            includeRules: firstBoolean(
              rawMemory,
              "includeRules",
              "include_rules"
            ),
          }
        : {}),
      ...(firstBoolean(rawMemory, "storeEpisodes", "store_episodes") !==
      undefined
        ? {
            storeEpisodes: firstBoolean(
              rawMemory,
              "storeEpisodes",
              "store_episodes"
            ),
          }
        : {}),
      ...(firstNumber(
        rawMemory,
        "consolidateAfterEpisodes",
        "consolidate_after_episodes"
      ) !== undefined
        ? {
            consolidateAfterEpisodes: firstNumber(
              rawMemory,
              "consolidateAfterEpisodes",
              "consolidate_after_episodes"
            ),
          }
        : {}),
    },
  };
}

export function normalizeKnowledgeConfig(
  value?: Partial<KnowledgeConfig> | null
): KnowledgeConfig {
  const rawConfig = asRecord(value);
  const executionPolicy = normalizeExecutionPolicyConfig(
    (rawConfig?.executionPolicy as
      | Partial<RuntimeExecutionPolicyConfig>
      | undefined) ??
      (rawConfig?.execution_policy as
        | Partial<RuntimeExecutionPolicyConfig>
        | undefined)
  );
  const similarityThreshold = firstNumber(
    rawConfig,
    "similarityThreshold",
    "similarity_threshold"
  );
  const maxResults = firstNumber(
    rawConfig,
    "maxResults",
    "max_results",
    "topK",
    "top_k"
  );

  return {
    ...DEFAULT_KNOWLEDGE_CONFIG,
    ...(typeof rawConfig?.chunkSize === "number"
      ? { chunkSize: rawConfig.chunkSize as number }
      : {}),
    ...(typeof rawConfig?.chunkOverlap === "number"
      ? { chunkOverlap: rawConfig.chunkOverlap as number }
      : {}),
    ...(typeof rawConfig?.chunkStrategy === "string"
      ? { chunkStrategy: rawConfig.chunkStrategy as ChunkStrategy }
      : {}),
    ...(similarityThreshold !== undefined ? { similarityThreshold } : {}),
    ...(typeof rawConfig?.bm25Weight === "number"
      ? { bm25Weight: rawConfig.bm25Weight as number }
      : {}),
    ...(typeof rawConfig?.vectorWeight === "number"
      ? { vectorWeight: rawConfig.vectorWeight as number }
      : {}),
    ...(maxResults !== undefined ? { maxResults } : {}),
    ...(typeof rawConfig?.maxDocSizeMb === "number"
      ? { maxDocSizeMb: rawConfig.maxDocSizeMb as number }
      : {}),
    ...(Array.isArray(rawConfig?.allowedFileTypes)
      ? {
          allowedFileTypes: (rawConfig.allowedFileTypes as unknown[])
            .map(item => String(item).trim())
            .filter(Boolean),
        }
      : {}),
    enableReranking:
      firstBoolean(rawConfig, "enableReranking", "enable_reranking") ??
      DEFAULT_KNOWLEDGE_CONFIG.enableReranking,
    executionPolicy,
  };
}

export interface ValueStreamDef {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  /** Admin-configured sample questions shown on the chat welcome screen */
  sampleQuestions?: string[];

  // ── Agent Definition ──────────────────────────────────────────────────────
  /** System prompt / persona for the agent */
  systemPrompt?: string | null;
  /** Retrieval strategy for knowledge serving */
  retrievalStrategy?: RetrievalStrategy;
  /** Tool IDs enabled for this stream's agent */
  enabledTools?: string[];
  /** Guardrail configuration */
  guardrailConfig?: GuardrailConfig;
  /** Memory / caching configuration */
  memoryConfig?: MemoryConfig;
  /** Knowledge base configuration (chunking, search tuning, ingestion rules) */
  knowledgeConfig?: KnowledgeConfig;
}

/** Special scope ID meaning "no restriction" */
export const GLOBAL_SCOPE = "global";

/** Built-in global scope definition (always available, never stored in DB) */
export const GLOBAL_SCOPE_DEF: ValueStreamDef = {
  id: GLOBAL_SCOPE,
  name: "Employee Copilot",
  description:
    "Your general-purpose AI assistant for all operations, tools, and data across the organization",
  icon: "global",
};
