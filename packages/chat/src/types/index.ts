/**
 * @signature/chat - Type Definitions
 * 
 * Core types for the chat system. These are backend-agnostic
 * and can be adapted to any messaging backend.
 */

// =============================================================================
// Message Types
// =============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type FeedbackType = 'positive' | 'negative';

export type MessageContentType = 'text' | 'data' | 'reasoning' | 'tool_request' | 'tool_response' | 'image' | 'file';

export interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
}

export interface DataMessage extends BaseMessage {
  type: 'data';
  content: Record<string, unknown>;
  format?: 'json' | 'table' | 'chart';
}

export interface ReasoningMessage extends BaseMessage {
  type: 'reasoning';
  content: string;
  isComplete?: boolean;
  durationMs?: number;
}

export interface ToolRequestMessage extends BaseMessage {
  type: 'tool_request';
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

export interface ToolResponseMessage extends BaseMessage {
  type: 'tool_response';
  toolId: string;
  toolName: string;
  output: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface ImageMessage extends BaseMessage {
  type: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface FileMessage extends BaseMessage {
  type: 'file';
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export type ChatMessage = 
  | TextMessage 
  | DataMessage 
  | ReasoningMessage 
  | ToolRequestMessage 
  | ToolResponseMessage
  | ImageMessage
  | FileMessage;

// =============================================================================
// Citation / Evidence Types
// =============================================================================

export interface Citation {
  id: string;
  source: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  url?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Agent Types
// =============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  capabilities?: string[];
  status?: 'ready' | 'busy' | 'offline';
}

// =============================================================================
// Conversation Types
// =============================================================================

export interface Conversation {
  id: string;
  title?: string | undefined;
  agent?: Agent | undefined;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | undefined;
}

// =============================================================================
// Streaming Event Types
// =============================================================================

export interface StreamEvent {
  type: string;
  timestamp: string;
  conversationId?: string;
  messageId?: string;
}

export interface MessageDeltaEvent extends StreamEvent {
  type: 'message_delta';
  delta: string;
}

export interface MessageCompleteEvent extends StreamEvent {
  type: 'message_complete';
  message: ChatMessage;
}

export interface ThinkingStartEvent extends StreamEvent {
  type: 'thinking_start';
  content?: string;
}

export interface ThinkingUpdateEvent extends StreamEvent {
  type: 'thinking_update';
  content: string;
}

export interface ThinkingEndEvent extends StreamEvent {
  type: 'thinking_end';
  durationMs: number;
}

export interface ToolCallStartEvent extends StreamEvent {
  type: 'tool_call_start';
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolCallEndEvent extends StreamEvent {
  type: 'tool_call_end';
  toolId: string;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface ErrorEvent extends StreamEvent {
  type: 'error';
  code: string;
  message: string;
  recoverable: boolean;
}

export type ChatStreamEvent =
  | MessageDeltaEvent
  | MessageCompleteEvent
  | ThinkingStartEvent
  | ThinkingUpdateEvent
  | ThinkingEndEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ErrorEvent;

// =============================================================================
// Adapter Interface (for backend integration)
// =============================================================================

/**
 * ChatAdapter - Interface for connecting to any chat backend
 * 
 * Apps implement this interface to connect the chat UI to their backend.
 */
export interface ChatAdapter {
  /** Send a message and receive streaming events */
  sendMessage(
    conversationId: string,
    content: string,
    options?: SendMessageOptions
  ): AsyncIterable<ChatStreamEvent>;

  /** List messages for a conversation */
  listMessages(conversationId: string): Promise<ChatMessage[]>;

  /** Create a new conversation */
  createConversation(agentId?: string): Promise<Conversation>;

  /** Get conversation details */
  getConversation(conversationId: string): Promise<Conversation>;

  /** List available agents */
  listAgents?(): Promise<Agent[]>;

  /** Cancel an ongoing message */
  cancelMessage?(conversationId: string, messageId: string): Promise<void>;
}

export interface SendMessageOptions {
  /** Message type (default: 'text') */
  type?: 'text' | 'data';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Attachments */
  attachments?: File[];
}

// =============================================================================
// Component Props Types
// =============================================================================

export interface ChatContainerProps {
  /** The chat adapter for backend communication */
  adapter: ChatAdapter;
  /** Current conversation ID */
  conversationId: string;
  /** Agent information */
  agent?: Agent;
  /** Enable thought trace panel */
  showThoughtTrace?: boolean;
  /** Custom class name */
  className?: string;
  /** Called when a message is sent */
  onMessageSent?: (message: ChatMessage) => void;
  /** Called when a message is received */
  onMessageReceived?: (message: ChatMessage) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  streamingContent?: string;
  className?: string;
  /** Render custom message content */
  renderMessage?: (message: ChatMessage) => React.ReactNode;
  /** Show message actions (copy, regenerate, edit, feedback) */
  showActions?: boolean;
  /** Called when user provides feedback */
  onFeedback?: (messageId: string, type: FeedbackType) => void;
  /** Called when user wants to regenerate response */
  onRegenerate?: (messageId: string) => void;
  /** Called when user wants to edit their message */
  onEdit?: (messageId: string) => void;
  /** Get confidence score for a message */
  getConfidence?: (message: ChatMessage) => number | undefined;
}

export interface ChatInputProps {
  onSend: (content: string, type?: 'text' | 'data') => void;
  /** Called when user wants to stop generation */
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Enable JSON mode toggle */
  showJsonToggle?: boolean;
  /** Enable file attachments */
  showAttachments?: boolean;
  /** Enable voice input button */
  showVoiceInput?: boolean;
  /** Maximum character length */
  maxLength?: number;
  className?: string;
}
