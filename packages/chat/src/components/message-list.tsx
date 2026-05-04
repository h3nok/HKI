'use client';

import { Bot } from 'lucide-react';
import { cn } from '@hki/ui';
import { useAutoScroll } from '../hooks/use-auto-scroll';
import { MessageBubble } from './message-bubble';
import { ThinkingIndicator } from './thinking-indicator';
import { ScrollToBottomButton } from './scroll-to-bottom-button';
import type { MessageListProps } from '../types';

export function MessageList({
  messages,
  isStreaming = false,
  streamingContent,
  className,
  renderMessage,
  showActions = true,
  onFeedback,
  onRegenerate,
  onEdit,
  getConfidence,
}: MessageListProps) {
  const {
    containerRef,
    bottomRef,
    showScrollButton,
    scrollToBottom,
  } = useAutoScroll<HTMLDivElement>([messages, streamingContent], {
    threshold: 100,
    smooth: true,
  });

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Start a Conversation
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Send a message to begin chatting with the AI assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className={cn('h-full overflow-y-auto p-4', className)}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, index) => {
            const isLastAssistant = 
              index === messages.length - 1 && 
              message.role === 'assistant';

            if (renderMessage) {
              return (
                <div key={message.id}>
                  {renderMessage(message)}
                </div>
              );
            }

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={isLastAssistant && isStreaming}
                streamingContent={isLastAssistant ? streamingContent : undefined}
                showActions={showActions}
                confidence={getConfidence?.(message)}
                onFeedback={onFeedback}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
              />
            );
          })}

          {/* Show thinking indicator when streaming but no assistant message yet */}
          {isStreaming && 
           messages.length > 0 && 
           messages[messages.length - 1]?.role === 'user' && (
            <ThinkingIndicator />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <ScrollToBottomButton onClick={scrollToBottom} />
      )}
    </div>
  );
}
