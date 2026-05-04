'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  ChatMessage, 
  ChatAdapter, 
  ChatStreamEvent,
  TextMessage,
  ReasoningMessage,
} from '../types';

// =============================================================================
// Types
// =============================================================================

export interface UseChatOptions {
  /** Chat adapter for backend communication */
  adapter: ChatAdapter;
  /** Conversation ID */
  conversationId: string;
  /** Called when message is sent */
  onMessageSent?: ((message: ChatMessage) => void) | undefined;
  /** Called when message is received */
  onMessageReceived?: ((message: ChatMessage) => void) | undefined;
  /** Called on error */
  onError?: ((error: Error) => void) | undefined;
}

export interface UseChatReturn {
  /** All messages in the conversation */
  messages: ChatMessage[];
  /** Whether a message is being sent */
  isLoading: boolean;
  /** Whether we're receiving a streaming response */
  isStreaming: boolean;
  /** Current streaming text content (for partial responses) */
  streamingContent: string;
  /** Current thinking/reasoning content */
  thinkingContent: string | null;
  /** Whether the agent is currently thinking */
  isThinking: boolean;
  /** Current error, if any */
  error: string | null;
  /** Send a message */
  sendMessage: (content: string, type?: 'text' | 'data') => Promise<void>;
  /** Clear the error */
  clearError: () => void;
  /** Reload messages from backend */
  reloadMessages: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChat(options: UseChatOptions): UseChatReturn {
  const { adapter, conversationId, onMessageSent, onMessageReceived, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingContentRef = useRef<string | null>(null);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const loadedMessages = await adapter.listMessages(conversationId);
        setMessages(loadedMessages);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message);
        onError?.(error);
      }
    };

    loadMessages();
  }, [adapter, conversationId, onError]);

  const reloadMessages = useCallback(async () => {
    try {
      const loadedMessages = await adapter.listMessages(conversationId);
      setMessages(loadedMessages);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      onError?.(error);
    }
  }, [adapter, conversationId, onError]);

  const handleStreamEvent = useCallback((event: ChatStreamEvent) => {
    switch (event.type) {
      case 'message_delta':
        setStreamingContent(prev => prev + event.delta);
        break;

      case 'message_complete':
        setMessages(prev => [...prev, event.message]);
        setStreamingContent('');
        setIsStreaming(false);
        onMessageReceived?.(event.message);
        break;

      case 'thinking_start':
        setIsThinking(true);
        setThinkingContent(event.content || '');
        thinkingContentRef.current = event.content || '';
        break;

      case 'thinking_update':
        setThinkingContent(event.content);
        thinkingContentRef.current = event.content;
        break;

      case 'thinking_end': {
        setIsThinking(false);
        // Read from ref to avoid stale closure — state updates within
        // the same callback execution don't reflect in the closure.
        const currentThinking = thinkingContentRef.current;
        if (currentThinking) {
          const reasoningMessage: ReasoningMessage = {
            id: `reasoning-${Date.now()}`,
            type: 'reasoning',
            role: 'assistant',
            content: currentThinking,
            timestamp: new Date().toISOString(),
            isComplete: true,
            durationMs: event.durationMs,
          };
          setMessages(prev => [...prev, reasoningMessage]);
        }
        setThinkingContent(null);
        thinkingContentRef.current = null;
        break;
      }

      case 'error':
        setError(event.message);
        setIsLoading(false);
        setIsStreaming(false);
        onError?.(new Error(event.message));
        break;
    }
  }, [onMessageReceived, onError]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'data' = 'text') => {
    if (!content.trim() && type === 'text') return;

    setIsLoading(true);
    setError(null);
    setStreamingContent('');

    // Add user message immediately (optimistic update)
    const userMessage: TextMessage = {
      id: `user-${Date.now()}`,
      type: 'text',
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    onMessageSent?.(userMessage);

    try {
      abortControllerRef.current = new AbortController();
      setIsStreaming(true);

      const eventStream = adapter.sendMessage(conversationId, content, { type });
      
      for await (const event of eventStream) {
        if (abortControllerRef.current?.signal.aborted) break;
        handleStreamEvent(event);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [adapter, conversationId, handleStreamEvent, onMessageSent, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    thinkingContent,
    isThinking,
    error,
    sendMessage,
    clearError,
    reloadMessages,
  };
}
