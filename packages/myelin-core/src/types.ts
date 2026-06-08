// ─── Topology types (visualization layer) ────────────────────────────────────

/** Role of a node within an orchestrator topology graph */
export type NodeRole = "orchestrator" | "agent" | "tool" | "persist";

/** A single node in an orchestrator topology, as returned by Neo4j */
export interface TopologyNode {
  id: string;
  role: NodeRole;
  label: string;
  /** Neo4j relationship type this node participates in (e.g. ROUTES_TO) */
  rel: string;
  metadata?: Record<string, unknown>;
}

/** A directed edge between two topology nodes */
export interface TopologyEdge {
  source: string;
  target: string;
  /** Signal frequency hint — higher = more signals traverse this edge */
  weight?: number;
}

/** Full orchestrator topology as derived from the graph database */
export interface OrchestratorTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

// ─── Node types ──────────────────────────────────────────────────────────────

export type NodeKind =
  | "start"
  | "routing"
  | "memory_recall"
  | "planning"
  | "plan"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "knowledge_retrieval"
  | "guardrail"
  | "reflecting"
  | "escalation"
  | "response";

export type NodeStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "warning";

export interface PlanStep {
  stepId: string;
  description: string;
  toolName: string;
  status: "planned" | "executing" | "completed" | "failed";
  durationMs?: number;
  error?: string;
}

export interface AgentNode {
  id: string;
  kind: NodeKind;
  label: string;
  status: NodeStatus;
  startMs: number;
  endMs?: number;
  durationMs?: number;

  // Routing
  model?: string;
  modelTier?: string;
  routingReason?: string;
  enabledTools?: string[];

  // Tool call / result
  tool?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: unknown;
  cacheHit?: boolean;
  approvalRequired?: boolean;

  // Knowledge retrieval
  citations?: Array<{ title: string; url?: string; highlight?: string }>;
  resultCount?: number;

  // Guardrail
  passed?: boolean;
  score?: number;
  violations?: Array<{ rule: string; message: string; severity: string }>;
  guardrailSection?: "input" | "output";

  // Plan
  planId?: string;
  goal?: string;
  steps?: PlanStep[];

  // Reflecting / token usage
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
    llmCalls?: number;
    kbChunksRetrieved?: number;
    estimatedTokensSaved?: number;
  };

  // Escalation
  escalationContext?: string;
  availableActions?: string[];

  // Response
  responseText?: string;
  confidence?: number;

  // Memory
  totalMemories?: number;

  // Thinking
  section?: string;
  icon?: string;
  reasoning?: string;

  // HKI
  hkiDomain?: string;

  // Fallback
  failedModel?: string;
  fallbackModel?: string;

  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Edge types ───────────────────────────────────────────────────────────────

export type EdgeKind = "execution" | "data" | "dependency";

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  animated?: boolean;
  label?: string;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

export type RunStatus = "running" | "success" | "error";

export interface AgentRun {
  id: string;
  query: string;
  startMs: number;
  endMs?: number;
  status: RunStatus;
  nodes: AgentNode[];
  edges: AgentEdge[];
  hkiDomain?: string;
  model?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// ─── Orchestrator events (HKI orchestrator SSE format) ───────────────────────

export interface BaseEvent {
  type: string;
  step?: number;
  content?: string;
}

export interface RoutingEvent extends BaseEvent {
  type: "routing";
  metadata: {
    routed_to: string;
    model: string;
    model_tier: string;
    reason: string;
    enabled_tools?: string[];
  };
}

export interface ThinkingEvent extends BaseEvent {
  type: "thinking";
  metadata: {
    section: string;
    icon?: string;
    reasoning?: string;
    failed_model?: string;
    fallback_model?: string;
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool_call";
  metadata: {
    tool: string;
    arguments: Record<string, unknown>;
    tool_call_id: string;
    cache_hit?: boolean;
  };
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool_result";
  metadata: {
    result: {
      tool_call_id: string;
      name: string;
      output: unknown;
      error?: string;
      duration_ms: number;
      cache_hit: boolean;
      validation?: { valid: boolean; error?: string };
    };
  };
}

export interface KnowledgeRetrievalEvent extends BaseEvent {
  type: "knowledge_retrieval";
  metadata: {
    section: string;
    icon?: string;
    reasoning?: string;
    citations: Array<{ title: string; url?: string; highlight?: string }>;
    result_count: number;
  };
}

export interface GuardrailEvent extends BaseEvent {
  type: "guardrail";
  metadata: {
    section: "INPUT_GUARDRAILS" | "OUTPUT_GUARDRAILS";
    icon?: string;
    passed: boolean;
    score: number;
    report?: unknown;
    violations?: Array<{ rule: string; message: string; severity: string }>;
  };
}

export interface PlanGeneratedEvent extends BaseEvent {
  type: "plan_generated";
  metadata: {
    plan_id: string;
    goal: string;
    status: string;
    total_steps: number;
    completed_steps: number;
    steps: Array<{
      step_id: string;
      tool_name: string;
      description: string;
      status: string;
      duration_ms?: number;
      error?: string;
    }>;
  };
}

export interface PlanningEvent extends BaseEvent {
  type: "planning";
  metadata: { section: string; icon?: string; model: string };
}

export interface StepStartedEvent extends BaseEvent {
  type: "step_started";
  metadata: {
    plan_id: string;
    step_id: string;
    step_index: number;
    status: string;
    plan_progress: string;
  };
}

export interface StepVerifiedEvent extends BaseEvent {
  type: "step_verified";
  metadata: {
    plan_id: string;
    step_id: string;
    step_index: number;
    status: string;
    duration_ms: number;
  };
}

export interface StepFailedEvent extends BaseEvent {
  type: "step_failed";
  metadata: {
    plan_id: string;
    step_id: string;
    step_index: number;
    status: string;
    error: string;
  };
}

export interface MemoryRecallEvent extends BaseEvent {
  type: "memory_recall";
  metadata: { total_memories: number; scope: string };
}

export interface ReflectingEvent extends BaseEvent {
  type: "reflecting";
  metadata: {
    token_usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      llm_calls?: number;
      kb_used?: boolean;
      kb_chunks_retrieved?: number;
      kb_search_ms?: number;
      estimated_tokens_saved?: number;
      citations_used?: number;
    };
  };
}

export interface HumanEscalationEvent extends BaseEvent {
  type: "human_escalation";
  metadata: {
    intervention: {
      plan_id: string;
      failed_step_id: string;
      error: string;
      context: string;
      available_actions: string[];
      completed_steps: string[];
    };
  };
}

export interface FinalResponseChunkEvent extends BaseEvent {
  type: "final_response_chunk";
  content: string;
}

export interface FinalResponseEvent extends BaseEvent {
  type: "final_response";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ResponseMetadataEvent extends BaseEvent {
  type: "response_metadata";
  metadata: {
    agent?: string;
    model?: string;
    model_tier?: string;
    confidence?: number;
    plan_id?: string;
    fallback_used?: boolean;
    fallback_reason?: string;
    enabled_tools?: string[];
    scope?: string;
    [key: string]: unknown;
  };
}

export interface PromptStackEvent extends BaseEvent {
  type: "prompt_stack";
}

export type OrchestratorEvent =
  | RoutingEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | KnowledgeRetrievalEvent
  | GuardrailEvent
  | PlanGeneratedEvent
  | PlanningEvent
  | StepStartedEvent
  | StepVerifiedEvent
  | StepFailedEvent
  | MemoryRecallEvent
  | ReflectingEvent
  | HumanEscalationEvent
  | FinalResponseChunkEvent
  | FinalResponseEvent
  | ResponseMetadataEvent
  | PromptStackEvent;

// ─── Projection ───────────────────────────────────────────────────────────────

export type GraphMutation =
  | { op: "add_node"; node: AgentNode }
  | { op: "update_node"; id: string; updates: Partial<AgentNode> }
  | { op: "add_edge"; edge: AgentEdge }
  | { op: "update_run"; updates: Partial<AgentRun> };

// ─── Algorithms ───────────────────────────────────────────────────────────────

export interface RunSummary {
  totalMs: number;
  toolCallCount: number;
  llmCalls: number;
  kbHits: number;
  tokensUsed: number;
  confidence: number | null;
  hkiDomain: string | null;
  model: string | null;
  status: RunStatus;
}

export interface NodeDiff {
  added: AgentNode[];
  removed: AgentNode[];
  changed: Array<{ nodeId: string; fields: string[] }>;
}

export interface EdgeDiff {
  added: AgentEdge[];
  removed: AgentEdge[];
}

export interface RunDiff {
  nodes: NodeDiff;
  edges: EdgeDiff;
}
