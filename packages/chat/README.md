# @hki/chat

Shared chat components and hooks for the HKI platform.

## Installation

This package is part of the HKI AI Platform monorepo. It's automatically available to all apps via workspace dependencies.

```json
{
  "dependencies": {
    "@hki/chat": "*"
  }
}
```

## Usage

### Basic Usage

```tsx
import { ChatContainer, type ChatAdapter } from '@hki/chat';

// 1. Implement the ChatAdapter interface
const myAdapter: ChatAdapter = {
  async *sendMessage(conversationId, content, options) {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    
    // Parse SSE stream and yield events
    for await (const event of parseSSE(response)) {
      yield event;
    }
  },
  
  async listMessages(conversationId) {
    const response = await fetch(`/api/conversations/${conversationId}/messages`);
    return response.json();
  },
  
  async createConversation(agentId) {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
    return response.json();
  },
  
  async getConversation(conversationId) {
    const response = await fetch(`/api/conversations/${conversationId}`);
    return response.json();
  },
};

// 2. Use the ChatContainer
function MyChat() {
  return (
    <ChatContainer
      adapter={myAdapter}
      conversationId="conv-123"
      agent={{ id: 'agent-1', name: 'AI Assistant' }}
    />
  );
}
```

### Using Individual Components

```tsx
import { 
  MessageList, 
  ChatInput, 
  useChat,
  useAutoScroll 
} from '@hki/chat';

function CustomChat() {
  const { messages, sendMessage, isLoading } = useChat({
    adapter: myAdapter,
    conversationId: 'conv-123',
  });

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

### Custom Message Rendering

```tsx
import { MessageList, MessageBubble, ToolCallDisplay } from '@hki/chat';
import type { ChatMessage } from '@hki/chat';

function CustomMessageList({ messages }) {
  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'tool_request') {
      return <ToolCallDisplay request={message} />;
    }
    
    return <MessageBubble message={message} />;
  };

  return (
    <MessageList
      messages={messages}
      renderMessage={renderMessage}
    />
  );
}
```

## API Reference

### Components

| Component | Description |
|-----------|-------------|
| `ChatContainer` | Full chat interface with messages, input, and state management |
| `MessageList` | Scrollable message list with auto-scroll |
| `MessageBubble` | Individual message display |
| `ChatInput` | Text input with send button |
| `ThinkingIndicator` | Animated "thinking" indicator |
| `ToolCallDisplay` | Tool call request/response display |
| `ScrollToBottomButton` | Button to scroll to latest messages |

### Hooks

| Hook | Description |
|------|-------------|
| `useChat` | Main hook for chat state management |
| `useAutoScroll` | Auto-scroll behavior for message lists |
| `useStreamingText` | Handle streaming text with cursor |

### Types

See `src/types/index.ts` for full type definitions.

## Architecture

This package follows the **adapter pattern** to remain backend-agnostic:

```
┌─────────────────────────────────────────────────────────────┐
│                    @hki/chat                           │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Components  │    │    Hooks    │    │    Types    │     │
│  │             │    │             │    │             │     │
│  │ ChatContainer    │ useChat     │    │ ChatMessage │     │
│  │ MessageList │    │ useAutoScroll   │ ChatAdapter │     │
│  │ ChatInput   │    │ useStreamingText│ etc.        │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                                 │
│         └──────────────────┼─────────────────────────────────│
│                            │                                 │
│                     ChatAdapter                              │
│                     (interface)                              │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │        Your Backend          │
              │   (Implement ChatAdapter)    │
              └─────────────────────────────┘
```

Apps implement the `ChatAdapter` interface to connect to their specific backend.

## Styling

Components use Tailwind CSS with the following CSS variables expected:

- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--border`
- `--background`, `--foreground`
- `--destructive`

These are provided by `@hki/ui/tokens`.
