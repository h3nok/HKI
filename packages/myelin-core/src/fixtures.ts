import type { OrchestratorEvent } from "./types.js";

// ─── Fixture 1: KB Lookup ─────────────────────────────────────────────────────
// Simple knowledge retrieval query. Routing → tool_call → KB results → reflect → guardrail → response.

export const kbLookupTrace: OrchestratorEvent[] = [
  {
    type: "guardrail",
    step: 0,
    content: "Input validated",
    metadata: {
      section: "INPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.98,
      violations: [],
    },
  },
  {
    type: "routing",
    step: 2,
    content: "Resolved execution policy",
    metadata: {
      routed_to: "fast worker",
      model: "gemini-1.5-flash-002",
      model_tier: "fast",
      reason: "default fast-path routing",
      enabled_tools: ["search_knowledge", "search_products", "check_inventory"],
    },
  },
  {
    type: "thinking",
    step: 4,
    content: "Analyzing request",
    metadata: {
      section: "UNDERSTANDING",
      icon: "🧠",
      reasoning: "Determining the best approach.",
    },
  },
  {
    type: "tool_call",
    step: 5,
    content: "Calling search_knowledge",
    metadata: {
      tool: "search_knowledge",
      arguments: {
        query: "HKI conformance levels and evidence requirements",
        mode: "hybrid",
        org_id: "hki-demo",
      },
      tool_call_id: "adk-search_knowledge-a1b2c3d4",
      cache_hit: false,
    },
  },
  {
    type: "knowledge_retrieval",
    step: 6,
    content: "Evaluating knowledge base results",
    metadata: {
      section: "KNOWLEDGE_RETRIEVAL",
      icon: "📚",
      reasoning: "Retrieved 4 chunks from HKI spec.",
      citations: [
        {
          title: "HKI-1.0 Specification — Conformance Levels",
          url: "/spec/HKI-1.0.md",
        },
        { title: "L4 Evidence Requirements", url: "/spec/HKI-1.0.md#l4" },
        { title: "Probe Smoke Test Guide", url: "/docs/probe-smoke.md" },
        { title: "Conformance Registry Format", url: "/conformance.json" },
      ],
      result_count: 4,
    },
  },
  {
    type: "tool_result",
    step: 7,
    content: "Completed search_knowledge",
    metadata: {
      result: {
        tool_call_id: "adk-search_knowledge-a1b2c3d4",
        name: "search_knowledge",
        output: {
          context: "HKI defines 5 conformance levels...",
          results: [],
          citations: [],
        },
        duration_ms: 412,
        cache_hit: false,
        validation: { valid: true },
      },
    },
  },
  {
    type: "reflecting",
    step: 9,
    content: "Computed grounding and token efficiency metrics",
    metadata: {
      token_usage: {
        prompt_tokens: 1240,
        completion_tokens: 380,
        total_tokens: 1620,
        llm_calls: 1,
        kb_used: true,
        kb_chunks_retrieved: 4,
        kb_search_ms: 412,
        estimated_tokens_saved: 520,
        citations_used: 4,
      },
    },
  },
  {
    type: "guardrail",
    step: 999,
    content: "Output validated",
    metadata: {
      section: "OUTPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.96,
      violations: [],
    },
  },
  {
    type: "final_response",
    content:
      "HKI defines five conformance levels. L0 (Non-conformant) means cases are still failing. L1 (Passing) requires all 28 adapter cases to pass. L2 (Baseline) adds an audit debt ratchet. L3 (Evidenced) requires 15 or more threat examples. L4 (Deployed) requires all previous levels plus 10/10 HTTP probes documented in /tmp/hki-evidence.json.",
    metadata: { agent: "policy_worker", model: "gemini-1.5-flash-002" },
  },
  {
    type: "response_metadata",
    metadata: {
      agent: "policy_worker",
      model: "gemini-1.5-flash-002",
      model_tier: "fast",
      confidence: 0.91,
      scope: "engineering",
    },
  },
];

// ─── Fixture 2: Multi-step planning ──────────────────────────────────────────
// Complex query with planning enabled. Shows plan node with step progression.

export const multiStepPlanTrace: OrchestratorEvent[] = [
  {
    type: "guardrail",
    step: 0,
    content: "Input validated",
    metadata: {
      section: "INPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.97,
      violations: [],
    },
  },
  {
    type: "routing",
    step: 2,
    content: "Resolved execution policy",
    metadata: {
      routed_to: "smart worker",
      model: "gemini-1.5-pro-002",
      model_tier: "smart",
      reason: "complex request escalated to higher-tier model",
      enabled_tools: [
        "search_knowledge",
        "check_inventory",
        "get_product_pricing",
        "search_products",
      ],
    },
  },
  {
    type: "planning",
    step: 4,
    content: "Generating execution plan",
    metadata: { section: "PLANNING", icon: "🗺️", model: "gemini-1.5-pro-002" },
  },
  {
    type: "plan_generated",
    step: 5,
    content: "Execution plan ready",
    metadata: {
      plan_id: "plan-x7f2a9b1c3",
      goal: "Analyze inventory and pricing context for the selected product category",
      status: "executing",
      total_steps: 3,
      completed_steps: 0,
      steps: [
        {
          step_id: "step-1",
          tool_name: "check_inventory",
          description: "Check current inventory state",
          status: "planned",
        },
        {
          step_id: "step-2",
          tool_name: "get_product_pricing",
          description: "Retrieve current pricing context",
          status: "planned",
        },
        {
          step_id: "step-3",
          tool_name: "compose_response",
          description: "Compose the final grounded response",
          status: "planned",
        },
      ],
    },
  },
  {
    type: "step_started",
    step: 6,
    content: "Check current inventory state",
    metadata: {
      plan_id: "plan-x7f2a9b1c3",
      step_id: "step-1",
      step_index: 0,
      status: "executing",
      plan_progress: "1/3",
    },
  },
  {
    type: "tool_call",
    step: 7,
    content: "Calling check_inventory",
    metadata: {
      tool: "check_inventory",
      arguments: { category: "electronics", location: "warehouse-west" },
      tool_call_id: "adk-check_inventory-b5c6d7e8",
      cache_hit: false,
    },
  },
  {
    type: "tool_result",
    step: 8,
    content: "Completed check_inventory",
    metadata: {
      result: {
        tool_call_id: "adk-check_inventory-b5c6d7e8",
        name: "check_inventory",
        output: { items: 142, available: 89, reserved: 53 },
        duration_ms: 287,
        cache_hit: false,
        validation: { valid: true },
      },
    },
  },
  {
    type: "step_verified",
    step: 9,
    content: "Check current inventory state",
    metadata: {
      plan_id: "plan-x7f2a9b1c3",
      step_id: "step-1",
      step_index: 0,
      status: "completed",
      duration_ms: 287,
    },
  },
  {
    type: "step_started",
    step: 10,
    content: "Retrieve current pricing context",
    metadata: {
      plan_id: "plan-x7f2a9b1c3",
      step_id: "step-2",
      step_index: 1,
      status: "executing",
      plan_progress: "2/3",
    },
  },
  {
    type: "tool_call",
    step: 11,
    content: "Calling get_product_pricing",
    metadata: {
      tool: "get_product_pricing",
      arguments: { category: "electronics", include_discounts: true },
      tool_call_id: "adk-get_product_pricing-f9g0h1i2",
      cache_hit: true,
    },
  },
  {
    type: "tool_result",
    step: 12,
    content: "Completed get_product_pricing",
    metadata: {
      result: {
        tool_call_id: "adk-get_product_pricing-f9g0h1i2",
        name: "get_product_pricing",
        output: {
          avg_price: 349.99,
          min_price: 19.99,
          max_price: 1299.99,
          discount_active: true,
        },
        duration_ms: 18,
        cache_hit: true,
        validation: { valid: true },
      },
    },
  },
  {
    type: "step_verified",
    step: 13,
    content: "Retrieve current pricing context",
    metadata: {
      plan_id: "plan-x7f2a9b1c3",
      step_id: "step-2",
      step_index: 1,
      status: "completed",
      duration_ms: 18,
    },
  },
  {
    type: "reflecting",
    step: 15,
    content: "Computed grounding and token efficiency metrics",
    metadata: {
      token_usage: {
        prompt_tokens: 1840,
        completion_tokens: 520,
        total_tokens: 2360,
        llm_calls: 1,
        kb_used: false,
        kb_chunks_retrieved: 0,
        estimated_tokens_saved: 0,
        citations_used: 0,
      },
    },
  },
  {
    type: "guardrail",
    step: 999,
    content: "Output validated",
    metadata: {
      section: "OUTPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.94,
      violations: [],
    },
  },
  {
    type: "final_response",
    content:
      "Current electronics inventory shows 89 units available out of 142 total (53 reserved). Active discounts are in effect. Average price is $349.99, ranging from $19.99 to $1,299.99. Availability is healthy with a 63% availability rate.",
    metadata: { agent: "policy_worker" },
  },
  {
    type: "response_metadata",
    metadata: {
      agent: "policy_worker",
      model: "gemini-1.5-pro-002",
      model_tier: "smart",
      confidence: 0.88,
      plan_id: "plan-x7f2a9b1c3",
      scope: "retail",
    },
  },
];

// ─── Fixture 3: Model fallback ────────────────────────────────────────────────
// Primary model unavailable; automatic retry with fallback model.

export const modelFallbackTrace: OrchestratorEvent[] = [
  {
    type: "guardrail",
    step: 0,
    content: "Input validated",
    metadata: {
      section: "INPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.99,
      violations: [],
    },
  },
  {
    type: "routing",
    step: 2,
    content: "Resolved execution policy",
    metadata: {
      routed_to: "thinking worker",
      model: "gemini-2.0-flash-thinking-exp",
      model_tier: "thinking",
      reason: "complex request escalated to higher-tier model",
      enabled_tools: ["search_knowledge"],
    },
  },
  {
    type: "thinking",
    step: 3,
    content: "Retrying request with fallback model",
    metadata: {
      section: "MODEL_FALLBACK",
      icon: "↺",
      reasoning:
        "Primary model gemini-2.0-flash-thinking-exp is unavailable; retrying with gemini-1.5-pro-002.",
      failed_model: "gemini-2.0-flash-thinking-exp",
      fallback_model: "gemini-1.5-pro-002",
    },
  },
  {
    type: "tool_call",
    step: 5,
    content: "Calling search_knowledge",
    metadata: {
      tool: "search_knowledge",
      arguments: {
        query: "HKI envelope validation flow",
        mode: "semantic",
        org_id: "hki-demo",
      },
      tool_call_id: "adk-search_knowledge-c3d4e5f6",
      cache_hit: false,
    },
  },
  {
    type: "knowledge_retrieval",
    step: 6,
    content: "Evaluating knowledge base results",
    metadata: {
      section: "KNOWLEDGE_RETRIEVAL",
      icon: "📚",
      reasoning: "Retrieved 3 chunks.",
      citations: [
        {
          title: "HKI Middleware — FastAPI Integration",
          url: "/packages/hki-runtime-py",
        },
        { title: "Envelope Validation Protocol", url: "/spec/HKI-1.0.md#P01" },
      ],
      result_count: 3,
    },
  },
  {
    type: "tool_result",
    step: 7,
    content: "Completed search_knowledge",
    metadata: {
      result: {
        tool_call_id: "adk-search_knowledge-c3d4e5f6",
        name: "search_knowledge",
        output: {
          context: "HKI middleware validates envelopes on every request...",
          results: [],
        },
        duration_ms: 388,
        cache_hit: false,
        validation: { valid: true },
      },
    },
  },
  {
    type: "reflecting",
    step: 9,
    content: "Computed grounding and token efficiency metrics",
    metadata: {
      token_usage: {
        prompt_tokens: 1560,
        completion_tokens: 290,
        total_tokens: 1850,
        llm_calls: 1,
        kb_used: true,
        kb_chunks_retrieved: 3,
        estimated_tokens_saved: 390,
        citations_used: 2,
      },
    },
  },
  {
    type: "guardrail",
    step: 999,
    content: "Output validated",
    metadata: {
      section: "OUTPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.93,
      violations: [],
    },
  },
  {
    type: "final_response",
    content:
      "The HKI envelope validation flow proceeds as follows: (1) the HkiMiddleware intercepts the request, (2) it decodes the X-HKI-Envelope header, (3) validates the signature using the configured signing secret, (4) checks the active_domain against the authorized_domains list, and (5) rejects with 401/403 on any validation failure.",
    metadata: {},
  },
  {
    type: "response_metadata",
    metadata: {
      agent: "policy_worker",
      model: "gemini-1.5-pro-002",
      model_tier: "smart",
      confidence: 0.87,
      fallback_used: true,
      fallback_reason: "primary_model_unavailable",
      scope: "engineering",
    },
  },
];

// ─── Fixture 4: Human escalation ─────────────────────────────────────────────
// High-risk tool requires human approval. Paused pending HITL.

export const humanEscalationTrace: OrchestratorEvent[] = [
  {
    type: "guardrail",
    step: 0,
    content: "Input validated",
    metadata: {
      section: "INPUT_GUARDRAILS",
      icon: "🛡️",
      passed: true,
      score: 0.96,
      violations: [],
    },
  },
  {
    type: "routing",
    step: 2,
    content: "Resolved execution policy",
    metadata: {
      routed_to: "smart worker",
      model: "gemini-1.5-pro-002",
      model_tier: "smart",
      reason: "complex request escalated to higher-tier model",
      enabled_tools: [
        "search_knowledge",
        "update_member_data",
        "send_notification",
      ],
    },
  },
  {
    type: "thinking",
    step: 4,
    content: "Analyzing request",
    metadata: {
      section: "UNDERSTANDING",
      icon: "🧠",
      reasoning: "Determining the best approach.",
    },
  },
  {
    type: "tool_call",
    step: 5,
    content: "Calling update_member_data",
    metadata: {
      tool: "update_member_data",
      arguments: {
        member_id: "M-88291",
        field: "notification_preference",
        value: "email",
      },
      tool_call_id: "adk-update_member_data-d4e5f6g7",
      cache_hit: false,
    },
  },
  {
    type: "tool_result",
    step: 6,
    content: "update_member_data blocked by approval policy",
    metadata: {
      result: {
        tool_call_id: "adk-update_member_data-d4e5f6g7",
        name: "update_member_data",
        output: {
          error: "Human approval required before using update_member_data.",
          approval_required: true,
        },
        error: "Human approval required before using update_member_data.",
        duration_ms: 0,
        cache_hit: false,
        validation: { valid: false, error: "approval_required" },
      },
    },
  },
  {
    type: "human_escalation",
    step: 7,
    content: "update_member_data requires human approval",
    metadata: {
      intervention: {
        plan_id: "plan-fallback",
        failed_step_id: "adk-update_member_data-d4e5f6g7",
        error: "Human approval required before using update_member_data.",
        context: "update_member_data is gated as a high risk tool.",
        available_actions: ["retry_modified", "abort"],
        completed_steps: [],
      },
    },
  },
  {
    type: "final_response",
    content: "Paused pending approval before running `update_member_data`.",
    metadata: {},
  },
  {
    type: "response_metadata",
    metadata: {
      agent: "policy_worker",
      model: "gemini-1.5-pro-002",
      model_tier: "smart",
      confidence: 0.0,
      scope: "retail",
    },
  },
];

// ─── Fixture 5: Fast-path conversational ──────────────────────────────────────
// Simple greeting handled without any LLM call. Direct fast-path response.

export const fastPathTrace: OrchestratorEvent[] = [
  {
    type: "routing",
    step: 1,
    content: "Resolved execution policy",
    metadata: {
      routed_to: "conversation fast path",
      model: "direct_response",
      model_tier: "fast",
      reason:
        "handled conversational turn without model, memory, or tool execution",
      enabled_tools: ["search_knowledge", "search_products"],
    },
  },
  {
    type: "thinking",
    step: 2,
    content: "Handled conversational turn directly",
    metadata: {
      section: "FAST_PATH",
      icon: "⚡",
      reasoning:
        "Greeting or simple conversational turn does not require KB retrieval, memory recall, or tool execution.",
    },
  },
  {
    type: "final_response",
    content:
      "Hi. I can help with HKI knowledge, product lookup, inventory, pricing, and workflow questions. Ask a specific question and I will use the right tools only when needed.",
    metadata: {},
  },
  {
    type: "response_metadata",
    metadata: {
      agent: "policy_worker",
      model: "direct_response",
      model_tier: "fast",
      confidence: 0.94,
      scope: "default",
    },
  },
];

// ─── Scenario registry ────────────────────────────────────────────────────────

export interface TraceScenario {
  id: string;
  title: string;
  description: string;
  query: string;
  events: OrchestratorEvent[];
  tags: string[];
}

export const TRACE_SCENARIOS: TraceScenario[] = [
  {
    id: "kb-lookup",
    title: "Knowledge Base Lookup",
    description:
      "A knowledge retrieval query grounded against the HKI specification. Shows routing, hybrid search, KB citations, token reflection, and guardrail gates.",
    query:
      "What are the HKI conformance levels and what evidence does each require?",
    events: kbLookupTrace,
    tags: ["retrieval", "guardrails", "fast-tier"],
  },
  {
    id: "multi-step-plan",
    title: "Multi-step Planning",
    description:
      "A complex analytical query that triggers the execution planner. Shows plan generation, sequential step progression, cache hits, and smart-tier routing.",
    query:
      "Analyze the current inventory and pricing context for the electronics category",
    events: multiStepPlanTrace,
    tags: ["planning", "multi-tool", "smart-tier"],
  },
  {
    id: "model-fallback",
    title: "Model Fallback",
    description:
      "Primary thinking-tier model is unavailable. The agent automatically retries with the smart-tier fallback and still delivers a grounded response.",
    query: "Explain the HKI envelope validation flow in detail",
    events: modelFallbackTrace,
    tags: ["fallback", "resilience", "thinking-tier"],
  },
  {
    id: "human-escalation",
    title: "Human-in-the-Loop Escalation",
    description:
      "A high-risk tool invocation is blocked by the approval policy. The agent pauses and surfaces the intervention event for human review.",
    query: "Update the notification preference for member M-88291 to email",
    events: humanEscalationTrace,
    tags: ["HITL", "approval", "high-risk"],
  },
  {
    id: "fast-path",
    title: "Conversational Fast Path",
    description:
      "A simple greeting is resolved without any LLM call, memory recall, or tool invocation. Demonstrates the direct fast-path routing.",
    query: "Hi",
    events: fastPathTrace,
    tags: ["fast-path", "no-llm"],
  },
];
