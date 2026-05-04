/**
 * Mock Chat Adapter
 * 
 * A mock implementation of ChatAdapter for testing and prototyping.
 * Simulates streaming responses with realistic delays.
 */

import type { 
  ChatAdapter, 
  ChatMessage, 
  Conversation, 
  Agent,
  ChatStreamEvent,
  SendMessageOptions,
  TextMessage,
} from '../types';

interface MockAdapterOptions {
  /** Simulated response delay in ms */
  responseDelay?: number;
  /** Whether to simulate streaming */
  simulateStreaming?: boolean;
  /** Custom response generator */
  responseGenerator?: (message: string) => string;
}

export function createMockAdapter(options: MockAdapterOptions = {}): ChatAdapter {
  const {
    responseDelay = 1000,
    simulateStreaming = true,
    responseGenerator = defaultResponseGenerator,
  } = options;

  // In-memory storage
  const conversations = new Map<string, Conversation>();
  const messageStore = new Map<string, ChatMessage[]>();

  return {
    async *sendMessage(
      conversationId: string,
      content: string,
      _options?: SendMessageOptions
    ): AsyncGenerator<ChatStreamEvent> {
      const timestamp = new Date().toISOString();
      const messageId = `msg-${Date.now()}`;

      // Simulate thinking
      yield {
        type: 'thinking_start',
        timestamp,
        conversationId,
        content: 'Processing your request...',
      };

      await delay(responseDelay / 2);

      yield {
        type: 'thinking_update',
        timestamp: new Date().toISOString(),
        conversationId,
        content: 'Generating response...',
      };

      await delay(responseDelay / 2);

      yield {
        type: 'thinking_end',
        timestamp: new Date().toISOString(),
        conversationId,
        durationMs: responseDelay,
      };

      // Generate response
      const response = responseGenerator(content);

      if (simulateStreaming) {
        // Stream response word by word
        const words = response.split(' ');
        for (const word of words) {
          yield {
            type: 'message_delta',
            timestamp: new Date().toISOString(),
            conversationId,
            messageId,
            delta: word + ' ',
          };
          await delay(50 + Math.random() * 50);
        }
      }

      // Complete message
      const assistantMessage: TextMessage = {
        id: messageId,
        type: 'text',
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      // Store message
      const messages = messageStore.get(conversationId) || [];
      messages.push(assistantMessage);
      messageStore.set(conversationId, messages);

      yield {
        type: 'message_complete',
        timestamp: new Date().toISOString(),
        conversationId,
        messageId,
        message: assistantMessage,
      };
    },

    async listMessages(conversationId: string): Promise<ChatMessage[]> {
      return messageStore.get(conversationId) || [];
    },

    async createConversation(agentId?: string): Promise<Conversation> {
      const conversation: Conversation = {
        id: `conv-${Date.now()}`,
        title: 'New Conversation',
        status: 'active',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agent: agentId ? { id: agentId, name: 'Mock Agent' } : undefined,
      };

      conversations.set(conversation.id, conversation);
      messageStore.set(conversation.id, []);

      return conversation;
    },

    async getConversation(conversationId: string): Promise<Conversation> {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      return {
        ...conversation,
        messages: messageStore.get(conversationId) || [],
      };
    },

    async listAgents(): Promise<Agent[]> {
      return [
        {
          id: 'mock-agent-1',
          name: 'Mock Assistant',
          description: 'A mock AI assistant for testing',
          status: 'ready',
          capabilities: ['chat', 'analysis'],
        },
        {
          id: 'mock-agent-2',
          name: 'Mock Researcher',
          description: 'A mock research agent',
          status: 'ready',
          capabilities: ['research', 'summarization'],
        },
      ];
    },

    async cancelMessage(): Promise<void> {
      // No-op for mock
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function defaultResponseGenerator(message: string): string {
  const responses = [
    `I understand you're asking about "${message.slice(0, 50)}...". Let me help you with that.`,
    `That's a great question! Based on my analysis, here's what I found regarding your query about "${message.slice(0, 30)}..."`,
    `I've processed your request. Here's my response to "${message.slice(0, 40)}..."`,
  ];
  
  return responses[Math.floor(Math.random() * responses.length)] +
    '\n\nThis is a mock response. In production, this would be generated by a real AI agent.';
}
