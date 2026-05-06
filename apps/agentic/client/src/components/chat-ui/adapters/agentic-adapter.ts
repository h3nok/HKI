/**
 * Agentic Adapter
 * Converts Agentic BFF's tRPC data models to Agentex-compatible types
 */

import type {
  TaskMessage,
  TaskMessageAttributes,
  Task,
  TextContent,
  ToolRequestContent,
  ToolResponseContent,
  ReasoningContent,
  Span,
} from "../types";

// Agentic message type (from tRPC)
interface AgenticMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  thoughtTrace?: string | null;
  toolCalls?: string | null;
  citations?: string | null;
  confidence?: number | null;
  guardrails?: string | null;
  provenance?: string | null;
  createdAt: Date | string;
}

// Agentic conversation type
interface AgenticConversation {
  id: string;
  userId: number;
  title?: string | null;
  isPinned?: number | null;
  scope?: string | null;
  /** Preview text of the last assistant message (computed by server) */
  lastMessage?: string | null;
  /** Total number of messages in this conversation (computed by server) */
  messageCount?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Agentic thought trace step
interface AgenticThoughtTraceStep {
  id: string;
  messageId: string;
  step: number;
  type: "thinking" | "planning" | "executing" | "reflecting";
  content: string;
  metadata?: string | null;
  createdAt: Date | string;
}

// Agentic tool execution
interface AgenticToolExecution {
  id: string;
  messageId: string;
  toolName: string;
  input: string;
  output?: string | null;
  status: "pending" | "running" | "success" | "error";
  error?: string | null;
  startedAt: Date | string;
  completedAt?: Date | string | null;
}

/**
 * Convert Agentic message to Agentex TaskMessage format
 */
export function agenticMessageToTaskMessage(
  msg: AgenticMessage,
  toolExecutions?: AgenticToolExecution[]
): TaskMessage[] {
  const messages: TaskMessage[] = [];

  // Parse real orchestrator metadata from DB columns
  const attributes: TaskMessageAttributes = {};
  if (msg.confidence != null) attributes.confidence = msg.confidence;
  if (msg.citations) {
    try {
      attributes.citations = JSON.parse(msg.citations);
    } catch {
      /* ignore */
    }
  }
  if (msg.guardrails) {
    try {
      const raw = JSON.parse(msg.guardrails);
      // Orchestrator sends violations as {rule, message, severity} objects — normalize to strings
      attributes.guardrails = {
        passed: raw.passed,
        input_violations: (raw.input_violations ?? []).map((v: any) =>
          typeof v === "string" ? v : (v.message ?? v.rule ?? "Unknown")
        ),
        output_violations: (raw.output_violations ?? []).map((v: any) =>
          typeof v === "string" ? v : (v.message ?? v.rule ?? "Unknown")
        ),
        score: raw.score ?? 100,
      };
    } catch {
      /* ignore */
    }
  }
  if (msg.provenance) {
    try {
      attributes.provenance = JSON.parse(msg.provenance);
    } catch {
      /* ignore */
    }
  }
  const hasAttrs = Object.keys(attributes).length > 0;

  const baseMessage = {
    id: msg.id,
    task_id: msg.conversationId,
    created_at:
      typeof msg.createdAt === "string"
        ? msg.createdAt
        : msg.createdAt.toISOString(),
    updated_at:
      typeof msg.createdAt === "string"
        ? msg.createdAt
        : msg.createdAt.toISOString(),
    streaming_status: "DONE" as const,
    ...(hasAttrs ? { attributes } : {}),
  };

  // Handle user messages
  if (msg.role === "user") {
    const textContent: TextContent = {
      type: "text",
      author: "user",
      format: "plain",
      content: msg.content,
    };
    messages.push({ ...baseMessage, content: textContent });
    return messages;
  }

  // Handle assistant messages - may include tool calls
  if (msg.role === "assistant") {
    // Parse tool calls if present
    // Format: unified objects with both arguments + output from BFF
    //   { tool_call_id, name, arguments, output, error, duration_ms }
    // Legacy format (pre-unification): { id, name, arguments } (call only)
    if (msg.toolCalls) {
      try {
        const toolCalls = JSON.parse(msg.toolCalls) as Array<
          Record<string, any>
        >;

        for (const tc of toolCalls) {
          const callId = tc.tool_call_id || tc.id || `tc-${messages.length}`;
          const toolName = tc.name || "unknown";

          // Tool request (call with arguments)
          const toolRequest: ToolRequestContent = {
            type: "tool_request",
            author: "agent",
            tool_call_id: callId,
            name: toolName,
            arguments: tc.arguments || {},
          };
          messages.push({
            ...baseMessage,
            id: `${msg.id}-tool-req-${callId}`,
            content: toolRequest,
          });

          // Tool response (result with output) — from unified format or toolExecutions
          const hasOutput = tc.output !== undefined;
          const execution = toolExecutions?.find(
            e => e.toolName === toolName && e.messageId === msg.id
          );
          const outputContent = hasOutput
            ? JSON.stringify(tc.output)
            : execution?.output;

          if (outputContent) {
            const toolResponse: ToolResponseContent = {
              type: "tool_response",
              author: "tool",
              tool_call_id: callId,
              content: outputContent,
            };
            messages.push({
              ...baseMessage,
              id: `${msg.id}-tool-res-${callId}`,
              content: toolResponse,
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Add the text response
    if (msg.content) {
      const textContent: TextContent = {
        type: "text",
        author: "agent",
        format: "markdown",
        content: msg.content,
      };
      messages.push({ ...baseMessage, content: textContent });
    }
  }

  return messages;
}

/**
 * Convert Agentic conversation to Agentex Task format
 */
export function agenticConversationToTask(conv: AgenticConversation): Task {
  return {
    id: conv.id,
    agent_name: "agentic-agent", // Default agent name
    description: conv.title || undefined,
    isPinned: conv.isPinned === 1,
    projectId: (conv as any).projectId ?? null,
    scope: conv.scope ?? undefined,
    lastMessage: conv.lastMessage ?? undefined,
    messageCount: conv.messageCount ?? undefined,
    status: "completed",
    created_at:
      typeof conv.createdAt === "string"
        ? conv.createdAt
        : conv.createdAt.toISOString(),
    updated_at:
      typeof conv.updatedAt === "string"
        ? conv.updatedAt
        : conv.updatedAt.toISOString(),
  };
}

/**
 * Convert Agentic thought trace steps to Agentex Spans
 */
export function agenticThoughtTraceToSpans(
  steps: AgenticThoughtTraceStep[],
  taskId: string
): Span[] {
  return steps.map(step => ({
    id: step.id,
    name: `${step.type}: Step ${step.step}`,
    task_id: taskId,
    start_time:
      typeof step.createdAt === "string"
        ? step.createdAt
        : step.createdAt.toISOString(),
    attributes: {
      type: step.type,
      step: step.step,
      content: step.content,
      ...(step.metadata
        ? (() => {
            try {
              return JSON.parse(step.metadata as string);
            } catch {
              return {};
            }
          })()
        : {}),
    },
  }));
}

/**
 * Convert Agentic tool execution to reasoning content
 */
export function agenticToolExecutionToReasoning(
  execution: AgenticToolExecution
): ReasoningContent {
  return {
    type: "reasoning",
    author: "agent",
    content: `Executing tool: ${execution.toolName}\nStatus: ${execution.status}${execution.error ? `\nError: ${execution.error}` : ""}`,
  };
}
