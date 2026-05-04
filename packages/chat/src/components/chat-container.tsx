'use client';

import { AlertCircle, X } from 'lucide-react';
import { cn } from '@hki/ui';
import { useChat } from '../hooks/use-chat';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import type { ChatContainerProps } from '../types';

/**
 * ChatContainer - Main chat interface component
 * 
 * Orchestrates the chat experience by combining:
 * - Message list with auto-scroll
 * - Input with send functionality
 * - Error handling
 * - Loading states
 * 
 * Requires a ChatAdapter for backend communication.
 */
export function ChatContainer({
  adapter,
  conversationId,
  agent,
  showThoughtTrace: _showThoughtTrace = false,
  className,
  onMessageSent,
  onMessageReceived,
  onError,
}: ChatContainerProps) {
  // TODO: Implement thought trace panel when _showThoughtTrace is true
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    clearError,
  } = useChat({
    adapter,
    conversationId,
    onMessageSent,
    onMessageReceived,
    onError,
  });

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      {agent && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {agent.avatar ? (
            <img 
              src={agent.avatar} 
              alt={agent.name} 
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {agent.name[0]}
            </div>
          )}
          <div>
            <h2 className="font-medium text-foreground">{agent.name}</h2>
            {agent.description && (
              <p className="text-xs text-muted-foreground">{agent.description}</p>
            )}
          </div>
          {isStreaming && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Thinking...
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-destructive/20 bg-destructive/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <button
            onClick={clearError}
            className="text-destructive hover:text-destructive/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
        />
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        placeholder={`Message ${agent?.name || 'AI'}...`}
      />
    </div>
  );
}
