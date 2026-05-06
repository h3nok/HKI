# Agentic UI Components - Developer Guide

## Overview

This guide covers the newly created enterprise-grade UI components for building agentic AI interactions in the Agentic platform. These components are designed to provide transparency, real-time feedback, and configuration capabilities for AI agent operations.

## Components

### 1. Evidence & Citations

**Purpose**: Display source documents, data, and references that agents use to support their responses.

**Components**:

- `EvidenceChip` - Clickable citation chips showing confidence and source type
- `EvidenceList` - Container for multiple evidence chips

**Usage**:

```tsx
import { EvidenceList } from "@/components/chat-ui";

const evidences = [
  {
    id: "1",
    type: "document",
    title: "Q4 Sales Report",
    snippet: "Revenue increased by 23%...",
    confidence: 92,
    url: "https://...",
    metadata: {
      author: "Finance Team",
      date: "2025-12-31",
    },
  },
];

<EvidenceList evidences={evidences} />;
```

**Features**:

- 4 source types: `document`, `database`, `web`, `knowledge_base`
- Color-coded by type
- Confidence scores (0-100)
- Expandable popovers with full details
- External link support
- Metadata display

---

### 2. Confidence Indicators

**Purpose**: Show how confident the agent is in its response with visual feedback.

**Components**:

- `ConfidenceIndicator` - Full indicator with icon, label, and tooltip
- `ConfidenceBar` - Simple progress bar variant

**Usage**:

```tsx
import { ConfidenceIndicator, ConfidenceBar } from '@/components/chat-ui';

<ConfidenceIndicator score={85} size="md" showBar showIcon />
<ConfidenceBar score={85} showLabel />
```

**Thresholds**:

- **High**: ≥80% (Green)
- **Medium**: 50-79% (Amber)
- **Low**: <50% (Red)

**Features**:

- Animated progress bars
- Contextual tooltips with explanations
- Three sizes: `sm`, `md`, `lg`
- Color-coded by confidence level

---

### 3. Agent Flow Visualizer

**Purpose**: Visualize real-time agent collaboration and request routing through the system.

**Component**: `AgentFlowVisualizer`

**Usage**:

```tsx
import { AgentFlowVisualizer } from "@/components/chat-ui";

const agents = [
  {
    id: "1",
    type: "supervisor",
    name: "Supervisor Agent",
    status: "completed",
    message: "Request validated",
    startTime: Date.now() - 5000,
    endTime: Date.now() - 4500,
  },
  // ... more agents
];

const handoffs = [
  {
    from: "supervisor",
    to: "router",
    timestamp: Date.now() - 4500,
    reason: "Initial routing",
  },
];

<AgentFlowVisualizer
  agents={agents}
  currentAgent="router"
  handoffs={handoffs}
  layout="horizontal"
/>;
```

**Agent Types**:

- `supervisor` - Orchestrates workflow
- `router` - Routes to specialized agents
- `tool-use` - Executes tools
- `generation` - Generates responses
- `retail` - Retail-specific queries
- `feedback` - Collects feedback

**Agent Status**:

- `idle` - Waiting
- `active` - Currently processing
- `completed` - Finished successfully
- `error` - Failed

**Features**:

- Animated flow arrows
- Real-time status indicators
- Duration tracking
- Handoff notifications (auto-dismiss after 5s)
- Horizontal or vertical layouts

---

### 4. Streaming Messages

**Purpose**: Display agent responses with typewriter effect as they stream in.

**Components**:

- `StreamingMessage` - Full markdown support with syntax highlighting
- `StreamingText` - Simple text streaming

**Usage**:

```tsx
import { StreamingMessage, StreamingText } from '@/components/chat-ui';

<StreamingMessage
  content="# Results\n\nAnalysis complete..."
  isStreaming={true}
  speed={50}
  showControls
  onComplete={() => console.log('Done!')}
/>

<StreamingText
  text="Processing your request..."
  isStreaming={true}
  speed={30}
/>
```

**Features**:

- Realistic typewriter effect
- Variable speed (characters/second)
- Markdown rendering with code highlighting
- Blinking cursor animation
- Pause/Resume/Skip controls
- Complete callback

---

### 5. Tool Registry Browser

**Purpose**: Interactive tool discovery, documentation, and testing interface.

**Component**: `ToolRegistryBrowser`

**Usage**:

```tsx
import { ToolRegistryBrowser } from "@/components/chat-ui";

const tools = [
  {
    id: "search_products",
    name: "search_products",
    description: "Search retail catalog",
    category: "search",
    status: "available",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Search query",
        required: true,
      },
    ],
    returns: "Array<Product>",
    example: {
      input: { query: "coffee" },
      output: [{ id: "123", name: "Coffee" }],
    },
    stats: {
      totalCalls: 1247,
      successRate: 0.96,
      avgDuration: 234,
    },
  },
];

<ToolRegistryBrowser
  tools={tools}
  onTestTool={async (toolId, input) => {
    // Test tool execution
    return await executeTool(toolId, input);
  }}
/>;
```

**Tool Categories**:

- `search` - Search operations
- `data` - Data retrieval
- `compute` - Computations
- `communication` - External communications
- `other` - Miscellaneous

**Tool Status**:

- `available` - Ready to use
- `unavailable` - Currently unavailable
- `deprecated` - Being phased out

**Features**:

- Search and filter tools
- Expandable tool cards
- Parameter documentation
- Example code with copy button
- Usage statistics
- Test tool execution
- Real-time availability status

---

### 6. Agent Configuration Panel

**Purpose**: Configure agent behavior, parameters, and enabled tools.

**Component**: `AgentConfigPanel`

**Usage**:

```tsx
import { AgentConfigPanel } from "@/components/chat-ui";

const agents = [
  {
    type: "retail",
    name: "Retail Agent",
    description: "Specialized in retail operations",
    icon: Search,
    color: "#E31837",
    capabilities: ["Product Search", "Inventory"],
    recommendedFor: ["Product queries"],
  },
];

const [config, setConfig] = useState({
  type: "retail",
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  enabledTools: ["search_products"],
  guardrails: {
    inputValidation: true,
    outputValidation: true,
    piiDetection: true,
    toxicityFilter: true,
  },
});

<AgentConfigPanel
  agents={agents}
  currentConfig={config}
  availableTools={tools}
  onConfigChange={setConfig}
  onSave={() => saveConfig(config)}
/>;
```

**Configuration Options**:

**Model Parameters**:

- `temperature` (0-1) - Creativity vs focus
- `maxTokens` (100-4000) - Response length
- `topP` (0-1) - Nucleus sampling

**Quick Presets**:

- `balanced` - temp: 0.7, topP: 0.9
- `creative` - temp: 0.9, topP: 0.95
- `precise` - temp: 0.3, topP: 0.8

**Guardrails**:

- Input validation
- Output validation
- PII detection
- Toxicity filtering

**Features**:

- Agent selection cards
- Real-time parameter adjustment
- Tool enable/disable toggles
- Preset configurations
- Unsaved changes indicator
- Reset to defaults

---

## Integration Examples

### Complete Chat Message with Evidence and Confidence

```tsx
import {
  StreamingMessage,
  EvidenceList,
  ConfidenceIndicator,
} from "@/components/chat-ui";

function AgentMessage({ message }) {
  return (
    <div className="space-y-3">
      {/* Main response */}
      <StreamingMessage
        content={message.content}
        isStreaming={message.streaming}
        speed={50}
      />

      {/* Evidence */}
      {message.evidences && <EvidenceList evidences={message.evidences} />}

      {/* Confidence */}
      {message.confidence && (
        <ConfidenceIndicator score={message.confidence} size="sm" />
      )}
    </div>
  );
}
```

### Agent Status Dashboard

```tsx
import { AgentFlowVisualizer, MultiAgentDashboard } from "@/components/chat-ui";

function AgentStatus({ agents, handoffs, currentAgent }) {
  return (
    <div className="space-y-6">
      <AgentFlowVisualizer
        agents={agents}
        currentAgent={currentAgent}
        handoffs={handoffs}
      />

      <MultiAgentDashboard agents={agents} activeAgentId={currentAgent} />
    </div>
  );
}
```

---

## Design System

All components use CSS variables for theming:

```css
--primary: Agent primary color --foreground: Text color
  --muted-foreground: Secondary text --card: Card background --border: Border
  color --destructive: Error/danger color --success: Success color
  (fallback: #16a34a) --warning: Warning color (fallback: #d97706);
```

**Animations**:

- Duration: 200-300ms for interactions
- Easing: `[0.16, 1, 0.3, 1]` (ease-out-expo)
- Framer Motion for complex animations

**Typography**:

- Font sizes: 10px-16px range
- Font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- Line heights: 1.5-1.6 for readability

---

## Best Practices

### Evidence & Citations

- Always provide confidence scores when available
- Include metadata for verification
- Limit to 3-5 most relevant sources
- Link to full sources when possible

### Confidence Indicators

- Show for AI-generated content
- Explain what affects confidence
- Use tooltips for detailed breakdowns
- Update in real-time if confidence changes

### Agent Flow

- Show only active agents in compact views
- Display duration for performance insights
- Use handoff notifications sparingly
- Clear visual hierarchy (supervisor → router → workers)

### Streaming Messages

- Default speed: 30-50 chars/second
- Provide skip option for long responses
- Show cursor during streaming
- Handle markdown for formatted output

### Tool Registry

- Keep tool descriptions concise (1-2 sentences)
- Provide realistic examples
- Update stats in real-time
- Group tools by category

### Agent Configuration

- Provide sensible defaults
- Show unsaved changes indicator
- Explain parameter impacts
- Include preset options

---

## Accessibility

All components support:

- Keyboard navigation
- Screen reader labels
- Focus indicators
- ARIA attributes
- Color contrast (WCAG AA)

---

## Performance

**Optimization tips**:

- Use `useMemo` for filtered/sorted data
- Debounce search inputs
- Virtual scrolling for large tool lists
- Lazy load evidence popover content
- Memoize expensive calculations

---

## TypeScript Types

All components export their prop types:

```tsx
import type {
  Evidence,
  ConfidenceIndicatorProps,
  AgentNode,
  AgentHandoff,
  Tool,
  AgentConfig,
} from "@/components/chat-ui";
```

---

## Demo

View all components in action:

```tsx
import { AgenticComponentsDemo } from "@/pages/AgenticComponentsDemo";
```

Navigate to `/demo/agentic-components` in the Agentic app.

---

## Support

For questions or issues:

1. Check component props and types
2. Review examples in demo page
3. Consult design tokens in `design-system.css`
4. See chat-ui-root.tsx for integration patterns
