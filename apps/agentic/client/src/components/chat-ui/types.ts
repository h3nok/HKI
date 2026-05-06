/**
 * Agentic Chat UI Types
 * Type definitions for the chat interface
 */

// Message content types
export type TextContent = {
  type: "text";
  author: "user" | "agent";
  format: "plain" | "markdown";
  content: string;
  attachments?: string[];
};

export type DataContent = {
  type: "data";
  author: "user" | "agent";
  data: Record<string, unknown>;
};

export type ReasoningContent = {
  type: "reasoning";
  author: "agent";
  content: string;
};

export type ToolRequestContent = {
  type: "tool_request";
  author: "agent";
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResponseContent = {
  type: "tool_response";
  author: "tool";
  tool_call_id: string;
  content: string | Record<string, unknown>;
};

export type TaskMessageContent =
  | TextContent
  | DataContent
  | ReasoningContent
  | ToolRequestContent
  | ToolResponseContent;

/** Metadata passed through from the orchestrator and persisted in DB */
export interface TaskMessageAttributes {
  confidence?: number | null;
  citations?: Array<{
    source?: string;
    url?: string;
    source_url?: string;
    sourceUrl?: string;
    title?: string;
    document_title?: string;
    documentTitle?: string;
    chunk_text?: string;
    chunkText?: string;
    preview?: string;
    content_preview?: string;
    contentPreview?: string;
    highlight?: string;
    score?: number;
    relevance_score?: number;
    relevanceScore?: number;
    document_id?: string;
    documentId?: string;
    chunk_id?: string;
    chunkId?: string;
    page_or_section?: string;
    pageOrSection?: string;
    id?: string;
  }>;
  guardrails?: {
    passed: boolean;
    input_violations: string[];
    output_violations: string[];
    score: number;
  };
  provenance?: Record<string, unknown>;
}

// Task Message (Agentex-compatible)
export interface TaskMessage {
  id: string;
  task_id: string;
  content: TaskMessageContent;
  created_at: string;
  updated_at: string;
  streaming_status: "STREAMING" | "DONE";
  /** Real orchestrator metadata (confidence, guardrails, citations) */
  attributes?: TaskMessageAttributes;
}

// Task (maps to Agentic's Conversation)
export interface Task {
  id: string;
  agent_name: string;
  description?: string;
  isPinned?: boolean;
  /** Project/folder this conversation belongs to */
  projectId?: string | null;
  /** Domain scope this conversation belongs to (e.g. 'halpr', 'global') */
  scope?: string;
  /** Preview text of the last assistant message in this conversation */
  lastMessage?: string;
  /** Total number of messages in this conversation */
  messageCount?: number;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

// Agent
export interface Agent {
  name: string;
  description?: string;
  status: "Ready" | "Deploying" | "Error";
  acp_type: "sync" | "async" | "agentic";
}

// Span (for traces)
export interface Span {
  id: string;
  name: string;
  task_id: string;
  start_time: string;
  end_time?: string;
  attributes?: Record<string, unknown>;
  events?: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

// JSON utilities
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
