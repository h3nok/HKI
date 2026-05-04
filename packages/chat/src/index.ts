/**
 * @signature/chat
 * 
 * Shared chat components and hooks for the Signature platform.
 * 
 * This package provides a reusable chat interface that can be integrated
 * into any app via the ChatAdapter interface.
 * 
 * @example
 * ```tsx
 * import { ChatContainer, type ChatAdapter } from '@signature/chat';
 * 
 * // Implement your adapter
 * const myAdapter: ChatAdapter = {
 *   async *sendMessage(conversationId, content) {
 *     // Your implementation
 *   },
 *   async listMessages(conversationId) {
 *     // Your implementation
 *   },
 *   // ...
 * };
 * 
 * // Use in your app
 * <ChatContainer 
 *   adapter={myAdapter} 
 *   conversationId="123"
 * />
 * ```
 */

// Components
export {
  ChatContainer,
  MessageList,
  MessageBubble,
  ChatInput,
  ThinkingIndicator,
  ToolCallDisplay,
  ScrollToBottomButton,
  EvidenceChip,
  EvidenceList,
  type EvidenceChipProps,
  type EvidenceListProps,
} from './components';

// Hooks
export {
  useChat,
  useAutoScroll,
  useStreamingText,
  type UseChatOptions,
  type UseChatReturn,
  type UseAutoScrollOptions,
} from './hooks';

// Types
export type {
  // Message types
  ChatMessage,
  TextMessage,
  DataMessage,
  ReasoningMessage,
  ToolRequestMessage,
  ToolResponseMessage,
  ImageMessage,
  FileMessage,
  MessageRole,
  MessageContentType,
  FeedbackType,

  // Other types
  Citation,
  Agent,
  Conversation,

  // Streaming events
  ChatStreamEvent,
  MessageDeltaEvent,
  MessageCompleteEvent,
  ThinkingStartEvent,
  ThinkingUpdateEvent,
  ThinkingEndEvent,
  ToolCallStartEvent,
  ToolCallEndEvent,
  ErrorEvent,

  // Adapter interface
  ChatAdapter,
  SendMessageOptions,

  // Component props
  ChatContainerProps,
  MessageListProps,
  ChatInputProps,
} from './types';

// Adapters
export { createMockAdapter } from './adapters';

// Utilities — cn() is re-exported from @hki/ui, no local copy needed
